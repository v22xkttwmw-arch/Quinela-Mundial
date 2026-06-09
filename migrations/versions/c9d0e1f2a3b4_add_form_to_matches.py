"""add home_form and away_form to matches

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-06-09
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("home_form", sa.String(), nullable=True))
    op.add_column("matches", sa.Column("away_form", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "away_form")
    op.drop_column("matches", "home_form")
