"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  kickoff_time: string;
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
  if (!match || match.status !== "FT") return { icon: "⏳", label: "Pendiente" };
  if (pred.points_earned === 3) return { icon: "✅", label: "Exacto" };
  if (pred.points_earned === 1) return { icon: "🎯", label: "Tendencia" };
  return { icon: "❌", label: "Fallaste" };
}

export default function DashboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [survivors, setSurvivors] = useState<SurvivorEntry[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/users/me")
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
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Liga Global
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Mundial 2026 · Clasificación en tiempo real
          </p>
        </div>
        <Button
          asChild
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          <Link href="/dashboard/predict">+ Predicción</Link>
        </Button>
      </div>

      <Tabs defaultValue="clasico">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="clasico" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-400">
            Clásico
          </TabsTrigger>
          <TabsTrigger value="supervivencia" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-400">
            Supervivencia
          </TabsTrigger>
          <TabsTrigger value="pronósticos" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-400">
            Mis Pronósticos
          </TabsTrigger>
        </TabsList>

        {/* ── CLÁSICO ── */}
        <TabsContent value="clasico" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="w-14 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Pos
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Usuario
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Pts
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Exactos
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow
                    key={entry.user.id}
                    className={cn(
                      "border-slate-800 transition-colors hover:bg-slate-800/60",
                      entry.rank === 1 && "bg-yellow-400/5"
                    )}
                  >
                    <TableCell className="text-center">
                      {entry.rank <= 3 ? (
                        <span className="text-lg">{MEDALS[entry.rank - 1]}</span>
                      ) : (
                        <span className="text-sm text-slate-500">{entry.rank}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">
                      {entry.user.email}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-base font-bold tabular-nums text-white">
                        {entry.total_points}
                      </span>
                      <span className="ml-0.5 text-xs text-slate-500">pts</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-400">
                      {entry.exact_matches_count}
                    </TableCell>
                  </TableRow>
                ))}
                {leaderboard.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-slate-500">
                      Sin datos todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── SUPERVIVENCIA ── */}
        <TabsContent value="supervivencia" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Usuario
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Estado
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Último equipo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {survivors.map((entry) => (
                  <TableRow key={entry.user.id} className="border-slate-800 transition-colors hover:bg-slate-800/60">
                    <TableCell className="font-medium text-slate-200">
                      {entry.user.email}
                    </TableCell>
                    <TableCell>
                      {entry.is_alive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                          VIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          ELIMINADO
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">
                      {entry.last_team_picked ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {survivors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-12 text-center text-sm text-slate-500">
                      Sin datos todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── MIS PRONÓSTICOS ── */}
        <TabsContent value="pronósticos" className="mt-4">
          {predictions.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-800 py-16 text-center text-sm text-slate-500">
              Aún no has hecho ninguna predicción.{" "}
              <Link href="/dashboard/predict" className="text-blue-400 hover:underline">
                Predice ahora
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.map((pred) => {
                const match = allMatches.find((m) => m.id === pred.match_id);
                const { icon, label } = outcomeIcon(pred, match);
                const isFT = match?.status === "FT";
                return (
                  <div
                    key={pred.id}
                    className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 transition-colors hover:bg-slate-800/60"
                  >
                    {/* Outcome icon */}
                    <span className="text-2xl">{icon}</span>

                    {/* Match info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {match
                          ? `${match.home_team} vs ${match.away_team}`
                          : `Partido #${pred.match_id}`}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-sm font-medium text-white">
                          Tu pronóstico:{" "}
                          <span className="tabular-nums">
                            {pred.predicted_home} — {pred.predicted_away}
                          </span>
                        </span>
                        {isFT && match && (
                          <span className="text-sm text-slate-400 tabular-nums">
                            Real: {match.home_score} — {match.away_score}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Points + label */}
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{label}</p>
                      {isFT && (
                        <p className="text-lg font-bold text-white tabular-nums">
                          {pred.points_earned}
                          <span className="ml-0.5 text-xs font-normal text-slate-500">
                            pts
                          </span>
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
