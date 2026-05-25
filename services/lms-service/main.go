package main

import (
	"fmt"
	"log"
	"os"

	"github.com/atlas-workforce/lms-service/handlers"
	"github.com/atlas-workforce/lms-service/middleware"
	"github.com/atlas-workforce/lms-service/models"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

func main() {
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "atlas_lms")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")
	serverPort := getEnv("SERVER_PORT", "8013")

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode)

	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		SkipDefaultTransaction: true,
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying DB: %v", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	db.Exec("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

	if err := db.AutoMigrate(
		&models.Course{},
		&models.Enrollment{},
		&models.Certification{},
		&models.Assessment{},
		&models.AssessmentAttempt{},
		&models.LearningPath{},
		&models.SkillMatrix{},
	); err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName: "Atlas LMS Service",
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())
	app.Use(middleware.TenantMiddleware())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "LMS Service is running"})
	})

	setupRoutes(app)

	log.Printf("LMS Service starting on port %s", serverPort)
	if err := app.Listen(":" + serverPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func setupRoutes(app *fiber.App) {
	courseHandler := &handlers.CourseHandler{DB: db}
	enrollmentHandler := &handlers.EnrollmentHandler{DB: db}
	certHandler := &handlers.CertificationHandler{DB: db}
	assessmentHandler := &handlers.AssessmentHandler{DB: db}
	pathHandler := &handlers.LearningPathHandler{DB: db}
	skillHandler := &handlers.SkillHandler{DB: db}
	dashHandler := &handlers.DashboardHandler{DB: db}

	v1 := app.Group("/api/v1")

	courses := v1.Group("/courses")
	courses.Get("/", courseHandler.List)
	courses.Post("/", courseHandler.Create)
	courses.Get("/:id", courseHandler.Get)
	courses.Put("/:id", courseHandler.Update)
	courses.Delete("/:id", courseHandler.Delete)
	courses.Post("/:id/publish", courseHandler.Publish)
	courses.Post("/:id/archive", courseHandler.Archive)
	courses.Get("/:id/enrollments", courseHandler.GetEnrollments)

	enrollments := v1.Group("/enrollments")
	enrollments.Get("/", enrollmentHandler.List)
	enrollments.Post("/", enrollmentHandler.Enroll)
	enrollments.Post("/bulk", enrollmentHandler.BulkEnroll)
	enrollments.Put("/:id/progress", enrollmentHandler.UpdateProgress)
	enrollments.Put("/:id/complete", enrollmentHandler.Complete)
	enrollments.Delete("/:id", enrollmentHandler.Drop)

	certifications := v1.Group("/certifications")
	certifications.Get("/", certHandler.List)
	certifications.Post("/", certHandler.Create)
	certifications.Get("/expiring", certHandler.Expiring)
	certifications.Put("/:id", certHandler.Update)
	certifications.Put("/:id/verify", certHandler.Verify)

	assessments := v1.Group("/assessments")
	assessments.Get("/", assessmentHandler.List)
	assessments.Post("/", assessmentHandler.Create)
	assessments.Get("/:id", assessmentHandler.Get)
	assessments.Put("/:id", assessmentHandler.Update)
	assessments.Post("/:id/attempt", assessmentHandler.StartAttempt)
	assessments.Put("/:id/attempt", assessmentHandler.SubmitAttempt)
	assessments.Get("/:id/attempts", assessmentHandler.GetAttempts)

	paths := v1.Group("/learning-paths")
	paths.Get("/", pathHandler.List)
	paths.Post("/", pathHandler.Create)
	paths.Get("/:id", pathHandler.Get)
	paths.Put("/:id", pathHandler.Update)
	paths.Delete("/:id", pathHandler.Delete)

	skills := v1.Group("/skills")
	skills.Get("/", skillHandler.List)
	skills.Post("/", skillHandler.Upsert)
	skills.Get("/gap-analysis", skillHandler.GapAnalysis)
	skills.Get("/matrix", skillHandler.Matrix)
	skills.Get("/:employee_id", skillHandler.GetEmployeeSkills)

	dashboard := v1.Group("/dashboard")
	dashboard.Get("/summary", dashHandler.Summary)
	dashboard.Get("/employee/:employee_id", dashHandler.Employee)
}
