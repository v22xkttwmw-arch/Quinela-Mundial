export type TeamName = string;

export type TournamentPhase =
  | "groups"
  | "roundOf32"
  | "roundOf16"
  | "quarterFinals"
  | "semiFinals"
  | "thirdPlace"
  | "final";

export type GroupMatch = {
  id: string;
  group: string;
  phase: "groups";
  homeTeam: TeamName;
  awayTeam: TeamName;
  homeScore: number | null;
  awayScore: number | null;
  kickoffTime?: string;
};

export type GroupStanding = {
  team: TeamName;
  group: string;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  rankInGroup?: number;
  rankingBucket?: number;
};

export type QualifiedTeam = {
  team: TeamName;
  group: string;
  position: 1 | 2 | 3;
  rankingBucket?: number;
};

export type KnockoutSlot = {
  id: string;
  label: string;
  phase: Exclude<TournamentPhase, "groups">;
  home: TeamName;
  away: TeamName;
  sourceHome?: string;
  sourceAway?: string;
  kickoffTime?: string;
};

export type MatchLockState = {
  canEdit: boolean;
  locksAt: string | null;
  reason: "open" | "locked_by_time" | "pending_matchup";
};

export type TournamentSnapshot = {
  standingsByGroup: Map<string, GroupStanding[]>;
  thirdPlaceTable: GroupStanding[];
  qualifiedTeams: QualifiedTeam[];
  roundOf32: KnockoutSlot[];
  roundOf16: KnockoutSlot[];
  quarterFinals: KnockoutSlot[];
  semiFinals: KnockoutSlot[];
  thirdPlace: KnockoutSlot;
  final: KnockoutSlot;
};

