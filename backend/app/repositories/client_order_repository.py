from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.client_order import ClientOrder
from app.models.client_order_item import ClientOrderItem


class ClientOrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_orders(self, date_from: date | None = None, date_to: date | None = None) -> list[ClientOrder]:
        stmt = (
            select(ClientOrder)
            .options(selectinload(ClientOrder.items))
            .order_by(ClientOrder.contract_date.desc().nullslast(), ClientOrder.updated_at.desc(), ClientOrder.id.desc())
        )
        if date_from is not None:
            stmt = stmt.where(ClientOrder.contract_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(ClientOrder.contract_date <= date_to)
        return list(self.db.execute(stmt).scalars().all())

    def get_order(self, order_id: int) -> ClientOrder | None:
        stmt = (
            select(ClientOrder)
            .options(selectinload(ClientOrder.items))
            .where(ClientOrder.id == order_id)
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def create_order(self, data: dict) -> ClientOrder:
        order = ClientOrder(**data)
        self.db.add(order)
        self.db.flush()
        return order

    def update_order(self, order: ClientOrder, data: dict) -> ClientOrder:
        for field, value in data.items():
            setattr(order, field, value)
        self.db.flush()
        return order

    def delete_order(self, order: ClientOrder) -> None:
        self.db.delete(order)
        self.db.flush()

    def create_item(self, order_id: int, data: dict) -> ClientOrderItem:
        item = ClientOrderItem(order_id=order_id, **data)
        self.db.add(item)
        self.db.flush()
        return item

    def get_item(self, order_id: int, item_id: int) -> ClientOrderItem | None:
        stmt = (
            select(ClientOrderItem)
            .where(ClientOrderItem.order_id == order_id, ClientOrderItem.id == item_id)
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def update_item(self, item: ClientOrderItem, data: dict) -> ClientOrderItem:
        for field, value in data.items():
            setattr(item, field, value)
        self.db.flush()
        return item

    def delete_item(self, item: ClientOrderItem) -> None:
        self.db.delete(item)
        self.db.flush()

    def get_next_position(self, order_id: int) -> int:
        stmt = select(func.max(ClientOrderItem.position)).where(ClientOrderItem.order_id == order_id)
        current = self.db.execute(stmt).scalar_one()
        return int(current or 0) + 1
