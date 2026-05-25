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

type KnowledgeHandler struct {
	DB *gorm.DB
}

func (h *KnowledgeHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	query := h.DB.Where("tenant_id = ? AND status = ?", tenantID, "PUBLISHED")
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("title ILIKE ? OR summary ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if tag := c.Query("tag"); tag != "" {
		query = query.Where("tags @> ARRAY[?]::text[]", tag)
	}
	if contentType := c.Query("content_type"); contentType != "" {
		query = query.Where("content_type = ?", contentType)
	}

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", 20)
	offset := (page - 1) * pageSize

	var total int64
	h.DB.Model(&models.KnowledgeArticle{}).Where("tenant_id = ? AND status = ?", tenantID, "PUBLISHED").Count(&total)

	var articles []models.KnowledgeArticle
	if err := query.Order("view_count DESC").Offset(offset).Limit(pageSize).Find(&articles).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch articles"})
	}
	return c.JSON(fiber.Map{"data": articles, "total": total, "page": page, "page_size": pageSize})
}

func (h *KnowledgeHandler) Get(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var article models.KnowledgeArticle
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&article).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Article not found"})
	}
	h.DB.Model(&article).UpdateColumn("view_count", article.ViewCount+1)
	return c.JSON(fiber.Map{"data": article})
}

func (h *KnowledgeHandler) Create(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	var req struct {
		Title       string   `json:"title"`
		Summary     string   `json:"summary"`
		Content     string   `json:"content"`
		Category    string   `json:"category"`
		Tags        []string `json:"tags"`
		AuthorID    string   `json:"author_id"`
		AuthorName  string   `json:"author_name"`
		ContentType string   `json:"content_type"`
		ContentURL  string   `json:"content_url"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Title == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Title required"})
	}
	article := models.KnowledgeArticle{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Title:       req.Title,
		Summary:     req.Summary,
		Content:     req.Content,
		Category:    req.Category,
		Tags:        pq.StringArray(req.Tags),
		AuthorID:    req.AuthorID,
		AuthorName:  req.AuthorName,
		ContentType: req.ContentType,
		ContentURL:  req.ContentURL,
		Status:      "PUBLISHED",
	}
	if article.ContentType == "" { article.ContentType = "ARTICLE" }
	if err := h.DB.Create(&article).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create article"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"data": article})
}

func (h *KnowledgeHandler) Update(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var article models.KnowledgeArticle
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&article).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Article not found"})
	}
	var req struct {
		Title       string   `json:"title"`
		Summary     string   `json:"summary"`
		Content     string   `json:"content"`
		Category    string   `json:"category"`
		Tags        []string `json:"tags"`
		ContentType string   `json:"content_type"`
		ContentURL  string   `json:"content_url"`
		Status      string   `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}
	updates := map[string]interface{}{}
	if req.Title != "" { updates["title"] = req.Title }
	if req.Summary != "" { updates["summary"] = req.Summary }
	if req.Content != "" { updates["content"] = req.Content }
	if req.Category != "" { updates["category"] = req.Category }
	if req.Tags != nil { updates["tags"] = pq.StringArray(req.Tags) }
	if req.ContentType != "" { updates["content_type"] = req.ContentType }
	if req.ContentURL != "" { updates["content_url"] = req.ContentURL }
	if req.Status != "" { updates["status"] = req.Status }
	h.DB.Model(&article).Updates(updates)
	h.DB.First(&article, "id = ?", id)
	return c.JSON(fiber.Map{"data": article})
}

func (h *KnowledgeHandler) Delete(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.KnowledgeArticle{}).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Article not found"})
	}
	return c.JSON(fiber.Map{"message": "Article deleted"})
}

func (h *KnowledgeHandler) MarkUseful(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")
	var article models.KnowledgeArticle
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&article).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "Article not found"})
	}
	h.DB.Model(&article).UpdateColumn("useful_count", article.UsefulCount+1)
	return c.JSON(fiber.Map{"data": article})
}
