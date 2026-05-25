package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type LearningPathHandler struct {
	DB *gorm.DB
}

func (h *LearningPathHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	query := h.DB.Where("tenant_id = ?", tenantID)
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if targetRole := c.Query("target_role"); targetRole != "" {
		query = query.Where("target_role = ?", targetRole)
	}

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	h.DB.Model(&models.LearningPath{}).Where("tenant_id = ?", tenantID).Count(&total)

	var paths []models.LearningPath
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&paths).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch learning paths",
		})
	}

	return c.JSON(fiber.Map{
		"data":      paths,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *LearningPathHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	var req struct {
		Name                 string          `json:"name"`
		Description          string          `json:"description"`
		TargetRole           string          `json:"target_role"`
		RequiredSkills       []string        `json:"required_skills"`
		Courses              json.RawMessage `json:"courses"`
		EstimatedDurationDays int            `json:"estimated_duration_days"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.Name == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "name is required",
		})
	}

	path := models.LearningPath{
		ID:                    uuid.New().String(),
		TenantID:              tenantID,
		Name:                  req.Name,
		Description:           req.Description,
		TargetRole:            req.TargetRole,
		RequiredSkills:        pq.StringArray(req.RequiredSkills),
		Courses:               datatypes.JSON(req.Courses),
		EstimatedDurationDays: req.EstimatedDurationDays,
		Status:                "ACTIVE",
	}

	if err := h.DB.Create(&path).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create learning path",
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"data": path,
	})
}

func (h *LearningPathHandler) Get(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	employeeID := c.Query("employee_id")

	var path models.LearningPath
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&path).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Learning path not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch learning path",
		})
	}

	if employeeID == "" {
		return c.JSON(fiber.Map{"data": path})
	}

	var courseIDs []string
	if path.Courses != nil {
		var rawCourses []struct {
			CourseID string `json:"course_id"`
		}
		if err := json.Unmarshal(path.Courses, &rawCourses); err != nil {
			var simpleIDs []string
			if err2 := json.Unmarshal(path.Courses, &simpleIDs); err2 == nil {
				courseIDs = simpleIDs
			}
		} else {
			for _, rc := range rawCourses {
				if rc.CourseID != "" {
					courseIDs = append(courseIDs, rc.CourseID)
				}
			}
		}
	}

	type CourseProgress struct {
		CourseID    string  `json:"course_id"`
		Status      string  `json:"status"`
		ProgressPct float64 `json:"progress_pct"`
	}

	var progress []CourseProgress
	if len(courseIDs) > 0 {
		var enrollments []models.Enrollment
		h.DB.Where("course_id IN ? AND employee_id = ? AND tenant_id = ?",
			courseIDs, employeeID, tenantID).Find(&enrollments)

		enrolledMap := make(map[string]models.Enrollment)
		for _, e := range enrollments {
			enrolledMap[e.CourseID] = e
		}

		for _, cid := range courseIDs {
			cp := CourseProgress{CourseID: cid, Status: "NOT_STARTED"}
			if e, ok := enrolledMap[cid]; ok {
				cp.Status = e.Status
				cp.ProgressPct = e.ProgressPct
			}
			progress = append(progress, cp)
		}
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"learning_path": path,
			"progress":      progress,
		},
	})
}

func (h *LearningPathHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var path models.LearningPath
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&path).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Learning path not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch learning path",
		})
	}

	var req struct {
		Name                 string          `json:"name"`
		Description          string          `json:"description"`
		TargetRole           string          `json:"target_role"`
		RequiredSkills       []string        `json:"required_skills"`
		Courses              json.RawMessage `json:"courses"`
		EstimatedDurationDays int            `json:"estimated_duration_days"`
		Status               string          `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	updates := map[string]interface{}{
		"name":                   req.Name,
		"description":            req.Description,
		"target_role":            req.TargetRole,
		"status":                 req.Status,
		"estimated_duration_days": req.EstimatedDurationDays,
	}
	if req.RequiredSkills != nil {
		updates["required_skills"] = pq.StringArray(req.RequiredSkills)
	}
	if req.Courses != nil {
		updates["courses"] = datatypes.JSON(req.Courses)
	}

	if err := h.DB.Model(&path).Updates(updates).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update learning path",
		})
	}

	h.DB.First(&path, "id = ?", id)
	return c.JSON(fiber.Map{
		"data": path,
	})
}

func (h *LearningPathHandler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var path models.LearningPath
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&path).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Learning path not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch learning path",
		})
	}

	if err := h.DB.Delete(&path).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete learning path",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Learning path deleted successfully",
	})
}
