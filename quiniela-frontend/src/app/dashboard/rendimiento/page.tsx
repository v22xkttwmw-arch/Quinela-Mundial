"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { useUser } from "@/lib/useUser";
import {
  buildTournamentSnapshotWithKnockout,
  resolveKnockoutWinner,
} from "@/lib/classicPredictor";

// ─── Diccionario de Traducción (API -> UI) ────────────────────────────────────
const TEAM_TRANSLATIONS: Record<string, string> = {
  "Brazil": "Brasil", "Spain": "España", "Germany": "Alemania",
  "England": "Inglaterra", "France": "Francia", "Netherlands": "Países Bajos",
  "Belgium": "Bélgica", "Croatia": "Croacia", "Denmark": "Dinamarca",
  "Switzerland": "Suiza", "Poland": "Polonia", "Portugal": "Portugal",
  "Morocco": "Marruecos", "Senegal": "Senegal", "Cameroon": "Camerún",
  "Japan": "Japón", "South Korea": "Corea del Sur", "USA": "Estados Unidos",
  "Mexico": "México", "Canada": "Canadá", "Uruguay": "Uruguay",
  "Colombia": "Colombia", "Ecuador": "Ecuador", "Peru": "Perú",
  "Wales": "Gales", "Saudi Arabia": "Arabia Saudita", "Iran": "Irán",
  "Serbia": "Serbia", "Ghana": "Ghana", "Tunisia": "Túnez",
  "Costa Rica": "Costa Rica", "Qatar": "Qatar", "South Africa": "Sudáfrica"
};