export const DEFAULT_GROUP_FIXTURES: GroupMatch[] = [
  { id: "A-1", group: "A", phase: "groups", homeTeam: "México", awayTeam: "Suiza", homeScore: null, awayScore: null },
  { id: "A-2", group: "A", phase: "groups", homeTeam: "Argentina", awayTeam: "Canadá", homeScore: null, awayScore: null },
  { id: "A-3", group: "A", phase: "groups", homeTeam: "México", awayTeam: "Argentina", homeScore: null, awayScore: null },
  { id: "A-4", group: "A", phase: "groups", homeTeam: "Canadá", awayTeam: "Suiza", homeScore: null, awayScore: null },
  { id: "A-5", group: "A", phase: "groups", homeTeam: "Suiza", awayTeam: "Argentina", homeScore: null, awayScore: null },
  { id: "A-6", group: "A", phase: "groups", homeTeam: "Canadá", awayTeam: "México", homeScore: null, awayScore: null },

  { id: "B-1", group: "B", phase: "groups", homeTeam: "Brasil", awayTeam: "Estados Unidos", homeScore: null, awayScore: null },
  { id: "B-2", group: "B", phase: "groups", homeTeam: "Portugal", awayTeam: "Colombia", homeScore: null, awayScore: null },
  { id: "B-3", group: "B", phase: "groups", homeTeam: "Brasil", awayTeam: "Portugal", homeScore: null, awayScore: null },
  { id: "B-4", group: "B", phase: "groups", homeTeam: "Colombia", awayTeam: "Estados Unidos", homeScore: null, awayScore: null },
  { id: "B-5", group: "B", phase: "groups", homeTeam: "Estados Unidos", awayTeam: "Portugal", homeScore: null, awayScore: null },
  { id: "B-6", group: "B", phase: "groups", homeTeam: "Colombia", awayTeam: "Brasil", homeScore: null, awayScore: null },

  { id: "C-1", group: "C", phase: "groups", homeTeam: "Francia", awayTeam: "Japón", homeScore: null, awayScore: null },
  { id: "C-2", group: "C", phase: "groups", homeTeam: "Alemania", awayTeam: "Marruecos", homeScore: null, awayScore: null },
  { id: "C-3", group: "C", phase: "groups", homeTeam: "Francia", awayTeam: "Alemania", homeScore: null, awayScore: null },
  { id: "C-4", group: "C", phase: "groups", homeTeam: "Marruecos", awayTeam: "Japón", homeScore: null, awayScore: null },
  { id: "C-5", group: "C", phase: "groups", homeTeam: "Japón", awayTeam: "Alemania", homeScore: null, awayScore: null },
  { id: "C-6", group: "C", phase: "groups", homeTeam: "Marruecos", awayTeam: "Francia", homeScore: null, awayScore: null },

  { id: "D-1", group: "D", phase: "groups", homeTeam: "España", awayTeam: "Corea del Sur", homeScore: null, awayScore: null },
  { id: "D-2", group: "D", phase: "groups", homeTeam: "Uruguay", awayTeam: "Croacia", homeScore: null, awayScore: null },
  { id: "D-3", group: "D", phase: "groups", homeTeam: "España", awayTeam: "Uruguay", homeScore: null, awayScore: null },
  { id: "D-4", group: "D", phase: "groups", homeTeam: "Croacia", awayTeam: "Corea del Sur", homeScore: null, awayScore: null },
  { id: "D-5", group: "D", phase: "groups", homeTeam: "Corea del Sur", awayTeam: "Uruguay", homeScore: null, awayScore: null },
  { id: "D-6", group: "D", phase: "groups", homeTeam: "Croacia", awayTeam: "España", homeScore: null, awayScore: null },

  { id: "E-1", group: "E", phase: "groups", homeTeam: "Países Bajos", awayTeam: "Chile", homeScore: null, awayScore: null },
  { id: "E-2", group: "E", phase: "groups", homeTeam: "Dinamarca", awayTeam: "Senegal", homeScore: null, awayScore: null },
  { id: "E-3", group: "E", phase: "groups", homeTeam: "Países Bajos", awayTeam: "Dinamarca", homeScore: null, awayScore: null },
  { id: "E-4", group: "E", phase: "groups", homeTeam: "Senegal", awayTeam: "Chile", homeScore: null, awayScore: null },
  { id: "E-5", group: "E", phase: "groups", homeTeam: "Chile", awayTeam: "Dinamarca", homeScore: null, awayScore: null },
  { id: "E-6", group: "E", phase: "groups", homeTeam: "Senegal", awayTeam: "Países Bajos", homeScore: null, awayScore: null },

  { id: "F-1", group: "F", phase: "groups", homeTeam: "Inglaterra", awayTeam: "Ecuador", homeScore: null, awayScore: null },
  { id: "F-2", group: "F", phase: "groups", homeTeam: "Bélgica", awayTeam: "Polonia", homeScore: null, awayScore: null },
  { id: "F-3", group: "F", phase: "groups", homeTeam: "Inglaterra", awayTeam: "Bélgica", homeScore: null, awayScore: null },
  { id: "F-4", group: "F", phase: "groups", homeTeam: "Polonia", awayTeam: "Ecuador", homeScore: null, awayScore: null },
  { id: "F-5", group: "F", phase: "groups", homeTeam: "Ecuador", awayTeam: "Bélgica", homeScore: null, awayScore: null },
  { id: "F-6", group: "F", phase: "groups", homeTeam: "Polonia", awayTeam: "Inglaterra", homeScore: null, awayScore: null },

  { id: "G-1", group: "G", phase: "groups", homeTeam: "Italia", awayTeam: "Australia", homeScore: null, awayScore: null },
  { id: "G-2", group: "G", phase: "groups", homeTeam: "Serbia", awayTeam: "Túnez", homeScore: null, awayScore: null },
  { id: "G-3", group: "G", phase: "groups", homeTeam: "Italia", awayTeam: "Serbia", homeScore: null, awayScore: null },
  { id: "G-4", group: "G", phase: "groups", homeTeam: "Túnez", awayTeam: "Australia", homeScore: null, awayScore: null },
  { id: "G-5", group: "G", phase: "groups", homeTeam: "Australia", awayTeam: "Serbia", homeScore: null, awayScore: null },
  { id: "G-6", group: "G", phase: "groups", homeTeam: "Túnez", awayTeam: "Italia", homeScore: null, awayScore: null },

  { id: "H-1", group: "H", phase: "groups", homeTeam: "Nigeria", awayTeam: "Austria", homeScore: null, awayScore: null },
  { id: "H-2", group: "H", phase: "groups", homeTeam: "Suecia", awayTeam: "Costa Rica", homeScore: null, awayScore: null },
  { id: "H-3", group: "H", phase: "groups", homeTeam: "Nigeria", awayTeam: "Suecia", homeScore: null, awayScore: null },
  { id: "H-4", group: "H", phase: "groups", homeTeam: "Costa Rica", awayTeam: "Austria", homeScore: null, awayScore: null },
  { id: "H-5", group: "H", phase: "groups", homeTeam: "Austria", awayTeam: "Suecia", homeScore: null, awayScore: null },
  { id: "H-6", group: "H", phase: "groups", homeTeam: "Costa Rica", awayTeam: "Nigeria", homeScore: null, awayScore: null },

  { id: "I-1", group: "I", phase: "groups", homeTeam: "Perú", awayTeam: "Noruega", homeScore: null, awayScore: null },
  { id: "I-2", group: "I", phase: "groups", homeTeam: "Irán", awayTeam: "Camerún", homeScore: null, awayScore: null },
  { id: "I-3", group: "I", phase: "groups", homeTeam: "Perú", awayTeam: "Irán", homeScore: null, awayScore: null },
  { id: "I-4", group: "I", phase: "groups", homeTeam: "Camerún", awayTeam: "Noruega", homeScore: null, awayScore: null },
  { id: "I-5", group: "I", phase: "groups", homeTeam: "Noruega", awayTeam: "Irán", homeScore: null, awayScore: null },
  { id: "I-6", group: "I", phase: "groups", homeTeam: "Camerún", awayTeam: "Perú", homeScore: null, awayScore: null },

  { id: "J-1", group: "J", phase: "groups", homeTeam: "Argelia", awayTeam: "Jordania", homeScore: null, awayScore: null },
  { id: "J-2", group: "J", phase: "groups", homeTeam: "Ucrania", awayTeam: "Emiratos Árabes Unidos", homeScore: null, awayScore: null },
  { id: "J-3", group: "J", phase: "groups", homeTeam: "Argelia", awayTeam: "Ucrania", homeScore: null, awayScore: null },
  { id: "J-4", group: "J", phase: "groups", homeTeam: "Emiratos Árabes Unidos", awayTeam: "Jordania", homeScore: null, awayScore: null },
  { id: "J-5", group: "J", phase: "groups", homeTeam: "Jordania", awayTeam: "Ucrania", homeScore: null, awayScore: null },
  { id: "J-6", group: "J", phase: "groups", homeTeam: "Emiratos Árabes Unidos", awayTeam: "Argelia", homeScore: null, awayScore: null },

  { id: "K-1", group: "K", phase: "groups", homeTeam: "Uzbekistán", awayTeam: "RD Congo", homeScore: null, awayScore: null },
  { id: "K-2", group: "K", phase: "groups", homeTeam: "Turquía", awayTeam: "Paraguay", homeScore: null, awayScore: null },
  { id: "K-3", group: "K", phase: "groups", homeTeam: "Uzbekistán", awayTeam: "Turquía", homeScore: null, awayScore: null },
  { id: "K-4", group: "K", phase: "groups", homeTeam: "Paraguay", awayTeam: "RD Congo", homeScore: null, awayScore: null },
  { id: "K-5", group: "K", phase: "groups", homeTeam: "RD Congo", awayTeam: "Turquía", homeScore: null, awayScore: null },
  { id: "K-6", group: "K", phase: "groups", homeTeam: "Paraguay", awayTeam: "Uzbekistán", homeScore: null, awayScore: null },

  { id: "L-1", group: "L", phase: "groups", homeTeam: "Ghana", awayTeam: "Panamá", homeScore: null, awayScore: null },
  { id: "L-2", group: "L", phase: "groups", homeTeam: "Arabia Saudita", awayTeam: "Egipto", homeScore: null, awayScore: null },
  { id: "L-3", group: "L", phase: "groups", homeTeam: "Ghana", awayTeam: "Arabia Saudita", homeScore: null, awayScore: null },
  { id: "L-4", group: "L", phase: "groups", homeTeam: "Egipto", awayTeam: "Panamá", homeScore: null, awayScore: null },
  { id: "L-5", group: "L", phase: "groups", homeTeam: "Panamá", awayTeam: "Arabia Saudita", homeScore: null, awayScore: null },
  { id: "L-6", group: "L", phase: "groups", homeTeam: "Egipto", awayTeam: "Ghana", homeScore: null, awayScore: null },
];

