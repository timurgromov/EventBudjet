from enum import Enum


class LeadStatus(str, Enum):
    DRAFT = 'draft'
    ACTIVE = 'active'
    COMPLETED = 'completed'
    ARCHIVED = 'archived'


class NotificationStatus(str, Enum):
    PENDING = 'pending'
    SENT = 'sent'
    FAILED = 'failed'


class ScheduledMessageStatus(str, Enum):
    PENDING = 'pending'
    SENT = 'sent'
    FAILED = 'failed'
    CANCELLED = 'cancelled'


class ClientOrderStatus(str, Enum):
    SIGNED = 'signed'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    CLOSED = 'closed'
    CANCELLED = 'cancelled'


class ClientOrderItemType(str, Enum):
    REVENUE = 'revenue'
    COST = 'cost'
