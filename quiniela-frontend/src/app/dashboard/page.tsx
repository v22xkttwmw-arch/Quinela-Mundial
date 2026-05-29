"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
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

interface Match {
  id: number;
  home_team: string;
  away_team: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
}

interface Prediction {
  id: number;
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  points_earned: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function outcomeIcon(pred: Prediction, match: Match | undefined) {
  if (!match || match.status !== "FT") return { icon: "⏳", label: "Pendiente", color: "text-slate-500" };
  if (pred.points_earned === 3) return { icon: "✅", label: "¡Exacto!", color: "text-emerald-400" };
  if (pred.points_earned === 1) return { icon: "🎯", label: "Tendencia", color: "text-blue-400" };
  return { icon: "❌", label: "Fallaste", color: "text-red-400" };
}

const GLASS = "bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 hover:border-slate-500/50 transition-all duration-300";

export default function DashboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [survivors, setSurvivors] = useState<SurvivorEntry[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get("/users/me")
      .then(({ data: me }) => {
        if (!me.is_paid) { router.replace("/pagar"); return; }
        return Promise.all([
          api.get<LeaderboardEntry[]>("/leaderboard/global"),
          api.get<SurvivorEntry[]>("/survivors/global"),
          api.get<Prediction[]>("/predictions/me"),
          api.get<Match[]>("/matches/all"),
        ]).then(([lb, sv, preds, matches]) => {
          setLeaderboard(lb.data);
          setSurvivors(sv.data);
          setPredictions(preds.data);
          setAllMatches(matches.data);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-white">Liga Global</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Mundial 2026 · Clasificación en tiempo real
          </p>
        </div>
        <Link
          href="/dashboard/predict"
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-blue-500 hover:shadow-emerald-500/40"
        >
          + Predicción
        </Link>
      </div>

      <Tabs defaultValue="clasico">
        <TabsList className="border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <TabsTrigger value="clasico" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            Clásico
          </TabsTrigger>
          <TabsTrigger value="supervivencia" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            Supervivencia
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
                const { icon, label, color } = outcomeIcon(pred, match);
                const isFT = match?.status === "FT";
                return (
                  <div key={pred.id} className={cn("flex items-center gap-4 rounded-xl px-4 py-3", GLASS)}>
                    <span className="text-2xl">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        {match ? `${match.home_team} vs ${match.away_team}` : `Partido #${pred.match_id}`}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">
                          Tu pronóstico: <span className="tabular-nums">{pred.predicted_home} — {pred.predicted_away}</span>
                        </span>
                        {isFT && match && (
                          <span className="text-sm text-slate-400 tabular-nums">
                            Real: {match.home_score} — {match.away_score}
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
