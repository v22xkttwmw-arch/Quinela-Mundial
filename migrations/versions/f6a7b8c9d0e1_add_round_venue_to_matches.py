"""add_round_venue_to_matches

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-08 17:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("round", sa.String(), nullable=True))
    op.add_column("matches", sa.Column("venue", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("matches", "venue")
    op.drop_column("matches", "round")
