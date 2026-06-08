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

// ─── Diccionario de Traducción Integrado ──────────────────────────────────────
export const TEAM_TRANSLATIONS: Record<string, string> = {
  "Brazil": "Brasil", "Spain": "España", "Germany": "Alemania",
  "England": "Inglaterra", "France": "Francia", "Netherlands": "Países Bajos",
  "Belgium": "Bélgica", "Croatia": "Croacia", "Denmark": "Dinamarca",
  "Switzerland": "Suiza", "Poland": "Polonia", "Portugal": "Portugal",
  "Morocco": "Marruecos", "Senegal": "Senegal", "Cameroon": "Camerún",
  "Japan": "Japón", "South Korea": "Corea del Sur", "USA": "Estados Unidos",
  "Mexico": "México", "Canada": "Canadá", "Uruguay": "Uruguay",
  "Colombia": "Colombia", "Ecuador": "Ecuador", "Peru": "Perú",
  "Wales": "Gales", "Saudi Arabia": "Arabia Saudita", "Iran": "Irán",
  "Serbia": "Serbia", "Ghana": "Ghana", "Tunisia": "Túnez",
  "Costa Rica": "Costa Rica", "Qatar": "Qatar", "South Africa": "Sudáfrica",
  "Czech Republic": "República Checa",
  "Scotland": "Escocia",
  "Haiti": "Haití",
  "Ivory Coast": "Costa de Marfil",
  "Bosnia & Herzegovina": "Bosnia y Herzegovina",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Curaçao": "Curazao",
  "Egypt": "Egipto",
  "New Zealand": "Nueva Zelanda",
  "Algeria": "Argelia",
  "Jordan": "Jordania",
  "Congo DR": "RD Congo",
  "DR Congo": "RD Congo",
  "Uzbekistan": "Uzbekistán",
  "Panama": "Panamá",
  "Cape Verde Islands": "Cabo Verde",
  "Cape Verde": "Cabo Verde",
  "Cabo Verde": "Cabo Verde",
  "Türkiye": "Turquía",
  "Turkey": "Turquía",
  "Iraq": "Irak",
  "Norway": "Noruega",
  "Austria": "Austria"
};

export function t(teamName: string): string {
  return TEAM_TRANSLATIONS[teamName] || teamName;
}

export const DEFAULT_GROUP_FIXTURES: GroupMatch[] = [];

export const GROUP_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

// ─── Bracket Oficial FIFA 2026 ────────────────────────────────────────────────
// Corregido para asegurar cruces reales en Octavos y Cuartos de Final
const ROUND_OF_32_BLUEPRINT: Array<{ id: string; home: string; away: string }> = [
  // ── Lado Izquierdo (Genera Semifinalista 1) ──
  { id: "R32-1",  home: "1E", away: "BEST3-1" }, // vs 3A/B/C/D/F
  { id: "R32-2",  home: "2A", away: "2B" },      
  { id: "R32-3",  home: "1C", away: "2F" },      
  { id: "R32-4",  home: "2E", away: "2I" },      
  { id: "R32-5",  home: "1H", away: "2J" },      
  { id: "R32-6",  home: "2K", away: "2L" },      
  { id: "R32-7",  home: "1G", away: "BEST3-2" }, // vs 3A/E/H/I/J
  { id: "R32-8",  home: "1D", away: "BEST3-3" }, // vs 3B/E/F/I/J

  // ── Lado Derecho (Genera Semifinalista 2) ──
  { id: "R32-9",  home: "1F", away: "2C" },      
  { id: "R32-10", home: "1I", away: "BEST3-4" }, // vs 3C/D/F/G/H
  { id: "R32-11", home: "1A", away: "BEST3-5" }, // vs 3C/E/F/H/I
  { id: "R32-12", home: "1L", away: "BEST3-6" }, // vs 3E/H/I/J/K
  { id: "R32-13", home: "1K", away: "BEST3-7" }, // vs 3D/E/I/J/L
  { id: "R32-14", home: "2D", away: "2G" },      
  { id: "R32-15", home: "1B", away: "BEST3-8" }, // vs 3E/F/G/I/J
  { id: "R32-16", home: "1J", away: "2H" },      
];

// ─── Motor de Ingesta Dinámica (API -> Simulator) ─────────────────────────────

