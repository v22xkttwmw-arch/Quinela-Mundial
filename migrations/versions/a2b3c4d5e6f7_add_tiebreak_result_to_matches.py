"""add_tiebreak_result_to_matches

Revision ID: a2b3c4d5e6f7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Marcador de los 90 minutos regulares (distinto del marcador final cuando
    # el partido se decide en tiempo extra o penales) + método/lado ganador
    # del desempate, necesarios para puntuar correctamente las eliminatorias.
    op.add_column("matches", sa.Column("reg_home_score", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("reg_away_score", sa.Integer(), nullable=True))
    op.add_column("matches", sa.Column("win_method", sa.String(), nullable=True))   # "extraTime" | "penalties"
    op.add_column("matches", sa.Column("winner_side", sa.String(), nullable=True))  # "home" | "away"


def downgrade() -> None:
    op.drop_column("matches", "winner_side")
    op.drop_column("matches", "win_method")
    op.drop_column("matches", "reg_away_score")
    op.drop_column("matches", "reg_home_score")
