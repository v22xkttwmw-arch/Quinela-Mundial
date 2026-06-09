"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SurvivalStatus {
  status: "alive" | "eliminated";
  picks: Record<string, string>;
  used_teams: string[];
  pick_results: Record<string, "won" | "lost">;
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
  round?: string | null;
  venue?: string | null;
  home_form?: string | null;
  away_form?: string | null;
}

interface JornadaFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime?: string;
  status?: string;
  venue?: string;
  homeForm?: string;
  awayForm?: string;
}

// ─── Jornada maps ─────────────────────────────────────────────────────────────

const ROUND_TO_JORNADA: Record<string, number> = {
  "Group Stage - 1": 1,
  "Group Stage - 2": 2,
  "Group Stage - 3": 3,
  "Round of 32":     4,
  "Round of 16":     5,
  "Quarter-finals":  6,
  "Semi-finals":     7,
  "Final":           8,
};

const JORNADA_TO_ROUND: Record<number, string> = Object.fromEntries(
  Object.entries(ROUND_TO_JORNADA).map(([r, j]) => [j, r])
);

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

const FINISHED = new Set(["FT", "AET", "PEN"]);
const LIVE_ST  = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUtcMs(iso: string): number {
  return new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
}

function computeActiveJornada(apiMatches: ApiMatch[]): number {
  // Phase 1 — Pre-tournament: first J1 kick-off hasn't happened yet → always J1
  const j1 = apiMatches.filter((m) => m.round === "Group Stage - 1");
  if (j1.length > 0) {
    const earliest = j1
      .filter((m) => m.kickoff_time)
      .map((m) => toUtcMs(m.kickoff_time))
      .sort((a, b) => a - b)[0];
    if (earliest && Date.now() < earliest) return 1;
  }

  // Phase 2 — Tournament in progress: first jornada (1→8) with at least one
  // non-finished match. Tracks the last jornada that has ANY data so we can
  // advance cleanly even when the next round's fixtures haven't been synced yet.
  let lastSeen = 1;
  for (let j = 1; j <= 8; j++) {
    const round = JORNADA_TO_ROUND[j];
    if (!round) continue;
    const roundMatches = apiMatches.filter((m) => m.round === round);
    if (roundMatches.length === 0) continue;
    lastSeen = j;
    // This jornada still has unfinished matches → it is the active one
    if (roundMatches.some((m) => !FINISHED.has(m.status))) return j;
    // All matches in this jornada are done → fall through to check next
  }

  // Phase 3 — All known jornadas are finished: advance to the next one.
  // E.g. group stage done but knockout fixtures not yet in DB → show J4.
  return Math.min(lastSeen + 1, 8);
}

function buildJornadaFixtures(jornada: number, apiMatches: ApiMatch[]): JornadaFixture[] {
  const round = JORNADA_TO_ROUND[jornada];
  if (!round) return [];
  return apiMatches
    .filter((m) => m.round === round)
    .map((m) => ({
      id:          String(m.id),
      homeTeam:    m.home_team,
      awayTeam:    m.away_team,
      kickoffTime: m.kickoff_time,
      status:      m.status,
      venue:       m.venue    ?? undefined,
      homeForm:    m.home_form ?? undefined,
      awayForm:    m.away_form ?? undefined,
    }));
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
      if (h > 0)      setLabel(`Cierra en ${h}h ${m.toString().padStart(2, "0")}m`);
      else if (m > 0) setLabel(`Cierra en ${m}m ${s.toString().padStart(2, "0")}s`);
      else            setLabel(`Cierra en ${s}s`);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetIso]);

  return label;
}

// ─── FormDots ─────────────────────────────────────────────────────────────────

function FormDots({ form }: { form?: string }) {
  if (!form) return null;
  const chars = form.replace(/[^WDLN]/g, "").split("").slice(-5);
  if (chars.length === 0) return null;
  return (
    <div className="flex gap-[3px]">
      {chars.map((c, i) => (
        <span
          key={i}
          title={c === "W" ? "Victoria" : c === "D" ? "Empate" : c === "L" ? "Derrota" : "No jugado"}
          className={cn(
            "h-[5px] w-[5px] rounded-full",
            c === "W" ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" :
            c === "L" ? "bg-red-500" :
            c === "D" ? "bg-slate-500" :
                        "bg-slate-700"
          )}
        />
      ))}
    </div>
  );
}

// ─── TeamPicker ───────────────────────────────────────────────────────────────

