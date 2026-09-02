export const LIVE_PITCH_TYPES = [
  "Four-Seam Fastball",
  "Sinker",
  "Slider",
  "Sweeper",
  "Changeup",
  "Curveball",
  "Cutter",
  "Splitter",
  "Knuckle Curve",
] as const;

export type TeamSummary = {
  name: string;
  abbreviation: string;
  score: number | null;
};

export type GameStatus = {
  abstractGameState: string;
  detailedState: string;
  isLive: boolean;
  isFinal: boolean;
  isPregame: boolean;
};

export type ScheduleGame = {
  gamePk: number;
  gameDate: string;
  status: GameStatus;
  away: TeamSummary;
  home: TeamSummary;
  inning: string;
  inningState: string;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
};

export type ScheduleResponse = {
  date: string;
  games: ScheduleGame[];
  updatedAt: string;
};

export type LivePitch = {
  key: string;
  sequence: number;
  atBatIndex: number;
  eventIndex: number;
  batter: string;
  batterSide: BatterSide;
  pitcher: string;
  pitchType: string;
  pitchCode: string;
  velocity: number | null;
  outcome: string;
  plateX: number | null;
  plateZ: number | null;
  strikeZoneBottom: number | null;
  strikeZoneTop: number | null;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
};

export type CurrentAtBat = {
  atBatIndex: number;
  batter: string;
  batterSide: BatterSide;
  pitcher: string;
  description: string;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
};

export type LiveGameResponse = {
  gamePk: number;
  status: GameStatus;
  away: TeamSummary;
  home: TeamSummary;
  inning: string;
  inningState: string;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
  currentAtBat: CurrentAtBat | null;
  latestPitch: LivePitch | null;
  recentPitches: LivePitch[];
  pitchCount: number;
  updatedAt: string;
};

export type LivePollResponse = {
  gamePk: number;
  changed: boolean;
  timecode: string;
  checkedAt: string;
  feed: LiveGameResponse | null;
};

export type BatterSide = "L" | "R" | "S" | "U";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickRecord(source: UnknownRecord, key: string): UnknownRecord {
  return asRecord(source[key]);
}

function pickString(source: UnknownRecord, key: string, fallback = "") {
  const value = source[key];
  return typeof value === "string" ? value : fallback;
}

