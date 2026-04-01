import json
import logging
import re
from urllib import error as urllib_error
from urllib import request as urllib_request
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import NotificationStatus
from app.models.lead_event import LeadEvent
from app.models.user import User
from app.repositories.admin_repository import AdminRepository
from app.schemas.admin import (
    AdminLeadSourceActionResponse,
    AdminLeadActionResponse,
    AdminDirectMessageResponse,
    AdminLeadDetailResponse,
    AdminLeadEventRead,
    AdminLeadEventsResponse,
    AdminLeadListItem,
    AdminLeadListResponse,
    AdminLeadSourceRead,
    AdminLeadSourcesResponse,
    AdminNotificationRead,
    AdminNotificationsResponse,
    AdminUserRead,
)
from app.schemas.expense import ExpenseRead
from app.schemas.lead import LeadRead

logger = logging.getLogger(__name__)


class AdminService:
    SOURCE_CODE_RE = re.compile(r'^[a-z0-9][a-z0-9_-]{1,63}$')

    def __init__(self, db: Session):
        self.repo = AdminRepository(db)

    @staticmethod
    def _build_name(user: User) -> str | None:
        full = ' '.join(part for part in [user.first_name, user.last_name] if part)
        return full or None

    def list_leads(self) -> AdminLeadListResponse:
        rows = self.repo.list_leads()
        state_map = self.repo.get_bot_contact_state_map([lead.id for lead, _ in rows])
        source_name_map = self.repo.get_source_name_map(
            [lead.source for lead, _ in rows if isinstance(lead.source, str) and lead.source.strip()]
        )
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
                source_label=source_name_map.get(lead.source or ''),
                bot_contact_state=state_map.get(lead.id, 'unknown'),
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
        events = self.repo.list_lead_events(lead_id=lead_id, limit=200)

        return AdminLeadDetailResponse(
            lead=LeadRead.model_validate(lead),
            source_label=(self.repo.get_source_by_code(lead.source).name if lead.source else None),
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

    def list_sources(self) -> AdminLeadSourcesResponse:
        rows = self.repo.list_lead_sources()
        return AdminLeadSourcesResponse(
            sources=[
                AdminLeadSourceRead(
                    id=source.id,
                    code=source.code,
                    name=source.name,
                    description=source.description,
                    is_archived=bool(source.is_archived),
                    leads_count=int(leads_count or 0),
                    created_at=source.created_at,
                    updated_at=source.updated_at,
                )
                for source, leads_count in rows
            ]
        )

    def create_source(self, name: str, code: str | None = None, description: str | None = None) -> AdminLeadSourceRead:
        normalized_name = name.strip()
        if not normalized_name:
            raise ValueError('Название источника не может быть пустым')

        normalized_code = (code or '').strip().lower()
        if normalized_code:
            if not self.SOURCE_CODE_RE.match(normalized_code):
                raise ValueError('Код источника должен содержать только a-z, 0-9, "_" или "-" и начинаться с буквы/цифры')
            if self.repo.get_source_by_code(normalized_code) is not None:
                raise ValueError('Источник с таким кодом уже существует')
        else:
            # Auto-generate stable code when user fills only title.
            while True:
                candidate = f'src_{uuid4().hex[:8]}'
                if self.repo.get_source_by_code(candidate) is None:
                    normalized_code = candidate
                    break

        source = self.repo.create_lead_source(
            code=normalized_code,
            name=normalized_name,
            description=(description.strip() if isinstance(description, str) and description.strip() else None),
        )
        self.repo.db.commit()
        self.repo.db.refresh(source)

        return AdminLeadSourceRead(
            id=source.id,
            code=source.code,
            name=source.name,
            description=source.description,
            is_archived=bool(source.is_archived),
            leads_count=0,
            created_at=source.created_at,
            updated_at=source.updated_at,
        )

    def archive_source(self, source_id: int) -> AdminLeadSourceActionResponse | None:
        source = self.repo.get_lead_source(source_id)
        if source is None:
            return None
        source.is_archived = True
        self.repo.db.commit()
        return AdminLeadSourceActionResponse(source_id=source.id, status='archived')

    def restore_source(self, source_id: int) -> AdminLeadSourceActionResponse | None:
        source = self.repo.get_lead_source(source_id)
        if source is None:
            return None
        source.is_archived = False
        self.repo.db.commit()
        return AdminLeadSourceActionResponse(source_id=source.id, status='restored')

    def delete_source(self, source_id: int) -> AdminLeadSourceActionResponse | None:
        source = self.repo.get_lead_source(source_id)
        if source is None:
            return None

        leads_count = self.repo.get_leads_count_by_source_code(source.code)
        if leads_count > 0:
            raise ValueError('Нельзя удалить источник, в котором есть лиды. Сначала архивируйте его.')

        deleted_id = source.id
        self.repo.db.delete(source)
        self.repo.db.commit()
        return AdminLeadSourceActionResponse(source_id=deleted_id, status='deleted')

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
        blocked = False
        error_description: str | None = None

        if not settings.telegram_bot_token or settings.telegram_bot_token == 'test_bot_token':
            logger.warning('telegram_bot_token_not_configured_for_direct_message lead_id=%s', lead_id)
            error_description = 'telegram_bot_token_not_configured'
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
                    if isinstance(body, dict):
                        error_description = str(body.get('description') or body.get('error_code') or '') or None
                        lowered = (error_description or '').lower()
                        blocked = 'blocked by the user' in lowered or 'user is deactivated' in lowered
                    logger.warning(
                        'telegram_direct_message_rejected lead_id=%s telegram_id=%s response=%s',
                        lead_id,
                        user.telegram_id,
                        body_raw,
                    )
            except urllib_error.HTTPError as exc:
                try:
                    raw = exc.read().decode('utf-8')
                    body = json.loads(raw)
                    if isinstance(body, dict):
                        error_description = str(body.get('description') or exc)
                        lowered = error_description.lower()
                        blocked = 'blocked by the user' in lowered or 'user is deactivated' in lowered
                except Exception:  # noqa: BLE001
                    error_description = str(exc)
            except (urllib_error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                error_description = str(exc)
                logger.exception(
                    'telegram_direct_message_failed lead_id=%s telegram_id=%s error=%s',
                    lead_id,
                    user.telegram_id,
                    exc,
                )
            except Exception as exc:  # noqa: BLE001
                error_description = str(exc)
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
        self.repo.db.add(
            LeadEvent(
                lead_id=lead.id,
                event_type='admin_message_sent',
                event_payload={
                    'text': text,
                    'status': status.value,
                    'telegram_id': user.telegram_id,
                    'blocked': blocked,
                    'error': error_description,
                },
            )
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
