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

type ComplianceTraining struct {
	ID                 string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID           string         `gorm:"type:varchar(50);not null;index:idx_compliance_tenant;index" json:"tenant_id"`
	CourseID           string         `gorm:"type:uuid;not null;index:idx_compliance_course" json:"course_id"`
	EmployeeID         string         `gorm:"type:varchar(100);not null;index:idx_compliance_employee" json:"employee_id"`
	PolicyName         string         `gorm:"type:varchar(200);not null" json:"policy_name"`
	PolicyCategory     string         `gorm:"type:varchar(50)" json:"policy_category"`
	DueDate            *time.Time     `gorm:"type:date" json:"due_date,omitempty"`
	CompletedDate      *time.Time     `gorm:"type:date" json:"completed_date,omitempty"`
	Status             string         `gorm:"type:varchar(20);default:PENDING" json:"status"`
	Score              *float64       `gorm:"type:decimal(5,2)" json:"score,omitempty"`
	Attempts           int            `gorm:"default:0" json:"attempts"`
	IsMandatory        bool           `gorm:"default:true" json:"is_mandatory"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	Course *Course `gorm:"foreignKey:CourseID" json:"course,omitempty"`
}

func (ComplianceTraining) TableName() string { return "compliance_trainings" }

type LearningRecommendation struct {
	ID              string          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID        string          `gorm:"type:varchar(50);not null;index:idx_recs_tenant;index" json:"tenant_id"`
	EmployeeID      string          `gorm:"type:varchar(100);not null;index:idx_recs_employee" json:"employee_id"`
	SkillName       string          `gorm:"type:varchar(100)" json:"skill_name"`
	GapScore        float64         `gorm:"type:decimal(5,2)" json:"gap_score"`
	RecommendedType string          `gorm:"type:varchar(50)" json:"recommended_type"`
	RecommendedID   string          `gorm:"type:uuid" json:"recommended_id"`
	Title           string          `gorm:"type:varchar(200);not null" json:"title"`
	Description     string          `gorm:"type:text" json:"description,omitempty"`
	Priority        string          `gorm:"type:varchar(20);default:MEDIUM" json:"priority"`
	Reason          string          `gorm:"type:text" json:"reason,omitempty"`
	Status          string          `gorm:"type:varchar(20);default:PENDING" json:"status"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

func (LearningRecommendation) TableName() string { return "learning_recommendations" }

type MentorProfile struct {
	ID             string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID       string         `gorm:"type:varchar(50);not null;index:idx_mentors_tenant;index" json:"tenant_id"`
	EmployeeID     string         `gorm:"type:varchar(100);not null;uniqueIndex:idx_mentor_unique" json:"employee_id"`
	FullName       string         `gorm:"type:varchar(200);not null" json:"full_name"`
	Department     string         `gorm:"type:varchar(100)" json:"department,omitempty"`
	Role           string         `gorm:"type:varchar(200)" json:"role,omitempty"`
	Bio            string         `gorm:"type:text" json:"bio,omitempty"`
	Expertise      pq.StringArray `gorm:"type:text[]" json:"expertise,omitempty"`
	MaxMentees     int            `gorm:"default:3" json:"max_mentees"`
	CurrentMentees int            `gorm:"default:0" json:"current_mentees"`
	IsAvailable    bool           `gorm:"default:true" json:"is_available"`
	Rating         float64        `gorm:"type:decimal(2,1);default:0" json:"rating"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

func (MentorProfile) TableName() string { return "mentor_profiles" }

type MentorSession struct {
	ID           string     `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID     string     `gorm:"type:varchar(50);not null;index:idx_mentor_sessions_tenant;index" json:"tenant_id"`
	MentorID     string     `gorm:"type:uuid;not null;index:idx_mentor_sessions_mentor" json:"mentor_id"`
	MenteeID     string     `gorm:"type:varchar(100);not null" json:"mentee_id"`
	Topic        string     `gorm:"type:varchar(200);not null" json:"topic"`
	ScheduledAt  *time.Time `json:"scheduled_at,omitempty"`
	DurationMins int        `gorm:"default:30" json:"duration_mins"`
	Status       string     `gorm:"type:varchar(20);default:SCHEDULED" json:"status"`
	Notes        string     `gorm:"type:text" json:"notes,omitempty"`
	Feedback     string     `gorm:"type:text" json:"feedback,omitempty"`
	Rating       int        `gorm:"default:0" json:"rating"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	Mentor *MentorProfile `gorm:"foreignKey:MentorID" json:"mentor,omitempty"`
}

func (MentorSession) TableName() string { return "mentor_sessions" }

type MarketplaceListing struct {
	ID                string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID          string         `gorm:"type:varchar(50);not null;index:idx_marketplace_tenant;index" json:"tenant_id"`
	Title             string         `gorm:"type:varchar(200);not null" json:"title"`
	Description       string         `gorm:"type:text" json:"description,omitempty"`
	Provider          string         `gorm:"type:varchar(200)" json:"provider,omitempty"`
	Category          string         `gorm:"type:varchar(50)" json:"category,omitempty"`
	Type              string         `gorm:"type:varchar(20)" json:"type"` // COURSE, WORKSHOP, CERTIFICATION, EXTERNAL
	Skills            pq.StringArray `gorm:"type:text[]" json:"skills,omitempty"`
	DurationHours     float64        `gorm:"type:decimal(6,1)" json:"duration_hours,omitempty"`
	Cost              float64        `gorm:"type:decimal(10,2);default:0" json:"cost"`
	Currency          string         `gorm:"type:varchar(3);default:USD" json:"currency"`
	MaxParticipants   int            `gorm:"default:0" json:"max_participants"`
	EnrolledCount     int            `gorm:"default:0" json:"enrolled_count"`
	Rating            float64        `gorm:"type:decimal(2,1);default:0" json:"rating"`
	Status            string         `gorm:"type:varchar(20);default:ACTIVE" json:"status"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

func (MarketplaceListing) TableName() string { return "marketplace_listings" }

type KnowledgeArticle struct {
	ID              string         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID        string         `gorm:"type:varchar(50);not null;index:idx_knowledge_tenant;index" json:"tenant_id"`
	Title           string         `gorm:"type:varchar(200);not null" json:"title"`
	Summary         string         `gorm:"type:text" json:"summary,omitempty"`
	Content         string         `gorm:"type:text" json:"content,omitempty"`
	Category        string         `gorm:"type:varchar(50)" json:"category,omitempty"`
	Tags            pq.StringArray `gorm:"type:text[]" json:"tags,omitempty"`
	AuthorID        string         `gorm:"type:varchar(100)" json:"author_id,omitempty"`
	AuthorName      string         `gorm:"type:varchar(200)" json:"author_name,omitempty"`
	ContentType     string         `gorm:"type:varchar(20);default:ARTICLE" json:"content_type"` // ARTICLE, VIDEO, DOCUMENT, LINK
	ContentURL      string         `gorm:"type:text" json:"content_url,omitempty"`
	ViewCount       int            `gorm:"default:0" json:"view_count"`
	UsefulCount     int            `gorm:"default:0" json:"useful_count"`
	Status          string         `gorm:"type:varchar(20);default:PUBLISHED" json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

func (KnowledgeArticle) TableName() string { return "knowledge_articles" }

type SkillEndorsement struct {
	ID          string    `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID    string    `gorm:"type:varchar(50);not null;index:idx_endorse_tenant;index" json:"tenant_id"`
	SkillID     string    `gorm:"type:uuid;not null;index:idx_endorse_skill" json:"skill_id"`
	EmployeeID  string    `gorm:"type:varchar(100);not null;index:idx_endorse_employee" json:"employee_id"`
	EndorsedBy  string    `gorm:"type:varchar(100);not null" json:"endorsed_by"`
	EndorserName string   `gorm:"type:varchar(200)" json:"endorser_name,omitempty"`
	SkillName   string    `gorm:"type:varchar(100);not null" json:"skill_name"`
	Proficiency string    `gorm:"type:varchar(20)" json:"proficiency"`
	Comment     string    `gorm:"type:text" json:"comment,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (SkillEndorsement) TableName() string { return "skill_endorsements" }

type CompetencyFramework struct {
	ID              string          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID        string          `gorm:"type:varchar(50);not null;index:idx_competency_tenant;index" json:"tenant_id"`
	Name            string          `gorm:"type:varchar(200);not null" json:"name"`
	Role            string          `gorm:"type:varchar(100);not null" json:"role"`
	Level           string          `gorm:"type:varchar(50)" json:"level"`
	Competencies    datatypes.JSON  `gorm:"type:jsonb" json:"competencies"`
	RequiredScore   float64         `gorm:"type:decimal(5,2);default:70.00" json:"required_score"`
	Status          string          `gorm:"type:varchar(20);default:ACTIVE" json:"status"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

func (CompetencyFramework) TableName() string { return "competency_frameworks" }

type LearningJourney struct {
	ID              string          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID        string          `gorm:"type:varchar(50);not null;index:idx_journey_tenant;index" json:"tenant_id"`
	EmployeeID      string          `gorm:"type:varchar(100);not null;index:idx_journey_employee" json:"employee_id"`
	Name            string          `gorm:"type:varchar(200);not null" json:"name"`
	TargetRole      string          `gorm:"type:varchar(100)" json:"target_role"`
	Steps           datatypes.JSON  `gorm:"type:jsonb" json:"steps"`
	CurrentStep     int             `gorm:"default:0" json:"current_step"`
	ProgressPct     float64         `gorm:"type:decimal(5,2);default:0" json:"progress_pct"`
	Status          string          `gorm:"type:varchar(20);default:ACTIVE" json:"status"`
	StartedAt       *time.Time      `json:"started_at,omitempty"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

func (LearningJourney) TableName() string { return "learning_journeys" }
