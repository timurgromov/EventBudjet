from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.expense import ExpenseRead
from app.schemas.lead import LeadCalculateResponse, LeadCreate, LeadProgressResponse, LeadRead, LeadUpdate
from app.services.calculation_service import CalculationService
from app.services.event_service import EventService
from app.services.expense_service import ExpenseService
from app.services.lead_service import LeadService

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


@router.post('/calculate', response_model=LeadCalculateResponse)
def calculate_lead_budget(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeadCalculateResponse:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')

    total = CalculationService(db).calculate_and_store_total(lead)
    return LeadCalculateResponse(lead_id=lead.id, total_budget=total)


@router.get('/progress', response_model=LeadProgressResponse)
def get_lead_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeadProgressResponse:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        return LeadProgressResponse(lead=None, expenses=[], total_budget=None, lead_status=None)

    expenses = ExpenseService(db).list_expenses(lead)
    EventService(db).write_event(
        lead.id,
        'app_resumed',
        {
            'user_id': current_user.id,
            'expenses_count': len(expenses),
        },
    )
    db.commit()

    return LeadProgressResponse(
        lead=LeadRead.model_validate(lead),
        expenses=[ExpenseRead.model_validate(expense) for expense in expenses],
        total_budget=lead.total_budget,
        lead_status=lead.lead_status.value if lead.lead_status is not None else None,
    )
