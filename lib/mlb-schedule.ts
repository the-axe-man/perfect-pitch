import { normalizeSchedule } from "@/lib/mlb-live";

const SCHEDULE_TIMEOUT_MS = 8000;

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

export function defaultScheduleDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function fetchMlbSchedule(requestedDate: string) {
  const scheduleUrl = new URL("https://statsapi.mlb.com/api/v1/schedule");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCHEDULE_TIMEOUT_MS);

  scheduleUrl.searchParams.set("sportId", "1");
  scheduleUrl.searchParams.set("date", requestedDate);
  scheduleUrl.searchParams.set("hydrate", "team,linescore,status");
  scheduleUrl.searchParams.set("fields", SCHEDULE_FIELDS);

  try {
    const response = await fetch(scheduleUrl, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Unable to load MLB schedule: ${response.status}`);
    }

    const data: unknown = await response.json();

    return normalizeSchedule(data, requestedDate);
  } finally {
    clearTimeout(timeout);
  }
}
