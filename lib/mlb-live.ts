import {
  categorizePlateOutcome,
  type PlateOutcomeId,
} from "@/lib/plate-outcomes";

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
  batterSummary: PlayerBattingSummary | null;
  pitcher: string;
  pitcherSummary: PlayerPitchingSummary | null;
  description: string;
  pitchCount: number;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
  isComplete: boolean;
};

export type BaseState = {
  first: boolean;
  second: boolean;
  third: boolean;
};

export type LivePlateAppearance = {
  key: string;
  atBatIndex: number;
  batter: string;
  batterSide: BatterSide;
  pitcher: string;
  result: string;
  description: string;
  eventType: string;
  outcome: PlateOutcomeId;
  pitchCount: number;
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
  bases: BaseState;
  balls: number | null;
  strikes: number | null;
  outs: number | null;
  currentAtBat: CurrentAtBat | null;
  completedPlateAppearances: LivePlateAppearance[];
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

export type PlayerBattingSummary = {
  slashLine: string;
  today: string;
};

export type PlayerPitchingSummary = {
  seasonLine: string;
  today: string;
};

type PlayerGameSummary = {
  batting: PlayerBattingSummary | null;
  pitching: PlayerPitchingSummary | null;
};

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

function normalizeBases(linescore: UnknownRecord): BaseState {
  const offense = pickRecord(linescore, "offense");

  return {
    first: Object.keys(pickRecord(offense, "first")).length > 0,
    second: Object.keys(pickRecord(offense, "second")).length > 0,
    third: Object.keys(pickRecord(offense, "third")).length > 0,
  };
}

function formatCountedStat(count: number | null, label: string) {
  if (!count) {
    return "";
  }

  return count === 1 ? label : `${count} ${label}`;
}

function statText(source: UnknownRecord, key: string) {
  const value = source[key];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function normalizeBattingSummary(
  stats: UnknownRecord,
  seasonStats: UnknownRecord
): PlayerBattingSummary | null {
  const batting = pickRecord(stats, "batting");
  const seasonBatting = pickRecord(seasonStats, "batting");
  const avg = statText(seasonBatting, "avg");
  const obp = statText(seasonBatting, "obp");
  const slg = statText(seasonBatting, "slg");
  const slashLine = avg && obp && slg ? `${avg}/${obp}/${slg}` : "";

  const hits = pickCount(batting, "hits");
  const atBats = pickCount(batting, "atBats");
  const parts = [
    hits !== null || atBats !== null ? `${hits ?? 0} for ${atBats ?? 0}` : "",
    formatCountedStat(pickCount(batting, "homeRuns"), "HR"),
    formatCountedStat(pickCount(batting, "triples"), "3B"),
    formatCountedStat(pickCount(batting, "doubles"), "2B"),
    formatCountedStat(pickCount(batting, "baseOnBalls"), "BB"),
    formatCountedStat(pickCount(batting, "hitByPitch"), "HBP"),
    formatCountedStat(pickCount(batting, "runs"), "R"),
    formatCountedStat(pickCount(batting, "rbi"), "RBI"),
    formatCountedStat(pickCount(batting, "strikeOuts"), "K"),
    formatCountedStat(pickCount(batting, "stolenBases"), "SB"),
  ].filter(Boolean);

  const today = parts.join(", ");

  if (!slashLine && !today) {
    return null;
  }

  return {
    slashLine,
    today,
  };
}

function normalizePitchingSummary(
  stats: UnknownRecord,
  seasonStats: UnknownRecord
): PlayerPitchingSummary | null {
  const pitching = pickRecord(stats, "pitching");
  const seasonPitching = pickRecord(seasonStats, "pitching");
  const era = statText(seasonPitching, "era");
  const whip = statText(seasonPitching, "whip");
  const seasonLine = [era ? `${era} ERA` : "", whip ? `${whip} WHIP` : ""]
    .filter(Boolean)
    .join(" / ");
  const inningsPitched = statText(pitching, "inningsPitched");
  const parts = [
    inningsPitched ? `${inningsPitched} IP` : "",
    formatCountedStat(pickCount(pitching, "earnedRuns"), "ER"),
    formatCountedStat(pickCount(pitching, "strikeOuts"), "K"),
    formatCountedStat(pickCount(pitching, "baseOnBalls"), "BB"),
    formatCountedStat(pickCount(pitching, "hits"), "H"),
  ].filter(Boolean);
  const today = parts.join(", ");

  if (!seasonLine && !today) {
    return null;
  }

  return {
    seasonLine,
    today,
  };
}

function normalizePlayerSummaries(liveData: UnknownRecord) {
  const summaries = new Map<number, PlayerGameSummary>();
  const boxscore = pickRecord(liveData, "boxscore");
  const teams = pickRecord(boxscore, "teams");
  const teamEntries = [pickRecord(teams, "away"), pickRecord(teams, "home")];

  teamEntries.forEach((teamEntry) => {
    const players = pickRecord(teamEntry, "players");

    Object.values(players).forEach((playerValue) => {
      const player = asRecord(playerValue);
      const person = pickRecord(player, "person");
      const id = pickCount(person, "id");

      if (id === null) {
        return;
      }

      summaries.set(id, {
        batting: normalizeBattingSummary(
          pickRecord(player, "stats"),
          pickRecord(player, "seasonStats")
        ),
        pitching: normalizePitchingSummary(
          pickRecord(player, "stats"),
          pickRecord(player, "seasonStats")
        ),
      });
    });
  });

  return summaries;
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

function normalizeCurrentAtBat(
  play: UnknownRecord,
  playerSummaries: Map<number, PlayerGameSummary>
): CurrentAtBat | null {
  if (!Object.keys(play).length) {
    return null;
  }

  const matchup = pickRecord(play, "matchup");
  const batter = pickRecord(matchup, "batter");
  const pitcher = pickRecord(matchup, "pitcher");
  const batterId = pickCount(batter, "id");
  const pitcherId = pickCount(pitcher, "id");
  const batSide = pickRecord(matchup, "batSide");
  const result = pickRecord(play, "result");
  const count = pickRecord(play, "count");
  const about = pickRecord(play, "about");
  const playEvents = asArray(play.playEvents).map(asRecord);

  return {
    atBatIndex: pickCount(about, "atBatIndex") ?? 0,
    batter: pickString(batter, "fullName", "Current batter"),
    batterSide: normalizeBatterSide(pickString(batSide, "code")),
    batterSummary:
      batterId === null ? null : playerSummaries.get(batterId)?.batting ?? null,
    pitcher: pickString(pitcher, "fullName", "Current pitcher"),
    pitcherSummary:
      pitcherId === null ? null : playerSummaries.get(pitcherId)?.pitching ?? null,
    description: pickString(result, "description", pickString(result, "event")),
    pitchCount: playEvents.filter((event) => event.isPitch === true).length,
    balls: pickCount(count, "balls"),
    strikes: pickCount(count, "strikes"),
    outs: pickCount(count, "outs"),
    isComplete: playIsComplete(play),
  };
}

function playIsComplete(play: UnknownRecord) {
  const about = pickRecord(play, "about");

  return about.isComplete === true;
}

function normalizePlateAppearance(play: UnknownRecord): LivePlateAppearance | null {
  const about = pickRecord(play, "about");
  const result = pickRecord(play, "result");
  const matchup = pickRecord(play, "matchup");
  const batSide = pickRecord(matchup, "batSide");
  const count = pickRecord(play, "count");
  const atBatIndex = pickCount(about, "atBatIndex");
  const eventType = pickString(result, "eventType");
  const resultLabel = pickString(result, "event", pickString(result, "description"));
  const description = pickString(result, "description", resultLabel);

  if (atBatIndex === null || !eventType) {
    return null;
  }

  return {
    key: String(atBatIndex),
    atBatIndex,
    batter: pickString(pickRecord(matchup, "batter"), "fullName", "Batter"),
    batterSide: normalizeBatterSide(pickString(batSide, "code")),
    pitcher: pickString(pickRecord(matchup, "pitcher"), "fullName", "Pitcher"),
    result: resultLabel || "Plate appearance complete",
    description,
    eventType,
    outcome: categorizePlateOutcome(eventType),
    pitchCount: asArray(play.playEvents).filter(
      (event) => asRecord(event).isPitch === true
    ).length,
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
  const playerSummaries = normalizePlayerSummaries(liveData);
  const plays = pickRecord(liveData, "plays");
  const allPlays = asArray(plays.allPlays).map(asRecord);
  const currentPlay = pickRecord(plays, "currentPlay");
  const pitchEvents: LivePitch[] = [];
  const completedPlateAppearances = allPlays
    .filter(playIsComplete)
    .map(normalizePlateAppearance)
    .filter(
      (appearance): appearance is LivePlateAppearance => appearance !== null
    );

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
    bases: normalizeBases(linescore),
    balls: pickCount(linescore, "balls"),
    strikes: pickCount(linescore, "strikes"),
    outs: pickCount(linescore, "outs"),
    currentAtBat: normalizeCurrentAtBat(currentPlay, playerSummaries),
    completedPlateAppearances,
    latestPitch: pitchEvents[pitchEvents.length - 1] ?? null,
    recentPitches: pitchEvents.slice(-12),
    pitchCount: pitchEvents.length,
    updatedAt: new Date().toISOString(),
  };
}