export const GROUP_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

const ROUND_OF_32_BLUEPRINT: Array<{ id: string; home: string; away: string }> = [
  // ── Lado Izquierdo ──
  { id: "R32-1",  home: "1E", away: "BEST3-1" },
  { id: "R32-2",  home: "1I", away: "BEST3-2" },
  { id: "R32-3",  home: "2A", away: "2B" },
  { id: "R32-4",  home: "1F", away: "2C" },
  { id: "R32-5",  home: "2K", away: "2L" },
  { id: "R32-6",  home: "1H", away: "2J" },
  { id: "R32-7",  home: "1D", away: "BEST3-3" },
  { id: "R32-8",  home: "1G", away: "BEST3-4" },
  // ── Lado Derecho ──
  { id: "R32-9",  home: "1C", away: "2F" },
  { id: "R32-10", home: "2E", away: "2I" },
  { id: "R32-11", home: "1A", away: "BEST3-5" },
  { id: "R32-12", home: "1L", away: "BEST3-6" },
  { id: "R32-13", home: "1J", away: "2H" },
  { id: "R32-14", home: "2D", away: "2G" },
  { id: "R32-15", home: "1B", away: "BEST3-7" },
  { id: "R32-16", home: "1K", away: "BEST3-8" },
];

function compareTeams(a: GroupStanding, b: GroupStanding) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.team.localeCompare(b.team, "es");
}

