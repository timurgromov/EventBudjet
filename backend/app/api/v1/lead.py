from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.lead import LeadCreate, LeadRead, LeadUpdate
from app.services.lead_service import LeadService
from app.core.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix='/lead', tags=['lead'])


@router.get('', response_model=LeadRead)
def get_lead(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> LeadRead:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')
    return LeadRead.model_validate(lead)


@router.post('', response_model=LeadRead)
def create_lead(
    payload: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeadRead:
    service = LeadService(db)
    existing = service.get_user_lead(current_user.id)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Lead already exists for this user')

    lead = service.create_user_lead(current_user.id, payload)
    return LeadRead.model_validate(lead)


@router.patch('', response_model=LeadRead)
def patch_lead(
    payload: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeadRead:
    service = LeadService(db)
    existing = service.get_user_lead(current_user.id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')

    lead = service.update_user_lead(existing, payload)
    return LeadRead.model_validate(lead)
