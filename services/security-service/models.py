import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()

def utcnow():
    return datetime.now(timezone.utc)

class ZeroTrustPolicy(Base):
    __tablename__ = "zero_trust_policies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=100)
    conditions = Column(JSONB, nullable=False, default=dict)
    actions = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_ztp_tenant", "tenant_id"),)

class ConditionalAccessPolicy(Base):
    __tablename__ = "conditional_access_policies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    enabled = Column(Boolean, default=True)
    conditions = Column(JSONB, nullable=False, default=dict)
    grant_controls = Column(JSONB, nullable=False, default=dict)
    session_controls = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    __table_args__ = (Index("idx_cap_tenant", "tenant_id"),)

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    user_id = Column(String(100), nullable=False)
    session_id = Column(String(100))
    risk_score = Column(Integer, nullable=False)
    risk_level = Column(String(20), nullable=False)
    factors = Column(JSONB, nullable=False, default=dict)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    device_id = Column(String(255))
    location = Column(JSONB)
    assessed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    __table_args__ = (Index("idx_ra_user", "tenant_id", "user_id"), Index("idx_ra_assessed", "assessed_at"))

class PrivilegedRole(Base):
    __tablename__ = "privileged_roles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    permissions = Column(JSONB, nullable=False, default=list)
    risk_level = Column(String(20), default="high")
    requires_approval = Column(Boolean, default=True)
    max_duration_minutes = Column(Integer, default=480)
    allowed_requester_roles = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    __table_args__ = (UniqueConstraint("tenant_id", "name"),)

class PrivilegedAccess(Base):
    __tablename__ = "privileged_access_grants"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    user_id = Column(String(100), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("privileged_roles.id"), nullable=False)
    granted_by = Column(String(100))
    justification = Column(Text)
    jit_enabled = Column(Boolean, default=True)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    status = Column(String(20), default="pending")
    approved_by = Column(String(100))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    __table_args__ = (Index("idx_pag_user", "tenant_id", "user_id"), Index("idx_pag_status", "status"))

class DataClassification(Base):
    __tablename__ = "data_classifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_pattern = Column(String(500))
    classification_level = Column(String(50), nullable=False)
    category = Column(String(100))
    owner = Column(String(100))
    retention_days = Column(Integer)
    encryption_required = Column(Boolean, default=True)
    masking_rules = Column(JSONB)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    __table_args__ = (UniqueConstraint("tenant_id", "resource_type", "resource_pattern"),)

class DLPPolicy(Base):
    __tablename__ = "dlp_policies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    enabled = Column(Boolean, default=True)
    severity = Column(String(20), default="medium")
    rules = Column(JSONB, nullable=False, default=dict)
    actions = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

class DLPIncident(Base):
    __tablename__ = "dlp_incidents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("dlp_policies.id"))
    user_id = Column(String(100))
    resource_type = Column(String(100))
    resource_id = Column(String(200))
    action = Column(String(50))
    data_classification = Column(String(50))
    description = Column(Text)
    severity = Column(String(20))
    status = Column(String(20), default="open")
    detected_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    remediated_at = Column(DateTime(timezone=True))
    evidence = Column(JSONB)

class EncryptionKey(Base):
    __tablename__ = "encryption_keys"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    key_id = Column(String(100), nullable=False, unique=True)
    algorithm = Column(String(50), nullable=False, default="AES-256-GCM")
    purpose = Column(String(100), nullable=False)
    status = Column(String(20), default="active")
    version = Column(Integer, default=1)
    rotated_from = Column(String(100))
    activated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at = Column(DateTime(timezone=True))
    rotated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    __table_args__ = (Index("idx_ek_tenant_status", "tenant_id", "status"),)

class DataResidencyPolicy(Base):
    __tablename__ = "data_residency_policies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    region = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    data_classification = Column(String(50))
    allowed_regions = Column(JSONB, nullable=False, default=list)
    restricted_regions = Column(JSONB, nullable=False, default=list)
    enforcement_mode = Column(String(20), default="strict")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

class SessionRecording(Base):
    __tablename__ = "session_recordings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    user_id = Column(String(100), nullable=False)
    session_id = Column(String(100))
    user_role = Column(String(50))
    recording_type = Column(String(50), default="keystroke")
    events = Column(JSONB, nullable=False, default=list)
    duration_seconds = Column(Integer)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    status = Column(String(20), default="recording")
    started_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    ended_at = Column(DateTime(timezone=True))
    __table_args__ = (Index("idx_sr_tenant_user", "tenant_id", "user_id"),)
