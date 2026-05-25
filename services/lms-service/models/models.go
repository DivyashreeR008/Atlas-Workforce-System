package models

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/datatypes"
)

type Course struct {
	ID                     string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID               string         `gorm:"type:varchar(50);not null;index:idx_courses_tenant;index" json:"tenant_id"`
	Title                  string         `gorm:"type:varchar(200);not null" json:"title"`
	Description            string         `gorm:"type:text" json:"description,omitempty"`
	Category               string         `gorm:"type:varchar(50)" json:"category,omitempty"`
	Level                  string         `gorm:"type:varchar(20)" json:"level,omitempty"`
	DurationMinutes        int            `gorm:"type:int" json:"duration_minutes,omitempty"`
	Instructor             string         `gorm:"type:varchar(200)" json:"instructor,omitempty"`
	ThumbnailURL           string         `gorm:"type:text" json:"thumbnail_url,omitempty"`
	ContentURL             string         `gorm:"type:text" json:"content_url,omitempty"`
	Skills                 pq.StringArray `gorm:"type:text[]" json:"skills,omitempty"`
	Status                 string         `gorm:"type:varchar(20);default:DRAFT" json:"status"`
	IsMandatory            bool           `gorm:"default:false" json:"is_mandatory"`
	CompletionThresholdPct float64        `gorm:"type:decimal(5,2);default:80.00" json:"completion_threshold_pct"`
	CreatedAt              time.Time      `json:"created_at"`
	UpdatedAt              time.Time      `json:"updated_at"`

	Enrollments []Enrollment `gorm:"foreignKey:CourseID" json:"enrollments,omitempty"`
}

func (Course) TableName() string {
	return "courses"
}

