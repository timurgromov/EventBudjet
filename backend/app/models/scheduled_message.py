from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ScheduledMessageStatus


class ScheduledMessage(Base):
    __tablename__ = 'scheduled_messages'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    lead_id: Mapped[int] = mapped_column(ForeignKey('leads.id', ondelete='CASCADE'), nullable=False)
    message_code: Mapped[str] = mapped_column(String(100), nullable=False)
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    status: Mapped[ScheduledMessageStatus] = mapped_column(
        Enum(ScheduledMessageStatus, native_enum=False, length=50), nullable=False
    )
    retry_count: Mapped[int] = mapped_column(Integer, server_default='0', nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped['User'] = relationship('User', back_populates='scheduled_messages')
    lead: Mapped['Lead'] = relationship('Lead', back_populates='scheduled_messages')
