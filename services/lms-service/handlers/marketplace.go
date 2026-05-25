package handlers

import (
	"net/http"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type MarketplaceHandler struct {
	DB *gorm.DB
}

func (h *MarketplaceHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	query := h.DB.Where("tenant_id = ?", tenantID)
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	if typ := c.Query("type"); typ != "" {
		query = query.Where("type = ?", typ)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", 20)
	offset := (page - 1) * pageSize

	var total int64
	h.DB.Model(&models.MarketplaceListing{}).Where("tenant_id = ?", tenantID).Count(&total)

	var listings []models.MarketplaceListing
	if err := query.Order("rating DESC").Offset(offset).Limit(pageSize).Find(&listings).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch listings"})
	}
	return c.JSON(fiber.Map{"data": listings, "total": total, "page": page, "page_size": pageSize})
}

func (h *MarketplaceHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	var req struct {
		Title           string   `json:"title"`
		Description     string   `json:"description"`
		Provider        string   `json:"provider"`
		Category        string   `json:"category"`
		Type            string   `json:"type"`
		Skills          []string `json:"skills"`
		DurationHours   float64  `json:"duration_hours"`
		Cost            float64  `json:"cost"`
		Currency        string   `json:"currency"`
		MaxParticipants int      `json:"max_participants"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Title == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Title required"})
	}
	listing := models.MarketplaceListing{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Title:           req.Title,
		Description:     req.Description,
		Provider:        req.Provider,
		Category:        req.Category,
		Type:            req.Type,
		Skills:          pq.StringArray(req.Skills),
		DurationHours:   req.DurationHours,
		Cost:            req.Cost,
		Currency:        req.Currency,
		MaxParticipants: req.MaxParticipants,
		Status:          "ACTIVE",
	}
	if listing.Currency == "" { listing.Currency = "USD" }
	if err := h.DB.Create(&listing).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create listing"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"data": listing})
}

func (h *MarketplaceHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var listing models.MarketplaceListing
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&listing).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Listing not found"})
	}
	var req struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Cost        float64 `json:"cost"`
		Status      string  `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	updates := map[string]interface{}{}
	if req.Title != "" { updates["title"] = req.Title }
	if req.Description != "" { updates["description"] = req.Description }
	if req.Cost > 0 { updates["cost"] = req.Cost }
	if req.Status != "" { updates["status"] = req.Status }
	h.DB.Model(&listing).Updates(updates)
	h.DB.First(&listing, "id = ?", id)
	return c.JSON(fiber.Map{"data": listing})
}

func (h *MarketplaceHandler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.MarketplaceListing{}).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Listing not found"})
	}
	return c.JSON(fiber.Map{"message": "Listing deleted"})
}
