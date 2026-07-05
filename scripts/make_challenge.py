from pybaseball import statcast
import pandas as pd
import json
from pathlib import Path

# Change these whenever you want a new challenge
START_DATE = "2024-06-05"
END_DATE = "2024-06-05"
BATTER_NAME_CONTAINS = "Ohtani"
PITCHER_NAME_CONTAINS = "Skenes"

OUTPUT_FILE = Path("../lib/samplePitches.ts")

PITCH_NAME_MAP = {
    "FF": "Four-Seam Fastball",
    "SI": "Sinker",
    "SL": "Slider",
    "CU": "Curveball",
    "KC": "Curveball",
    "CH": "Changeup",
    "FC": "Cutter",
    "FS": "Splitter",
    "ST": "Sweeper",
}


def scale_plate_x_to_screen(plate_x):
    # Statcast plate_x is feet from center of plate.
    # This maps roughly -2ft to +2ft into a 320px wide box.
    return round(((plate_x + 2) / 4) * 320)


def scale_plate_z_to_screen(plate_z):
    # Statcast plate_z is feet above ground.
    # This maps roughly 0ft to 5ft into a 384px tall box.
    # Higher pitches should appear higher on screen, so y is inverted.
    return round(384 - ((plate_z / 5) * 384))


def clean(value, fallback=""):
    if pd.isna(value):
        return fallback
    return value


print("Downloading Statcast data...")
df = statcast(START_DATE, END_DATE)

print(f"Downloaded {len(df)} pitches")

# player_name in pybaseball Statcast rows is usually pitcher name
df = df[
    df["player_name"].str.contains(PITCHER_NAME_CONTAINS, case=False, na=False)
]

# This does not always include readable batter name, so for now we filter pitcher first.
# We'll inspect output and improve batter filtering after first successful run.

if df.empty:
    raise SystemExit("No pitches found. Try a different date or pitcher name.")

# Find at-bats involving this pitcher.
# For first pass, choose the first at-bat in the result set.
df = df.sort_values(["game_pk", "at_bat_number", "pitch_number"])

challenge_at_bat = df.groupby(["game_pk", "at_bat_number"]).filter(
    lambda group: len(group) >= 3
)

if challenge_at_bat.empty:
    raise SystemExit("No at-bat with 3+ pitches found.")

first_game_pk = challenge_at_bat.iloc[0]["game_pk"]
first_ab = challenge_at_bat.iloc[0]["at_bat_number"]

ab = challenge_at_bat[
    (challenge_at_bat["game_pk"] == first_game_pk)
    & (challenge_at_bat["at_bat_number"] == first_ab)
].copy()

pitches = []

for idx, row in ab.iterrows():
    pitch_type = clean(row.get("pitch_type"), "Unknown")
    pitch_name = PITCH_NAME_MAP.get(pitch_type, pitch_type)

    balls = int(clean(row.get("balls"), 0))
    strikes = int(clean(row.get("strikes"), 0))

    inning_half = clean(row.get("inning_topbot"), "")
    inning = clean(row.get("inning"), "")

    pitches.append(
        {
            "id": len(pitches) + 1,
            "inning": f"{inning_half} {inning}",
            "outs": int(clean(row.get("outs_when_up"), 0)),
            "count": f"{balls}-{strikes}",
            "awayTeam": clean(row.get("away_team"), ""),
            "awayScore": int(clean(row.get("away_score"), 0)),
            "homeTeam": clean(row.get("home_team"), ""),
            "homeScore": int(clean(row.get("home_score"), 0)),
            "pitcher": clean(row.get("player_name"), "Unknown Pitcher"),
            "batter": f"Batter {int(clean(row.get('batter'), 0))}",
            "pitchType": pitch_name,
            "velocity": round(float(clean(row.get("release_speed"), 0))),
            "outcome": clean(row.get("description"), ""),
            "x": scale_plate_x_to_screen(float(clean(row.get("plate_x"), 0))),
            "y": scale_plate_z_to_screen(float(clean(row.get("plate_z"), 2.5))),
        }
    )

ts = """export type Pitch = {
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

export const samplePitches: Pitch[] = """

ts += json.dumps(pitches, indent=2)
ts += ";\n"

OUTPUT_FILE.write_text(ts)

print(f"Wrote {len(pitches)} pitches to {OUTPUT_FILE}")
print("Done.")