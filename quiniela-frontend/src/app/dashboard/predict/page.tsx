"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface Match {
  id: number;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  status: string;
}

type ApiError = { response?: { status?: number; data?: { detail?: string } } };

function extractDetail(err: unknown): string {
  return (err as ApiError)?.response?.data?.detail ?? "Error inesperado.";
}
function extractStatus(err: unknown): number {
  return (err as ApiError)?.response?.status ?? 500;
}
function formatKickoff(dt: string) {
  return new Date(dt + "Z").toLocaleString("es-MX", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PredictPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [classicMatchId, setClassicMatchId] = useState<number | "">("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [classicLoading, setClassicLoading] = useState(false);

  const [survivorMatchId, setSurvivorMatchId] = useState<number | "">("");
  const [teamId, setTeamId] = useState("");
  const [survivorLoading, setSurvivorLoading] = useState(false);

  useEffect(() => {
    api
      .get<Match[]>("/matches/")
      .then(({ data }) => setMatches(data))
      .catch(() => router.push("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  const classicMatch = matches.find((m) => m.id === classicMatchId);
  const survivorMatch = matches.find((m) => m.id === survivorMatchId);

  async function handleClassicSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classicMatchId) return;
    setClassicLoading(true);
    try {
      await api.post("/predictions/", {
        match_id: classicMatchId,
        predicted_home: parseInt(homeScore),
        predicted_away: parseInt(awayScore),
      });
      toast.success("¡Predicción guardada!", {
        description: `${classicMatch?.home_team} ${homeScore} — ${awayScore} ${classicMatch?.away_team}`,
      });
      setClassicMatchId("");
      setHomeScore("");
      setAwayScore("");
    } catch (err) {
      const status = extractStatus(err);
      const detail = extractDetail(err);
      if (status === 400) toast.warning(detail);
      else toast.error(detail);
    } finally {
      setClassicLoading(false);
    }
  }

  async function handleSurvivorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!survivorMatchId || !teamId) return;
    setSurvivorLoading(true);
    try {
      await api.post("/survivor/pick", {
        match_id: survivorMatchId,
        team_id: teamId,
      });
      toast.success("¡Pick guardado!", {
        description: `Apostaste por ${teamId}`,
      });
      setSurvivorMatchId("");
      setTeamId("");
    } catch (err) {
      const status = extractStatus(err);
      const detail = extractDetail(err);
      if (status === 400) toast.warning(detail);
      else toast.error(detail);
    } finally {
      setSurvivorLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando partidos...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hacer Predicción</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Las apuestas cierran 5 minutos antes del inicio del partido.
        </p>
      </div>

      <Tabs defaultValue="clasico">
        <TabsList className="w-full">
          <TabsTrigger value="clasico" className="flex-1">
            Clásico
          </TabsTrigger>
          <TabsTrigger value="supervivencia" className="flex-1">
            Supervivencia
          </TabsTrigger>
        </TabsList>

        {/* ── CLÁSICO ── */}
        <TabsContent value="clasico" className="mt-4">
          <form onSubmit={handleClassicSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Partido</label>
              <select
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring"
                value={classicMatchId}
                onChange={(e) => {
                  setClassicMatchId(Number(e.target.value));
                  setHomeScore("");
                  setAwayScore("");
                }}
                required
              >
                <option value="">Selecciona un partido...</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home_team} vs {m.away_team}
                  </option>
                ))}
              </select>
            </div>

            {classicMatch ? (
              <Card className="overflow-hidden border-0 shadow-xl">
                {/* Cabecera oscura tipo estadio */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pb-8 pt-6 text-white">
                  <p className="mb-6 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Mundial 2026
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 text-center">
                      {/* espacio para bandera */}
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-2xl">
                        🏴
                      </div>
                      <p className="text-base font-bold leading-tight">
                        {classicMatch.home_team}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                        Local
                      </p>
                    </div>
                    <p className="text-xl font-light text-slate-500">vs</p>
                    <div className="flex-1 text-center">
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-2xl">
                        🏴
                      </div>
                      <p className="text-base font-bold leading-tight">
                        {classicMatch.away_team}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                        Visitante
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 text-center text-[11px] text-slate-500">
                    {formatKickoff(classicMatch.kickoff_time)}
                  </p>
                </div>

                {/* Inputs de marcador */}
                <CardContent className="pb-6 pt-6">
                  <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Tu pronóstico
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        className="h-20 w-24 text-center text-4xl font-bold shadow-sm"
                        placeholder="0"
                        required
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {classicMatch.home_team}
                      </p>
                    </div>
                    <span className="mb-5 text-3xl font-light text-muted-foreground">
                      —
                    </span>
                    <div className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        className="h-20 w-24 text-center text-4xl font-bold shadow-sm"
                        placeholder="0"
                        required
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {classicMatch.away_team}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="mt-6 w-full"
                    size="lg"
                    disabled={classicLoading}
                  >
                    {classicLoading ? "Guardando..." : "Guardar predicción"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-muted py-16 text-center text-sm text-muted-foreground">
                Selecciona un partido para ver el formulario
              </div>
            )}
          </form>
        </TabsContent>

        {/* ── SUPERVIVENCIA ── */}
        <TabsContent value="supervivencia" className="mt-4">
          <form onSubmit={handleSurvivorSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Partido</label>
              <select
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring"
                value={survivorMatchId}
                onChange={(e) => {
                  setSurvivorMatchId(Number(e.target.value));
                  setTeamId("");
                }}
                required
              >
                <option value="">Selecciona un partido...</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.home_team} vs {m.away_team}
                  </option>
                ))}
              </select>
            </div>

            {survivorMatch ? (
              <Card className="overflow-hidden border-0 shadow-xl">
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
                  <p className="text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Supervivencia · Mundial 2026
                  </p>
                  <p className="mt-1 text-center text-sm font-semibold">
                    {survivorMatch.home_team} vs {survivorMatch.away_team}
                  </p>
                  <p className="mt-0.5 text-center text-[11px] text-slate-500">
                    {formatKickoff(survivorMatch.kickoff_time)}
                  </p>
                </div>
                <CardContent className="pb-5 pt-5">
                  <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    ¿Quién gana?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[survivorMatch.home_team, survivorMatch.away_team].map(
                      (team) => (
                        <button
                          key={team}
                          type="button"
                          onClick={() => setTeamId(team)}
                          className={cn(
                            "rounded-xl border-2 px-4 py-5 text-center transition-all duration-150",
                            teamId === team
                              ? "scale-[1.02] border-primary bg-primary text-primary-foreground shadow-lg"
                              : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                          )}
                        >
                          <div className="mb-1.5 text-3xl">🏴</div>
                          <p className="text-sm font-semibold">{team}</p>
                        </button>
                      )
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="mt-4 w-full"
                    size="lg"
                    disabled={survivorLoading || !teamId}
                  >
                    {survivorLoading ? "Guardando..." : "Confirmar pick"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-muted py-16 text-center text-sm text-muted-foreground">
                Selecciona un partido para elegir tu equipo
              </div>
            )}
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
