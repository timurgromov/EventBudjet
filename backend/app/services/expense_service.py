from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.lead import Lead
from app.repositories.expense_repository import ExpenseRepository
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services.event_service import EventService
from app.services.event_types import EventType

BASE_EXPENSE_CATEGORIES: dict[str, str] = {
    'banquet': 'Банкет',
    'alcohol': 'Алкоголь и напитки',
    'host': 'Ведущий + DJ',
    'photo': 'Фотограф',
    'video': 'Видеограф',
    'decor': 'Оформление и флористика',
    'cake': 'Торт',
    'stylist': 'Стилист',
    'outfit': 'Образ',
    'transport': 'Транспорт',
    'coordinator': 'Координатор',
    'organizer': 'Организатор',
    'accommodation': 'Размещение гостей',
    'ceremony': 'Выездная регистрация',
    'dance': 'Постановка танца',
    'show': 'Шоу-программа',
    'band': 'Кавер-группа',
    'effects': 'Спецэффекты',
    'finale': 'Завершение вечера',
}


class ExpenseService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ExpenseRepository(db)
        self.events = EventService(db)

    def list_expenses(self, lead: Lead) -> list[Expense]:
        return self.repo.list_by_lead_id(lead.id)

    def create_expense(self, lead: Lead, payload: ExpenseCreate) -> Expense:
        normalized = self._normalize_category(payload.category_code, payload.category_name)
        expense = self.repo.create(
            lead.id,
            {
                'category_code': normalized['category_code'],
                'category_name': normalized['category_name'],
                'amount': payload.amount,
            },
        )
        self.events.write_event(
            lead.id,
            EventType.EXPENSE_ADDED,
            {
                'expense_id': expense.id,
                'category_code': expense.category_code,
                'category_name': expense.category_name,
                'amount': str(expense.amount),
            },
        )
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def update_expense(self, lead: Lead, expense_id: int, payload: ExpenseUpdate) -> Expense:
        expense = self.repo.get_by_id_and_lead(expense_id, lead.id)
        if expense is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Expense not found')

        data = payload.model_dump(exclude_unset=True)
        category_code = data.pop('category_code', expense.category_code)
        category_name = data.pop('category_name', expense.category_name)
        if 'category_code' in payload.model_fields_set or 'category_name' in payload.model_fields_set:
            normalized = self._normalize_category(category_code, category_name)
            data['category_code'] = normalized['category_code']
            data['category_name'] = normalized['category_name']

        before = {
            'category_code': expense.category_code,
            'category_name': expense.category_name,
            'amount': expense.amount,
        }
        updated = self.repo.update(expense, data)
        self.events.write_event(
            lead.id,
            EventType.EXPENSE_UPDATED,
            {
                'expense_id': updated.id,
                'category_code': updated.category_code,
                'category_name': updated.category_name,
                'amount': str(updated.amount),
                'updated_fields': sorted(list(payload.model_fields_set)),
                'changes': self._build_expense_changes(before, updated),
            },
        )
        self.db.commit()
        self.db.refresh(updated)
        return updated

    def delete_expense(self, lead: Lead, expense_id: int) -> None:
        expense = self.repo.get_by_id_and_lead(expense_id, lead.id)
        if expense is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Expense not found')

        deleted_payload = {
            'expense_id': expense.id,
            'category_code': expense.category_code,
            'category_name': expense.category_name,
            'amount': str(expense.amount),
        }
        self.repo.delete(expense)
        self.events.write_event(lead.id, EventType.EXPENSE_REMOVED, deleted_payload)
        self.db.commit()

    @staticmethod
    def _normalize_category(category_code: str | None, category_name: str | None) -> dict[str, str | None]:
        code = category_code.strip() if category_code else None
        name = category_name.strip() if category_name else None

        if code and code != 'custom':
            if code not in BASE_EXPENSE_CATEGORIES:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Unknown category_code')
            return {'category_code': code, 'category_name': BASE_EXPENSE_CATEGORIES[code]}

        if code == 'custom' or not code:
            if not name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail='category_name is required for custom category',
                )
            return {'category_code': code, 'category_name': name}

        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Invalid category data')

    @staticmethod
    def _build_expense_changes(before: dict[str, object], updated: Expense) -> list[dict[str, str | None]]:
        changes: list[dict[str, str | None]] = []
        fields = ('category_code', 'category_name', 'amount')
        for field in fields:
            old_value = before.get(field)
            new_value = getattr(updated, field)
            if old_value == new_value:
                continue
            changes.append(
                {
                    'field': field,
                    'old': None if old_value is None else str(old_value),
                    'new': None if new_value is None else str(new_value),
                }
            )
        return changes
