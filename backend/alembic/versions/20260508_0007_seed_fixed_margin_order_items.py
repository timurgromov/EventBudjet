"""Seed fixed margin order items.

Revision ID: 20260508_0007
Revises: 20260502_0006
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op


revision: str = '20260508_0007'
down_revision: Union[str, Sequence[str], None] = '20260502_0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    fixed_items = [
        ('revenue', 'base_package', 'Ведущий + DJ', 1),
        ('revenue', 'extra_equipment', 'Оборудование', 2),
        ('revenue', 'upsell', 'Апсейл', 3),
        ('cost', 'dj_payout', 'Выплата DJ', 101),
        ('cost', 'ads_cost', 'Реклама', 102),
    ]

    for item_type, category_code, title, position in fixed_items:
        op.execute(
            f"""
            INSERT INTO client_order_items (order_id, item_type, category_code, title, amount, position)
            SELECT orders.id, '{item_type}', '{category_code}', '{title}', 0, {position}
            FROM client_orders AS orders
            WHERE NOT EXISTS (
                SELECT 1
                FROM client_order_items AS items
                WHERE items.order_id = orders.id
                  AND items.category_code = '{category_code}'
            );
            """
        )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM client_order_items
        WHERE amount = 0
          AND category_code IN ('base_package', 'extra_equipment', 'upsell', 'dj_payout', 'ads_cost');
        """
    )
