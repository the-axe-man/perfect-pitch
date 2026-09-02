import { normalizeSchedule } from "@/lib/mlb-live";

export const dynamic = "force-dynamic";

const SCHEDULE_FIELDS = [
  "dates",
  "date",
  "games",
  "gamePk",
  "gameDate",
  "status",
  "abstractGameState",
  "detailedState",
  "teams",
  "away",
  "home",
  "team",
  "name",
  "abbreviation",
  "score",
  "linescore",
  "currentInning",
  "currentInningOrdinal",
  "inningState",
  "balls",
  "strikes",
  "outs",
  "runs",
].join(",");

function defaultScheduleDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date") ?? defaultScheduleDate();
  const scheduleUrl = new URL("https://statsapi.mlb.com/api/v1/schedule");

  scheduleUrl.searchParams.set("sportId", "1");
  scheduleUrl.searchParams.set("date", requestedDate);
  scheduleUrl.searchParams.set("hydrate", "team,linescore,status");
  scheduleUrl.searchParams.set("fields", SCHEDULE_FIELDS);

  const response = await fetch(scheduleUrl, { cache: "no-store" });

  if (!response.ok) {
    return Response.json(
      { error: "Unable to load MLB schedule." },
      { status: response.status }
    );
  }

  const data: unknown = await response.json();

  return Response.json(normalizeSchedule(data, requestedDate), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
