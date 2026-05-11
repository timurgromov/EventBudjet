"""Add incoming request digest logs.

Revision ID: 20260511_0011
Revises: 20260511_0010
Create Date: 2026-05-11 17:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '20260511_0011'
down_revision = '20260511_0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'incoming_request_digest_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('chat_id', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('requests_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_incoming_request_digest_logs_status_created_at',
        'incoming_request_digest_logs',
        ['status', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_incoming_request_digest_logs_status_created_at', table_name='incoming_request_digest_logs')
    op.drop_table('incoming_request_digest_logs')
