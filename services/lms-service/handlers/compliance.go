package handlers

import (
	"net/http"
	"time"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ComplianceHandler struct {
	DB *gorm.DB
}

func (h *ComplianceHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	query := h.DB.Where("tenant_id = ?", tenantID)
	if employeeID := c.Query("employee_id"); employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if policy := c.Query("policy"); policy != "" {
		query = query.Where("policy_name ILIKE ?", "%"+policy+"%")
	}

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", 20)
	offset := (page - 1) * pageSize

	var total int64
	h.DB.Model(&models.ComplianceTraining{}).Where("tenant_id = ?", tenantID).Count(&total)

	var trainings []models.ComplianceTraining
	if err := query.Preload("Course").Order("due_date ASC").Offset(offset).Limit(pageSize).Find(&trainings).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch compliance trainings"})
	}
	return c.JSON(fiber.Map{"data": trainings, "total": total, "page": page, "page_size": pageSize})
}

func (h *ComplianceHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	var req struct {
		CourseID       string `json:"course_id"`
		EmployeeID     string `json:"employee_id"`
		PolicyName     string `json:"policy_name"`
		PolicyCategory string `json:"policy_category"`
		DueDate        string `json:"due_date"`
		IsMandatory    *bool  `json:"is_mandatory"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.EmployeeID == "" || req.PolicyName == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "employee_id and policy_name required"})
	}

	training := models.ComplianceTraining{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		CourseID:     req.CourseID,
		EmployeeID:   req.EmployeeID,
		PolicyName:   req.PolicyName,
		PolicyCategory: req.PolicyCategory,
		Status:       "PENDING",
		IsMandatory:  true,
	}
	if req.IsMandatory != nil {
		training.IsMandatory = *req.IsMandatory
	}
	if req.DueDate != "" {
		if d, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			training.DueDate = &d
		}
	}
	if err := h.DB.Create(&training).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create compliance training"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"data": training})
}

func (h *ComplianceHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var training models.ComplianceTraining
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&training).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Training not found"})
	}

	var req struct {
		Status        string  `json:"status"`
		Score         *float64 `json:"score"`
		CompletedDate string  `json:"completed_date"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.Score != nil {
		updates["score"] = req.Score
		updates["attempts"] = training.Attempts + 1
	}
	if req.CompletedDate != "" {
		if d, err := time.Parse("2006-01-02", req.CompletedDate); err == nil {
			updates["completed_date"] = d
		}
	}
	if err := h.DB.Model(&training).Updates(updates).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update"})
	}
	h.DB.First(&training, "id = ?", id)
	return c.JSON(fiber.Map{"data": training})
}

func (h *ComplianceHandler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var training models.ComplianceTraining
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&training).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Training not found"})
	}
	return c.JSON(fiber.Map{"message": "Compliance training deleted"})
}

func (h *ComplianceHandler) Dashboard(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	var total int64; h.DB.Model(&models.ComplianceTraining{}).Where("tenant_id = ?", tenantID).Count(&total)
	var completed int64; h.DB.Model(&models.ComplianceTraining{}).Where("tenant_id = ? AND status = ?", tenantID, "COMPLETED").Count(&completed)
	var overdue int64; h.DB.Model(&models.ComplianceTraining{}).Where("tenant_id = ? AND due_date < NOW() AND status != ?", tenantID, "COMPLETED").Count(&overdue)
	var pending int64; h.DB.Model(&models.ComplianceTraining{}).Where("tenant_id = ? AND status = ?", tenantID, "PENDING").Count(&pending)
	var inProgress int64; h.DB.Model(&models.ComplianceTraining{}).Where("tenant_id = ? AND status = ?", tenantID, "IN_PROGRESS").Count(&inProgress)

	var byPolicy []struct {
		PolicyName    string
		Total         int64
		Completed     int64
	}
	h.DB.Model(&models.ComplianceTraining{}).Select("policy_name, COUNT(*) as total, SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed").
		Where("tenant_id = ?", tenantID).Group("policy_name").Find(&byPolicy)

	rate := 0.0
	if total > 0 {
		rate = float64(completed) / float64(total) * 100
	}
	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"total": total, "completed": completed, "overdue": overdue,
			"pending": pending, "in_progress": inProgress, "compliance_rate": rate,
			"by_policy": byPolicy,
		},
	})
}
