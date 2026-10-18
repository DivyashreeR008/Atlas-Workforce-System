package main

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// These tests need a real Postgres instance because the tenant scoping and
// duplicate/overlap guards are enforced in SQL. Point TEST_DATABASE_URL at a
// scratch database to run them; CI has no database, so they skip there.
func attendanceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping database-backed attendance tests")
	}
	testDatabase, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to connect to TEST_DATABASE_URL: %v", err)
	}
	if err := testDatabase.AutoMigrate(&BiometricDevice{}, &Shift{}, &Roster{}, &EmployeeShift{}); err != nil {
		t.Fatalf("failed to migrate test schema: %v", err)
	}
	return testDatabase
}

func tenantTestApp(tenant string, register func(app *fiber.App)) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("tenant_id", tenant)
		c.Locals("user_role", "admin")
		c.Locals("user_id", "tester")
		return c.Next()
	})
	register(app)
	return app
}

func doJSON(t *testing.T, app *fiber.App, method, path, body string) (int, map[string]interface{}) {
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

// TestVerifyBiometric_CrossTenantIsolation proves a device hash registered in
// one tenant never satisfies a verification for another tenant's employee.
func TestVerifyBiometric_CrossTenantIsolation(t *testing.T) {
	original := db
	testDatabase := attendanceTestDB(t)
	db = testDatabase
	defer func() { db = original }()

	device := BiometricDevice{
		TenantID:   "tenant-biometric-a",
		EmployeeID: "emp-shared",
		DeviceUID:  "dev-shared",
		Hash:       "hash-shared",
		IsActive:   true,
	}
	if err := testDatabase.Create(&device).Error; err != nil {
		t.Fatalf("failed to seed biometric device: %v", err)
	}
	t.Cleanup(func() {
		testDatabase.Where("tenant_id LIKE ?", "tenant-biometric-%").Delete(&BiometricDevice{})
	})

	body := `{"employeeId":"emp-shared","hash":"hash-shared"}`

	appA := tenantTestApp("tenant-biometric-a", func(a *fiber.App) { a.Post("/biometric/verify", verifyBiometric) })
	code, result := doJSON(t, appA, "POST", "/biometric/verify", body)
	if code != 200 || result["verified"] != true {
		t.Fatalf("own-tenant verification should pass: code=%d body=%v", code, result)
	}

	appB := tenantTestApp("tenant-biometric-b", func(a *fiber.App) { a.Post("/biometric/verify", verifyBiometric) })
	code, result = doJSON(t, appB, "POST", "/biometric/verify", body)
	if code != 200 {
		t.Fatalf("expected 200 from a cross-tenant attempt, got %d", code)
	}
	if result["verified"] != false {
		t.Errorf("a device from another tenant must not verify, got %v", result["verified"])
	}
}

// TestShiftRosterAndAssignmentWriteGuards covers the duplicate and overlap
// rejections that were previously silent.
func TestShiftRosterAndAssignmentWriteGuards(t *testing.T) {
	original := db
	testDatabase := attendanceTestDB(t)
	db = testDatabase
	defer func() { db = original }()

	const tenantID = "tenant-write-guards"
	t.Cleanup(func() {
		testDatabase.Where("tenant_id = ?", tenantID).Delete(&EmployeeShift{})
		testDatabase.Where("tenant_id = ?", tenantID).Delete(&Roster{})
		testDatabase.Where("tenant_id = ?", tenantID).Delete(&Shift{})
	})

	app := tenantTestApp(tenantID, func(a *fiber.App) {
		a.Post("/shifts", createShift)
		a.Post("/rosters", createRoster)
		a.Post("/employee-shifts", assignEmployeeShift)
	})

	// Duplicate shift names are rejected.
	shiftBody := `{"name":"Guard Shift","startTime":"09:00","endTime":"17:00","isActive":true}`
	if code, _ := doJSON(t, app, "POST", "/shifts", shiftBody); code != 201 {
		t.Fatalf("expected 201 for the first shift, got %d", code)
	}
	if code, result := doJSON(t, app, "POST", "/shifts", shiftBody); code != 409 {
		t.Errorf("expected 409 for a duplicate shift name, got %d (%v)", code, result)
	}

	var shift Shift
	if err := testDatabase.Where("tenant_id = ? AND name = ?", tenantID, "Guard Shift").First(&shift).Error; err != nil {
		t.Fatalf("failed to reload shift: %v", err)
	}

	// One roster row per employee and date.
	rosterBody := fmt.Sprintf(`{"employeeId":"emp-guard","date":"2026-03-02","shiftId":%d}`, shift.ID)
	if code, _ := doJSON(t, app, "POST", "/rosters", rosterBody); code != 201 {
		t.Fatalf("expected 201 for the first roster entry, got %d", code)
	}
	if code, result := doJSON(t, app, "POST", "/rosters", rosterBody); code != 409 {
		t.Errorf("expected 409 for a duplicate roster entry, got %d (%v)", code, result)
	}

	// Overlapping active assignments are rejected; a later window is fine.
	first := fmt.Sprintf(`{"employeeId":"emp-guard","shiftId":%d,"startDate":"2026-03-01","endDate":"2026-03-31","isActive":true}`, shift.ID)
	if code, _ := doJSON(t, app, "POST", "/employee-shifts", first); code != 201 {
		t.Fatalf("expected 201 for the first assignment, got %d", code)
	}
	overlap := fmt.Sprintf(`{"employeeId":"emp-guard","shiftId":%d,"startDate":"2026-03-15","endDate":"2026-04-15","isActive":true}`, shift.ID)
	if code, result := doJSON(t, app, "POST", "/employee-shifts", overlap); code != 409 {
		t.Errorf("expected 409 for an overlapping assignment, got %d (%v)", code, result)
	}
	second := fmt.Sprintf(`{"employeeId":"emp-guard","shiftId":%d,"startDate":"2026-04-01","endDate":"2026-04-30","isActive":true}`, shift.ID)
	if code, result := doJSON(t, app, "POST", "/employee-shifts", second); code != 201 {
		t.Errorf("expected 201 for a non-overlapping assignment, got %d (%v)", code, result)
	}
}
