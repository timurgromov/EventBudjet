"""Merge parallel alembic heads.

Revision ID: 20260320_0003
Revises: 20260318_0002, 20260320_0002
Create Date: 2026-03-20
"""

from typing import Sequence, Union


revision: str = '20260320_0003'
down_revision: Union[str, Sequence[str], None] = ('20260318_0002', '20260320_0002')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
