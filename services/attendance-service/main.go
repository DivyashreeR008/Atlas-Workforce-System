package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

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
	migrateDB(db)
}

func main() {
	initDatabase()

	app := fiber.New(fiber.Config{
		AppName: "Atlas Attendance Service",
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization,X-Tenant-Id,X-Employee-Id",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "Attendance Service is running", "version": "2.0.0"})
	})

	api := app.Group("/api/attendance")

	// ============================================================
	// Core attendance CRUD
	// ============================================================
	api.Get("/", listAttendance)
	api.Get("/:id", getAttendance)
	api.Get("/employee/:employeeId", getEmployeeAttendance)

	// Clock in/out
	api.Post("/clock-in", clockIn)
	api.Post("/clock-out", clockOut)

	// Dashboard
	api.Get("/dashboard/summary", getDashboardSummary)

	// ============================================================
	// Geo-fence management
	// ============================================================
	api.Get("/geo-fences", listGeoFences)
	api.Post("/geo-fences", createGeoFence)
	api.Put("/geo-fences/:id", updateGeoFence)
	api.Delete("/geo-fences/:id", deleteGeoFence)
	api.Post("/geo-fences/verify", verifyGeoLocation)

	// ============================================================
	// Shift management
	// ============================================================
	api.Get("/shifts", listShifts)
	api.Post("/shifts", createShift)
	api.Put("/shifts/:id", updateShift)
	api.Delete("/shifts/:id", deleteShift)

	// Employee shift assignments
	api.Post("/employee-shifts", assignEmployeeShift)
	api.Get("/employee-shifts/:employeeId", getEmployeeShift)

	// ============================================================
	// Dynamic rostering
	// ============================================================
	api.Get("/rosters", listRosters)
	api.Post("/rosters", createRoster)
	api.Post("/rosters/bulk", bulkCreateRoster)
	api.Post("/rosters/:id/publish", publishRoster)

	// ============================================================
	// QR attendance
	// ============================================================
	api.Post("/qr/generate", generateQRToken)
	api.Post("/qr/validate", validateQRToken)
	api.Post("/qr/use", markQRUsed)

	// ============================================================
	// NFC attendance
	// ============================================================
	api.Post("/nfc/register", registerNFCCard)
	api.Get("/nfc/list", listNFCRegistrations)
	api.Post("/nfc/validate", validateNFC)

	// ============================================================
	// Face recognition
	// ============================================================
	api.Post("/face/enroll", enrollFace)
	api.Get("/face/enrollment/:employeeId", getFaceEnrollment)
	api.Post("/face/verify", verifyFaceAPI)

	// ============================================================
	// Biometric integration
	// ============================================================
	api.Post("/biometric/register", registerBiometric)
	api.Get("/biometric/devices", listBiometricDevices)
	api.Post("/biometric/verify", verifyBiometric)

	// ============================================================
	// Anomaly detection
	// ============================================================
	api.Get("/anomalies", listAnomalies)
	api.Post("/anomalies/:id/resolve", resolveAnomaly)

	// ============================================================
	// WFH / Remote tracking
	// ============================================================
	api.Post("/wfh", createWFHEntry)
	api.Get("/wfh", listWFHEntries)

	// ============================================================
	// Heatmap
	// ============================================================
	api.Get("/heatmap", getHeatmapData)

	// ============================================================
	// Predictions & AI insights
	// ============================================================
	api.Post("/predict/late-arrival", predictLateArrival)
	api.Get("/ai/insights", attendanceAIInsights)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8005"
	}

	log.Printf("Atlas Attendance Service v2.0 listening on port %s", port)
	app.Listen(":" + port)
}
