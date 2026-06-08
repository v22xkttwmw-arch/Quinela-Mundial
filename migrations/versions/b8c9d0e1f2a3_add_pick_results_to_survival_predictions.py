"""add pick_results to survival_predictions

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-06-09
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "survival_predictions",
        sa.Column("pick_results", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("survival_predictions", "pick_results")
