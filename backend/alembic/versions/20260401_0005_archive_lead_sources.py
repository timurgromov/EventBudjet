"""Add archive flag for lead sources.

Revision ID: 20260401_0005
Revises: 20260401_0004
Create Date: 2026-04-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260401_0005'
down_revision: Union[str, Sequence[str], None] = '20260401_0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('lead_sources', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('lead_sources', 'is_archived')