export function buildStandings(matches: GroupMatch[]): Map<string, GroupStanding[]> {
  const grouped = new Map<string, GroupMatch[]>();

  for (const match of matches) {
    if (!grouped.has(match.group)) grouped.set(match.group, []);
    grouped.get(match.group)!.push(match);
  }

  const standings = new Map<string, GroupStanding[]>();

  for (const group of GROUP_ORDER) {
    const fixtures = grouped.get(group) ?? [];
    const table = new Map<TeamName, GroupStanding>();

    for (const fixture of fixtures) {
      for (const team of [fixture.homeTeam, fixture.awayTeam]) {
        if (!table.has(team)) {
          table.set(team, {
            team,
            group,
            pts: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
          });
        }
      }

      if (fixture.homeScore === null && fixture.awayScore === null) continue;
      const hs = fixture.homeScore ?? 0;
      const as_ = fixture.awayScore ?? 0;

      const home = table.get(fixture.homeTeam)!;
      const away = table.get(fixture.awayTeam)!;

      home.played += 1;
      away.played += 1;

      home.gf += hs;
      home.ga += as_;
      away.gf += as_;
      away.ga += hs;

      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;

      if (hs > as_) {
        home.pts += 3;
        home.wins += 1;
        away.losses += 1;
      } else if (as_ > hs) {
        away.pts += 3;
        away.wins += 1;
        home.losses += 1;
      } else {
        home.pts += 1;
        away.pts += 1;
        home.draws += 1;
        away.draws += 1;
      }
    }

    const sorted = Array.from(table.values())
      .sort(compareTeams)
      .map((row, index) => ({ ...row, rankInGroup: (index + 1) as 1 | 2 | 3 | 4 }));

    standings.set(group, sorted);
  }

  return standings;
}

