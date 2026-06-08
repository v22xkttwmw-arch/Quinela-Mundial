"""add_scoring_to_classic_predictions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-02 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("classic_predictions", sa.Column("captain_matches",       sa.Text(),    nullable=True))
    op.add_column("classic_predictions", sa.Column("total_points_classic",  sa.Integer(), nullable=True, server_default="0"))
    op.add_column("classic_predictions", sa.Column("exact_count_classic",   sa.Integer(), nullable=True, server_default="0"))
    op.add_column("classic_predictions", sa.Column("effectiveness_classic", sa.Float(),   nullable=True, server_default="0.0"))


def downgrade() -> None:
    op.drop_column("classic_predictions", "effectiveness_classic")
    op.drop_column("classic_predictions", "exact_count_classic")
    op.drop_column("classic_predictions", "total_points_classic")
    op.drop_column("classic_predictions", "captain_matches")