function t(teamName: string) {
  return TEAM_TRANSLATIONS[teamName] || teamName;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStats {
  total_points: number;
  rank: number;
  total_predictions: number;
  finished_predictions: number;
  exact_count: number;
  tendency_count: number;
  effectiveness: number;
}

interface MatchData {
  id: number;
  home_team: string;
  away_team: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
}

interface PredictionDetail {
  id: number;
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  points_earned: number;
  match: MatchData | null;
}

interface GroupFixture {
  id: string;
  group: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface KnockoutEntry {
  homeScore: number | null;
  awayScore: number | null;
}

interface ClassicPredictionSummary {
  group_fixtures: GroupFixture[];
  knockout_scores: Record<string, KnockoutEntry>;
  selected_thirds: string[];
  third_assignments: Record<string, string>;
  is_bracket_generated: boolean;
  updated_at: string;
}

interface RawMatch {
  id: number;
  home_team: string;
  away_team: string;
  status: string;
  kickoff_time: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const CARD = "bg-slate-900/50 border border-slate-800";

type OutcomeKey = "exact" | "difference" | "tendency" | "miss" | "pending";

function getOutcome(pred: PredictionDetail): OutcomeKey {
  if (!pred.match || !["FT", "AET", "PEN"].includes(pred.match.status)) return "pending";
  if (pred.points_earned === 5) return "exact";
  if (pred.points_earned === 3) return "difference";
  if (pred.points_earned === 1) return "tendency";
  return "miss";
}

const OUTCOME_STYLES: Record<OutcomeKey, { border: string; badge: string; label: string; icon: string }> = {
  exact: {
    border: "border-l-4 border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
    label: "Exacto",
    icon: "✦",
  },
  difference: {
    border: "border-l-4 border-l-blue-400",
    badge: "bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30",
    label: "Ganador + dif.",
    icon: "📐",
  },
  tendency: {
    border: "border-l-4 border-l-amber-400",
    badge: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    label: "Tendencia",
    icon: "◈",
  },
  miss: {
    border: "border-l-4 border-l-red-500",
    badge: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
    label: "Fallido",
    icon: "✕",
  },
  pending: {
    border: "border-l-4 border-l-slate-700",
    badge: "bg-slate-800/60 text-slate-500 ring-1 ring-slate-700/30",
    label: "Pendiente",
    icon: "◌",
  },
};

function normalizeFixtures(fixtures: GroupFixture[]): GroupFixture[] {
  const map = new Map(fixtures.map((f) => [f.id, f]));
  const ALL_IDS = [
    "A-1","A-2","A-3","A-4","A-5","A-6",
    "B-1","B-2","B-3","B-4","B-5","B-6",
    "C-1","C-2","C-3","C-4","C-5","C-6",
    "D-1","D-2","D-3","D-4","D-5","D-6",
    "E-1","E-2","E-3","E-4","E-5","E-6",
    "F-1","F-2","F-3","F-4","F-5","F-6",
    "G-1","G-2","G-3","G-4","G-5","G-6",
    "H-1","H-2","H-3","H-4","H-5","H-6",
    "I-1","I-2","I-3","I-4","I-5","I-6",
    "J-1","J-2","J-3","J-4","J-5","J-6",
    "K-1","K-2","K-3","K-4","K-5","K-6",
    "L-1","L-2","L-3","L-4","L-5","L-6",
  ];
  return ALL_IDS.map((id) => {
    const f = map.get(id);
    if (!f) return { id, group: id.split("-")[0], homeTeam: "?", awayTeam: "?", homeScore: 0, awayScore: 0 };
    return { ...f, homeScore: f.homeScore ?? 0, awayScore: f.awayScore ?? 0 };
  });
}

function deriveChampion(data: ClassicPredictionSummary): string | null {
  try {
    const normalizedFixtures = normalizeFixtures(data.group_fixtures);
    const snapshot = buildTournamentSnapshotWithKnockout(
      normalizedFixtures.map((f) => ({ ...f, phase: "groups" as const, kickoffTime: undefined })),
      data.knockout_scores,
      data.third_assignments
    );
    const finalMatchId = snapshot.final.id;
    const finalScore = data.knockout_scores[finalMatchId];
    if (!finalScore) return null;
    const winner = resolveKnockoutWinner(snapshot.final, data.knockout_scores);
    const home = snapshot.final.home;
    const away = snapshot.final.away;
    const isTBD = (t: string) => t.startsWith("Gan.") || t.startsWith("Perd.") || t === "Pendiente";
    if (winner === "home" && home && !isTBD(home)) return home;
    if (winner === "away" && away && !isTBD(away)) return away;
    return null;
  } catch {
    return null;
  }
}

function countFilledGroups(fixtures: GroupFixture[]): number {
  return fixtures.filter(
    (f) => typeof f.homeScore === "number" && typeof f.awayScore === "number"
  ).length;
}

function fmtKickoff(iso: string): string {
  return new Date(iso.endsWith("Z") ? iso : iso + "Z").toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamFlag({ team }: { team: string }) {
  const url = flagUrl(t(team), 40);
  if (!url) return <div className="h-4 w-6 rounded-sm bg-slate-700" />;
  return <img src={url} alt={t(team)} className="h-4 w-6 rounded-sm object-cover" />;
}

// Mi Radar — "próximo partido" card (horizontal, data-dense)
function RadarMatchCard({
  team,
  nextMatch,
  onRemove,
}: {
  team: string;
  nextMatch: RawMatch | null;
  onRemove: () => void;
}) {
  const isHome = nextMatch
    ? nextMatch.home_team.toLowerCase() === team.toLowerCase()
    : true;
  const homeTeam = nextMatch?.home_team ?? team;
  const awayTeam = nextMatch?.away_team ?? "—";
  const fmt = nextMatch?.kickoff_time ? fmtKickoff(nextMatch.kickoff_time) : null;

  return (
    <div className={cn("flex-1 min-w-[180px] overflow-hidden rounded-xl", CARD)}>
      {/* Team header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {flagUrl(t(team), 20) && (
            <img src={flagUrl(t(team), 20)!} alt={t(team)} className="h-2.5 w-4 rounded-sm object-cover" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{t(team)}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] text-slate-700 transition-colors hover:text-slate-400"
          aria-label="Quitar"
        >
          ✕
        </button>
      </div>

      {/* Match content */}
      {nextMatch ? (
        <div className="px-3 py-3">
          <div className="flex items-center justify-center gap-2.5">
            {/* Home */}
            <div className="flex flex-col items-center gap-1">
              {flagUrl(t(homeTeam), 40) ? (
                <img
                  src={flagUrl(t(homeTeam), 40)!}
                  alt={t(homeTeam)}
                  className={cn(
                    "h-7 w-11 rounded-md object-cover shadow-sm",
                    isHome && "ring-1 ring-cyan-400/50"
                  )}
                />
              ) : (
                <div className="flex h-7 w-11 items-center justify-center rounded-md bg-slate-800 text-[8px] font-bold text-slate-500">
                  {t(homeTeam).slice(0, 3)}
                </div>
              )}
              <span className={cn(
                "max-w-[52px] truncate text-[8px] font-semibold",
                isHome ? "text-cyan-300" : "text-slate-600"
              )}>
                {t(homeTeam)}
              </span>
            </div>

            <span className="text-[9px] font-black text-slate-800">VS</span>

            {/* Away */}
            <div className="flex flex-col items-center gap-1">
              {flagUrl(t(awayTeam), 40) ? (
                <img
                  src={flagUrl(t(awayTeam), 40)!}
                  alt={t(awayTeam)}
                  className={cn(
                    "h-7 w-11 rounded-md object-cover shadow-sm",
                    !isHome && "ring-1 ring-cyan-400/50"
                  )}
                />
              ) : (
                <div className="flex h-7 w-11 items-center justify-center rounded-md bg-slate-800 text-[8px] font-bold text-slate-500">
                  {t(awayTeam).slice(0, 3)}
                </div>
              )}
              <span className={cn(
                "max-w-[52px] truncate text-[8px] font-semibold",
                !isHome ? "text-cyan-300" : "text-slate-600"
              )}>
                {t(awayTeam)}
              </span>
            </div>
          </div>

          {fmt && (
            <p className="mt-2 text-center text-[8px] font-medium text-slate-700">
              {nextMatch.status === "1H" || nextMatch.status === "2H" || nextMatch.status === "HT" 
                ? <span className="text-red-400 animate-pulse">En vivo</span>
                : fmt}
            </p>
          )}
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center">
          <p className="text-[9px] text-slate-700">Sin partido programado</p>
        </div>
      )}
    </div>
  );
}

function TeamSelectModal({
  currentFavorites,
  allTeams,
  onSave,
  onClose,
}: {
  currentFavorites: string[];
  allTeams: string[];
  onSave: (teams: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(currentFavorites);
  const [search, setSearch] = useState("");

  const filtered = allTeams.filter((team) =>
    t(team).toLowerCase().includes(search.toLowerCase())
  );

  function toggle(team: string) {
    if (selected.includes(team)) {
      setSelected((p) => p.filter((t) => t !== team));
    } else if (selected.length < 3) {
      setSelected((p) => [...p, team]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-sm font-extrabold tracking-tight text-white">Mis Equipos</p>
            <p className="text-[11px] text-slate-500">Hasta 3 equipos para tu radar</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Buscar equipo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
          />

          <div className="grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
            {filtered.map((team) => {
              const isOn = selected.includes(team);
              const isMax = !isOn && selected.length >= 3;
              return (
                <button
                  key={team}
                  type="button"
                  disabled={isMax}
                  onClick={() => toggle(team)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                    isOn
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                      : isMax
                        ? "border-slate-800/40 text-slate-700 cursor-not-allowed opacity-40"
                        : "border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white"
                  )}
                >
                  {flagUrl(t(team), 20) && (
                    <img src={flagUrl(t(team), 20)!} alt={t(team)} className="h-3 w-4.5 rounded-sm object-cover" />
                  )}
                  <span className="truncate">{t(team)}</span>
                  {isOn && <span className="ml-auto shrink-0 text-cyan-400">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-800 px-5 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-800 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onSave(selected); onClose(); }}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 py-2 text-sm font-bold text-white transition-all hover:from-cyan-400 hover:to-fuchsia-400"
          >
            Guardar ({selected.length}/3)
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassicPredictionCard({ data }: { data: ClassicPredictionSummary }) {
  const champion = deriveChampion(data);
  const filled = countFilledGroups(data.group_fixtures);
  const total = data.group_fixtures.length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const knockoutFilled = Object.keys(data.knockout_scores).length;

  return (
    <div className={cn("overflow-hidden rounded-xl p-4", CARD)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">
            Simulador Premium · Quiniela Clásica
          </p>

          {/* Champion */}
          <div className="mb-3 flex items-center gap-2">
            {champion ? (
              <>
                {flagUrl(t(champion), 40) && (
                  <img src={flagUrl(t(champion), 40)!} alt={t(champion)} className="h-4 w-6 rounded-sm object-cover" />
                )}
                <p className="text-base font-extrabold tracking-tight text-white">{t(champion)}</p>
                <span className="text-[9px] text-slate-600">campeón pronosticado</span>
              </>
            ) : (
              <p className="text-sm text-slate-600 italic">Campeón por definir</p>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-slate-600">
              <span>Grupos</span>
              <span className="tabular-nums text-slate-500">{filled}/{total}</span>
            </div>
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <p className="mt-2 text-[9px] text-slate-700">
            <span className="text-slate-500">{filled}</span> grupos · {" "}
            <span className="text-slate-500">{knockoutFilled}</span> llaves
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <p className="text-[9px] text-slate-700 text-right">
            {fmtKickoff(data.updated_at)}
          </p>
          <Link
            href="/dashboard/predict"
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:from-cyan-400 hover:to-fuchsia-400 transition-all active:scale-95"
          >
            Ver quiniela →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-800/60", className)} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RendimientoPage() {
  const router   = useRouter();
  const { planType, isVip } = useUser();
  const [stats, setStats]           = useState<UserStats | null>(null);
  const [predictions, setPredictions] = useState<PredictionDetail[]>([]);
  const [classicPred, setClassicPred] = useState<ClassicPredictionSummary | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([]);
  const [allMatches, setAllMatches] = useState<RawMatch[]>([]);
  const [showRadarModal, setShowRadarModal] = useState(false);

  // Extraemos la lista de equipos reales de la Base de Datos para el Modal
  const allTeams = Array.from(
    new Set(allMatches.flatMap((m) => [m.home_team, m.away_team]))
  ).sort((a, b) => t(a).localeCompare(t(b), "es"));

  function getNextMatch(team: string): RawMatch | null {
    return allMatches
      .filter(
        (m) =>
          (m.home_team.toLowerCase() === team.toLowerCase() ||
           m.away_team.toLowerCase() === team.toLowerCase()) &&
          !["FT", "AET", "PEN"].includes(m.status) // Mostrar NS (No Iniciado) y partidos En Vivo
      )
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())[0] ?? null;
  }

  async function handleSaveFavorites(teams: string[]) {
    try {
      await api.patch("/users/me/favorites", { teams });
      setFavoriteTeams(teams);
      toast.success("Radar actualizado");
    } catch {
      toast.error("Error al guardar tus equipos favoritos.");
    }
  }

  useEffect(() => {
    api.get("/users/me")
      .then((meRes) => {
        setFavoriteTeams(meRes.data.favorite_teams ?? []);
        return Promise.allSettled([
          api.get<UserStats>("/users/me/stats"),
          api.get<PredictionDetail[]>("/predictions/me/detail"),
          api.get<ClassicPredictionSummary>("/predictions/classic"),
          api.get<RawMatch[]>("/matches/all").catch(() => ({ data: [] })),
        ]);
      })
      .then((results) => {
        if (!Array.isArray(results)) return;
        const [statsRes, predsRes, classicRes, matchesRes] = results;
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        else toast.error("No se pudo cargar tus estadísticas.");
        if (predsRes.status === "fulfilled")
          setPredictions([...predsRes.value.data].reverse());
        if (classicRes.status === "fulfilled") setClassicPred(classicRes.value.data);
        
        if (matchesRes.status === "fulfilled")
          setAllMatches((matchesRes.value as { data: RawMatch[] }).data ?? []);
      })
      .catch(() => router.push("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) return <PageSkeleton />;
  if (!stats) return null;

  const rankLabel =
    stats.rank === 1 ? "🥇 1°"
    : stats.rank === 2 ? "🥈 2°"
    : stats.rank === 3 ? "🥉 3°"
    : `${stats.rank}°`;

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-white">Mi Rendimiento</h1>
            {isVip ? (
              <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">VIP</span>
            ) : planType === "classic" ? (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-cyan-400">Classic</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-600">Centro de mando · Mundial 2026</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isVip && (
            <Link
              href="/dashboard/upgrade"
              className="rounded-lg border border-amber-400/30 bg-amber-400/8 px-3 py-1.5 text-xs font-bold text-amber-400 transition-all hover:bg-amber-400/15"
            >
              ⬆ VIP
            </Link>
          )}
          <Link
            href="/dashboard/predict"
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-blue-500"
          >
            + Predicción
          </Link>
        </div>
      </div>

      {/* ── Compact stats strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 sm:grid-cols-4">
        <div className="border-b border-r border-slate-800 px-4 py-3 sm:border-b-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Puntos</p>
          <p className="mt-0.5 text-2xl font-black tabular-nums tracking-tight text-white">{stats.total_points}</p>
          <p className="mt-0.5 text-[9px] text-slate-700">liga global</p>
        </div>
        <div className="border-b border-slate-800 px-4 py-3 sm:border-b-0 sm:border-r">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Posición</p>
          <p className="mt-0.5 text-2xl font-black tabular-nums tracking-tight text-white">{rankLabel}</p>
          <p className="mt-0.5 text-[9px] text-slate-700">ranking</p>
        </div>
        <div className="border-r border-slate-800 px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Efectividad</p>
          <div className="mt-0.5 flex items-baseline gap-0.5">
            <span className="text-2xl font-black tabular-nums tracking-tight text-white">{stats.effectiveness}</span>
            <span className="text-xs text-slate-600">%</span>
          </div>
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
              style={{ width: `${Math.min(stats.effectiveness, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] text-slate-700">
            <span className="text-emerald-400">{stats.exact_count}</span> exactos ·{" "}
            <span className="text-amber-400">{stats.tendency_count}</span> tend.
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Predicciones</p>
          <p className="mt-0.5 text-2xl font-black tabular-nums tracking-tight text-white">{stats.total_predictions}</p>
          <p className="mt-0.5 text-[9px] text-slate-700">{stats.finished_predictions} jugadas · {stats.total_predictions - stats.finished_predictions} pend.</p>
        </div>
      </div>

      {/* ── Mi Radar ──────────────────────────────────────────────────────── */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mi Radar</h2>
          <div className="h-px flex-1 bg-slate-800" />
          <button
            type="button"
            onClick={() => setShowRadarModal(true)}
            className="text-[10px] font-semibold text-slate-600 transition-colors hover:text-slate-300"
          >
            + Editar
          </button>
        </div>

        {favoriteTeams.length > 0 ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {favoriteTeams.map((team) => (
              <RadarMatchCard
                key={team}
                team={team}
                nextMatch={getNextMatch(team)}
                onRemove={() => handleSaveFavorites(favoriteTeams.filter((t) => t !== team))}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowRadarModal(true)}
            className={cn(
              "w-full rounded-xl border border-dashed border-slate-800 py-6 text-center",
              "text-xs text-slate-700 transition-all hover:border-slate-600 hover:text-slate-500"
            )}
          >
            + Añade hasta 3 equipos para ver su próximo partido
          </button>
        )}
      </section>

      {showRadarModal && (
        <TeamSelectModal
          currentFavorites={favoriteTeams}
          allTeams={allTeams}
          onSave={handleSaveFavorites}
          onClose={() => setShowRadarModal(false)}
        />
      )}

      {/* ── Quiniela Clásica ──────────────────────────────────────────────── */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Quiniela Clásica</h2>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {classicPred ? (
          <ClassicPredictionCard data={classicPred} />
        ) : (
          <div className={cn("rounded-xl py-8 text-center", CARD)}>
            <p className="text-sm text-slate-600">Aún no has guardado tu quiniela clásica.</p>
            <Link
              href="/dashboard/predict"
              className="mt-3 inline-block rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-1.5 text-sm font-bold text-white shadow-md transition-all hover:from-cyan-400 hover:to-fuchsia-400"
            >
              Abrir Simulador
            </Link>
          </div>
        )}
      </section>

      {/* ── Historial cara a cara ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Historial</h2>
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[9px] text-slate-700">{predictions.length} pronósticos</span>
        </div>

        {predictions.length === 0 ? (
          <div className={cn("rounded-xl py-12 text-center text-sm text-slate-600", CARD)}>
            Aún no has hecho ninguna predicción.{" "}
            <Link href="/dashboard/predict" className="text-emerald-400 hover:underline">
              Predice ahora
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {predictions.map((pred) => {
              const outcome = getOutcome(pred);
              const style = OUTCOME_STYLES[outcome];
              const isFT = pred.match && ["FT", "AET", "PEN"].includes(pred.match.status);
              const homeTeam = pred.match?.home_team ?? "?";
              const awayTeam = pred.match?.away_team ?? "?";

              return (
                <div
                  key={pred.id}
                  className={cn(
                    "overflow-hidden rounded-xl transition-all duration-200",
                    CARD,
                    style.border
                  )}
                >
                  <div className="flex items-stretch">
                    <div className="flex-1 px-4 py-3">
                      <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                        {pred.match
                          ? new Date(pred.match.kickoff_time + "Z").toLocaleDateString("es-MX", {
                              weekday: "short", month: "short", day: "numeric",
                            })
                          : `Partido #${pred.match_id}`}
                      </p>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <TeamFlag team={homeTeam} />
                          <p className="text-[10px] font-bold leading-tight text-slate-400">{t(homeTeam)}</p>
                        </div>

                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] uppercase tracking-widest text-slate-700">Tú</span>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-sm font-extrabold tabular-nums text-white">
                              {pred.predicted_home}–{pred.predicted_away}
                            </span>
                          </div>
                          {isFT && pred.match ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] uppercase tracking-widest text-slate-700">Real</span>
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-sm font-extrabold tabular-nums text-slate-400">
                                {pred.match.home_score}–{pred.match.away_score}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-700">Por jugar</span>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-1 text-center">
                          <TeamFlag team={awayTeam} />
                          <p className="text-[10px] font-bold leading-tight text-slate-400">{t(awayTeam)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-800 px-3">
                      <span className={cn("rounded-lg px-2 py-1 text-center", style.badge)}>
                        <span className="block text-sm font-bold">{style.icon}</span>
                        <span className="block text-[8px] font-bold uppercase tracking-wider mt-0.5">{style.label}</span>
                      </span>
                      {isFT && (
                        <p className="text-base font-extrabold tabular-nums text-white">
                          {pred.points_earned}
                          <span className="ml-0.5 text-[9px] font-normal text-slate-600">pts</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}