import { cn } from "@/lib/utils";

interface Team {
  name: string;
  j: number; // jugados
  g: number; // ganados
  e: number; // empates
  p: number; // perdidos
  gf: number;
  ga: number;
}

interface Group {
  id: string;
  teams: Team[];
}

function pts(t: Team) { return t.g * 3 + t.e; }
function dg(t: Team) { return t.gf - t.ga; }
function sorted(teams: Team[]) {
  return [...teams].sort((a, b) => pts(b) - pts(a) || dg(b) - dg(a) || b.gf - a.gf);
}

const GROUPS: Group[] = [
  { id: "A", teams: [
    { name: "Argentina",     j:3, g:2, e:1, p:0, gf:6, ga:2 },
    { name: "México",        j:3, g:1, e:1, p:1, gf:3, ga:4 },
    { name: "Polonia",       j:3, g:1, e:0, p:2, gf:3, ga:5 },
    { name: "Arabia Saudita",j:3, g:0, e:2, p:1, gf:2, ga:3 },
  ]},
  { id: "B", teams: [
    { name: "Brasil",        j:3, g:3, e:0, p:0, gf:7, ga:1 },
    { name: "Suiza",         j:3, g:1, e:1, p:1, gf:4, ga:4 },
    { name: "Serbia",        j:3, g:1, e:0, p:2, gf:3, ga:5 },
    { name: "Ghana",         j:3, g:0, e:1, p:2, gf:2, ga:6 },
  ]},
  { id: "C", teams: [
    { name: "Francia",       j:3, g:2, e:0, p:1, gf:5, ga:3 },
    { name: "Marruecos",     j:3, g:1, e:2, p:0, gf:3, ga:2 },
    { name: "Australia",     j:3, g:1, e:0, p:2, gf:2, ga:4 },
    { name: "Túnez",         j:3, g:0, e:2, p:1, gf:1, ga:2 },
  ]},
  { id: "D", teams: [
    { name: "España",        j:3, g:2, e:1, p:0, gf:7, ga:2 },
    { name: "Alemania",      j:3, g:2, e:0, p:1, gf:6, ga:4 },
    { name: "Japón",         j:3, g:1, e:0, p:2, gf:3, ga:5 },
    { name: "Costa Rica",    j:3, g:0, e:1, p:2, gf:1, ga:6 },
  ]},
  { id: "E", teams: [
    { name: "Países Bajos",  j:3, g:2, e:1, p:0, gf:5, ga:1 },
    { name: "Senegal",       j:3, g:1, e:1, p:1, gf:3, ga:3 },
    { name: "EE.UU",         j:3, g:1, e:1, p:1, gf:2, ga:3 },
    { name: "Irán",          j:3, g:0, e:1, p:2, gf:1, ga:4 },
  ]},
  { id: "F", teams: [
    { name: "Portugal",      j:3, g:3, e:0, p:0, gf:9, ga:2 },
    { name: "Uruguay",       j:3, g:1, e:1, p:1, gf:3, ga:3 },
    { name: "Corea del Sur", j:3, g:1, e:0, p:2, gf:2, ga:4 },
    { name: "Ecuador",       j:3, g:0, e:1, p:2, gf:1, ga:6 },
  ]},
  { id: "G", teams: [
    { name: "Inglaterra",    j:3, g:2, e:0, p:1, gf:6, ga:3 },
    { name: "Colombia",      j:3, g:2, e:0, p:1, gf:4, ga:2 },
    { name: "Gales",         j:3, g:1, e:1, p:1, gf:2, ga:3 },
    { name: "Croacia",       j:3, g:0, e:1, p:2, gf:1, ga:5 },
  ]},
  { id: "H", teams: [
    { name: "Bélgica",       j:3, g:2, e:1, p:0, gf:5, ga:2 },
    { name: "Canadá",        j:3, g:1, e:2, p:0, gf:3, ga:2 },
    { name: "Marruecos",     j:3, g:1, e:0, p:2, gf:2, ga:4 },
    { name: "Camerún",       j:3, g:0, e:1, p:2, gf:1, ga:3 },
  ]},
  { id: "I", teams: [
    { name: "Italia",        j:3, g:2, e:0, p:1, gf:5, ga:3 },
    { name: "Chile",         j:3, g:1, e:2, p:0, gf:4, ga:3 },
    { name: "Nigeria",       j:3, g:1, e:0, p:2, gf:3, ga:5 },
    { name: "Albania",       j:3, g:0, e:2, p:1, gf:2, ga:3 },
  ]},
  { id: "J", teams: [
    { name: "Suecia",        j:3, g:2, e:1, p:0, gf:6, ga:2 },
    { name: "Turquía",       j:3, g:1, e:1, p:1, gf:4, ga:4 },
    { name: "Venezuela",     j:3, g:1, e:0, p:2, gf:2, ga:4 },
    { name: "Bolivia",       j:3, g:0, e:2, p:1, gf:1, ga:3 },
  ]},
  { id: "K", teams: [
    { name: "Dinamarca",     j:3, g:2, e:0, p:1, gf:5, ga:3 },
    { name: "Argelia",       j:3, g:1, e:2, p:0, gf:3, ga:2 },
    { name: "Jamaica",       j:3, g:1, e:0, p:2, gf:2, ga:4 },
    { name: "Paraguay",      j:3, g:0, e:2, p:1, gf:1, ga:2 },
  ]},
  { id: "L", teams: [
    { name: "Austria",       j:3, g:3, e:0, p:0, gf:7, ga:1 },
    { name: "Costa de Marfil",j:3,g:1, e:1, p:1, gf:3, ga:3 },
    { name: "Qatar",         j:3, g:1, e:0, p:2, gf:2, ga:5 },
    { name: "Panamá",        j:3, g:0, e:1, p:2, gf:1, ga:4 },
  ]},
];

function GroupCard({ group }: { group: Group }) {
  const ranked = sorted(group.teams);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-800/60 px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Grupo
        </span>{" "}
        <span className="text-sm font-bold text-white">{group.id}</span>
      </div>

      {/* Table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="w-7 px-2 py-1.5 text-left font-semibold text-slate-500">
              Pos
            </th>
            <th className="px-2 py-1.5 text-left font-semibold text-slate-500">
              Equipo
            </th>
            <th className="px-2 py-1.5 text-center font-semibold text-slate-500">
              DG
            </th>
            <th className="px-2 py-1.5 text-center font-bold text-slate-400">
              PTS
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((team, i) => (
            <tr
              key={team.name}
              className={cn(
                "border-b border-slate-800/50 last:border-0 transition-colors hover:bg-slate-800/40",
                "border-l-2",
                i < 2
                  ? "border-l-blue-500"
                  : i === 2
                  ? "border-l-yellow-500"
                  : "border-l-transparent"
              )}
            >
              <td className="px-2 py-2 text-slate-500">{i + 1}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  {/* Flag placeholder */}
                  <div className="h-4 w-4 flex-shrink-0 rounded-full bg-slate-700" />
                  <span className="font-medium text-slate-200 leading-tight">
                    {team.name}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 text-center tabular-nums text-slate-400">
                {dg(team) > 0 ? `+${dg(team)}` : dg(team)}
              </td>
              <td className="px-2 py-2 text-center font-bold tabular-nums text-white">
                {pts(team)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex gap-3 border-t border-slate-800 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-2 w-2 rounded-sm bg-blue-500" /> Clasificados
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-2 w-2 rounded-sm bg-yellow-500" /> Repechaje
        </span>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Fase de Grupos
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Mundial 2026 · 12 grupos · 48 equipos
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GROUPS.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}
