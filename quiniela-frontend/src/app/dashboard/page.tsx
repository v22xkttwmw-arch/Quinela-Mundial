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

interface GlobalLeaderboardEntry {
  rank: number;
  user: { id: number; email: string };
  total_points: number;
  exact_matches_count: number;
}

interface GlobalSurvivorEntry {
  user: { id: number; email: string };
  is_alive: boolean;
  last_team_picked: string | null;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function rankCell(rank: number) {
  if (rank <= 3) return <span className="text-lg">{MEDALS[rank - 1]}</span>;
  return (
    <span className="text-sm font-medium text-muted-foreground">{rank}</span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [survivors, setSurvivors] = useState<GlobalSurvivorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/users/me")
      .then(({ data: me }) => {
        if (!me.is_paid) {
          router.replace("/pagar");
          return;
        }
        return Promise.all([
          api.get<GlobalLeaderboardEntry[]>("/leaderboard/global"),
          api.get<GlobalSurvivorEntry[]>("/survivors/global"),
        ]).then(([lb, sv]) => {
          setLeaderboard(lb.data);
          setSurvivors(sv.data);
        });
      })
      .catch(() => router.push("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando liga global...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liga Global</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mundial 2026 · Clasificación en tiempo real
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/predict">+ Predicción</Link>
        </Button>
      </div>

      <Tabs defaultValue="clasico">
        <TabsList>
          <TabsTrigger value="clasico">Clásico</TabsTrigger>
          <TabsTrigger value="supervivencia">Supervivencia</TabsTrigger>
        </TabsList>

        {/* ── CLÁSICO ── */}
        <TabsContent value="clasico" className="mt-4">
          <div className="overflow-hidden rounded-xl border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-14 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pos
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Usuario
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pts
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Exactos
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow
                    key={entry.user.id}
                    className={cn(
                      "transition-colors hover:bg-muted/40",
                      entry.rank === 1 && "bg-yellow-50/60 hover:bg-yellow-50"
                    )}
                  >
                    <TableCell className="text-center">
                      {rankCell(entry.rank)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.user.email}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-base font-bold tabular-nums">
                        {entry.total_points}
                      </span>
                      <span className="ml-0.5 text-xs text-muted-foreground">
                        pts
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {entry.exact_matches_count}
                    </TableCell>
                  </TableRow>
                ))}
                {leaderboard.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
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
          <div className="overflow-hidden rounded-xl border shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Usuario
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Estado
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Último equipo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {survivors.map((entry) => (
                  <TableRow
                    key={entry.user.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="font-medium">
                      {entry.user.email}
                    </TableCell>
                    <TableCell>
                      {entry.is_alive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          VIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          ELIMINADO
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.last_team_picked ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {survivors.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      Sin datos todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
