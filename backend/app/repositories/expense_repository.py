from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.expense import Expense


class ExpenseRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_lead_id(self, lead_id: int) -> list[Expense]:
        stmt = select(Expense).where(Expense.lead_id == lead_id).order_by(Expense.created_at.asc(), Expense.id.asc())
        return list(self.db.execute(stmt).scalars().all())

    def get_by_id_and_lead(self, expense_id: int, lead_id: int) -> Expense | None:
        stmt = select(Expense).where(Expense.id == expense_id, Expense.lead_id == lead_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, lead_id: int, data: dict) -> Expense:
        expense = Expense(lead_id=lead_id, **data)
        self.db.add(expense)
        self.db.flush()
        return expense

    def update(self, expense: Expense, data: dict) -> Expense:
        for key, value in data.items():
            setattr(expense, key, value)
        self.db.flush()
        return expense

    def delete(self, expense: Expense) -> None:
        self.db.delete(expense)
        self.db.flush()
