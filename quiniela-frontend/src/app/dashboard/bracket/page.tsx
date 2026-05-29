import { cn } from "@/lib/utils";

interface BracketMatch {
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
}

function MatchBox({ match, className }: { match: BracketMatch; className?: string }) {
  const decided = match.homeScore !== undefined;
  const homeWin = decided && match.homeScore! > match.awayScore!;
  const awayWin = decided && match.awayScore! > match.homeScore!;

  return (
    <div
      className={cn(
        "w-36 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 text-xs shadow-lg",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-2.5 py-1.5 border-b border-slate-700",
          homeWin && "bg-blue-600/20"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-3 w-3 flex-shrink-0 rounded-full bg-slate-600" />
          <span className={cn("truncate", homeWin ? "font-bold text-white" : "text-slate-300")}>
            {match.home}
          </span>
        </div>
        {decided && (
          <span className={cn("ml-1 tabular-nums font-bold", homeWin ? "text-white" : "text-slate-500")}>
            {match.homeScore}
          </span>
        )}
      </div>
      <div
        className={cn(
          "flex items-center justify-between px-2.5 py-1.5",
          awayWin && "bg-blue-600/20"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-3 w-3 flex-shrink-0 rounded-full bg-slate-600" />
          <span className={cn("truncate", awayWin ? "font-bold text-white" : "text-slate-300")}>
            {match.away}
          </span>
        </div>
        {decided && (
          <span className={cn("ml-1 tabular-nums font-bold", awayWin ? "text-white" : "text-slate-500")}>
            {match.awayScore}
          </span>
        )}
      </div>
    </div>
  );
}

function RoundLabel({ label }: { label: string }) {
  return (
    <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
      {label}
    </p>
  );
}

// ── Static bracket data (skeleton) ──────────────────────────────────────────

const R16_L: BracketMatch[] = [
  { home: "1A Argentina",  away: "2B Suiza",        homeScore: 2, awayScore: 0 },
  { home: "1C Francia",    away: "2D Alemania",      homeScore: 2, awayScore: 1 },
  { home: "1E P. Bajos",  away: "2F Uruguay",        homeScore: 3, awayScore: 1 },
  { home: "1G Inglaterra", away: "2H Canadá",        homeScore: 1, awayScore: 0 },
];

const R16_R: BracketMatch[] = [
  { home: "1B Brasil",     away: "2A México",         homeScore: 4, awayScore: 1 },
  { home: "1D España",     away: "2C Marruecos",      homeScore: 1, awayScore: 0 },
  { home: "1F Portugal",   away: "2E Senegal",        homeScore: 2, awayScore: 0 },
  { home: "1H Bélgica",    away: "2G Colombia",       homeScore: 2, awayScore: 1 },
];

const QF_L: BracketMatch[] = [
  { home: "Argentina",    away: "Francia",    homeScore: 3, awayScore: 2 },
  { home: "P. Bajos",    away: "Inglaterra" },
];

const QF_R: BracketMatch[] = [
  { home: "Brasil",      away: "España" },
  { home: "Portugal",    away: "Bélgica" },
];

const SF_L: BracketMatch[] = [
  { home: "Argentina",   away: "TBD" },
];

const SF_R: BracketMatch[] = [
  { home: "TBD",         away: "TBD" },
];

const FINAL: BracketMatch = { home: "TBD", away: "TBD" };

// ── Connector line helper ────────────────────────────────────────────────────

function Connector({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <div className={cn(
      "flex flex-col justify-around self-stretch",
      direction === "right" ? "items-start" : "items-end"
    )}>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center">
          {direction === "left" && (
            <div className="h-px w-3 bg-slate-700" />
          )}
          <div
            className={cn(
              "h-[calc(50%-2px)] w-3 border-slate-700",
              i === 0
                ? direction === "right"
                  ? "border-b border-r rounded-br-sm"
                  : "border-b border-l rounded-bl-sm"
                : direction === "right"
                ? "border-t border-r rounded-tr-sm"
                : "border-t border-l rounded-tl-sm"
            )}
          />
          {direction === "right" && (
            <div className="h-px w-3 bg-slate-700" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function BracketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bracket Eliminatoria
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Mundial 2026 · Fase Final
        </p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="inline-flex min-w-max items-center gap-0">

          {/* ── IZQUIERDA ── */}
          {/* R16 Izq */}
          <div className="flex flex-col gap-4">
            <RoundLabel label="Octavos" />
            {R16_L.map((m, i) => <MatchBox key={i} match={m} />)}
          </div>

          <Connector direction="right" />

          {/* QF Izq */}
          <div className="flex flex-col gap-24 pt-8">
            <div>
              <RoundLabel label="Cuartos" />
              {QF_L.map((m, i) => <MatchBox key={i} match={m} className="mb-24 last:mb-0" />)}
            </div>
          </div>

          <Connector direction="right" />

          {/* SF Izq */}
          <div className="flex flex-col justify-center gap-0 pt-0">
            <RoundLabel label="Semis" />
            <div className="mt-16">
              {SF_L.map((m, i) => <MatchBox key={i} match={m} />)}
            </div>
          </div>

          {/* ── CENTRO ── */}
          <div className="mx-6 flex flex-col items-center gap-3">
            <RoundLabel label="Final" />
            <MatchBox match={FINAL} />
            <div className="mt-4 w-full">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-400">
                Campeón
              </p>
              <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-yellow-400/50 bg-yellow-400/5 px-5 py-4">
                <span className="text-xl">🏆</span>
                <span className="text-sm font-bold text-yellow-300">
                  Por definir
                </span>
              </div>
            </div>
          </div>

          {/* SF Der */}
          <div className="flex flex-col justify-center pt-0">
            <RoundLabel label="Semis" />
            <div className="mt-16">
              {SF_R.map((m, i) => <MatchBox key={i} match={m} />)}
            </div>
          </div>

          <Connector direction="left" />

          {/* QF Der */}
          <div className="flex flex-col gap-24 pt-8">
            <div>
              <RoundLabel label="Cuartos" />
              {QF_R.map((m, i) => <MatchBox key={i} match={m} className="mb-24 last:mb-0" />)}
            </div>
          </div>

          <Connector direction="left" />

          {/* R16 Der */}
          <div className="flex flex-col gap-4">
            <RoundLabel label="Octavos" />
            {R16_R.map((m, i) => <MatchBox key={i} match={m} />)}
          </div>

        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="h-3 w-3 rounded-sm border border-blue-600/40 bg-blue-600/20" />
          Equipo ganador del partido
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px w-6 bg-slate-700" />
          Conector de ronda
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-base">🏆</span>
          Campeón del Mundial
        </div>
      </div>
    </div>
  );
}
