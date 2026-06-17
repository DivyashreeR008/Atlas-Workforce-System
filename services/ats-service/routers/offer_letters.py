from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from main import get_db
import crud
import schemas

router = APIRouter(tags=["offer-letters"])


@router.get("/offer-templates", response_model=schemas.PaginatedResponse[schemas.OfferTemplateResponse], summary="List offer templates")
def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.list_offer_templates(db, x_tenant_id, page, page_size)


@router.post("/offer-templates", response_model=schemas.OfferTemplateResponse,
             status_code=201, summary="Create offer template")
def create_template(
    data: schemas.OfferTemplateCreate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    return crud.create_offer_template(db, x_tenant_id, data)


@router.get("/offer-templates/{template_id}",
            response_model=schemas.OfferTemplateResponse,
            summary="Get offer template")
def get_template(
    template_id: str,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    template = crud.get_offer_template(db, template_id, x_tenant_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/offer-templates/{template_id}",
            response_model=schemas.OfferTemplateResponse,
            summary="Update offer template")
def update_template(
    template_id: str,
    data: schemas.OfferTemplateUpdate,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    template = crud.update_offer_template(db, template_id, x_tenant_id, data)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/offer-templates/{template_id}", summary="Delete offer template")
def delete_template(
    template_id: str,
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    if not crud.delete_offer_template(db, template_id, x_tenant_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}


@router.post("/offers/{offer_id}/generate",
             response_model=schemas.OfferGenerateResponse,
             summary="Generate offer letter")
def generate_offer(
    offer_id: str,
    data: schemas.OfferGenerateRequest = schemas.OfferGenerateRequest(offer_id="", template_id=""),
    x_tenant_id: str = Header("default", alias="X-Tenant-Id"),
    db: Session = Depends(get_db),
):
    result = crud.generate_offer_letter(
        db, x_tenant_id, offer_id,
        data.template_id or None,
        data.extra_vars,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Offer or template not found")
    return result
