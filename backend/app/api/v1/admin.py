from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_admin_access
from app.core.database import get_db
from app.schemas.admin import (
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
