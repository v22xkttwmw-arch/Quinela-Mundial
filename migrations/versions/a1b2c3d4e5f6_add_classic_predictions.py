"""add_classic_predictions

Revision ID: a1b2c3d4e5f6
Revises: cead32f7945c
Create Date: 2026-06-01 22:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "cead32f7945c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "classic_predictions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("group_fixtures", sa.Text(), nullable=False),
        sa.Column("knockout_scores", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_classic_predictions_id", "classic_predictions", ["id"])


def downgrade() -> None:
    op.drop_index("ix_classic_predictions_id", table_name="classic_predictions")
    op.drop_table("classic_predictions")
