import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    event_type = Column(String(100), nullable=False)
    actor_id = Column(String(100), nullable=False)
    actor_email = Column(String(255), nullable=True)
    action = Column(String(50), nullable=True)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(100), nullable=True)
    device_fingerprint = Column(String(255), nullable=True)
    hash = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=True)
    metadata_json = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_audit_tenant_created", "tenant_id", "created_at"),
        Index("idx_audit_event_type", "event_type"),
        Index("idx_audit_actor_id", "actor_id"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
    )


class CompliancePolicy(Base):
    __tablename__ = "compliance_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    severity = Column(String(20), nullable=True)
    rules = Column(JSONB, nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    violations = relationship("ComplianceViolation", back_populates="policy")


class ComplianceViolation(Base):
    __tablename__ = "compliance_violations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    policy_id = Column(
        UUID(as_uuid=True), ForeignKey("compliance_policies.id"), nullable=True
    )
    employee_id = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="OPEN")
    detected_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    remediated_at = Column(DateTime(timezone=True), nullable=True)
    evidence = Column(JSONB, nullable=True)
    assigned_to = Column(String(100), nullable=True)

    policy = relationship("CompliancePolicy", back_populates="violations")


class DataRetentionPolicy(Base):
    __tablename__ = "data_retention_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=True)
    resource_type = Column(String(100), nullable=False)
    retention_days = Column(Integer, nullable=False)
    action = Column(String(20), nullable=True)
    enabled = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "resource_type"),
    )


class GDPRConsentRecord(Base):
    __tablename__ = "gdpr_consent_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=True)
    employee_id = Column(String(100), nullable=False)
    consent_type = Column(String(50), nullable=False)
    granted = Column(Boolean, nullable=False)
    granted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(45), nullable=True)
