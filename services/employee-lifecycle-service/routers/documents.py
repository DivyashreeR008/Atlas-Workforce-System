from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas
from file_security import validate_file, get_secure_path, MAX_FILE_SIZE

router = APIRouter(tags=["Employee Documents"])


@router.get("/lifecycle/documents/{employee_id}")
def list_documents(employee_id: str, category: Optional[str] = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    return crud.list_employee_documents(db, x_tenant_id, employee_id, category, page, page_size)

@router.post("/lifecycle/documents", status_code=201)
def create_document(payload: schemas.EmployeeDocumentCreate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if payload.file_url:
        import re
        if not re.match(r'^https?://', payload.file_url):
            raise HTTPException(status_code=400, detail="file_url must be a valid HTTP(S) URL")
    if payload.file_size_bytes and payload.file_size_bytes > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds maximum allowed size")
    return crud.create_employee_document(db, x_tenant_id, payload.model_dump())

@router.get("/lifecycle/documents/doc/{doc_id}")
def get_document(doc_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.get_employee_document(db, doc_id, x_tenant_id)
    if not result: raise HTTPException(404, detail="Document not found")
    return result

@router.put("/lifecycle/documents/doc/{doc_id}")
def update_document(doc_id: UUID, payload: schemas.EmployeeDocumentUpdate, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    result = crud.update_employee_document(db, doc_id, x_tenant_id, payload.model_dump(exclude_unset=True))
    if not result: raise HTTPException(404, detail="Document not found")
    return result

@router.delete("/lifecycle/documents/doc/{doc_id}")
def delete_document(doc_id: UUID, x_tenant_id: str = Header("default", alias="X-Tenant-Id"), db: Session = Depends(get_db)):
    if not crud.delete_employee_document(db, doc_id, x_tenant_id):
        raise HTTPException(404, detail="Document not found")
    return schemas.MessageResponse(message="Document deleted")
