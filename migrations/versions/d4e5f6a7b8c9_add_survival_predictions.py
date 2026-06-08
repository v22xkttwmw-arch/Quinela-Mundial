"""add_survival_predictions

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-02 17:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "survival_predictions",
        sa.Column("id",                   sa.Integer(),  nullable=False),
        sa.Column("user_id",              sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status",               sa.String(),   nullable=False, server_default="alive"),
        sa.Column("picks",                sa.Text(),     nullable=True),
        sa.Column("used_teams",           sa.Text(),     nullable=True),
        sa.Column("extra_life_available", sa.Boolean(),  nullable=False, server_default="0"),
        sa.Column("extra_life_used",      sa.Boolean(),  nullable=False, server_default="0"),
        sa.Column("eliminated_in_round",  sa.Integer(),  nullable=True),
        sa.Column("created_at",           sa.DateTime(), nullable=True),
        sa.Column("updated_at",           sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_survival_predictions_id", "survival_predictions", ["id"])


def downgrade() -> None:
    op.drop_index("ix_survival_predictions_id", table_name="survival_predictions")
    op.drop_table("survival_predictions")