export interface ApiMatch {
  id: number;
  api_match_id?: number | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  round?: string | null;   // "Group Stage - 1", "Round of 32", etc.
  venue?: string | null;
}

function isGroupStageMatch(m: ApiMatch): boolean {
  // A match belongs to the group stage when `round` explicitly says so,
  // or when `round` is absent (legacy data without the field).
  if (!m.round) return true;
  return m.round.toLowerCase().includes("group");
}

export function buildFixturesFromAPI(apiMatches: ApiMatch[]): GroupMatch[] {
  // ── Critical: only feed group-stage matches into the BFS cluster detector.
  // Knockout matches create cross-group edges that merge multiple groups into
  // a single connected component, causing the same team to appear in several
  // bracket slots (e.g. "México vs México" in the final).
  const groupOnlyMatches = apiMatches.filter(isGroupStageMatch);

  const adjacency = new Map<string, Set<string>>();
  groupOnlyMatches.forEach(m => {
    if (!adjacency.has(m.home_team)) adjacency.set(m.home_team, new Set());
    if (!adjacency.has(m.away_team)) adjacency.set(m.away_team, new Set());
    adjacency.get(m.home_team)!.add(m.away_team);
    adjacency.get(m.away_team)!.add(m.home_team);
  });

  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const team of Array.from(adjacency.keys())) {
    if (!visited.has(team)) {
      const cluster: string[] = [];
      const queue = [team];
      visited.add(team);
      while (queue.length > 0) {
        const current = queue.shift()!;
        cluster.push(current);
        for (const neighbor of Array.from(adjacency.get(current) || [])) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      clusters.push(cluster);
    }
  }

  const clustersWithDates = clusters.map(cluster => {
    const clusterMatches = groupOnlyMatches.filter(
      m => cluster.includes(m.home_team) && cluster.includes(m.away_team)
    );
    const earliestTime = Math.min(
      ...clusterMatches.map(m => new Date(m.kickoff_time).getTime() || Infinity)
    );
    return { teams: cluster, earliestTime, matches: clusterMatches };
  });

  clustersWithDates.sort((a, b) => a.earliestTime - b.earliestTime);

  const finalFixtures: GroupMatch[] = [];
  clustersWithDates.forEach((clusterData, index) => {
    const groupLetter = GROUP_ORDER[index] || `G${index}`;
    const sortedMatches = clusterData.matches.sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );
    sortedMatches.forEach((m, mIdx) => {
      finalFixtures.push({
        id: `${groupLetter}-${mIdx + 1}`,
        group: groupLetter,
        phase: "groups",
        homeTeam: t(m.home_team),
        awayTeam: t(m.away_team),
        homeScore: m.home_score,
        awayScore: m.away_score,
        kickoffTime: m.kickoff_time,
      });
    });
  });

  return finalFixtures;
}

/**
 * Reads real knockout results from the API and maps them onto bracket slot IDs
 * derived from a pre-built tournament snapshot.  Use the returned object as an
 * overlay (or initial value) for `knockoutScores` so that the bracket displays
 * real scores once the live API provides them (matches 73-104).
 */
export function buildKnockoutOverlayFromAPI(
  apiMatches: ApiMatch[],
  snapshot: TournamentSnapshot
): KnockoutScores {
  const knockoutMatches = apiMatches.filter(m => !isGroupStageMatch(m));
  if (!knockoutMatches.length) return {};

  const allSlots: KnockoutSlot[] = [
    ...snapshot.roundOf32,
    ...snapshot.roundOf16,
    ...snapshot.quarterFinals,
    ...snapshot.semiFinals,
    snapshot.thirdPlace,
    snapshot.final,
  ];

  const overlay: KnockoutScores = {};
  for (const m of knockoutMatches) {
    if (m.home_score === null && m.away_score === null) continue;
    const slot = allSlots.find(
      s =>
        s.home.trim().toLowerCase() === t(m.home_team).trim().toLowerCase() &&
        s.away.trim().toLowerCase() === t(m.away_team).trim().toLowerCase()
    );
    if (slot) {
      overlay[slot.id] = { homeScore: m.home_score, awayScore: m.away_score };
    }
  }
  return overlay;
}

// ─── Lógica Central de Clasificación y Tablas ────────────────────────────────

function compareTeams(a: GroupStanding, b: GroupStanding) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return t(a.team).localeCompare(t(b.team), "es");
}

