"""Add incoming request sources.

Revision ID: 20260510_0009
Revises: 20260508_0008
Create Date: 2026-05-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260510_0009'
down_revision: Union[str, Sequence[str], None] = '20260508_0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'incoming_request_sources',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False, server_default=sa.text("'other'")),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('name', name='uq_incoming_request_sources_name'),
    )
    op.create_index('ix_incoming_request_sources_is_archived', 'incoming_request_sources', ['is_archived'])

    op.add_column('incoming_requests', sa.Column('source_id', sa.BigInteger(), nullable=True))
    op.create_index('ix_incoming_requests_source_id', 'incoming_requests', ['source_id'])
    op.create_foreign_key(
        'fk_incoming_requests_source_id',
        'incoming_requests',
        'incoming_request_sources',
        ['source_id'],
        ['id'],
        ondelete='RESTRICT',
    )

    op.execute(
        """
        INSERT INTO incoming_request_sources (name, source_type)
        SELECT DISTINCT trim(source), 'other'
        FROM incoming_requests
        WHERE trim(source) <> ''
        ON CONFLICT (name) DO NOTHING;
        """
    )
    op.execute(
        """
        UPDATE incoming_requests AS requests
        SET source_id = sources.id
        FROM incoming_request_sources AS sources
        WHERE trim(requests.source) = sources.name
          AND requests.source_id IS NULL;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_incoming_request_sources_set_updated_at
        BEFORE UPDATE ON incoming_request_sources
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS trg_incoming_request_sources_set_updated_at ON incoming_request_sources;')
    op.drop_constraint('fk_incoming_requests_source_id', 'incoming_requests', type_='foreignkey')
    op.drop_index('ix_incoming_requests_source_id', table_name='incoming_requests')
    op.drop_column('incoming_requests', 'source_id')
    op.drop_index('ix_incoming_request_sources_is_archived', table_name='incoming_request_sources')
    op.drop_table('incoming_request_sources')
