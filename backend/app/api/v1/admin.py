from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_admin_access
from app.core.database import get_db
from app.schemas.admin import (
    AdminLeadSourceActionResponse,
    AdminLeadActionResponse,
    AdminDirectMessageRequest,
    AdminDirectMessageResponse,
    AdminLeadDetailResponse,
    AdminLeadEventsResponse,
    AdminLeadListResponse,
    AdminLeadSourceCreateRequest,
    AdminLeadSourceRead,
    AdminLeadSourcesResponse,
    AdminNotificationsResponse,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix='/admin', tags=['admin'], dependencies=[Depends(require_admin_access)])


@router.get('/leads', response_model=AdminLeadListResponse)
def list_admin_leads(db: Session = Depends(get_db)) -> AdminLeadListResponse:
    return AdminService(db).list_leads()


@router.get('/sources', response_model=AdminLeadSourcesResponse)
def list_admin_sources(db: Session = Depends(get_db)) -> AdminLeadSourcesResponse:
    return AdminService(db).list_sources()


@router.post('/sources', response_model=AdminLeadSourceRead)
def create_admin_source(
    payload: AdminLeadSourceCreateRequest,
    db: Session = Depends(get_db),
) -> AdminLeadSourceRead:
    try:
        return AdminService(db).create_source(name=payload.name, code=payload.code, description=payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post('/sources/{source_id}/archive', response_model=AdminLeadSourceActionResponse)
def archive_admin_source(source_id: int, db: Session = Depends(get_db)) -> AdminLeadSourceActionResponse:
    result = AdminService(db).archive_source(source_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Source not found')
    return result


@router.post('/sources/{source_id}/restore', response_model=AdminLeadSourceActionResponse)
def restore_admin_source(source_id: int, db: Session = Depends(get_db)) -> AdminLeadSourceActionResponse:
    result = AdminService(db).restore_source(source_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Source not found')
    return result


@router.delete('/sources/{source_id}', response_model=AdminLeadSourceActionResponse)
def delete_admin_source(source_id: int, db: Session = Depends(get_db)) -> AdminLeadSourceActionResponse:
    try:
        result = AdminService(db).delete_source(source_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Source not found')
    return result


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


@router.post('/leads/{lead_id}/mark-chat-read', response_model=AdminLeadActionResponse)
def mark_admin_lead_chat_read(
    lead_id: int,
    db: Session = Depends(get_db),
) -> AdminLeadActionResponse:
    result = AdminService(db).mark_chat_read(lead_id)
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