export function buildThirdPlaceTable(
  standings: Map<string, GroupStanding[]>
): GroupStanding[] {
  return GROUP_ORDER
    .map((group) => standings.get(group)?.[2])
    .filter((team): team is GroupStanding => Boolean(team))
    .sort(compareTeams)
    .map((team, index) => ({
      ...team,
      rankInGroup: 3,
      rankingBucket: index + 1,
    }));
}

export function buildQualifiedTeams(
  standings: Map<string, GroupStanding[]>
): QualifiedTeam[] {
  const qualified: QualifiedTeam[] = [];

  for (const group of GROUP_ORDER) {
    const rows = standings.get(group) ?? [];
    if (rows[0]) qualified.push({ team: rows[0].team, group, position: 1 });
    if (rows[1]) qualified.push({ team: rows[1].team, group, position: 2 });
  }

  buildThirdPlaceTable(standings)
    .slice(0, 8)
    .forEach((team, index) => {
      qualified.push({
        team: team.team,
        group: team.group,
        position: 3,
        rankingBucket: index + 1,
      });
    });

  return qualified;
}

function qualifiedThirdMap(
  standings: Map<string, GroupStanding[]>
): Map<string, GroupStanding & { rankingBucket: number }> {
  const bestThirds = buildThirdPlaceTable(standings).slice(0, 8);

  return new Map(
    bestThirds.map((team, index) => [
      team.group,
      { ...team, rankingBucket: index + 1 },
    ])
  );
}

function resolveToken(
  token: string,
  standings: Map<string, GroupStanding[]>,
  thirdMap: Map<string, GroupStanding & { rankingBucket: number }>
): TeamName {
  // NUEVO: Resuelve los comodines dinámicos de los 8 Mejores Terceros
  if (token.startsWith("BEST3-")) {
    const rankIndex = parseInt(token.split("-")[1]) - 1; // Convierte "1" a índice 0
    const sortedThirds = Array.from(thirdMap.values()).sort((a, b) => a.rankingBucket - b.rankingBucket);
    return sortedThirds[rankIndex]?.team ?? token;
  }

  const position = token[0];
  const group = token.slice(1);

  if (position === "1") return standings.get(group)?.[0]?.team ?? token;
  if (position === "2") return standings.get(group)?.[1]?.team ?? token;
  if (position === "3") return thirdMap.get(group)?.team ?? `3${group}`;

  return token;
}

function buildNextRound(
  phase: KnockoutSlot["phase"],
  prefix: string,
  previousRound: KnockoutSlot[]
): KnockoutSlot[] {
  const next: KnockoutSlot[] = [];

  for (let i = 0; i < previousRound.length; i += 2) {
    const a = previousRound[i];
    const b = previousRound[i + 1];

    if (!a || !b) continue;

    next.push({
      id: `${prefix}-${i / 2 + 1}`,
      label: `${prefix}-${i / 2 + 1}`,
      phase,
      home: `Ganador ${a.label}`,
      away: `Ganador ${b.label}`,
      sourceHome: a.label,
      sourceAway: b.label,
    });
  }

  return next;
}

export function buildRoundOf32(
  standings: Map<string, GroupStanding[]>
): KnockoutSlot[] {
  const thirdMap = qualifiedThirdMap(standings);

  return ROUND_OF_32_BLUEPRINT.map(
    (slot): KnockoutSlot => ({
      id: slot.id,
      label: slot.id,
      phase: "roundOf32",
      home: resolveToken(slot.home, standings, thirdMap),
      away: resolveToken(slot.away, standings, thirdMap),
      sourceHome: slot.home,
      sourceAway: slot.away,
    })
  );
}

