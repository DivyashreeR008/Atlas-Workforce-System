package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AssessmentHandler struct {
	DB *gorm.DB
}

// assessmentQuestion mirrors the JSON shape stored in Assessment.Questions.
type assessmentQuestion struct {
	Question      string   `json:"question"`
	Options       []string `json:"options"`
	CorrectAnswer string   `json:"correct_answer"`
	Points        float64  `json:"points"`
}

// attemptGracePeriod absorbs client clock drift and network latency around a
// timed attempt's deadline; submissions later than this are rejected.
const attemptGracePeriod = 2 * time.Minute

// defaultMaxAttempts applies when an assessment does not configure a cap.
const defaultMaxAttempts = 3

// validateAssessmentConfig checks score and timing inputs. PassingScore is a
// percentage of MaxScore (0-100) and MaxScore 0 means the 100 default.
func validateAssessmentConfig(passingScore, maxScore float64, timeLimitMinutes int) error {
	if passingScore < 0 || passingScore > 100 {
		return fmt.Errorf("passing_score must be between 0 and 100")
	}
	if maxScore < 0 {
		return fmt.Errorf("max_score cannot be negative")
	}
	if timeLimitMinutes < 0 {
		return fmt.Errorf("time_limit_minutes cannot be negative")
	}
	return nil
}

// validateMaxAttempts bounds an explicit attempt cap.
func validateMaxAttempts(maxAttempts int) error {
	if maxAttempts < 1 || maxAttempts > 100 {
		return fmt.Errorf("max_attempts must be between 1 and 100")
	}
	return nil
}

// gradeAttempt sums the points earned from answered questions. Questions
// without an explicit point value count as 10.
func gradeAttempt(questions []assessmentQuestion, answers map[string]string) (totalScore, questionMax float64) {
	for i, q := range questions {
		points := q.Points
		if points == 0 {
			points = 10
		}
		questionMax += points
		if answer, ok := answers[fmt.Sprintf("%d", i)]; ok && answer == q.CorrectAnswer {
			totalScore += points
		}
	}
	return totalScore, questionMax
}

// scaleAttemptScore expresses the raw result on the assessment's MaxScore
// scale and decides pass/fail. PassingScore is a percentage (0-100); legacy
// rows above 100 are treated as requiring a perfect score.
func scaleAttemptScore(passingScore, totalScore, questionMax, effectiveMax float64) (score float64, passed bool) {
	passingRatio := passingScore / 100.0
	if passingRatio < 0 {
		passingRatio = 0
	}
	if passingRatio > 1 {
		passingRatio = 1
	}
	actualRatio := 0.0
	if questionMax > 0 {
		actualRatio = totalScore / questionMax
	}
	score = math.Round(actualRatio*effectiveMax*100) / 100
	return score, actualRatio >= passingRatio
}

func isDuplicateKeyError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "duplicate key")
}

