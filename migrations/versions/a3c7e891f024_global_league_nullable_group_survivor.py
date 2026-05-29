"""global league: nullable group_id in survivor_picks

Revision ID: a3c7e891f024
Revises: d14ec3489619
Create Date: 2026-05-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'a3c7e891f024'
down_revision = 'd14ec3489619'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('survivor_picks', schema=None) as batch_op:
        batch_op.alter_column('group_id',
                              existing_type=sa.INTEGER(),
                              nullable=True)


def downgrade():
    with op.batch_alter_table('survivor_picks', schema=None) as batch_op:
        batch_op.alter_column('group_id',
                              existing_type=sa.INTEGER(),
                              nullable=False)
