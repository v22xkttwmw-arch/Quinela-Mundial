"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import {
  buildTournamentSnapshotWithKnockout,
  resolveKnockoutWinner,
} from "@/lib/classicPredictor";

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
  updated_at: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const GLASS = "bg-slate-900/60 backdrop-blur-xl border border-slate-700/50";

type OutcomeKey = "exact" | "tendency" | "miss" | "pending";

function getOutcome(pred: PredictionDetail): OutcomeKey {
  if (!pred.match || pred.match.status !== "FT") return "pending";
  if (pred.points_earned === 3) return "exact";
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
    border: "border-l-4 border-l-slate-600",
    badge: "bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/30",
    label: "Pendiente",
    icon: "◌",
  },
};

function deriveChampion(data: ClassicPredictionSummary): string | null {
  try {
    const snapshot = buildTournamentSnapshotWithKnockout(
      data.group_fixtures.map((f) => ({
        ...f,
        phase: "groups" as const,
        kickoffTime: undefined,
      })),
      data.knockout_scores
    );
    const winner = resolveKnockoutWinner(snapshot.final, data.knockout_scores);
    return winner === "home" ? snapshot.final.home : winner === "away" ? snapshot.final.away : null;
  } catch {
    return null;
  }
}

function countFilledGroups(fixtures: GroupFixture[]): number {
  return fixtures.filter(
    (f) => typeof f.homeScore === "number" && typeof f.awayScore === "number"
  ).length;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TeamFlag({ team, size = 40 }: { team: string; size?: 20 | 40 | 80 }) {
  const url = flagUrl(team, size);
  if (!url) return <div className="h-4 w-6 rounded-sm bg-slate-700" />;
  return <img src={url} alt={team} className="h-4 w-6 rounded-sm object-cover" />;
}

function StatCard({
  label,
  value,
  sub,
  gradient,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  icon: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 shadow-xl transition-all duration-300 hover:scale-[1.02]", GLASS)}>
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-30", gradient)} />
      <div className="relative">
        <p className="mb-3 text-xl">{icon}</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-white">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function EffectivenessCard({ stats }: { stats: UserStats }) {
  const pct = stats.effectiveness;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl p-5 shadow-xl transition-all duration-300 hover:scale-[1.02]", GLASS)}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500 blur-2xl opacity-20" />
      <div className="relative">
        <p className="mb-3 text-xl">⚡</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Efectividad</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-white">
          {pct}<span className="ml-0.5 text-lg text-slate-400">%</span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
          <span><span className="font-bold text-emerald-400">{stats.exact_count}</span> exactos</span>
          <span><span className="font-bold text-amber-300">{stats.tendency_count}</span> tendencias</span>
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
    <div className={cn("relative overflow-hidden rounded-2xl p-5 shadow-xl", GLASS)}>
      <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-cyan-500 blur-3xl opacity-10" />
      <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-fuchsia-500 blur-3xl opacity-10" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏆</span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
              Quiniela Clásica — Simulador Premium
            </p>
          </div>

          {/* Champion */}
          <div className="mb-4">
            <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">Campeón pronosticado</p>
            {champion ? (
              <div className="flex items-center gap-2">
                <TeamFlag team={champion} />
                <p className="text-lg font-extrabold text-white">{champion}</p>
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-500 italic">Por definir en el bracket</p>
            )}
          </div>

          {/* Progress bar — group predictions */}
          <div className="space-y-1 mb-4">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-600">
              <span>Grupos completados</span>
              <span className="tabular-nums text-slate-400">{filled}/{total}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Meta stats */}
          <div className="flex gap-4 text-[10px] text-slate-500">
            <span>
              <span className="font-bold text-slate-300">{filled}</span> grupos · {" "}
              <span className="font-bold text-slate-300">{knockoutFilled}</span> llaves eliminatorias
            </span>
          </div>
        </div>

        {/* Right: date + CTA */}
        <div className="flex shrink-0 flex-col items-end gap-3">
          <p className="text-[9px] text-slate-600 text-right">
            Guardado<br />
            <span className="text-slate-400 font-medium">{formatDate(data.updated_at)}</span>
          </p>
          <Link
            href="/dashboard/predict"
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 active:scale-95",
              "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-lg",
              "hover:from-cyan-400 hover:to-fuchsia-400 shadow-cyan-500/20"
            )}
          >
            Ver Quiniela →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-slate-800/60", className)} />
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-40 rounded-2xl" />

      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RendimientoPage() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [predictions, setPredictions] = useState<PredictionDetail[]>([]);
  const [classicPred, setClassicPred] = useState<ClassicPredictionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Auth check first, then parallel fetches
    api.get("/users/me")
      .then(() =>
        Promise.allSettled([
          api.get<UserStats>("/users/me/stats"),
          api.get<PredictionDetail[]>("/predictions/me/detail"),
          api.get<ClassicPredictionSummary>("/predictions/classic"),
        ])
      )
      .then((results) => {
        if (!Array.isArray(results)) return; // auth failed — redirect handled below

        const [statsRes, predsRes, classicRes] = results;

        if (statsRes.status === "fulfilled") {
          setStats(statsRes.value.data);
        } else {
          toast.error("No se pudo cargar tus estadísticas.");
        }

        if (predsRes.status === "fulfilled") {
          setPredictions([...predsRes.value.data].reverse());
        }

        if (classicRes.status === "fulfilled") {
          setClassicPred(classicRes.value.data);
        } else {
          const status = (classicRes.reason as { response?: { status?: number } })?.response?.status;
          if (status !== 404) {
            toast.error("No se pudo cargar tu quiniela clásica.");
          }
          // 404 = sin quiniela guardada aún — silencioso
        }
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Mi Rendimiento</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Centro de mando personal · Mundial 2026
          </p>
        </div>
        <Link
          href="/dashboard/predict"
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-blue-500"
        >
          + Predicción
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon="⚽"
          label="Puntos Totales"
          value={stats.total_points}
          sub="en la liga global"
          gradient="bg-emerald-500"
        />
        <StatCard
          icon="🏆"
          label="Posición Global"
          value={rankLabel}
          sub={`de ${stats.total_predictions > 0 ? "todos" : "—"} los participantes`}
          gradient="bg-yellow-500"
        />
        <EffectivenessCard stats={stats} />
        <StatCard
          icon="📊"
          label="Predicciones"
          value={stats.total_predictions}
          sub={`${stats.finished_predictions} jugadas · ${stats.total_predictions - stats.finished_predictions} pendientes`}
          gradient="bg-blue-500"
        />
      </div>

      {/* Quiniela Clásica */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Simulador Premium
          </h2>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {classicPred ? (
          <ClassicPredictionCard data={classicPred} />
        ) : (
          <div className={cn("rounded-2xl py-10 text-center", GLASS)}>
            <p className="text-sm text-slate-500">Aún no has guardado tu quiniela clásica.</p>
            <Link
              href="/dashboard/predict"
              className="mt-3 inline-block rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white shadow-lg transition-all hover:from-cyan-400 hover:to-fuchsia-400"
            >
              Abrir Simulador
            </Link>
          </div>
        )}
      </section>

      {/* Head-to-Head History */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Historial cara a cara
          </h2>
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[10px] text-slate-600">{predictions.length} pronósticos</span>
        </div>

        {predictions.length === 0 ? (
          <div className={cn("rounded-2xl py-16 text-center text-sm text-slate-500", GLASS)}>
            Aún no has hecho ninguna predicción.{" "}
            <Link href="/dashboard/predict" className="text-emerald-400 hover:underline">
              Predice ahora
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {predictions.map((pred) => {
              const outcome = getOutcome(pred);
              const style = OUTCOME_STYLES[outcome];
              const isFT = pred.match?.status === "FT";
              const homeTeam = pred.match?.home_team ?? "?";
              const awayTeam = pred.match?.away_team ?? "?";

              return (
                <div
                  key={pred.id}
                  className={cn(
                    "overflow-hidden rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.005]",
                    GLASS,
                    style.border
                  )}
                >
                  <div className="flex items-stretch">
                    <div className="flex-1 px-5 py-4">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {pred.match
                          ? new Date(pred.match.kickoff_time + "Z").toLocaleDateString("es-MX", {
                              weekday: "short", month: "short", day: "numeric",
                            })
                          : `Partido #${pred.match_id}`}
                      </p>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <TeamFlag team={homeTeam} size={40} />
                          <p className="text-[11px] font-bold leading-tight text-slate-300">{homeTeam}</p>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] uppercase tracking-widest text-slate-600">Tú</span>
                            <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-base font-extrabold tabular-nums text-white">
                              {pred.predicted_home} — {pred.predicted_away}
                            </span>
                          </div>
                          {isFT && pred.match ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] uppercase tracking-widest text-slate-600">Real</span>
                              <span className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-base font-extrabold tabular-nums text-slate-300">
                                {pred.match.home_score} — {pred.match.away_score}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-700">Por jugar</span>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <TeamFlag team={awayTeam} size={40} />
                          <p className="text-[11px] font-bold leading-tight text-slate-300">{awayTeam}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-700/40 px-4">
                      <span className={cn("rounded-xl px-2.5 py-1 text-center", style.badge)}>
                        <span className="block text-base font-bold">{style.icon}</span>
                        <span className="block text-[9px] font-bold uppercase tracking-wider mt-0.5">{style.label}</span>
                      </span>
                      {isFT && (
                        <p className="text-lg font-extrabold tabular-nums text-white">
                          {pred.points_earned}
                          <span className="ml-0.5 text-[10px] font-normal text-slate-500">pts</span>
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
