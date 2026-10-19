import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from models import (
    EventOutbox,
    EventSubscription,
    IntegrationConfig,
    ProcessedEvent,
    Webhook,
    WebhookDeliveryLog,
)
from ssrf_guard import SSRFBlockedError, validate_webhook_headers, validate_webhook_url
from webhook_engine import DEFAULT_ROTATION_GRACE_SEC, generate_webhook_secret, serialize_payload

# How long a consumed event id stays in the ledger. Long enough to cover every
# realistic broker redelivery window; the GC sweep in the background loop keeps
# the table bounded.
PROCESSED_EVENT_TTL_DAYS = 7


class MassAssignmentError(ValueError):
    pass


def register_processed_event(db: Session, consumer: str, event_id: str) -> bool:
    """Transactionally record a consumed event id. Returns False on duplicate.

    Check-then-insert with a unique primary key, mirroring the payroll outbox
    pattern: the db-level constraint is the source of truth, so a racing
    redelivery that slips past the SELECT still loses on the INSERT.
    """
    event_id = (str(event_id or "")).strip()
    if not event_id or len(event_id) > 200:
        return False
    existing = db.query(ProcessedEvent).filter(ProcessedEvent.event_id == event_id).first()
    if existing:
        return False
    try:
        db.add(ProcessedEvent(
            event_id=event_id,
            consumer=consumer,
            processed_at=datetime.now(timezone.utc),
            ttl_expires_at=datetime.now(timezone.utc) + timedelta(days=PROCESSED_EVENT_TTL_DAYS),
        ))
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False


def discard_processed_event(db: Session, event_id: str) -> None:
    """Withdraw a dedup claim whose processing failed, enabling redelivery."""
    event_id = (str(event_id or "")).strip()
    if not event_id:
        return
    db.query(ProcessedEvent).filter(ProcessedEvent.event_id == event_id).delete(synchronize_session=False)
    db.commit()


