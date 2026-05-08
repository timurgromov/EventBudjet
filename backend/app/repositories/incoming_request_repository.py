from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.incoming_request import IncomingRequest


class IncomingRequestRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_requests(self) -> list[IncomingRequest]:
        stmt = select(IncomingRequest).order_by(
            IncomingRequest.event_date.asc().nullslast(),
            IncomingRequest.updated_at.desc(),
            IncomingRequest.id.desc(),
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_request(self, request_id: int) -> IncomingRequest | None:
        stmt = select(IncomingRequest).where(IncomingRequest.id == request_id).limit(1)
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