func (h *AssessmentHandler) List(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)

	query := h.DB.Where("tenant_id = ?", tenantID)
	if courseID := c.Query("course_id"); courseID != "" {
		query = query.Where("course_id = ?", courseID)
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
	h.DB.Model(&models.Assessment{}).Where("tenant_id = ?", tenantID).Count(&total)

	var assessments []models.Assessment
	if err := query.Preload("Course").Order("created_at DESC").
		Offset(offset).Limit(pageSize).Find(&assessments).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch assessments",
		})
	}

	return c.JSON(fiber.Map{
		"data":      assessments,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *AssessmentHandler) Create(c *fiber.Ctx) error {
	if !middleware.CanManageContent(c) {
		return middleware.Forbidden(c)
	}
	tenantID := middleware.GetTenant(c)

	var req struct {
		CourseID         string          `json:"course_id"`
		Title            string          `json:"title"`
		Description      string          `json:"description"`
		PassingScore     float64         `json:"passing_score"`
		MaxScore         float64         `json:"max_score"`
		TimeLimitMinutes int             `json:"time_limit_minutes"`
		MaxAttempts      *int            `json:"max_attempts"`
		Questions        json.RawMessage `json:"questions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.CourseID == "" || req.Title == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "course_id and title are required",
		})
	}
	if err := validateAssessmentConfig(req.PassingScore, req.MaxScore, req.TimeLimitMinutes); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}
	maxAttempts := defaultMaxAttempts
	if req.MaxAttempts != nil {
		if err := validateMaxAttempts(*req.MaxAttempts); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		maxAttempts = *req.MaxAttempts
	}

	var course models.Course
	if err := h.DB.Where("id = ? AND tenant_id = ?", req.CourseID, tenantID).First(&course).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Course not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch course",
		})
	}

	assessment := models.Assessment{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		CourseID:         req.CourseID,
		Title:            req.Title,
		Description:      req.Description,
		PassingScore:     req.PassingScore,
		MaxScore:         req.MaxScore,
		TimeLimitMinutes: req.TimeLimitMinutes,
		MaxAttempts:      maxAttempts,
		Questions:        datatypes.JSON(req.Questions),
	}
	if assessment.MaxScore == 0 {
		assessment.MaxScore = 100.00
	}
	if assessment.PassingScore == 0 {
		// PassingScore is a percentage of MaxScore; 70 percent is the default.
		assessment.PassingScore = 70.00
	}

	if err := h.DB.Create(&assessment).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create assessment",
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"data": assessment,
	})
}

func (h *AssessmentHandler) Get(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var assessment models.Assessment
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).
		Preload("Course").First(&assessment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Assessment not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch assessment",
		})
	}

	includeAnswers := c.Query("include_answers") == "true"

	if !includeAnswers && assessment.Questions != nil {
		var questions []map[string]interface{}
		if err := json.Unmarshal(assessment.Questions, &questions); err == nil {
			for i := range questions {
				delete(questions[i], "correct_answer")
			}
			sanitized, _ := json.Marshal(questions)
			assessment.Questions = datatypes.JSON(sanitized)
		}
	}

	return c.JSON(fiber.Map{
		"data": assessment,
	})
}

func (h *AssessmentHandler) Update(c *fiber.Ctx) error {
	if !middleware.CanManageContent(c) {
		return middleware.Forbidden(c)
	}
	tenantID := middleware.GetTenant(c)
	id := c.Params("id")

	var assessment models.Assessment
	if err := h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&assessment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Assessment not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch assessment",
		})
	}

	var req struct {
		Title            *string         `json:"title"`
		Description      *string         `json:"description"`
		PassingScore     *float64        `json:"passing_score"`
		MaxScore         *float64        `json:"max_score"`
		TimeLimitMinutes *int            `json:"time_limit_minutes"`
		MaxAttempts      *int            `json:"max_attempts"`
		Questions        json.RawMessage `json:"questions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.Title != nil && strings.TrimSpace(*req.Title) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "title cannot be empty",
		})
	}
	if req.PassingScore != nil && (*req.PassingScore < 0 || *req.PassingScore > 100) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "passing_score must be between 0 and 100",
		})
	}
	if req.MaxScore != nil && *req.MaxScore <= 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "max_score must be greater than 0",
		})
	}
	if req.TimeLimitMinutes != nil && *req.TimeLimitMinutes < 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "time_limit_minutes cannot be negative",
		})
	}
	if req.MaxAttempts != nil {
		if err := validateMaxAttempts(*req.MaxAttempts); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
	}

	// Only fields present in the request are written; omitted fields keep
	// their stored values instead of being blanked.
	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.PassingScore != nil {
		updates["passing_score"] = *req.PassingScore
	}
	if req.MaxScore != nil {
		updates["max_score"] = *req.MaxScore
	}
	if req.TimeLimitMinutes != nil {
		updates["time_limit_minutes"] = *req.TimeLimitMinutes
	}
	if req.MaxAttempts != nil {
		updates["max_attempts"] = *req.MaxAttempts
	}
	if req.Questions != nil {
		updates["questions"] = datatypes.JSON(req.Questions)
	}

	if err := h.DB.Model(&assessment).Updates(updates).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update assessment",
		})
	}

	h.DB.Where("id = ? AND tenant_id = ?", id, tenantID).First(&assessment)
	return c.JSON(fiber.Map{
		"data": assessment,
	})
}

