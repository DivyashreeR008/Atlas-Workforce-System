"""Idempotency and DLQ tests for the integration event consumers (#479)."""
import unittest
from unittest.mock import MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import crud
import event_router
from models import Base


def _memory_session_factory():
    # Only the dedup ledger table is created: the rest of the schema is
    # PostgreSQL-specific (JSONB) and irrelevant to these consumer tests.
    engine = create_engine("sqlite:///:memory:")
    crud.ProcessedEvent.__table__.create(engine, checkfirst=True)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


class FakeChannel:
    def __init__(self):
        self.acked = 0
        self.nacked = []

    def basic_ack(self, delivery_tag):
        self.acked += 1

    def basic_nack(self, delivery_tag, requeue):
        self.nacked.append(requeue)


class FakeMethod:
    def __init__(self, redelivered=False, delivery_tag=1):
        self.redelivered = redelivered
        self.delivery_tag = delivery_tag


class RabbitConsumerDedupTests(unittest.TestCase):
    def setUp(self):
        self.session_factory = _memory_session_factory()
        event_router.set_db_session_factory(self.session_factory)

    def test_valid_event_is_claimed_and_routed(self):
        seen = []
        original_route = event_router.route_event
        event_router.route_event = lambda *a, **k: seen.append(a)
        try:
            channel = FakeChannel()
            body = b'{"event_id": "evt-1", "event_type": "test", "tenant_id": "t1"}'
            event_router._handle_rabbitmq_message(channel, FakeMethod(), None, body)
        finally:
            event_router.route_event = original_route
        self.assertEqual(channel.acked, 1)
        self.assertEqual(channel.nacked, [])
        self.assertEqual(seen, [("test", "t1", {"event_id": "evt-1", "event_type": "test", "tenant_id": "t1"})])

    def test_redelivered_event_is_skipped_as_duplicate(self):
        first = FakeChannel()
        second = FakeChannel()
        body = b'{"event_id": "evt-1", "event_type": "test", "tenant_id": "t1"}'
        original_route = event_router.route_event
        event_router.route_event = lambda *a, **k: None
        try:
            event_router._handle_rabbitmq_message(first, FakeMethod(), None, body)
            event_router._handle_rabbitmq_message(second, FakeMethod(redelivered=True, delivery_tag=2), None, body)
        finally:
            event_router.route_event = original_route
        self.assertEqual(second.acked, 1, "a duplicate must be satisfied with a plain ack")
        self.assertEqual(second.nacked, [])
        self.assertEqual(event_router.duplicate_events_observed(), 1)

    def test_missing_event_id_is_poison(self):
        channel = FakeChannel()
        original_route = event_router.route_event
        original_release = event_router._release_event
        event_router.route_event = lambda *a, **k: None
        event_router._release_event = lambda *a, **k: None
        try:
            event_router._handle_rabbitmq_message(channel, FakeMethod(), None, b'{"event_type": "test"}')
        finally:
            event_router.route_event = original_route
            event_router._release_event = original_release
        self.assertEqual(channel.acked, 0)
        self.assertEqual(channel.nacked, [True], "first poison attempt is retried once, not acked")

    def test_processing_failure_releases_the_claim(self):
        channel = FakeChannel()

        def failing_route(*a, **k):
            raise RuntimeError("boom")

        original_route = event_router.route_event
        event_router.route_event = failing_route
        try:
            event_router._handle_rabbitmq_message(
                channel, FakeMethod(), None, b'{"event_id": "evt-fail", "event_type": "t", "tenant_id": "t1"}')
        finally:
            event_router.route_event = original_route
        # First attempt: requeue (no DLX), ONLY after the claim was released.
        self.assertEqual(channel.nacked, [True])
        with self.session_factory() as db:
            self.assertIsNone(
                db.query(crud.ProcessedEvent).filter(crud.ProcessedEvent.event_id == "evt-fail").first(),
                "a failed event must not stay claimed, or its retry is dropped as duplicate",
            )

    def test_redelivered_failure_dead_letters_instead_of_looping(self):
        channel = FakeChannel()

        def failing_route(*a, **k):
            raise RuntimeError("boom")

        original_route = event_router.route_event
        event_router.route_event = failing_route
        try:
            # A redelivered failed attempt must reject (not requeue) so the
            # queue's DLX arguments quarantine the message.
            event_router._handle_rabbitmq_message(
                channel, FakeMethod(redelivered=True), None, b'{"event_id": "evt-poison"}')
        finally:
            event_router.route_event = original_route
        self.assertEqual(channel.nacked, [False])


class DedupLedgerTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        crud.ProcessedEvent.__table__.create(self.engine, checkfirst=True)
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()

    def test_register_is_idempotent(self):
        self.assertTrue(crud.register_processed_event(self.db, "rabbitmq", "evt-1"))
        self.assertFalse(crud.register_processed_event(self.db, "kafka", "evt-1"))
        with self.engine.connect() as conn:
            rows = list(conn.exec_driver_sql(
                "select event_id, consumer from integration_processed_events"))
        self.assertEqual(len(rows), 1)

    def test_register_rejects_unusable_ids(self):
        self.assertFalse(crud.register_processed_event(self.db, "rabbitmq", "   "))
        self.assertFalse(crud.register_processed_event(self.db, "rabbitmq", "x" * 201))
        self.assertFalse(crud.register_processed_event(self.db, "rabbitmq", None))

    def test_discard_enables_redelivery(self):
        crud.register_processed_event(self.db, "kafka", "evt-2")
        self.assertFalse(crud.register_processed_event(self.db, "kafka", "evt-2"))
        crud.discard_processed_event(self.db, "evt-2")
        self.assertTrue(crud.register_processed_event(self.db, "kafka", "evt-2"))

    def test_gc_removes_only_expired_entries(self):
        from datetime import datetime, timedelta, timezone
        crud.register_processed_event(self.db, "kafka", "evt-fresh")
        crud.register_processed_event(self.db, "kafka", "evt-expired")
        old = datetime.now(timezone.utc) - timedelta(days=8)
        with self.engine.begin() as conn:
            conn.exec_driver_sql(
                "update integration_processed_events set ttl_expires_at = ? where event_id = 'evt-expired'",
                (old,))
        removed = crud.gc_processed_events(self.db)
        self.assertEqual(removed, 1)
        with self.engine.connect() as conn:
            remaining = list(conn.exec_driver_sql("select event_id from integration_processed_events"))
        self.assertEqual([r[0] for r in remaining], ["evt-fresh"])


class KafkaInboundEventIdTests(unittest.TestCase):
    def test_extract_event_id(self):
        from kafka_handler import _inbound_event_id
        self.assertEqual(_inbound_event_id({"event_id": "evt-9"}), "evt-9")
        self.assertEqual(_inbound_event_id({"event_id": "  evt-9  "}), "evt-9")
        self.assertEqual(_inbound_event_id({"event_id": ""}), "")
        self.assertEqual(_inbound_event_id({}), "")
        self.assertEqual(_inbound_event_id({"event_id": "x" * 201}), "")
        self.assertEqual(_inbound_event_id(None), "")


if __name__ == "__main__":
    unittest.main()
