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
    id: 1,
    inning: "2nd",
    outs: 1,
    count: "0-0",
    awayTeam: "DET",
    awayScore: 0,
    homeTeam: "HOU",
    homeScore: 4,
    pitcher: "Framber Valdez",
    batter: "Jose Altuve",
    pitchType: "Curveball",
    velocity: 86,
    outcome: "Called Strike",
    x: 250,
    y: 210,
  },
  {
    id: 2,
    inning: "2nd",
    outs: 1,
    count: "0-1",
    awayTeam: "DET",
    awayScore: 0,
    homeTeam: "HOU",
    homeScore: 4,
    pitcher: "Framber Valdez",
    batter: "Jose Altuve",
    pitchType: "Sinker",
    velocity: 94,
    outcome: "Ball",
    x: 150,
    y: 250,
  },
  {
    id: 3,
    inning: "2nd",
    outs: 1,
    count: "1-1",
    awayTeam: "DET",
    awayScore: 0,
    homeTeam: "HOU",
    homeScore: 4,
    pitcher: "Framber Valdez",
    batter: "Jose Altuve",
    pitchType: "Curveball",
    velocity: 86,
    outcome: "Swinging Strike",
    x: 275,
    y: 310,
  },
  {
    id: 4,
    inning: "2nd",
    outs: 1,
    count: "1-2",
    awayTeam: "DET",
    awayScore: 0,
    homeTeam: "HOU",
    homeScore: 4,
    pitcher: "Framber Valdez",
    batter: "Jose Altuve",
    pitchType: "Curveball",
    velocity: 85,
    outcome: "Swinging Strike, K",
    x: 300,
    y: 335,
  },
];