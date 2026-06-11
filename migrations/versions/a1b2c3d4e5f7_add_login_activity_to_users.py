"""add_login_activity_to_users

Revision ID: a1b2c3d4e5f7
Revises: 1511d7df9457
Create Date: 2026-06-11 02:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "1511d7df9457"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("login_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("last_active", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_active")
    op.drop_column("users", "login_count")
