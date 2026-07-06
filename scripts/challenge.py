from pybaseball import statcast, playerid_reverse_lookup
import pandas as pd
import json
from pathlib import Path

START_DATE = "2024-06-05"
END_DATE = "2024-06-05"
PITCHER_NAME_CONTAINS = "Skenes"

OUTPUT_DIR = Path("../challenges")

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

OUTCOME_MAP = {
    "swinging_strike": "Swinging Strike",
    "called_strike": "Called Strike",
    "ball": "Ball",
    "foul": "Foul",
    "hit_into_play": "In Play",
    "blocked_ball": "Blocked Ball",
    "foul_tip": "Foul Tip",
    "hit_by_pitch": "Hit By Pitch",
}


def clean(value, fallback=""):
    if pd.isna(value):
        return fallback
    return value


def safe_int(value, fallback=0):
    try:
        if pd.isna(value):
            return fallback
        return int(value)
    except Exception:
        return fallback


def safe_float(value, fallback=0):
    try:
        if pd.isna(value):
            return fallback
        return float(value)
    except Exception:
        return fallback


def slugify(text):
    return (
        text.lower()
        .replace(" ", "-")
        .replace(".", "")
        .replace(",", "")
        .replace("'", "")
    )


PLAYER_NAME_CACHE = {}


def get_player_name(mlbam_id):
    player_id = safe_int(mlbam_id)

    if player_id in PLAYER_NAME_CACHE:
        return PLAYER_NAME_CACHE[player_id]

    try:
        player = playerid_reverse_lookup([player_id], key_type="mlbam")

        if len(player):
            first = player.iloc[0]["name_first"].title()
            last = player.iloc[0]["name_last"].title()
            name = f"{first} {last}"
            PLAYER_NAME_CACHE[player_id] = name
            return name

    except Exception:
        pass

    fallback = f"Player {player_id}"
    PLAYER_NAME_CACHE[player_id] = fallback
    return fallback


def format_outcome(description):
    description = clean(description)
    return OUTCOME_MAP.get(description, description.replace("_", " ").title())


print("Downloading Statcast data...")
df = statcast(START_DATE, END_DATE)
print(f"Downloaded {len(df)} pitches")

df = df[df["player_name"].str.contains(PITCHER_NAME_CONTAINS, case=False, na=False)]

if df.empty:
    raise SystemExit("No pitches found. Try a different pitcher or date.")

df = df.sort_values(["game_pk", "at_bat_number", "pitch_number"])

groups = []

for (game_pk, at_bat_number), group in df.groupby(["game_pk", "at_bat_number"]):
    if len(group) < 3:
        continue

    first = group.iloc[0]
    batter_id = safe_int(first.get("batter"))
    batter_name = get_player_name(batter_id)
    pitcher_name = clean(first.get("player_name"), "Unknown Pitcher")

    groups.append(
        {
            "game_pk": game_pk,
            "at_bat_number": at_bat_number,
            "pitch_count": len(group),
            "pitcher": pitcher_name,
            "batter_id": batter_id,
            "batter": batter_name,
            "inning": f"{clean(first.get('inning_topbot'))} {clean(first.get('inning'))}",
            "outs": safe_int(first.get("outs_when_up")),
            "away_team": clean(first.get("away_team")),
            "home_team": clean(first.get("home_team")),
            "group": group,
        }
    )

if not groups:
    raise SystemExit("No at-bats with 3+ pitches found.")

print("\nAvailable at-bats:\n")

for index, item in enumerate(groups, start=1):
    print(
        f"{index}. {item['batter']} vs {item['pitcher']} · "
        f"{item['away_team']} @ {item['home_team']} · "
        f"{item['inning']} · {item['outs']} outs · "
        f"{item['pitch_count']} pitches"
    )

choice = input("\nChoose an at-bat number: ").strip()
choice_index = int(choice) - 1

if choice_index < 0 or choice_index >= len(groups):
    raise SystemExit("Invalid at-bat selection.")

selected = groups[choice_index]
ab = selected["group"]

challenge = {
    "id": f"{selected['game_pk']}-{selected['at_bat_number']}",
    "title": f"{selected['batter']} vs {selected['pitcher']}",
    "date": START_DATE,
    "description": f"{selected['inning']} • {selected['away_team']} at {selected['home_team']}",
    "difficulty": "Hard",
    "gamePk": safe_int(selected["game_pk"]),
    "atBatNumber": safe_int(selected["at_bat_number"]),
    "pitches": [],
}

for _, row in ab.iterrows():
    pitch_code = clean(row.get("pitch_type"), "Unknown")
    pitch_name = PITCH_NAME_MAP.get(pitch_code, pitch_code)

    balls = safe_int(row.get("balls"))
    strikes = safe_int(row.get("strikes"))
    batter_id = safe_int(row.get("batter"))

    challenge["pitches"].append(
        {
            "id": len(challenge["pitches"]) + 1,
            "inning": f"{clean(row.get('inning_topbot'))} {clean(row.get('inning'))}",
            "outs": safe_int(row.get("outs_when_up")),
            "count": f"{balls}-{strikes}",
            "awayTeam": clean(row.get("away_team")),
            "awayScore": safe_int(row.get("away_score")),
            "homeTeam": clean(row.get("home_team")),
            "homeScore": safe_int(row.get("home_score")),
            "pitcher": clean(row.get("player_name"), "Unknown Pitcher"),
            "batter": get_player_name(batter_id),
            "pitchType": pitch_name,
            "velocity": round(safe_float(row.get("release_speed"))),
            "outcome": format_outcome(row.get("description")),
            "plateX": safe_float(row.get("plate_x")),
            "plateZ": safe_float(row.get("plate_z")),
        }
    )

OUTPUT_DIR.mkdir(exist_ok=True)

filename = f"{slugify(challenge['title'])}-{challenge['id']}.json"
output_path = OUTPUT_DIR / filename

output_path.write_text(json.dumps(challenge, indent=2))

print(f"\nWrote challenge to {output_path}")
print("Done.")