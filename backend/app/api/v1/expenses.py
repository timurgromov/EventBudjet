from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.services.expense_service import ExpenseService
from app.services.lead_service import LeadService

router = APIRouter(prefix='/lead/expenses', tags=['expenses'])


@router.get('', response_model=list[ExpenseRead])
def list_expenses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ExpenseRead]:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        return []
    expenses = ExpenseService(db).list_expenses(lead)
    return [ExpenseRead.model_validate(expense) for expense in expenses]


@router.post('', response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseRead:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')

    expense = ExpenseService(db).create_expense(lead, payload)
    return ExpenseRead.model_validate(expense)


@router.patch('/{expense_id}', response_model=ExpenseRead)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseRead:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')

    expense = ExpenseService(db).update_expense(lead, expense_id, payload)
    return ExpenseRead.model_validate(expense)


@router.delete('/{expense_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    lead = LeadService(db).get_user_lead(current_user.id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')

    ExpenseService(db).delete_expense(lead, expense_id)
