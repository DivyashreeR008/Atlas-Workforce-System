package handlers

import (
	"net/http"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RecommendationHandler struct {
	DB *gorm.DB
}

func (h *RecommendationHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	employeeID := c.Query("employee_id")
	query := h.DB.Where("tenant_id = ?", tenantID)
	if employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if priority := c.Query("priority"); priority != "" {
		query = query.Where("priority = ?", priority)
	}

	var recs []models.LearningRecommendation
	if err := query.Order("created_at DESC").Find(&recs).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch recommendations"})
	}
	return c.JSON(fiber.Map{"data": recs})
}

func (h *RecommendationHandler) Generate(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	employeeID := c.Query("employee_id")
	if employeeID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "employee_id required"})
	}

	h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).Delete(&models.LearningRecommendation{})

	var skills []models.SkillMatrix
	h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).Find(&skills)

	skillMap := make(map[string]models.SkillMatrix)
	for _, s := range skills {
		skillMap[s.Skill] = s
	}

	var courses []models.Course
	h.DB.Where("tenant_id = ? AND status = ?", tenantID, "PUBLISHED").Find(&courses)

	var recs []models.LearningRecommendation
	for _, course := range courses {
		for _, reqSkill := range course.Skills {
			if es, ok := skillMap[reqSkill]; ok {
				if es.ProficiencyLevel == "EXPERT" || es.ProficiencyLevel == "ADVANCED" {
					continue
				}
			}
			priority := "MEDIUM"
			if _, exists := skillMap[reqSkill]; !exists {
				priority = "HIGH"
			}
			recs = append(recs, models.LearningRecommendation{
				ID:              uuid.New().String(),
				TenantID:        tenantID,
				EmployeeID:      employeeID,
				SkillName:       reqSkill,
				GapScore:        3.0,
				RecommendedType: "COURSE",
				RecommendedID:   course.ID,
				Title:           course.Title,
				Description:     course.Description,
				Priority:        priority,
				Reason:          "Skill gap in " + reqSkill,
				Status:          "PENDING",
			})
		}
	}

	if len(recs) > 0 {
		for _, rec := range recs {
			h.DB.Create(&rec)
		}
	}

	return c.JSON(fiber.Map{"data": recs, "generated": len(recs)})
}

func (h *RecommendationHandler) Acknowledge(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var rec models.LearningRecommendation
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&rec).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Recommendation not found"})
	}
	h.DB.Model(&rec).Update("status", "ACKNOWLEDGED")
	return c.JSON(fiber.Map{"data": rec})
}

type JourneyHandler struct {
	DB *gorm.DB
}

func (h *JourneyHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	employeeID := c.Query("employee_id")
	query := h.DB.Where("tenant_id = ?", tenantID)
	if employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	var journeys []models.LearningJourney
	if err := query.Order("created_at DESC").Find(&journeys).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch journeys"})
	}
	return c.JSON(fiber.Map{"data": journeys})
}

func (h *JourneyHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	var req models.LearningJourney
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	req.ID = uuid.New().String()
	req.TenantID = tenantID
	req.Status = "ACTIVE"
	if err := h.DB.Create(&req).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create journey"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"data": req})
}

func (h *JourneyHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var journey models.LearningJourney
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&journey).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Journey not found"})
	}
	var req struct {
		CurrentStep int     `json:"current_step"`
		ProgressPct float64 `json:"progress_pct"`
		Status      string  `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	updates := map[string]interface{}{}
	if req.CurrentStep > 0 { updates["current_step"] = req.CurrentStep }
	if req.ProgressPct > 0 { updates["progress_pct"] = req.ProgressPct }
	if req.Status != "" { updates["status"] = req.Status }
	if err := h.DB.Model(&journey).Updates(updates).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update"})
	}
	h.DB.First(&journey, "id = ?", id)
	return c.JSON(fiber.Map{"data": journey})
}

func (h *JourneyHandler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.LearningJourney{}).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Journey not found"})
	}
	return c.JSON(fiber.Map{"message": "Journey deleted"})
}
