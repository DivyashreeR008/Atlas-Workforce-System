"""Replay the notifications DLQ back onto the live exchange (#479).

Poison messages landed here after the integration-service RabbitMQ consumer
exhausted its retry budget. Once the underlying defect is fixed, this tool
moves each quarantined message back onto ``notifications_exchange``: payload
unchanged, original ``event_id`` intact, so consumer-side idempotency drops
any duplicate from a partially-applied first attempt.

Usage (run where RABBITMQ_URL / credentials are configured):

    python scripts/replay_notifications_dlq.py
    python scripts/replay_notifications_dlq.py --dry-run
    python scripts/replay_notifications_dlq.py amqp://user:pass@rabbitmq:5672/

The RabbitMQ consumer must NOT be running during replay: stop the
integration-service first, replay, then restart it. Delivery is
at-least-once - a crash between publish and ack re-delivers the DLQ entry
and the consumer-side ledger drops the duplicate.
"""

import argparse
import os
import sys

import pika

DLQ_EXCHANGE = "notifications_dlx"
DLQ_QUEUE = "notifications_dlq"
LIVE_EXCHANGE = "notifications_exchange"


def _amqp_url(override: str | None) -> str:
    url = override or os.environ.get("RABBITMQ_URL", "")
    if not url:
        raise SystemExit("RABBITMQ_URL is not set and no amqp:// URL was given")
    return url


def replay(amqp_url: str, dry_run: bool) -> int:
    connection = pika.BlockingConnection(pika.URLParameters(amqp_url))
    channel = connection.channel()

    # Declare the DLQ/exchange exactly as the consumer does; a durable/no-PVC
    # disagreement surfaces here instead of silently replaying the wrong queue.
    channel.exchange_declare(exchange=DLQ_EXCHANGE, exchange_type="fanout", durable=True)
    depth = channel.queue_declare(queue=DLQ_QUEUE, durable=True).method.message_count
    if depth == 0:
        print(f"{DLQ_QUEUE} is empty - nothing to replay.")
        connection.close()
        return 0
    if dry_run:
        print(f"{DLQ_QUEUE} holds {depth} quarantined message(s) (dry run, not replayed).")
        connection.close()
        return 0

    replayed = 0
    while True:
        method, properties, body = channel.basic_get(DLQ_QUEUE, auto_ack=False)
        if method is None:
            break
        channel.basic_publish(
            exchange=LIVE_EXCHANGE,
            routing_key="",
            body=body,
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type=properties.content_type,
                headers=dict(properties.headers or {}),
            ),
        )
        # Ack only after the publish was accepted; a crash in between leaves
        # the DLQ entry for the next run.
        channel.basic_ack(method.delivery_tag)
        replayed += 1
    connection.close()
    print(f"Replayed {replayed} message(s) from {DLQ_QUEUE} onto {LIVE_EXCHANGE}.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay quarantined notifications back onto the live exchange.")
    parser.add_argument("amqp_url", nargs="?", default=None, help="amqp:// URL; defaults to RABBITMQ_URL")
    parser.add_argument("--dry-run", action="store_true", help="report the DLQ depth without replaying")
    args = parser.parse_args()
    return replay(_amqp_url(args.amqp_url), args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
