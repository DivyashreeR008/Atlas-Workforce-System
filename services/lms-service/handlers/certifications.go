package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// parseCertDate accepts an empty string (meaning no date) or a YYYY-MM-DD
// date. Anything else is a 400, never a silently dropped value.
func parseCertDate(field, value string) (*time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, fmt.Errorf("%s must be a YYYY-MM-DD date", field)
	}
	utc := t.UTC()
	return &utc, nil
}

// validateCertDateOrder rejects an expiry date that precedes the issue date.
func validateCertDateOrder(issue, expiry *time.Time) error {
	if issue != nil && expiry != nil && expiry.Before(*issue) {
		return fmt.Errorf("expiry_date cannot be before issue_date")
	}
	return nil
}

// startOfTodayUTC gives date-only columns a stable "is it past" boundary, so
// a certificate that expires today still counts as valid today.
func startOfTodayUTC() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

type CertificationHandler struct {
	DB *gorm.DB
}

func (h *CertificationHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	query := h.DB.Where("tenant_id = ?", tenantID)

	if employeeID := c.Query("employee_id"); employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
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
	h.DB.Model(&models.Certification{}).Where("tenant_id = ?", tenantID).Count(&total)

	var certifications []models.Certification
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&certifications).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch certifications",
		})
	}

	return c.JSON(fiber.Map{
		"data":      certifications,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *CertificationHandler) Create(c *fiber.Ctx) error {
	if !middleware.CanManageContent(c) {
		return middleware.Forbidden(c)
	}
	tenantID := middleware.GetTenant(c)

	var req struct {
		EmployeeID       string   `json:"employee_id"`
		Name             string   `json:"name"`
		IssuingAuthority string   `json:"issuing_authority"`
		IssueDate        string   `json:"issue_date"`
		ExpiryDate       string   `json:"expiry_date"`
		CredentialURL    string   `json:"credential_url"`
		Skills           []string `json:"skills"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.EmployeeID == "" || req.Name == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "employee_id and name are required",
		})
	}

	cert := models.Certification{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		EmployeeID:       req.EmployeeID,
		Name:             req.Name,
		IssuingAuthority: req.IssuingAuthority,
		CredentialURL:    req.CredentialURL,
		Skills:           pq.StringArray(req.Skills),
		Status:           "ACTIVE",
	}
	issueDate, err := parseCertDate("issue_date", req.IssueDate)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}
	expiryDate, err := parseCertDate("expiry_date", req.ExpiryDate)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}
	if err := validateCertDateOrder(issueDate, expiryDate); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}
	cert.IssueDate = issueDate
	cert.ExpiryDate = expiryDate

	if err := h.DB.Create(&cert).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create certification",
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"data": cert,
	})
}

func (h *CertificationHandler) Update(c *fiber.Ctx) error {
	if !middleware.CanManageContent(c) {
		return middleware.Forbidden(c)
	}
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var cert models.Certification
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&cert).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Certification not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch certification",
		})
	}

	var req struct {
		Name             *string  `json:"name"`
		IssuingAuthority *string  `json:"issuing_authority"`
		IssueDate        *string  `json:"issue_date"`
		ExpiryDate       *string  `json:"expiry_date"`
		CredentialURL    *string  `json:"credential_url"`
		Skills           []string `json:"skills"`
		Status           *string  `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "name cannot be empty",
		})
	}
	if req.Status != nil && strings.TrimSpace(*req.Status) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "status cannot be empty",
		})
	}

	// Only fields present in the request are written; omitted fields keep
	// their stored values instead of being blanked.
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.IssuingAuthority != nil {
		updates["issuing_authority"] = *req.IssuingAuthority
	}
	if req.CredentialURL != nil {
		updates["credential_url"] = *req.CredentialURL
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Skills != nil {
		updates["skills"] = pq.StringArray(req.Skills)
	}

	issue := cert.IssueDate
	if req.IssueDate != nil {
		parsed, err := parseCertDate("issue_date", *req.IssueDate)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		issue = parsed
		updates["issue_date"] = parsed
	}
	expiry := cert.ExpiryDate
	if req.ExpiryDate != nil {
		parsed, err := parseCertDate("expiry_date", *req.ExpiryDate)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		expiry = parsed
		updates["expiry_date"] = parsed
	}
	if err := validateCertDateOrder(issue, expiry); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	if err := h.DB.Model(&cert).Updates(updates).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update certification",
		})
	}

	h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&cert)
	return c.JSON(fiber.Map{
		"data": cert,
	})
}

func (h *CertificationHandler) Verify(c *fiber.Ctx) error {
	// Verification is an attestation that a credential is genuine, so it
	// stays with admins even though instructors can edit certification rows.
	if !middleware.IsAdmin(c) {
		return middleware.Forbidden(c)
	}
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var cert models.Certification
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&cert).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Certification not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch certification",
		})
	}

	if cert.Verified {
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error": "Certification is already verified",
		})
	}
	if cert.ExpiryDate != nil && cert.ExpiryDate.Before(startOfTodayUTC()) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Cannot verify an expired certification",
		})
	}

	if err := h.DB.Model(&cert).Update("verified", true).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to verify certification",
		})
	}

	cert.Verified = true
	return c.JSON(fiber.Map{
		"data": cert,
	})
}

func (h *CertificationHandler) Expiring(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	daysStr := c.Query("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days < 1 {
		days = 30
	}

	today := startOfTodayUTC()
	cutoff := today.AddDate(0, 0, days)

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Lower bound keeps long-expired certificates out of the expiring-soon
	// view; today's expiries stay in.
	where := "tenant_id = ? AND status = ? AND expiry_date IS NOT NULL AND expiry_date >= ? AND expiry_date <= ?"
	var total int64
	h.DB.Model(&models.Certification{}).Where(where, tenantID, "ACTIVE", today, cutoff).Count(&total)

	var certifications []models.Certification
	if err := h.DB.Where(where, tenantID, "ACTIVE", today, cutoff).
		Order("expiry_date ASC").Offset(offset).Limit(pageSize).Find(&certifications).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch expiring certifications",
		})
	}

	return c.JSON(fiber.Map{
		"data":            certifications,
		"total":           total,
		"page":            page,
		"page_size":       pageSize,
		"expiring_within": days,
	})
}
