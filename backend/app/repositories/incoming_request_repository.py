from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.incoming_request import IncomingRequest
from app.models.incoming_request_source import IncomingRequestSource


class IncomingRequestRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_requests(self) -> list[IncomingRequest]:
        stmt = select(IncomingRequest).order_by(
            IncomingRequest.source_id.asc().nullslast(),
            IncomingRequest.event_date.asc().nullslast(),
            IncomingRequest.updated_at.desc(),
            IncomingRequest.id.desc(),
        ).options(selectinload(IncomingRequest.source_ref))
        return list(self.db.execute(stmt).scalars().all())

    def get_request(self, request_id: int) -> IncomingRequest | None:
        stmt = select(IncomingRequest).where(IncomingRequest.id == request_id).options(selectinload(IncomingRequest.source_ref)).limit(1)
        return self.db.execute(stmt).scalar_one_or_none()

    def create_request(self, data: dict) -> IncomingRequest:
        request = IncomingRequest(**data)
        self.db.add(request)
        self.db.flush()
        return request

    def update_request(self, request: IncomingRequest, data: dict) -> IncomingRequest:
        for field, value in data.items():
            setattr(request, field, value)
        self.db.flush()
        return request

    def delete_request(self, request: IncomingRequest) -> None:
        self.db.delete(request)
        self.db.flush()

    def list_sources(self) -> list[tuple[IncomingRequestSource, int]]:
        stmt = (
            select(IncomingRequestSource, func.count(IncomingRequest.id))
            .outerjoin(IncomingRequest, IncomingRequest.source_id == IncomingRequestSource.id)
            .group_by(IncomingRequestSource.id)
            .order_by(IncomingRequestSource.is_archived.asc(), IncomingRequestSource.name.asc())
        )
        return list(self.db.execute(stmt).all())

    def get_source(self, source_id: int) -> IncomingRequestSource | None:
        stmt = select(IncomingRequestSource).where(IncomingRequestSource.id == source_id).limit(1)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_source_by_name(self, name: str) -> IncomingRequestSource | None:
        stmt = select(IncomingRequestSource).where(func.lower(IncomingRequestSource.name) == name.lower()).limit(1)
        return self.db.execute(stmt).scalar_one_or_none()

    def create_source(self, data: dict) -> IncomingRequestSource:
        source = IncomingRequestSource(**data)
        self.db.add(source)
        self.db.flush()
        return source
