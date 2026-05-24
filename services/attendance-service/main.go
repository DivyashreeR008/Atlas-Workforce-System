package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type AttendanceRecord struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	EmployeeID string    `gorm:"index;not null" json:"employeeId"`
	TenantID   string    `gorm:"index;default:'default'" json:"tenantId"`
	Date       string    `gorm:"index;not null" json:"date"`
	ClockIn    time.Time `json:"clockIn"`
	ClockOut   *time.Time `json:"clockOut"`
	Status     string    `json:"status"`
	Overtime   float64   `json:"overtime"` // hours
}

func getTenant(c *fiber.Ctx) string {
	tenant := c.Get("X-Tenant-Id")
	if tenant == "" {
		return "default"
	}
	return tenant
}

var db *gorm.DB

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func initDatabase() {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=5432 sslmode=disable",
			getEnv("POSTGRES_HOST", "postgres"),
			getEnv("POSTGRES_USER", "atlas_user"),
			getEnv("POSTGRES_PASSWORD", "atlas_password"),
			getEnv("POSTGRES_DB", "atlas_db"),
		)
	}
	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Warning: Could not connect to database (%v)", err)
		return
	}
	db.AutoMigrate(&AttendanceRecord{})
}

func main() {
	initDatabase()

	app := fiber.New()

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "Attendance Service is running"})
	})

	api := app.Group("/api/attendance")

	// List attendance records for a tenant
	api.Get("/", func(c *fiber.Ctx) error {
		tenantId := getTenant(c)
		if db != nil {
			var records []AttendanceRecord
			db.Where("tenant_id = ?", tenantId).Order("date DESC, clock_in DESC").Find(&records)
			if records == nil {
				records = []AttendanceRecord{}
			}
			return c.JSON(records)
		}
		return c.JSON([]AttendanceRecord{})
	})

	// Get single attendance record
	api.Get("/:id", func(c *fiber.Ctx) error {
		tenantId := getTenant(c)
		id := c.Params("id")
		if db != nil {
			var record AttendanceRecord
			err := db.Where("id = ? AND tenant_id = ?", id, tenantId).First(&record).Error
			if err != nil {
				return c.Status(404).JSON(fiber.Map{"error": "Attendance record not found"})
			}
			return c.JSON(record)
		}
		return c.Status(404).JSON(fiber.Map{"error": "Attendance record not found"})
	})

	// Get attendance by employee
	api.Get("/employee/:employeeId", func(c *fiber.Ctx) error {
		tenantId := getTenant(c)
		employeeId := c.Params("employeeId")
		if db != nil {
			var records []AttendanceRecord
			db.Where("tenant_id = ? AND employee_id = ?", tenantId, employeeId).Order("date DESC").Find(&records)
			if records == nil {
				records = []AttendanceRecord{}
			}
			return c.JSON(records)
		}
		return c.JSON([]AttendanceRecord{})
	})

	// Clock In
	api.Post("/clock-in", func(c *fiber.Ctx) error {
		type ClockInReq struct {
			EmployeeID string `json:"employeeId"`
			LocalDate  string `json:"localDate"`
		}
		var req ClockInReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		today := req.LocalDate
		if today == "" {
			today = time.Now().UTC().Format("2006-01-02")
		}
		tenantId := getTenant(c)
		var existing AttendanceRecord
		if db != nil {
			err := db.Where("tenant_id = ? AND employee_id = ? AND date = ?", tenantId, req.EmployeeID, today).First(&existing).Error
			if err == nil {
				return c.Status(400).JSON(fiber.Map{"error": "Already clocked in today"})
			}
			
			record := AttendanceRecord{
				TenantID:   tenantId,
				EmployeeID: req.EmployeeID,
				Date:       today,
				ClockIn:    time.Now(),
				Status:     "PRESENT",
			}
			db.Create(&record)
			return c.JSON(record)
		}
		return c.JSON(fiber.Map{"status": "Mock clocked in for " + req.EmployeeID})
	})

	// Clock Out
	api.Post("/clock-out", func(c *fiber.Ctx) error {
		type ClockOutReq struct {
			EmployeeID string `json:"employeeId"`
			LocalDate  string `json:"localDate"`
		}
		var req ClockOutReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		today := req.LocalDate
		if today == "" {
			today = time.Now().UTC().Format("2006-01-02")
		}
		tenantId := getTenant(c)
		if db != nil {
			var record AttendanceRecord
			err := db.Where("tenant_id = ? AND employee_id = ? AND date = ?", tenantId, req.EmployeeID, today).First(&record).Error
			if err != nil {
				return c.Status(404).JSON(fiber.Map{"error": "No clock in found for today"})
			}
			if record.ClockOut != nil {
				return c.Status(400).JSON(fiber.Map{"error": "Already clocked out"})
			}

			now := time.Now()
			record.ClockOut = &now
			
			// Calculate overtime (assuming 8 hours is standard)
			duration := now.Sub(record.ClockIn).Hours()
			if duration > 8.0 {
				record.Overtime = duration - 8.0
			}

			db.Save(&record)
			return c.JSON(record)
		}
		return c.JSON(fiber.Map{"status": "Mock clocked out for " + req.EmployeeID})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8005" // Assuming 8005 for attendance
	}
	
	log.Printf("Attendance Service listening on port %s", port)
	app.Listen(":" + port)
}
