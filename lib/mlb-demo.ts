import type {
  BaseState,
  BatterSide,
  CurrentAtBat,
  LiveGameResponse,
  LivePitch,
  LivePlateAppearance,
  LivePollResponse,
  PlayerBattingSummary,
  PlayerPitchingSummary,
} from "@/lib/mlb-live";
import type { PlateOutcomeId } from "@/lib/plate-outcomes";

export const DEMO_GAME_SLUG = "demo";
const DEMO_GAME_PK = 0;
const PITCH_MS = 15000;
const BETWEEN_PA_MS = 2500;

type DemoTeamState = {
  awayScore: number;
  homeScore: number;
  bases: BaseState;
  outs: number;
};

type DemoPlay = {
  half: "Top" | "Bottom";
  batter: string;
  lineupSpot: number;
  batterSide: BatterSide;
  batterSummary: PlayerBattingSummary;
  pitcher: string;
  pitcherSummary: PlayerPitchingSummary;
  result: string;
  description: string;
  eventType: string;
  outcome: PlateOutcomeId;
  pitchCount: number;
  finalBalls: number;
  finalStrikes: number;
  before: DemoTeamState;
  after: DemoTeamState;
};

const emptyBases: BaseState = {
  first: false,
  second: false,
  third: false,
};

const runnerFirst: BaseState = {
  first: true,
  second: false,
  third: false,
};

const runnersSecondThird: BaseState = {
  first: false,
  second: true,
  third: true,
};

const runnerThird: BaseState = {
  first: false,
  second: false,
  third: true,
};

const giantsPitcher: PlayerPitchingSummary = {
  seasonLine: "3.36 ERA / 1.15 WHIP",
  today: "6.0 IP, 2 ER, 5 K, BB",
};

const piratesPitcher: PlayerPitchingSummary = {
  seasonLine: "3.87 ERA / 1.24 WHIP",
  today: "6.0 IP, 2 ER, 4 K, 2 BB",
};

