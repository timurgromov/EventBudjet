from datetime import date

from sqlalchemy.orm import Session

from app.models.enums import IncomingRequestStatus
from app.models.incoming_request import IncomingRequest
from app.models.incoming_request_source import IncomingRequestSource
from app.repositories.incoming_request_repository import IncomingRequestRepository
from app.schemas.incoming_request import (
    IncomingRequestCreate,
    IncomingRequestListResponse,
    IncomingRequestRead,
    IncomingRequestSourceActionResponse,
    IncomingRequestSourceCreate,
    IncomingRequestSourceRead,
    IncomingRequestSourcesResponse,
    IncomingRequestSourceSummaryItem,
    IncomingRequestSummaryResponse,
    IncomingRequestUpdate,
)


FOLLOW_UP_INTERVAL_DAYS = 4


class IncomingRequestService:
    SOURCE_TYPES = {'partner', 'ads', 'webinar', 'personal', 'other'}

    def __init__(self, db: Session):
        self.db = db
        self.requests = IncomingRequestRepository(db)

    def list_requests(self) -> IncomingRequestListResponse:
        requests = self.requests.list_requests()
        return IncomingRequestListResponse(requests=[self._serialize_request(request) for request in requests])

    def list_sources(self) -> IncomingRequestSourcesResponse:
        requests = self.requests.list_requests()
        stats_by_source = self._build_source_stats(requests)
        rows = self.requests.list_sources()
        return IncomingRequestSourcesResponse(
            sources=[
                self._serialize_source(source, int(requests_count or 0), stats_by_source.get(source.id))
                for source, requests_count in rows
            ]
        )

    def create_source(self, payload: IncomingRequestSourceCreate) -> IncomingRequestSourceRead:
        name = payload.name.strip()
        if not name:
            raise ValueError('Source name must not be empty')
        if self.requests.get_source_by_name(name) is not None:
            raise ValueError('Source already exists')

        source = self.requests.create_source(
            {
                'name': name,
                'source_type': self._normalize_source_type(payload.source_type),
                'description': payload.description.strip() if isinstance(payload.description, str) and payload.description.strip() else None,
            }
        )
        self.db.commit()
        self.db.refresh(source)
        return self._serialize_source(source, requests_count=0, stats=None)

    def archive_source(self, source_id: int) -> IncomingRequestSourceActionResponse | None:
        source = self.requests.get_source(source_id)
        if source is None:
            return None
        source.is_archived = True
        self.db.commit()
        return IncomingRequestSourceActionResponse(source_id=source.id, status='archived')

    def restore_source(self, source_id: int) -> IncomingRequestSourceActionResponse | None:
        source = self.requests.get_source(source_id)
        if source is None:
            return None
        source.is_archived = False
        self.db.commit()
        return IncomingRequestSourceActionResponse(source_id=source.id, status='restored')

    def get_summary(self) -> IncomingRequestSummaryResponse:
        requests = self.requests.list_requests()
        total_count = len(requests)
        signed_count = sum(1 for request in requests if request.status == IncomingRequestStatus.SIGNED)
        rejected_count = sum(1 for request in requests if request.status == IncomingRequestStatus.REJECTED)
        in_work_count = sum(1 for request in requests if request.status == IncomingRequestStatus.IN_WORK)
        meeting_count = sum(1 for request in requests if request.meeting_held)
        attention_count = sum(1 for request in requests if self._needs_follow_up(request))
        stats_by_source = self._build_source_stats(requests)

        sources = sorted(
            stats_by_source.values(),
            key=lambda item: (-item.total_count, -item.signed_count, item.source_name.lower()),
        )

        return IncomingRequestSummaryResponse(
            total_count=total_count,
            signed_count=signed_count,
            rejected_count=rejected_count,
            in_work_count=in_work_count,
            attention_count=attention_count,
            meeting_count=meeting_count,
            conversion_rate=self._conversion_rate(signed_count, total_count),
            meeting_conversion_rate=self._conversion_rate(signed_count, meeting_count),
            sources=sources,
        )

    def create_request(self, payload: IncomingRequestCreate) -> IncomingRequestRead:
        data = payload.model_dump(exclude_none=True)
        source = self._resolve_source(data.get('source_id'), data.get('source'))
        data['source_id'] = source.id
        data['source'] = source.name
        data['status'] = self._normalize_status(data.get('status'))
        request = self.requests.create_request(data)
        self.db.commit()
        self.db.refresh(request)
        return self._serialize_request(request)

    def update_request(self, request_id: int, payload: IncomingRequestUpdate) -> IncomingRequestRead | None:
        request = self.requests.get_request(request_id)
        if request is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        if 'source_id' in data or 'source' in data:
            source = self._resolve_source(data.get('source_id'), data.get('source'))
            data['source_id'] = source.id
            data['source'] = source.name
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
        source_name = request.source_ref.name if request.source_ref is not None else request.source
        source_type = request.source_ref.source_type if request.source_ref is not None else None
        return IncomingRequestRead(
            id=request.id,
            source_id=request.source_id,
            source=request.source,
            source_name=source_name,
            source_type=source_type,
            event_date=request.event_date,
            last_contact_date=request.last_contact_date,
            meeting_held=bool(request.meeting_held),
            comment=request.comment,
            status=request.status.value,
            created_at=request.created_at,
            updated_at=request.updated_at,
            needs_follow_up=self._needs_follow_up(request),
        )

    def _serialize_source(
        self,
        source: IncomingRequestSource,
        requests_count: int,
        stats: IncomingRequestSourceSummaryItem | None,
    ) -> IncomingRequestSourceRead:
        signed_count = stats.signed_count if stats is not None else 0
        rejected_count = stats.rejected_count if stats is not None else 0
        in_work_count = stats.in_work_count if stats is not None else 0
        meeting_count = stats.meeting_count if stats is not None else 0
        return IncomingRequestSourceRead(
            id=source.id,
            name=source.name,
            source_type=source.source_type,
            description=source.description,
            is_archived=bool(source.is_archived),
            requests_count=requests_count,
            signed_count=signed_count,
            rejected_count=rejected_count,
            in_work_count=in_work_count,
            meeting_count=meeting_count,
            conversion_rate=self._conversion_rate(signed_count, requests_count),
            meeting_conversion_rate=self._conversion_rate(signed_count, meeting_count),
            created_at=source.created_at,
            updated_at=source.updated_at,
        )

    def _resolve_source(self, source_id: int | None, source_name: str | None) -> IncomingRequestSource:
        if source_id is not None:
            source = self.requests.get_source(source_id)
            if source is None:
                raise ValueError('Source not found')
            if source.is_archived:
                raise ValueError('Source is archived')
            return source

        name = (source_name or '').strip()
        if not name:
            raise ValueError('Source must not be empty')

        existing = self.requests.get_source_by_name(name)
        if existing is not None:
            if existing.is_archived:
                raise ValueError('Source is archived')
            return existing

        return self.requests.create_source({'name': name, 'source_type': 'other'})

    def _build_source_stats(self, requests: list[IncomingRequest]) -> dict[int | None, IncomingRequestSourceSummaryItem]:
        stats: dict[int | None, IncomingRequestSourceSummaryItem] = {}
        for request in requests:
            source_id = request.source_id
            source_name = request.source_ref.name if request.source_ref is not None else request.source
            source_type = request.source_ref.source_type if request.source_ref is not None else None

            current = stats.get(source_id)
            if current is None:
                current = IncomingRequestSourceSummaryItem(
                    source_id=source_id,
                    source_name=source_name,
                    source_type=source_type,
                    total_count=0,
                    signed_count=0,
                    rejected_count=0,
                    in_work_count=0,
                    meeting_count=0,
                    conversion_rate=0,
                    meeting_conversion_rate=0,
                )
                stats[source_id] = current

            current.total_count += 1
            if request.meeting_held:
                current.meeting_count += 1
            if request.status == IncomingRequestStatus.SIGNED:
                current.signed_count += 1
            elif request.status == IncomingRequestStatus.REJECTED:
                current.rejected_count += 1
            else:
                current.in_work_count += 1
            current.conversion_rate = self._conversion_rate(current.signed_count, current.total_count)
            current.meeting_conversion_rate = self._conversion_rate(current.signed_count, current.meeting_count)
        return stats

    @staticmethod
    def _normalize_status(value: str | IncomingRequestStatus | None) -> IncomingRequestStatus:
        if isinstance(value, IncomingRequestStatus):
            return value
        normalized = (value or '').strip().lower()
        for status in IncomingRequestStatus:
            if status.value == normalized:
                return status
        return IncomingRequestStatus.IN_WORK

    @classmethod
    def _normalize_source_type(cls, value: str | None) -> str:
        normalized = (value or 'other').strip().lower()
        return normalized if normalized in cls.SOURCE_TYPES else 'other'

    @staticmethod
    def _conversion_rate(signed_count: int, total_count: int) -> float:
        if total_count <= 0:
            return 0
        return round((signed_count / total_count) * 100, 1)

    @staticmethod
    def _needs_follow_up(request: IncomingRequest) -> bool:
        if request.status != IncomingRequestStatus.IN_WORK or request.last_contact_date is None:
            return False
        return (date.today() - request.last_contact_date).days >= FOLLOW_UP_INTERVAL_DAYS
