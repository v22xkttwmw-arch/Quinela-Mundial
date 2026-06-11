from database import SessionLocal 
from models import User, Prediction, Match 

def calculate_points(pred_home: int, pred_away: int, real_home: int, real_away: int) -> int:
    # Si el partido no ha empezado o no tiene marcador
    if real_home is None or real_away is None:
        return 0
        
    # 5 Puntos: Marcador Exacto
    if pred_home == real_home and pred_away == real_away:
        return 5
        
    real_diff = real_home - real_away
    pred_diff = pred_home - pred_away
    
    # 3 Puntos: Mismo ganador y misma diferencia de goles
    if real_diff == pred_diff:
        return 3
        
    # 1 Punto: Tendencia (Acertó quién ganó o si fue empate)
    if (real_diff > 0 and pred_diff > 0) or \
       (real_diff < 0 and pred_diff < 0) or \
       (real_diff == 0 and pred_diff == 0):
        return 1
        
    # 0 Puntos: Falló todo
    return 0

def run_recalc():
    db = SessionLocal()
    try:
        print("Iniciando recálculo del Mundial...")
        
        # 1. Traer todos los partidos que ya tienen marcador
        matches = db.query(Match).filter(Match.home_score.isnot(None), Match.away_score.isnot(None)).all()
        match_dict = {m.id: m for m in matches}
        print(f"Encontrados {len(matches)} partidos con marcador.")
        
        # 2. Traer las predicciones de esos partidos
        predictions = db.query(Prediction).filter(Prediction.match_id.in_(match_dict.keys())).all()
        
        # 3. Recalcular puntos para cada predicción
        for pred in predictions:
            match = match_dict[pred.match_id]
            pts = calculate_points(
                pred.predicted_home, 
                pred.predicted_away, 
                match.home_score, 
                match.away_score
            )
            pred.points_earned = pts
            
        db.commit()
        print("Puntos por partido actualizados.")
        
        # 4. Actualizar los totales por Usuario
        users = db.query(User).all()
        for user in users:
            # Traer todas las predicciones de este usuario
            user_preds = db.query(Prediction).filter(Prediction.user_id == user.id).all()
            
            total = 0
            exact = 0
            diff = 0
            tendency = 0
            
            for p in user_preds:
                pts = p.points_earned or 0
                total += pts
                if pts == 5: exact += 1
                elif pts == 3: diff += 1
                elif pts == 1: tendency += 1
                
            # Actualizar columnas en el usuario
            user.total_points = total
            user.exact_matches_count = exact
            user.diff_matches_count = diff
            user.tendency_matches_count = tendency
            
        db.commit()
        print("¡Leaderboard global actualizado con éxito!")
        
    except Exception as e:
        print(f"Error durante el recálculo: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_recalc()