import { cn } from "@/lib/utils";
import { flagUrl } from "@/lib/flags";

interface BracketMatch { home: string; away: string; homeScore?: number; awayScore?: number }

function Flag({ team }: { team: string }) {
  const url = flagUrl(team, 20);
  if (!url || team === "TBD") return <div className="h-3 w-5 flex-shrink-0 rounded-sm bg-slate-700/60" />;
  return <img src={url} alt={team} width={20} className="h-3 w-5 flex-shrink-0 rounded-sm object-cover" />;
}

function MatchBox({ match, size = "md" }: { match: BracketMatch; size?: "sm" | "md" }) {
  const decided = match.homeScore !== undefined;
  const homeWin = decided && match.homeScore! > match.awayScore!;
  const awayWin = decided && match.awayScore! > match.homeScore!;
  const w = size === "sm" ? "w-36" : "w-40";

  return (
    <div className={cn(
      w,
      "overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/70 backdrop-blur-xl shadow-lg",
      "transition-all duration-200 hover:border-slate-500/60 hover:shadow-slate-800"
    )}>
      {[
        { team: match.home, score: match.homeScore, win: homeWin },
        { team: match.away, score: match.awayScore, win: awayWin },
      ].map(({ team, score, win }, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center justify-between px-2.5 py-1.5",
            idx === 0 && "border-b border-slate-700/40",
            win && "bg-blue-500/15"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Flag team={team} />
            <span className={cn(
              "truncate text-xs leading-none",
              win ? "font-bold text-white" : team === "TBD" ? "text-slate-600" : "text-slate-300"
            )}>
              {team}
            </span>
          </div>
          {decided && (
            <span className={cn("ml-1 text-xs tabular-nums", win ? "font-extrabold text-white" : "text-slate-500")}>
              {score}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RoundLabel({ label }: { label: string }) {
  return (
    <p className="mb-3 text-center text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-500">
      {label}
    </p>
  );
}

const R16_L: BracketMatch[] = [
  { home:"1A Argentina",  away:"2B Suiza",      homeScore:2, awayScore:0 },
  { home:"1C Francia",    away:"2D Alemania",   homeScore:2, awayScore:1 },
  { home:"1E P.Bajos",   away:"2F Uruguay",    homeScore:3, awayScore:1 },
  { home:"1G Inglaterra", away:"2H Canadá",    homeScore:1, awayScore:0 },
];
const R16_R: BracketMatch[] = [
  { home:"1B Brasil",    away:"2A México",      homeScore:4, awayScore:1 },
  { home:"1D España",    away:"2C Marruecos",   homeScore:1, awayScore:0 },
  { home:"1F Portugal",  away:"2E Senegal",     homeScore:2, awayScore:0 },
  { home:"1H Bélgica",   away:"2G Colombia",   homeScore:2, awayScore:1 },
];
const QF_L: BracketMatch[] = [
  { home:"Argentina", away:"Francia",   homeScore:3, awayScore:2 },
  { home:"P.Bajos",  away:"Inglaterra" },
];
const QF_R: BracketMatch[] = [
  { home:"Brasil",   away:"España" },
  { home:"Portugal", away:"Bélgica" },
];
const SF_L: BracketMatch[] = [{ home:"Argentina", away:"TBD" }];
const SF_R: BracketMatch[] = [{ home:"TBD",       away:"TBD" }];
const FINAL: BracketMatch   =  { home:"TBD",       away:"TBD" };

export default function BracketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-white">Bracket Eliminatoria</h1>
        <p className="mt-0.5 text-sm text-slate-400">Mundial 2026 · Fase Final</p>
      </div>

      <div className="overflow-x-auto pb-6">
        <div className="inline-flex min-w-max items-start gap-2 pt-2">

          {/* R16 Izq */}
          <div className="flex flex-col gap-3">
            <RoundLabel label="Octavos" />
            {R16_L.map((m, i) => <MatchBox key={i} match={m} size="sm" />)}
          </div>

          {/* Connector */}
          <div className="mt-7 flex h-[calc(4*52px+3*12px)] flex-col justify-around">
            {[0,1].map(i=>(
              <div key={i} className="flex items-center">
                <div className={cn("w-3 border-slate-700/60 border-r",
                  i===0 ? "h-[calc(52px+6px)] border-b rounded-br" : "h-[calc(52px+6px)] border-t rounded-tr"
                )}/>
                <div className="h-px w-3 bg-slate-700/60"/>
              </div>
            ))}
          </div>

          {/* QF Izq */}
          <div className="mt-0 flex flex-col gap-[calc(52px+12px+52px-8px)] pt-7">
            <div>
              <RoundLabel label="Cuartos" />
              {QF_L.map((m, i) => <MatchBox key={i} match={m} size="sm" />)}
            </div>
          </div>

          {/* Connector */}
          <div className="mt-14 flex h-[calc(2*52px+1*12px)] flex-col justify-around">
            {[0,1].map(i=>(
              <div key={i} className="flex items-center">
                <div className={cn("w-3 border-slate-700/60 border-r",
                  i===0 ? "h-[calc(52px+6px)] border-b rounded-br" : "h-[calc(52px+6px)] border-t rounded-tr"
                )}/>
                <div className="h-px w-3 bg-slate-700/60"/>
              </div>
            ))}
          </div>

          {/* SF Izq */}
          <div className="mt-14 flex flex-col pt-7">
            <RoundLabel label="Semis" />
            {SF_L.map((m, i) => <MatchBox key={i} match={m} />)}
          </div>

          {/* Connector */}
          <div className="mt-28 h-px w-3 self-start bg-slate-700/60 translate-y-[26px]" />

          {/* FINAL + CHAMPION */}
          <div className="flex flex-col items-center gap-4 pt-7">
            <RoundLabel label="Final" />
            <MatchBox match={FINAL} />
            <div className="mt-2 w-full">
              <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.25em] text-yellow-400/80">
                Campeón
              </p>
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 px-6 py-4 shadow-lg shadow-yellow-400/5 backdrop-blur-xl">
                <span className="text-2xl">🏆</span>
                <span className="text-sm font-extrabold tracking-tight text-yellow-300">Por definir</span>
              </div>
            </div>
          </div>

          {/* Connector */}
          <div className="mt-28 h-px w-3 self-start bg-slate-700/60 translate-y-[26px]" />

          {/* SF Der */}
          <div className="mt-14 flex flex-col pt-7">
            <RoundLabel label="Semis" />
            {SF_R.map((m, i) => <MatchBox key={i} match={m} />)}
          </div>

          {/* Connector */}
          <div className="mt-14 flex h-[calc(2*52px+1*12px)] flex-col justify-around">
            {[0,1].map(i=>(
              <div key={i} className="flex items-center">
                <div className="h-px w-3 bg-slate-700/60"/>
                <div className={cn("w-3 border-slate-700/60 border-l",
                  i===0 ? "h-[calc(52px+6px)] border-b rounded-bl" : "h-[calc(52px+6px)] border-t rounded-tl"
                )}/>
              </div>
            ))}
          </div>

          {/* QF Der */}
          <div className="mt-0 flex flex-col gap-[calc(52px+12px+52px-8px)] pt-7">
            <div>
              <RoundLabel label="Cuartos" />
              {QF_R.map((m, i) => <MatchBox key={i} match={m} size="sm" />)}
            </div>
          </div>

          {/* Connector */}
          <div className="mt-7 flex h-[calc(4*52px+3*12px)] flex-col justify-around">
            {[0,1].map(i=>(
              <div key={i} className="flex items-center">
                <div className="h-px w-3 bg-slate-700/60"/>
                <div className={cn("w-3 border-slate-700/60 border-l",
                  i===0 ? "h-[calc(52px+6px)] border-b rounded-bl" : "h-[calc(52px+6px)] border-t rounded-tl"
                )}/>
              </div>
            ))}
          </div>

          {/* R16 Der */}
          <div className="flex flex-col gap-3">
            <RoundLabel label="Octavos" />
            {R16_R.map((m, i) => <MatchBox key={i} match={m} size="sm" />)}
          </div>

        </div>
      </div>

      <div className="flex flex-wrap gap-5 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-5 py-3.5 backdrop-blur-xl">
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-3 w-3 rounded-sm border border-blue-500/40 bg-blue-500/20" /> Ganador del partido
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-px w-5 bg-slate-700/60" /> Conector de ronda
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <span>🏆</span> Campeón del Mundial
        </span>
      </div>
    </div>
  );
}
