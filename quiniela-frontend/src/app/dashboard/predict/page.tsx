"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface Match { id: number; home_team: string; away_team: string; kickoff_time: string; status: string }
type ApiError = { response?: { status?: number; data?: { detail?: string } } };

const extractDetail = (e: unknown) => (e as ApiError)?.response?.data?.detail ?? "Error inesperado.";
const extractStatus = (e: unknown) => (e as ApiError)?.response?.status ?? 500;
const formatKickoff = (dt: string) =>
  new Date(dt + "Z").toLocaleString("es-MX", {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

function TeamFlag({ team, size = 40 }: { team: string; size?: 20 | 40 | 80 }) {
  const url = flagUrl(team, size);
  const dim = size === 40 ? "h-8 w-12" : "h-5 w-8";
  if (!url) return <div className={cn(dim, "rounded bg-slate-700")} />;
  return <img src={url} alt={team} className={cn(dim, "rounded object-cover shadow-md")} />;
}

const GLASS = "bg-slate-900/70 backdrop-blur-xl border border-slate-700/50";

export default function PredictPage() {
  const router = useRouter();
  const [matches, setMatches]           = useState<Match[]>([]);
  const [isLoading, setIsLoading]       = useState(true);

  const [classicMatchId, setClassicMatchId] = useState<number | "">("");
  const [homeScore, setHomeScore]           = useState("");
  const [awayScore, setAwayScore]           = useState("");
  const [classicLoading, setClassicLoading] = useState(false);

  const [survivorMatchId, setSurvivorMatchId] = useState<number | "">("");
  const [teamId, setTeamId]                   = useState("");
  const [survivorLoading, setSurvivorLoading] = useState(false);

  useEffect(() => {
    api.get<Match[]>("/matches/")
      .then(({ data }) => setMatches(data))
      .catch(() => router.push("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  const classicMatch  = matches.find((m) => m.id === classicMatchId);
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
      setClassicMatchId(""); setHomeScore(""); setAwayScore("");
    } catch (err) {
      const s = extractStatus(err);
      s === 400 ? toast.warning(extractDetail(err)) : toast.error(extractDetail(err));
    } finally { setClassicLoading(false); }
  }

  async function handleSurvivorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!survivorMatchId || !teamId) return;
    setSurvivorLoading(true);
    try {
      await api.post("/survivor/pick", { match_id: survivorMatchId, team_id: teamId });
      toast.success("¡Pick guardado!", { description: `Apostaste por ${teamId}` });
      setSurvivorMatchId(""); setTeamId("");
    } catch (err) {
      const s = extractStatus(err);
      s === 400 ? toast.warning(extractDetail(err)) : toast.error(extractDetail(err));
    } finally { setSurvivorLoading(false); }
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-slate-500">Cargando partidos...</div>;
  }

  const selectClass = cn(
    "w-full rounded-xl px-3 py-2.5 text-sm text-slate-200",
    "border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl",
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
  );

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl text-white">Hacer Predicción</h1>
        <p className="mt-1 text-sm text-slate-400">
          Las apuestas cierran 5 minutos antes del partido.
        </p>
      </div>

      <Tabs defaultValue="clasico">
        <TabsList className={cn("w-full", GLASS)}>
          <TabsTrigger value="clasico" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            Clásico
          </TabsTrigger>
          <TabsTrigger value="supervivencia" className="flex-1 data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            Supervivencia
          </TabsTrigger>
        </TabsList>

        {/* ── CLÁSICO ── */}
        <TabsContent value="clasico" className="mt-4">
          <form onSubmit={handleClassicSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-300">Partido</label>
              <select className={selectClass} value={classicMatchId}
                onChange={(e) => { setClassicMatchId(Number(e.target.value)); setHomeScore(""); setAwayScore(""); }}
                required>
                <option value="">Selecciona un partido...</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>{m.home_team} vs {m.away_team}</option>
                ))}
              </select>
            </div>

            {classicMatch ? (
              <Card className="overflow-hidden border-0 shadow-2xl">
                {/* Match header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800/90 to-slate-900 px-6 pb-8 pt-6">
                  {/* Glow accents */}
                  <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-blue-600/20 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-emerald-600/15 blur-2xl" />

                  <p className="relative mb-6 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                    Mundial 2026
                  </p>
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex-1 text-center">
                      <div className="mx-auto mb-3 flex justify-center">
                        <TeamFlag team={classicMatch.home_team} size={40} />
                      </div>
                      <p className="text-base font-extrabold leading-tight text-white">{classicMatch.home_team}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Local</p>
                    </div>
                    <p className="text-xl font-light text-slate-600">vs</p>
                    <div className="flex-1 text-center">
                      <div className="mx-auto mb-3 flex justify-center">
                        <TeamFlag team={classicMatch.away_team} size={40} />
                      </div>
                      <p className="text-base font-extrabold leading-tight text-white">{classicMatch.away_team}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Visitante</p>
                    </div>
                  </div>
                  <p className="relative mt-5 text-center text-[11px] text-slate-600">
                    {formatKickoff(classicMatch.kickoff_time)}
                  </p>
                </div>

                {/* Score inputs */}
                <CardContent className="pb-6 pt-6">
                  <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Tu pronóstico</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <Input type="number" min={0} max={99} value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        className="h-20 w-24 border-slate-700/50 bg-slate-900/60 text-center text-4xl font-extrabold text-white backdrop-blur-xl focus:border-blue-500/60"
                        placeholder="0" required />
                      <p className="mt-2 text-[11px] text-slate-500">{classicMatch.home_team}</p>
                    </div>
                    <span className="mb-5 text-3xl font-light text-slate-600">—</span>
                    <div className="text-center">
                      <Input type="number" min={0} max={99} value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        className="h-20 w-24 border-slate-700/50 bg-slate-900/60 text-center text-4xl font-extrabold text-white backdrop-blur-xl focus:border-blue-500/60"
                        placeholder="0" required />
                      <p className="mt-2 text-[11px] text-slate-500">{classicMatch.away_team}</p>
                    </div>
                  </div>
                  <button type="submit" disabled={classicLoading}
                    className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-blue-500 hover:shadow-emerald-500/40 disabled:opacity-60">
                    {classicLoading ? "Guardando..." : "Guardar predicción"}
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className={cn("rounded-2xl py-16 text-center text-sm text-slate-600", GLASS)}>
                Selecciona un partido para ver el formulario
              </div>
            )}
          </form>
        </TabsContent>

        {/* ── SUPERVIVENCIA ── */}
        <TabsContent value="supervivencia" className="mt-4">
          <form onSubmit={handleSurvivorSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-300">Partido</label>
              <select className={selectClass} value={survivorMatchId}
                onChange={(e) => { setSurvivorMatchId(Number(e.target.value)); setTeamId(""); }}
                required>
                <option value="">Selecciona un partido...</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>{m.home_team} vs {m.away_team}</option>
                ))}
              </select>
            </div>

            {survivorMatch ? (
              <Card className="overflow-hidden border-0 shadow-2xl">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800/90 to-slate-900 px-6 py-5">
                  <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-blue-600/15 blur-2xl" />
                  <p className="relative text-center text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                    Supervivencia · Mundial 2026
                  </p>
                  <p className="relative mt-1 text-center text-sm font-extrabold text-white">
                    {survivorMatch.home_team} vs {survivorMatch.away_team}
                  </p>
                  <p className="relative mt-0.5 text-center text-[11px] text-slate-600">
                    {formatKickoff(survivorMatch.kickoff_time)}
                  </p>
                </div>

                <CardContent className="pb-5 pt-5">
                  <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                    ¿Quién gana?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[survivorMatch.home_team, survivorMatch.away_team].map((team) => (
                      <button key={team} type="button" onClick={() => setTeamId(team)}
                        className={cn(
                          "rounded-2xl border-2 px-4 py-5 text-center transition-all duration-200",
                          teamId === team
                            ? "border-emerald-500/70 bg-emerald-500/15 shadow-lg shadow-emerald-500/20 scale-[1.02]"
                            : "border-slate-700/50 bg-slate-900/60 backdrop-blur-xl hover:border-slate-500/50 hover:bg-slate-800/60"
                        )}>
                        <div className="mb-2 flex justify-center">
                          <TeamFlag team={team} size={40} />
                        </div>
                        <p className={cn("text-sm font-bold", teamId === team ? "text-emerald-300" : "text-white")}>
                          {team}
                        </p>
                      </button>
                    ))}
                  </div>
                  <button type="submit" disabled={survivorLoading || !teamId}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-blue-500 disabled:opacity-60">
                    {survivorLoading ? "Guardando..." : "Confirmar pick"}
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className={cn("rounded-2xl py-16 text-center text-sm text-slate-600", GLASS)}>
                Selecciona un partido para elegir tu equipo
              </div>
            )}
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
