"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleGame, ScheduleResponse } from "@/lib/mlb-live";

function dateInNewYork() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatStartTime(value: string) {
  if (!value) {
    return "Time TBD";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusTone(game: ScheduleGame) {
  if (game.status.isLive) {
    return "border-[#dcff00] bg-[#dcff00] text-[#17191b]";
  }

  if (game.status.isFinal) {
    return "border-[#596068] bg-[#33373c] text-[#a0a4aa]";
  }

  return "border-[#444a50] bg-[#202225] text-[#c9ccd0]";
}

function countLabel(game: ScheduleGame) {
  const parts = [game.balls, game.strikes, game.outs].map((value) =>
    value === null ? "-" : String(value)
  );

  return `${parts[0]}-${parts[1]}, ${parts[2]} out`;
}

function GameCard({ game }: { game: ScheduleGame }) {
  const content = (
    <article className="h-full rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition group-hover:-translate-y-0.5 group-hover:border-[#596068] group-hover:bg-[#2f3337]">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${statusTone(
            game
          )}`}
        >
          {game.status.isLive ? "Live" : game.status.detailedState}
        </span>
        <span className="text-sm font-medium text-[#a0a4aa]">
          {formatStartTime(game.gameDate)}
        </span>
      </div>

      <div className="mt-6 grid gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#747a81]">
              Away
            </p>
            <p className="mt-1 text-3xl font-medium">{game.away.abbreviation}</p>
          </div>
          <p className="text-4xl font-medium text-[#f5f5f1]">
            {game.away.score ?? "-"}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-[#3c4147] pt-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#747a81]">
              Home
            </p>
            <p className="mt-1 text-3xl font-medium">{game.home.abbreviation}</p>
          </div>
          <p className="text-4xl font-medium text-[#f5f5f1]">
            {game.home.score ?? "-"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#3c4147] pt-4 text-sm text-[#a0a4aa]">
        <span>
          {game.inningState && game.inning
            ? `${game.inningState} ${game.inning}`
            : game.status.isPregame
              ? "Pregame"
              : game.status.detailedState}
        </span>
        <span>{game.status.isLive ? countLabel(game) : "Open feed"}</span>
      </div>
    </article>
  );

  if (game.status.isFinal) {
    return <div>{content}</div>;
  }

  return (
    <Link href={`/live/${game.gamePk}`} className="group block h-full">
      {content}
    </Link>
  );
}

export default function LivePage() {
  const [date, setDate] = useState(dateInNewYork);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function updateDate(nextDate: string) {
    setLoading(true);
    setSchedule(null);
    setDate(nextDate);
  }

  const loadSchedule = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`/api/mlb/schedule?date=${date}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Schedule unavailable");
      }

      const data = (await response.json()) as ScheduleResponse;
      setSchedule(data);
    } catch {
      setError("Could not load games.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSchedule();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSchedule]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSchedule();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadSchedule]);

  const liveCount = useMemo(
    () => schedule?.games.filter((game) => game.status.isLive).length ?? 0,
    [schedule]
  );

  return (
    <main className="min-h-screen bg-[#202225] px-5 py-6 text-[#f5f5f1] sm:px-8 sm:py-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-5 border-b border-[#3c4147] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium uppercase tracking-[0.16em] text-[#a0a4aa] transition hover:text-[#dcff00]"
            >
              Perfect Pitch
            </Link>
            <h1 className="mt-3 text-4xl font-medium sm:text-6xl">Live Games</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => updateDate(shiftDate(date, -1))}
              className="h-10 rounded-xl border border-[#444a50] bg-[#292c30] px-3 text-sm font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
            >
              Prev
            </button>
            <input
              aria-label="Schedule date"
              type="date"
              value={date}
              onChange={(event) => {
                if (event.target.value) {
                  updateDate(event.target.value);
                }
              }}
              className="h-10 rounded-xl border border-[#444a50] bg-[#292c30] px-3 text-sm font-medium text-[#f5f5f1] outline-none transition focus:border-[#dcff00]"
            />
            <button
              onClick={() => updateDate(shiftDate(date, 1))}
              className="h-10 rounded-xl border border-[#444a50] bg-[#292c30] px-3 text-sm font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
            >
              Next
            </button>
            <button
              onClick={() => void loadSchedule()}
              className="h-10 rounded-xl bg-[#dcff00] px-4 text-sm font-medium text-[#17191b] shadow-[0_3px_0_#91a800] transition hover:bg-[#c8e900] active:translate-y-[2px] active:shadow-[0_1px_0_#91a800]"
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#a0a4aa]">
          <p>
            <span className="font-medium text-[#dcff00]">{liveCount}</span> live
            now
          </p>
          <Link
            href="/"
            className="font-medium text-[#c9ccd0] transition hover:text-[#dcff00]"
          >
            Classic challenges
          </Link>
        </div>

        {error && (
          <div className="rounded-[20px] border border-[#7a3b3b] bg-[#332626] p-4 text-[#f5c7c7]">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[244px] animate-pulse rounded-[24px] border border-[#3c4147] bg-[#292c30]"
              />
            ))}
          </div>
        )}

        {!loading && schedule && schedule.games.length === 0 && (
          <div className="rounded-[24px] border border-[#444a50] bg-[#292c30] p-8 text-center text-[#a0a4aa]">
            No MLB games found for this date.
          </div>
        )}

        {!loading && schedule && schedule.games.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schedule.games.map((game) => (
              <GameCard key={game.gamePk} game={game} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
