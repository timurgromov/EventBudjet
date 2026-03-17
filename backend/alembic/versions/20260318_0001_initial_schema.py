"""Initial schema for Phase 1 entities.

Revision ID: 20260318_0001
Revises:
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20260318_0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('telegram_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('first_name', sa.String(length=255), nullable=True),
        sa.Column('last_name', sa.String(length=255), nullable=True),
        sa.Column('language_code', sa.String(length=16), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('first_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('visits_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.UniqueConstraint('telegram_id', name='uq_users_telegram_id'),
    )
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'])

    op.create_table(
        'leads',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=True),
        sa.Column('city', sa.String(length=255), nullable=True),
        sa.Column('venue_status', sa.String(length=100), nullable=True),
        sa.Column('wedding_date_exact', sa.Date(), nullable=True),
        sa.Column('wedding_date_mode', sa.String(length=50), nullable=True),
        sa.Column('season', sa.String(length=50), nullable=True),
        sa.Column('next_year_flag', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('guests_count', sa.Integer(), nullable=True),
        sa.Column('total_budget', sa.Numeric(12, 2), nullable=True),
        sa.Column('lead_status', sa.String(length=50), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('utm_source', sa.String(length=255), nullable=True),
        sa.Column('utm_medium', sa.String(length=255), nullable=True),
        sa.Column('utm_campaign', sa.String(length=255), nullable=True),
        sa.Column('partner_code', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_leads_user_id', 'leads', ['user_id'])

    op.create_table(
        'expenses',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('lead_id', sa.BigInteger(), sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_code', sa.String(length=100), nullable=True),
        sa.Column('category_name', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.create_table(
        'lead_events',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('lead_id', sa.BigInteger(), sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('event_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_lead_events_lead_id', 'lead_events', ['lead_id'])

    op.create_table(
        'scheduled_messages',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.BigInteger(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('lead_id', sa.BigInteger(), sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('message_code', sa.String(length=100), nullable=False),
        sa.Column('send_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_scheduled_messages_send_at', 'scheduled_messages', ['send_at'])

    op.create_table(
        'admin_notifications',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('lead_id', sa.BigInteger(), sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('notification_type', sa.String(length=100), nullable=False),
        sa.Column('priority', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.create_table(
        'message_templates',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('code', name='uq_message_templates_code'),
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_leads_set_updated_at
        BEFORE UPDATE ON leads
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_expenses_set_updated_at
        BEFORE UPDATE ON expenses
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_message_templates_set_updated_at
        BEFORE UPDATE ON message_templates
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS trg_message_templates_set_updated_at ON message_templates;')
    op.execute('DROP TRIGGER IF EXISTS trg_expenses_set_updated_at ON expenses;')
    op.execute('DROP TRIGGER IF EXISTS trg_leads_set_updated_at ON leads;')
    op.execute('DROP FUNCTION IF EXISTS set_updated_at;')

    op.drop_table('message_templates')
    op.drop_table('admin_notifications')
    op.drop_index('ix_scheduled_messages_send_at', table_name='scheduled_messages')
    op.drop_table('scheduled_messages')
    op.drop_index('ix_lead_events_lead_id', table_name='lead_events')
    op.drop_table('lead_events')
    op.drop_table('expenses')
    op.drop_index('ix_leads_user_id', table_name='leads')
    op.drop_table('leads')
    op.drop_index('ix_users_telegram_id', table_name='users')
    op.drop_table('users')