type Enrollment struct {
	ID             string     `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID       string     `gorm:"type:varchar(50);not null;index:idx_enrollments_tenant;index" json:"tenant_id"`
	CourseID       string     `gorm:"type:uuid;not null;index:idx_enrollments_course;uniqueIndex:idx_enrollments_unique" json:"course_id"`
	EmployeeID     string     `gorm:"type:varchar(100);not null;uniqueIndex:idx_enrollments_unique" json:"employee_id"`
	Status         string     `gorm:"type:varchar(20);default:ENROLLED" json:"status"`
	ProgressPct    float64    `gorm:"type:decimal(5,2);default:0" json:"progress_pct"`
	Score          *float64   `gorm:"type:decimal(5,2)" json:"score,omitempty"`
	StartedAt      *time.Time `json:"started_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	Deadline       *time.Time `json:"deadline,omitempty"`
	CertificateID  *string    `gorm:"type:varchar(100)" json:"certificate_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	Course *Course `gorm:"foreignKey:CourseID" json:"course,omitempty"`
}

func (Enrollment) TableName() string {
	return "enrollments"
}

type Certification struct {
	ID               string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID         string         `gorm:"type:varchar(50);not null;index:idx_certs_tenant;index" json:"tenant_id"`
	EmployeeID       string         `gorm:"type:varchar(100);not null;index:idx_certs_employee" json:"employee_id"`
	Name             string         `gorm:"type:varchar(200);not null" json:"name"`
	IssuingAuthority string         `gorm:"type:varchar(200)" json:"issuing_authority,omitempty"`
	IssueDate        *time.Time     `gorm:"type:date" json:"issue_date,omitempty"`
	ExpiryDate       *time.Time     `gorm:"type:date" json:"expiry_date,omitempty"`
	CredentialURL    string         `gorm:"type:text" json:"credential_url,omitempty"`
	Skills           pq.StringArray `gorm:"type:text[]" json:"skills,omitempty"`
	Status           string         `gorm:"type:varchar(20);default:ACTIVE" json:"status"`
	Verified         bool           `gorm:"default:false" json:"verified"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

func (Certification) TableName() string {
	return "certifications"
}

type Assessment struct {
	ID               string          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID         string          `gorm:"type:varchar(50);not null;index:idx_assessments_tenant;index" json:"tenant_id"`
	CourseID         string          `gorm:"type:uuid;not null;index:idx_assessments_course" json:"course_id"`
	Title            string          `gorm:"type:varchar(200);not null" json:"title"`
	Description      string          `gorm:"type:text" json:"description,omitempty"`
	PassingScore     float64         `gorm:"type:decimal(5,2);default:70.00" json:"passing_score"`
	MaxScore         float64         `gorm:"type:decimal(5,2);default:100.00" json:"max_score"`
	TimeLimitMinutes int             `gorm:"type:int" json:"time_limit_minutes,omitempty"`
	Questions        datatypes.JSON  `gorm:"type:jsonb" json:"questions,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`

	Course *Course `gorm:"foreignKey:CourseID" json:"course,omitempty"`
}

func (Assessment) TableName() string {
	return "assessments"
}

type AssessmentAttempt struct {
	ID              string          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID        string          `gorm:"type:varchar(50);not null;index:idx_attempts_tenant;index" json:"tenant_id"`
	AssessmentID    string          `gorm:"type:uuid;not null;index:idx_attempts_assessment" json:"assessment_id"`
	EmployeeID      string          `gorm:"type:varchar(100);not null;index:idx_attempts_employee" json:"employee_id"`
	Score           *float64        `gorm:"type:decimal(5,2)" json:"score,omitempty"`
	Passed          *bool           `json:"passed,omitempty"`
	Answers         datatypes.JSON  `gorm:"type:jsonb" json:"answers,omitempty"`
	StartedAt       *time.Time      `json:"started_at,omitempty"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
	AttemptNumber   int             `gorm:"default:1" json:"attempt_number"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`

	Assessment *Assessment `gorm:"foreignKey:AssessmentID" json:"assessment,omitempty"`
}

func (AssessmentAttempt) TableName() string {
	return "assessment_attempts"
}

type LearningPath struct {
	ID                    string          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID              string          `gorm:"type:varchar(50);not null;index:idx_paths_tenant;index" json:"tenant_id"`
	Name                  string          `gorm:"type:varchar(200);not null" json:"name"`
	Description           string          `gorm:"type:text" json:"description,omitempty"`
	TargetRole            string          `gorm:"type:varchar(100)" json:"target_role,omitempty"`
	RequiredSkills        pq.StringArray  `gorm:"type:text[]" json:"required_skills,omitempty"`
	Courses               datatypes.JSON  `gorm:"type:jsonb" json:"courses,omitempty"`
	EstimatedDurationDays int             `gorm:"type:int" json:"estimated_duration_days,omitempty"`
	Status                string          `gorm:"type:varchar(20);default:ACTIVE" json:"status"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`
}

func (LearningPath) TableName() string {
	return "learning_paths"
}

type SkillMatrix struct {
	ID                string     `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID          string     `gorm:"type:varchar(50);not null;index:idx_skills_tenant;index" json:"tenant_id"`
	EmployeeID       string     `gorm:"type:varchar(100);not null;index:idx_skills_employee;uniqueIndex:idx_skills_unique" json:"employee_id"`
	Skill            string     `gorm:"type:varchar(100);not null;uniqueIndex:idx_skills_unique" json:"skill"`
	ProficiencyLevel  string     `gorm:"type:varchar(20)" json:"proficiency_level,omitempty"`
	YearsOfExperience float64    `gorm:"type:decimal(3,1)" json:"years_of_experience,omitempty"`
	LastUsedDate      *time.Time `gorm:"type:date" json:"last_used_date,omitempty"`
	Certified         bool       `gorm:"default:false" json:"certified"`
	EndorsedBy        string     `gorm:"type:varchar(100)" json:"endorsed_by,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func (SkillMatrix) TableName() string {
	return "skill_matrix"
}
