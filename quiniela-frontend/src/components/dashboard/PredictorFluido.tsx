"use client";

import { useReducer, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import api from "@/lib/api";
import { useUser } from "@/lib/useUser";
import { useLanguage } from "@/lib/LanguageContext";
import { translations } from "@/lib/translations";
import {
  buildTournamentSnapshotWithKnockout,
  assignThirdsToR32,
  resolveKnockoutWinner,
  getMatchLockState,
  buildFixturesFromAPI,
  buildStandings,
  buildThirdPlaceTable,
  t,
  type KnockoutSlot,
  type KnockoutScores,
  type ThirdSlotAssignments,
  type GroupMatch,
  type TournamentSnapshot,
} from "@/lib/classicPredictor";

// ─── State ────────────────────────────────────────────────────────────────────

type PredictorState = {
  knockoutScores: KnockoutScores;
  topScorer: string;
  topAssist: string;
  bestYoungPlayer: string;
};

type PredictorAction =
  | { type: "SET_KNOCKOUT"; slotId: string; side: "homeScore" | "awayScore"; value: number | null }
  | { type: "SET_PENALTY_WINNER"; slotId: string; winner: "home" | "away" }
  | { type: "SET_TIE_RESOLUTION"; slotId: string; resolution: "extraTime" | "penalties" | null }
  | { type: "SET_EXTRA_TIME_SCORE"; slotId: string; side: "extraTimeHome" | "extraTimeAway"; value: number }
  | { type: "SET_SPECIAL_PLAYER"; field: "topScorer" | "topAssist" | "bestYoungPlayer"; value: string }
  | { type: "HYDRATE"; knockoutScores: KnockoutScores; topScorer?: string; topAssist?: string; bestYoungPlayer?: string };

function predictorReducer(state: PredictorState, action: PredictorAction): PredictorState {
  switch (action.type) {
    case "SET_KNOCKOUT": {
      const cur = state.knockoutScores[action.slotId] ?? {};
      const updated = {
        ...cur,
        homeScore: cur.homeScore ?? 0,
        awayScore: cur.awayScore ?? 0,
        [action.side]: action.value,
      };
      if (updated.homeScore !== updated.awayScore) {
        delete updated.penaltyWinner;
        delete updated.tieResolution;
        delete updated.extraTimeHome;
        delete updated.extraTimeAway;
      }
      return { ...state, knockoutScores: { ...state.knockoutScores, [action.slotId]: updated } };
    }
    case "SET_PENALTY_WINNER":
      return {
        ...state,
        knockoutScores: {
          ...state.knockoutScores,
          [action.slotId]: {
            ...(state.knockoutScores[action.slotId] ?? { homeScore: null, awayScore: null }),
            penaltyWinner: action.winner,
          },
        },
      };
    case "SET_TIE_RESOLUTION": {
      const cur = state.knockoutScores[action.slotId] ?? { homeScore: null, awayScore: null };
      const { tieResolution: _t, extraTimeHome: _h, extraTimeAway: _a, penaltyWinner: _p, ...rest } = cur;
      return {
        ...state,
        knockoutScores: {
          ...state.knockoutScores,
          [action.slotId]: action.resolution === null ? rest : { ...rest, tieResolution: action.resolution },
        },
      };
    }
    case "SET_EXTRA_TIME_SCORE":
      return {
        ...state,
        knockoutScores: {
          ...state.knockoutScores,
          [action.slotId]: {
            ...(state.knockoutScores[action.slotId] ?? { homeScore: null, awayScore: null }),
            [action.side]: action.value,
          },
        },
      };
    case "SET_SPECIAL_PLAYER":
      return { ...state, [action.field]: action.value };
    case "HYDRATE":
      return {
        knockoutScores:  action.knockoutScores,
        topScorer:       action.topScorer       ?? "",
        topAssist:       action.topAssist       ?? "",
        bestYoungPlayer: action.bestYoungPlayer ?? "",
      };
    default:
      return state;
  }
}

const INITIAL_STATE: PredictorState = {
  knockoutScores:  {},
  topScorer:       "",
  topAssist:       "",
  bestYoungPlayer: "",
};

// ─── GoalStepper ──────────────────────────────────────────────────────────────

function GoalStepper({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const current = value ?? 0;
  const sm = size === "sm";
  const btn = cn(
    "flex items-center justify-center rounded-lg font-bold text-slate-300 select-none",
    "transition-all duration-150 active:scale-90",
    "disabled:opacity-25 disabled:cursor-not-allowed",
    sm
      ? "h-6 w-6 text-xs bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600"
      : "h-9 w-9 text-lg bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600"
  );
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" disabled={disabled || (value !== null && current <= 0)} onClick={() => onChange(Math.max(0, current - 1))} className={btn} aria-label="Restar gol">−</button>
      <span className={cn("tabular-nums font-extrabold text-white text-center", sm ? "w-4 text-sm" : "w-7 text-xl")}>{current}</span>
      <button type="button" disabled={disabled || current >= 20} onClick={() => onChange(Math.min(20, current + 1))} className={btn} aria-label="Sumar gol">+</button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTBD(team: string) {
  return (
    !team ||
    team.startsWith("Gan.") ||
    team.startsWith("Perd.") ||
    team === "Pendiente" ||
    team === "Por definir" ||
    team.startsWith("Pendiente")
  );
}

function Flag({ team, size = 20 }: { team: string; size?: 20 | 40 }) {
  const url = flagUrl(t(team), size);
  const cls = size === 40 ? "h-8 w-12" : "h-[14px] w-[21px]";
  if (!url || isTBD(team)) return <div className={cn(cls, "shrink-0 rounded-sm bg-slate-700/50")} />;
  return <img src={url} alt={t(team)} className={cn(cls, "shrink-0 rounded-sm object-cover shadow-sm")} />;
}

// ─── TieResolutionPanel ───────────────────────────────────────────────────────

function TieResolutionPanel({
  slot,
  score,
  dispatch,
}: {
  slot: KnockoutSlot;
  score: KnockoutScores[string] | undefined;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  const { language } = useLanguage();
  const dict = translations[language].predict;
  const resolution = score?.tieResolution;
  const pw = score?.penaltyWinner;
  const eth = typeof score?.extraTimeHome === "number" ? score.extraTimeHome : null;
  const eta = typeof score?.extraTimeAway === "number" ? score.extraTimeAway : null;
  const etDraw = eth !== null && eta !== null && eth === eta;

  const btnBack = (
    <button type="button" onClick={() => dispatch({ type: "SET_TIE_RESOLUTION", slotId: slot.id, resolution: null })} className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">↩</button>
  );

  const penaltyRow = (
    <div className="grid grid-cols-2 gap-1">
      {(["home", "away"] as const).map((side) => (
        <button key={side} type="button" onClick={() => dispatch({ type: "SET_PENALTY_WINNER", slotId: slot.id, winner: side })}
          className={cn("rounded py-1 text-[9px] font-bold truncate transition-all active:scale-95",
            pw === side ? "bg-purple-500 text-white shadow" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white")}>
          {t(side === "home" ? slot.home : slot.away)}
        </button>
      ))}
    </div>
  );

  if (!resolution) {
    return (
      <div className="border-t border-slate-700/40 bg-slate-900/80 p-2 space-y-1.5">
        <p className="text-center text-[9px] font-extrabold uppercase tracking-widest text-amber-400">{dict.knockout.tie}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => dispatch({ type: "SET_TIE_RESOLUTION", slotId: slot.id, resolution: "extraTime" })}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[9px] font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">{dict.knockout.extraTime}</button>
          <button type="button" onClick={() => dispatch({ type: "SET_TIE_RESOLUTION", slotId: slot.id, resolution: "penalties" })}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[9px] font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white">{dict.knockout.penalties}</button>
        </div>
      </div>
    );
  }

  if (resolution === "extraTime") {
    return (
      <div className="border-t border-slate-700/40 bg-slate-900/80 p-2 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400">{dict.knockout.etTitle}</p>
          {btnBack}
        </div>
        <div className="flex items-center justify-center gap-2">
          <GoalStepper size="sm" value={eth} onChange={(v) => dispatch({ type: "SET_EXTRA_TIME_SCORE", slotId: slot.id, side: "extraTimeHome", value: v ?? 0 })} />
          <span className="shrink-0 text-[9px] text-slate-700">—</span>
          <GoalStepper size="sm" value={eta} onChange={(v) => dispatch({ type: "SET_EXTRA_TIME_SCORE", slotId: slot.id, side: "extraTimeAway", value: v ?? 0 })} />
        </div>
        {etDraw && (
          <div className="space-y-1">
            <p className="text-center text-[9px] font-bold uppercase tracking-widest text-amber-400">{dict.knockout.etTie}</p>
            {penaltyRow}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-700/40 bg-slate-900/80 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">{dict.knockout.penalties}</p>
        {btnBack}
      </div>
      {penaltyRow}
    </div>
  );
}

// ─── BracketMatchBox ──────────────────────────────────────────────────────────

function BracketMatchBox({
  slot,
  score,
  dispatch,
}: {
  slot: KnockoutSlot;
  score: KnockoutScores[string] | undefined;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  const hs = score?.homeScore ?? null;
  const as_ = score?.awayScore ?? null;
  const pw = score?.penaltyWinner;
  const homeTBD = isTBD(slot.home);
  const awayTBD = isTBD(slot.away);
  const bothReal = !homeTBD && !awayTBD;
  const isLocked = !getMatchLockState(slot.kickoffTime, new Date(), bothReal).canEdit;
  const draw = hs !== null && as_ !== null && hs === as_;
  const homeWin = hs !== null && as_ !== null && (hs > as_ || (draw && pw === "home"));
  const awayWin = hs !== null && as_ !== null && (as_ > hs || (draw && pw === "away"));

  return (
    <div className={cn("w-[200px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80 shadow-lg backdrop-blur-xl", isLocked && bothReal && "opacity-60")}>
      <p className="border-b border-slate-700/40 bg-slate-950/60 px-2 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-widest text-slate-600">
        {slot.label}{isLocked && bothReal && " 🔒"}
      </p>
      {([
        { team: slot.home, win: homeWin, tbd: homeTBD, side: "homeScore" as const },
        { team: slot.away, win: awayWin, tbd: awayTBD, side: "awayScore" as const },
      ] as const).map(({ team, win, tbd, side }, idx) => (
        <div key={side} className={cn("flex items-center justify-between gap-1.5 px-2 py-1.5", idx === 0 && "border-b border-slate-700/40", win && "bg-blue-500/15")}>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Flag team={team} />
            <span className={cn("truncate text-xs leading-none", tbd ? "italic text-slate-600" : win ? "font-bold text-white" : "text-slate-300")}>
              {tbd ? "Por definir" : t(team)}
            </span>
          </div>
          <GoalStepper size="sm" value={side === "homeScore" ? hs : as_} disabled={!bothReal || isLocked}
            onChange={(v) => dispatch({ type: "SET_KNOCKOUT", slotId: slot.id, side, value: v })} />
        </div>
      ))}
      {draw && bothReal && <TieResolutionPanel slot={slot} score={score} dispatch={dispatch} />}
    </div>
  );
}

// ─── BracketColumn / BracketView ──────────────────────────────────────────────

const BRACKET_H = 1056;

function BracketColumn({ roundName, slots, knockoutScores, dispatch }: {
  roundName: string;
  slots: KnockoutSlot[];
  knockoutScores: KnockoutScores;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  return (
    <div className="flex shrink-0 flex-col w-[200px]" style={{ height: BRACKET_H }}>
      <p className="mb-3 shrink-0 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">{roundName}</p>
      <div className="flex flex-1 flex-col justify-around">
        {slots.map((slot) => (
          <BracketMatchBox key={slot.id} slot={slot} score={knockoutScores[slot.id]} dispatch={dispatch} />
        ))}
      </div>
    </div>
  );
}

function BracketView({ snapshot, knockoutScores, dispatch }: {
  snapshot: TournamentSnapshot;
  knockoutScores: KnockoutScores;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  const { language } = useLanguage();
  const dict = translations[language].predict;

  const leftR32  = snapshot.roundOf32.slice(0, 8);
  const leftR16  = snapshot.roundOf16.slice(0, 4);
  const leftQF   = snapshot.quarterFinals.slice(0, 2);
  const leftSF   = snapshot.semiFinals.slice(0, 1);

  const rightR32 = snapshot.roundOf32.slice(8, 16);
  const rightR16 = snapshot.roundOf16.slice(4, 8);
  const rightQF  = snapshot.quarterFinals.slice(2, 4);
  const rightSF  = snapshot.semiFinals.slice(1, 2);

  const finalSlot  = snapshot.final;
  const finalScore = knockoutScores[finalSlot.id];
  const champion   = resolveKnockoutWinner(finalSlot, finalScore ? { [finalSlot.id]: finalScore } : {});

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex min-w-max items-center justify-center gap-6 px-4">
        {/* RAMA IZQUIERDA */}
        <div className="flex gap-4">
          <BracketColumn roundName={dict.knockout.r32} slots={leftR32}  knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName={dict.knockout.r16} slots={leftR16}  knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName={dict.knockout.qf}  slots={leftQF}   knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName={dict.knockout.sf}  slots={leftSF}   knockoutScores={knockoutScores} dispatch={dispatch} />
        </div>

        {/* CENTRO */}
        <div className="flex shrink-0 flex-col items-center justify-center min-w-[300px] px-6" style={{ height: BRACKET_H }}>
          <div className="mb-14 flex flex-col items-center animate-in zoom-in duration-500">
            <img src="/trofeo.png" alt="Copa Mundial" className="mb-6 h-28 w-28 object-contain drop-shadow-[0_10px_25px_rgba(251,191,36,0.55)]" />
            <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white text-center drop-shadow-lg">
              {champion && !isTBD(champion) ? `${t(champion)} ${dict.knockout.champion}` : "MUNDIAL 2026"}
            </h3>
          </div>
          <div className="relative w-[260px]">
            <p className="absolute -top-7 left-0 right-0 text-center text-[12px] font-black uppercase tracking-[0.2em] text-amber-500 drop-shadow">{dict.knockout.final}</p>
            <div className="scale-110 shadow-2xl shadow-amber-500/20 rounded-xl">
              <BracketMatchBox slot={finalSlot} score={finalScore} dispatch={dispatch} />
            </div>
          </div>
        </div>

        {/* RAMA DERECHA */}
        <div className="flex gap-4">
          <BracketColumn roundName={dict.knockout.sf}  slots={rightSF}  knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName={dict.knockout.qf}  slots={rightQF}  knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName={dict.knockout.r16} slots={rightR16} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName={dict.knockout.r32} slots={rightR32} knockoutScores={knockoutScores} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}

// ─── FinalCard ────────────────────────────────────────────────────────────────

function FinalCard({ slot, score, dispatch, accent, emoji }: {
  slot: KnockoutSlot;
  score: KnockoutScores[string] | undefined;
  dispatch: React.Dispatch<PredictorAction>;
  accent: string;
  emoji: string;
}) {
  const { language } = useLanguage();
  const dict = translations[language].predict;
  const winner   = resolveKnockoutWinner(slot, score ? { [slot.id]: score } : {});
  const hs       = score?.homeScore ?? null;
  const as_      = score?.awayScore ?? null;
  const draw     = hs !== null && as_ !== null && hs === as_;
  const homeTBD  = isTBD(slot.home);
  const awayTBD  = isTBD(slot.away);
  const bothReal = !homeTBD && !awayTBD;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/60 shadow-xl flex flex-col justify-between">
      <div>
        <div className={cn("border-b border-slate-700/50 px-4 py-2.5", accent)}>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white"><span>{emoji}</span> {slot.label}</p>
        </div>
        <div className="space-y-2 p-4">
          {([
            { team: slot.home, side: "homeScore" as const, score: hs },
            { team: slot.away, side: "awayScore" as const, score: as_ },
          ] as const).map(({ team, side, score: sc }) => (
            <div key={side} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/40 bg-slate-900/60 px-3 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Flag team={team} size={20} />
                <span className={cn("truncate text-sm font-semibold", isTBD(team) ? "italic text-slate-500" : "text-white")}>
                  {isTBD(team) ? "Por definir" : t(team)}
                </span>
                {winner === team && !isTBD(team) && (
                  <span className="ml-1 shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">{dict.knockout.winner}</span>
                )}
              </div>
              <GoalStepper size="md" value={sc} disabled={!bothReal}
                onChange={(v) => dispatch({ type: "SET_KNOCKOUT", slotId: slot.id, side, value: v })} />
            </div>
          ))}
        </div>
      </div>
      {draw && bothReal && <TieResolutionPanel slot={slot} score={score} dispatch={dispatch} />}
    </div>
  );
}

// ─── Tipos Exportados ─────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "success" | "error";

export type ClassicPredictionData = {
  knockout_scores: KnockoutScores;
  bracket_snapshot?: Record<string, { home: string; away: string }>;
  top_scorer?: string;
  top_assist?: string;
  best_young_player?: string;
  awards_locked?: boolean;
};

// ─── Función para calcular los terceros clasificados reales ───────────────────

function computeRealThirdAssignments(realGroupFixtures: GroupMatch[]): ThirdSlotAssignments {
  if (!realGroupFixtures.length) return {};
  const standings = buildStandings(realGroupFixtures);
  const allThirds = buildThirdPlaceTable(standings).map((s) => ({ team: s.team, group: s.group }));
  if (allThirds.length < 8) return {};
  try {
    return assignThirdsToR32(allThirds.slice(0, 8)) || {};
  } catch {
    return {};
  }
}

// ─── PredictorFluido ──────────────────────────────────────────────────────────

export function PredictorFluido({ initialData }: { initialData?: ClassicPredictionData }) {
  const router = useRouter();
  const { user, planType } = useUser();
  const { language } = useLanguage();
  const dict = translations[language].predict;

  const [state, dispatch]   = useReducer(predictorReducer, INITIAL_STATE);
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>("idle");
  const [isLoading, setIsLoading]     = useState(true);
  const [awardsLocked, setAwardsLocked] = useState(false);

  // Partidos reales de grupos (cargados una vez desde la API, no editables)
  const [realGroupFixtures, setRealGroupFixtures] = useState<GroupMatch[]>([]);

  // Asignaciones reales de terceros (calculadas a partir de las clasificaciones reales)
  const [autoThirdAssignments, setAutoThirdAssignments] = useState<ThirdSlotAssignments>({});

  useEffect(() => {
    api.get("/matches/all", { headers: { "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" } })
      .then((matchesRes) => {
        // Construir fixtures de grupo desde los partidos reales
        const fixtures = buildFixturesFromAPI(matchesRes.data);
        setRealGroupFixtures(fixtures);

        // Auto-calcular qué terceros clasifican según standings reales
        setAutoThirdAssignments(computeRealThirdAssignments(fixtures));

        // Cargar picks guardados del usuario
        const loadData: Promise<ClassicPredictionData | null> = initialData
          ? Promise.resolve(initialData)
          : api.get("/predictions/classic").then((r) => r.data as ClassicPredictionData).catch(() => null);

        loadData
          .then((data) => {
            dispatch({
              type: "HYDRATE",
              knockoutScores:  data?.knockout_scores  ?? {},
              topScorer:       data?.top_scorer       ?? "",
              topAssist:       data?.top_assist       ?? "",
              bestYoungPlayer: data?.best_young_player ?? "",
            });
            setAwardsLocked(data?.awards_locked ?? false);
          })
          .finally(() => setIsLoading(false));
      })
      .catch(() => {
        toast.error("Error al cargar el calendario oficial.");
        setIsLoading(false);
      });
  }, [initialData]);

  // Bracket calculado desde standings REALES + picks de eliminatoria del usuario.
  // Los slots de R32 muestran los equipos que REALMENTE clasificaron.
  // Los slots de R16/QF/SF/Final se propagan desde los picks del usuario.
  const snapshot = useMemo(
    () => buildTournamentSnapshotWithKnockout(realGroupFixtures, state.knockoutScores, autoThirdAssignments),
    [realGroupFixtures, state.knockoutScores, autoThirdAssignments]
  );

  const handleSave = useCallback(async () => {
    if (!user) {
      toast.error("¡Regístrate para guardar tu quiniela y competir!");
      router.push("/login");
      return;
    }
    if (planType === "basic") {
      toast.error("Activa tu Pase Clásico para guardar tus pronósticos.");
      router.push("/dashboard/checkout");
      return;
    }

    // Construir bracket_snapshot desde el estado actual del bracket
    // (para que el motor de puntuación pueda encontrar partidos por nombre)
    const bracketSnapshot: Record<string, { home: string; away: string }> = {};
    const allSlots = [
      ...snapshot.roundOf32,
      ...snapshot.roundOf16,
      ...snapshot.quarterFinals,
      ...snapshot.semiFinals,
      snapshot.thirdPlace,
      snapshot.final,
    ];
    for (const slot of allSlots) {
      if (!isTBD(slot.home) && !isTBD(slot.away)) {
        bracketSnapshot[slot.id] = { home: slot.home, away: slot.away };
      }
    }

    setSaveStatus("saving");
    try {
      await api.post("/predictions/classic", {
        knockout_scores:   state.knockoutScores,
        bracket_snapshot:  bracketSnapshot,
        top_scorer:        state.topScorer,
        top_assist:        state.topAssist,
        best_young_player: state.bestYoungPlayer,
      });
      setSaveStatus("success");
      toast.success(dict.save.success);
      setTimeout(() => router.push("/dashboard/rendimiento"), 1200);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setSaveStatus("error");
      toast.error(status === 403 ? dict.save.error : "Hubo un problema al guardar tu quiniela.");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [state.knockoutScores, state.topScorer, state.topAssist, state.bestYoungPlayer, snapshot, router, user, planType, dict]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-800/90 to-slate-900 px-6 py-5">
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-purple-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-lime-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">{dict.tag}</p>
            <h2 className="mt-1.5 text-xl font-bold text-white">{dict.title}</h2>
            <p className="mt-1 max-w-lg text-sm leading-6 text-slate-400">{dict.desc}</p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-2.5 text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{dict.closeTag}</p>
            <p className="mt-0.5 text-sm font-extrabold text-cyan-400">{dict.closeTime}</p>
          </div>
        </div>
      </div>

      {/* ── Bracket Eliminatorio (siempre visible) ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">{dict.knockout.title}</h3>
          <p className="text-xs text-slate-400">{dict.knockout.desc}</p>
        </div>

        {realGroupFixtures.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-950/40 text-sm text-slate-500">
            Cargando bracket del Mundial…
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
            <BracketView snapshot={snapshot} knockoutScores={state.knockoutScores} dispatch={dispatch} />
          </div>
        )}
      </section>

      {/* ── Tercer Lugar ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">{dict.knockout.thirdPlace}</h3>
        <div className="max-w-md">
          <FinalCard
            slot={snapshot.thirdPlace}
            score={state.knockoutScores[snapshot.thirdPlace.id]}
            dispatch={dispatch}
            accent="bg-slate-800/60"
            emoji="🥉"
          />
        </div>
      </section>

      {/* ── Premios Especiales ── */}
      <section className="space-y-4 rounded-2xl border border-cyan-500/25 bg-slate-900/60 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <span className="text-xl">🏆</span>
          <div className="flex-1">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-cyan-400">{dict.special.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{dict.special.desc}</p>
          </div>
          {awardsLocked && (
            <span className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-950/60 px-2.5 py-1 text-xs font-bold text-amber-400">🔒 Bloqueado</span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider">{dict.special.scorer}</label>
            <input type="text" placeholder={dict.special.scorerEx} value={state.topScorer} disabled={awardsLocked}
              onChange={(e) => dispatch({ type: "SET_SPECIAL_PLAYER", field: "topScorer", value: e.target.value })}
              className={cn("w-full rounded-xl border p-3 text-sm transition-all",
                awardsLocked ? "border-slate-700/50 bg-slate-800/20 text-slate-400 cursor-not-allowed"
                  : "border-slate-700 bg-slate-800/40 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500")} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider">{dict.special.assist}</label>
            <input type="text" placeholder={dict.special.assistEx} value={state.topAssist} disabled={awardsLocked}
              onChange={(e) => dispatch({ type: "SET_SPECIAL_PLAYER", field: "topAssist", value: e.target.value })}
              className={cn("w-full rounded-xl border p-3 text-sm transition-all",
                awardsLocked ? "border-slate-700/50 bg-slate-800/20 text-slate-400 cursor-not-allowed"
                  : "border-slate-700 bg-slate-800/40 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500")} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider">{dict.special.young}</label>
            <input type="text" placeholder={dict.special.youngEx} value={state.bestYoungPlayer} disabled={awardsLocked}
              onChange={(e) => dispatch({ type: "SET_SPECIAL_PLAYER", field: "bestYoungPlayer", value: e.target.value })}
              className={cn("w-full rounded-xl border p-3 text-sm transition-all",
                awardsLocked ? "border-slate-700/50 bg-slate-800/20 text-slate-400 cursor-not-allowed"
                  : "border-slate-700 bg-slate-800/40 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500")} />
          </div>
        </div>
      </section>

      {/* ── Botón Guardar ── */}
      <div className="sticky bottom-4 flex justify-center pb-8 z-50">
        <div className="relative">
          {saveStatus === "success" && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-lime-500/30 bg-lime-950/90 px-4 py-2 text-xs font-semibold text-lime-300 shadow-xl backdrop-blur-sm">{dict.save.success}</div>
          )}
          {saveStatus === "error" && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-2 text-xs font-semibold text-red-300 shadow-xl backdrop-blur-sm">{dict.save.error}</div>
          )}
          <button type="button" disabled={saveStatus === "saving"} onClick={handleSave}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-6 py-3 text-sm font-bold shadow-2xl backdrop-blur-sm",
              "transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              saveStatus === "success" ? "border-lime-500/40 bg-lime-950/80 text-lime-300"
                : saveStatus === "error" ? "border-red-500/40 bg-red-950/80 text-red-300"
                  : "border-fuchsia-500/30 bg-fuchsia-950/80 text-white hover:bg-fuchsia-900/80"
            )}>
            {saveStatus === "saving" ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />{dict.save.saving}</>
            ) : saveStatus === "success" ? dict.save.saved : dict.save.btn}
          </button>
        </div>
      </div>
    </div>
  );
}
