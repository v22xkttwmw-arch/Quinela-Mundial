"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { useLiveMatches, isLive } from "@/lib/useLiveMatches";
import { ArrowUp, ArrowDown } from "lucide-react";
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

import { useLanguage } from "@/lib/LanguageContext";
import { translations } from "@/lib/translations";

interface LeaderboardEntry {
  rank: number;
  user: { id: number; email: string; name: string; last_active?: string | null; is_online?: boolean | null };
  total_points: number;
  exact_matches_count?: number;
  diff_matches_count?: number;
  tendency_matches_count?: number;
  exact_matches?: number;
  diff_matches?: number;
  tendency_matches?: number;
  rank_change?: number;
  live_points_earned?: number;
}

interface SurvivorEntry {
  user: { id: number; email: string; name: string };
  is_alive: boolean;
  last_team_picked: string | null;
}

interface DailyFeedPick {
  user_name: string;
  pred_home?: number | null;
  pred_away?: number | null;
  tendency?: string | null;
}

interface DailyFeedMatch {
  id: number;
  home_team: string;
  away_team: string;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
  kickoff_time: string;
  picks?: DailyFeedPick[];
}

function displayName(user: { email: string; name: string }): string {
  return user.name || user.email.split("@")[0];
}

interface Prediction {
  id: number;
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  points_earned: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

type OutcomeKey = "exact" | "difference" | "tendency" | "miss" | "pending";

function getOutcome(pred: Prediction, matchStatus: string | undefined): OutcomeKey {
  if (!matchStatus || matchStatus !== "FT") return "pending";
  if (pred.points_earned === 5) return "exact";
  if (pred.points_earned === 3) return "difference";
  if (pred.points_earned === 1) return "tendency";
  return "miss";
}

const OUTCOME_STYLES: Record<OutcomeKey, { icon: string; color: string }> = {
  exact:      { icon: "✅", color: "text-emerald-400" },
  difference: { icon: "📐", color: "text-blue-400"    },
  tendency:   { icon: "📈", color: "text-amber-400"   },
  miss:       { icon: "❌", color: "text-red-400"     },
  pending:    { icon: "⏳", color: "text-slate-500"   },
};

const GLASS = "bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 hover:border-slate-500/50 transition-all duration-300";

function LiveBadge({ elapsed, label }: { elapsed: number | null, label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-400 ring-1 ring-red-500/25">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      {label}{elapsed != null ? ` · ${elapsed}'` : ""}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = translations[language].dashboard;

  const { matches: allMatches, isRefreshing } = useLiveMatches("/matches/all", { liveMs: 30_000, idleMs: 60_000 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [survivors, setSurvivors] = useState<SurvivorEntry[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [dailyFeed, setDailyFeed] = useState<DailyFeedMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPaidClassic, setHasPaidClassic] = useState(false);
  const [hasPaidSurvival, setHasPaidSurvival] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const planType = hasPaidClassic && hasPaidSurvival ? "vip" : hasPaidClassic ? "classic" : "basic";

  useEffect(() => {
    api.get("/users/me")
      .then(({ data: me }) => {
        setHasPaidClassic(me.has_paid_classic);
        setHasPaidSurvival(me.has_paid_survival);
        setIsAdmin(me.email === "santimagana@yahoo.com.mx");
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
      .catch((err) => {
        if (err?.response?.status === 401) {
          setIsGuest(true);
        } else {
          router.push("/login");
        }
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  // Feed Global de Picks: independiente del resto de llamadas para que un
  // fallo aquí no tumbe el resto del dashboard.
  useEffect(() => {
    api.get<DailyFeedMatch[]>("/predictions/daily_feed")
      .then(({ data }) => {
        if (Array.isArray(data)) {
          const partidosLimpios = data
            .filter(match => match && match.home_team && match.home_team.trim() !== "" && match.away_team && match.away_team.trim() !== "")
            .slice(0, 3);
          setDailyFeed(partidosLimpios);
        } else {
          setDailyFeed([]);
        }
      })
      .catch(() => setDailyFeed([]));
  }, []);

  // Refresca el leaderboard en vivo cada vez que useLiveMatches trae datos nuevos
  const isFirstMatchesLoad = useRef(true);
  useEffect(() => {
    if (isFirstMatchesLoad.current) {
      isFirstMatchesLoad.current = false;
      return;
    }
    if (isGuest) return;
    api.get<LeaderboardEntry[]>("/leaderboard/global")
      .then(({ data }) => setLeaderboard(data))
      .catch(() => {});
  }, [allMatches, isGuest]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        {t.loading}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OnboardingModal />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl text-white">{t.title}</h1>
            {planType === "vip" && (
              <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-300">VIP</span>
            )}
            {planType === "classic" && (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-cyan-400">Classic</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-400">
            {t.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {planType === "basic" && (
            <Link
              href="/dashboard/upgrade"
              className="rounded-xl border border-amber-400/30 bg-amber-400/8 px-3 py-1.5 text-xs font-bold text-amber-400 transition-all hover:bg-amber-400/15"
            >
              {t.upgradeVip}
            </Link>
          )}
          {isRefreshing && (
            <span className="text-[10px] font-medium text-red-400 animate-pulse">● {t.live}</span>
          )}
          <Link
            href="/dashboard/predict"
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-blue-500 hover:shadow-emerald-500/40"
          >
            {t.predictBtn}
          </Link>
        </div>
      </div>

      <MatchCenterWidget />

      <DailyFeedSection feed={dailyFeed} t={t.dailyFeed} liveLabel={t.live} />

      <Tabs defaultValue="clasico">
        <TabsList className="border border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <TabsTrigger value="clasico" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <span className="flex items-center gap-1.5">
              {t.tabs.classic}
              {hasPaidClassic ? (
                <InfoTooltip
                  text={t.tooltips.classic}
                  position="bottom"
                />
              ) : (
                <span className="text-base">🔒</span>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="supervivencia" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            <span className="flex items-center gap-1.5">
              {t.tabs.survival}
              {hasPaidSurvival ? (
                <InfoTooltip
                  text={t.tooltips.survival}
                  position="bottom"
                />
              ) : (
                <span className="text-base">🔒</span>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pronósticos" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400">
            {t.tabs.predictions}
          </TabsTrigger>
        </TabsList>

        {/* ── CLÁSICO ── */}
        <TabsContent value="clasico" className="mt-4">
          {isGuest ? (
            <GuestRankingTeaser t={t.paywall} />
          ) : (
          <div className={cn("overflow-hidden rounded-2xl shadow-2xl", GLASS)}>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="w-14 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableClassic.pos}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableClassic.user}</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableClassic.total}</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableClassic.exact}</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableClassic.diff}</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableClassic.tendency}</TableHead>
                  {isAdmin && <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Online</TableHead>}
                  {isAdmin && <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Última vez</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow
                    key={entry.user.id}
                    className={cn(
                      "border-slate-700/30 border-l-2 transition-colors duration-300 hover:bg-white/5",
                      entry.rank === 1 && "bg-yellow-400/5",
                      entry.rank_change != null && entry.rank_change > 0 && "bg-emerald-500/10 border-l-emerald-500",
                      entry.rank_change != null && entry.rank_change < 0 && "bg-rose-500/10 border-l-rose-500",
                      (entry.rank_change == null || entry.rank_change === 0) && "border-l-transparent"
                    )}
                  >
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {entry.rank <= 3
                          ? <span className="text-lg">{MEDALS[entry.rank - 1]}</span>
                          : <span className="text-sm font-medium text-slate-500">{entry.rank}</span>}
                        {entry.rank_change != null && entry.rank_change > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-400">
                            <ArrowUp className="h-3 w-3" />
                            <span className="text-xs">{entry.rank_change}</span>
                          </span>
                        )}
                        {entry.rank_change != null && entry.rank_change < 0 && (
                          <span className="flex items-center gap-0.5 text-red-500">
                            <ArrowDown className="h-3 w-3" />
                            <span className="text-xs">{Math.abs(entry.rank_change)}</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-200">{displayName(entry.user)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-base font-extrabold tabular-nums text-white">{entry.total_points}</span>
                      <span className="ml-0.5 text-xs text-slate-500">{t.tableClassic.pts?.toLowerCase() ?? 'pts'}</span>
                      {entry.live_points_earned != null && entry.live_points_earned > 0 && (
                        <span className="ml-2 text-xs font-medium text-emerald-400">(+{entry.live_points_earned} live)</span>
                      )}
                    </TableCell>
                    {/* Conteo de aciertos reales (Directo del backend) */}
                    <TableCell className="text-right tabular-nums text-slate-400">
                      {entry.exact_matches ?? entry.exact_matches_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-400">
                      {entry.diff_matches ?? entry.diff_matches_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-400">
                      {entry.tendency_matches ?? entry.tendency_matches_count ?? 0}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center">
                        {entry.user.is_online
                          ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" title="En línea" />
                          : <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600" title="Desconectado" />}
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell className="text-right text-xs text-slate-400">
                        {entry.user.last_active
                          ? new Date(entry.user.last_active + "Z").toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {leaderboard.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 6} className="py-12 text-center text-sm text-slate-500">{t.tableClassic.empty}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </TabsContent>

        {/* ── SUPERVIVENCIA ── */}
        <TabsContent value="supervivencia" className="mt-4">
          {isGuest ? (
            <GuestRankingTeaser t={t.paywall} />
          ) : !hasPaidSurvival ? (
            <DashboardSurvivalPaywall t={t.paywall} />
          ) : (
          <div className={cn("overflow-hidden rounded-2xl shadow-2xl", GLASS)}>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableSurvival.user}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableSurvival.status}</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.tableSurvival.lastTeam}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {survivors.map((entry) => (
                  <TableRow key={entry.user.id} className="border-slate-700/30 transition-colors hover:bg-white/5">
                    <TableCell className="font-medium text-slate-200">{displayName(entry.user)}</TableCell>
                    <TableCell>
                      {entry.is_alive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> {t.tableSurvival.alive}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> {t.tableSurvival.eliminated}
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
                    <TableCell colSpan={3} className="py-12 text-center text-sm text-slate-500">{t.tableSurvival.empty}</TableCell>
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
              {t.predictions.empty}{" "}
              <Link href="/dashboard/predict" className="text-emerald-400 hover:underline">{t.predictions.predictNow}</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {predictions.map((pred) => {
                const match = allMatches.find((m) => m.id === pred.match_id);
                const live = match ? isLive(match.status) : false;
                const outcome = getOutcome(pred, match?.status);
                const { icon, color } = OUTCOME_STYLES[outcome];
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
                          {match ? `${match.home_team} vs ${match.away_team}` : `${t.predictions.match}${pred.match_id}`}
                        </p>
                        {live && match && <LiveBadge elapsed={match.elapsed ?? null} label={t.live} />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="text-sm font-semibold text-white">
                          {t.predictions.yourPrediction} <span className="tabular-nums">{pred.predicted_home} — {pred.predicted_away}</span>
                        </span>
                        {(isFT || live) && match && (
                          <span className="text-sm text-slate-400 tabular-nums">
                            {live ? t.predictions.inProgress : t.predictions.actual} {match.home_score} — {match.away_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xs font-semibold", color)}>{t.outcomes[outcome]}</p>
                      {isFT && (
                        <p className="text-lg font-extrabold tabular-nums text-white">
                          {pred.points_earned}<span className="ml-0.5 text-xs font-normal text-slate-500">{t.predictions.pts}</span>
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

function DailyFeedSection({ feed, t, liveLabel }: { feed: DailyFeedMatch[]; t: any; liveLabel: string }) {
  if (!Array.isArray(feed) || feed.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{t?.title ?? "Picks Globales"}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {feed.map((match) => {
          if (!match) return null;
          const live = isLive(match.status);
          const finished = match.status === "FT" || match.status === "AET" || match.status === "PEN";
          const picks = Array.isArray(match.picks) ? match.picks : [];
          return (
            <div key={match.id} className={cn("rounded-2xl p-4", GLASS)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white">
                  <img src={flagUrl(match.home_team)} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
                  <span className="truncate">{match.home_team}</span>
                  {live && match.home_score != null && match.away_score != null ? (
                    <span className="shrink-0 tabular-nums text-slate-300">{match.home_score} - {match.away_score}</span>
                  ) : (
                    <span className="shrink-0 text-slate-500">vs</span>
                  )}
                  <span className="truncate">{match.away_team}</span>
                  <img src={flagUrl(match.away_team)} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
                </div>
                {live ? (
                  <LiveBadge elapsed={null} label={liveLabel} />
                ) : (
                  <span className="shrink-0 rounded-full bg-slate-700/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {t?.scheduled ?? "PRÓXIMO"}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {picks.length === 0 ? (
                  <p className="text-xs text-slate-500">{t?.noPicks ?? "Sin pronósticos todavía."}</p>
                ) : (
                  picks.map((pick, idx) => {
                    // Si el partido está en vivo o terminado, mostramos los marcadores exactos
                    const showScore = (live || finished);
                    
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="truncate text-slate-300">{pick?.user_name ?? "—"}</span>
                        <span className="ml-2 shrink-0 font-semibold tabular-nums text-emerald-400">
                          {showScore
                            ? `${pick.pred_home ?? '?'} - ${pick.pred_away ?? '?'}`
                            : pick?.tendency === "H"
                            ? (t?.tendencyHome ?? "Local")
                            : pick?.tendency === "A"
                            ? (t?.tendencyAway ?? "Visitante")
                            : pick?.tendency === "D"
                            ? (t?.tendencyDraw ?? "Empate")
                            : "Oculto"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardSurvivalPaywall({ t }: { t: any }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/50">
      <div className="pointer-events-none select-none space-y-px blur-sm">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-700/30 bg-slate-900/60 px-4 py-3">
            <div className="h-4 w-32 rounded bg-slate-700/50" />
            <div className="h-5 w-20 rounded-full bg-emerald-500/20" />
            <div className="h-4 w-16 rounded bg-slate-700/30" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/75 px-8 text-center backdrop-blur-[2px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <span className="text-2xl">💀</span>
        </div>
        <div>
          <p className="font-bold text-white">{t.survivalTitle}</p>
          <p className="mt-1 text-sm text-slate-400">
            {t.survivalDesc}
          </p>
        </div>
        <Link
          href="/dashboard/upgrade"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-orange-400"
        >
          {t.survivalBtn}
        </Link>
      </div>
    </div>
  );
}

function GuestRankingTeaser({ t }: { t: any }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/50">
      <div className="pointer-events-none select-none space-y-px blur-sm">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-700/30 bg-slate-900/60 px-4 py-3">
            <div className="h-4 w-32 rounded bg-slate-700/50" />
            <div className="h-5 w-20 rounded-full bg-emerald-500/20" />
            <div className="h-4 w-16 rounded bg-slate-700/30" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/75 px-8 text-center backdrop-blur-[2px]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10">
          <span className="text-2xl">🏆</span>
        </div>
        <div>
          <p className="font-bold text-white">{t.guestTitle}</p>
          <p className="mt-1 text-sm text-slate-400">
            {t.guestDesc}
          </p>
        </div>
        <Link
          href="/register"
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-blue-500"
        >
          {t.guestBtn}
        </Link>
      </div>
    </div>
  );
}