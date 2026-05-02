from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import LeadStatus


class Lead(Base):
    __tablename__ = 'leads'
    __table_args__ = (
        Index('uq_leads_active_user_id', 'user_id', unique=True, postgresql_where=text("lead_status = 'active'")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True, nullable=False)

    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    venue_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    venue_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    wedding_date_exact: Mapped[date | None] = mapped_column(Date, nullable=True)
    wedding_date_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    season: Mapped[str | None] = mapped_column(String(50), nullable=True)
    next_year_flag: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    guests_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    lead_status: Mapped[LeadStatus | None] = mapped_column(
        Enum(
            LeadStatus,
            native_enum=False,
            length=50,
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=True,
    )

    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    utm_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(255), nullable=True)
    partner_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped['User'] = relationship('User', back_populates='leads')
    expenses: Mapped[list['Expense']] = relationship('Expense', back_populates='lead', cascade='all, delete-orphan')
    events: Mapped[list['LeadEvent']] = relationship('LeadEvent', back_populates='lead', cascade='all, delete-orphan')
    client_orders: Mapped[list['ClientOrder']] = relationship('ClientOrder', back_populates='lead')
    scheduled_messages: Mapped[list['ScheduledMessage']] = relationship(
        'ScheduledMessage', back_populates='lead', cascade='all, delete-orphan'
    )
    admin_notifications: Mapped[list['AdminNotification']] = relationship(
        'AdminNotification', back_populates='lead', cascade='all, delete-orphan'
    )
