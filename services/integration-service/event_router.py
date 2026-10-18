import json
import logging
import os
import random
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session

from crud import (
    create_delivery_log,
    create_outbox_event,
    get_event_subscription,
    get_pending_outbox_events,
    get_pending_retries,
    list_event_subscriptions,
    list_webhooks,
    mark_outbox_published,
    mark_outbox_failed,
    update_delivery_log,
    update_webhook,
)
from models import Webhook, WebhookDeliveryLog
from webhook_engine import close_client, deliver_webhook, send_audit_event

logger = logging.getLogger("event-router")

RABBITMQ_URL = os.environ.get("RABBITMQ_URL", "amqp://atlas_rabbit:changeme_rabbit_pass@rabbitmq:5672/")
RABBITMQ_EXCHANGE = "notifications_exchange"
# Reconnection pacing: a broker restart is routine maintenance, so the consumer
# must outlive it. Bounded exponential backoff with jitter prevents a
# thundering herd against a recovering broker.
_CONSUMER_BACKOFF_BASE_SEC = 1
_CONSUMER_BACKOFF_CAP_SEC = 60

_rabbit_connection = None
_rabbit_channel = None
_db_session_factory = None


def set_db_session_factory(session_factory):
    global _db_session_factory
    _db_session_factory = session_factory


def get_db() -> Optional[Session]:
    if _db_session_factory:
        return _db_session_factory()
    return None


def parse_broker(url: str) -> dict:
    """Parse RABBITMQ_URL into connection parts.

    Fails fast with a message naming the variable on anything malformed:
    userless URLs, credentials containing '@', IPv6 hosts and non-default
    ports all parse correctly here, unlike the old string-splitting.
    """
    try:
        parsed = urlparse(url)
    except ValueError as exc:
        raise ValueError(f"RABBITMQ_URL is unparseable: {exc}") from exc
    if parsed.scheme not in ("amqp", "amqps"):
        raise ValueError(f"RABBITMQ_URL must start with amqp:// or amqps:// (got scheme={parsed.scheme!r})")
    if not parsed.hostname:
        raise ValueError("RABBITMQ_URL has no host")
    port = parsed.port or (5671 if parsed.scheme == "amqps" else 5672)
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    return {
        "host": parsed.hostname,
        "port": port,
        "username": username,
        "password": password,
        "ssl": parsed.scheme == "amqps",
    }


def _broker_credentials(broker: dict) -> tuple:
    """Resolve credentials: URL first, then environment, never 'guest' fallback."""
    username = broker.get("username") or os.environ.get("RABBITMQ_USER")
    password = broker.get("password") or os.environ.get("RABBITMQ_PASSWORD")
    if not username or not password:
        raise ValueError(
            "RabbitMQ credentials missing: set user:password in RABBITMQ_URL "
            "or provide RABBITMQ_USER and RABBITMQ_PASSWORD. "
            "Hard-failing rather than falling back to guest/guest."
        )
    return username, password


def start_rabbitmq_consumer():
    def _consume():
        try:
            import pika
        except ImportError:
            logger.info("[MOCK] RabbitMQ consumer (pika not available)")
            return
        # Parse and validate configuration once at startup so a typo fails
        # fast with a clear message instead of dying mid-reconnect loop.
        broker = parse_broker(RABBITMQ_URL)
        try:
            username, password = _broker_credentials(broker)
        except ValueError as exc:
            logger.error("RabbitMQ consumer not started: %s", exc)
            return

        attempt = 0
        while True:
            connection = None
            try:
                credentials = pika.PlainCredentials(username, password)
                params = pika.ConnectionParameters(
                    host=broker["host"],
                    port=broker["port"],
                    credentials=credentials,
                    heartbeat=30,
                )
                connection = pika.BlockingConnection(params)
                channel = connection.channel()
                channel.exchange_declare(exchange=RABBITMQ_EXCHANGE, exchange_type="fanout", durable=True)
                # Exclusive auto-delete queue: on reconnect this consumer gets a
                # fresh queue. Fanout messages published while disconnected are
                # not replayed, but the consumer itself keeps running.
                result = channel.queue_declare(queue="", exclusive=True, auto_delete=True)
                queue_name = result.method.queue
                channel.queue_bind(exchange=RABBITMQ_EXCHANGE, queue=queue_name)
                # Manual ack: a failed message must not be acknowledged and
                # lost. Unacknowledged deliveries return to the queue when the
                # connection drops.
                channel.basic_consume(queue=queue_name, on_message_callback=_handle_rabbitmq_message, auto_ack=False)
                logger.info("RabbitMQ consumer started on exchange=%s host=%s:%s", RABBITMQ_EXCHANGE, broker["host"], broker["port"])
                attempt = 0
                channel.start_consuming()
            except Exception as exc:
                logger.error("RabbitMQ consumer error: %s (%s) - reconnecting", exc, type(exc).__name__)
                # Drop any half-open connection before retrying.
                if connection is not None:
                    try:
                        if connection.is_open:
                            connection.close()
                    except Exception:
                        pass
                attempt += 1
                delay = min(_CONSUMER_BACKOFF_BASE_SEC * (2 ** (attempt - 1)), _CONSUMER_BACKOFF_CAP_SEC)
                delay += random.uniform(0, delay / 2)
                logger.info("RabbitMQ consumer reconnect attempt %s in %.1fs", attempt, round(delay, 1))
                time.sleep(delay)

    thread = threading.Thread(target=_consume, daemon=True, name="rabbitmq-consumer")
    thread.start()
    return thread


