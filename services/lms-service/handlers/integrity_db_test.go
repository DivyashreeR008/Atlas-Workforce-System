package handlers

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// The data-integrity guarantees (partial updates, duplicate and expiry
// guards, paging, attempt caps) are enforced against SQL, so these tests need
// a real database. Point TEST_DATABASE_URL at a scratch database to run them;
// they skip in CI where no database is provisioned.
const integrityTestTenant = "tenant-1"

func integrityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping database-backed integrity tests")
	}
	testDatabase, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 logger.Default.LogMode(logger.Silent),
		SkipDefaultTransaction: true,
	})
	if err != nil {
		t.Fatalf("failed to connect to TEST_DATABASE_URL: %v", err)
	}
	if err := testDatabase.AutoMigrate(
		&models.Course{},
		&models.Enrollment{},
		&models.Certification{},
		&models.Assessment{},
		&models.AssessmentAttempt{},
	); err != nil {
		t.Fatalf("failed to migrate test schema: %v", err)
	}
	cleanup := func() {
		testDatabase.Where("tenant_id = ?", integrityTestTenant).Delete(&models.AssessmentAttempt{})
		testDatabase.Where("tenant_id = ?", integrityTestTenant).Delete(&models.Assessment{})
		testDatabase.Where("tenant_id = ?", integrityTestTenant).Delete(&models.Enrollment{})
		testDatabase.Where("tenant_id = ?", integrityTestTenant).Delete(&models.Course{})
		testDatabase.Where("tenant_id = ?", integrityTestTenant).Delete(&models.Certification{})
	}
	cleanup()
	t.Cleanup(cleanup)
	return testDatabase
}

