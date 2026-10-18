package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func TestGetEnv(t *testing.T) {
	got := getEnv("NONEXISTENT_KEY", "default-val")
	if got != "default-val" {
		t.Errorf("expected default-val, got %s", got)
	}
}

func TestIsDuplicateKeyError(t *testing.T) {
	err := fmt.Errorf("duplicate key value violates unique constraint")
	if !isDuplicateKeyError(err) {
		t.Error("expected true for duplicate key error")
	}
}

func TestGetEnv_ExistingKey(t *testing.T) {
	os.Setenv("TEST_ENV_KEY", "test-value")
	defer os.Unsetenv("TEST_ENV_KEY")
	got := getEnv("TEST_ENV_KEY", "default-val")
	if got != "test-value" {
		t.Errorf("expected test-value, got %s", got)
	}
}

// Helper to create a test Fiber app with auth middleware
func setupTestApp() *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "default")
		c.Locals("user_role", "employee")
		c.Locals("user_id", "test-user")
		return c.Next()
	})
	return app
}

// Helper to generate a valid internal JWT token
func generateTestToken(secret string) string {
	claims := jwt.MapClaims{
		"user_id":   "test-user",
		"user_role": "employee",
		"tenant_id": "default",
		"exp":       time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(secret))
	return tokenString
}