function TeamPicker({
  team, form, isSelected, isUsed, isMatchLocked, isSaving, onClick,
}: {
  team: string;
  form?: string;
  isSelected: boolean;
  isUsed: boolean;
  isMatchLocked: boolean;
  isSaving: boolean;
  onClick: () => void;
}) {
  const url      = flagUrl(team, 40);
  const disabled = isUsed || isMatchLocked || isSaving;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={isUsed ? "Ya utilizado en este torneo" : isMatchLocked ? "Este partido ya comenzó" : team}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-xl px-3 py-3.5 transition-all duration-200",
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
        <img src={url} alt={team}
          className={cn("h-9 w-14 rounded-lg object-cover shadow-md transition-all",
            isSelected && "ring-2 ring-cyan-400/70 shadow-cyan-500/20")} />
      ) : (
        <div className="flex h-9 w-14 items-center justify-center rounded-lg bg-slate-700/60 text-[10px] font-bold text-slate-400">
          {team.slice(0, 3).toUpperCase()}
        </div>
      )}
      <span className={cn("max-w-[88px] truncate text-[11px] font-semibold leading-tight",
        isSelected ? "text-cyan-300" : "text-slate-400")}>
        {team}
      </span>
      <FormDots form={form} />
      {isSelected    && <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">✓ pick</span>}
      {isUsed && !isSelected && <span className="text-[8px] uppercase tracking-widest text-slate-700">usado</span>}
      {isMatchLocked && !isSelected && !isUsed && <span className="text-[8px] uppercase tracking-widest text-slate-700">🔒</span>}
    </button>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({
  fixture, currentPick, usedTeams, savingTeam, onPick,
}: {
  fixture:     JornadaFixture;
  currentPick: string | null;
  usedTeams:   string[];
  savingTeam:  string | null;
  onPick:      (team: string) => void;
}) {
  const matchStarted = fixture.kickoffTime ? Date.now() >= toUtcMs(fixture.kickoffTime) : false;
  const fmt = fixture.kickoffTime
    ? new Date(toUtcMs(fixture.kickoffTime)).toLocaleString("es-MX", {
        weekday: "short", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;
  const isLive      = fixture.status ? LIVE_ST.has(fixture.status) : false;
  const hasPickHere = currentPick === fixture.homeTeam || currentPick === fixture.awayTeam;

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border transition-all duration-200",
      hasPickHere ? "border-cyan-500/25 bg-slate-900/70" : "border-slate-800/60 bg-slate-900/50",
      matchStarted && !hasPickHere && "opacity-60"
    )}>
      {/* ── Header: time + venue + live badge ── */}
      <div className="border-b border-slate-800/50 px-4 py-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium text-slate-500">
            {fmt ?? "Horario por confirmar"}
          </span>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> EN VIVO
              </span>
            )}
            {matchStarted && !isLive && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700">🔒 Iniciado</span>
            )}
          </div>
        </div>
        {fixture.venue && (
          <p className="mt-0.5 truncate text-[8px] text-slate-700">
            📍 {fixture.venue}
          </p>
        )}
      </div>

      {/* ── Team pickers ── */}
      <div className="flex items-center justify-between gap-1 px-2 py-4">
        <TeamPicker
          team={fixture.homeTeam}
          form={fixture.homeForm}
          isSelected={currentPick === fixture.homeTeam}
          isUsed={usedTeams.includes(fixture.homeTeam) && currentPick !== fixture.homeTeam}
          isMatchLocked={matchStarted}
          isSaving={savingTeam === fixture.homeTeam}
          onClick={() => onPick(fixture.homeTeam)}
        />
        <div className="shrink-0 text-xs font-black text-slate-800">VS</div>
        <TeamPicker
          team={fixture.awayTeam}
          form={fixture.awayForm}
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

// ─── PickHistoryRow ───────────────────────────────────────────────────────────