export function buildStandings(matches: GroupMatch[]): Map<string, GroupStanding[]> {
  const grouped = new Map<string, GroupMatch[]>();

  for (const match of matches) {
    if (!grouped.has(match.group)) grouped.set(match.group, []);
    grouped.get(match.group)!.push(match);
  }

  // Defense-in-depth: guarantee each team name appears in at most one group.
  // If buildFixturesFromAPI ever leaks knockout teams into group fixtures the BFS
  // would merge groups and the same team would appear in multiple standings —
  // causing duplicate slots in the bracket. We catch that here by keeping only
  // the first occurrence of each team name.
  const claimedTeams = new Set<TeamName>();

  const standings = new Map<string, GroupStanding[]>();

  for (const group of GROUP_ORDER) {
    const fixtures = grouped.get(group) ?? [];
    const table = new Map<TeamName, GroupStanding>();

    for (const fixture of fixtures) {
      for (const team of [fixture.homeTeam, fixture.awayTeam]) {
        if (claimedTeams.has(team)) continue; // already assigned to another group
        if (!table.has(team)) {
          claimedTeams.add(team);
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

      const home = table.get(fixture.homeTeam);
      const away = table.get(fixture.awayTeam);
      if (!home || !away) continue; // skip if either team was deduplicated away

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
  if (token.startsWith("BEST3-")) {
    const rankIndex = parseInt(token.split("-")[1]) - 1;
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

// ─── Propagación de resultados Eliminatorios ──────────────────────────────────

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

  if (!s) return null;
  if (s.homeScore == null && s.awayScore == null) return null;

  const home = Number(s.homeScore ?? 0);
  const away = Number(s.awayScore ?? 0);

  if (home > away) return slot.home;
  if (away > home) return slot.away;

  if (s.tieResolution === "extraTime") {
    if (s.extraTimeHome == null && s.extraTimeAway == null) return null;
    const eth = Number(s.extraTimeHome ?? 0);
    const eta = Number(s.extraTimeAway ?? 0);
    if (eth > eta) return slot.home;
    if (eta > eth) return slot.away;
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

// True when the user has entered a tied score but hasn't picked a tiebreak method/winner yet.
function hasPendingTiebreak(slot: KnockoutSlot, scores: KnockoutScores): boolean {
  const s = scores[slot.id];
  if (!s || s.homeScore == null || s.awayScore == null) return false;
  if (Number(s.homeScore) !== Number(s.awayScore)) return false;
  if (s.tieResolution === "extraTime") {
    if (s.extraTimeHome == null || s.extraTimeAway == null) return false;
    if (Number(s.extraTimeHome) !== Number(s.extraTimeAway)) return false;
    return !s.penaltyWinner;
  }
  if (s.tieResolution === "penalties") return !s.penaltyWinner;
  return true; // draw with no resolution method selected at all
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

    const display = (win: TeamName | null, slot: KnockoutSlot): string => {
      if (win !== null) return win;
      return hasPendingTiebreak(slot, scores) ? "Pendiente de desempate" : `Gan. ${slot.label}`;
    };

    next.push({
      id: `${prefix}-${i / 2 + 1}`,
      label: `${prefix}-${i / 2 + 1}`,
      phase,
      home: display(winA, a),
      away: display(winB, b),
      sourceHome: a.id,
      sourceAway: b.id,
    });
  }

  return next;
}

// ─── Asignación de Mejores Terceros (Backtracking FIFA) ───────────────────────

export type ThirdSlotAssignments = Record<string, string>; 

// Asignaciones actualizadas al nuevo Blueprint Oficial
const THIRD_PLACE_R32_SLOTS: ReadonlyArray<{ slotId: string; allowedGroups: readonly string[] }> = [
  { slotId: "R32-1",  allowedGroups: ["A", "B", "C", "D", "F"] },       
  { slotId: "R32-7",  allowedGroups: ["A", "E", "H", "I", "J"] },       
  { slotId: "R32-8",  allowedGroups: ["B", "E", "F", "I", "J"] },       
  { slotId: "R32-10", allowedGroups: ["C", "D", "F", "G", "H"] },       
  { slotId: "R32-11", allowedGroups: ["C", "E", "F", "H", "I"] },       
  { slotId: "R32-12", allowedGroups: ["E", "H", "I", "J", "K"] },       
  { slotId: "R32-13", allowedGroups: ["D", "E", "I", "J", "L"] },       
  { slotId: "R32-15", allowedGroups: ["E", "F", "G", "I", "J"] },       
] as const;

export function assignThirdsToR32(
  selectedThirds: ReadonlyArray<{ team: string; group: string }>
): ThirdSlotAssignments | null {
  if (selectedThirds.length !== 8) return null;

  const slots = [...THIRD_PLACE_R32_SLOTS];

  // 1) Intento estricto: backtracking que respeta los cruces oficiales FIFA
  //    (ningún equipo enfrenta al líder de su propio grupo).
  const strict: ThirdSlotAssignments = {};
  const usedStrict = new Set<string>();

  function backtrack(idx: number): boolean {
    if (idx === slots.length) return true;
    const { slotId, allowedGroups } = slots[idx];
    for (const { team, group } of selectedThirds) {
      if (usedStrict.has(team) || !allowedGroups.includes(group)) continue;
      strict[slotId] = team;
      usedStrict.add(team);
      if (backtrack(idx + 1)) return true;
      delete strict[slotId];
      usedStrict.delete(team);
    }
    return false;
  }

  if (backtrack(0)) return strict;

  // 2) Fallback: para esta combinación de grupos clasificados no existe una
  //    asignación que respete el 100% de los cruces FIFA. En vez de dejar el
  //    bracket en "Pendiente" o bloquear la generación, asignamos primero lo
  //    que sí respeta las restricciones (pase greedy, slot por slot) y
  //    completamos los huecos restantes con los equipos sobrantes en orden
  //    secuencial — el bracket siempre queda 100% relleno con equipos reales.
  const fallback: ThirdSlotAssignments = {};
  const usedFallback = new Set<string>();
  const pendingSlots: typeof slots = [];

  for (const slot of slots) {
    const match = selectedThirds.find(
      ({ team, group }) => !usedFallback.has(team) && slot.allowedGroups.includes(group)
    );
    if (match) {
      fallback[slot.slotId] = match.team;
      usedFallback.add(match.team);
    } else {
      pendingSlots.push(slot);
    }
  }

  const leftover = selectedThirds.filter(({ team }) => !usedFallback.has(team));
  pendingSlots.forEach((slot, i) => {
    const team = leftover[i]?.team;
    if (team) fallback[slot.slotId] = team;
  });

  return fallback;
}

export function buildTournamentSnapshotWithKnockout(
  groupFixtures: GroupMatch[],
  knockoutScores: KnockoutScores,
  thirdAssignments: ThirdSlotAssignments = {}
): TournamentSnapshot {
  const standingsByGroup = buildStandings(groupFixtures);
  const thirdPlaceTable = buildThirdPlaceTable(standingsByGroup);
  const qualifiedTeams = buildQualifiedTeams(standingsByGroup);

  const emptyThirdMap = new Map<string, GroupStanding & { rankingBucket: number }>();

  // Collect all top-2 qualifiers so stale third assignments don't duplicate them.
  const regularQualifiers = new Set<string>();
  for (const slot of ROUND_OF_32_BLUEPRINT) {
    if (!slot.home.startsWith("BEST3")) regularQualifiers.add(resolveToken(slot.home, standingsByGroup, emptyThirdMap));
    if (!slot.away.startsWith("BEST3")) regularQualifiers.add(resolveToken(slot.away, standingsByGroup, emptyThirdMap));
  }

  const roundOf32 = ROUND_OF_32_BLUEPRINT.map((slot): KnockoutSlot => {
    const isThirdSlot = slot.away.startsWith("BEST3");
    const homeTeam = resolveToken(slot.home, standingsByGroup, emptyThirdMap);
    let awayTeam: string;
    if (isThirdSlot) {
      const assigned = thirdAssignments[slot.id];
      // If the assigned third already occupies a regular qualifier slot, the
      // assignment is stale (user changed group scores after generating bracket).
      awayTeam = (assigned && !regularQualifiers.has(assigned)) ? assigned : "Pendiente";
    } else {
      awayTeam = resolveToken(slot.away, standingsByGroup, emptyThirdMap);
    }
    return {
      id: slot.id,
      label: slot.id,
      phase: "roundOf32",
      home: homeTeam,
      away: awayTeam,
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