package handlers

import (
	"net/http"
	"time"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type MentorHandler struct {
	DB *gorm.DB
}

func (h *MentorHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	query := h.DB.Where("tenant_id = ?", tenantID)
	if dept := c.Query("department"); dept != "" {
		query = query.Where("department = ?", dept)
	}
	if available := c.Query("available"); available == "true" {
		query = query.Where("is_available = ?", true)
	}
	if expertise := c.Query("expertise"); expertise != "" {
		query = query.Where("expertise @> ARRAY[?]::text[]", expertise)
	}

	var mentors []models.MentorProfile
	if err := query.Order("rating DESC").Find(&mentors).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch mentors"})
	}
	return c.JSON(fiber.Map{"data": mentors})
}

func (h *MentorHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	var req struct {
		EmployeeID string   `json:"employee_id"`
		FullName   string   `json:"full_name"`
		Department string   `json:"department"`
		Role       string   `json:"role"`
		Bio        string   `json:"bio"`
		Expertise  []string `json:"expertise"`
		MaxMentees int      `json:"max_mentees"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.EmployeeID == "" || req.FullName == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "employee_id and full_name required"})
	}
	profile := models.MentorProfile{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		EmployeeID:     req.EmployeeID,
		FullName:       req.FullName,
		Department:     req.Department,
		Role:           req.Role,
		Bio:            req.Bio,
		Expertise:      pq.StringArray(req.Expertise),
		MaxMentees:     req.MaxMentees,
		CurrentMentees: 0,
		IsAvailable:    true,
	}
	if profile.MaxMentees == 0 {
		profile.MaxMentees = 3
	}
	if err := h.DB.Create(&profile).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create mentor profile"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"data": profile})
}

func (h *MentorHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var mentor models.MentorProfile
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&mentor).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Mentor not found"})
	}
	var req struct {
		Bio         *string  `json:"bio"`
		IsAvailable *bool    `json:"is_available"`
		MaxMentees  *int     `json:"max_mentees"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	updates := map[string]interface{}{}
	if req.Bio != nil { updates["bio"] = *req.Bio }
	if req.IsAvailable != nil { updates["is_available"] = *req.IsAvailable }
	if req.MaxMentees != nil { updates["max_mentees"] = *req.MaxMentees }
	h.DB.Model(&mentor).Updates(updates)
	h.DB.First(&mentor, "id = ?", id)
	return c.JSON(fiber.Map{"data": mentor})
}

func (h *MentorHandler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.MentorProfile{}).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Mentor not found"})
	}
	return c.JSON(fiber.Map{"message": "Mentor deleted"})
}

func (h *MentorHandler) Match(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	skill := c.Query("skill")

	var mentors []models.MentorProfile
	query := h.DB.Where("tenant_id = ? AND is_available = ? AND current_mentees < max_mentees", tenantID, true)
	if skill != "" {
		query = query.Where("expertise @> ARRAY[?]::text[]", skill)
	}
	if err := query.Order("rating DESC").Find(&mentors).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to match mentors"})
	}
	return c.JSON(fiber.Map{"data": mentors, "matched": len(mentors)})
}

type MentorSessionHandler struct {
	DB *gorm.DB
}

func (h *MentorSessionHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	mentorID := c.Query("mentor_id")
	menteeID := c.Query("mentee_id")
	query := h.DB.Where("tenant_id = ?", tenantID).Preload("Mentor")
	if mentorID != "" { query = query.Where("mentor_id = ?", mentorID) }
	if menteeID != "" { query = query.Where("mentee_id = ?", menteeID) }
	var sessions []models.MentorSession
	if err := query.Order("scheduled_at DESC").Find(&sessions).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch sessions"})
	}
	return c.JSON(fiber.Map{"data": sessions})
}

func (h *MentorSessionHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	var req struct {
		MentorID    string `json:"mentor_id"`
		MenteeID    string `json:"mentee_id"`
		Topic       string `json:"topic"`
		ScheduledAt string `json:"scheduled_at"`
		DurationMins int   `json:"duration_mins"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	session := models.MentorSession{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		MentorID:  req.MentorID,
		MenteeID:  req.MenteeID,
		Topic:     req.Topic,
		Status:    "SCHEDULED",
		DurationMins: req.DurationMins,
	}
	if session.DurationMins == 0 { session.DurationMins = 30 }
	if req.ScheduledAt != "" {
		if d, err := time.Parse(time.RFC3339, req.ScheduledAt); err == nil {
			session.ScheduledAt = &d
		}
	}
	if err := h.DB.Create(&session).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"data": session})
}

func (h *MentorSessionHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var session models.MentorSession
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&session).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Session not found"})
	}
	var req struct {
		Status   string `json:"status"`
		Notes    string `json:"notes"`
		Feedback string `json:"feedback"`
		Rating   int    `json:"rating"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	updates := map[string]interface{}{}
	if req.Status != "" { updates["status"] = req.Status }
	if req.Notes != "" { updates["notes"] = req.Notes }
	if req.Feedback != "" { updates["feedback"] = req.Feedback }
	if req.Rating > 0 { updates["rating"] = req.Rating }
	h.DB.Model(&session).Updates(updates)
	h.DB.First(&session, "id = ?", id)
	return c.JSON(fiber.Map{"data": session})
}