function PickHistoryRow({ jornada, team, result }: { jornada: number; team: string; result?: "won" | "lost" }) {
  const url = flagUrl(team, 20);
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px]",
      result === "won"  ? "border-emerald-800/40 bg-emerald-950/20" :
      result === "lost" ? "border-red-900/40 bg-red-950/20" :
                          "border-slate-800 bg-slate-900/50"
    )}>
      <span className="w-12 shrink-0 text-[9px] font-bold uppercase tracking-widest text-slate-600">
        {JORNADA_LABELS[jornada]?.split("—")[0]?.trim() ?? `J${jornada}`}
      </span>
      {url && <img src={url} alt={team} className="h-3 w-4 rounded-sm object-cover" />}
      <span className={cn("font-semibold",
        result === "won"  ? "text-emerald-300" :
        result === "lost" ? "text-red-400 line-through" :
                            "text-slate-400"
      )}>{team}</span>
      {result === "won"  && <span className="ml-auto text-emerald-400">✓ Ganó</span>}
      {result === "lost" && <span className="ml-auto text-red-500">✗ Eliminado</span>}
      {!result           && <span className="ml-auto text-slate-600">Pendiente</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupervivenciaPage() {
  const router = useRouter();
  const [survival, setSurvival]   = useState<SurvivalStatus | null>(null);
  const [apiMatches, setApiMatches] = useState<ApiMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState<string | null>(null);

  // Computed once apiMatches loads
  const activeJornada = apiMatches.length > 0 ? computeActiveJornada(apiMatches) : 1;
  const jornadaFixtures = buildJornadaFixtures(activeJornada, apiMatches);

  const nextPendingKickoff =
    jornadaFixtures
      .filter((f) => f.kickoffTime && Date.now() < toUtcMs(f.kickoffTime))
      .sort((a, b) => toUtcMs(a.kickoffTime!) - toUtcMs(b.kickoffTime!))[0]
      ?.kickoffTime ?? null;

  const countdown   = useCountdown(nextPendingKickoff);
  const currentPick = survival?.picks[String(activeJornada)] ?? null;
  const hasPicked   = currentPick !== null;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<SurvivalStatus>("/predictions/survival/me"),
      api.get<ApiMatch[]>("/matches/all").catch(() => ({ data: [] as ApiMatch[] })),
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

  // ── Pick ───────────────────────────────────────────────────────────────────
  const handlePick = useCallback(async (team: string) => {
    if (!survival || survival.status === "eliminated") return;
    if (team === currentPick) return;

    setSavingTeam(team);
    try {
      await api.post("/predictions/survival/pick", {
        jornada_id: activeJornada,
        team_id: team,
      });
      setSurvival((prev) => {
        if (!prev) return prev;
        const newPicks = { ...prev.picks, [String(activeJornada)]: team };
        return { ...prev, picks: newPicks, used_teams: Object.values(newPicks) };
      });
      toast.success(`✓ ${team} — Jornada ${activeJornada}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "Error al guardar el pick.");
    } finally {
      setSavingTeam(null);
    }
  }, [survival, activeJornada, currentPick]);

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

  // Past jornada picks (excluding the current active jornada)
  const pastPicks = Object.entries(survival.picks)
    .map(([j, team]) => ({ jornada: Number(j), team, result: survival.pick_results?.[j] }))
    .filter(({ jornada }) => jornada !== activeJornada)
    .sort((a, b) => a.jornada - b.jornada);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600">
          Last Man Standing · Mundial 2026
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
          {JORNADA_LABELS[activeJornada]}
        </h1>
        <p className="mt-1 text-xs text-slate-600">
          Elige un equipo para que gane. Si empata o pierde, quedas eliminado. No puedes repetir equipo.
        </p>
      </div>

      {/* ── Banner eliminado ──────────────────────────────────────────────── */}
      {isEliminated && (
        <div className="relative overflow-hidden rounded-xl border border-red-900/50 bg-slate-950 px-5 py-5">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgba(239,68,68,0.04)_8px,rgba(239,68,68,0.04)_16px)]" />
          <div className="relative flex items-center gap-4">
            <span className="text-3xl">💀</span>
            <div>
              <p className="text-lg font-black uppercase tracking-[0.12em] text-red-500">ELIMINADO</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Caíste en la jornada {survival.eliminated_in_round ?? "—"}.{" "}
                {survival.extra_life_available && !survival.extra_life_used
                  ? "Tienes una vida extra disponible."
                  : "Tu torneo ha terminado."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Status bar (alive) ────────────────────────────────────────────── */}
      {!isEliminated && (
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Vivo</span>
            <div className="flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={cn(
                  "h-0.5 w-4 rounded-full transition-all duration-300",
                  i < Object.keys(survival.picks).length ? "bg-emerald-500"
                  : i === Object.keys(survival.picks).length ? "bg-cyan-400"
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

      {/* ── Instrucción contextual ────────────────────────────────────────── */}
      {!isEliminated && hasPicked && currentPick && (
        <p className="text-[11px] text-slate-600">
          Pick activo: <span className="font-bold text-slate-400">{currentPick}</span>
          <span className="ml-2 text-slate-700">— Puedes cambiar hasta el pitazo inicial de ese partido.</span>
        </p>
      )}
      {!isEliminated && !hasPicked && (
        <p className="text-[11px] text-slate-600">
          Toca el escudo del equipo que crees que <strong className="text-slate-400">ganará</strong>. Solo una victoria te mantiene vivo.
        </p>
      )}

      {/* ── Cartelera — solo si no está eliminado ────────────────────────── */}
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

      {/* ── Historial de picks ────────────────────────────────────────────── */}
      {pastPicks.length > 0 && (
        <section className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            Historial de Picks
          </p>
          <div className="space-y-1.5">
            {pastPicks.map(({ jornada, team, result }) => (
              <PickHistoryRow key={jornada} jornada={jornada} team={team} result={result} />
            ))}
          </div>
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
              <span key={t} className="flex items-center gap-1 rounded-md bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-500">
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
