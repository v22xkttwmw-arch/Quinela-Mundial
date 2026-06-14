import type { Language } from "@/lib/LanguageContext";

export const translations: Record<Language, any> = {
  es: {
    liga: "Liga",
    miRendimiento: "Mi Rendimiento",
    predecir: "Predecir",
    supervivencia: "Supervivencia",
    pase: "Pase",
    reglamento: "Reglamento",
    salir: "Salir",
    login: "Log in",
    registrarse: "Registrarse",

    dashboard: {
      loading: "Cargando liga global...",
      title: "Liga Global",
      subtitle: "Mundial 2026 · Clasificación en tiempo real",
      upgradeVip: "⬆ VIP",
      live: "EN VIVO",
      predictBtn: "+ Predicción",
      tabs: { classic: "Clásico", survival: "Supervivencia", predictions: "Mis Pronósticos" },
      tooltips: { classic: "5 pts: marcador exacto · 3 pts: ganador + diferencia · 1 pt: solo el ganador · 0 pts: fallo.", survival: "Elige un equipo por jornada. Si empata o pierde, quedas eliminado. No puedes repetir equipo." },
      tableClassic: { pos: "Pos", user: "Usuario", pts: "Pts", total: "Puntos Totales", exact: "Exactos (5)", diff: "Diferencia (3)", tendency: "Tendencia (1)", empty: "Sin datos todavía." },
      tableSurvival: { user: "Usuario", status: "Estado", lastTeam: "Último equipo", alive: "VIVO", eliminated: "ELIMINADO", empty: "Sin datos todavía." },
      predictions: { empty: "Aún no has hecho ninguna predicción.", predictNow: "Predice ahora", match: "Partido #", yourPrediction: "Tu pronóstico:", inProgress: "En curso:", actual: "Real:", pts: "pts" },
      outcomes: { exact: "¡Exacto!", difference: "Ganador + dif.", tendency: "Tendencia", miss: "Fallaste", pending: "Pendiente" },
      paywall: { survivalTitle: "Modo Supervivencia bloqueado", survivalDesc: "Activa tu pase para ver la tabla de supervivientes y hacer tus picks.", survivalBtn: "⬆ Ver Pase VIP", guestTitle: "Tabla de posiciones bloqueada", guestDesc: "Crea tu cuenta para ver el ranking en tiempo real y participar en la Liga Global.", guestBtn: "Crear cuenta gratis" },
      dailyFeed: { title: "Picks Globales", live: "EN VIVO", scheduled: "PRÓXIMO", noPicks: "Nadie ha pronosticado este partido todavía.", tendencyHome: "Local", tendencyDraw: "Empate", tendencyAway: "Visitante" }
    },

    matchCenter: {
      locale: "es-MX", live: "EN VIVO", score: "marcador", grp: "GRP", grupo: "Grupo", finished: "FINALIZADO", finishedShort: "FIN", today: "HOY", liveToday: "En vivo · Hoy", todayMatches: "Partidos de hoy", updating: "actualizando…", radar: "Mi Radar · Próximos", recentHistory: "Historial reciente", vs: "vs"
    },

    predict: {
      tag: "PREDICTOR FLUIDO · MUNDIAL 2026",
      title: "Simula el torneo completo",
      desc: "Cada marcador actualiza la tabla en tiempo real y propaga ganadores por el bracket hasta la Final.",
      closeTag: "EDICIÓN CIERRA",
      closeTime: "15 min antes del partido",
      groupsTitle: "Fase de Grupos",
      groupsDesc: "Usa [−] y [+] para el marcador. La tabla viva a la derecha se reordena al instante.",
      top2: "Top 2 + mejores 3ros califican",
      table: { team: "Equipo", pts: "Pts", gd: "DG", gf: "GF" },
      thirds: {
        title: "Mejores Terceros",
        desc: "Selecciona tus 8 favoritos y el algoritmo FIFA los asignará sin que enfrenten al líder de su grupo.",
        generatedTitle: "Mejores Terceros — Bracket Generado",
        generatedDesc: "El algoritmo FIFA asignó los equipos respetando los grupos.",
        selectTitle: "Selecciona los 8 Mejores Terceros",
        selectDesc: "Elige manualmente qué 8 equipos avanzan al cuadro de 32.",
        reset: "Resetear",
        qualified: "Clasificado",
        error: "No existe asignación válida para esta selección (regla FIFA: ningún equipo puede enfrentar al líder de su propio grupo). Cambia al menos un equipo.",
        confirmBtn: "✓ Confirmar y Generar Fase Final",
        selectMore1: "Selecciona ",
        selectMore2: " equipo",
        selectMore3: " más…"
      },
      knockout: {
        title: "Fase Final",
        desc: "Los clasificados llenan el cuadro automáticamente. Anota el marcador de cada llave y el ganador avanza.",
        thirdPlace: "Tercer Lugar",
        winner: "Ganador",
        tie: "Empate — Resolver",
        extraTime: "⏱ T. Extra",
        penalties: "⚽ Penales",
        etTitle: "⏱ Tiempo Extra",
        etTie: "ET Empate — Penales",
        r32: "16vos",
        r16: "Octavos",
        qf: "Cuartos",
        sf: "Semifinal",
        final: "Gran Final",
        champion: "CAMPEÓN"
      },
      special: {
        title: "Premios Especiales del Torneo",
        desc: "Escribe tus predicciones libres. Obtén +10 puntos extras por cada acierto correcto al finalizar el torneo.",
        scorer: "Goleador del Torneo",
        scorerEx: "Ej. Kylian Mbappé",
        assist: "Líder de Asistencias",
        assistEx: "Ej. Kevin De Bruyne",
        young: "Mejor Jugador Joven",
        youngEx: "Ej. Lamine Yamal"
      },
      save: {
        success: "Quiniela guardada",
        error: "Error al guardar — revisa tu plan",
        saving: "Guardando…",
        saved: "Guardado",
        btn: "Guardar Mi Quiniela"
      }
    },

    survival: {
      tag: "LAST MAN STANDING · MUNDIAL 2026",
      desc: "Elige un equipo para que gane. Si empata o pierde, quedas eliminado. No puedes repetir equipo.",
      guestBanner: {
        prefix: "Estás viendo la cartelera en modo invitado.",
        link: "Crea tu cuenta",
        suffix: "para hacer tus picks."
      },
      eliminated: {
        title: "ELIMINADO",
        fellIn: "Caíste en la jornada",
        extraLife: "Tienes una vida extra disponible.",
        gameOver: "Tu torneo ha terminado."
      },
      status: {
        alive: "Vivo",
        closesIn: "Cierra en"
      },
      instructions: {
        activePick: "Pick activo:",
        canChange: "Puedes cambiar hasta el pitazo inicial de ese partido.",
        noPick: "Toca el escudo del equipo que crees que",
        noPickBold: "ganará",
        noPickEnd: ". Solo una victoria te mantiene vivo."
      },
      board: {
        tbd: "Horario por confirmar",
        live: "EN VIVO",
        started: "Iniciado",
        empty: "Partidos de esta jornada por confirmar."
      },
      pickers: {
        guestTooltip: "Inicia sesión para participar",
        usedTooltip: "Ya utilizado en este torneo",
        lockedTooltip: "Este partido ya comenzó",
        win: "Victoria",
        draw: "Empate",
        loss: "Derrota",
        notPlayed: "No jugado",
        pick: "pick",
        used: "usado"
      },
      history: {
        title: "Historial de Picks",
        won: "Ganó",
        eliminated: "Eliminado",
        pending: "Pendiente"
      },
      goldenRule: {
        title: "Regla de Oro",
        usedTeams: "equipos usados"
      },
      jornadas: {
        j1: "Jornada 1 — Fase de Grupos",
        j2: "Jornada 2 — Fase de Grupos",
        j3: "Jornada 3 — Fase de Grupos",
        j4: "Dieciseisavos de Final",
        j5: "Octavos de Final",
        j6: "Cuartos de Final",
        j7: "Semifinales",
        j8: "Gran Final"
      }
    },

    rules: {
      tag: "Quiniela · Mundial 2026", title: "Reglamento Oficial", worldCup: "Mundial 2026", subtitle: "Lee con atención. Al adquirir tu pase aceptas estas reglas íntegramente.", formatTitle: "Formato de la Plataforma", formatDesc: "Al adquirir tu pase obtienes acceso a nuestros modos de juego.", classicTitle: "Modo Clásico", classicSub: "QUINIELA DE MARCADORES", classicDesc: "Pronostica el resultado exacto de los partidos del torneo y suma puntos en la Liga Global.", survivalTitle: "Modo Supervivencia", survivalSub: "MUERTE SÚBITA", survivalDesc: "Elige un equipo ganador por jornada para seguir con vida.", rulesClassicTitle: "Reglas del Modo Clásico", rulesClassicDesc: "Por cada partido, tus puntos dependen de qué tan cerca estuvo tu pronóstico del resultado real. Escala oficial:", pts5: "5 PTS", pts5Title: "Marcador Exacto", pts5Desc: "Acertaste el marcador exacto de ambos equipos. Ej: pronosticaste 2-0 y el resultado fue 2-0.", pts3: "3 PTS", pts3Title: "Ganador + Diferencia de Goles", pts3Desc: "Acertaste al ganador con la misma diferencia de goles, pero fallaste el marcador exacto. Ej: pronosticaste 3-1 y el resultado fue 2-0 (diferencia +2 en ambos).", pts1: "1 PTO", pts1Title: "Tendencia", pts1Desc: "Solo acertaste al ganador o empate, sin acertar la diferencia de goles ni el marcador exacto. Ej: pronosticaste 1-0 y el resultado fue 3-1.", pts0: "0 PTS", pts0Title: "Fallo", pts0Desc: "No acertaste ni al ganador ni al empate.", knockoutTitle: "Fase Eliminatoria", knockoutDesc: "Cuenta el marcador al término de los 120 minutos (tiempo reglamentario + prórroga). En caso de penales, debes seleccionar al equipo que avanza para obtener el punto de tendencia.", multTitle: "Multiplicadores por Fase", groups: "Grupos", r32: "32 de final", r16: "16 de final", r8: "8 de final", r4: "4 de final", semi: "Semifinal y 3er Puesto", finalMatch: "Final", bonusTitle: "Bonificaciones Especiales", bonus1a: "Bono de Campeón Exacto:", bonus1b: "Acertar correctamente al campeón del torneo otorga", bonus2a: "Goleador del Torneo:", bonus2b: "Acertar al jugador con más goles otorga", bonus3a: "Asistidor del Torneo:", bonus3b: "Acertar al jugador con más asistencias otorga", bonus4a: "Mejor Jugador Joven:", bonus4b: "Acertar al ganador oficial de este premio otorga", bonusExtras: "extras.", rulesSurvivalTitle: "Reglas del Modo Supervivencia", mechTitle: "Mecánica", mechDesc: "En cada una de las jornadas del torneo, elige a un solo equipo ganador antes de que cierre la ventana de picks.", surviveTitle: "Sobrevivir o Morir", surviveDesc: "Si tu equipo gana (en 90 o 120 minutos), avanzas a la siguiente jornada. Si EMPATA o PIERDE, tu estado pasa automáticamente a ELIMINADO.", goldenTitle: "Regla de Oro", goldenDesc1: "Está", goldenDescBold: "PROHIBIDO REPETIR EQUIPOS", goldenDesc2: "durante todo el torneo. Cada selección debe ser un equipo diferente.", lockTitle: "Bloqueo de Equipos Usados", lockDesc: "En la cartelera de cada jornada, los equipos que ya elegiste en jornadas anteriores aparecen deshabilitados.", closeTitle: "Cierre de Picks", closeDesc1: "Todos los pronósticos se bloquean automáticamente", closeDescBold: "15 minutos antes del pitazo inicial", closeDesc2: "de cada partido, sin excepciones ni apelaciones.", tieTitle: "Criterios de Desempate (Liga Global)", tie1: "Mayor cantidad de Marcadores Exactos (aciertos de 5 puntos).", tie2: "Mayor cantidad de Aciertos de Tendencia (aciertos de 1 punto).", prizeTitle: "Distribución de Premios", prizeClassic: "Bolsa Modo Clásico", prizeSurvival: "Bolsa Modo Supervivencia", place1: "1er Lugar", place2: "2do Lugar", place3: "3er Lugar", admin: "Administración", lastSurvivor: "Último Sobreviviente", prizeNote: "Si hay múltiples sobrevivientes al final, el 90% se divide en partes iguales entre ellos.", footerNote: "Reglamento sujeto a cambios menores. Versión vigente al inicio del torneo.",
    }
  },
  en: {
    liga: "League",
    miRendimiento: "My Performance",
    predecir: "Predict",
    supervivencia: "Survival",
    pase: "Pass",
    reglamento: "Rules",
    salir: "Log out",
    login: "Log in",
    registrarse: "Sign up",

    dashboard: {
      loading: "Loading global league...", title: "Global League", subtitle: "World Cup 2026 · Real-time standings", upgradeVip: "⬆ VIP", live: "LIVE", predictBtn: "+ Prediction", tabs: { classic: "Classic", survival: "Survival", predictions: "My Picks" }, tooltips: { classic: "5 pts: exact score · 3 pts: winner + diff · 1 pt: winner only · 0 pts: miss.", survival: "Choose one team per matchday. If they draw or lose, you are eliminated. You cannot repeat teams." }, tableClassic: { pos: "Pos", user: "User", pts: "Pts", total: "Total Points", exact: "Exact (5)", diff: "Diff (3)", tendency: "Tendency (1)", empty: "No data yet." }, tableSurvival: { user: "User", status: "Status", lastTeam: "Last team", alive: "ALIVE", eliminated: "ELIMINATED", empty: "No data yet." }, predictions: { empty: "You haven't made any predictions yet.", predictNow: "Predict now", match: "Match #", yourPrediction: "Your pick:", inProgress: "In progress:", actual: "Actual:", pts: "pts" }, outcomes: { exact: "Exact!", difference: "Winner + diff.", tendency: "Tendency", miss: "Missed", pending: "Pending" }, paywall: { survivalTitle: "Survival Mode locked", survivalDesc: "Activate your pass to view the survivors leaderboard and make your picks.", survivalBtn: "⬆ View VIP Pass", guestTitle: "Leaderboard locked", guestDesc: "Create your account to view the real-time ranking and join the Global League.", guestBtn: "Create free account" }, dailyFeed: { title: "Global Picks", live: "LIVE", scheduled: "UPCOMING", noPicks: "No one has predicted this match yet.", tendencyHome: "Home", tendencyDraw: "Draw", tendencyAway: "Away" }
    },

    matchCenter: {
      locale: "en-US", live: "LIVE", score: "score", grp: "GRP", grupo: "Group", finished: "FINISHED", finishedShort: "FT", today: "TODAY", liveToday: "Live · Today", todayMatches: "Today's Matches", updating: "updating...", radar: "My Radar · Upcoming", recentHistory: "Recent History", vs: "vs"
    },

    predict: {
      tag: "FLUID PREDICTOR · WORLD CUP 2026",
      title: "Simulate the full tournament",
      desc: "Each score updates the standings in real-time and propagates winners through the bracket to the Final.",
      closeTag: "EDITION CLOSES",
      closeTime: "15 mins before kick-off",
      groupsTitle: "Group Stage",
      groupsDesc: "Use [−] and [+] for the score. The live table on the right reorders instantly.",
      top2: "Top 2 + best 3rds qualify",
      table: { team: "Team", pts: "Pts", gd: "GD", gf: "GF" },
      thirds: {
        title: "Best Thirds",
        desc: "Select your 8 favorites and the FIFA algorithm will assign them without facing their group leader.",
        generatedTitle: "Best Thirds — Bracket Generated",
        generatedDesc: "The FIFA algorithm assigned the teams respecting the groups.",
        selectTitle: "Select the 8 Best Thirds",
        selectDesc: "Manually choose which 8 teams advance to the round of 32.",
        reset: "Reset",
        qualified: "Qualified",
        error: "No valid assignment for this selection (FIFA rule: no team can face the leader of their own group). Change at least one team.",
        confirmBtn: "✓ Confirm & Generate Knockouts",
        selectMore1: "Select ",
        selectMore2: " more team",
        selectMore3: "…"
      },
      knockout: {
        title: "Knockout Phase",
        desc: "Qualified teams fill the bracket automatically. Enter the score for each match and the winner advances.",
        thirdPlace: "Third Place",
        winner: "Winner",
        tie: "Draw — Resolve",
        extraTime: "⏱ Extra T.",
        penalties: "⚽ Penalties",
        etTitle: "⏱ Extra Time",
        etTie: "ET Draw — Penalties",
        r32: "Round of 32",
        r16: "Round of 16",
        qf: "Quarter-finals",
        sf: "Semi-finals",
        final: "Grand Final",
        champion: "CHAMPION"
      },
      special: {
        title: "Special Tournament Awards",
        desc: "Write your free predictions. Get +10 extra points for each correct guess at the end of the tournament.",
        scorer: "Tournament Top Scorer",
        scorerEx: "Ex. Kylian Mbappé",
        assist: "Top Assists Leader",
        assistEx: "Ex. Kevin De Bruyne",
        young: "Best Young Player",
        youngEx: "Ex. Lamine Yamal"
      },
      save: {
        success: "Picks saved",
        error: "Error saving — check your plan",
        saving: "Saving…",
        saved: "Saved",
        btn: "Save My Picks"
      }
    },

    survival: {
      tag: "LAST MAN STANDING · WORLD CUP 2026",
      desc: "Choose a team to win. If they draw or lose, you are eliminated. You cannot repeat teams.",
      guestBanner: {
        prefix: "You are viewing the board in guest mode.",
        link: "Create your account",
        suffix: "to make your picks."
      },
      eliminated: {
        title: "ELIMINATED",
        fellIn: "You fell in matchday",
        extraLife: "You have an extra life available.",
        gameOver: "Your tournament is over."
      },
      status: {
        alive: "Alive",
        closesIn: "Closes in"
      },
      instructions: {
        activePick: "Active pick:",
        canChange: "You can change until the match kicks off.",
        noPick: "Tap the shield of the team you think will",
        noPickBold: "win",
        noPickEnd: ". Only a victory keeps you alive."
      },
      board: {
        tbd: "Time to be confirmed",
        live: "LIVE",
        started: "Started",
        empty: "Matches for this matchday to be confirmed."
      },
      pickers: {
        guestTooltip: "Log in to participate",
        usedTooltip: "Already used in this tournament",
        lockedTooltip: "This match has already started",
        win: "Win",
        draw: "Draw",
        loss: "Loss",
        notPlayed: "Not played",
        pick: "pick",
        used: "used"
      },
      history: {
        title: "Picks History",
        won: "Won",
        eliminated: "Eliminated",
        pending: "Pending"
      },
      goldenRule: {
        title: "Golden Rule",
        usedTeams: "teams used"
      },
      jornadas: {
        j1: "Matchday 1 — Group Stage",
        j2: "Matchday 2 — Group Stage",
        j3: "Matchday 3 — Group Stage",
        j4: "Round of 32",
        j5: "Round of 16",
        j6: "Quarter-finals",
        j7: "Semi-finals",
        j8: "Grand Final"
      }
    },

    rules: {
      tag: "Pick'em · World Cup 2026", title: "Official Rules", worldCup: "World Cup 2026", subtitle: "Read carefully. By acquiring your pass you fully accept these rules.", formatTitle: "Platform Format", formatDesc: "By acquiring your pass you get access to our game modes.", classicTitle: "Classic Mode", classicSub: "SCORE PREDICTOR", classicDesc: "Predict the exact result of the tournament matches and score points in the Global League.", survivalTitle: "Survival Mode", survivalSub: "SUDDEN DEATH", survivalDesc: "Choose a winning team per matchday to stay alive.", rulesClassicTitle: "Classic Mode Rules", rulesClassicDesc: "For each match, your points depend on how close your prediction was to the actual result. Official scale:", pts5: "5 PTS", pts5Title: "Exact Score", pts5Desc: "You guessed the exact score of both teams. Ex: you predicted 2-0 and the result was 2-0.", pts3: "3 PTS", pts3Title: "Winner + Goal Difference", pts3Desc: "You guessed the winner with the same goal difference, but missed the exact score. Ex: you predicted 3-1 and the result was 2-0 (+2 difference in both).", pts1: "1 PT", pts1Title: "Trend", pts1Desc: "You only guessed the winner or draw, without hitting the goal difference or exact score. Ex: you predicted 1-0 and the result was 3-1.", pts0: "0 PTS", pts0Title: "Miss", pts0Desc: "You didn't guess the winner or the draw.", knockoutTitle: "Knockout Phase", knockoutDesc: "The score at the end of the 120 minutes (regular time + extra time) counts. In case of penalties, you must select the team that advances to get the trend point.", multTitle: "Phase Multipliers", groups: "Groups", r32: "Round of 32", r16: "Round of 16", r8: "Quarter-finals", r4: "Semi-finals", semi: "Semi & 3rd Place", finalMatch: "Final", bonusTitle: "Special Bonuses", bonus1a: "Exact Champion Bonus:", bonus1b: "Correctly guessing the tournament champion grants", bonus2a: "Tournament Top Scorer:", bonus2b: "Guessing the player with the most goals grants", bonus3a: "Tournament Top Assist:", bonus3b: "Guessing the player with the most assists grants", bonus4a: "Best Young Player:", bonus4b: "Guessing the official winner of this award grants", bonusExtras: "extra pts.", rulesSurvivalTitle: "Survival Mode Rules", mechTitle: "Mechanics", mechDesc: "In each matchday of the tournament, choose a single winning team before the pick window closes.", surviveTitle: "Survive or Die", surviveDesc: "If your team wins (in 90 or 120 minutes), you advance to the next matchday. If they DRAW or LOSE, your status automatically changes to ELIMINATED.", goldenTitle: "Golden Rule", goldenDesc1: "It is", goldenDescBold: "FORBIDDEN TO REPEAT TEAMS", goldenDesc2: "throughout the tournament. Each selection must be a different team.", lockTitle: "Used Teams Lock", lockDesc: "On each matchday's board, the teams you already chose in previous matchdays will appear disabled.", closeTitle: "Picks Closing", closeDesc1: "All predictions are automatically locked", closeDescBold: "15 minutes before kick-off", closeDesc2: "of each match, no exceptions or appeals.", tieTitle: "Tiebreaker Criteria (Global League)", tie1: "Highest amount of Exact Scores (5-point predictions).", tie2: "Highest amount of Trend Hits (1-point predictions).", prizeTitle: "Prize Distribution", prizeClassic: "Classic Mode Pool", prizeSurvival: "Survival Mode Pool", place1: "1st Place", place2: "2nd Place", place3: "3rd Place", admin: "Administration", lastSurvivor: "Last Survivor", prizeNote: "If there are multiple survivors at the end, 90% is divided equally among them.", footerNote: "Rules subject to minor changes. Current version at the start of the tournament.",
    }
  }
};