func integrityRequest(t *testing.T, app *fiber.App, method, path, body string) (int, map[string]interface{}) {
	t.Helper()
	request := httptest.NewRequest(method, path, nil)
	if body != "" {
		request = httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
	}
	resp, err := app.Test(request)
	if err != nil {
		t.Fatalf("app test failed: %v", err)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return resp.StatusCode, result
}

func integrityData(t *testing.T, result map[string]interface{}) map[string]interface{} {
	t.Helper()
	data, ok := result["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("response has no data object: %v", result)
	}
	return data
}

func TestCertificationPartialUpdateAndGuards(t *testing.T) {
	db := integrityTestDB(t)
	h := &CertificationHandler{DB: db}

	app := integrityApp(func(a *fiber.App) {
		a.Post("/certifications", h.Create)
		a.Put("/certifications/:id", h.Update)
		a.Put("/certifications/:id/verify", h.Verify)
		a.Get("/certifications/expiring", h.Expiring)
	})

	code, created := integrityRequest(t, app, "POST", "/certifications",
		`{"employee_id":"emp-1","name":"First Aid","issuing_authority":"Red Cross",
		  "issue_date":"2026-01-01","expiry_date":"2027-01-01","credential_url":"https://example.com/c1"}`)
	if code != 201 {
		t.Fatalf("expected 201 creating a certification, got %d", code)
	}
	certID := integrityData(t, created)["id"].(string)

	// A name-only update must keep the fields the caller did not send.
	code, updated := integrityRequest(t, app, "PUT", "/certifications/"+certID, `{"name":"First Aid Renewed"}`)
	if code != 200 {
		t.Fatalf("expected 200 updating a certification, got %d", code)
	}
	data := integrityData(t, updated)
	if data["issuing_authority"] != "Red Cross" {
		t.Errorf("issuing_authority was blanked: %v", data["issuing_authority"])
	}
	if data["credential_url"] != "https://example.com/c1" {
		t.Errorf("credential_url was blanked: %v", data["credential_url"])
	}
	if data["expiry_date"] == nil {
		t.Errorf("expiry_date was blanked")
	}

	// An expiry that precedes the stored issue date is rejected.
	if code, _ := integrityRequest(t, app, "PUT", "/certifications/"+certID, `{"expiry_date":"2025-12-31"}`); code != 400 {
		t.Errorf("expected 400 for expiry before issue, got %d", code)
	}

	// Verify once; a second verify is a conflict.
	if code, _ := integrityRequest(t, app, "PUT", "/certifications/"+certID+"/verify", ""); code != 200 {
		t.Errorf("expected 200 verifying a certificate, got %d", code)
	}
	if code, _ := integrityRequest(t, app, "PUT", "/certifications/"+certID+"/verify", ""); code != 409 {
		t.Errorf("expected 409 re-verifying a certificate, got %d", code)
	}

	// An expired certification cannot be verified.
	code, expired := integrityRequest(t, app, "POST", "/certifications",
		`{"employee_id":"emp-2","name":"Lapsed","issue_date":"2020-01-01","expiry_date":"2020-12-31"}`)
	if code != 201 {
		t.Fatalf("expected 201 creating an expired certification, got %d", code)
	}
	expiredID := integrityData(t, expired)["id"].(string)
	if code, _ := integrityRequest(t, app, "PUT", "/certifications/"+expiredID+"/verify", ""); code != 400 {
		t.Errorf("expected 400 verifying an expired certification, got %d", code)
	}

	// Expiring soon has a lower bound: the lapsed row stays out, and a
	// certificate expiring within the window is listed.
	nearExpiry := time.Now().UTC().AddDate(0, 0, 10).Format("2006-01-02")
	code, near := integrityRequest(t, app, "POST", "/certifications",
		fmt.Sprintf(`{"employee_id":"emp-3","name":"Soon","issue_date":"2026-01-01","expiry_date":%q}`, nearExpiry))
	if code != 201 {
		t.Fatalf("expected 201 creating a soon-expiring certification, got %d", code)
	}
	nearID := integrityData(t, near)["id"].(string)

	code, expiring := integrityRequest(t, app, "GET", "/certifications/expiring?days=30", "")
	if code != 200 {
		t.Fatalf("expected 200 from the expiring view, got %d", code)
	}
	seen := map[string]bool{}
	if items, ok := expiring["data"].([]interface{}); ok {
		for _, item := range items {
			if row, ok := item.(map[string]interface{}); ok {
				if id, ok := row["id"].(string); ok {
					seen[id] = true
				}
			}
		}
	}
	if !seen[nearID] {
		t.Errorf("expected the soon-expiring certificate in the view")
	}
	if seen[expiredID] {
		t.Errorf("long-expired certificates must not head the expiring view")
	}

	// Paging is bounded.
	code, paged := integrityRequest(t, app, "GET", "/certifications/expiring?days=365&page_size=1", "")
	if code != 200 {
		t.Fatalf("expected 200 from a paged expiring view, got %d", code)
	}
	if items, ok := paged["data"].([]interface{}); ok && len(items) > 1 {
		t.Errorf("expected at most one item with page_size=1, got %d", len(items))
	}
}

func TestCoursePartialUpdateDeleteGuardAndEnrollmentPaging(t *testing.T) {
	db := integrityTestDB(t)
	h := &CourseHandler{DB: db}

	app := integrityApp(func(a *fiber.App) {
		a.Post("/courses", h.Create)
		a.Put("/courses/:id", h.Update)
		a.Delete("/courses/:id", h.Delete)
		a.Get("/courses/:id/enrollments", h.GetEnrollments)
	})

	code, created := integrityRequest(t, app, "POST", "/courses",
		`{"title":"Safety","description":"Basics","category":"Compliance","level":"Beginner",
		  "duration_minutes":60,"instructor":"Ada","thumbnail_url":"https://example.com/t.png",
		  "content_url":"https://example.com/c"}`)
	if code != 201 {
		t.Fatalf("expected 201 creating a course, got %d", code)
	}
	courseID := integrityData(t, created)["id"].(string)

	// A title-only update must keep the fields the caller did not send.
	code, updated := integrityRequest(t, app, "PUT", "/courses/"+courseID, `{"title":"Safety 2"}`)
	if code != 200 {
		t.Fatalf("expected 200 updating a course, got %d", code)
	}
	data := integrityData(t, updated)
	for _, field := range []string{"description", "category", "level", "instructor", "thumbnail_url", "content_url"} {
		if data[field] == nil || data[field] == "" {
			t.Errorf("%s was blanked by a partial update", field)
		}
	}
	if data["duration_minutes"].(float64) != 60 {
		t.Errorf("duration_minutes was blanked: %v", data["duration_minutes"])
	}

	// Invalid updates are rejected.
	for _, body := range []string{`{"title":"  "}`, `{"duration_minutes":-1}`, `{"completion_threshold_pct":101}`} {
		if code, _ := integrityRequest(t, app, "PUT", "/courses/"+courseID, body); code != 400 {
			t.Errorf("expected 400 for %s, got %d", body, code)
		}
	}

	// Enrollments block deletion.
	enrollment := models.Enrollment{
		ID:         uuid.New().String(),
		TenantID:   integrityTestTenant,
		CourseID:   courseID,
		EmployeeID: "emp-enrolled",
		Status:     "ENROLLED",
	}
	if err := db.Create(&enrollment).Error; err != nil {
		t.Fatalf("failed to seed enrollment: %v", err)
	}
	if code, _ := integrityRequest(t, app, "DELETE", "/courses/"+courseID, ""); code != 409 {
		t.Errorf("expected 409 deleting a course with enrollments, got %d", code)
	}
	db.Delete(&models.Enrollment{}, "id = ?", enrollment.ID)
	if code, _ := integrityRequest(t, app, "DELETE", "/courses/"+courseID, ""); code != 200 {
		t.Errorf("expected 200 deleting a course without enrollments, got %d", code)
	}

	// The enrollment sub-list is paged.
	code, pagedCourse := integrityRequest(t, app, "POST", "/courses", `{"title":"Paging Course"}`)
	if code != 201 {
		t.Fatalf("expected 201 creating a second course, got %d", code)
	}
	pagedCourseID := integrityData(t, pagedCourse)["id"].(string)
	for i := 0; i < 3; i++ {
		row := models.Enrollment{
			ID:         uuid.New().String(),
			TenantID:   integrityTestTenant,
			CourseID:   pagedCourseID,
			EmployeeID: fmt.Sprintf("emp-page-%d", i),
			Status:     "ENROLLED",
		}
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("failed to seed enrollment: %v", err)
		}
	}
	code, listed := integrityRequest(t, app, "GET", "/courses/"+pagedCourseID+"/enrollments?page_size=2", "")
	if code != 200 {
		t.Fatalf("expected 200 listing enrollments, got %d", code)
	}
	if listed["total"].(float64) != 3 {
		t.Errorf("expected total 3, got %v", listed["total"])
	}
	if items, ok := listed["data"].([]interface{}); !ok || len(items) != 2 {
		t.Errorf("expected 2 items with page_size=2, got %v", listed["data"])
	}
}

