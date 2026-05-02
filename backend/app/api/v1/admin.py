from datetime import date

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
from app.schemas.client_order import (
    ClientOrderCreate,
    ClientOrderDetailResponse,
    ClientOrderItemCreate,
    ClientOrderItemUpdate,
    ClientOrderListResponse,
    ClientOrderSummaryResponse,
    ClientOrderUpdate,
    MarginCalculatorOrderCreateRequest,
)
from app.services.admin_service import AdminService
from app.services.client_order_service import ClientOrderService

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


@router.get('/client-orders/summary', response_model=ClientOrderSummaryResponse)
def get_admin_client_orders_summary(
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
) -> ClientOrderSummaryResponse:
    return ClientOrderService(db).get_summary(
        date_from=_parse_optional_date(date_from),
        date_to=_parse_optional_date(date_to),
    )


@router.get('/client-orders', response_model=ClientOrderListResponse)
def list_admin_client_orders(
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
) -> ClientOrderListResponse:
    return ClientOrderService(db).list_orders(
        date_from=_parse_optional_date(date_from),
        date_to=_parse_optional_date(date_to),
    )


@router.post('/client-orders/from-margin-calculator', response_model=ClientOrderDetailResponse)
def create_client_order_from_margin_calculator(
    payload: MarginCalculatorOrderCreateRequest,
    db: Session = Depends(get_db),
) -> ClientOrderDetailResponse:
    return ClientOrderService(db).create_from_margin_calculator(payload)


@router.post('/client-orders', response_model=ClientOrderDetailResponse)
def create_admin_client_order(
    payload: ClientOrderCreate,
    db: Session = Depends(get_db),
) -> ClientOrderDetailResponse:
    return ClientOrderService(db).create_order(payload)


@router.get('/client-orders/{order_id}', response_model=ClientOrderDetailResponse)
def get_admin_client_order(order_id: int, db: Session = Depends(get_db)) -> ClientOrderDetailResponse:
    result = ClientOrderService(db).get_order_detail(order_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client order not found')
    return result


@router.patch('/client-orders/{order_id}', response_model=ClientOrderDetailResponse)
def update_admin_client_order(
    order_id: int,
    payload: ClientOrderUpdate,
    db: Session = Depends(get_db),
) -> ClientOrderDetailResponse:
    result = ClientOrderService(db).update_order(order_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client order not found')
    return result


@router.delete('/client-orders/{order_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_client_order(order_id: int, db: Session = Depends(get_db)) -> None:
    deleted = ClientOrderService(db).delete_order(order_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client order not found')


@router.post('/client-orders/{order_id}/items', response_model=ClientOrderDetailResponse)
def create_admin_client_order_item(
    order_id: int,
    payload: ClientOrderItemCreate,
    db: Session = Depends(get_db),
) -> ClientOrderDetailResponse:
    try:
        result = ClientOrderService(db).create_item(order_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client order not found')
    return result


@router.patch('/client-orders/{order_id}/items/{item_id}', response_model=ClientOrderDetailResponse)
def update_admin_client_order_item(
    order_id: int,
    item_id: int,
    payload: ClientOrderItemUpdate,
    db: Session = Depends(get_db),
) -> ClientOrderDetailResponse:
    result = ClientOrderService(db).update_item(order_id, item_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client order or item not found')
    return result


@router.delete('/client-orders/{order_id}/items/{item_id}', response_model=ClientOrderDetailResponse)
def delete_admin_client_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
) -> ClientOrderDetailResponse:
    result = ClientOrderService(db).delete_item(order_id, item_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client order or item not found')
    return result


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


def _parse_optional_date(value: str | None) -> date | None:
    if value is None or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Invalid date format') from exc