def _handle_rabbitmq_message(ch, method, properties, body):
    try:
        message = json.loads(body.decode("utf-8"))
        event_type = message.get("event_type", "notification")
        tenant_id = message.get("tenant_id", "default")
        logger.info(f"Received RabbitMQ event: {event_type} for tenant={tenant_id}")
        route_event(event_type, tenant_id, message)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        # A failed message must not dissolve into the log stream under a green
        # ack. Requeue once; reject on redelivery so a poison message cannot
        # loop forever.
        redelivered = bool(getattr(method, "redelivered", False))
        logger.error("Error handling RabbitMQ message: %s (redelivered=%s)", e, redelivered, exc_info=True)
        try:
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=not redelivered)
        except Exception as nack_exc:
            logger.warning("Failed to nack message: %s (%s)", nack_exc, type(nack_exc).__name__)


RETRY_BACKOFF_CAP_SEC = 30 * 60


def compute_backoff_delay(attempt: int, base_seconds: int, cap_seconds: int = RETRY_BACKOFF_CAP_SEC) -> float:
    # Exponential backoff (base * 2^(attempt-1)) with a small jitter and a cap,
    # so a permanently failing endpoint is not hit in a hot loop.
    base = max(int(base_seconds or 0), 1)
    delay = base * (2 ** max(int(attempt) - 1, 0))
    delay = min(delay, cap_seconds)
    return delay + random.uniform(0, base)


def build_retry_update(attempt: int, max_attempts: int, base_interval_sec: int, now=None) -> dict:
    now = now or datetime.now(timezone.utc)
    if attempt < max_attempts:
        return {
            "status": "PENDING",
            "attempts": attempt,
            "next_retry_at": now + timedelta(seconds=compute_backoff_delay(attempt, base_interval_sec)),
        }
    return {"status": "FAILED", "attempts": attempt, "next_retry_at": None}


def route_event(event_type: str, tenant_id: str, payload: dict, source_service: str = "rabbitmq"):
    db = get_db()
    if not db:
        logger.warning("No DB session available, skipping event routing")
        return

    try:
        webhooks = list_webhooks(db, tenant_id, enabled=True)
        for wh in webhooks.get("items", []):
            wh_event_types = wh.event_types or []
            if not wh_event_types or event_type in wh_event_types:
                log = create_delivery_log(db, tenant_id, wh.id, event_type, payload, wh.retry_count + 1)
                asyncio_thread = threading.Thread(
                    target=_deliver_sync,
                    args=(wh.url, payload, event_type, wh.id, log.id, wh.secret, wh.headers or {}, wh.timeout_sec, tenant_id, _active_previous_secret(wh)),
                    daemon=True,
                )
                asyncio_thread.start()

        subs = list_event_subscriptions(db, tenant_id, enabled=True)
        for sub in subs.get("items", []):
            if sub.event_type == event_type or sub.event_type == "*":
                if sub.kafka_topic:
                    from kafka_handler import publish_to_kafka
                    transformed = _apply_transform(payload, sub.transform_template)
                    success = publish_to_kafka(sub.kafka_topic, key=tenant_id, value=transformed)
                    if success:
                        outbox_event = create_outbox_event(db, tenant_id, event_type, source_service, payload)
                        mark_outbox_published(db, outbox_event.id)

        send_audit_event("integration.event_routed", {
            "event_type": event_type,
            "tenant_id": tenant_id,
            "source_service": source_service,
        })
    finally:
        db.close()


def _mark_delivery_failed(log_id, error):
    db = get_db()
    if not db:
        return
    try:
        update_delivery_log(db, log_id, {
            "status": "FAILED",
            "status_code": 0,
            "response_body": f"{type(error).__name__}: {error}"[:5000],
        })
    except Exception as e:
        logger.error("Failed to record delivery failure: %s (%s)", e, type(e).__name__, exc_info=True)
    finally:
        db.close()


def _active_previous_secret(webhook) -> Optional[str]:
    # Only advertise the old secret while its rotation grace window is open.
    if webhook is not None and webhook.previous_secret_usable():
        return webhook.previous_secret
    return None


