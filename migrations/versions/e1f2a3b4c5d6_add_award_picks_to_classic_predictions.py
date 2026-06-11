"""add_award_picks_to_classic_predictions

Revision ID: e1f2a3b4c5d6
Revises: a1b2c3d4e5f7
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("classic_predictions", sa.Column("top_scorer", sa.String(), nullable=True))
    op.add_column("classic_predictions", sa.Column("top_assist", sa.String(), nullable=True))
    op.add_column("classic_predictions", sa.Column("best_young_player", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("classic_predictions", "best_young_player")
    op.drop_column("classic_predictions", "top_assist")
    op.drop_column("classic_predictions", "top_scorer")