export function buildTournamentSnapshot(
  matches: GroupMatch[]
): TournamentSnapshot {
  const standingsByGroup = buildStandings(matches);
  const thirdPlaceTable = buildThirdPlaceTable(standingsByGroup);
  const qualifiedTeams = buildQualifiedTeams(standingsByGroup);
  const roundOf32 = buildRoundOf32(standingsByGroup);
  const roundOf16 = buildNextRound("roundOf16", "R16", roundOf32);
  const quarterFinals = buildNextRound("quarterFinals", "QF", roundOf16);
  const semiFinals = buildNextRound("semiFinals", "SF", quarterFinals);

  const thirdPlace: KnockoutSlot = {
    id: "TP-1",
    label: "3P",
    phase: "thirdPlace",
    home: semiFinals[0] ? `Perdedor ${semiFinals[0].label}` : "Pendiente SF-1",
    away: semiFinals[1] ? `Perdedor ${semiFinals[1].label}` : "Pendiente SF-2",
    sourceHome: semiFinals[0]?.label,
    sourceAway: semiFinals[1]?.label,
  };

  const final: KnockoutSlot = {
    id: "FINAL",
    label: "FINAL",
    phase: "final",
    home: semiFinals[0] ? `Ganador ${semiFinals[0].label}` : "Pendiente SF-1",
    away: semiFinals[1] ? `Ganador ${semiFinals[1].label}` : "Pendiente SF-2",
    sourceHome: semiFinals[0]?.label,
    sourceAway: semiFinals[1]?.label,
  };

  return {
    standingsByGroup,
    thirdPlaceTable,
    qualifiedTeams,
    roundOf32,
    roundOf16,
    quarterFinals,
    semiFinals,
    thirdPlace,
    final,
  };
}

export function buildKnockout(
  standings: Map<string, GroupStanding[]>
): TournamentSnapshot {
  const roundOf32 = buildRoundOf32(standings);
  const roundOf16 = buildNextRound("roundOf16", "R16", roundOf32);
  const quarterFinals = buildNextRound("quarterFinals", "QF", roundOf16);
  const semiFinals = buildNextRound("semiFinals", "SF", quarterFinals);

  const thirdPlace: KnockoutSlot = {
    id: "TP-1",
    label: "3P",
    phase: "thirdPlace",
    home: semiFinals[0] ? `Perdedor ${semiFinals[0].label}` : "Pendiente SF-1",
    away: semiFinals[1] ? `Perdedor ${semiFinals[1].label}` : "Pendiente SF-2",
    sourceHome: semiFinals[0]?.label,
    sourceAway: semiFinals[1]?.label,
  };

  const final: KnockoutSlot = {
    id: "FINAL",
    label: "FINAL",
    phase: "final",
    home: semiFinals[0] ? `Ganador ${semiFinals[0].label}` : "Pendiente SF-1",
    away: semiFinals[1] ? `Ganador ${semiFinals[1].label}` : "Pendiente SF-2",
    sourceHome: semiFinals[0]?.label,
    sourceAway: semiFinals[1]?.label,
  };

  return {
    standingsByGroup: standings,
    thirdPlaceTable: buildThirdPlaceTable(standings),
    qualifiedTeams: buildQualifiedTeams(standings),
    roundOf32,
    roundOf16,
    quarterFinals,
    semiFinals,
    thirdPlace,
    final,
  };
}

// ─── Knockout score propagation ───────────────────────────────────────────────

export type KnockoutScores = Record<
  string,
  {
    homeScore: number | null;
    awayScore: number | null;
    tieResolution?: "extraTime" | "penalties";
    extraTimeHome?: number;
    extraTimeAway?: number;
    penaltyWinner?: "home" | "away";
  }
>;

