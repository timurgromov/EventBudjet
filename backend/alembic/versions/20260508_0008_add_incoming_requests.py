"""Add incoming requests.

Revision ID: 20260508_0008
Revises: 20260508_0007
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260508_0008'
down_revision: Union[str, Sequence[str], None] = '20260508_0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'incoming_requests',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('source', sa.String(length=255), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('last_contact_date', sa.Date(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default=sa.text("'in_work'")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_incoming_requests_event_date', 'incoming_requests', ['event_date'])
    op.create_index('ix_incoming_requests_status', 'incoming_requests', ['status'])

    op.execute(
        """
        CREATE TRIGGER trg_incoming_requests_set_updated_at
        BEFORE UPDATE ON incoming_requests
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS trg_incoming_requests_set_updated_at ON incoming_requests;')
    op.drop_index('ix_incoming_requests_status', table_name='incoming_requests')
    op.drop_index('ix_incoming_requests_event_date', table_name='incoming_requests')
    op.drop_table('incoming_requests')
