"use client";

import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";
import { useLiveMatches, isLive, type Match } from "@/lib/useLiveMatches";

// ─── Utilidades de fecha ──────────────────────────────────────────────────────

const TZ = typeof Intl !== "undefined"
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";

function toLocal(dt: string): Date {
  return new Date(dt + "Z");
}

function isToday(dt: string): boolean {
  const d = toLocal(dt);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate()
  );
}

function fmtTime(dt: string): string {
  return toLocal(dt).toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

function fmtDate(dt: string): string {
  return toLocal(dt).toLocaleDateString("es-MX", {
    weekday: "short", day: "numeric", month: "short", timeZone: TZ,
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TeamFlag({ team, size = 40 }: { team: string; size?: 20 | 40 }) {
  const url = flagUrl(team, size);
  const cls = size === 40 ? "h-6 w-9" : "h-[14px] w-[21px]";
  if (!url) return <div className={cn(cls, "rounded bg-slate-700")} />;
  return <img src={url} alt={team} className={cn(cls, "rounded object-cover shadow")} />;
}

function LiveBadge({ elapsed }: { elapsed: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-500/25">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      EN VIVO{elapsed != null ? ` · ${elapsed}'` : ""}
    </span>
  );
}

// ── Tarjeta EN VIVO ────────────────────────────────────────────────────────────
function LiveCard({ match }: { match: Match }) {
  return (
    <div className={cn(
      "relative flex min-w-[200px] flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-xl",
      "bg-slate-900/80 border border-red-500/30 backdrop-blur-xl",
      "ring-1 ring-red-500/20 shadow-red-900/30"
    )}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-600/20 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <LiveBadge elapsed={match.elapsed} />
        {match.group_name && (
          <span className="text-[9px] font-bold text-slate-600">GRP {match.group_name}</span>
        )}
      </div>

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.home_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">{match.home_team}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-2xl font-extrabold tabular-nums text-white">
            {match.home_score ?? 0} — {match.away_score ?? 0}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-slate-600">marcador</p>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.away_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">{match.away_team}</p>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta HOY (próximo o finalizado hoy) ─────────────────────────────────────
function TodayCard({ match }: { match: Match }) {
  const isFT = match.status === "FT";
  return (
    <div className={cn(
      "relative flex min-w-[200px] flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-lg",
      "bg-slate-900/60 border border-slate-700/50 backdrop-blur-xl transition-all duration-200",
      "hover:border-slate-500/50 hover:shadow-xl",
      isFT && "opacity-50"
    )}>
      <div className="flex items-center justify-between">
        {isFT ? (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            FINALIZADO
          </span>
        ) : (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400 ring-1 ring-blue-500/20">
            HOY · {fmtTime(match.kickoff_time)}
          </span>
        )}
        {match.group_name && (
          <span className="text-[9px] font-bold text-slate-600">GRP {match.group_name}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <TeamFlag team={match.home_team} />
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">{match.home_team}</p>
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
          <p className="text-center text-[10px] font-bold leading-tight text-slate-200">{match.away_team}</p>
        </div>
      </div>
    </div>
  );
}

// ── Fila MI RADAR (partidos próximos) ─────────────────────────────────────────
function RadarRow({ match }: { match: Match }) {
  const kickoff = toLocal(match.kickoff_time);
  const isPast  = kickoff < new Date();

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5",
      "transition-all hover:border-slate-600/50 hover:bg-slate-900/70",
      isPast && "opacity-40"
    )}>
      {/* Fecha + hora */}
      <div className="w-20 shrink-0 text-right">
        <p className="text-[10px] font-semibold capitalize text-slate-300">{fmtDate(match.kickoff_time)}</p>
        <p className="text-[11px] font-extrabold tabular-nums text-blue-400">{fmtTime(match.kickoff_time)}</p>
      </div>

      {/* Separador */}
      <div className="h-8 w-px shrink-0 bg-slate-700/60" />

      {/* Equipos */}
      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamFlag team={match.home_team} size={20} />
          <span className="truncate text-xs font-semibold text-slate-200">{match.home_team}</span>
        </div>
        <span className="shrink-0 text-[10px] text-slate-600">vs</span>
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className="truncate text-xs font-semibold text-slate-200 text-right">{match.away_team}</span>
          <TeamFlag team={match.away_team} size={20} />
        </div>
      </div>

      {/* Venue + grupo */}
      <div className="shrink-0 text-right hidden sm:block">
        {match.venue && (
          <p className="max-w-[110px] truncate text-[9px] text-slate-500" title={match.venue}>
            {match.venue}
          </p>
        )}
        {match.group_name && (
          <p className="text-[9px] font-bold text-slate-600">Grupo {match.group_name}</p>
        )}
      </div>
    </div>
  );
}

// ── Fila HISTORIAL (partido reciente / en vivo) ───────────────────────────────
function HistorialRow({ match }: { match: Match }) {
  const live = isLive(match.status);
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all",
      live
        ? "border-red-500/30 bg-red-500/5"
        : "border-slate-700/40 bg-slate-900/50"
    )}>
      {/* Estado */}
      <div className="w-16 shrink-0">
        {live ? (
          <LiveBadge elapsed={match.elapsed} />
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {match.status === "FT" ? "FIN" : match.status}
          </span>
        )}
      </div>

      {/* Equipos + marcador */}
      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamFlag team={match.home_team} size={20} />
          <span className="truncate text-xs font-semibold text-slate-200">{match.home_team}</span>
        </div>
        <span className="shrink-0 text-sm font-extrabold tabular-nums text-white">
          {match.home_score ?? 0} — {match.away_score ?? 0}
        </span>
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className="truncate text-xs font-semibold text-slate-200 text-right">{match.away_team}</span>
          <TeamFlag team={match.away_team} size={20} />
        </div>
      </div>

      {/* Hora */}
      <span className="shrink-0 text-[9px] text-slate-600">{fmtTime(match.kickoff_time)}</span>
    </div>
  );
}

// ─── Widget principal ─────────────────────────────────────────────────────────

export function MatchCenterWidget() {
  const { matches, isRefreshing } = useLiveMatches("/matches/all", {
    liveMs: 30_000,
    idleMs: 60_000,
  });

  const now = new Date();
  // Ventana de "historial": últimas 48 h
  const cutoffHistory = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  // Ventana "Mi Radar": próximos 5 días excluyendo hoy
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const radarLimit = new Date(todayEnd.getTime() + 5 * 24 * 60 * 60 * 1000);

  const liveMatches     = matches.filter((m) => isLive(m.status));
  const todayMatches    = matches.filter((m) => !isLive(m.status) && isToday(m.kickoff_time));
  const radarMatches    = matches
    .filter((m) => m.status === "NS" && toLocal(m.kickoff_time) > todayEnd && toLocal(m.kickoff_time) <= radarLimit)
    .slice(0, 6);
  const historialMatches = matches
    .filter((m) => {
      const t = toLocal(m.kickoff_time);
      return (m.status === "FT" && t >= cutoffHistory) || isLive(m.status);
    })
    .sort((a, b) => toLocal(b.kickoff_time).getTime() - toLocal(a.kickoff_time).getTime())
    .slice(0, 6);

  const hasContent = liveMatches.length > 0 || todayMatches.length > 0 ||
                     radarMatches.length > 0 || historialMatches.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-5">

      {/* ── EN VIVO / HOY ──────────────────────────────────────────────────── */}
      {(liveMatches.length > 0 || todayMatches.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {liveMatches.length > 0 ? "En vivo · Hoy" : "Partidos de hoy"}
            </p>
            {liveMatches.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                {liveMatches.length} EN VIVO
              </span>
            )}
            <div className="h-px flex-1 bg-slate-800" />
            {isRefreshing && (
              <span className="animate-pulse text-[9px] text-slate-700">actualizando…</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {liveMatches.map((m) => <LiveCard key={m.id} match={m} />)}
            {todayMatches.map((m) => <TodayCard key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {/* ── MI RADAR (próximos partidos con venue) ─────────────────────────── */}
      {radarMatches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Mi Radar · Próximos
            </p>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="space-y-1.5">
            {radarMatches.map((m) => <RadarRow key={m.id} match={m} />)}
          </div>
        </div>
      )}

      {/* ── HISTORIAL (recientes + en vivo) ────────────────────────────────── */}
      {historialMatches.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Historial reciente
            </p>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="space-y-1.5">
            {historialMatches.map((m) => <HistorialRow key={m.id} match={m} />)}
          </div>
        </div>
      )}

    </div>
  );
}