def _deliver_sync(url, payload, event_type, webhook_id, log_id, secret, headers, timeout, tenant_id, previous_secret=None):
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    signing_out = {}
    try:
        status_code, response_body = loop.run_until_complete(
            deliver_webhook(
                url, payload, event_type, webhook_id, log_id, secret, headers, timeout,
                previous_secret=previous_secret, signing_out=signing_out,
            )
        )
        signing_fields = {key: signing_out[key] for key in ("signature", "signature_timestamp", "request_body") if signing_out.get(key) is not None}
        db = get_db()
        if db:
            try:
                if isinstance(response_body, str) and response_body.startswith("Blocked destination:"):
                    update_delivery_log(db, log_id, {
                        "status": "FAILED",
                        "status_code": status_code,
                        "response_body": response_body,
                        **signing_fields,
                    })
                elif isinstance(response_body, str) and response_body.startswith("Blocked headers:"):
                    update_delivery_log(db, log_id, {
                        "status": "FAILED",
                        "status_code": status_code,
                        "response_body": response_body,
                        **signing_fields,
                    })
                elif 200 <= status_code < 300:
                    update_delivery_log(db, log_id, {
                        "status": "DELIVERED",
                        "status_code": status_code,
                        "response_body": response_body,
                        "delivered_at": datetime.now(timezone.utc),
                        **signing_fields,
                    })
                    update_webhook(db, webhook_id, tenant_id, {"last_triggered_at": datetime.now(timezone.utc)})
                else:
                    log_row = db.query(WebhookDeliveryLog).filter(WebhookDeliveryLog.id == log_id).first()
                    attempts = (log_row.attempts if log_row and log_row.attempts is not None else 0) + 1
                    max_attempts = log_row.max_attempts if log_row and log_row.max_attempts else 3
                    webhook_row = db.query(Webhook).filter(Webhook.id == webhook_id).first()
                    base_interval = webhook_row.retry_interval_sec if webhook_row and webhook_row.retry_interval_sec else 60
                    retry_data = build_retry_update(attempts, max_attempts, base_interval)
                    retry_data["status_code"] = status_code
                    retry_data["response_body"] = response_body
                    retry_data.update(signing_fields)
                    update_delivery_log(db, log_id, retry_data)
            finally:
                db.close()
    except Exception as e:
        logger.error("Delivery error: %s (%s)", e, type(e).__name__, exc_info=True)
        _mark_delivery_failed(log_id, e)
    finally:
        try:
            loop.run_until_complete(close_client())
        except Exception as e:
            logger.warning("Failed to close webhook client: %s (%s)", e, type(e).__name__)
        loop.close()


def _apply_transform(payload: dict, template: Optional[dict]) -> dict:
    if not template:
        return payload
    transformed = {}
    for key, value in template.items():
        if isinstance(value, str) and value.startswith("$."):
            path = value[2:].split(".")
            current = payload
            for part in path:
                if isinstance(current, dict):
                    current = current.get(part, "")
                else:
                    current = ""
                    break
            transformed[key] = current
        elif isinstance(value, dict):
            transformed[key] = _apply_transform(payload, value)
        else:
            transformed[key] = value
    return transformed


def process_outbox():
    db = get_db()
    if not db:
        return
    try:
        events = get_pending_outbox_events(db)
        for event in events:
            subs = list_event_subscriptions(db, event.tenant_id, enabled=True)
            routed = False
            for sub in subs.get("items", []):
                if sub.event_type == event.event_type and sub.kafka_topic:
                    from kafka_handler import publish_to_kafka
                    success = publish_to_kafka(sub.kafka_topic, key=event.tenant_id, value=event.payload)
                    if success:
                        mark_outbox_published(db, event.id)
                        routed = True
                    else:
                        mark_outbox_failed(db, event.id, "Kafka publish failed")
            if not routed:
                mark_outbox_published(db, event.id)
    finally:
        db.close()


def retry_failed_deliveries():
    db = get_db()
    if not db:
        return
    try:
        logs = get_pending_retries(db)
        for log_entry in logs:
            from crud import get_webhook
            webhook = get_webhook(db, log_entry.webhook_id, log_entry.tenant_id)
            if not webhook or not webhook.enabled:
                update_delivery_log(db, log_entry.id, {"status": "FAILED"})
                continue
            asyncio_thread = threading.Thread(
                target=_deliver_sync,
                args=(
                    webhook.url, log_entry.payload, log_entry.event_type,
                    webhook.id, log_entry.id, webhook.secret,
                    webhook.headers or {}, webhook.timeout_sec, log_entry.tenant_id, _active_previous_secret(webhook),
                ),
                daemon=True,
            )
            asyncio_thread.start()
    finally:
        db.close()
