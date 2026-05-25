package handlers

import (
	"net/http"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	DB *gorm.DB
}

func (h *DashboardHandler) Summary(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	var totalCourses int64
	h.DB.Model(&models.Course{}).Where("tenant_id = ?", tenantID).Count(&totalCourses)

	var totalEnrollments int64
	h.DB.Model(&models.Enrollment{}).Where("tenant_id = ?", tenantID).Count(&totalEnrollments)

	var completedEnrollments int64
	h.DB.Model(&models.Enrollment{}).Where("tenant_id = ? AND status = ?", tenantID, "COMPLETED").Count(&completedEnrollments)

	var totalCertifications int64
	h.DB.Model(&models.Certification{}).Where("tenant_id = ?", tenantID).Count(&totalCertifications)

	var activeCertifications int64
	h.DB.Model(&models.Certification{}).Where("tenant_id = ? AND status = ?", tenantID, "ACTIVE").Count(&activeCertifications)

	var totalAssessments int64
	h.DB.Model(&models.Assessment{}).Where("tenant_id = ?", tenantID).Count(&totalAssessments)

	var publishedCourses int64
	h.DB.Model(&models.Course{}).Where("tenant_id = ? AND status = ?", tenantID, "PUBLISHED").Count(&publishedCourses)

	completionRate := 0.0
	if totalEnrollments > 0 {
		completionRate = float64(completedEnrollments) / float64(totalEnrollments) * 100
	}

	var inProgress int64
	h.DB.Model(&models.Enrollment{}).Where("tenant_id = ? AND status = ?", tenantID, "IN_PROGRESS").Count(&inProgress)

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"total_courses":          totalCourses,
			"published_courses":      publishedCourses,
			"total_enrollments":      totalEnrollments,
			"completed_enrollments":  completedEnrollments,
			"in_progress":            inProgress,
			"completion_rate_pct":    completionRate,
			"total_certifications":   totalCertifications,
			"active_certifications":  activeCertifications,
			"total_assessments":      totalAssessments,
		},
	})
}

func (h *DashboardHandler) Employee(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	employeeID := c.Params("employee_id")

	if employeeID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "employee_id is required",
		})
	}

	var enrollments []models.Enrollment
	if err := h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).
		Preload("Course").Order("created_at DESC").Find(&enrollments).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch enrollments",
		})
	}

	var inProgress []models.Enrollment
	var completed []models.Enrollment
	var dropped []models.Enrollment

	for _, e := range enrollments {
		switch e.Status {
		case "COMPLETED":
			completed = append(completed, e)
		case "DROPPED", "EXPIRED":
			dropped = append(dropped, e)
		default:
			inProgress = append(inProgress, e)
		}
	}

	var certifications []models.Certification
	h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).
		Order("created_at DESC").Find(&certifications)

	var skills []models.SkillMatrix
	h.DB.Where("employee_id = ? AND tenant_id = ?", employeeID, tenantID).
		Order("skill ASC").Find(&skills)

	var activeCerts int64
	h.DB.Model(&models.Certification{}).Where("employee_id = ? AND tenant_id = ? AND status = ?",
		employeeID, tenantID, "ACTIVE").Count(&activeCerts)

	completionRate := 0.0
	total := len(inProgress) + len(completed) + len(dropped)
	if total > 0 {
		completionRate = float64(len(completed)) / float64(total) * 100
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"employee_id":       employeeID,
			"courses_in_progress": inProgress,
			"courses_completed":   completed,
			"courses_dropped":     dropped,
			"certifications":      certifications,
			"active_certifications": activeCerts,
			"skills":              skills,
			"completion_rate_pct": completionRate,
		},
	})
}
