"""Delivery abstraction for scheduled reports.

Real email delivery (SMTP or an email provider API) is deliberately not wired
up in this change: the service ships a logging delivery so run history is
truthful about what happened ("email delivery is not configured"), and tests
use the recording stub below. Swapping in a real transport later only means
implementing ``ReportDelivery.send_report``/``send_alert``.
"""
import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("audit-compliance-service")


@dataclass
class DeliveryResult:
    status: str
    detail: Optional[str] = None


@dataclass
class ReportAttachment:
    filename: str
    content: str
    content_type: str = "text/csv"
    metadata: dict[str, Any] = field(default_factory=dict)


class ReportDelivery:
    """Transport interface for report distribution."""

    name = "base"

    def send_report(self, definition, run, attachment: ReportAttachment) -> DeliveryResult:
        raise NotImplementedError

    def send_alert(self, definition, run, message: str) -> DeliveryResult:
        raise NotImplementedError


class RecordingDelivery(ReportDelivery):
    """In-memory stub used by tests to assert what would have been sent."""

    name = "recording"

    def __init__(self):
        self.reports: list[dict] = []
        self.alerts: list[dict] = []

    def send_report(self, definition, run, attachment: ReportAttachment) -> DeliveryResult:
        self.reports.append({
            "definition_id": str(definition.id),
            "definition_name": definition.name,
            "run_id": str(run.id),
            "recipients": list(definition.recipients or []),
            "filename": attachment.filename,
            "content": attachment.content,
            "content_type": attachment.content_type,
            "metadata": dict(attachment.metadata),
        })
        return DeliveryResult(
            status="DELIVERED",
            detail=f"recorded for {len(definition.recipients or [])} recipient(s)",
        )

    def send_alert(self, definition, run, message: str) -> DeliveryResult:
        self.alerts.append({
            "definition_id": str(definition.id),
            "run_id": str(run.id),
            "recipients": list(definition.recipients or []),
            "message": message,
        })
        return DeliveryResult(status="DELIVERED", detail="recorded alert")

    def clear(self):
        self.reports.clear()
        self.alerts.clear()


class LoggingDelivery(ReportDelivery):
    """Default transport: records the attempt, no external email yet."""

    name = "logging"

    def send_report(self, definition, run, attachment: ReportAttachment) -> DeliveryResult:
        logger.info(
            "report.delivery_not_configured",
            extra={
                "definition_id": str(definition.id),
                "run_id": str(run.id),
                "recipients": len(definition.recipients or []),
                "filename": attachment.filename,
                "bytes": len(attachment.content),
            },
        )
        return DeliveryResult(
            status="NOT_CONFIGURED",
            detail="Email transport is not configured; report stored with the run record only.",
        )

    def send_alert(self, definition, run, message: str) -> DeliveryResult:
        logger.warning(
            "report.alert_not_configured",
            extra={"definition_id": str(definition.id), "run_id": str(run.id), "message": message},
        )
        return DeliveryResult(
            status="NOT_CONFIGURED",
            detail="Email transport is not configured; alert is visible in run history.",
        )


_default_delivery: ReportDelivery = LoggingDelivery()
_delivery_lock = threading.Lock()


def get_delivery() -> ReportDelivery:
    with _delivery_lock:
        return _default_delivery


def set_delivery(delivery: ReportDelivery) -> None:
    global _default_delivery
    with _delivery_lock:
        _default_delivery = delivery
