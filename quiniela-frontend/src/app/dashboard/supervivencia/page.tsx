"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { DEFAULT_GROUP_FIXTURES, GROUP_ORDER } from "@/lib/classicPredictor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurvivalStatus {
  status: "alive" | "eliminated";
  picks: Record<string, string>;
  used_teams: string[];
  extra_life_available: boolean;
  extra_life_used: boolean;
  eliminated_in_round: number | null;
  updated_at: string | null;
}

interface ApiMatch {
  id: number;
  home_team: string;
  away_team: string;
  status: string;
  kickoff_time: string;
  home_score: number | null;
  away_score: number | null;
}

interface JornadaFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime?: string;
  status?: string;
}

// ─── Jornada data ─────────────────────────────────────────────────────────────

const JORNADA_SUFFIX: Record<number, [number, number]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6],
};

const JORNADA_LABELS: Record<number, string> = {
  1: "Jornada 1 — Fase de Grupos",
  2: "Jornada 2 — Fase de Grupos",
  3: "Jornada 3 — Fase de Grupos",
  4: "Dieciseisavos de Final",
  5: "Octavos de Final",
  6: "Cuartos de Final",
  7: "Semifinales",
  8: "Gran Final",
};

function getGroupStageFixtures(jornadaId: 1 | 2 | 3): JornadaFixture[] {
  const [s1, s2] = JORNADA_SUFFIX[jornadaId];
  return GROUP_ORDER.flatMap((g) =>
    DEFAULT_GROUP_FIXTURES
      .filter((f) => f.id === `${g}-${s1}` || f.id === `${g}-${s2}`)
      .map((f) => ({ id: f.id, homeTeam: f.homeTeam, awayTeam: f.awayTeam }))
  );
}

function enrichWithKickoffs(
  fixtures: JornadaFixture[],
  apiMatches: ApiMatch[]
): JornadaFixture[] {
  return fixtures.map((f) => {
    const real = apiMatches.find(
      (m) =>
        m.home_team.toLowerCase() === f.homeTeam.toLowerCase() &&
        m.away_team.toLowerCase() === f.awayTeam.toLowerCase()
    );
    return real
      ? { ...f, kickoffTime: real.kickoff_time, status: real.status }
      : f;
  });
}

function toUtcMs(iso: string): number {
  return new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(targetIso: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!targetIso) { setLabel(null); return; }

    function tick() {
      const diff = toUtcMs(targetIso!) - Date.now();
      if (diff <= 0) { setLabel(null); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (h > 0) setLabel(`Cierra en ${h}h ${m.toString().padStart(2, "0")}m`);
      else if (m > 0) setLabel(`Cierra en ${m}m ${s.toString().padStart(2, "0")}s`);
      else setLabel(`Cierra en ${s}s`);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetIso]);

  return label;
}

// ─── TeamPicker ───────────────────────────────────────────────────────────────