def gc_processed_events(db: Session, batch_size: int = 1000, now: Optional[datetime] = None) -> int:
    """Delete expired entries past their TTL; returns how many were removed."""
    cutoff = (now or datetime.now(timezone.utc))
    ids = [
        row[0]
        for row in db.query(ProcessedEvent.event_id)
        .filter(ProcessedEvent.ttl_expires_at < cutoff)
        .limit(max(int(batch_size), 1))
        .all()
    ]
    if not ids:
        return 0
    deleted = (
        db.query(ProcessedEvent)
        .filter(ProcessedEvent.event_id.in_(ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted or 0)


def apply_updates(obj, data: dict, allowed_fields: set):
    unknown = [k for k in data.keys() if k not in allowed_fields]
    if unknown:
        raise MassAssignmentError(f"Unknown or read-only fields: {', '.join(sorted(unknown))}")
    for key in allowed_fields:
        if key in data and data[key] is not None:
            setattr(obj, key, data[key])
    return obj


def filter_create_data(data: dict, allowed_fields: set) -> dict:
    unknown = [k for k in data.keys() if k not in allowed_fields]
    if unknown:
        raise MassAssignmentError(f"Unknown or read-only fields: {', '.join(sorted(unknown))}")
    return {k: data[k] for k in allowed_fields if k in data}


WEBHOOK_CREATE_FIELDS = frozenset({"name", "url", "secret", "event_types", "headers", "retry_count", "retry_interval_sec", "timeout_sec"})
# "secret" is intentionally absent: rotate through the rotation endpoint so the
# grace window is recorded. A direct PUT would swap the key with no overlap.
WEBHOOK_UPDATE_FIELDS = frozenset({"name", "url", "event_types", "headers", "retry_count", "retry_interval_sec", "timeout_sec", "enabled", "last_triggered_at"})

EVENT_SUB_CREATE_FIELDS = frozenset({"event_type", "source_service", "kafka_topic", "transform_template"})
EVENT_SUB_UPDATE_FIELDS = frozenset({"event_type", "source_service", "kafka_topic", "transform_template", "enabled"})

INTEGRATION_CONFIG_CREATE_FIELDS = frozenset({"key", "value", "description"})
INTEGRATION_CONFIG_UPDATE_FIELDS = frozenset({"value", "description"})

DELIVERY_LOG_UPDATE_FIELDS = frozenset({"status", "status_code", "response_body", "attempts", "max_attempts", "next_retry_at", "delivered_at", "signature", "signature_timestamp", "request_body"})


def list_webhooks(
    db: Session,
    tenant_id: str,
    page: int = 1,
    page_size: int = 20,
    enabled: Optional[bool] = None,
) -> dict:
    query = db.query(Webhook).filter(Webhook.tenant_id == tenant_id)
    if enabled is not None:
        query = query.filter(Webhook.enabled == enabled)
    total = query.count()
    items = query.order_by(Webhook.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_webhook(db: Session, webhook_id: UUID, tenant_id: str) -> Optional[Webhook]:
    return db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.tenant_id == tenant_id).first()


def create_webhook(db: Session, tenant_id: str, data: dict) -> Webhook:
    filtered = filter_create_data(data, WEBHOOK_CREATE_FIELDS)
    url = filtered.get("url", "")
    try:
        validate_webhook_url(url)
        validate_webhook_headers(filtered.get("headers"))
    except SSRFBlockedError as e:
        raise ValueError(str(e))
    if not filtered.get("secret"):
        # Generated once here; the create response is the only place the
        # plaintext secret is ever returned.
        filtered["secret"] = generate_webhook_secret()
    webhook = Webhook(tenant_id=tenant_id, **filtered)
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook


def rotate_webhook_secret(
    db: Session,
    webhook_id: UUID,
    tenant_id: str,
    grace_seconds: int = DEFAULT_ROTATION_GRACE_SEC,
) -> Optional[tuple[Webhook, str]]:
    """Generate a new signing secret and keep the old one valid for grace_seconds.

    Returns (webhook, new_secret) so the caller can surface the secret once.
    Webhooks that predate signing have no old secret; rotation simply enables
    signing for them.
    """
    webhook = get_webhook(db, webhook_id, tenant_id)
    if not webhook:
        return None
    now = datetime.now(timezone.utc)
    new_secret = generate_webhook_secret()
    webhook.previous_secret = webhook.secret if webhook.secret else None
    webhook.secret = new_secret
    webhook.secret_rotated_at = now
    webhook.secret_grace_expires_at = now + timedelta(seconds=max(int(grace_seconds), 0)) if webhook.previous_secret else None
    webhook.updated_at = now
    db.commit()
    db.refresh(webhook)
    return webhook, new_secret


def update_webhook(db: Session, webhook_id: UUID, tenant_id: str, data: dict) -> Optional[Webhook]:
    webhook = get_webhook(db, webhook_id, tenant_id)
    if not webhook:
        return None
    if "url" in data and data["url"] is not None:
        try:
            validate_webhook_url(data["url"])
        except SSRFBlockedError as e:
            raise ValueError(str(e))
    if "headers" in data and data["headers"] is not None:
        try:
            validate_webhook_headers(data["headers"])
        except SSRFBlockedError as e:
            raise ValueError(str(e))
    apply_updates(webhook, data, WEBHOOK_UPDATE_FIELDS)
    webhook.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(webhook)
    return webhook


def delete_webhook(db: Session, webhook_id: UUID, tenant_id: str) -> bool:
    webhook = get_webhook(db, webhook_id, tenant_id)
    if not webhook:
        return False
    db.delete(webhook)
    db.commit()
    return True


def list_webhook_delivery_logs(
    db: Session,
    tenant_id: str,
    webhook_id: Optional[UUID] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    query = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.tenant_id == tenant_id)
    if webhook_id:
        query = query.filter(WebhookDeliveryLog.webhook_id == webhook_id)
    if status:
        query = query.filter(WebhookDeliveryLog.status == status)
    total = query.count()
    items = query.order_by(WebhookDeliveryLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def create_delivery_log(db: Session, tenant_id: str, webhook_id: UUID, event_type: str, payload: dict, max_attempts: int) -> WebhookDeliveryLog:
    log = WebhookDeliveryLog(
        webhook_id=webhook_id,
        tenant_id=tenant_id,
        event_type=event_type,
        payload=payload,
        max_attempts=max_attempts,
        next_retry_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_delivery_log(db: Session, delivery_id: UUID, tenant_id: str) -> Optional[WebhookDeliveryLog]:
    return (
        db.query(WebhookDeliveryLog)
        .filter(WebhookDeliveryLog.id == delivery_id, WebhookDeliveryLog.tenant_id == tenant_id)
        .first()
    )


def build_delivery_detail(db: Session, log: WebhookDeliveryLog) -> dict:
    """Assemble the debugging view for one delivery attempt.

    Exposes the exact body and signature headers that were signed so an
    integrator can reproduce the request with curl and check their verifier.
    Falls back to re-serializing the stored payload for deliveries recorded
    before signing artifacts were persisted.
    """
    from webhook_engine import build_curl_example

    webhook = db.query(Webhook).filter(Webhook.id == log.webhook_id).first()
    target_url = webhook.url if webhook else None
    body_reconstructed = log.request_body is None
    signed_payload = log.request_body if log.request_body is not None else serialize_payload(log.payload).decode("utf-8", errors="replace")
    curl_example = None
    if target_url and log.signature and log.signature_timestamp is not None:
        curl_example = build_curl_example(target_url, log.signature_timestamp, log.signature, signed_payload)
    return {
        "id": log.id,
        "webhook_id": log.webhook_id,
        "tenant_id": log.tenant_id,
        "event_type": log.event_type,
        "status": log.status,
        "status_code": log.status_code,
        "response_body": log.response_body,
        "attempts": log.attempts,
        "max_attempts": log.max_attempts,
        "next_retry_at": log.next_retry_at,
        "delivered_at": log.delivered_at,
        "created_at": log.created_at,
        "payload": log.payload,
        "signature": log.signature,
        "signature_timestamp": log.signature_timestamp,
        "signature_version": "v1",
        "signed_payload": signed_payload,
        "body_reconstructed": body_reconstructed,
        "target_url": target_url,
        "curl_example": curl_example,
    }


def update_delivery_log(db: Session, log_id: UUID, data: dict) -> Optional[WebhookDeliveryLog]:
    log = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.id == log_id).first()
    if not log:
        return None
    apply_updates(log, data, DELIVERY_LOG_UPDATE_FIELDS)
    db.commit()
    db.refresh(log)
    return log


def get_pending_retries(db: Session, limit: int = 50) -> list[WebhookDeliveryLog]:
    now = datetime.now(timezone.utc)
    return (
        db.query(WebhookDeliveryLog)
        .filter(
            WebhookDeliveryLog.status == "PENDING",
            or_(WebhookDeliveryLog.next_retry_at.is_(None), WebhookDeliveryLog.next_retry_at <= now),
            WebhookDeliveryLog.attempts < WebhookDeliveryLog.max_attempts,
        )
        .limit(limit)
        .all()
    )


def list_event_subscriptions(
    db: Session,
    tenant_id: str,
    page: int = 1,
    page_size: int = 20,
    enabled: Optional[bool] = None,
) -> dict:
    query = db.query(EventSubscription).filter(EventSubscription.tenant_id == tenant_id)
    if enabled is not None:
        query = query.filter(EventSubscription.enabled == enabled)
    total = query.count()
    items = query.order_by(EventSubscription.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_event_subscription(db: Session, sub_id: UUID, tenant_id: str) -> Optional[EventSubscription]:
    return db.query(EventSubscription).filter(EventSubscription.id == sub_id, EventSubscription.tenant_id == tenant_id).first()


def create_event_subscription(db: Session, tenant_id: str, data: dict) -> EventSubscription:
    sub = EventSubscription(tenant_id=tenant_id, **filter_create_data(data, EVENT_SUB_CREATE_FIELDS))
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def update_event_subscription(db: Session, sub_id: UUID, tenant_id: str, data: dict) -> Optional[EventSubscription]:
    sub = get_event_subscription(db, sub_id, tenant_id)
    if not sub:
        return None
    apply_updates(sub, data, EVENT_SUB_UPDATE_FIELDS)
    sub.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub


def delete_event_subscription(db: Session, sub_id: UUID, tenant_id: str) -> bool:
    sub = get_event_subscription(db, sub_id, tenant_id)
    if not sub:
        return False
    db.delete(sub)
    db.commit()
    return True


def list_event_outbox(
    db: Session,
    tenant_id: str,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    query = db.query(EventOutbox).filter(EventOutbox.tenant_id == tenant_id)
    if status:
        query = query.filter(EventOutbox.status == status)
    total = query.count()
    items = query.order_by(EventOutbox.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def create_outbox_event(db: Session, tenant_id: str, event_type: str, source_service: str, payload: dict) -> EventOutbox:
    event = EventOutbox(tenant_id=tenant_id, event_type=event_type, source_service=source_service, payload=payload)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def mark_outbox_published(db: Session, event_id: UUID) -> Optional[EventOutbox]:
    event = db.query(EventOutbox).filter(EventOutbox.id == event_id).first()
    if not event:
        return None
    event.status = "PUBLISHED"
    event.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(event)
    return event


def mark_outbox_failed(db: Session, event_id: UUID, error: str) -> Optional[EventOutbox]:
    event = db.query(EventOutbox).filter(EventOutbox.id == event_id).first()
    if not event:
        return None
    event.status = "FAILED"
    event.error_message = error
    event.retry_count = EventOutbox.retry_count + 1
    db.commit()
    db.refresh(event)
    return event


def get_pending_outbox_events(db: Session, limit: int = 50) -> list[EventOutbox]:
    return (
        db.query(EventOutbox)
        .filter(EventOutbox.status == "PENDING")
        .order_by(EventOutbox.created_at.asc())
        .limit(limit)
        .all()
    )


def list_integration_configs(db: Session, tenant_id: str) -> list[IntegrationConfig]:
    return db.query(IntegrationConfig).filter(IntegrationConfig.tenant_id == tenant_id).order_by(IntegrationConfig.key).all()


def get_integration_config(db: Session, tenant_id: str, key: str) -> Optional[IntegrationConfig]:
    return db.query(IntegrationConfig).filter(IntegrationConfig.tenant_id == tenant_id, IntegrationConfig.key == key).first()


def create_integration_config(db: Session, tenant_id: str, data: dict) -> IntegrationConfig:
    config = IntegrationConfig(tenant_id=tenant_id, **filter_create_data(data, INTEGRATION_CONFIG_CREATE_FIELDS))
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_integration_config(db: Session, tenant_id: str, key: str, data: dict) -> Optional[IntegrationConfig]:
    config = get_integration_config(db, tenant_id, key)
    if not config:
        return None
    if "value" in data:
        config.value = data["value"]
    if "description" in data:
        config.description = data["description"]
    config.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(config)
    return config


def delete_integration_config(db: Session, tenant_id: str, key: str) -> bool:
    config = get_integration_config(db, tenant_id, key)
    if not config:
        return False
    db.delete(config)
    db.commit()
    return True


def get_dashboard_stats(db: Session, tenant_id: str) -> dict:
    total_webhooks = db.query(Webhook).filter(Webhook.tenant_id == tenant_id).count()
    active_webhooks = db.query(Webhook).filter(Webhook.tenant_id == tenant_id, Webhook.enabled == True).count()
    total_subscriptions = db.query(EventSubscription).filter(EventSubscription.tenant_id == tenant_id).count()
    total_deliveries = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.tenant_id == tenant_id).count()
    successful_deliveries = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.tenant_id == tenant_id, WebhookDeliveryLog.status == "DELIVERED").count()
    failed_deliveries = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.tenant_id == tenant_id, WebhookDeliveryLog.status == "FAILED").count()
    pending_deliveries = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.tenant_id == tenant_id, WebhookDeliveryLog.status == "PENDING").count()
    outbox_pending = db.query(EventOutbox).filter(EventOutbox.tenant_id == tenant_id, EventOutbox.status == "PENDING").count()
    outbox_failed = db.query(EventOutbox).filter(EventOutbox.tenant_id == tenant_id, EventOutbox.status == "FAILED").count()
    return {
        "total_webhooks": total_webhooks,
        "active_webhooks": active_webhooks,
        "total_subscriptions": total_subscriptions,
        "total_deliveries": total_deliveries,
        "successful_deliveries": successful_deliveries,
        "failed_deliveries": failed_deliveries,
        "pending_deliveries": pending_deliveries,
        "outbox_pending": outbox_pending,
        "outbox_failed": outbox_failed,
    }
