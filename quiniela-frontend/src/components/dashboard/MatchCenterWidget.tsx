"use client";

import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { useLiveMatches, isLive, type Match } from "@/lib/useLiveMatches";

function TeamFlag({ team }: { team: string }) {
  const url = flagUrl(team, 40);
  if (!url) return <div className="h-6 w-9 rounded bg-slate-700" />;
  return <img src={url} alt={team} className="h-6 w-9 rounded object-cover shadow" />;
}

function formatTime(dt: string) {
  return new Date(dt + "Z").toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

function LiveCard({ match }: { match: Match }) {
  return (
    <div className={cn(
      "relative flex min-w-[210px] flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-xl",
      "bg-slate-900/80 border border-red-500/30 backdrop-blur-xl",
      "ring-1 ring-red-500/20 shadow-red-900/30"
    )}>
      {/* Red ambient glow */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-600/20 blur-2xl" />

      {/* Live badge */}
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-500/25">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          EN VIVO{match.elapsed != null ? ` · ${match.elapsed}'` : ""}
        </span>
        <span className="text-[9px] font-medium text-slate-600">2H</span>
      </div>

      {/* Teams + score */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.home_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">
            {match.home_team}
          </p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <p className="text-2xl font-extrabold tabular-nums text-white">
            {match.home_score ?? 0} — {match.away_score ?? 0}
          </p>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest">marcador</p>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.away_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">
            {match.away_team}
          </p>
        </div>
      </div>
    </div>
  );
}

function UpcomingCard({ match }: { match: Match }) {
  const isFT = match.status === "FT";
  return (
    <div className={cn(
      "relative flex min-w-[210px] flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-lg",
      "bg-slate-900/60 border border-slate-700/50 backdrop-blur-xl",
      "transition-all duration-200 hover:border-slate-500/50 hover:shadow-xl",
      isFT && "opacity-50"
    )}>
      {/* Status chip */}
      <div className="flex items-center justify-between">
        {isFT ? (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            FINALIZADO
          </span>
        ) : (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 ring-1 ring-blue-500/20">
            HOY · {formatTime(match.kickoff_time)}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.home_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">
            {match.home_team}
          </p>
        </div>

        <div className="flex flex-col items-center">
          {isFT ? (
            <p className="text-xl font-extrabold tabular-nums text-slate-400">
              {match.home_score} — {match.away_score}
            </p>
          ) : (
            <p className="text-lg font-light text-slate-600">vs</p>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.away_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">
            {match.away_team}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MatchCenterWidget() {
  const { matches, isRefreshing } = useLiveMatches("/matches/today");

  if (matches.length === 0) return null;

  const liveCount = matches.filter((m) => isLive(m.status)).length;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Partidos de hoy
        </p>
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            {liveCount} EN VIVO
          </span>
        )}
        <div className="h-px flex-1 bg-slate-800" />
        {isRefreshing && (
          <span className="text-[9px] text-slate-700 animate-pulse">actualizando...</span>
        )}
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {matches.map((m) =>
          isLive(m.status)
            ? <LiveCard key={m.id} match={m} />
            : <UpcomingCard key={m.id} match={m} />
        )}
      </div>
    </div>
  );
}