func (h *AssessmentHandler) StartAttempt(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	assessmentID := c.Params("id")

	var req struct {
		EmployeeID string `json:"employee_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.EmployeeID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "employee_id is required",
		})
	}
	// Attempts belong to the employee taking them; admins may act on the
	// employee's behalf. The body identity is validated before any DB work.
	if !middleware.OwnsOrAdmin(c, req.EmployeeID) {
		return middleware.Forbidden(c)
	}

	var assessment models.Assessment
	if err := h.DB.Where("id = ? AND tenant_id = ?", assessmentID, tenantID).First(&assessment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Assessment not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch assessment",
		})
	}

	// Cap the number of attempts per employee. An assessment that never
	// configured one falls back to the default.
	maxAttempts := assessment.MaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = defaultMaxAttempts
	}
	var attemptCount int64
	if err := h.DB.Model(&models.AssessmentAttempt{}).
		Where("assessment_id = ? AND employee_id = ? AND tenant_id = ?", assessmentID, req.EmployeeID, tenantID).
		Count(&attemptCount).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to count existing attempts",
		})
	}
	if attemptCount >= int64(maxAttempts) {
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error": fmt.Sprintf("Maximum attempts (%d) reached for this assessment", maxAttempts),
		})
	}

	now := time.Now().UTC()
	attempt := models.AssessmentAttempt{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		AssessmentID: assessmentID,
		EmployeeID:   req.EmployeeID,
		StartedAt:    &now,
	}
	if assessment.TimeLimitMinutes > 0 {
		expires := now.Add(time.Duration(assessment.TimeLimitMinutes) * time.Minute)
		attempt.ExpiresAt = &expires
	}

	// Attempt numbering is read-then-insert, so two concurrent starts could
	// both pick the same number. The unique index on (assessment, employee,
	// attempt_number) rejects the loser; retry with a freshly read number.
	created := false
	for tries := 0; tries < 3; tries++ {
		var lastAttempt models.AssessmentAttempt
		h.DB.Where("assessment_id = ? AND employee_id = ? AND tenant_id = ?",
			assessmentID, req.EmployeeID, tenantID).
			Order("attempt_number DESC").First(&lastAttempt)
		attempt.AttemptNumber = 1
		if lastAttempt.ID != "" {
			attempt.AttemptNumber = lastAttempt.AttemptNumber + 1
		}
		if err := h.DB.Create(&attempt).Error; err != nil {
			if isDuplicateKeyError(err) {
				continue
			}
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to start attempt",
			})
		}
		created = true
		break
	}
	if !created {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to start attempt",
		})
	}

	var questions []map[string]interface{}
	if err := json.Unmarshal(assessment.Questions, &questions); err == nil {
		for i := range questions {
			delete(questions[i], "correct_answer")
		}
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"data": fiber.Map{
			"attempt_id":     attempt.ID,
			"attempt_number": attempt.AttemptNumber,
			"started_at":     now,
			"expires_at":     attempt.ExpiresAt,
			"questions":      questions,
		},
	})
}

func (h *AssessmentHandler) SubmitAttempt(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	assessmentID := c.Params("id")

	var req struct {
		AttemptID  string          `json:"attempt_id"`
		EmployeeID string          `json:"employee_id"`
		Answers    json.RawMessage `json:"answers"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}
	if req.AttemptID == "" || req.EmployeeID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "attempt_id and employee_id are required",
		})
	}
	// Only the employee the attempt belongs to (or an admin) may submit it.
	if !middleware.OwnsOrAdmin(c, req.EmployeeID) {
		return middleware.Forbidden(c)
	}

	var assessment models.Assessment
	if err := h.DB.Where("id = ? AND tenant_id = ?", assessmentID, tenantID).First(&assessment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Assessment not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch assessment",
		})
	}

	var attempt models.AssessmentAttempt
	if err := h.DB.Where("id = ? AND assessment_id = ? AND employee_id = ? AND tenant_id = ?",
		req.AttemptID, assessmentID, req.EmployeeID, tenantID).First(&attempt).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Attempt not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch attempt",
		})
	}

	if attempt.CompletedAt != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Attempt already submitted",
		})
	}
	if attempt.ExpiresAt != nil {
		if now := time.Now().UTC(); now.After(attempt.ExpiresAt.Add(attemptGracePeriod)) {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "Time limit exceeded for this attempt",
			})
		}
	}

	var questions []assessmentQuestion
	if err := json.Unmarshal(assessment.Questions, &questions); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to parse assessment questions",
		})
	}

	var answersMap map[string]string
	if err := json.Unmarshal(req.Answers, &answersMap); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid answers format",
		})
	}

	totalScore, questionMax := gradeAttempt(questions, answersMap)

	effectiveMax := assessment.MaxScore
	if effectiveMax <= 0 {
		effectiveMax = 100
	}
	scaledScore, passed := scaleAttemptScore(assessment.PassingScore, totalScore, questionMax, effectiveMax)
	now := time.Now().UTC()

	updates := map[string]interface{}{
		"score":        &scaledScore,
		"passed":       &passed,
		"answers":      datatypes.JSON(req.Answers),
		"completed_at": &now,
	}
	if err := h.DB.Model(&attempt).Updates(updates).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to submit attempt",
		})
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"attempt_id":   attempt.ID,
			"score":        scaledScore,
			"max_score":    effectiveMax,
			"passed":       passed,
			"completed_at": now,
		},
	})
}

func (h *AssessmentHandler) GetAttempts(c *fiber.Ctx) error {
	tenantID := middleware.GetTenant(c)
	assessmentID := c.Params("id")

	var assessment models.Assessment
	if err := h.DB.Where("id = ? AND tenant_id = ?", assessmentID, tenantID).First(&assessment).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "Assessment not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch assessment",
		})
	}

	query := h.DB.Where("assessment_id = ? AND tenant_id = ?", assessmentID, tenantID)
	if employeeID := c.Query("employee_id"); employeeID != "" {
		query = query.Where("employee_id = ?", employeeID)
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
	query.Session(&gorm.Session{}).Model(&models.AssessmentAttempt{}).Count(&total)

	var attempts []models.AssessmentAttempt
	if err := query.Order("attempt_number DESC").Offset(offset).Limit(pageSize).Find(&attempts).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch attempts",
		})
	}

	return c.JSON(fiber.Map{
		"data":      attempts,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}