function pickNumber(source: UnknownRecord, key: string): number | null {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickCount(source: UnknownRecord, key: string): number | null {
  const value = pickNumber(source, key);
  return value === null ? null : Math.trunc(value);
}

function normalizeStatus(status: UnknownRecord): GameStatus {
  const abstractGameState = pickString(status, "abstractGameState", "Unknown");
  const detailedState = pickString(status, "detailedState", "Unknown");
  const lowerDetail = detailedState.toLowerCase();

  return {
    abstractGameState,
    detailedState,
    isLive:
      abstractGameState === "Live" ||
      lowerDetail.includes("in progress") ||
      lowerDetail.includes("warmup"),
    isFinal: abstractGameState === "Final" || lowerDetail.includes("final"),
    isPregame:
      abstractGameState === "Preview" ||
      lowerDetail.includes("scheduled") ||
      lowerDetail.includes("pre-game"),
  };
}

function normalizeBatterSide(value: string): BatterSide {
  if (value === "L" || value === "R" || value === "S") {
    return value;
  }

  return "U";
}

function normalizeTeam(teamSide: UnknownRecord, lineSide: UnknownRecord): TeamSummary {
  const nestedTeam = pickRecord(teamSide, "team");
  const team = Object.keys(nestedTeam).length ? nestedTeam : teamSide;

  return {
    name: pickString(team, "name", "TBD"),
    abbreviation: pickString(team, "abbreviation", pickString(team, "name", "TBD")),
    score: pickNumber(teamSide, "score") ?? pickNumber(lineSide, "runs"),
  };
}

function formatInning(linescore: UnknownRecord): string {
  const ordinal = pickString(linescore, "currentInningOrdinal");
  const current = pickCount(linescore, "currentInning");

  if (ordinal) {
    return ordinal;
  }

  return current === null ? "" : String(current);
}

export function normalizeSchedule(data: unknown, requestedDate: string): ScheduleResponse {
  const root = asRecord(data);
  const dates = asArray(root.dates);
  const games = dates.flatMap((dateEntry) =>
    asArray(asRecord(dateEntry).games).map((game): ScheduleGame => {
      const gameRecord = asRecord(game);
      const teams = pickRecord(gameRecord, "teams");
      const linescore = pickRecord(gameRecord, "linescore");
      const lineTeams = pickRecord(linescore, "teams");
      const status = normalizeStatus(pickRecord(gameRecord, "status"));

      return {
        gamePk: pickNumber(gameRecord, "gamePk") ?? 0,
        gameDate: pickString(gameRecord, "gameDate"),
        status,
        away: normalizeTeam(pickRecord(teams, "away"), pickRecord(lineTeams, "away")),
        home: normalizeTeam(pickRecord(teams, "home"), pickRecord(lineTeams, "home")),
        inning: formatInning(linescore),
        inningState: pickString(linescore, "inningState"),
        balls: pickCount(linescore, "balls"),
        strikes: pickCount(linescore, "strikes"),
        outs: pickCount(linescore, "outs"),
      };
    })
  );

  return {
    date: requestedDate,
    games: games.filter((game) => game.gamePk > 0),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCurrentAtBat(play: UnknownRecord): CurrentAtBat | null {
  if (!Object.keys(play).length) {
    return null;
  }

  const matchup = pickRecord(play, "matchup");
  const batSide = pickRecord(matchup, "batSide");
  const result = pickRecord(play, "result");
  const count = pickRecord(play, "count");
  const about = pickRecord(play, "about");

  return {
    atBatIndex: pickCount(about, "atBatIndex") ?? 0,
    batter: pickString(pickRecord(matchup, "batter"), "fullName", "Current batter"),
    batterSide: normalizeBatterSide(pickString(batSide, "code")),
    pitcher: pickString(pickRecord(matchup, "pitcher"), "fullName", "Current pitcher"),
    description: pickString(result, "description", pickString(result, "event")),
    balls: pickCount(count, "balls"),
    strikes: pickCount(count, "strikes"),
    outs: pickCount(count, "outs"),
  };
}

function normalizePitch(
  event: UnknownRecord,
  play: UnknownRecord,
  atBatIndex: number,
  eventIndex: number,
  sequence: number
): LivePitch {
  const details = pickRecord(event, "details");
  const pitchData = pickRecord(event, "pitchData");
  const coordinates = pickRecord(pitchData, "coordinates");
  const pitchType = pickRecord(details, "type");
  const matchup = pickRecord(play, "matchup");
  const batSide = pickRecord(matchup, "batSide");
  const count = pickRecord(event, "count");

  return {
    key: `${atBatIndex}-${eventIndex}`,
    sequence,
    atBatIndex,
    eventIndex,
    batter: pickString(pickRecord(matchup, "batter"), "fullName", "Batter"),
    batterSide: normalizeBatterSide(pickString(batSide, "code")),
    pitcher: pickString(pickRecord(matchup, "pitcher"), "fullName", "Pitcher"),
    pitchType: pickString(pitchType, "description", "Unknown"),
    pitchCode: pickString(pitchType, "code"),
    velocity: pickNumber(pitchData, "startSpeed"),
    outcome: pickString(details, "description", pickString(details, "event", "Pitch")),
    plateX: pickNumber(coordinates, "pX"),
    plateZ: pickNumber(coordinates, "pZ"),
    strikeZoneBottom: pickNumber(pitchData, "strikeZoneBottom"),
    strikeZoneTop: pickNumber(pitchData, "strikeZoneTop"),
    balls: pickCount(count, "balls"),
    strikes: pickCount(count, "strikes"),
    outs: pickCount(count, "outs"),
  };
}

export function normalizeLiveGame(data: unknown): LiveGameResponse {
  const root = asRecord(data);
  const gameData = pickRecord(root, "gameData");
  const liveData = pickRecord(root, "liveData");
  const gameTeams = pickRecord(gameData, "teams");
  const linescore = pickRecord(liveData, "linescore");
  const lineTeams = pickRecord(linescore, "teams");
  const plays = pickRecord(liveData, "plays");
  const allPlays = asArray(plays.allPlays).map(asRecord);
  const currentPlay = pickRecord(plays, "currentPlay");
  const pitchEvents: LivePitch[] = [];

  allPlays.forEach((play) => {
    const about = pickRecord(play, "about");
    const atBatIndex = pickCount(about, "atBatIndex") ?? pitchEvents.length;

    asArray(play.playEvents).forEach((event, eventIndex) => {
      const eventRecord = asRecord(event);

      if (eventRecord.isPitch !== true) {
        return;
      }

      pitchEvents.push(
        normalizePitch(eventRecord, play, atBatIndex, eventIndex, pitchEvents.length + 1)
      );
    });
  });

  return {
    gamePk: pickNumber(root, "gamePk") ?? 0,
    status: normalizeStatus(pickRecord(gameData, "status")),
    away: normalizeTeam(pickRecord(gameTeams, "away"), pickRecord(lineTeams, "away")),
    home: normalizeTeam(pickRecord(gameTeams, "home"), pickRecord(lineTeams, "home")),
    inning: formatInning(linescore),
    inningState: pickString(linescore, "inningState"),
    balls: pickCount(linescore, "balls"),
    strikes: pickCount(linescore, "strikes"),
    outs: pickCount(linescore, "outs"),
    currentAtBat: normalizeCurrentAtBat(currentPlay),
    latestPitch: pitchEvents[pitchEvents.length - 1] ?? null,
    recentPitches: pitchEvents.slice(-12),
    pitchCount: pitchEvents.length,
    updatedAt: new Date().toISOString(),
  };
}
