import json
import logging
import os
import threading
from typing import Callable, Optional

logger = logging.getLogger("kafka-handler")

KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

_producer = None
_producer_lock = threading.Lock()
_consumer_threads = []


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
                try:
                    key = msg.key().decode("utf-8") if msg.key() else None
                    value = json.loads(msg.value().decode("utf-8"))
                    callback(key, value)
                except Exception as e:
                    logger.error(f"Error processing Kafka message: {e}")
        except ImportError:
            logger.info(f"[MOCK] Kafka consumer for topic={topic} (confluent-kafka not available)")
        except Exception as e:
            logger.error(f"Kafka consumer thread error: {e}")

    thread = threading.Thread(target=_consume, daemon=True)
    thread.start()
    _consumer_threads.append(thread)
    return thread
