from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.lead_repository import LeadRepository
from app.services.event_service import EventService


class CalculationService:
    def __init__(self, db: Session):
        self.db = db
        self.expenses = ExpenseRepository(db)
        self.leads = LeadRepository(db)
        self.events = EventService(db)

    def calculate_and_store_total(self, lead: Lead) -> Decimal:
        items = self.expenses.list_by_lead_id(lead.id)
        total = sum((item.amount for item in items), Decimal('0'))

        self.leads.update(lead, {'total_budget': total})
        self.events.write_event(
            lead.id,
            'budget_calculated',
            {
                'total_budget': str(total),
                'expenses_count': len(items),
            },
        )

        self.db.commit()
        self.db.refresh(lead)
        return total