function TeamPicker({
  team,
  isSelected,
  isUsed,
  isMatchLocked,
  isSaving,
  onClick,
}: {
  team: string;
  isSelected: boolean;
  isUsed: boolean;
  isMatchLocked: boolean; // true when this specific match's kickoff has passed
  isSaving: boolean;
  onClick: () => void;
}) {
  const url = flagUrl(team, 40);
  const disabled = isUsed || isMatchLocked || isSaving;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={
        isUsed
          ? "Ya utilizado en este torneo"
          : isMatchLocked
            ? "Este partido ya comenzó"
            : team
      }
      className={cn(
        "group flex flex-col items-center gap-2 rounded-xl px-3 py-3.5 transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
        isSelected
          ? "bg-cyan-500/15 ring-1 ring-cyan-400/50 shadow-xl shadow-cyan-500/10"
          : isUsed
            ? "opacity-20 cursor-not-allowed"
            : isMatchLocked
              ? "opacity-35 cursor-not-allowed"
              : "hover:bg-slate-800/60 hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
      )}
    >
      {url ? (
        <img
          src={url}
          alt={team}
          className={cn(
            "h-9 w-14 rounded-lg object-cover shadow-md transition-all",
            isSelected && "ring-2 ring-cyan-400/70 shadow-cyan-500/20"
          )}
        />
      ) : (
        <div className="flex h-9 w-14 items-center justify-center rounded-lg bg-slate-700/60 text-[10px] font-bold text-slate-400">
          {team.slice(0, 3).toUpperCase()}
        </div>
      )}
      <span className={cn(
        "max-w-[88px] truncate text-[11px] font-semibold leading-tight",
        isSelected ? "text-cyan-300" : "text-slate-400"
      )}>
        {team}
      </span>
      {isSelected && (
        <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">✓ pick</span>
      )}
      {isUsed && !isSelected && (
        <span className="text-[8px] uppercase tracking-widest text-slate-700">usado</span>
      )}
      {isMatchLocked && !isSelected && !isUsed && (
        <span className="text-[8px] uppercase tracking-widest text-slate-700">🔒</span>
      )}
    </button>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({
  fixture,
  currentPick,
  usedTeams,
  savingTeam,
  onPick,
}: {
  fixture: JornadaFixture;
  currentPick: string | null;
  usedTeams: string[];
  savingTeam: string | null;
  onPick: (team: string) => void;
}) {
  // Per-match lock: buttons freeze when THIS match's kickoff has passed
  const matchStarted = fixture.kickoffTime
    ? Date.now() >= toUtcMs(fixture.kickoffTime)
    : false;

  const fmt = fixture.kickoffTime
    ? new Date(toUtcMs(fixture.kickoffTime))
        .toLocaleString("es-MX", {
          weekday: "short", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
    : null;

  const isLive =
    fixture.status === "1H" ||
    fixture.status === "2H" ||
    fixture.status === "HT";

  const hasPickHere =
    currentPick === fixture.homeTeam || currentPick === fixture.awayTeam;

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border transition-all duration-200",
      hasPickHere
        ? "border-cyan-500/25 bg-slate-900/70"
        : "border-slate-800/60 bg-slate-900/50",
      matchStarted && !hasPickHere && "opacity-60"
    )}>
      {/* Match meta row */}
      <div className="flex items-center justify-between border-b border-slate-800/50 px-4 py-1.5">
        <span className="text-[9px] font-medium text-slate-600">
          {fmt ?? "Horario por confirmar"}
        </span>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              EN VIVO
            </span>
          )}
          {matchStarted && !isLive && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">
              🔒 Iniciado
            </span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-1 px-2 py-4">
        <TeamPicker
          team={fixture.homeTeam}
          isSelected={currentPick === fixture.homeTeam}
          isUsed={usedTeams.includes(fixture.homeTeam) && currentPick !== fixture.homeTeam}
          isMatchLocked={matchStarted}
          isSaving={savingTeam === fixture.homeTeam}
          onClick={() => onPick(fixture.homeTeam)}
        />

        <div className="shrink-0 text-xs font-black text-slate-800">VS</div>

        <TeamPicker
          team={fixture.awayTeam}
          isSelected={currentPick === fixture.awayTeam}
          isUsed={usedTeams.includes(fixture.awayTeam) && currentPick !== fixture.awayTeam}
          isMatchLocked={matchStarted}
          isSaving={savingTeam === fixture.awayTeam}
          onClick={() => onPick(fixture.awayTeam)}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupervivenciaPage() {
  const router = useRouter();
  const [survival, setSurvival] = useState<SurvivalStatus | null>(null);
  const [apiMatches, setApiMatches] = useState<ApiMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState<string | null>(null);

  // Hardcoded for Phase 1 — advance is determined by backend match results
  const currentJornada = 1;

  const jornadaFixtures: JornadaFixture[] = (() => {
    if (currentJornada <= 3) {
      return enrichWithKickoffs(
        getGroupStageFixtures(currentJornada as 1 | 2 | 3),
        apiMatches
      );
    }
    return [];
  })();

  // Countdown to the next match that hasn't started yet
  const nextPendingKickoff =
    jornadaFixtures
      .filter((f) => f.kickoffTime && Date.now() < toUtcMs(f.kickoffTime))
      .sort((a, b) => toUtcMs(a.kickoffTime!) - toUtcMs(b.kickoffTime!))[0]
      ?.kickoffTime ?? null;

  const countdown = useCountdown(nextPendingKickoff);
  const currentPick = survival?.picks[String(currentJornada)] ?? null;
  const hasPicked = currentPick !== null;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<SurvivalStatus>("/predictions/survival/me"),
      api.get<ApiMatch[]>("/matches/all").catch(() => ({ data: [] })),
    ])
      .then(([sv, mx]) => {
        setSurvival(sv.data);
        setApiMatches(mx.data ?? []);
      })
      .catch((err) => {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          router.push("/dashboard/upgrade");
        } else {
          toast.error("No se pudo cargar tu estado de supervivencia.");
        }
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  // ── Pick: fluid, no global lock — per-match buttons handle it ─────────────
  const handlePick = useCallback(async (team: string) => {
    if (!survival || survival.status === "eliminated") return;
    if (team === currentPick) return;

    setSavingTeam(team);
    try {
      await api.post("/predictions/survival/pick", {
        jornada_id: currentJornada,
        team_id: team,
      });
      setSurvival((prev) => {
        if (!prev) return prev;
        const newPicks = { ...prev.picks, [String(currentJornada)]: team };
        return { ...prev, picks: newPicks, used_teams: Object.values(newPicks) };
      });
      toast.success(`✓ ${team} — Jornada ${currentJornada}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      toast.error(detail ?? "Error al guardar el pick.");
    } finally {
      setSavingTeam(null);
    }
  }, [survival, currentJornada, currentPick]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-800 border-t-red-400" />
      </div>
    );
  }

  if (!survival) return null;

  const isEliminated = survival.status === "eliminated";

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">
          Last Man Standing · Mundial 2026
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
          {JORNADA_LABELS[currentJornada]}
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Elige un equipo para que avance. No puedes repetir el mismo equipo dos veces en el torneo.
        </p>
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      {isEliminated ? (
        <div className="relative overflow-hidden rounded-xl border border-red-900/40 bg-slate-950 px-5 py-4">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgba(239,68,68,0.03)_8px,rgba(239,68,68,0.03)_16px)]" />
          <div className="relative flex items-center gap-4">
            <span className="text-2xl">💀</span>
            <div>
              <p className="text-base font-black uppercase tracking-[0.1em] text-red-500">Eliminado</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Caíste en la jornada {survival.eliminated_in_round ?? "—"}.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Vivo</span>
            <div className="flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={cn(
                  "h-0.5 w-4 rounded-full transition-all duration-300",
                  i < Object.keys(survival.picks).length
                    ? "bg-emerald-500"
                    : i === Object.keys(survival.picks).length
                      ? "bg-cyan-400"
                      : "bg-slate-800"
                )} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasPicked && currentPick && (
              <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-2.5 py-1">
                {flagUrl(currentPick, 20) && (
                  <img src={flagUrl(currentPick, 20)!} alt={currentPick} className="h-2.5 w-4 rounded-sm object-cover" />
                )}
                <span className="text-[10px] font-black text-cyan-300">{currentPick}</span>
              </div>
            )}
            {countdown && (
              <span className="rounded-lg border border-amber-500/20 bg-amber-950/15 px-2 py-1 text-[10px] font-bold text-amber-400">
                {countdown}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Compact pick indicator ────────────────────────────────────────── */}
      {!isEliminated && hasPicked && currentPick && (
        <p className="text-[11px] text-slate-600">
          Pick activo: <span className="font-bold text-slate-400">{currentPick}</span>
          <span className="ml-2 text-slate-700">— Toca otro equipo para cambiar (hasta el pitazo inicial de cada partido)</span>
        </p>
      )}
      {!isEliminated && !hasPicked && (
        <p className="text-[11px] text-slate-600">
          Toca el escudo del equipo que crees que ganará o empatará. Puedes cambiar tu elección hasta que comience el partido.
        </p>
      )}

      {/* ── Cartelera — SIEMPRE VISIBLE ───────────────────────────────────── */}
      {!isEliminated && (
        <section>
          {jornadaFixtures.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {jornadaFixtures.map((fixture) => (
                <MatchCard
                  key={fixture.id}
                  fixture={fixture}
                  currentPick={currentPick}
                  usedTeams={survival.used_teams}
                  savingTeam={savingTeam}
                  onPick={handlePick}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-12 text-center">
              <p className="text-sm text-slate-600">Partidos de esta jornada por confirmar.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Regla de Oro ─────────────────────────────────────────────────── */}
      {survival.used_teams.length > 0 && (
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            Regla de Oro · {survival.used_teams.length} / 48 equipos usados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {survival.used_teams.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-md bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {flagUrl(t, 20) && (
                  <img src={flagUrl(t, 20)!} alt={t} className="h-2.5 w-3.5 rounded-sm object-cover opacity-50" />
                )}
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