const demoPlays: DemoPlay[] = [
  {
    half: "Top",
    batter: "Jung Hoo Lee",
    lineupSpot: 1,
    batterSide: "L",
    batterSummary: {
      slashLine: ".281/.342/.414",
      today: "1 for 3, R",
    },
    pitcher: "Mitch Keller",
    pitcherSummary: piratesPitcher,
    result: "Groundout",
    description: "Jung Hoo Lee grounds out, second baseman Nick Gonzales to first baseman Spencer Horwitz.",
    eventType: "field_out",
    outcome: "out",
    pitchCount: 3,
    finalBalls: 1,
    finalStrikes: 1,
    before: { awayScore: 2, homeScore: 2, bases: emptyBases, outs: 0 },
    after: { awayScore: 2, homeScore: 2, bases: emptyBases, outs: 1 },
  },
  {
    half: "Top",
    batter: "LaMonte Wade Jr.",
    lineupSpot: 2,
    batterSide: "L",
    batterSummary: {
      slashLine: ".263/.374/.421",
      today: "0 for 2, BB",
    },
    pitcher: "Mitch Keller",
    pitcherSummary: piratesPitcher,
    result: "Walk",
    description: "LaMonte Wade Jr. walks.",
    eventType: "walk",
    outcome: "walk",
    pitchCount: 5,
    finalBalls: 4,
    finalStrikes: 1,
    before: { awayScore: 2, homeScore: 2, bases: emptyBases, outs: 1 },
    after: { awayScore: 2, homeScore: 2, bases: runnerFirst, outs: 1 },
  },
  {
    half: "Top",
    batter: "Matt Chapman",
    lineupSpot: 3,
    batterSide: "R",
    batterSummary: {
      slashLine: ".247/.333/.463",
      today: "1 for 3, 2B",
    },
    pitcher: "Mitch Keller",
    pitcherSummary: piratesPitcher,
    result: "Double",
    description: "Matt Chapman doubles on a sharp line drive to left field. LaMonte Wade Jr. to 3rd.",
    eventType: "double",
    outcome: "extra_base",
    pitchCount: 4,
    finalBalls: 1,
    finalStrikes: 2,
    before: { awayScore: 2, homeScore: 2, bases: runnerFirst, outs: 1 },
    after: { awayScore: 2, homeScore: 2, bases: runnersSecondThird, outs: 1 },
  },
  {
    half: "Top",
    batter: "Heliot Ramos",
    lineupSpot: 4,
    batterSide: "R",
    batterSummary: {
      slashLine: ".269/.324/.447",
      today: "0 for 2, SF, RBI",
    },
    pitcher: "Mitch Keller",
    pitcherSummary: piratesPitcher,
    result: "Sac Fly",
    description: "Heliot Ramos hits a sacrifice fly to right fielder Bryan Reynolds. LaMonte Wade Jr. scores.",
    eventType: "sac_fly",
    outcome: "out",
    pitchCount: 2,
    finalBalls: 0,
    finalStrikes: 1,
    before: {
      awayScore: 2,
      homeScore: 2,
      bases: runnersSecondThird,
      outs: 1,
    },
    after: { awayScore: 3, homeScore: 2, bases: runnerThird, outs: 2 },
  },
  {
    half: "Top",
    batter: "Wilmer Flores",
    lineupSpot: 5,
    batterSide: "R",
    batterSummary: {
      slashLine: ".251/.314/.435",
      today: "1 for 3, K",
    },
    pitcher: "Mitch Keller",
    pitcherSummary: piratesPitcher,
    result: "Strikeout",
    description: "Wilmer Flores strikes out swinging.",
    eventType: "strikeout",
    outcome: "strikeout",
    pitchCount: 6,
    finalBalls: 2,
    finalStrikes: 3,
    before: { awayScore: 3, homeScore: 2, bases: runnerThird, outs: 2 },
    after: { awayScore: 3, homeScore: 2, bases: emptyBases, outs: 3 },
  },
  {
    half: "Bottom",
    batter: "Oneil Cruz",
    lineupSpot: 1,
    batterSide: "L",
    batterSummary: {
      slashLine: ".258/.329/.512",
      today: "1 for 2, BB",
    },
    pitcher: "Logan Webb",
    pitcherSummary: giantsPitcher,
    result: "Single",
    description: "Oneil Cruz singles on a ground ball to right field.",
    eventType: "single",
    outcome: "single",
    pitchCount: 3,
    finalBalls: 1,
    finalStrikes: 1,
    before: { awayScore: 3, homeScore: 2, bases: emptyBases, outs: 0 },
    after: { awayScore: 3, homeScore: 2, bases: runnerFirst, outs: 0 },
  },
  {
    half: "Bottom",
    batter: "Bryan Reynolds",
    lineupSpot: 2,
    batterSide: "S",
    batterSummary: {
      slashLine: ".276/.349/.481",
      today: "1 for 3, HR, 2 RBI",
    },
    pitcher: "Logan Webb",
    pitcherSummary: giantsPitcher,
    result: "Home Run",
    description: "Bryan Reynolds homers on a fly ball to right center field. Oneil Cruz scores.",
    eventType: "home_run",
    outcome: "home_run",
    pitchCount: 4,
    finalBalls: 2,
    finalStrikes: 1,
    before: { awayScore: 3, homeScore: 2, bases: runnerFirst, outs: 0 },
    after: { awayScore: 3, homeScore: 4, bases: emptyBases, outs: 0 },
  },
  {
    half: "Bottom",
    batter: "Ke'Bryan Hayes",
    lineupSpot: 3,
    batterSide: "R",
    batterSummary: {
      slashLine: ".263/.310/.392",
      today: "0 for 3",
    },
    pitcher: "Logan Webb",
    pitcherSummary: giantsPitcher,
    result: "Lineout",
    description: "Ke'Bryan Hayes lines out sharply to shortstop Willy Adames.",
    eventType: "field_out",
    outcome: "out",
    pitchCount: 2,
    finalBalls: 0,
    finalStrikes: 1,
    before: { awayScore: 3, homeScore: 4, bases: emptyBases, outs: 0 },
    after: { awayScore: 3, homeScore: 4, bases: emptyBases, outs: 1 },
  },
  {
    half: "Bottom",
    batter: "Andrew McCutchen",
    lineupSpot: 4,
    batterSide: "R",
    batterSummary: {
      slashLine: ".246/.338/.418",
      today: "2 for 3, R",
    },
    pitcher: "Logan Webb",
    pitcherSummary: giantsPitcher,
    result: "Single",
    description: "Andrew McCutchen singles on a line drive to center field.",
    eventType: "single",
    outcome: "single",
    pitchCount: 5,
    finalBalls: 2,
    finalStrikes: 2,
    before: { awayScore: 3, homeScore: 4, bases: emptyBases, outs: 1 },
    after: { awayScore: 3, homeScore: 4, bases: runnerFirst, outs: 1 },
  },
  {
    half: "Bottom",
    batter: "Spencer Horwitz",
    lineupSpot: 5,
    batterSide: "L",
    batterSummary: {
      slashLine: ".272/.357/.425",
      today: "0 for 3",
    },
    pitcher: "Logan Webb",
    pitcherSummary: giantsPitcher,
    result: "Fielder's Choice",
    description: "Spencer Horwitz reaches on a fielder's choice. Andrew McCutchen out at 2nd.",
    eventType: "fielders_choice",
    outcome: "reach",
    pitchCount: 3,
    finalBalls: 0,
    finalStrikes: 2,
    before: { awayScore: 3, homeScore: 4, bases: runnerFirst, outs: 1 },
    after: { awayScore: 3, homeScore: 4, bases: runnerFirst, outs: 2 },
  },
  {
    half: "Bottom",
    batter: "Joey Bart",
    lineupSpot: 6,
    batterSide: "R",
    batterSummary: {
      slashLine: ".244/.321/.437",
      today: "0 for 3, 2 K",
    },
    pitcher: "Logan Webb",
    pitcherSummary: giantsPitcher,
    result: "Strikeout",
    description: "Joey Bart strikes out looking.",
    eventType: "strikeout",
    outcome: "strikeout",
    pitchCount: 5,
    finalBalls: 1,
    finalStrikes: 3,
    before: { awayScore: 3, homeScore: 4, bases: runnerFirst, outs: 2 },
    after: { awayScore: 3, homeScore: 4, bases: emptyBases, outs: 3 },
  },
];

