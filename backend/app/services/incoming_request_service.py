from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import IncomingRequestStatus
from app.models.incoming_request import IncomingRequest
from app.repositories.incoming_request_repository import IncomingRequestRepository
from app.schemas.incoming_request import (
    IncomingRequestCreate,
    IncomingRequestListResponse,
    IncomingRequestRead,
    IncomingRequestUpdate,
)


FOLLOW_UP_INTERVAL_DAYS = 4


class IncomingRequestService:
    def __init__(self, db: Session):
        self.db = db
        self.requests = IncomingRequestRepository(db)

    def list_requests(self) -> IncomingRequestListResponse:
        requests = self.requests.list_requests()
        return IncomingRequestListResponse(requests=[self._serialize_request(request) for request in requests])

    def create_request(self, payload: IncomingRequestCreate) -> IncomingRequestRead:
        data = payload.model_dump(exclude_none=True)
        data['source'] = payload.source.strip()
        data['status'] = self._normalize_status(data.get('status'))
        if not data['source']:
            raise ValueError('Source must not be empty')
        request = self.requests.create_request(data)
        self.db.commit()
        self.db.refresh(request)
        return self._serialize_request(request)

    def update_request(self, request_id: int, payload: IncomingRequestUpdate) -> IncomingRequestRead | None:
        request = self.requests.get_request(request_id)
        if request is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        if 'source' in data and data['source'] is not None:
            data['source'] = data['source'].strip()
            if not data['source']:
                raise ValueError('Source must not be empty')
        if 'status' in data:
            data['status'] = self._normalize_status(data.get('status'))
        self.requests.update_request(request, data)
        self.db.commit()
        self.db.refresh(request)
        return self._serialize_request(request)

    def delete_request(self, request_id: int) -> bool:
        request = self.requests.get_request(request_id)
        if request is None:
            return False
        self.requests.delete_request(request)
        self.db.commit()
        return True

    def _serialize_request(self, request: IncomingRequest) -> IncomingRequestRead:
        return IncomingRequestRead(
            id=request.id,
            source=request.source,
            event_date=request.event_date,
            last_contact_date=request.last_contact_date,
            comment=request.comment,
            status=request.status.value,
            created_at=request.created_at,
            updated_at=request.updated_at,
            needs_follow_up=self._needs_follow_up(request),
        )

    @staticmethod
    def _normalize_status(value: str | IncomingRequestStatus | None) -> IncomingRequestStatus:
        if isinstance(value, IncomingRequestStatus):
            return value
        normalized = (value or '').strip().lower()
        for status in IncomingRequestStatus:
            if status.value == normalized:
                return status
        return IncomingRequestStatus.IN_WORK

    @staticmethod
    def _needs_follow_up(request: IncomingRequest) -> bool:
        if request.status != IncomingRequestStatus.IN_WORK or request.last_contact_date is None:
            return False
        return (date.today() - request.last_contact_date).days >= FOLLOW_UP_INTERVAL_DAYS
