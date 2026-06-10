"use client";

import { useReducer, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import api from "@/lib/api";
import {
  buildTournamentSnapshotWithKnockout,
  assignThirdsToR32,
  resolveKnockoutWinner,
  getMatchLockState,
  GROUP_ORDER,
  buildFixturesFromAPI,
  buildKnockoutOverlayFromAPI,
  buildStandings,
  t,
  type GroupMatch,
  type GroupStanding,
  type KnockoutSlot,
  type KnockoutScores,
  type ThirdSlotAssignments,
} from "@/lib/classicPredictor";

const PENDING_TIEBREAK_DISPLAY = "Pendiente de desempate";

// ─── State ────────────────────────────────────────────────────────────────────

type PredictorState = {
  groupFixtures: GroupMatch[];
  knockoutScores: KnockoutScores;
  selectedThirds: string[];
  thirdAssignments: ThirdSlotAssignments;
  isBracketGenerated: boolean;
};

type PredictorAction =
  | { type: "SET_GROUP"; matchId: string; side: "homeScore" | "awayScore"; value: number | null }
  | { type: "SET_KNOCKOUT"; slotId: string; side: "homeScore" | "awayScore"; value: number | null }
  | { type: "SET_PENALTY_WINNER"; slotId: string; winner: "home" | "away" }
  | { type: "TOGGLE_THIRD"; team: string }
  | { type: "GENERATE_BRACKET"; assignments: ThirdSlotAssignments }
  | { type: "RESET_BRACKET" }
  | { type: "SET_TIE_RESOLUTION"; slotId: string; resolution: "extraTime" | "penalties" | null }
  | { type: "SET_EXTRA_TIME_SCORE"; slotId: string; side: "extraTimeHome" | "extraTimeAway"; value: number }
  | { type: "HYDRATE_STATE"; baseFixtures: GroupMatch[]; groupFixtures: GroupMatch[]; knockoutScores: KnockoutScores; selectedThirds?: string[]; thirdAssignments?: ThirdSlotAssignments; isBracketGenerated?: boolean }
  | { type: "CLEAN_STALE_THIRDS"; validThirdTeams: Set<string> };

function predictorReducer(state: PredictorState, action: PredictorAction): PredictorState {
  switch (action.type) {
    case "SET_GROUP":
      return {
        ...state,
        groupFixtures: state.groupFixtures.map((m) =>
          m.id === action.matchId ? { ...m, [action.side]: action.value } : m
        ),
      };
    case "SET_KNOCKOUT": {
      const currentScore = state.knockoutScores[action.slotId] ?? {};
      const updated = {
        ...currentScore,
        homeScore: currentScore.homeScore ?? 0,
        awayScore: currentScore.awayScore ?? 0,
        [action.side]: action.value,
      };

      if (updated.homeScore !== updated.awayScore) {
        delete updated.penaltyWinner;
        delete updated.tieResolution;
        delete updated.extraTimeHome;
        delete updated.extraTimeAway;
      }

      return {
        ...state,
        knockoutScores: { ...state.knockoutScores, [action.slotId]: updated },
      };
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
      const current = state.knockoutScores[action.slotId] ?? { homeScore: null, awayScore: null };
      const { tieResolution: _old, extraTimeHome: _eth, extraTimeAway: _eta, penaltyWinner: _pw, ...rest } = current;
      return {
        ...state,
        knockoutScores: {
          ...state.knockoutScores,
          [action.slotId]: action.resolution === null
            ? rest
            : { ...rest, tieResolution: action.resolution },
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
    case "TOGGLE_THIRD": {
      const already = state.selectedThirds.includes(action.team);
      return {
        ...state,
        selectedThirds: already
          ? state.selectedThirds.filter((t) => t !== action.team)
          : [...state.selectedThirds, action.team],
      };
    }
    case "GENERATE_BRACKET":
      return {
        ...state,
        thirdAssignments: action.assignments,
        isBracketGenerated: true,
      };
    case "RESET_BRACKET":
      return {
        ...state,
        thirdAssignments: {},
        isBracketGenerated: false,
      };
    case "HYDRATE_STATE":
      return {
        groupFixtures:      mergeAndNormalizeFixtures(action.groupFixtures, action.baseFixtures),
        knockoutScores:     action.knockoutScores,
        selectedThirds:     action.selectedThirds     ?? [],
        thirdAssignments:   action.thirdAssignments   ?? {},
        isBracketGenerated: action.isBracketGenerated ?? false,
      };
    case "CLEAN_STALE_THIRDS": {
      const cleaned = state.selectedThirds.filter(t => action.validThirdTeams.has(t));
      if (cleaned.length === state.selectedThirds.length) return state;
      // Any team that moved out of 3rd place invalidates the saved assignments.
      return {
        ...state,
        selectedThirds: cleaned,
        thirdAssignments: {},
        isBracketGenerated: false,
      };
    }
    default:
      return state;
  }
}

const INITIAL_STATE: PredictorState = {
  groupFixtures: [],
  knockoutScores: {},
  selectedThirds: [],
  thirdAssignments: {},
  isBracketGenerated: false,
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
      <button
        type="button"
        disabled={disabled || (value !== null && current <= 0)}
        onClick={() => onChange(Math.max(0, current - 1))}
        className={btn}
        aria-label="Restar gol"
      >
        −
      </button>
      <span
        className={cn(
          "tabular-nums font-extrabold text-white text-center",
          sm ? "w-4 text-sm" : "w-7 text-xl"
        )}
      >
        {current}
      </span>
      <button
        type="button"
        disabled={disabled || current >= 20}
        onClick={() => onChange(Math.min(20, current + 1))}
        className={btn}
        aria-label="Sumar gol"
      >
        +
      </button>
    </div>
  );
}

// ─── Flag ─────────────────────────────────────────────────────────────────────

function Flag({ team, size = 20 }: { team: string; size?: 20 | 40 }) {
  const url = flagUrl(t(team), size);
  const cls = size === 40 ? "h-8 w-12" : "h-[14px] w-[21px]";

  if (!url || isTBD(team)) {
    return <div className={cn(cls, "shrink-0 rounded-sm bg-slate-700/50")} />;
  }

  return (
    <img
      src={url}
      alt={t(team)}
      className={cn(cls, "shrink-0 rounded-sm object-cover shadow-sm")}
    />
  );
}

// ─── GroupMatchRow ────────────────────────────────────────────────────────────

function GroupMatchRow({
  match,
  dispatch,
}: {
  match: GroupMatch;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  const isLocked = !getMatchLockState(match.kickoffTime).canEdit;

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_20px_auto_1fr] items-center gap-2 rounded-xl px-3 py-2",
        "border border-slate-700/40 bg-slate-900/50 transition-opacity",
        isLocked && "opacity-50"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Flag team={match.homeTeam} />
        <span className="truncate text-xs font-semibold text-slate-200">{t(match.homeTeam)}</span>
      </div>

      <GoalStepper
        size="sm"
        value={match.homeScore}
        disabled={isLocked}
        onChange={(v) =>
          dispatch({ type: "SET_GROUP", matchId: match.id, side: "homeScore", value: v })
        }
      />

      <span className="text-center text-[10px] text-slate-700">—</span>

      <GoalStepper
        size="sm"
        value={match.awayScore}
        disabled={isLocked}
        onChange={(v) =>
          dispatch({ type: "SET_GROUP", matchId: match.id, side: "awayScore", value: v })
        }
      />

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <span className="truncate text-xs font-semibold text-slate-200">{t(match.awayTeam)}</span>
        <Flag team={match.awayTeam} />
      </div>
    </div>
  );
}

// ─── MiniTable ────────────────────────────────────────────────────────────────

function MiniTable({ group, standings }: { group: string; standings: GroupStanding[] }) {
  const [flashes, setFlashes] = useState<Record<string, "up" | "down">>({});
  const prevOrderRef = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevOrderRef.current;
    const curr = standings.map((s) => s.team);

    prevOrderRef.current = curr;

    if (prev.length > 0) {
      const next: Record<string, "up" | "down"> = {};
      curr.forEach((team, idx) => {
        const prevIdx = prev.indexOf(team);
        if (prevIdx !== -1 && prevIdx !== idx) {
          next[team] = idx < prevIdx ? "up" : "down";
        }
      });

      if (Object.keys(next).length > 0) {
        setFlashes(next);
        const timeoutId = setTimeout(() => setFlashes({}), 700);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [standings]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/40 text-xs">
      <div className="border-b border-slate-700/40 bg-slate-900/80 px-3 py-1.5">
        <p className="font-extrabold uppercase tracking-[0.2em] text-slate-400">
          Grupo {group}
        </p>
      </div>
      <div className="grid grid-cols-[18px_1fr_26px_26px_26px] gap-1 border-b border-slate-800 bg-slate-950/70 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
        <span>#</span>
        <span>Equipo</span>
        <span className="text-center">Pts</span>
        <span className="text-center">DG</span>
        <span className="text-center">GF</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {standings.map((s, i) => (
          <div
            key={s.team}
            className={cn(
              "grid grid-cols-[18px_1fr_26px_26px_26px] items-center gap-1 px-3 py-1.5",
              "transition-colors duration-500",
              i === 0 && "bg-purple-500/15",
              i === 1 && "bg-fuchsia-500/10",
              flashes[s.team] === "up" && "!bg-emerald-400/25",
              flashes[s.team] === "down" && "!bg-red-400/15"
            )}
          >
            <span
              className={cn(
                "text-[11px] font-bold",
                i === 0 ? "text-purple-300" : i === 1 ? "text-fuchsia-300" : "text-slate-600"
              )}
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 items-center gap-1.5">
              <Flag team={s.team} />
              <span className="truncate font-medium text-slate-200">{t(s.team)}</span>
            </div>
            <span className="text-center font-bold text-white">{s.pts}</span>
            <span className={cn("text-center text-slate-400", s.gd > 0 && "text-lime-400/80")}>
              {s.gd > 0 ? `+${s.gd}` : s.gd}
            </span>
            <span className="text-center text-slate-400">{s.gf}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  fixtures,
  standings,
  dispatch,
}: {
  group: string;
  fixtures: GroupMatch[];
  standings: GroupStanding[];
  dispatch: React.Dispatch<PredictorAction>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/60 px-4 py-2.5">
        <span className="text-sm font-extrabold uppercase tracking-[0.2em] text-white">
          Grupo {group}
        </span>
        <span className="text-[10px] text-slate-600">Top 2 + mejores 3ros califican</span>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_210px]">
        <div className="space-y-1.5">
          {fixtures.map((m) => (
            <GroupMatchRow key={m.id} match={m} dispatch={dispatch} />
          ))}
        </div>
        <MiniTable group={group} standings={standings} />
      </div>
    </div>
  );
}

// ─── BracketMatchBox ──────────────────────────────────────────────────────────

function isTBD(team: string) {
  return (
    team.startsWith("Gan.") ||
    team.startsWith("Perd.") ||
    team === "Pendiente" ||
    team === PENDING_TIEBREAK_DISPLAY
  );
}

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
  const isLocked = !getMatchLockState(slot.kickoffTime).canEdit;

  const draw = hs !== null && as_ !== null && hs === as_;
  const homeWin = hs !== null && as_ !== null && (hs > as_ || (draw && pw === "home"));
  const awayWin = hs !== null && as_ !== null && (as_ > hs || (draw && pw === "away"));

  return (
    <div className={cn(
      "w-[200px] overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80 shadow-lg backdrop-blur-xl",
      isLocked && "opacity-60"
    )}>
      <p className="border-b border-slate-700/40 bg-slate-950/60 px-2 py-0.5 text-center text-[9px] font-extrabold uppercase tracking-widest text-slate-600">
        {slot.label}{isLocked && " 🔒"}
      </p>
      {([
        { team: slot.home, win: homeWin, tbd: homeTBD, side: "homeScore" as const },
        { team: slot.away, win: awayWin, tbd: awayTBD, side: "awayScore" as const },
      ] as const).map(({ team, win, tbd, side }, idx) => (
        <div
          key={side}
          className={cn(
            "flex items-center justify-between gap-1.5 px-2 py-1.5",
            idx === 0 && "border-b border-slate-700/40",
            win && "bg-blue-500/15"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Flag team={team} />
            <span
              className={cn(
                "truncate text-xs leading-none",
                tbd ? "italic text-slate-600" : win ? "font-bold text-white" : "text-slate-300"
              )}
            >
              {t(team)}
            </span>
          </div>
          <GoalStepper
            size="sm"
            value={side === "homeScore" ? hs : as_}
            disabled={!bothReal || isLocked}
            onChange={(v) =>
              dispatch({ type: "SET_KNOCKOUT", slotId: slot.id, side, value: v })
            }
          />
        </div>
      ))}
      {draw && bothReal && (
        <TieResolutionPanel slot={slot} score={score} dispatch={dispatch} />
      )}
    </div>
  );
}

// ─── Diseño de Árbol Convergente (BracketView) ────────────────────────────────

const BRACKET_H = 1056;

function BracketColumn({
  roundName,
  slots,
  knockoutScores,
  dispatch,
}: {
  roundName: string;
  slots: KnockoutSlot[];
  knockoutScores: KnockoutScores;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  return (
    <div className="flex shrink-0 flex-col w-[200px]" style={{ height: BRACKET_H }}>
      <p className="mb-3 shrink-0 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
        {roundName}
      </p>
      <div className="flex flex-1 flex-col justify-around">
        {slots.map((slot) => (
          <BracketMatchBox
            key={slot.id}
            slot={slot}
            score={knockoutScores[slot.id]}
            dispatch={dispatch}
          />
        ))}
      </div>
    </div>
  );
}

function BracketView({
  snapshot,
  knockoutScores,
  dispatch,
}: {
  snapshot: ReturnType<typeof buildTournamentSnapshotWithKnockout>;
  knockoutScores: KnockoutScores;
  dispatch: React.Dispatch<PredictorAction>;
}) {
  const leftR32 = snapshot.roundOf32.slice(0, 8);
  const leftR16 = snapshot.roundOf16.slice(0, 4);
  const leftQF = snapshot.quarterFinals.slice(0, 2);
  const leftSF = [snapshot.semiFinals[0]];

  const rightR32 = snapshot.roundOf32.slice(8, 16);
  const rightR16 = snapshot.roundOf16.slice(4, 8);
  const rightQF = snapshot.quarterFinals.slice(2, 4);
  const rightSF = [snapshot.semiFinals[1]];

  const finalSlot = snapshot.final;
  const finalScore = knockoutScores[finalSlot.id];
  const champion = finalSlot ? resolveKnockoutWinner(finalSlot, finalScore ? { [finalSlot.id]: finalScore } : {}) : null;

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex min-w-max items-center justify-center gap-6 px-4">
        
        {/* RAMA IZQUIERDA */}
        <div className="flex gap-4">
          <BracketColumn roundName="16vos" slots={leftR32} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName="Octavos" slots={leftR16} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName="Cuartos" slots={leftQF} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName="Semifinal" slots={leftSF} knockoutScores={knockoutScores} dispatch={dispatch} />
        </div>

        {/* CENTRO (TROFEO Y GRAN FINAL) */}
        <div className="flex shrink-0 flex-col items-center justify-center min-w-[300px] px-6" style={{ height: BRACKET_H }}>
          <div className="mb-14 flex flex-col items-center animate-in zoom-in duration-500">
            <img
              src="/trofeo.png"
              alt="Copa Mundial"
              className="mb-6 h-28 w-28 object-contain drop-shadow-[0_10px_25px_rgba(251,191,36,0.55)]"
            />
            <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white text-center drop-shadow-lg">
              {champion ? `${t(champion)} CAMPEÓN` : "MUNDIAL 2026"}
            </h3>
          </div>

          <div className="relative w-[260px]">
            <p className="absolute -top-7 left-0 right-0 text-center text-[12px] font-black uppercase tracking-[0.2em] text-amber-500 drop-shadow">
              Gran Final
            </p>
            <div className="scale-110 shadow-2xl shadow-amber-500/20 rounded-xl">
              <BracketMatchBox slot={finalSlot} score={finalScore} dispatch={dispatch} />
            </div>
          </div>
        </div>

        {/* RAMA DERECHA */}
        <div className="flex gap-4">
          <BracketColumn roundName="Semifinal" slots={rightSF} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName="Cuartos" slots={rightQF} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName="Octavos" slots={rightR16} knockoutScores={knockoutScores} dispatch={dispatch} />
          <BracketColumn roundName="16vos" slots={rightR32} knockoutScores={knockoutScores} dispatch={dispatch} />
        </div>

      </div>
    </div>
  );
}

// ─── ThirdPlaceRanking ────────────────────────────────────────────────────────

function ThirdPlaceRanking({ standings }: { standings: GroupStanding[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/40 text-sm">
      <div className="grid grid-cols-[32px_40px_1fr_40px_40px_40px] gap-2 border-b border-slate-700/40 bg-slate-950/70 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
        <span>#</span>
        <span>Grp</span>
        <span>Equipo</span>
        <span className="text-center">Pts</span>
        <span className="text-center">DG</span>
        <span className="text-center">GF</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {standings.map((s, i) => (
          <div
            key={`3rd-${s.group}-${s.team}`}
            className={cn(
              "grid grid-cols-[32px_40px_1fr_40px_40px_40px] items-center gap-2 px-4 py-2.5",
              "transition-colors",
              i < 8 ? "bg-amber-500/5" : "bg-transparent"
            )}
          >
            <span
              className={cn(
                "text-xs font-extrabold",
                i < 8 ? "text-amber-300" : "text-slate-600"
              )}
            >
              {i + 1}
            </span>
            <span className="text-xs font-bold text-slate-500">{s.group}</span>
            <div className="flex min-w-0 items-center gap-2">
              <Flag team={s.team} />
              <span className="truncate font-semibold text-slate-200">{t(s.team)}</span>
            </div>
            <span className="text-center font-bold text-white">{s.pts}</span>
            <span className={cn("text-center text-slate-400", s.gd > 0 && "text-lime-400/80")}>
              {s.gd > 0 ? `+${s.gd}` : s.gd}
            </span>
            <span className="text-center text-slate-400">{s.gf}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FinalCard ────────────────────────────────────────────────────────────────

function FinalCard({
  slot,
  score,
  dispatch,
  accent,
  emoji,
}: {
  slot: KnockoutSlot;
  score: KnockoutScores[string] | undefined;
  dispatch: React.Dispatch<PredictorAction>;
  accent: string;
  emoji: string;
}) {
  const winner = resolveKnockoutWinner(slot, score ? { [slot.id]: score } : {});
  const hs = score?.homeScore ?? null;
  const as_ = score?.awayScore ?? null;
  const pw = score?.penaltyWinner;
  const homeTBD = isTBD(slot.home);
  const awayTBD = isTBD(slot.away);
  const bothReal = !homeTBD && !awayTBD;
  const draw = hs !== null && as_ !== null && hs === as_;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/60 shadow-xl flex flex-col justify-between">
      <div>
        <div className={cn("border-b border-slate-700/50 px-4 py-2.5", accent)}>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white">
            <span>{emoji}</span> {slot.label}
          </p>
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
                  {t(team)}
                </span>
                {winner === team && (
                  <span className="ml-1 shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                    Ganador
                  </span>
                )}
              </div>
              <GoalStepper
                size="md"
                value={sc}
                disabled={!bothReal}
                onChange={(v) =>
                  dispatch({ type: "SET_KNOCKOUT", slotId: slot.id, side, value: v })
                }
              />
            </div>
          ))}
        </div>
      </div>
      {draw && bothReal && (
        <TieResolutionPanel slot={slot} score={score} dispatch={dispatch} />
      )}
    </div>
  );
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
  const resolution = score?.tieResolution;
  const pw = score?.penaltyWinner;
  const eth = typeof score?.extraTimeHome === "number" ? score.extraTimeHome : null;
  const eta = typeof score?.extraTimeAway === "number" ? score.extraTimeAway : null;
  const etDraw = eth !== null && eta !== null && eth === eta;

  const btnBack = (
    <button
      type="button"
      onClick={() => dispatch({ type: "SET_TIE_RESOLUTION", slotId: slot.id, resolution: null })}
      className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
    >
      ↩
    </button>
  );

  const penaltyRow = (
    <div className="grid grid-cols-2 gap-1">
      {(["home", "away"] as const).map((side) => (
        <button
          key={side}
          type="button"
          onClick={() => dispatch({ type: "SET_PENALTY_WINNER", slotId: slot.id, winner: side })}
          className={cn(
            "rounded py-1 text-[9px] font-bold truncate transition-all active:scale-95",
            pw === side
              ? "bg-purple-500 text-white shadow"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
          )}
        >
          {t(side === "home" ? slot.home : slot.away)}
        </button>
      ))}
    </div>
  );

  if (!resolution) {
    return (
      <div className="border-t border-slate-700/40 bg-slate-900/80 p-2 space-y-1.5">
        <p className="text-center text-[9px] font-extrabold uppercase tracking-widest text-amber-400">
          Empate — Resolver
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_TIE_RESOLUTION", slotId: slot.id, resolution: "extraTime" })}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[9px] font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ⏱ T. Extra
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_TIE_RESOLUTION", slotId: slot.id, resolution: "penalties" })}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[9px] font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ⚽ Penales
          </button>
        </div>
      </div>
    );
  }

  if (resolution === "extraTime") {
    return (
      <div className="border-t border-slate-700/40 bg-slate-900/80 p-2 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400">⏱ Tiempo Extra</p>
          {btnBack}
        </div>
        <div className="flex items-center justify-center gap-2">
          <GoalStepper
            size="sm"
            value={eth}
            onChange={(v) =>
              dispatch({ type: "SET_EXTRA_TIME_SCORE", slotId: slot.id, side: "extraTimeHome", value: v ?? 0 })
            }
          />
          <span className="shrink-0 text-[9px] text-slate-700">—</span>
          <GoalStepper
            size="sm"
            value={eta}
            onChange={(v) =>
              dispatch({ type: "SET_EXTRA_TIME_SCORE", slotId: slot.id, side: "extraTimeAway", value: v ?? 0 })
            }
          />
        </div>
        {etDraw && (
          <div className="space-y-1">
            <p className="text-center text-[9px] font-bold uppercase tracking-widest text-amber-400">
              ET Empate — Penales
            </p>
            {penaltyRow}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-700/40 bg-slate-900/80 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-amber-400">⚽ Penales</p>
        {btnBack}
      </div>
      {penaltyRow}
    </div>
  );
}

// ─── ThirdPlaceSelector ───────────────────────────────────────────────────────

function ThirdPlaceSelector({
  allThirds,
  selected,
  isBracketGenerated,
  assignError,
  dispatch,
  onConfirm,
}: {
  allThirds: GroupStanding[];
  selected: string[];
  isBracketGenerated: boolean;
  assignError: boolean;
  dispatch: React.Dispatch<PredictorAction>;
  onConfirm: () => void;
}) {
  const count = selected.length;
  const full = count === 8;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-700/40 bg-slate-900/60 px-4 py-3">
        <div>
          <p className="text-sm font-extrabold text-white">
            {isBracketGenerated ? "Mejores Terceros — Bracket Generado" : "Selecciona los 8 Mejores Terceros"}
          </p>
          <p className="text-xs text-slate-500">
            {isBracketGenerated
              ? "El algoritmo FIFA asignó los equipos respetando los grupos."
              : "Elige manualmente qué 8 equipos avanzan al cuadro de 32."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "rounded-full px-3 py-1 text-sm font-black tabular-nums",
            full ? "bg-lime-500/20 text-lime-300" : "bg-slate-800 text-slate-400"
          )}>
            {count}/8
          </span>
          {isBracketGenerated && (
            <button
              type="button"
              onClick={() => dispatch({ type: "RESET_BRACKET" })}
              className="rounded-lg border border-slate-700/50 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Resetear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[28px_36px_1fr_36px_36px_36px_28px] gap-1.5 border-b border-slate-800 bg-slate-950/70 px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">
        <span>#</span>
        <span>Grp</span>
        <span>Equipo</span>
        <span className="text-center">Pts</span>
        <span className="text-center">DG</span>
        <span className="text-center">GF</span>
        <span />
      </div>

      <div className="divide-y divide-slate-800/60">
        {allThirds.map((s, i) => {
          const isSelected = selected.includes(s.team);
          const isDisabled = isBracketGenerated || (!isSelected && full);
          return (
            <label
              key={s.team}
              className={cn(
                "grid cursor-pointer grid-cols-[28px_36px_1fr_36px_36px_36px_28px] items-center gap-1.5 px-4 py-2.5 transition-colors",
                isSelected
                  ? "bg-cyan-500/8"
                  : isDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-slate-800/40"
              )}
            >
              <span className={cn("text-xs font-extrabold text-center", i < 8 ? "text-amber-400" : "text-slate-600")}>
                {i + 1}
              </span>
              <span className="text-xs font-bold text-slate-500">{s.group}</span>
              <div className="flex min-w-0 items-center gap-2">
                <Flag team={s.team} />
                <span className={cn("truncate text-sm font-semibold", isSelected ? "text-white" : "text-slate-300")}>
                  {t(s.team)}
                </span>
                {isSelected && isBracketGenerated && (
                  <span className="shrink-0 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400">
                    Clasificado
                  </span>
                )}
              </div>
              <span className="text-center text-xs font-bold text-white">{s.pts}</span>
              <span className={cn("text-center text-xs text-slate-400", s.gd > 0 && "text-lime-400/80")}>
                {s.gd > 0 ? `+${s.gd}` : s.gd}
              </span>
              <span className="text-center text-xs text-slate-400">{s.gf}</span>
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => !isDisabled && dispatch({ type: "TOGGLE_THIRD", team: s.team })}
                className="h-4 w-4 cursor-pointer accent-cyan-500 disabled:cursor-not-allowed"
              />
            </label>
          );
        })}
      </div>

      {!isBracketGenerated && (
        <div className="border-t border-slate-700/40 bg-slate-900/60 px-4 py-3 space-y-2">
          {assignError && (
            <p className="text-xs text-red-400">
              No existe asignación válida para esta selección (regla FIFA: ningún equipo puede enfrentar al líder de su propio grupo). Cambia al menos un equipo.
            </p>
          )}
          <button
            type="button"
            disabled={!full}
            onClick={onConfirm}
            className={cn(
              "w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200",
              full
                ? "bg-gradient-to-r from-lime-500 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:from-lime-400 hover:to-cyan-400 active:scale-[0.98]"
                : "cursor-not-allowed bg-slate-800 text-slate-600"
            )}
          >
            {full ? "✓  Confirmar y Generar Fase Final" : `Selecciona ${8 - count} equipo${8 - count !== 1 ? "s" : ""} más…`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Lógica Principal: PredictorFluido ────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "success" | "error";

export type ClassicPredictionData = {
  group_fixtures: GroupMatch[];
  knockout_scores: KnockoutScores;
  selected_thirds: string[];
  third_assignments: ThirdSlotAssignments;
  is_bracket_generated: boolean;
};

// Fusiona predicciones guardadas sobre la cartelera oficial fresca.
// IMPORTANTE: la estructura (group, id, kickoffTime, etc.) siempre viene de
// baseFixtures para que los grupos FIFA estén siempre actualizados.
// Solo se preservan los goles que el usuario ya ingresó.
function mergeAndNormalizeFixtures(loaded: GroupMatch[], baseFixtures: GroupMatch[]): GroupMatch[] {
  const map = new Map(loaded.map((f) => [`${f.homeTeam}-${f.awayTeam}`, f]));
  return baseFixtures.map((def) => {
    const saved = map.get(`${def.homeTeam}-${def.awayTeam}`);
    return {
      ...def,                            // estructura oficial fresca (group, id, kickoffTime…)
      homeScore: saved?.homeScore ?? 0,  // solo recuperamos los goles del usuario
      awayScore: saved?.awayScore ?? 0,
    };
  });
}

export function PredictorFluido({ initialData }: { initialData?: ClassicPredictionData }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(predictorReducer, INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  
  // Cambiamos a `true` por defecto porque AHORA siempre traemos la cartelera oficial de la base de datos
  const [isLoading, setIsLoading] = useState(true);
  const [assignError, setAssignError] = useState(false);

  useEffect(() => {
    // 1. Descargamos el esqueleto oficial del torneo (104 partidos).
    // no-store garantiza datos frescos — sin esto el navegador puede devolver
    // una respuesta cacheada con grupos erróneos al recargar la página.
    api.get("/matches/all", { headers: { "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" } })
      .then((matchesRes) => {
        const baseFixtures = buildFixturesFromAPI(matchesRes.data);

        // 2. Si el padre ya nos pasó data (cacheada), la fusionamos directo
        if (initialData) {
          dispatch({
            type: "HYDRATE_STATE",
            baseFixtures,
            groupFixtures: initialData.group_fixtures,
            knockoutScores: initialData.knockout_scores,
            selectedThirds: initialData.selected_thirds ?? [],
            thirdAssignments: initialData.third_assignments ?? {},
            isBracketGenerated: initialData.is_bracket_generated ?? false,
          });
          setIsLoading(false);
        } else {
          // 3. Si no, buscamos si el usuario tiene una quiniela guardada en el backend
          api.get("/predictions/classic")
            .then((predRes) => {
              dispatch({
                type: "HYDRATE_STATE",
                baseFixtures,
                groupFixtures: predRes.data.group_fixtures,
                knockoutScores: predRes.data.knockout_scores,
                selectedThirds: predRes.data.selected_thirds ?? [],
                thirdAssignments: predRes.data.third_assignments ?? {},
                isBracketGenerated: predRes.data.is_bracket_generated ?? false,
              });
            })
            .catch(() => {
              // 4. Si da error 404 (nuevo usuario), le entregamos la cartelera limpia
              dispatch({
                type: "HYDRATE_STATE",
                baseFixtures,
                groupFixtures: [],
                knockoutScores: {},
                selectedThirds: [],
                thirdAssignments: {},
                isBracketGenerated: false,
              });
            })
            .finally(() => setIsLoading(false));
        }
      })
      .catch(() => {
        toast.error("Error al cargar el calendario oficial.");
        setIsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapshot = useMemo(
    () => buildTournamentSnapshotWithKnockout(
      state.groupFixtures,
      state.knockoutScores,
      state.thirdAssignments
    ),
    [state.groupFixtures, state.knockoutScores, state.thirdAssignments]
  );

  // Auto-clean selectedThirds whenever group scores change. If a team moves
  // from 3rd place to 1st or 2nd (or vice-versa) the saved thirdAssignments
  // become stale and must be regenerated to prevent bracket duplicates.
  useEffect(() => {
    if (!state.groupFixtures.length) return;
    const groupStandings = buildStandings(state.groupFixtures);
    const validThirdTeams = new Set<string>();
    for (const [, rows] of groupStandings) {
      if (rows[2]) validThirdTeams.add(rows[2].team);
    }
    dispatch({ type: "CLEAN_STALE_THIRDS", validThirdTeams });
  }, [state.groupFixtures]);

  const handleSave = useCallback(async () => {
    // Build bracket snapshot: slot_id → {home, away} for all resolved knockout slots.
    // Stored in DB so the backend can auto-score when real knockout matches finish.
    const bracketSnapshot: Record<string, { home: string; away: string }> = {};
    const allKnockoutSlots = [
      ...snapshot.roundOf32,
      ...snapshot.roundOf16,
      ...snapshot.quarterFinals,
      ...snapshot.semiFinals,
      snapshot.thirdPlace,
      snapshot.final,
    ];
    for (const slot of allKnockoutSlots) {
      if (!isTBD(slot.home) && !isTBD(slot.away)) {
        bracketSnapshot[slot.id] = { home: slot.home, away: slot.away };
      }
    }

    setSaveStatus("saving");
    try {
      await api.post("/predictions/classic", {
        group_fixtures: state.groupFixtures,
        knockout_scores: state.knockoutScores,
        selected_thirds: state.selectedThirds,
        third_assignments: state.thirdAssignments,
        is_bracket_generated: state.isBracketGenerated,
        bracket_snapshot: bracketSnapshot,
      });
      setSaveStatus("success");
      toast.success("Quiniela guardada correctamente");
      setTimeout(() => router.push("/dashboard/rendimiento"), 1200);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setSaveStatus("error");
      toast.error(
        status === 403
          ? "Necesitas un pase activo para guardar tu quiniela."
          : "Hubo un problema al guardar tu quiniela."
      );
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [state.groupFixtures, state.knockoutScores, state.selectedThirds, state.thirdAssignments, state.isBracketGenerated, snapshot, router]);

  const handleGenerate = useCallback(() => {
    const thirds = state.selectedThirds
      .map((teamName) => {
        for (const [group, standings] of snapshot.standingsByGroup) {
          if (standings[2]?.team === teamName) return { team: teamName, group };
        }
        return null;
      })
      .filter((t): t is { team: string; group: string } => t !== null);

    try {
      const assignments = assignThirdsToR32(thirds);
      if (assignments) {
        setAssignError(false);
        dispatch({ type: "GENERATE_BRACKET", assignments });
      } else {
        setAssignError(true);
      }
    } catch (err) {
      console.error("[PredictorFluido] Asignación de terceros inválida:", err);
      setAssignError(true);
    }
  }, [state.selectedThirds, snapshot.standingsByGroup]);

  const fixturesByGroup = useMemo(() => {
    const map = new Map<string, GroupMatch[]>();
    for (const m of state.groupFixtures) {
      if (!map.has(m.group)) map.set(m.group, []);
      map.get(m.group)!.push(m);
    }
    return map;
  }, [state.groupFixtures]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
          <p className="text-xs text-slate-500">Cargando el calendario oficial de la FIFA…</p>
        </div>
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
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
              Predictor Fluido · Mundial 2026
            </p>
            <h2 className="mt-1.5 text-xl font-bold text-white">
              Simula el torneo completo
            </h2>
            <p className="mt-1 max-w-lg text-sm leading-6 text-slate-400">
              Cada marcador actualiza la tabla en tiempo real y propaga ganadores por el bracket hasta la Final.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-2.5 text-right">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Edición cierra</p>
            <p className="mt-0.5 text-sm font-extrabold text-cyan-400">2 h antes del partido</p>
          </div>
        </div>
      </div>

      {/* ── Fase de Grupos ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">Fase de Grupos</h3>
          <p className="text-xs text-slate-400">
            Usa [−] y [+] para el marcador. La tabla viva a la derecha se reordena al instante.
          </p>
        </div>
        <div className="space-y-3">
          {GROUP_ORDER.map((g) => {
            const matches = fixturesByGroup.get(g) ?? [];
            if (matches.length === 0) return null; // Evita pintar grupos vacíos
            return (
              <GroupCard
                key={g}
                group={g}
                fixtures={matches}
                standings={snapshot.standingsByGroup.get(g) ?? []}
                dispatch={dispatch}
              />
            );
          })}
        </div>
      </section>

      {/* ── Mejores Terceros ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">Mejores Terceros</h3>
          <p className="text-xs text-slate-400">
            Selecciona tus 8 favoritos y el algoritmo FIFA los asignará sin que enfrenten al líder de su grupo.
          </p>
        </div>
        <ThirdPlaceSelector
          allThirds={snapshot.thirdPlaceTable}
          selected={state.selectedThirds}
          isBracketGenerated={state.isBracketGenerated}
          assignError={assignError}
          dispatch={dispatch}
          onConfirm={handleGenerate}
        />
      </section>

      {/* ── Bracket Eliminatorio ── */}
      {state.isBracketGenerated && (
        <>
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">Fase Final</h3>
              <p className="text-xs text-slate-400">
                Los clasificados llenan el cuadro automáticamente. Anota el marcador de cada llave y el ganador avanza.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/40 p-4">
              <BracketView
                snapshot={snapshot}
                knockoutScores={state.knockoutScores}
                dispatch={dispatch}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-white">Tercer Lugar</h3>
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
        </>
      )}

      {/* ── Botón Guardar ── */}
      <div className="sticky bottom-4 flex justify-center pb-8 z-50">
        <div className="relative">
          {saveStatus === "success" && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-lime-500/30 bg-lime-950/90 px-4 py-2 text-xs font-semibold text-lime-300 shadow-xl backdrop-blur-sm">
              Quiniela guardada
            </div>
          )}
          {saveStatus === "error" && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-2 text-xs font-semibold text-red-300 shadow-xl backdrop-blur-sm">
              Error al guardar — revisa tu plan
            </div>
          )}
          <button
            type="button"
            disabled={saveStatus === "saving"}
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-6 py-3 text-sm font-bold shadow-2xl backdrop-blur-sm",
              "transition-all duration-200 active:scale-95",
              "disabled:cursor-not-allowed disabled:opacity-60",
              saveStatus === "success"
                ? "border-lime-500/40 bg-lime-950/80 text-lime-300"
                : saveStatus === "error"
                  ? "border-red-500/40 bg-red-950/80 text-red-300"
                  : "border-fuchsia-500/30 bg-fuchsia-950/80 text-white hover:bg-fuchsia-900/80"
            )}
          >
            {saveStatus === "saving" ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Guardando…
              </>
            ) : saveStatus === "success" ? (
              "Guardado"
            ) : (
              "Guardar Mi Quiniela"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}