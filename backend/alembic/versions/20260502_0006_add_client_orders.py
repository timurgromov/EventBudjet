"""Add client orders and client order items.

Revision ID: 20260502_0006
Revises: 20260401_0005
Create Date: 2026-05-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260502_0006'
down_revision: Union[str, Sequence[str], None] = '20260401_0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'client_orders',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('lead_id', sa.BigInteger(), sa.ForeignKey('leads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('order_code', sa.String(length=32), nullable=True),
        sa.Column('client_name', sa.String(length=255), nullable=False),
        sa.Column('event_title', sa.String(length=255), nullable=True),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('contract_date', sa.Date(), nullable=True),
        sa.Column('source', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default=sa.text("'signed'")),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('order_code', name='uq_client_orders_order_code'),
    )
    op.create_index('ix_client_orders_lead_id', 'client_orders', ['lead_id'])

    op.create_table(
        'client_order_items',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('order_id', sa.BigInteger(), sa.ForeignKey('client_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_type', sa.String(length=20), nullable=False),
        sa.Column('category_code', sa.String(length=100), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_client_order_items_order_id', 'client_order_items', ['order_id'])

    op.execute(
        """
        CREATE TRIGGER trg_client_orders_set_updated_at
        BEFORE UPDATE ON client_orders
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_client_order_items_set_updated_at
        BEFORE UPDATE ON client_order_items
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS trg_client_order_items_set_updated_at ON client_order_items;')
    op.execute('DROP TRIGGER IF EXISTS trg_client_orders_set_updated_at ON client_orders;')
    op.drop_index('ix_client_order_items_order_id', table_name='client_order_items')
    op.drop_table('client_order_items')
    op.drop_index('ix_client_orders_lead_id', table_name='client_orders')
    op.drop_table('client_orders')
