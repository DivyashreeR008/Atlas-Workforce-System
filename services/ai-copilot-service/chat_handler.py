import logging
from typing import Optional

from models import SessionStore
from ai_engine import generate_chat_reply

logger = logging.getLogger(__name__)


async def handle_chat_message(
    message: str,
    session_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    department: Optional[str] = None,
) -> dict:
    session = SessionStore.get_or_create(session_id)
    session.add_message("user", message)

    history = session.get_history(limit=30)

    reply, actions = await generate_chat_reply(
        message=message,
        history=history,
        employee_id=employee_id,
        department=department,
    )

    session.add_message("assistant", reply)

    return {
        "reply": reply,
        "suggested_actions": actions,
        "session_id": session.session_id,
    }
