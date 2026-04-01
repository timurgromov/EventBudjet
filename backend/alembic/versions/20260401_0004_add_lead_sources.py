"""Add lead sources directory for attribution links.

Revision ID: 20260401_0004
Revises: 20260320_0003
Create Date: 2026-04-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260401_0004'
down_revision: Union[str, Sequence[str], None] = '20260320_0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lead_sources',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('code', name='uq_lead_sources_code'),
    )

    op.execute(
        """
        CREATE TRIGGER trg_lead_sources_set_updated_at
        BEFORE UPDATE ON lead_sources
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )

    op.execute(
        """
        INSERT INTO lead_sources (code, name, description)
        VALUES
          ('direct_personal', 'Личный контакт (без метки)', 'Источник по умолчанию без уникальной метки'),
          ('telegram_mini_app', 'Telegram Mini App', 'Исторический источник из старой логики'),
          ('calc', 'Старая ссылка calc', 'Старый deep-link с параметром calc')
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS trg_lead_sources_set_updated_at ON lead_sources;')
    op.drop_table('lead_sources')

