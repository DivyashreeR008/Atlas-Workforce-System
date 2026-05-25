from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["recruitment-chatbot"])


@router.post("/chatbot/sessions", response_model=schemas.ChatbotSessionResponse,
             status_code=201, summary="Create chatbot session")
def create_session(
    data: schemas.ChatbotSessionCreate = schemas.ChatbotSessionCreate(),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.create_chatbot_session(db, x_tenant_id, data)


@router.get("/chatbot/sessions/{session_id}",
            response_model=schemas.ChatbotSessionResponse,
            summary="Get chatbot session with messages")
def get_session(
    session_id: str,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    session = crud.get_chatbot_session(db, session_id, x_tenant_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/chatbot/sessions/{session_id}/messages",
             response_model=schemas.ChatbotMessageResponse,
             summary="Send message and get reply")
def send_message(
    session_id: str,
    data: schemas.ChatbotMessageCreate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    result = crud.send_chatbot_message(db, session_id, x_tenant_id, data.content)
    if not result:
        raise HTTPException(status_code=400, detail="Session not found or closed")
    return result


@router.delete("/chatbot/sessions/{session_id}", summary="Close chatbot session")
def close_session(
    session_id: str,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    session = crud.close_chatbot_session(db, session_id, x_tenant_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session closed"}


@router.post("/chatbot/intent", response_model=schemas.ChatbotIntentResponse, summary="Detect intent without session")
def detect_intent(content: str = ...):
    intent = crud.detect_intent(content)
    reply = crud.INTENT_RESPONSES.get(intent, crud.INTENT_RESPONSES["unknown"])
    return {"intent": intent, "confidence": 0.85, "reply": reply}
