import LiveGamesClient from "./LiveGamesClient";
import { defaultScheduleDate, fetchMlbSchedule } from "@/lib/mlb-schedule";
import type { ScheduleResponse } from "@/lib/mlb-live";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const initialDate = defaultScheduleDate();
  let initialSchedule: ScheduleResponse | null = null;
  let initialError = "";

  try {
    initialSchedule = await fetchMlbSchedule(initialDate);
  } catch {
    initialError = "Could not load games.";
  }

  return (
    <LiveGamesClient
      initialDate={initialDate}
      initialSchedule={initialSchedule}
      initialError={initialError}
    />
  );
}
