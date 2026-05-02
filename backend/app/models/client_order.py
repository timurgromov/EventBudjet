from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ClientOrderStatus


class ClientOrder(Base):
    __tablename__ = 'client_orders'
    __table_args__ = (UniqueConstraint('order_code', name='uq_client_orders_order_code'),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey('leads.id', ondelete='SET NULL'), nullable=True, index=True)
    order_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[ClientOrderStatus] = mapped_column(
        Enum(
            ClientOrderStatus,
            native_enum=False,
            length=50,
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
        default=ClientOrderStatus.SIGNED,
        server_default=ClientOrderStatus.SIGNED.value,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    lead: Mapped['Lead | None'] = relationship('Lead', back_populates='client_orders')
    items: Mapped[list['ClientOrderItem']] = relationship(
        'ClientOrderItem',
        back_populates='order',
        cascade='all, delete-orphan',
        order_by='ClientOrderItem.position.asc(), ClientOrderItem.id.asc()',
    )
