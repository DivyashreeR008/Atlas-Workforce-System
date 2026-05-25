import uuid
import time
from datetime import datetime, timezone
from typing import Optional
from schemas import ChatMessage


class ChatSession:
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.messages: list[ChatMessage] = []
        self.created_at: float = time.time()
        self.last_activity: float = time.time()

    def add_message(self, role: str, content: str) -> None:
        self.messages.append(
            ChatMessage(
                role=role,
                content=content,
                timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            )
        )
        self.last_activity = time.time()

    def get_history(self, limit: int = 50) -> list[dict]:
        msgs = self.messages[-limit:] if len(self.messages) > limit else self.messages
        return [{"role": m.role, "content": m.content} for m in msgs]

    def clear(self) -> None:
        self.messages.clear()


class SessionStore:
    _sessions: dict[str, ChatSession] = {}
    _ttl_seconds: int = 3600

    @classmethod
    def get_or_create(cls, session_id: Optional[str] = None) -> ChatSession:
        if session_id and session_id in cls._sessions:
            session = cls._sessions[session_id]
            if time.time() - session.last_activity < cls._ttl_seconds:
                return session
            else:
                del cls._sessions[session_id]
        session = ChatSession(session_id)
        cls._sessions[session.session_id] = session
        return session

    @classmethod
    def get(cls, session_id: str) -> Optional[ChatSession]:
        session = cls._sessions.get(session_id)
        if session and time.time() - session.last_activity < cls._ttl_seconds:
            return session
        if session:
            del cls._sessions[session_id]
        return None

    @classmethod
    def delete(cls, session_id: str) -> bool:
        return bool(cls._sessions.pop(session_id, None))

    @classmethod
    def cleanup_expired(cls) -> int:
        now = time.time()
        expired = [
            sid
            for sid, sess in cls._sessions.items()
            if now - sess.last_activity >= cls._ttl_seconds
        ]
        for sid in expired:
            del cls._sessions[sid]
        return len(expired)

    @classmethod
    def set_ttl(cls, ttl_minutes: int) -> None:
        cls._ttl_seconds = ttl_minutes * 60
