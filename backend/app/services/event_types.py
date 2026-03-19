from enum import Enum


class EventType(str, Enum):
    BOT_STARTED = 'bot_started'
    MINIAPP_OPENED = 'miniapp_opened'
    LEAD_CREATED = 'lead_created'
    PROFILE_STARTED = 'profile_started'
    PROFILE_UPDATED = 'profile_updated'
    PROFILE_COMPLETED = 'profile_completed'
    EXPENSE_ADDED = 'expense_added'
    EXPENSE_UPDATED = 'expense_updated'
    EXPENSE_REMOVED = 'expense_removed'
    BUDGET_CALCULATED = 'budget_calculated'
    APP_RESUMED = 'app_resumed'
    UI_ACTION = 'ui_action'
