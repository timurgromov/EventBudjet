"""Add MVP constraint: one active lead per user.

Revision ID: 20260318_0002
Revises: 20260318_0001
Create Date: 2026-03-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260318_0002'
down_revision: Union[str, Sequence[str], None] = '20260318_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'uq_leads_active_user_id',
        'leads',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text("lead_status = 'active'"),
    )


def downgrade() -> None:
    op.drop_index('uq_leads_active_user_id', table_name='leads')
