"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
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

export default function DashboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [survivors, setSurvivors] = useState<GlobalSurvivorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get("/users/me")
      .then(({ data: me }) => {
        if (!me.is_paid) { router.replace("/pagar"); return; }
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
        <h1 className="text-2xl font-semibold">Liga Global</h1>
        <Button asChild>
          <Link href="/dashboard/predict">Hacer Predicción</Link>
        </Button>
      </div>

      <Tabs defaultValue="clasico">
        <TabsList>
          <TabsTrigger value="clasico">Clásico</TabsTrigger>
          <TabsTrigger value="supervivencia">Supervivencia</TabsTrigger>
        </TabsList>

        <TabsContent value="clasico">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-right">Pts</TableHead>
                <TableHead className="text-right">Exactos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry) => (
                <TableRow key={entry.user.id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {entry.rank}
                  </TableCell>
                  <TableCell>{entry.user.email}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {entry.total_points}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {entry.exact_matches_count}
                  </TableCell>
                </TableRow>
              ))}
              {leaderboard.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Sin datos todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="supervivencia">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último equipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {survivors.map((entry) => (
                <TableRow key={entry.user.id}>
                  <TableCell>{entry.user.email}</TableCell>
                  <TableCell>
                    {entry.is_alive ? (
                      <span className="font-semibold text-green-600">VIVO</span>
                    ) : (
                      <span className="font-semibold text-red-600">
                        ELIMINADO
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.last_team_picked ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {survivors.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    Sin datos todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
