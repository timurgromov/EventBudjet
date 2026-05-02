from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.client_order import ClientOrder
from app.models.enums import ClientOrderItemType, ClientOrderStatus
from app.repositories.client_order_repository import ClientOrderRepository
from app.schemas.client_order import (
    ClientOrderCreate,
    ClientOrderDetailResponse,
    ClientOrderItemCreate,
    ClientOrderItemRead,
    ClientOrderItemUpdate,
    ClientOrderListResponse,
    ClientOrderRead,
    ClientOrderSummaryResponse,
    ClientOrderUpdate,
    MarginCalculatorOrderCreateRequest,
)


MARGIN_ALERT_THRESHOLD = Decimal('35')


class ClientOrderService:
    def __init__(self, db: Session):
        self.db = db
        self.orders = ClientOrderRepository(db)

    def list_orders(self, date_from: date | None = None, date_to: date | None = None) -> ClientOrderListResponse:
        orders = self.orders.list_orders(date_from=date_from, date_to=date_to)
        return ClientOrderListResponse(orders=[self._serialize_order(order) for order in orders])

    def get_order_detail(self, order_id: int) -> ClientOrderDetailResponse | None:
        order = self.orders.get_order(order_id)
        if order is None:
            return None
        return ClientOrderDetailResponse(
            order=self._serialize_order(order),
            items=[ClientOrderItemRead.model_validate(item) for item in order.items],
        )

    def create_order(self, payload: ClientOrderCreate) -> ClientOrderDetailResponse:
        data = payload.model_dump(exclude_none=True)
        data['status'] = self._normalize_status(data.get('status'))
        order = self.orders.create_order(data)
        order.order_code = self._build_order_code(order)
        self.db.commit()
        self.db.refresh(order)
        return self.get_order_detail(order.id)  # type: ignore[return-value]

    def update_order(self, order_id: int, payload: ClientOrderUpdate) -> ClientOrderDetailResponse | None:
        order = self.orders.get_order(order_id)
        if order is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        if 'status' in data:
            data['status'] = self._normalize_status(data.get('status'))
        self.orders.update_order(order, data)
        self.db.commit()
        self.db.refresh(order)
        return self.get_order_detail(order.id)

    def delete_order(self, order_id: int) -> bool:
        order = self.orders.get_order(order_id)
        if order is None:
            return False
        self.orders.delete_order(order)
        self.db.commit()
        return True

    def create_item(self, order_id: int, payload: ClientOrderItemCreate) -> ClientOrderDetailResponse | None:
        order = self.orders.get_order(order_id)
        if order is None:
            return None
        data = payload.model_dump(exclude_none=True)
        data['item_type'] = self._normalize_item_type(data.get('item_type'))
        data.setdefault('position', self.orders.get_next_position(order_id))
        self.orders.create_item(order_id, data)
        self.db.commit()
        return self.get_order_detail(order_id)

    def update_item(self, order_id: int, item_id: int, payload: ClientOrderItemUpdate) -> ClientOrderDetailResponse | None:
        order = self.orders.get_order(order_id)
        if order is None:
            return None
        item = self.orders.get_item(order_id, item_id)
        if item is None:
            return None
        data = payload.model_dump(exclude_unset=True)
        self.orders.update_item(item, data)
        self.db.commit()
        return self.get_order_detail(order_id)

    def delete_item(self, order_id: int, item_id: int) -> ClientOrderDetailResponse | None:
        order = self.orders.get_order(order_id)
        if order is None:
            return None
        item = self.orders.get_item(order_id, item_id)
        if item is None:
            return None
        self.orders.delete_item(item)
        self.db.commit()
        return self.get_order_detail(order_id)

    def get_summary(self, date_from: date | None = None, date_to: date | None = None) -> ClientOrderSummaryResponse:
        orders = self.orders.list_orders(date_from=date_from, date_to=date_to)

        orders_count = len(orders)
        total_revenue = Decimal('0')
        total_costs = Decimal('0')
        total_profit = Decimal('0')
        total_margin = Decimal('0')
        low_margin_orders_count = 0

        for order in orders:
            revenue, costs, profit, margin = self._calculate_financials(order)
            total_revenue += revenue
            total_costs += costs
            total_profit += profit
            total_margin += margin
            if revenue > 0 and margin < MARGIN_ALERT_THRESHOLD:
                low_margin_orders_count += 1

        average_margin = self._quantize(total_margin / orders_count) if orders_count else Decimal('0')
        average_profit_per_order = self._quantize(total_profit / orders_count) if orders_count else Decimal('0')

        return ClientOrderSummaryResponse(
            date_from=date_from,
            date_to=date_to,
            orders_count=orders_count,
            low_margin_orders_count=low_margin_orders_count,
            total_revenue=self._quantize(total_revenue),
            total_costs=self._quantize(total_costs),
            total_profit=self._quantize(total_profit),
            average_margin=average_margin,
            average_profit_per_order=average_profit_per_order,
        )

    def create_from_margin_calculator(self, payload: MarginCalculatorOrderCreateRequest) -> ClientOrderDetailResponse:
        order = self.orders.create_order(
            {
                'lead_id': payload.lead_id,
                'client_name': payload.client_name.strip(),
                'event_title': payload.event_title.strip() if payload.event_title else None,
                'event_date': payload.event_date,
                'contract_date': payload.contract_date,
                'source': payload.source.strip() if payload.source else None,
                'status': self._normalize_status(payload.status),
                'comment': payload.comment.strip() if payload.comment else None,
            }
        )
        order.order_code = self._build_order_code(order)

        rows = [
            (ClientOrderItemType.REVENUE, 'base_package', 'Ведущий + DJ', payload.base_package),
            (ClientOrderItemType.REVENUE, 'extra_equipment', 'Оборудование', payload.extra_equipment),
            (
                ClientOrderItemType.REVENUE,
                'extra_hours',
                f'Доп. часы ({self._format_decimal(payload.extra_hours)} x {self._format_decimal(payload.extra_hour_rate)})',
                payload.extra_hours * payload.extra_hour_rate,
            ),
            (ClientOrderItemType.COST, 'dj_payout', 'Выплата DJ', payload.dj_payout),
            (ClientOrderItemType.COST, 'ads_cost', 'Реклама', payload.ads_cost),
            (ClientOrderItemType.COST, 'other_costs', 'Прочие расходы', payload.other_costs),
        ]

        position = 1
        for item_type, category_code, title, amount in rows:
            if amount <= 0:
                continue
            self.orders.create_item(
                order.id,
                {
                    'item_type': item_type,
                    'category_code': category_code,
                    'title': title,
                    'amount': self._quantize(amount),
                    'position': position,
                },
            )
            position += 1

        self.db.commit()
        self.db.refresh(order)
        return self.get_order_detail(order.id)  # type: ignore[return-value]

    def _serialize_order(self, order: ClientOrder) -> ClientOrderRead:
        revenue, total_costs, profit, margin = self._calculate_financials(order)
        return ClientOrderRead(
            id=order.id,
            lead_id=order.lead_id,
            order_code=order.order_code,
            client_name=order.client_name,
            event_title=order.event_title,
            event_date=order.event_date,
            contract_date=order.contract_date,
            source=order.source,
            status=order.status.value,
            comment=order.comment,
            created_at=order.created_at,
            updated_at=order.updated_at,
            revenue=revenue,
            total_costs=total_costs,
            profit=profit,
            margin=margin,
        )

    def _calculate_financials(self, order: ClientOrder) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        revenue = sum(
            (item.amount for item in order.items if item.item_type == ClientOrderItemType.REVENUE),
            Decimal('0'),
        )
        costs = sum(
            (item.amount for item in order.items if item.item_type == ClientOrderItemType.COST),
            Decimal('0'),
        )
        profit = revenue - costs
        margin = Decimal('0')
        if revenue > 0:
            margin = (profit / revenue) * Decimal('100')
        return (
            self._quantize(revenue),
            self._quantize(costs),
            self._quantize(profit),
            self._quantize(margin),
        )

    @staticmethod
    def _quantize(value: Decimal) -> Decimal:
        return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    @staticmethod
    def _format_decimal(value: Decimal) -> str:
        return f'{value.normalize():f}' if value != value.to_integral() else str(int(value))

    @staticmethod
    def _normalize_status(value: str | None) -> ClientOrderStatus:
        normalized = (value or '').strip().lower()
        for status in ClientOrderStatus:
            if status.value == normalized:
                return status
        return ClientOrderStatus.SIGNED

    @staticmethod
    def _normalize_item_type(value: str | ClientOrderItemType | None) -> ClientOrderItemType:
        if isinstance(value, ClientOrderItemType):
            return value
        normalized = (value or '').strip().lower()
        for item_type in ClientOrderItemType:
            if item_type.value == normalized:
                return item_type
        raise ValueError('Unsupported item type')

    @staticmethod
    def _build_order_code(order: ClientOrder) -> str:
        year = order.contract_date.year if order.contract_date else order.created_at.year
        return f'ORD-{year}-{order.id:04d}'
