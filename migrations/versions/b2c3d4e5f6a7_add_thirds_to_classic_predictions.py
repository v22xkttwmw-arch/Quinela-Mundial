"""add_thirds_to_classic_predictions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-02 14:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("classic_predictions", sa.Column("selected_thirds",    sa.Text(),    nullable=True))
    op.add_column("classic_predictions", sa.Column("third_assignments",  sa.Text(),    nullable=True))
    op.add_column("classic_predictions", sa.Column("is_bracket_generated", sa.Boolean(), nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("classic_predictions", "is_bracket_generated")
    op.drop_column("classic_predictions", "third_assignments")
    op.drop_column("classic_predictions", "selected_thirds")
