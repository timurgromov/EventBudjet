from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import IncomingRequestStatus


class IncomingRequest(Base):
    __tablename__ = 'incoming_requests'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey('incoming_request_sources.id', ondelete='RESTRICT'), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_contact_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    meeting_held: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default='false')
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[IncomingRequestStatus] = mapped_column(
        Enum(
            IncomingRequestStatus,
            native_enum=False,
            length=50,
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
        default=IncomingRequestStatus.IN_WORK,
        server_default=IncomingRequestStatus.IN_WORK.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source_ref: Mapped['IncomingRequestSource | None'] = relationship('IncomingRequestSource', back_populates='requests')
