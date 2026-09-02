import { defaultScheduleDate, fetchMlbSchedule } from "@/lib/mlb-schedule";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedDate = url.searchParams.get("date") ?? defaultScheduleDate();

  try {
    const schedule = await fetchMlbSchedule(requestedDate);

    return Response.json(schedule, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to load MLB schedule." },
      {
        status: 504,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