func TestAssessmentAttemptCapTimingAndScoring(t *testing.T) {
	db := integrityTestDB(t)
	courseHandler := &CourseHandler{DB: db}
	h := &AssessmentHandler{DB: db}

	app := integrityApp(func(a *fiber.App) {
		a.Post("/courses", courseHandler.Create)
		a.Post("/assessments", h.Create)
		a.Put("/assessments/:id", h.Update)
		a.Post("/assessments/:id/attempt", h.StartAttempt)
		a.Put("/assessments/:id/attempt", h.SubmitAttempt)
		a.Get("/assessments/:id/attempts", h.GetAttempts)
	})

	code, createdCourse := integrityRequest(t, app, "POST", "/courses", `{"title":"Assessment Course"}`)
	if code != 201 {
		t.Fatalf("expected 201 creating a course, got %d", code)
	}
	courseID := integrityData(t, createdCourse)["id"].(string)

	questions := `[{"question":"q1","correct_answer":"a","points":10},{"question":"q2","correct_answer":"b","points":30}]`
	code, createdAssessment := integrityRequest(t, app, "POST", "/assessments",
		fmt.Sprintf(`{"course_id":%q,"title":"Quiz","passing_score":70,"max_score":200,
			"time_limit_minutes":30,"max_attempts":3,"questions":%s}`, courseID, questions))
	if code != 201 {
		t.Fatalf("expected 201 creating an assessment, got %d", code)
	}
	assessmentID := integrityData(t, createdAssessment)["id"].(string)

	// Attempt 1: a perfect paper scores the full 200 on the 200 scale.
	code, start1 := integrityRequest(t, app, "POST", "/assessments/"+assessmentID+"/attempt", `{"employee_id":"emp-1"}`)
	if code != 201 {
		t.Fatalf("expected 201 starting an attempt, got %d", code)
	}
	attempt1 := integrityData(t, start1)
	if attempt1["attempt_number"].(float64) != 1 {
		t.Errorf("expected attempt number 1, got %v", attempt1["attempt_number"])
	}
	if attempt1["expires_at"] == nil {
		t.Errorf("a timed assessment should set an attempt expiry")
	}
	attempt1ID := attempt1["attempt_id"].(string)

	code, submitted := integrityRequest(t, app, "PUT", "/assessments/"+assessmentID+"/attempt",
		fmt.Sprintf(`{"attempt_id":%q,"employee_id":"emp-1","answers":{"0":"a","1":"b"}}`, attempt1ID))
	if code != 200 {
		t.Fatalf("expected 200 submitting an attempt, got %d", code)
	}
	result := integrityData(t, submitted)
	if result["score"].(float64) != 200 || result["max_score"].(float64) != 200 {
		t.Errorf("expected 200 of 200, got %v of %v", result["score"], result["max_score"])
	}
	if result["passed"].(bool) != true {
		t.Errorf("a perfect paper should pass")
	}
	var stored models.AssessmentAttempt
	db.Where("id = ?", attempt1ID).First(&stored)
	if stored.Score == nil || *stored.Score != 200 {
		t.Errorf("stored score should be scaled onto the assessment maximum, got %v", stored.Score)
	}

	// Attempt 2: a partial paper is scaled and fails the 70 percent line.
	code, start2 := integrityRequest(t, app, "POST", "/assessments/"+assessmentID+"/attempt", `{"employee_id":"emp-1"}`)
	if code != 201 {
		t.Fatalf("expected 201 starting a second attempt, got %d", code)
	}
	attempt2ID := integrityData(t, start2)["attempt_id"].(string)
	code, submitted = integrityRequest(t, app, "PUT", "/assessments/"+assessmentID+"/attempt",
		fmt.Sprintf(`{"attempt_id":%q,"employee_id":"emp-1","answers":{"0":"a"}}`, attempt2ID))
	if code != 200 {
		t.Fatalf("expected 200 submitting a partial attempt, got %d", code)
	}
	result = integrityData(t, submitted)
	if result["score"].(float64) != 50 || result["passed"].(bool) != false {
		t.Errorf("expected 50 of 200 and a fail, got %v of %v passed=%v", result["score"], result["max_score"], result["passed"])
	}

	// Attempt 3: past the limit (plus grace) the submission is rejected.
	code, start3 := integrityRequest(t, app, "POST", "/assessments/"+assessmentID+"/attempt", `{"employee_id":"emp-1"}`)
	if code != 201 {
		t.Fatalf("expected 201 starting a third attempt, got %d", code)
	}
	attempt3ID := integrityData(t, start3)["attempt_id"].(string)
	db.Model(&models.AssessmentAttempt{}).Where("id = ?", attempt3ID).
		Update("expires_at", time.Now().UTC().Add(-10*time.Minute))
	if code, _ := integrityRequest(t, app, "PUT", "/assessments/"+assessmentID+"/attempt",
		fmt.Sprintf(`{"attempt_id":%q,"employee_id":"emp-1","answers":{"0":"a"}}`, attempt3ID)); code != 400 {
		t.Errorf("expected 400 submitting past the time limit, got %d", code)
	}

	// The configured cap now blocks a fourth attempt.
	if code, _ := integrityRequest(t, app, "POST", "/assessments/"+assessmentID+"/attempt", `{"employee_id":"emp-1"}`); code != 409 {
		t.Errorf("expected 409 once the attempt cap is reached, got %d", code)
	}

	// A title-only update keeps the scoring and timing configuration.
	code, updated := integrityRequest(t, app, "PUT", "/assessments/"+assessmentID, `{"title":"Quiz v2"}`)
	if code != 200 {
		t.Fatalf("expected 200 updating an assessment, got %d", code)
	}
	data := integrityData(t, updated)
	if data["time_limit_minutes"].(float64) != 30 || data["max_attempts"].(float64) != 3 || data["passing_score"].(float64) != 70 {
		t.Errorf("partial update changed scoring or timing fields: %v", data)
	}

	// The 100 boundary is enforced on updates too.
	if code, _ := integrityRequest(t, app, "PUT", "/assessments/"+assessmentID, `{"passing_score":100.01}`); code != 400 {
		t.Errorf("expected 400 for a passing score above 100, got %d", code)
	}
	if code, _ := integrityRequest(t, app, "PUT", "/assessments/"+assessmentID, `{"passing_score":100}`); code != 200 {
		t.Errorf("expected 200 for a passing score of exactly 100, got %d", code)
	}

	// The attempt list is paged.
	code, attempts := integrityRequest(t, app, "GET", "/assessments/"+assessmentID+"/attempts?employee_id=emp-1&page_size=2", "")
	if code != 200 {
		t.Fatalf("expected 200 listing attempts, got %d", code)
	}
	if attempts["total"].(float64) != 3 {
		t.Errorf("expected total 3, got %v", attempts["total"])
	}
	if items, ok := attempts["data"].([]interface{}); !ok || len(items) != 2 {
		t.Errorf("expected 2 items with page_size=2, got %v", attempts["data"])
	}
}
