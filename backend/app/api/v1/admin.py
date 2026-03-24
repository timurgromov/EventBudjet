from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_admin_access
from app.core.database import get_db
from app.schemas.admin import (
    AdminLeadActionResponse,
    AdminDirectMessageRequest,
    AdminDirectMessageResponse,
    AdminLeadDetailResponse,
    AdminLeadEventsResponse,
    AdminLeadListResponse,
    AdminNotificationsResponse,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix='/admin', tags=['admin'], dependencies=[Depends(require_admin_access)])


@router.get('/leads', response_model=AdminLeadListResponse)
def list_admin_leads(db: Session = Depends(get_db)) -> AdminLeadListResponse:
    return AdminService(db).list_leads()


@router.get('/leads/{lead_id}', response_model=AdminLeadDetailResponse)
def get_admin_lead(lead_id: int, db: Session = Depends(get_db)) -> AdminLeadDetailResponse:
    result = AdminService(db).get_lead_detail(lead_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')
    return result


@router.get('/leads/{lead_id}/events', response_model=AdminLeadEventsResponse)
def get_admin_lead_events(lead_id: int, db: Session = Depends(get_db)) -> AdminLeadEventsResponse:
    result = AdminService(db).get_lead_events(lead_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')
    return result


@router.get('/notifications', response_model=AdminNotificationsResponse)
def list_admin_notifications(db: Session = Depends(get_db)) -> AdminNotificationsResponse:
    return AdminService(db).list_notifications()


@router.post('/leads/{lead_id}/send-message', response_model=AdminDirectMessageResponse)
def send_admin_message_to_lead(
    lead_id: int,
    payload: AdminDirectMessageRequest,
    db: Session = Depends(get_db),
) -> AdminDirectMessageResponse:
    if not payload.text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Message text must not be empty')

    result = AdminService(db).send_direct_message(lead_id=lead_id, text=payload.text.strip())
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')
    return result


@router.post('/leads/{lead_id}/reset', response_model=AdminLeadActionResponse)
def reset_admin_lead(
    lead_id: int,
    db: Session = Depends(get_db),
) -> AdminLeadActionResponse:
    result = AdminService(db).reset_lead(lead_id=lead_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')
    return result


@router.delete('/leads/{lead_id}', response_model=AdminLeadActionResponse)
def delete_admin_lead(
    lead_id: int,
    db: Session = Depends(get_db),
) -> AdminLeadActionResponse:
    result = AdminService(db).delete_lead(lead_id=lead_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Lead not found')
    return result
