import { normalizeLiveGame } from "@/lib/mlb-live";

export const dynamic = "force-dynamic";

const LIVE_FIELDS = [
  "gamePk",
  "gameData",
  "status",
  "abstractGameState",
  "detailedState",
  "teams",
  "away",
  "home",
  "name",
  "abbreviation",
  "liveData",
  "linescore",
  "currentInning",
  "currentInningOrdinal",
  "inningState",
  "balls",
  "strikes",
  "outs",
  "runs",
  "plays",
  "allPlays",
  "currentPlay",
  "about",
  "atBatIndex",
  "result",
  "event",
  "eventType",
  "description",
  "matchup",
  "batter",
  "fullName",
  "pitcher",
  "playEvents",
  "details",
  "code",
  "type",
  "isPitch",
  "pitchData",
  "startSpeed",
  "coordinates",
  "pX",
  "pZ",
  "count",
].join(",");

async function getLatestTimecode(gamePk: string) {
  const timestampsUrl = new URL(
    `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/timestamps`
  );

  const response = await fetch(timestampsUrl, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    return "";
  }

  const timecodes = data.filter(
    (value): value is string => typeof value === "string"
  );

  return timecodes[timecodes.length - 1] ?? "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gamePk: string }> }
) {
  const { gamePk } = await params;

  if (!/^\d+$/.test(gamePk)) {
    return Response.json({ error: "Invalid game id." }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const since = requestUrl.searchParams.get("since");
  const latestTimecode = await getLatestTimecode(gamePk);
  const checkedAt = new Date().toISOString();

  if (latestTimecode !== null && since !== null && latestTimecode === since) {
    return Response.json(
      {
        gamePk: Number(gamePk),
        changed: false,
        timecode: latestTimecode,
        checkedAt,
        feed: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const liveUrl = new URL(
    `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
  );

  liveUrl.searchParams.set("fields", LIVE_FIELDS);

  if (latestTimecode) {
    liveUrl.searchParams.set("timecode", latestTimecode);
  }

  const response = await fetch(liveUrl, { cache: "no-store" });

  if (!response.ok) {
    return Response.json(
      { error: "Unable to load MLB game feed." },
      { status: response.status }
    );
  }

  const data: unknown = await response.json();
  const feed = normalizeLiveGame(data);

  return Response.json(
    {
      gamePk: feed.gamePk,
      changed: true,
      timecode: latestTimecode ?? "",
      checkedAt,
      feed,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
