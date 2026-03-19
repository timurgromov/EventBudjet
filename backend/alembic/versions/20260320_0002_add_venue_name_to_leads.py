"""Add venue_name to leads.

Revision ID: 20260320_0002
Revises: 20260318_0001
Create Date: 2026-03-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260320_0002'
down_revision: Union[str, Sequence[str], None] = '20260318_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('leads', sa.Column('venue_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('leads', 'venue_name')