export function resolveKnockoutWinner(
  slot: KnockoutSlot,
  scores: KnockoutScores
): TeamName | null {
  const s = scores[slot.id];

  // Sin objeto de score: pendiente
  if (!s) return null;

  // Ambos lados sin tocar (== null captura undefined Y null): pendiente
  if (s.homeScore == null && s.awayScore == null) return null;

  // Casteo agresivo: null/undefined → 0, cualquier número → Number()
  const home = Number(s.homeScore ?? 0);
  const away = Number(s.awayScore ?? 0);

  if (home > away) return slot.home;
  if (away > home) return slot.away;

  // Empate en 90' — resolver según elección del usuario
  if (s.tieResolution === "extraTime") {
    // Si aún no ingresaron scores de ET, pendiente
    if (s.extraTimeHome == null && s.extraTimeAway == null) return null;
    const eth = Number(s.extraTimeHome ?? 0);
    const eta = Number(s.extraTimeAway ?? 0);
    if (eth > eta) return slot.home;
    if (eta > eth) return slot.away;
    // Prórroga también empatada → penales
    if (s.penaltyWinner === "home") return slot.home;
    if (s.penaltyWinner === "away") return slot.away;
    return null;
  }

  if (s.tieResolution === "penalties") {
    if (s.penaltyWinner === "home") return slot.home;
    if (s.penaltyWinner === "away") return slot.away;
    return null;
  }

  return null;
}

export function buildNextRoundWithWinners(
  previousRound: KnockoutSlot[],
  scores: KnockoutScores,
  phase: KnockoutSlot["phase"],
  prefix: string
): KnockoutSlot[] {
  const next: KnockoutSlot[] = [];

  for (let i = 0; i < previousRound.length; i += 2) {
    const a = previousRound[i];
    const b = previousRound[i + 1];
    if (!a || !b) continue;

    const winA = resolveKnockoutWinner(a, scores);
    const winB = resolveKnockoutWinner(b, scores);

    next.push({
      id: `${prefix}-${i / 2 + 1}`,
      label: `${prefix}-${i / 2 + 1}`,
      phase,
      home: winA ?? `Gan. ${a.label}`,
      away: winB ?? `Gan. ${b.label}`,
      sourceHome: a.id,
      sourceAway: b.id,
    });
  }

  return next;
}

// ─── Third-place assignment — FIFA backtracking ───────────────────────────────

export type ThirdSlotAssignments = Record<string, string>; // slotId → teamName

const THIRD_PLACE_R32_SLOTS: ReadonlyArray<{ slotId: string; allowedGroups: readonly string[] }> = [
  { slotId: "R32-1",  allowedGroups: ["A", "B", "C", "D", "F"] },       // vs 1E
  { slotId: "R32-2",  allowedGroups: ["C", "D", "F", "G", "H"] },       // vs 1I
  { slotId: "R32-7",  allowedGroups: ["B", "E", "F", "I", "J"] },       // vs 1D
  { slotId: "R32-8",  allowedGroups: ["A", "E", "H", "I", "J"] },       // vs 1G
  { slotId: "R32-11", allowedGroups: ["C", "E", "F", "H", "I"] },       // vs 1A
  { slotId: "R32-12", allowedGroups: ["E", "H", "I", "J", "K"] },       // vs 1L
  { slotId: "R32-15", allowedGroups: ["E", "F", "G", "I", "J"] },       // vs 1B
  { slotId: "R32-16", allowedGroups: ["D", "E", "I", "J", "L"] },       // vs 1K
] as const;