function activeMsFor(play: DemoPlay) {
  return Math.max(1, play.pitchCount) * PITCH_MS;
}

function slotMsFor(play: DemoPlay) {
  return activeMsFor(play) + BETWEEN_PA_MS;
}

const DEMO_LOOP_MS = demoPlays.reduce(
  (totalMs, play) => totalMs + slotMsFor(play),
  0
);

function visibleCount(play: DemoPlay, elapsedMs: number) {
  const pitchCount = Math.min(
    play.pitchCount - 1,
    Math.max(0, Math.floor(elapsedMs / PITCH_MS))
  );
  const progress = play.pitchCount <= 1 ? 0 : pitchCount / (play.pitchCount - 1);

  return {
    pitchCount,
    balls: Math.min(3, Math.round(Math.min(play.finalBalls, 3) * progress)),
    strikes: Math.min(
      2,
      Math.round(Math.min(play.finalStrikes, 2) * progress)
    ),
  };
}

function playTimingFor(loopElapsedMs: number) {
  let cursorMs = 0;

  for (let playIndex = 0; playIndex < demoPlays.length; playIndex += 1) {
    const slotMs = slotMsFor(demoPlays[playIndex]);

    if (loopElapsedMs < cursorMs + slotMs) {
      return {
        playIndex,
        playElapsedMs: loopElapsedMs - cursorMs,
      };
    }

    cursorMs += slotMs;
  }

  return {
    playIndex: demoPlays.length - 1,
    playElapsedMs: slotMsFor(demoPlays[demoPlays.length - 1]),
  };
}

function plateAppearanceFor(play: DemoPlay, atBatIndex: number): LivePlateAppearance {
  return {
    key: `demo-${atBatIndex}`,
    atBatIndex,
    inning: "7th",
    inningState: play.half,
    batter: play.batter,
    batterLineupSpot: play.lineupSpot,
    batterSide: play.batterSide,
    pitcher: play.pitcher,
    result: play.result,
    description: play.description,
    eventType: play.eventType,
    outcome: play.outcome,
    pitchCount: play.pitchCount,
    balls: play.finalBalls,
    strikes: play.finalStrikes,
    outs: play.after.outs,
  };
}

function livePitchFor(
  play: DemoPlay,
  atBatIndex: number,
  pitchCount: number,
  balls: number,
  strikes: number,
  outs: number
): LivePitch | null {
  if (pitchCount <= 0) {
    return null;
  }

  const pitchTypes = ["Sinker", "Slider", "Four-Seam Fastball", "Changeup"];

  return {
    key: `demo-${atBatIndex}-${pitchCount}`,
    sequence: atBatIndex,
    atBatIndex,
    eventIndex: pitchCount - 1,
    batter: play.batter,
    batterSide: play.batterSide,
    pitcher: play.pitcher,
    pitchType: pitchTypes[pitchCount % pitchTypes.length],
    pitchCode: "FF",
    velocity: 94 + (pitchCount % 3),
    outcome: balls > strikes ? "Ball" : "Called Strike",
    plateX: null,
    plateZ: null,
    strikeZoneBottom: null,
    strikeZoneTop: null,
    balls,
    strikes,
    outs,
  };
}

