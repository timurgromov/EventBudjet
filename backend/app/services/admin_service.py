import json
import logging
from urllib import error as urllib_error
from urllib import request as urllib_request

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import NotificationStatus
from app.models.user import User
from app.repositories.admin_repository import AdminRepository
from app.schemas.admin import (
    AdminLeadActionResponse,
    AdminDirectMessageResponse,
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

logger = logging.getLogger(__name__)


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

    def send_direct_message(self, lead_id: int, text: str) -> AdminDirectMessageResponse | None:
        pair = self.repo.get_lead_with_user(lead_id)
        if pair is None:
            return None

        lead, user = pair
        status = NotificationStatus.FAILED

        if not settings.telegram_bot_token or settings.telegram_bot_token == 'test_bot_token':
            logger.warning('telegram_bot_token_not_configured_for_direct_message lead_id=%s', lead_id)
        else:
            try:
                url = f'https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage'
                payload = json.dumps({'chat_id': int(user.telegram_id), 'text': text}).encode('utf-8')
                req = urllib_request.Request(
                    url=url,
                    data=payload,
                    headers={'Content-Type': 'application/json'},
                    method='POST',
                )
                with urllib_request.urlopen(req, timeout=10) as response:
                    body_raw = response.read().decode('utf-8')
                body = json.loads(body_raw)
                if isinstance(body, dict) and body.get('ok') is True:
                    status = NotificationStatus.SENT
                else:
                    logger.warning(
                        'telegram_direct_message_rejected lead_id=%s telegram_id=%s response=%s',
                        lead_id,
                        user.telegram_id,
                        body_raw,
                    )
            except (urllib_error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                logger.exception(
                    'telegram_direct_message_failed lead_id=%s telegram_id=%s error=%s',
                    lead_id,
                    user.telegram_id,
                    exc,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    'telegram_direct_message_unexpected_error lead_id=%s telegram_id=%s error=%s',
                    lead_id,
                    user.telegram_id,
                    exc,
                )

        self.repo.create_notification_log(
            lead_id=lead.id,
            notification_type='direct_message',
            priority='manual',
            status=status,
        )
        self.repo.db.commit()

        return AdminDirectMessageResponse(
            lead_id=lead.id,
            telegram_id=user.telegram_id,
            status=status.value,
        )

    def reset_lead(self, lead_id: int) -> AdminLeadActionResponse | None:
        pair = self.repo.get_lead_with_user(lead_id)
        if pair is None:
            return None

        lead, _ = pair
        self.repo.reset_lead_data(lead)
        self.repo.db.commit()
        return AdminLeadActionResponse(lead_id=lead.id, status='reset')

    def delete_lead(self, lead_id: int) -> AdminLeadActionResponse | None:
        pair = self.repo.get_lead_with_user(lead_id)
        if pair is None:
            return None

        lead, _ = pair
        deleted_lead_id = lead.id
        self.repo.delete_lead(lead)
        self.repo.db.commit()
        return AdminLeadActionResponse(lead_id=deleted_lead_id, status='deleted')
