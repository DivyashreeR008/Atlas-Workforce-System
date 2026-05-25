package handlers

import (
	"net/http"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SkillHandler struct {
	DB *gorm.DB
}

func (h *SkillHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	query := h.DB.Where("tenant_id = ?", tenantID)
	if employeeID := c.Query("employee_id"); employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if skill := c.Query("skill"); skill != "" {
		query = query.Where("skill ILIKE ?", "%"+skill+"%")
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
	h.DB.Model(&models.SkillMatrix{}).Where("tenant_id = ?", tenantID).Count(&total)

	var skills []models.SkillMatrix
	if err := query.Order("employee_id, skill").Offset(offset).Limit(pageSize).Find(&skills).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch skills",
		})
	}

	return c.JSON(fiber.Map{
		"data":      skills,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *SkillHandler) Upsert(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	var req struct {
		EmployeeID        string  `json:"employee_id"`
		Skill             string  `json:"skill"`
		ProficiencyLevel  string  `json:"proficiency_level"`
		YearsOfExperience float64 `json:"years_of_experience"`
		LastUsedDate      string  `json:"last_used_date"`
		Certified         bool    `json:"certified"`
		EndorsedBy        string  `json:"endorsed_by"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.EmployeeID == "" || req.Skill == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "employee_id and skill are required",
		})
	}

	var existing models.SkillMatrix
	result := h.DB.Where("employee_id = ? AND skill = ? AND tenant_id = ?",
		req.EmployeeID, req.Skill, tenantID).First(&existing)

	if result.Error == nil {
		updates := map[string]interface{}{
			"proficiency_level":  req.ProficiencyLevel,
			"years_of_experience": req.YearsOfExperience,
			"certified":          req.Certified,
			"endorsed_by":        req.EndorsedBy,
		}
		if err := h.DB.Model(&existing).Updates(updates).Error; err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to update skill",
			})
		}
		h.DB.First(&existing, "id = ?", existing.ID)
		return c.JSON(fiber.Map{"data": existing})
	}

	entry := models.SkillMatrix{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		EmployeeID:        req.EmployeeID,
		Skill:             req.Skill,
		ProficiencyLevel:  req.ProficiencyLevel,
		YearsOfExperience: req.YearsOfExperience,
		Certified:         req.Certified,
		EndorsedBy:        req.EndorsedBy,
	}

	if err := h.DB.Create(&entry).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to add skill",
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"data": entry,
	})
}

func (h *SkillHandler) GetEmployeeSkills(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	employeeID := c.Params("employee_id")

	var skills []models.SkillMatrix
	if err := h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).
		Order("skill ASC").Find(&skills).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch skills",
		})
	}

	return c.JSON(fiber.Map{
		"data": skills,
	})
}

func (h *SkillHandler) GapAnalysis(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	employeeID := c.Query("employee_id")
	targetRole := c.Query("target_role")

	if employeeID == "" || targetRole == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "employee_id and target_role are required",
		})
	}

	var employeeSkills []models.SkillMatrix
	if err := h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).
		Find(&employeeSkills).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch employee skills",
		})
	}

	empSkillMap := make(map[string]models.SkillMatrix)
	for _, s := range employeeSkills {
		empSkillMap[s.Skill] = s
	}

	var paths []models.LearningPath
	h.DB.Where("tenant_id = ? AND target_role = ? AND status = ?",
		tenantID, targetRole, "ACTIVE").Find(&paths)

	var requiredSkills []string
	for _, p := range paths {
		requiredSkills = append(requiredSkills, p.RequiredSkills...)
	}

	seen := make(map[string]bool)
	var uniqueRequired []string
	for _, s := range requiredSkills {
		if !seen[s] {
			seen[s] = true
			uniqueRequired = append(uniqueRequired, s)
		}
	}

	type Gap struct {
		Skill          string `json:"skill"`
		HasSkill       bool   `json:"has_skill"`
		CurrentLevel   string `json:"current_level,omitempty"`
		RecommendedPath string `json:"recommended_path,omitempty"`
	}

	var gaps []Gap
	for _, rs := range uniqueRequired {
		gap := Gap{Skill: rs}
		if es, ok := empSkillMap[rs]; ok {
			gap.HasSkill = true
			gap.CurrentLevel = es.ProficiencyLevel
		} else {
			gap.HasSkill = false
			for _, p := range paths {
				for _, prs := range p.RequiredSkills {
					if prs == rs {
						gap.RecommendedPath = p.Name
						break
					}
				}
				if gap.RecommendedPath != "" {
					break
				}
			}
		}
		gaps = append(gaps, gap)
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"employee_id":    employeeID,
			"target_role":    targetRole,
			"total_skills":   len(uniqueRequired),
			"acquired":       len(employeeSkills),
			"gaps":           gaps,
		},
	})
}

func (h *SkillHandler) Matrix(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	var skills []models.SkillMatrix
	query := h.DB.Where("tenant_id = ?", tenantID)
	if employeeID := c.Query("employee_id"); employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if err := query.Order("employee_id, skill").Find(&skills).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch skill matrix",
		})
	}

	matrix := make(map[string][]models.SkillMatrix)
	for _, s := range skills {
		matrix[s.EmployeeID] = append(matrix[s.EmployeeID], s)
	}

	var allSkills []string
	skillSet := make(map[string]bool)
	for _, s := range skills {
		if !skillSet[s.Skill] {
			skillSet[s.Skill] = true
			allSkills = append(allSkills, s.Skill)
		}
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"matrix":     matrix,
			"all_skills": allSkills,
			"employees":  len(matrix),
		},
	})
}
