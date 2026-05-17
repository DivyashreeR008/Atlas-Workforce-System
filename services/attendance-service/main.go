package main

import (
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
	Date       string    `gorm:"index;not null" json:"date"`
	ClockIn    time.Time `json:"clockIn"`
	ClockOut   *time.Time `json:"clockOut"`
	Status     string    `json:"status"`
	Overtime   float64   `json:"overtime"` // hours
}

var db *gorm.DB

func initDatabase() {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		dsn = "host=postgres user=atlas_user password=REDACTED_DATABASE_PASSWORD dbname=atlas_db port=5432 sslmode=disable"
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

	// Clock In
	api.Post("/clock-in", func(c *fiber.Ctx) error {
		type ClockInReq struct {
			EmployeeID string `json:"employeeId"`
		}
		var req ClockInReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		today := time.Now().Format("2006-01-02")
		var existing AttendanceRecord
		if db != nil {
			err := db.Where("employee_id = ? AND date = ?", req.EmployeeID, today).First(&existing).Error
			if err == nil {
				return c.Status(400).JSON(fiber.Map{"error": "Already clocked in today"})
			}
			
			record := AttendanceRecord{
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
		}
		var req ClockOutReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		today := time.Now().Format("2006-01-02")
		if db != nil {
			var record AttendanceRecord
			err := db.Where("employee_id = ? AND date = ?", req.EmployeeID, today).First(&record).Error
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