function currentAtBatFor(
  play: DemoPlay,
  atBatIndex: number,
  elapsedMs: number
): CurrentAtBat {
  const count = visibleCount(play, elapsedMs);

  return {
    atBatIndex,
    batter: play.batter,
    batterLineupSpot: play.lineupSpot,
    batterSide: play.batterSide,
    batterSummary: play.batterSummary,
    pitcher: play.pitcher,
    pitcherSummary: play.pitcherSummary,
    description: "",
    pitchCount: count.pitchCount,
    balls: count.balls,
    strikes: count.strikes,
    outs: play.before.outs,
    isComplete: false,
  };
}

function atBatIndexFor(cycle: number, playIndex: number) {
  return cycle * 100 + playIndex;
}

function buildDemoFeed(nowMs: number) {
  const cycle = Math.floor(nowMs / DEMO_LOOP_MS);
  const elapsed = nowMs % DEMO_LOOP_MS;
  const { playIndex, playElapsedMs } = playTimingFor(elapsed);
  const play = demoPlays[playIndex];
  const currentAtBatIndex = atBatIndexFor(cycle, playIndex);
  const playIsComplete = playElapsedMs >= activeMsFor(play);
  const count = visibleCount(play, playElapsedMs);
  const visibleState = playIsComplete ? play.after : play.before;
  const completedCount = playIndex + (playIsComplete ? 1 : 0);
  const completedPlateAppearances = demoPlays
    .slice(0, completedCount)
    .map((completedPlay, index) =>
      plateAppearanceFor(completedPlay, atBatIndexFor(cycle, index))
    );
  const latestPitch = playIsComplete
    ? livePitchFor(
        play,
        currentAtBatIndex,
        play.pitchCount,
        play.finalBalls,
        play.finalStrikes,
        play.after.outs
      )
    : livePitchFor(
        play,
        currentAtBatIndex,
        count.pitchCount,
        count.balls,
        count.strikes,
        play.before.outs
      );
  const timecode = `demo-${cycle}-${playIndex}-${
    playIsComplete ? "done" : `p${count.pitchCount}`
  }`;

  const feed: LiveGameResponse = {
    gamePk: DEMO_GAME_PK,
    status: {
      abstractGameState: "Live",
      detailedState: "Demo",
      isLive: true,
      isFinal: false,
      isPregame: false,
    },
    away: {
      id: 137,
      name: "San Francisco Giants",
      abbreviation: "SF",
      score: visibleState.awayScore,
    },
    home: {
      id: 134,
      name: "Pittsburgh Pirates",
      abbreviation: "PIT",
      score: visibleState.homeScore,
    },
    inning: "7th",
    inningState: play.half,
    bases: visibleState.bases,
    balls: playIsComplete ? play.finalBalls : count.balls,
    strikes: playIsComplete ? play.finalStrikes : count.strikes,
    outs: visibleState.outs,
    currentAtBat: playIsComplete
      ? null
      : currentAtBatFor(play, currentAtBatIndex, playElapsedMs),
    completedPlateAppearances,
    latestPitch,
    recentPitches: latestPitch ? [latestPitch] : [],
    pitchCount:
      completedPlateAppearances.reduce(
        (total, appearance) => total + appearance.pitchCount,
        0
      ) + (playIsComplete ? 0 : count.pitchCount),
    updatedAt: new Date(nowMs).toISOString(),
  };

  return { feed, timecode };
}

export function getDemoLivePoll(since: string | null): LivePollResponse {
  const checkedAt = new Date().toISOString();
  const { feed, timecode } = buildDemoFeed(Date.now());

  if (since !== null && since === timecode) {
    return {
      gamePk: DEMO_GAME_PK,
      changed: false,
      timecode,
      checkedAt,
      feed: null,
    };
  }

  return {
    gamePk: DEMO_GAME_PK,
    changed: true,
    timecode,
    checkedAt,
    feed,
  };
}
