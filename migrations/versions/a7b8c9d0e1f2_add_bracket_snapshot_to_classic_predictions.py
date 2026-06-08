"""add bracket_snapshot to classic_predictions

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-09
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "classic_predictions",
        sa.Column("bracket_snapshot", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("classic_predictions", "bracket_snapshot")
