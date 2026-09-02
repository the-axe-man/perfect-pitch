"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleGame, ScheduleResponse } from "@/lib/mlb-live";

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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatScheduleDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatUpdatedAt(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function statusTone(game: ScheduleGame) {
  if (game.status.isLive) {
    return "border-[#dcff00] bg-[#dcff00] text-[#17191b]";
  }

  if (game.status.isFinal) {
    return "border-[#5c6670] bg-[#2f353c] text-[#aeb6bf]";
  }

  return "border-[#3d454e] bg-[#191b1f] text-[#aeb6bf]";
}

function countLabel(game: ScheduleGame) {
  const parts = [game.balls, game.strikes, game.outs].map((value) =>
    value === null ? "-" : String(value)
  );

  return `${parts[0]}-${parts[1]}, ${parts[2]} out`;
}

function GameCard({ game }: { game: ScheduleGame }) {
  const content = (
    <article className="h-full rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition group-hover:-translate-y-0.5 group-hover:border-[#5c6670]">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-lg border px-3 py-1 text-[11px] font-semibold uppercase ${statusTone(
            game
          )}`}
        >
          {game.status.isLive ? "Live" : game.status.detailedState}
        </span>
        <span className="text-sm font-medium text-[#aeb6bf]">
          {formatStartTime(game.gameDate)}
        </span>
      </div>

      <div className="mt-6 grid gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#87919c]">
              Away
            </p>
            <p className="mt-1 text-3xl font-semibold">{game.away.abbreviation}</p>
          </div>
          <p className="text-4xl font-semibold text-[#f6f7f2]">
            {game.away.score ?? "-"}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-[#3d454e] pt-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#87919c]">
              Home
            </p>
            <p className="mt-1 text-3xl font-semibold">{game.home.abbreviation}</p>
          </div>
          <p className="text-4xl font-semibold text-[#f6f7f2]">
            {game.home.score ?? "-"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#3d454e] pt-4 text-sm text-[#aeb6bf]">
        <span>
          {game.inningState && game.inning
            ? `${game.inningState} ${game.inning}`
            : game.status.isPregame
              ? "Pregame"
              : game.status.detailedState}
        </span>
        <span>{game.status.isLive ? countLabel(game) : "Open calls"}</span>
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

export default function LiveGamesClient({
  initialDate,
  initialSchedule,
  initialError = "",
}: {
  initialDate: string;
  initialSchedule: ScheduleResponse | null;
  initialError?: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(
    initialSchedule
  );
  const [loading, setLoading] = useState(!initialSchedule && !initialError);
  const [error, setError] = useState(initialError);

  function updateDate(nextDate: string) {
    setLoading(true);
    setSchedule(null);
    setDate(nextDate);
  }

  const loadSchedule = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      setError("");
      const response = await fetch(`/api/mlb/schedule?date=${date}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Schedule unavailable");
      }

      const data = (await response.json()) as ScheduleResponse;
      setSchedule(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof DOMException && caughtError.name === "AbortError"
          ? "Schedule request timed out. Try refresh."
          : "Could not load games."
      );
    } finally {
      window.clearTimeout(timeout);
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
  const sortedGames = useMemo(() => {
    if (!schedule) {
      return [];
    }

    return [...schedule.games].sort((firstGame, secondGame) => {
      if (firstGame.status.isLive !== secondGame.status.isLive) {
        return firstGame.status.isLive ? -1 : 1;
      }

      if (firstGame.status.isPregame !== secondGame.status.isPregame) {
        return firstGame.status.isPregame ? -1 : 1;
      }

      return (
        new Date(firstGame.gameDate).getTime() -
        new Date(secondGame.gameDate).getTime()
      );
    });
  }, [schedule]);
  const liveSummary = loading && !schedule ? null : liveCount;

  return (
    <main className="min-h-screen bg-[#191b1f] px-5 py-6 text-[#f6f7f2] sm:px-8 sm:py-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-5 border-b border-[#3d454e] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-semibold uppercase text-[#aeb6bf] transition hover:text-[#dcff00]"
            >
              Shot Caller
            </Link>
            <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Live Games</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => updateDate(shiftDate(date, -1))}
              className="h-10 rounded-lg border border-[#3d454e] bg-[#23272d] px-3 text-sm font-semibold text-[#f6f7f2] transition hover:border-[#5c6670]"
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
              className="h-10 rounded-lg border border-[#3d454e] bg-[#23272d] px-3 text-sm font-semibold text-[#f6f7f2] outline-none transition focus:border-[#dcff00]"
            />
            <button
              onClick={() => updateDate(shiftDate(date, 1))}
              className="h-10 rounded-lg border border-[#3d454e] bg-[#23272d] px-3 text-sm font-semibold text-[#f6f7f2] transition hover:border-[#5c6670]"
            >
              Next
            </button>
            <button
              onClick={() => void loadSchedule()}
              className="h-10 rounded-lg bg-[#dcff00] px-4 text-sm font-semibold text-[#17191b] shadow-[0_3px_0_#8ea500] transition hover:bg-[#c8e900] active:translate-y-[2px] active:shadow-[0_1px_0_#8ea500]"
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#aeb6bf]">
          <p>
            {liveSummary === null ? (
              <span className="font-medium text-[#dcff00]">
                Checking live games
              </span>
            ) : (
              <>
                <span className="font-medium text-[#dcff00]">{liveSummary}</span>{" "}
                live now
              </>
            )}
            {schedule && (
              <span className="ml-2 text-[#87919c]">
                {formatScheduleDate(schedule.date)}
                {schedule.updatedAt ? ` | ${formatUpdatedAt(schedule.updatedAt)}` : ""}
              </span>
            )}
          </p>
          <Link
            href="/play"
            className="font-semibold text-[#f6f7f2] transition hover:text-[#dcff00]"
          >
            Classic pitch mode
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-[#7a3b3b] bg-[#332626] p-4 text-[#f5c7c7]">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[244px] animate-pulse rounded-lg border border-[#3d454e] bg-[#23272d]"
              />
            ))}
          </div>
        )}

        {!loading && schedule && schedule.games.length === 0 && (
          <div className="rounded-lg border border-[#3d454e] bg-[#23272d] p-8 text-center text-[#aeb6bf]">
            No MLB games found for this date.
          </div>
        )}

        {!loading && schedule && schedule.games.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedGames.map((game) => (
              <GameCard key={game.gamePk} game={game} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
