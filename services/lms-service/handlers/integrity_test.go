package handlers

import (
	"bytes"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

// integrityApp mounts a handler behind identity locals and a recover
// middleware. Handlers under test construct with a nil DB: a request that
// clears validation reaches the nil *gorm.DB, panics, and the recover
// middleware turns it into a 500, which proves the request was accepted.
// Validation failures return their 400/409 without touching the database.
func integrityApp(register func(app *fiber.App)) *fiber.App {
	app := fiber.New()
	app.Use(recover.New())
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		c.Locals("user_role", "admin")
		c.Locals("user_id", "admin-1")
		return c.Next()
	})
	register(app)
	return app
}

func integrityStatus(t *testing.T, app *fiber.App, method, path, body string) int {
	t.Helper()
	request := httptest.NewRequest(method, path, nil)
	if body != "" {
		request = httptest.NewRequest(method, path, bytes.NewBufferString(body))
		request.Header.Set("Content-Type", "application/json")
	}
	resp, err := app.Test(request)
	if err != nil {
		t.Fatalf("app test failed: %v", err)
	}
	return resp.StatusCode
}

func TestGradeAttempt(t *testing.T) {
	questions := []assessmentQuestion{
		{Question: "q1", CorrectAnswer: "a", Points: 0}, // no points -> 10
		{Question: "q2", CorrectAnswer: "b", Points: 30},
	}
	total, questionMax := gradeAttempt(questions, map[string]string{"0": "a", "1": "x"})
	if questionMax != 40 {
		t.Errorf("expected question max 40, got %v", questionMax)
	}
	if total != 10 {
		t.Errorf("expected 10 points for one default-weight correct answer, got %v", total)
	}

	total, questionMax = gradeAttempt(questions, map[string]string{"0": "a", "1": "b"})
	if total != questionMax {
		t.Errorf("expected a perfect total, got %v of %v", total, questionMax)
	}
}

func TestScaleAttemptScore(t *testing.T) {
	cases := []struct {
		name       string
		passing    float64
		total      float64
		questionMax float64
		maxScore   float64
		wantScore  float64
		wantPassed bool
	}{
		{"exactly at the passing line passes", 70, 7, 10, 100, 70, true},
		{"below the passing line fails", 70, 6.9, 10, 100, 69, false},
		{"scaled onto a 200 point maximum", 70, 14, 20, 200, 140, true},
		{"100 percent requires a perfect result", 100, 9.9, 10, 100, 99, false},
		{"100 percent is met by a perfect result", 100, 10, 10, 100, 100, true},
		{"legacy values above 100 require perfection", 150, 9.9, 10, 100, 99, false},
		{"no questions scores zero", 0, 0, 0, 100, 0, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			score, passed := scaleAttemptScore(tc.passing, tc.total, tc.questionMax, tc.maxScore)
			if score != tc.wantScore {
				t.Errorf("expected score %v, got %v", tc.wantScore, score)
			}
			if passed != tc.wantPassed {
				t.Errorf("expected passed %v, got %v", tc.wantPassed, passed)
			}
		})
	}
}

func TestCertificationCreateValidation(t *testing.T) {
	handler := &CertificationHandler{}
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing employee and name", `{}`, 400},
		{"unparseable issue_date", `{"employee_id":"e1","name":"C","issue_date":"01/02/2026"}`, 400},
		{"unparseable expiry_date", `{"employee_id":"e1","name":"C","expiry_date":"2026-13-40"}`, 400},
		{"expiry before issue", `{"employee_id":"e1","name":"C","issue_date":"2026-05-01","expiry_date":"2026-04-01"}`, 400},
		{"valid request reaches persistence", `{"employee_id":"e1","name":"C","issue_date":"2026-01-01","expiry_date":"2027-01-01"}`, fiber.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := integrityApp(func(a *fiber.App) { a.Post("/certifications", handler.Create) })
			if got := integrityStatus(t, app, "POST", "/certifications", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}
}

func TestCourseCreateValidation(t *testing.T) {
	handler := &CourseHandler{}
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing title", `{}`, 400},
		{"negative duration", `{"title":"C","duration_minutes":-1}`, 400},
		{"threshold above 100", `{"title":"C","completion_threshold_pct":101}`, 400},
		{"negative threshold", `{"title":"C","completion_threshold_pct":-0.5}`, 400},
		{"valid request reaches persistence", `{"title":"C","duration_minutes":30,"completion_threshold_pct":80}`, fiber.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := integrityApp(func(a *fiber.App) { a.Post("/courses", handler.Create) })
			if got := integrityStatus(t, app, "POST", "/courses", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}
}

func TestAssessmentCreateValidation(t *testing.T) {
	handler := &AssessmentHandler{}
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing course and title", `{}`, 400},
		{"passing score above 100", `{"course_id":"c1","title":"A","passing_score":100.01}`, 400},
		{"negative passing score", `{"course_id":"c1","title":"A","passing_score":-1}`, 400},
		{"negative max score", `{"course_id":"c1","title":"A","max_score":-5}`, 400},
		{"negative time limit", `{"course_id":"c1","title":"A","time_limit_minutes":-1}`, 400},
		{"zero max attempts", `{"course_id":"c1","title":"A","max_attempts":0}`, 400},
		{"oversized max attempts", `{"course_id":"c1","title":"A","max_attempts":101}`, 400},
		{"valid request reaches persistence", `{"course_id":"c1","title":"A","passing_score":70,"max_score":100,"max_attempts":2}`, fiber.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app := integrityApp(func(a *fiber.App) { a.Post("/assessments", handler.Create) })
			if got := integrityStatus(t, app, "POST", "/assessments", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}
}
