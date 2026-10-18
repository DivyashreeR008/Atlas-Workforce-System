import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def utcnow():
    return datetime.now(timezone.utc)


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    # SQLite hands back naive datetimes; treat stored timestamps as UTC so
    # comparisons with datetime.now(timezone.utc) never raise.
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class Webhook(Base):
    __tablename__ = "integration_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    secret = Column(String(255), nullable=True)
    previous_secret = Column(String(255), nullable=True)
    secret_rotated_at = Column(DateTime(timezone=True), nullable=True)
    secret_grace_expires_at = Column(DateTime(timezone=True), nullable=True)
    event_types = Column(JSONB, nullable=False, default=list)
    headers = Column(JSONB, nullable=True, default=dict)
    retry_count = Column(Integer, nullable=False, default=3)
    retry_interval_sec = Column(Integer, nullable=False, default=60)
    timeout_sec = Column(Integer, nullable=False, default=30)
    enabled = Column(Boolean, nullable=False, default=True)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    delivery_logs = relationship("WebhookDeliveryLog", back_populates="webhook", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_webhook_tenant", "tenant_id"),
        Index("idx_webhook_event_types", "event_types", postgresql_using="gin"),
    )

    @property
    def secret_set(self) -> bool:
        return bool(self.secret)

    @property
    def previous_secret_valid_until(self):
        # Operators can see when the rotation grace window closes without ever
        # seeing the secret material itself.
        if not self.previous_secret:
            return None
        return as_utc(self.secret_grace_expires_at)

    def previous_secret_usable(self, now: Optional[datetime] = None) -> bool:
        if not self.previous_secret:
            return False
        expires = as_utc(self.secret_grace_expires_at)
        if expires is None:
            return False
        current = as_utc(now) if now is not None else utcnow()
        return current < expires

    def signing_secrets(self, now: Optional[datetime] = None) -> list:
        secrets = [self.secret] if self.secret else []
        if self.previous_secret_usable(now):
            secrets.append(self.previous_secret)
        return secrets


class WebhookDeliveryLog(Base):
    __tablename__ = "integration_webhook_delivery_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("integration_webhooks.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(50), nullable=False)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    signature = Column(String(255), nullable=True)
    signature_timestamp = Column(Integer, nullable=True)
    request_body = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING")
    status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    webhook = relationship("Webhook", back_populates="delivery_logs")

    __table_args__ = (
        CheckConstraint(
            "status <> 'PENDING' OR next_retry_at IS NOT NULL",
            name="ck_delivery_pending_has_retry",
        ),
        Index("idx_webhook_delivery_status", "status", "next_retry_at"),
        Index("idx_webhook_delivery_webhook", "webhook_id"),
        Index("idx_webhook_delivery_tenant", "tenant_id"),
    )


class EventSubscription(Base):
    __tablename__ = "integration_event_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    event_type = Column(String(100), nullable=False)
    source_service = Column(String(100), nullable=True)
    kafka_topic = Column(String(200), nullable=True)
    transform_template = Column(JSONB, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("idx_event_sub_tenant_type", "tenant_id", "event_type"),
        UniqueConstraint("tenant_id", "event_type", "kafka_topic", name="uq_event_subscription"),
    )


class EventOutbox(Base):
    __tablename__ = "integration_event_outbox"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    event_type = Column(String(100), nullable=False)
    source_service = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="PENDING")
    published_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (
        Index("idx_outbox_status", "status", "created_at"),
        Index("idx_outbox_tenant", "tenant_id"),
    )


class IntegrationConfig(Base):
    __tablename__ = "integration_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(50), nullable=False)
    key = Column(String(200), nullable=False)
    value = Column(JSONB, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_integration_config"),
        Index("idx_integration_config_tenant", "tenant_id"),
    )
