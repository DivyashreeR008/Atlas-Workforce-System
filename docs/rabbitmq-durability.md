# RabbitMQ durability (payroll event path)

The payroll outbox publishes `PAYROLL_PROCESSED`, `PAYROLL_FAILED`, and
`PAYROLL_COMPENSATED` events over `payroll.exchange`. Streams are now
configured for at-least-once, broker-acknowledged delivery instead of best
effort; idempotency at the consumer boundary is handled separately (#479).

## Topology as code

Declared in `services/payroll-java-service/.../config/RabbitMQConfig.java`:

- `payroll.exchange` - durable topic exchange.
- `payroll.processed.queue`, `payroll.compensation.queue` - **quorum** queues
  (`x-queue-type=quorum`), so events survive broker restarts and node loss.
- `payroll.dlq` - durable quarantine queue, bound to
  `payroll.dlq.*` so it catches both the outbox's explicit `payroll.dlq.*`
  publishes and dead-lettered deliveries.
- Both critical queues carry `x-dead-letter-exchange=payroll.exchange` and
  `x-dead-letter-routing-key=payroll.dlq.rejected`.

## Delivery contract (at-least-once)

- The outbox publisher uses **publisher confirms**; an event is only marked
  `SENT` after `waitForConfirmsOrDie` returns. An unconfirmed publish or a
  nack raises and flows into the outbox's existing retry/backoff loop, so a
  publish is never silently dropped.
- Publishes are **mandatory**: an unroutable routing key is reported through
  the returns callback instead of vanishing.

## Poison messages

The listener container factory retries a failing delivery up to
`payroll.listener.max-attempts` (default 3) with exponential backoff, then
republishes the message to `payroll.dlq` with `payroll.dlq.rejected` plus
diagnostic headers (original payload, failure history). Requeue is disabled,
so the broker can never churn forever on an unprocessable event.

## Runbook

- **Broker down mid-traffic:** unconsumed quorum-queue messages survive the
  outage; the outbox keeps its rows `PENDING` and re-publishes. Acknowledged-
  loss recovery for in-flight publisher confirms is bounded by the 10s confirm
  wait; an event that cannot be confirmed is retried, and after
  `outbox.max.retries` attempts lands in the outbox `FAILED` path (also
  forwarded to the DLQ).
- **Kill test:** verify `rabbitmqctl list_queues messages_ready` counts before
  and after a broker restart match; no unacknowledged delivery is lost.
- **Poison test:** publish an event whose handler throws repeatedly; after
  `max-attempts` (3) deliveries it must appear in `payroll.dlq` with
  `x-death` context and stop being redelivered.
- **DLQ depth alerting:** the RabbitMQ Prometheus exporter is not yet part of
  `docker-compose.monitoring.yml`; monitor `payroll.dlq` via the management
  plugin (management UI) as the interim warning path. Adding
  `rabbitmq-prometheus` + a `PayrollDlqBacklog` alert rule is the follow-up
  this slice leaves open.

## Scope and follow-ups

This slice covers the payroll outbox path (highest-value stream). Notification
fan-out (`live_exchange`, `notifications_exchange` in the live/notification
services) still runs on durable classic exchanges: quorum conversion,
confirms, and DLX wiring there are coordinated follow-ups, as is the
idempotency work in the integration-service consumers so redelivery of
at-least-once events stays safe.