export function assignThirdsToR32(
  selectedThirds: ReadonlyArray<{ team: string; group: string }>
): ThirdSlotAssignments | null {
  if (selectedThirds.length !== 8) return null;

  const slots = [...THIRD_PLACE_R32_SLOTS];
  const result: ThirdSlotAssignments = {};
  const usedTeams = new Set<string>();

  function backtrack(idx: number): boolean {
    if (idx === slots.length) return true;
    const { slotId, allowedGroups } = slots[idx];
    for (const { team, group } of selectedThirds) {
      if (usedTeams.has(team) || !allowedGroups.includes(group)) continue;
      result[slotId] = team;
      usedTeams.add(team);
      if (backtrack(idx + 1)) return true;
      delete result[slotId];
      usedTeams.delete(team);
    }
    return false;
  }

  return backtrack(0) ? result : null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildTournamentSnapshotWithKnockout(
  groupFixtures: GroupMatch[],
  knockoutScores: KnockoutScores,
  thirdAssignments: ThirdSlotAssignments = {}
): TournamentSnapshot {
  const standingsByGroup = buildStandings(groupFixtures);
  const thirdPlaceTable = buildThirdPlaceTable(standingsByGroup);
  const qualifiedTeams = buildQualifiedTeams(standingsByGroup);

  const emptyThirdMap = new Map<string, GroupStanding & { rankingBucket: number }>();
  const roundOf32 = ROUND_OF_32_BLUEPRINT.map((slot): KnockoutSlot => {
    const isThirdSlot = slot.away.startsWith("BEST3");
    return {
      id: slot.id,
      label: slot.id,
      phase: "roundOf32",
      home: resolveToken(slot.home, standingsByGroup, emptyThirdMap),
      away: isThirdSlot
        ? (thirdAssignments[slot.id] ?? "Pendiente")
        : resolveToken(slot.away, standingsByGroup, emptyThirdMap),
      sourceHome: slot.home,
      sourceAway: slot.away,
    };
  });
  const roundOf16 = buildNextRoundWithWinners(roundOf32, knockoutScores, "roundOf16", "R16");
  const quarterFinals = buildNextRoundWithWinners(roundOf16, knockoutScores, "quarterFinals", "QF");
  const semiFinals = buildNextRoundWithWinners(quarterFinals, knockoutScores, "semiFinals", "SF");

  const sf1 = semiFinals[0];
  const sf2 = semiFinals[1];
  const winSF1 = sf1 ? resolveKnockoutWinner(sf1, knockoutScores) : null;
  const winSF2 = sf2 ? resolveKnockoutWinner(sf2, knockoutScores) : null;

  const loseSF1 = !sf1
    ? "Pendiente"
    : !winSF1
      ? `Perd. ${sf1.label}`
      : winSF1 === sf1.home
        ? sf1.away
        : sf1.home;

  const loseSF2 = !sf2
    ? "Pendiente"
    : !winSF2
      ? `Perd. ${sf2.label}`
      : winSF2 === sf2.home
        ? sf2.away
        : sf2.home;

  return {
    standingsByGroup,
    thirdPlaceTable,
    qualifiedTeams,
    roundOf32,
    roundOf16,
    quarterFinals,
    semiFinals,
    thirdPlace: {
      id: "TP-1",
      label: "3° Lugar",
      phase: "thirdPlace",
      home: loseSF1,
      away: loseSF2,
    },
    final: {
      id: "FINAL",
      label: "FINAL",
      phase: "final",
      home: winSF1 ?? (sf1 ? `Gan. ${sf1.label}` : "Pendiente"),
      away: winSF2 ?? (sf2 ? `Gan. ${sf2.label}` : "Pendiente"),
    },
  };
}

export function getLockDateISO(kickoffTime?: string): string | null {
  if (!kickoffTime) return null;

  const kickoff = new Date(kickoffTime);
  if (Number.isNaN(kickoff.getTime())) return null;

  kickoff.setHours(kickoff.getHours() - 2);
  return kickoff.toISOString();
}

export function getMatchLockState(
  kickoffTime?: string,
  now = new Date(),
  matchupDefined = true
): MatchLockState {
  if (!matchupDefined) {
    return {
      canEdit: false,
      locksAt: null,
      reason: "pending_matchup",
    };
  }

  const lockISO = getLockDateISO(kickoffTime);

  if (!lockISO) {
    return {
      canEdit: true,
      locksAt: null,
      reason: "open",
    };
  }

  const locked = now.getTime() >= new Date(lockISO).getTime();

  return {
    canEdit: !locked,
    locksAt: lockISO,
    reason: locked ? "locked_by_time" : "open",
  };
}