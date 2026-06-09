"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { useLiveMatches, isLive } from "@/lib/useLiveMatches";
import { MatchCenterWidget } from "@/components/dashboard/MatchCenterWidget";
import { OnboardingModal } from "@/components/dashboard/OnboardingModal";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface LeaderboardEntry {
  rank: number;
  user: { id: number; email: string };
  total_points: number;
  exact_matches_count: number;
}

interface SurvivorEntry {
  user: { id: number; email: string };
  is_alive: boolean;
  last_team_picked: string | null;
}

interface Prediction {
  id: number;
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  points_earned: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

type OutcomeKey = "exact" | "partial" | "difference" | "tendency" | "miss" | "pending";

function getOutcome(pred: Prediction, matchStatus: string | undefined): OutcomeKey {
  if (!matchStatus || matchStatus !== "FT") return "pending";
  if (pred.points_earned === 5) return "exact";
  if (pred.points_earned === 3) return "partial";
  if (pred.points_earned === 2) return "difference";
  if (pred.points_earned === 1) return "tendency";
  return "miss";
}

const OUTCOME: Record<OutcomeKey, { icon: string; label: string; color: string }> = {
  exact:      { icon: "✅", label: "¡Exacto!",         color: "text-emerald-400" },
  partial:    { icon: "🎯", label: "Ganador + gol",    color: "text-cyan-400"    },
  difference: { icon: "📐", label: "Ganador + dif.",   color: "text-blue-400"    },
  tendency:   { icon: "📈", label: "Tendencia",        color: "text-amber-400"   },
  miss:       { icon: "❌", label: "Fallaste",          color: "text-red-400"     },
  pending:    { icon: "⏳", label: "Pendiente",         color: "text-slate-500"   },
};

const GLASS = "bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 hover:border-slate-500/50 transition-all duration-300";

function LiveBadge({ elapsed }: { elapsed: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-400 ring-1 ring-red-500/25">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      EN VIVO{elapsed != null ? ` · ${elapsed}'` : ""}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { matches: allMatches, isRefreshing } = useLiveMatches("/matches/all", { liveMs: 30_000, idleMs: 60_000 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [survivors, setSurvivors] = useState<SurvivorEntry[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPaidClassic, setHasPaidClassic] = useState(false);
  const [hasPaidSurvival, setHasPaidSurvival] = useState(false);
  // planType derived from paid flags (matches useUser logic)
  const planType = hasPaidClassic && hasPaidSurvival ? "vip" : hasPaidClassic ? "classic" : "basic";

  useEffect(() => {
    api.get("/users/me")
      .then(({ data: me }) => {
        setHasPaidClassic(me.has_paid_classic);
        setHasPaidSurvival(me.has_paid_survival);
        return Promise.all([
          api.get<LeaderboardEntry[]>("/leaderboard/global"),
          api.get<SurvivorEntry[]>("/survivors/global"),
          api.get<Prediction[]>("/predictions/me"),
        ]).then(([lb, sv, preds]) => {
          setLeaderboard(lb.data);
          setSurvivors(sv.data);
          setPredictions(preds.data);
        });
      })
      .catch(() => router.push("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Cargando liga global...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OnboardingModal />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl text-white">Liga Global</h1>
            {planType === "vip" && (
              <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">VIP</span>
            )}
            {planType === "classic" && (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-cyan-400">Classic</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-400">
            Mundial 2026 · Clasificación en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          {planType === "basic" && (
            <Link
              href="/dashboard/upgrade"
              className="rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-1.5 text-xs font-bold text-amber-400 transition-all hover:bg-amber-400/15"
            >
              ⬆ VIP
            </Link>
          )}
          {isRefreshing && (
            <span className="text-[10px] font-medium text-red-400 animate-pulse">● EN VIVO</span>
          )}
          <Link
            href="/dashboard/predict"
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-blue-500 hover:shadow-emerald-500/40"
          >
            + Predicción
          </Link>
        </div>
      </div>

      <MatchCenterWidget />

      <Tabs defaultValue="clasico">
        <TabsList className="border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <TabsTrigger value="clasico" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <span className="flex items-center gap-1.5">
              Clásico
              {hasPaidClassic ? (
                <InfoTooltip
                  text="5 pts: marcador exacto · 3 pts: ganador + un marcador exacto · 2 pts: ganador + misma diferencia · 1 pt: solo el ganador · 0 pts: fallo."
                  position="bottom"
                />
              ) : (
                <span className="text-base">🔒</span>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="supervivencia" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <span className="flex items-center gap-1.5">
              Supervivencia
              {hasPaidSurvival ? (
                <InfoTooltip
                  text="Elige un equipo por jornada. Si empata o pierde, quedas eliminado. No puedes repetir el mismo equipo."
                  position="bottom"
                />
              ) : (
                <span className="text-base">🔒</span>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pronósticos" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            Mis Pronósticos
          </TabsTrigger>
        </TabsList>

        {/* ── CLÁSICO ── */}
        <TabsContent value="clasico" className="mt-4">
          <div className={cn("overflow-hidden rounded-2xl shadow-2xl", GLASS)}>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Pos</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Usuario</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Pts</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Exactos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow
                    key={entry.user.id}
                    className={cn(
                      "border-slate-700/30 transition-colors hover:bg-white/5",
                      entry.rank === 1 && "bg-yellow-400/5"
                    )}
                  >
                    <TableCell className="text-center">
                      {entry.rank <= 3
                        ? <span className="text-lg">{MEDALS[entry.rank - 1]}</span>
                        : <span className="text-sm font-medium text-slate-500">{entry.rank}</span>}
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">{entry.user.email}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-base font-extrabold tabular-nums text-white">{entry.total_points}</span>
                      <span className="ml-0.5 text-xs text-slate-500">pts</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-400">{entry.exact_matches_count}</TableCell>
                  </TableRow>
                ))}
                {leaderboard.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">Sin datos todavía.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── SUPERVIVENCIA ── */}
        <TabsContent value="supervivencia" className="mt-4">
          {!hasPaidSurvival ? (
            <DashboardSurvivalPaywall />
          ) : (
          <div className={cn("overflow-hidden rounded-2xl shadow-2xl", GLASS)}>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Usuario</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estado</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Último equipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {survivors.map((entry) => (
                  <TableRow key={entry.user.id} className="border-slate-700/30 transition-colors hover:bg-white/5">
                    <TableCell className="font-medium text-slate-200">{entry.user.email}</TableCell>
                    <TableCell>
                      {entry.is_alive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> VIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> ELIMINADO
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.last_team_picked ? (
                        <span className="flex items-center gap-2 text-sm text-slate-300">
                          {flagUrl(entry.last_team_picked, 20) && (
                            <img src={flagUrl(entry.last_team_picked, 20)} alt={entry.last_team_picked} className="h-3 w-5 rounded-sm object-cover" />
                          )}
                          {entry.last_team_picked}
                        </span>
                      ) : <span className="text-slate-500">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {survivors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center text-sm text-slate-500">Sin datos todavía.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </TabsContent>

        {/* ── MIS PRONÓSTICOS ── */}
        <TabsContent value="pronósticos" className="mt-4">
          {predictions.length === 0 ? (
            <div className={cn("rounded-2xl py-16 text-center text-sm text-slate-500", GLASS)}>
              Aún no has hecho ninguna predicción.{" "}
              <Link href="/dashboard/predict" className="text-emerald-400 hover:underline">Predice ahora</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {predictions.map((pred) => {
                const match = allMatches.find((m) => m.id === pred.match_id);
                const live = match ? isLive(match.status) : false;
                const outcome = getOutcome(pred, match?.status);
                const { icon, label, color } = OUTCOME[outcome];
                const isFT = match?.status === "FT";
                return (
                  <div key={pred.id} className={cn(
                    "flex items-center gap-4 rounded-xl px-4 py-3 transition-all",
                    GLASS,
                    live && "border-red-500/40 bg-red-500/5"
                  )}>
                    <span className="text-2xl">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          {match ? `${match.home_team} vs ${match.away_team}` : `Partido #${pred.match_id}`}
                        </p>
                        {live && match && <LiveBadge elapsed={match.elapsed ?? null} />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">
                          Tu pronóstico: <span className="tabular-nums">{pred.predicted_home} — {pred.predicted_away}</span>
                        </span>
                        {(isFT || live) && match && (
                          <span className="text-sm text-slate-400 tabular-nums">
                            {live ? "En curso:" : "Real:"} {match.home_score} — {match.away_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-semibold", color)}>{label}</p>
                      {isFT && (
                        <p className="text-lg font-extrabold tabular-nums text-white">
                          {pred.points_earned}<span className="ml-0.5 text-xs font-normal text-slate-500">pts</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardSurvivalPaywall() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/50">
      {/* Blurred table skeleton */}
      <div className="pointer-events-none select-none space-y-px blur-sm">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-700/30 bg-slate-900/60 px-4 py-3">
            <div className="h-4 w-32 rounded bg-slate-700/50" />
            <div className="h-5 w-20 rounded-full bg-emerald-500/20" />
            <div className="h-4 w-16 rounded bg-slate-700/30" />
          </div>
        ))}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/75 px-8 text-center backdrop-blur-[2px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <span className="text-2xl">💀</span>
        </div>
        <div>
          <p className="font-bold text-white">Modo Supervivencia bloqueado</p>
          <p className="mt-1 text-sm text-slate-400">
            Activa tu pase para ver la tabla de supervivientes y hacer tus picks.
          </p>
        </div>
        <Link
          href="/dashboard/upgrade"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-orange-400"
        >
          ⬆ Ver Pase VIP
        </Link>
      </div>
    </div>
  );
}
