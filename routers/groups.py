from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from database import get_db
from deps import get_current_user
import models, schemas

router = APIRouter()


@router.post("/groups/", response_model=schemas.GroupResponse)
def create_group(
    data: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = models.Group(name=data.name, owner_id=current_user.id)
    db.add(group)
    db.flush()
    member = models.GroupMember(group_id=group.id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(group)
    return group


@router.post("/groups/{group_id}/join", response_model=schemas.GroupMemberResponse)
def join_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    existing = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya eres miembro de este grupo")
    member = models.GroupMember(group_id=group_id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/groups/me", response_model=list[schemas.GroupResponse])
def get_my_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = db.query(models.GroupMember).filter(
        models.GroupMember.user_id == current_user.id
    ).all()
    group_ids = [m.group_id for m in memberships]
    return db.query(models.Group).filter(models.Group.id.in_(group_ids)).all()


@router.post("/survivor/pick", response_model=schemas.SurvivorPickResponse)
def make_survivor_pick(
    data: schemas.SurvivorPickCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_paid_survival:
        raise HTTPException(status_code=403, detail="Necesitas el Modo Supervivencia para hacer picks")
    match = db.query(models.Match).filter(models.Match.id == data.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    if datetime.utcnow() >= match.kickoff_time - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="El tiempo para predecir este partido ha expirado")

    if data.group_id is not None:
        membership = db.query(models.GroupMember).filter(
            models.GroupMember.group_id == data.group_id,
            models.GroupMember.user_id == current_user.id,
        ).first()
        if not membership:
            raise HTTPException(status_code=404, detail="No eres miembro de este grupo")
        if not membership.is_alive:
            raise HTTPException(status_code=400, detail="Estás eliminado de este grupo")

    already_used_q = db.query(models.SurvivorPick).filter(
        models.SurvivorPick.user_id == current_user.id,
        models.SurvivorPick.team_id == data.team_id,
    )
    if data.group_id is not None:
        already_used_q = already_used_q.filter(
            models.SurvivorPick.group_id == data.group_id
        )
    if already_used_q.first():
        raise HTTPException(status_code=400, detail="Ya has utilizado este equipo en este torneo")

    pick = models.SurvivorPick(
        user_id=current_user.id,
        group_id=data.group_id,
        match_id=data.match_id,
        team_id=data.team_id,
    )
    db.add(pick)
    db.commit()
    db.refresh(pick)
    return pick


@router.get("/groups/{group_id}/leaderboard", response_model=list[schemas.GroupLeaderboardEntry])
def group_leaderboard(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    members = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id
    ).all()

    result = []
    for member in members:
        user = db.query(models.User).filter(models.User.id == member.user_id).first()
        lb = db.query(models.Leaderboard).filter(
            models.Leaderboard.user_id == member.user_id
        ).first()
        result.append(schemas.GroupLeaderboardEntry(
            user=schemas.LeaderboardUserInfo(id=user.id, email=user.email),
            total_points=lb.total_points if lb else 0,
            is_alive=member.is_alive,
        ))

    result.sort(key=lambda x: x.total_points, reverse=True)
    return result


@router.get("/groups/{group_id}/survivors", response_model=list[schemas.SurvivorStatusEntry])
def group_survivors(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    members = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id
    ).all()

    result = []
    for member in members:
        user = db.query(models.User).filter(models.User.id == member.user_id).first()
        last_pick = (
            db.query(models.SurvivorPick)
            .filter(
                models.SurvivorPick.user_id == member.user_id,
                models.SurvivorPick.group_id == group_id,
            )
            .order_by(models.SurvivorPick.created_at.desc())
            .first()
        )
        result.append(schemas.SurvivorStatusEntry(
            user=schemas.LeaderboardUserInfo(id=user.id, email=user.email),
            is_alive=member.is_alive,
            last_team_picked=last_pick.team_id if last_pick else None,
        ))

    # Vivos primero, luego eliminados
    result.sort(key=lambda x: (not x.is_alive,))
    return result
