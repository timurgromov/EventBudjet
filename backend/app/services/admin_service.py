from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.admin_repository import AdminRepository
from app.schemas.admin import (
    AdminLeadDetailResponse,
    AdminLeadEventRead,
    AdminLeadEventsResponse,
    AdminLeadListItem,
    AdminLeadListResponse,
    AdminNotificationRead,
    AdminNotificationsResponse,
    AdminUserRead,
)
from app.schemas.expense import ExpenseRead
from app.schemas.lead import LeadRead


class AdminService:
    def __init__(self, db: Session):
        self.repo = AdminRepository(db)

    @staticmethod
    def _build_name(user: User) -> str | None:
        full = ' '.join(part for part in [user.first_name, user.last_name] if part)
        return full or None

    def list_leads(self) -> AdminLeadListResponse:
        rows = self.repo.list_leads()
        leads = [
            AdminLeadListItem(
                lead_id=lead.id,
                name=self._build_name(user),
                username=user.username,
                role=lead.role,
                city=lead.city,
                wedding_date_exact=lead.wedding_date_exact,
                season=lead.season,
                guests_count=lead.guests_count,
                total_budget=lead.total_budget,
                lead_status=lead.lead_status.value if lead.lead_status is not None else None,
                last_seen_at=user.last_seen_at,
                source=lead.source,
            )
            for lead, user in rows
        ]
        return AdminLeadListResponse(leads=leads)

    def get_lead_detail(self, lead_id: int) -> AdminLeadDetailResponse | None:
        pair = self.repo.get_lead_with_user(lead_id)
        if pair is None:
            return None

        lead, user = pair
        expenses = self.repo.list_expenses(lead_id)
        events = self.repo.list_lead_events(lead_id=lead_id, limit=50)

        return AdminLeadDetailResponse(
            lead=LeadRead.model_validate(lead),
            user=AdminUserRead(
                id=user.id,
                telegram_id=user.telegram_id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                last_seen_at=user.last_seen_at,
            ),
            expenses=[ExpenseRead.model_validate(expense) for expense in expenses],
            recent_events=[AdminLeadEventRead.model_validate(event) for event in events],
        )

    def get_lead_events(self, lead_id: int) -> AdminLeadEventsResponse | None:
        pair = self.repo.get_lead_with_user(lead_id)
        if pair is None:
            return None

        events = self.repo.list_lead_events(lead_id=lead_id, limit=200)
        return AdminLeadEventsResponse(
            lead_id=lead_id,
            events=[AdminLeadEventRead.model_validate(event) for event in events],
        )

    def list_notifications(self) -> AdminNotificationsResponse:
        rows = self.repo.list_notifications(limit=200)
        notifications = [
            AdminNotificationRead(
                id=notification.id,
                lead_id=notification.lead_id,
                notification_type=notification.notification_type,
                priority=notification.priority,
                status=notification.status.value,
                sent_at=notification.sent_at,
                created_at=notification.created_at,
                telegram_id=user.telegram_id if user is not None else None,
                username=user.username if user is not None else None,
            )
            for notification, user in rows
        ]
        return AdminNotificationsResponse(notifications=notifications)
