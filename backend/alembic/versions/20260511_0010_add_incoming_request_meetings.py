"""Add meeting tracking to incoming requests.

Revision ID: 20260511_0010
Revises: 20260510_0009
Create Date: 2026-05-11 13:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '20260511_0010'
down_revision = '20260510_0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'incoming_requests',
        sa.Column('meeting_held', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.execute("UPDATE incoming_requests SET meeting_held = true WHERE status = 'signed';")


def downgrade() -> None:
    op.drop_column('incoming_requests', 'meeting_held')
