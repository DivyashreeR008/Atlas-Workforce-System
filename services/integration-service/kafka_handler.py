import json
import logging
import os
import threading
from typing import Callable, Optional

from crud import discard_processed_event, register_processed_event

logger = logging.getLogger("kafka-handler")

KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
# A poison message is attempted this many times before it is quarantined on
# the topic's DLQ suffix with full context preserved.
_MAX_KAFKA_ATTEMPTS = 3

_producer = None
_producer_lock = threading.Lock()
_consumer_threads = []

# Redelivery observability (#479): duplicates observed and skipped by the
# deduplication ledger.
_duplicate_events_observed = 0
_duplicate_events_lock = threading.Lock()


def duplicate_events_observed() -> int:
    with _duplicate_events_lock:
        return _duplicate_events_observed


def _count_duplicate() -> None:
    global _duplicate_events_observed
    with _duplicate_events_lock:
        _duplicate_events_observed += 1


def _inbound_event_id(value) -> str:
    """The dedup ledger requires a usable event_id on every inbound event."""
    event_id = str((value or {}).get("event_id") or "").strip()
    return event_id if 0 < len(event_id) <= 200 else ""


def get_producer():
    global _producer
    if _producer is None:
        try:
            from confluent_kafka import Producer
            conf = {
                "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
                "client.id": "integration-service",
                "acks": "all",
                "retries": 3,
            }
            _producer = Producer(conf)
            logger.info("Kafka producer initialized")
        except ImportError:
            logger.warning("confluent-kafka not available, using mock producer")
            _producer = None
        except Exception as e:
            logger.error(f"Failed to create Kafka producer: {e}")
            _producer = None
    return _producer


def get_db_session():
    """DB session for the dedup ledger checks (bound to the app config)."""
    from main import SessionLocal

    return SessionLocal()


def _quarantine_poison(topic: str, value: dict, error: Exception) -> None:
    poison = dict(value or {})
    poison["dlq_error"] = f"{type(error).__name__}: {error}"[:2000]
    poison["dlq_topic"] = topic
    dlq_topic = f"{topic}.dlq"
    if publish_to_kafka(dlq_topic, key=None, value=poison):
        logger.error(
            "Kafka poison message quarantined on topic=%s error=%s",
            dlq_topic, poison["dlq_error"],
        )


def publish_to_kafka(topic: str, key: Optional[str], value: dict) -> bool:
    try:
        producer = get_producer()
        if producer is None:
            logger.info(f"[MOCK] Published to Kafka topic={topic} key={key}")
            return True

        producer.produce(
            topic=topic,
            key=key.encode("utf-8") if key else None,
            value=json.dumps(value, default=str).encode("utf-8"),
            callback=_delivery_report,
        )
        producer.poll(0)
        return True
    except Exception as e:
        logger.error(f"Failed to publish to Kafka topic={topic}: {e}")
        return False


def flush_producer(timeout: float = 5.0):
    producer = get_producer()
    if producer:
        producer.flush(timeout)


def _delivery_report(err, msg):
    if err:
        logger.error(f"Kafka delivery failed: {err}")
    else:
        logger.debug(f"Kafka delivered to {msg.topic()} [{msg.partition()}]")


def start_kafka_consumer(topic: str, group_id: str, callback: Callable[[str, dict], None]):
    def _consume():
        # Attempt counts are per-process: a consumer restart gives a poison
        # message a fresh budget. Documented in
        # docs/integration-event-idempotency.md.
        poison_attempts: dict[str, int] = {}
        try:
            from confluent_kafka import Consumer, KafkaException
            conf = {
                "bootstrap.servers": KAFKA_BOOTSTRAP_SERVERS,
                "group.id": group_id,
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
            }
            consumer = Consumer(conf)
            consumer.subscribe([topic])
            logger.info(f"Kafka consumer started for topic={topic}")

            while True:
                msg = consumer.poll(1.0)
                if msg is None:
                    continue
                if msg.error():
                    logger.error(f"Kafka consumer error: {msg.error()}")
                    continue
                event_id = ""
                value = None
                try:
                    key = msg.key().decode("utf-8") if msg.key() else None
                    value = json.loads(msg.value().decode("utf-8"))
                    event_id = _inbound_event_id(value)
                    if not event_id:
                        raise ValueError("inbound event is missing a usable event_id")
                    db = get_db_session()
                    try:
                        seen = register_processed_event(db, "kafka", event_id)
                    finally:
                        db.close()
                    if not seen:
                        _count_duplicate()
                        logger.info("Duplicate Kafka event skipped: event_id=%s topic=%s", event_id, topic)
                        continue
                    callback(key, value)
                except Exception as e:
                    # Idempotency boundary: processing may have partially
                    # applied before the failure, so release the claim and let
                    # broker redelivery retry; after the attempt budget the
                    # message is quarantined on the DLQ topic.
                    if event_id:
                        db = get_db_session()
                        try:
                            discard_processed_event(db, event_id)
                        finally:
                            db.close()
                    attempts = poison_attempts.get(event_id or "<missing>", 0) + 1
                    poison_attempts[event_id or "<missing>"] = attempts
                    logger.error("Error processing Kafka message (attempt %s): %s", attempts, e)
                    if attempts >= _MAX_KAFKA_QUARANTINE:
                        _quarantine_poison(topic, value, e)
                        poison_attempts.pop(event_id or "<missing>", None)
        except ImportError:
            logger.info(f"[MOCK] Kafka consumer for topic={topic} (confluent-kafka not available)")
        except Exception as e:
            logger.error(f"Kafka consumer thread error: {e}")

    thread = threading.Thread(target=_consume, daemon=True)
    thread.start()
    _consumer_threads.append(thread)
    return thread
