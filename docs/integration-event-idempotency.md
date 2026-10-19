# Event consumer idempotency and dead-letter handling (#479)

The integration-service consumes `notifications_exchange` (RabbitMQ) and
Kafka topics; delivery is at-least-once, so redeliveries are expected.
Without idempotency a redelivery applies webhook fan-out or Kafka forwards a
second time. This is the reviewed guarantee and the operational procedure.

## event_id is required on inbound events

- The RabbitMQ consumer (`event_router._handle_rabbitmq_message`) parses
  `event_id` from the message body. A message without a usable `event_id`
  (missing, blank, or over 200 chars) is poison: it is not routed, and after
  one requeue it is rejected into the dead-letter path.
- The Kafka consumer (`kafka_handler.start_kafka_consumer`) requires the same
  field in the message value.
- `/api/v1/integration/events` stamps a fresh `event_id` on published
  payloads when the caller did not supply one, and returns it, so events the
  service itself originates are traceable downstream.

## Deduplication ledger

`integration_processed_events` (models.ProcessedEvent) is DB-backed with a
unique `event_id` primary key - the payroll-outbox pattern, not an
in-memory set that vanishes on restart.

- `crud.register_processed_event()` does a transactional check-then-insert;
  the unique constraint is the source of truth, so a redelivery racing the
  first consumer still loses on the INSERT.
- The RabbitMQ consumer claims the id *before* routing; on any processing
  failure the claim is released (`crud.discard_processed_event`) before
  requeueing, so the retry attempt is possible and honest.
- Duplicates seen and skipped increase the observable counter
  (`duplicate_events_observed()` in both consumer modules); drops are metered
  events, never silent.
- TTL: ledger entries expire after `PROCESSED_EVENT_TTL_DAYS` (7 days); the
  service's background loop sweeps expired rows every 15-minute cycle
  (`crud.gc_processed_events`), so the table stays bounded.

## Poison messages and the DLQ

- RabbitMQ: the consumer's temporary queue is declared with
  `x-dead-letter-exchange=notifications_dlx`; on a failed *redelivered* attempt
  the message is rejected, so it lands in the durable `notifications_dlq`
  quarantine with the full original delivery (payload, headers). The effective
  budget is two attempts (original + one requeue) because the consumer queue
  is temporary; that is honest about what survives a broker restart.
- Kafka: a poison message is retried `_MAX_KAFKA_ATTEMPTS` (3) times within
  the consumer process, then republished to `<topic>.dlq` with
  `dlq_error`/`dlq_topic` context headers. Attempt counts are per-process:
  a consumer restart rebudgets the message. The Kafka side cannot use a DLX,
  so this is the documented equivalent.

## Replay tool

`scripts/replay_notifications_dlq.py` drains `notifications_dlq` back onto
`notifications_exchange` (payload unchanged, original `event_id` intact, so
the ledger drops any duplicate from a partially applied first attempt).
Stop the integration-service before replaying; run with `--dry-run` to
report the DLQ depth first.

## Ordering

- Kafka: ordering is preserved per partition for the same key; DLQ
  quarantining and per-key `event_id` dedup preserve per-key order.
- RabbitMQ fan-out: ordering is explicitly **not guaranteed** across
  reconnect (the consumer's queue is rebuilt on each reconnect and messages
  published while disconnected are not replayed).

## Follow-ups

- DLQ depth alerting needs the RabbitMQ Prometheus exporter plus a
  `NotificationsDlqBacklog` alert rule; the management plugin is the interim
  surface.
- Kafka DLQ topic retention/monitoring policy is not configured here.