func TestAuthMiddleware_MissingToken(t *testing.T) {
	app := setupTestApp()
	app.Use(authMiddleware)

	req := httptest.NewRequest("GET", "/api/attendance/", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 401 {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	app := setupTestApp()
	app.Use(authMiddleware)

	req := httptest.NewRequest("GET", "/api/attendance/", nil)
	req.Header.Set("x-internal-auth", "invalid-token")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 401 {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	os.Setenv("INTERNAL_JWT_SECRET", "test-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")
	initAuth()

	app := setupTestApp()
	app.Use(authMiddleware)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	token := generateTestToken("test-secret")
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("x-internal-auth", token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestAuthMiddleware_HealthBypass(t *testing.T) {
	app := setupTestApp()
	app.Use(authMiddleware)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestClockIn_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/clock-in", clockIn)

	body := `{"employeeId": "emp-123", "localDate": "2026-09-27"}`
	req := httptest.NewRequest("POST", "/api/attendance/clock-in", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if !strings.Contains(result["status"].(string), "Mock clocked in") {
		t.Errorf("expected mock clock-in status, got %v", result["status"])
	}
}

func TestClockOut_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/clock-out", clockOut)

	body := `{"employeeId": "emp-123", "localDate": "2026-09-27"}`
	req := httptest.NewRequest("POST", "/api/attendance/clock-out", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if !strings.Contains(result["status"].(string), "Mock clocked out") {
		t.Errorf("expected mock clock-out status, got %v", result["status"])
	}
}

func TestClockIn_InvalidBody(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/clock-in", clockIn)

	req := httptest.NewRequest("POST", "/api/attendance/clock-in", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestClockIn_Remote(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/clock-in", clockIn)

	body := `{"employeeId": "emp-123", "isRemote": true}`
	req := httptest.NewRequest("POST", "/api/attendance/clock-in", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if !strings.Contains(result["status"].(string), "Mock clocked in") {
		t.Errorf("expected mock clock-in status, got %v", result["status"])
	}
}

func TestClockIn_WFH(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/clock-in", clockIn)

	body := `{"employeeId": "emp-123", "isWfh": true}`
	req := httptest.NewRequest("POST", "/api/attendance/clock-in", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestClockOut_InvalidBody(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/clock-out", clockOut)

	req := httptest.NewRequest("POST", "/api/attendance/clock-out", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestGetEmployeeAttendance_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Get("/api/attendance/employee/:employeeId", getEmployeeAttendance)

	req := httptest.NewRequest("GET", "/api/attendance/employee/emp-123", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result []interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result == nil {
		t.Error("expected non-nil result")
	}
}

func TestListAttendance_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Get("/api/attendance/", listAttendance)

	req := httptest.NewRequest("GET", "/api/attendance/", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result []interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result == nil {
		t.Error("expected non-nil result")
	}
}

func TestGetAttendance_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Get("/api/attendance/:id", getAttendance)

	req := httptest.NewRequest("GET", "/api/attendance/123", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 404 {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}

func TestGetDashboardSummary_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Get("/api/attendance/dashboard/summary", getDashboardSummary)

	req := httptest.NewRequest("GET", "/api/attendance/dashboard/summary", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["presentToday"].(float64) != 0 {
		t.Errorf("expected 0 presentToday, got %v", result["presentToday"])
	}
}

func TestListGeoFences_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Get("/api/attendance/geo-fences", listGeoFences)

	req := httptest.NewRequest("GET", "/api/attendance/geo-fences", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestCreateShift_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/shifts", createShift)

	body := `{"name": "Morning Shift", "startTime": "09:00", "endTime": "17:00"}`
	req := httptest.NewRequest("POST", "/api/attendance/shifts", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 201 {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
}

func TestVerifyGeoLocation_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/geo-fences/verify", verifyGeoLocation)

	body := `{"latitude": 40.7128, "longitude": -74.0060}`
	req := httptest.NewRequest("POST", "/api/attendance/geo-fences/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["verified"] != true {
		t.Errorf("expected verified=true, got %v", result["verified"])
	}
}

func TestVerifyGeoLocation_InvalidLatitude(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/geo-fences/verify", verifyGeoLocation)

	body := `{"latitude": 999, "longitude": 0}`
	req := httptest.NewRequest("POST", "/api/attendance/geo-fences/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("expected 400, got %d", resp.StatusCode)
	}
}

func TestPredictLateArrival_MockDB(t *testing.T) {
	app := setupTestApp()
	app.Post("/api/attendance/predict/late-arrival", predictLateArrival)

	body := `{"employeeId": "emp-123"}`
	req := httptest.NewRequest("POST", "/api/attendance/predict/late-arrival", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["prediction"] != false {
		t.Errorf("expected prediction=false, got %v", result["prediction"])
	}
}

func TestHaversine(t *testing.T) {
	// Same point should be 0
	dist := haversine(40.7128, -74.0060, 40.7128, -74.0060)
	if dist != 0 {
		t.Errorf("expected 0, got %f", dist)
	}

	// NYC to LA should be roughly 3935km
	dist = haversine(40.7128, -74.0060, 34.0522, -118.2437)
	if dist < 3900000 || dist > 4000000 {
		t.Errorf("expected ~3935000m, got %f", dist)
	}
}

func TestSeverityLabel(t *testing.T) {
	if severityLabel(5) != "low" {
		t.Error("expected low for 5%")
	}
	if severityLabel(15) != "medium" {
		t.Error("expected medium for 15%")
	}
	if severityLabel(50) != "high" {
		t.Error("expected high for 50%")
	}
}

func TestTrendDirection(t *testing.T) {
	if trendDirection(5) != "up" {
		t.Error("expected up for positive trend")
	}
	if trendDirection(-5) != "down" {
		t.Error("expected down for negative trend")
	}
	if trendDirection(0) != "stable" {
		t.Error("expected stable for zero trend")
	}
}

// postJSON is a small helper for the validation tests below.
func postJSON(t *testing.T, handler fiber.Handler, path, body string) (int, map[string]interface{}) {
	t.Helper()
	app := setupTestApp()
	app.Post(path, handler)
	req := httptest.NewRequest("POST", path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return resp.StatusCode, result
}

func TestCreateGeoFence_Validation(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing name", `{"latitude":10,"longitude":20,"radiusMeters":100}`, 400},
		{"latitude out of range", `{"name":"HQ","latitude":91,"longitude":20,"radiusMeters":100}`, 400},
		{"longitude out of range", `{"name":"HQ","latitude":10,"longitude":181,"radiusMeters":100}`, 400},
		{"zero radius", `{"name":"HQ","latitude":10,"longitude":20,"radiusMeters":0}`, 400},
		{"unreasonable radius", `{"name":"HQ","latitude":10,"longitude":20,"radiusMeters":100001}`, 400},
		{"valid fence", `{"name":"HQ","latitude":12.9716,"longitude":77.5946,"radiusMeters":150}`, 201},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := postJSON(t, createGeoFence, "/api/attendance/geo-fences", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}
}

func TestCreateShift_RequiresName(t *testing.T) {
	body := `{"startTime": "09:00", "endTime": "17:00"}`
	if got, _ := postJSON(t, createShift, "/api/attendance/shifts", body); got != 400 {
		t.Errorf("expected 400 for a nameless shift, got %d", got)
	}
}

func TestAssignEmployeeShift_Validation(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing employeeId", `{"shiftId":1,"startDate":"2026-01-05"}`, 400},
		{"invalid startDate", `{"employeeId":"emp-1","shiftId":1,"startDate":"05-01-2026"}`, 400},
		{"invalid endDate", `{"employeeId":"emp-1","shiftId":1,"startDate":"2026-01-05","endDate":"not-a-date"}`, 400},
		{"endDate before startDate", `{"employeeId":"emp-1","shiftId":1,"startDate":"2026-01-05","endDate":"2026-01-04"}`, 400},
		{"valid assignment", `{"employeeId":"emp-1","shiftId":1,"startDate":"2026-01-05"}`, 201},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := postJSON(t, assignEmployeeShift, "/api/attendance/employee-shifts", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}
}

func TestCreateRoster_Validation(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{"missing employeeId", `{"date":"2026-01-05","shiftId":1}`, 400},
		{"invalid date", `{"employeeId":"emp-1","date":"2026-13-40","shiftId":1}`, 400},
		{"valid roster", `{"employeeId":"emp-1","date":"2026-01-05","shiftId":1}`, 201},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := postJSON(t, createRoster, "/api/attendance/rosters", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}
}

func TestBulkCreateRoster_Validation(t *testing.T) {
	cases := []struct {
		name string
		body string
		want int
	}{
		{"empty list", `{"employeeIds":[],"date":"2026-01-05","shiftId":1}`, 400},
		{"invalid date", `{"employeeIds":["emp-1"],"date":"05/01/2026","shiftId":1}`, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := postJSON(t, bulkCreateRoster, "/api/attendance/rosters/bulk", tc.body); got != tc.want {
				t.Errorf("expected %d, got %d", tc.want, got)
			}
		})
	}

	var oversized strings.Builder
	oversized.WriteString(`{"employeeIds":[`)
	for i := 0; i <= 200; i++ {
		if i > 0 {
			oversized.WriteString(",")
		}
		fmt.Fprintf(&oversized, `"emp-%d"`, i)
	}
	oversized.WriteString(`],"date":"2026-01-05","shiftId":1}`)
	if got, _ := postJSON(t, bulkCreateRoster, "/api/attendance/rosters/bulk", oversized.String()); got != 400 {
		t.Errorf("expected 400 for more than 200 employees, got %d", got)
	}
}

func TestVerifyBiometric_RequiresIds(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"missing hash", `{"employeeId":"emp-1","hash":""}`},
		{"missing employeeId", `{"employeeId":"","hash":"abc"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := postJSON(t, verifyBiometric, "/api/attendance/biometric/verify", tc.body); got != 400 {
				t.Errorf("expected 400, got %d", got)
			}
		})
	}
}

func TestVerifyBiometric_FailsClosedWithoutDB(t *testing.T) {
	code, result := postJSON(t, verifyBiometric, "/api/attendance/biometric/verify", `{"employeeId":"emp-1","hash":"abc"}`)
	if code != 200 {
		t.Fatalf("expected 200, got %d", code)
	}
	if result["verified"] != false {
		t.Errorf("expected verified=false without a database, got %v", result["verified"])
	}
}

func TestRegisterBiometric_RequiresFields(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"missing employeeId", `{"deviceUid":"dev-1","hash":"abc"}`},
		{"missing deviceUid", `{"employeeId":"emp-1","hash":"abc"}`},
		{"missing hash", `{"employeeId":"emp-1","deviceUid":"dev-1"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := postJSON(t, registerBiometric, "/api/attendance/biometric/register", tc.body); got != 400 {
				t.Errorf("expected 400, got %d", got)
			}
		})
	}
}

func TestEnrollFace_RequiresEmployeeID(t *testing.T) {
	body := fmt.Sprintf(`{"imageUrl":"https://example.com/face.jpg","faceVector":%q}`, strings.Repeat("v", 64))
	if got, _ := postJSON(t, enrollFace, "/api/attendance/face/enroll", body); got != 400 {
		t.Errorf("expected 400 without an employeeId, got %d", got)
	}
}

func TestVerifyFace_FailsClosedByDefault(t *testing.T) {
	// allowDevFaceMock is false in tests; verification must not pass even
	// with a long image string.
	if verifyFace("tenant-1", "emp-1", strings.Repeat("x", 128)) {
		t.Error("expected verifyFace to fail closed while the dev mock is disabled")
	}
}
