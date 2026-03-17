from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import NotificationStatus


class AdminNotification(Base):
    __tablename__ = 'admin_notifications'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey('leads.id', ondelete='CASCADE'), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(
            NotificationStatus,
            native_enum=False,
            length=50,
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lead: Mapped['Lead'] = relationship('Lead', back_populates='admin_notifications')
