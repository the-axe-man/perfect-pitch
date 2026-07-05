export type Pitch = {
  id: number;
  inning: string;
  outs: number;
  count: string;
  awayTeam: string;
  awayScore: number;
  homeTeam: string;
  homeScore: number;
  pitcher: string;
  batter: string;
  pitchType: string;
  velocity: number;
  outcome: string;
  x: number;
  y: number;
};

export const samplePitches: Pitch[] = [
  {
    "id": 1,
    "inning": "Top 1",
    "outs": 0,
    "count": "0-0",
    "awayTeam": "LAD",
    "awayScore": 0,
    "homeTeam": "PIT",
    "homeScore": 0,
    "pitcher": "Skenes, Paul",
    "batter": "Batter 605141",
    "pitchType": "Four-Seam Fastball",
    "velocity": 101,
    "outcome": "called_strike",
    "x": 126,
    "y": 266
  },
  {
    "id": 2,
    "inning": "Top 1",
    "outs": 0,
    "count": "0-1",
    "awayTeam": "LAD",
    "awayScore": 0,
    "homeTeam": "PIT",
    "homeScore": 0,
    "pitcher": "Skenes, Paul",
    "batter": "Batter 605141",
    "pitchType": "Four-Seam Fastball",
    "velocity": 101,
    "outcome": "swinging_strike",
    "x": 135,
    "y": 158
  },
  {
    "id": 3,
    "inning": "Top 1",
    "outs": 0,
    "count": "0-2",
    "awayTeam": "LAD",
    "awayScore": 0,
    "homeTeam": "PIT",
    "homeScore": 0,
    "pitcher": "Skenes, Paul",
    "batter": "Batter 605141",
    "pitchType": "Four-Seam Fastball",
    "velocity": 100,
    "outcome": "ball",
    "x": 200,
    "y": 88
  },
  {
    "id": 4,
    "inning": "Top 1",
    "outs": 0,
    "count": "1-2",
    "awayTeam": "LAD",
    "awayScore": 0,
    "homeTeam": "PIT",
    "homeScore": 0,
    "pitcher": "Skenes, Paul",
    "batter": "Batter 605141",
    "pitchType": "Sweeper",
    "velocity": 85,
    "outcome": "swinging_strike",
    "x": 268,
    "y": 152
  }
];
