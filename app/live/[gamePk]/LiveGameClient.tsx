"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PLATE_OUTCOME_OPTIONS,
  getPlateOutcomeOption,
  scorePlatePrediction,
  timingBonusForPitchCount,
  type PlateOutcomeId,
} from "@/lib/plate-outcomes";
import type {
  BaseState,
  CurrentAtBat,
  LiveGameResponse,
  LivePlateAppearance,
  LivePollResponse,
  TeamSummary,
} from "@/lib/mlb-live";

const POLL_INTERVAL_MS = 2000;

type PendingPrediction = {
  atBatIndex: number;
  batter: string;
  pitcher: string;
  predictedOutcome: PlateOutcomeId;
  pitchCountAtLock: number;
  lockedAt: string;
};

type ScoredPrediction = {
  id: string;
  appearance: LivePlateAppearance;
  predictedOutcome: PlateOutcomeId;
  pitchCountAtLock: number;
  baseScore: number;
  timingBonus: number;
  totalScore: number;
  lockedAt: string;
};

type SelectedOutcome = {
  atBatIndex: number;
  outcome: PlateOutcomeId;
};

function countLabel(balls: number | null, strikes: number | null, outs: number | null) {
  return `${balls ?? "-"}-${strikes ?? "-"}, ${outs ?? "-"} out`;
}

function formatTime(value: string) {
  if (!value) {
    return "Not checked";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function inningLabel(feed: LiveGameResponse) {
  if (feed.inningState && feed.inning) {
    return `${feed.inningState} ${feed.inning}`;
  }

  return feed.status.detailedState;
}

function lockTimingLabel(pitchCountAtLock: number) {
  if (pitchCountAtLock <= 0) {
    return "Before pitch 1";
  }

  return `After ${pitchCountAtLock} pitch${pitchCountAtLock === 1 ? "" : "es"}`;
}

function currentStreak(results: ScoredPrediction[]) {
  let streak = 0;

  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];

    if (result.predictedOutcome !== result.appearance.outcome) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function useLiveFeed(
  gamePk: string,
  onFeedUpdate: (feed: LiveGameResponse) => void
) {
  const [feed, setFeed] = useState<LiveGameResponse | null>(null);
  const [timecode, setTimecode] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const appliedTimecode = useRef("");

  const applyFeed = useCallback(
    (nextFeed: LiveGameResponse, nextTimecode: string) => {
      if (nextTimecode && appliedTimecode.current > nextTimecode) {
        return;
      }

      appliedTimecode.current = nextTimecode;
      setFeed(nextFeed);
      onFeedUpdate(nextFeed);
    },
    [onFeedUpdate]
  );

  const loadFeed = useCallback(
    async (force = false) => {
      try {
        setError("");

        const params = new URLSearchParams();

        if (!force && timecode !== null) {
          params.set("since", timecode);
        }

        const query = params.toString();
        const response = await fetch(
          `/api/mlb/live/${gamePk}${query ? `?${query}` : ""}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Live feed unavailable");
        }

        const data = (await response.json()) as LivePollResponse;
        setTimecode(data.timecode);
        setCheckedAt(data.checkedAt);

        if (data.changed && data.feed) {
          applyFeed(data.feed, data.timecode);
        }
      } catch {
        setError("Could not load live feed.");
      } finally {
        setLoading(false);
      }
    },
    [applyFeed, gamePk, timecode]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFeed();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadFeed();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadFeed]);

  return {
    feed,
    loading,
    error,
    refresh: loadFeed,
    checkedAt,
  };
}

function BaseDiamond({ bases }: { bases: BaseState }) {
  const baseClass =
    "absolute h-6 w-6 rotate-45 rounded-[3px] border-2 transition-colors";
  const occupiedClass = "border-[#dcff00] bg-[#dcff00]";
  const emptyClass = "border-[#65717d] bg-[#191b1f]";

  return (
    <div aria-label="Base state" className="relative h-14 w-20 shrink-0">
      <span
        className={`${baseClass} left-[47px] top-[22px] ${
          bases.first ? occupiedClass : emptyClass
        }`}
      />
      <span
        className={`${baseClass} left-[27px] top-[2px] ${
          bases.second ? occupiedClass : emptyClass
        }`}
      />
      <span
        className={`${baseClass} left-[7px] top-[22px] ${
          bases.third ? occupiedClass : emptyClass
        }`}
      />
    </div>
  );
}

function ScoreBugTeam({
  team,
  batting,
}: {
  team: TeamSummary;
  batting: boolean;
}) {
  return (
    <div
      className={`flex min-w-[7.5rem] items-center gap-3 border-l border-[#3d454e] px-4 py-3 first:border-l-0 ${
        batting ? "bg-[#2d3329]" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {batting && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#dcff00]" />
          )}
          <p className="truncate text-sm font-semibold text-[#f6f7f2]">
            {team.abbreviation}
          </p>
        </div>
      </div>
      <p className="text-3xl font-semibold text-[#f6f7f2]">
        {team.score ?? "-"}
      </p>
    </div>
  );
}

function ScoreBug({ feed }: { feed: LiveGameResponse }) {
  const topHalf = feed.inningState.toLowerCase().startsWith("top");
  const bottomHalf = feed.inningState.toLowerCase().startsWith("bottom");

  return (
    <section className="overflow-hidden rounded-lg border border-[#3d454e] bg-[#23272d] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="grid gap-0 md:grid-cols-[auto_auto_minmax(13rem,auto)]">
        <div className="grid grid-cols-2">
          <ScoreBugTeam team={feed.away} batting={topHalf} />
          <ScoreBugTeam team={feed.home} batting={bottomHalf} />
        </div>

        <div className="flex items-center justify-between gap-5 border-t border-[#3d454e] px-4 py-3 md:border-l md:border-t-0">
          <BaseDiamond bases={feed.bases} />
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-[#87919c]">
              Count
            </p>
            <p className="mt-1 text-sm font-semibold text-[#f6f7f2]">
              {countLabel(feed.balls, feed.strikes, feed.outs)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#3d454e] px-4 py-3 md:border-l md:border-t-0">
          <p className="text-sm font-semibold text-[#dcff00]">
            {inningLabel(feed)}
          </p>
          <p className="text-xs font-medium text-[#87919c]">
            {feed.status.detailedState}
          </p>
        </div>
      </div>
    </section>
  );
}

function BatterMatchup({
  atBat,
  pendingPrediction,
}: {
  atBat: CurrentAtBat | null;
  pendingPrediction: PendingPrediction | null;
}) {
  const title = atBat
    ? `${atBat.batter} vs ${atBat.pitcher}`
    : pendingPrediction
      ? `${pendingPrediction.batter} vs ${pendingPrediction.pitcher}`
      : "Waiting for the next plate appearance";

  return (
    <div className="min-h-[156px] rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="max-w-[44rem]">
        <p className="text-xs font-semibold uppercase text-[#87919c]">
          Current Matchup
        </p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#f6f7f2] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm font-medium text-[#aeb6bf]">
          {atBat
            ? `${countLabel(atBat.balls, atBat.strikes, atBat.outs)} | ${lockTimingLabel(
                atBat.pitchCount
              )}`
            : pendingPrediction
              ? "Waiting for the official result"
              : "No active PA in the feed"}
        </p>
      </div>
    </div>
  );
}

function OutcomeButton({
  outcomeId,
  selected,
  disabled,
  onSelect,
}: {
  outcomeId: PlateOutcomeId;
  selected: boolean;
  disabled: boolean;
  onSelect: (outcomeId: PlateOutcomeId) => void;
}) {
  const outcome = getPlateOutcomeOption(outcomeId);

  return (
    <button
      disabled={disabled}
      onClick={() => onSelect(outcomeId)}
      className={`grid min-h-[96px] rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "border-[#dcff00] bg-[#dcff00] text-[#17191b] shadow-[0_4px_0_#8ea500]"
          : "border-[#3d454e] bg-[#191b1f] text-[#f6f7f2] hover:border-[#5c6670] hover:bg-[#272c33]"
      }`}
    >
      <span
        className={`text-xs font-semibold uppercase ${
          selected ? "text-[#394100]" : "text-[#87919c]"
        }`}
      >
        {outcome.shortLabel}
      </span>
      <span className="mt-1 text-lg font-semibold leading-tight">
        {outcome.label}
      </span>
      <span
        className={`mt-3 text-sm font-medium ${
          selected ? "text-[#394100]" : "text-[#aeb6bf]"
        }`}
      >
        {outcome.basePoints} pts
      </span>
    </button>
  );
}

function PredictionConsole({
  atBat,
  selectedOutcome,
  pendingPrediction,
  onSelectOutcome,
  onLock,
}: {
  atBat: CurrentAtBat | null;
  selectedOutcome: PlateOutcomeId | null;
  pendingPrediction: PendingPrediction | null;
  onSelectOutcome: (outcomeId: PlateOutcomeId) => void;
  onLock: () => void;
}) {
  const selectedOption = selectedOutcome
    ? getPlateOutcomeOption(selectedOutcome)
    : null;
  const timingBonus = atBat ? timingBonusForPitchCount(atBat.pitchCount) : 0;
  const disabled = !atBat || Boolean(pendingPrediction);

  return (
    <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#87919c]">
            Make The Call
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[#f6f7f2]">
            Pick this PA result
          </h3>
        </div>
        <p className="text-sm font-medium text-[#aeb6bf]">
          Early bonus:{" "}
          <span className="font-semibold text-[#dcff00]">+{timingBonus}</span>
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PLATE_OUTCOME_OPTIONS.map((outcome) => (
          <OutcomeButton
            key={outcome.id}
            outcomeId={outcome.id}
            selected={selectedOutcome === outcome.id}
            disabled={disabled}
            onSelect={onSelectOutcome}
          />
        ))}
      </div>

      <div className="mt-5 flex min-h-[64px] flex-col justify-center gap-3 border-t border-[#3d454e] pt-4 sm:flex-row sm:items-center sm:justify-between">
        {pendingPrediction ? (
          <div>
            <p className="font-semibold text-[#dcff00]">
              Locked:{" "}
              {getPlateOutcomeOption(pendingPrediction.predictedOutcome).label}
            </p>
            <p className="mt-1 text-sm text-[#aeb6bf]">
              {lockTimingLabel(pendingPrediction.pitchCountAtLock)}
            </p>
          </div>
        ) : selectedOption ? (
          <div>
            <p className="font-semibold text-[#f6f7f2]">
              {selectedOption.label}
            </p>
            <p className="mt-1 text-sm text-[#aeb6bf]">
              {selectedOption.basePoints + timingBonus} available
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#aeb6bf]">
            {atBat ? "No call selected" : "No active PA"}
          </p>
        )}

        <button
          disabled={!atBat || !selectedOutcome || Boolean(pendingPrediction)}
          onClick={onLock}
          className="h-12 rounded-lg bg-[#dcff00] px-6 font-semibold text-[#17191b] shadow-[0_4px_0_#8ea500] transition hover:bg-[#c8e900] active:translate-y-[3px] active:shadow-[0_1px_0_#8ea500] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#dcff00]"
        >
          Lock Call
        </button>
      </div>
    </section>
  );
}

function ScoreRail({
  results,
  lastResult,
  checkedAt,
}: {
  results: ScoredPrediction[];
  lastResult: ScoredPrediction | null;
  checkedAt: string;
}) {
  const totalScore = results.reduce((sum, result) => sum + result.totalScore, 0);
  const correctCalls = results.filter(
    (result) => result.predictedOutcome === result.appearance.outcome
  ).length;
  const accuracy =
    results.length === 0 ? 0 : Math.round((correctCalls / results.length) * 100);
  const streak = currentStreak(results);

  return (
    <aside className="grid gap-4 lg:content-start">
      <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-xs font-semibold uppercase text-[#87919c]">Score</p>
        <p className="mt-2 text-6xl font-semibold text-[#dcff00]">
          {totalScore}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#3d454e] pt-4 text-sm">
          <div>
            <p className="text-[#87919c]">Calls</p>
            <p className="mt-1 text-2xl font-semibold">{results.length}</p>
          </div>
          <div>
            <p className="text-[#87919c]">Right</p>
            <p className="mt-1 text-2xl font-semibold">{accuracy}%</p>
          </div>
          <div>
            <p className="text-[#87919c]">Streak</p>
            <p className="mt-1 text-2xl font-semibold">{streak}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-xs font-semibold uppercase text-[#87919c]">
          Last Call
        </p>
        {lastResult ? (
          <div className="mt-3">
            <p className="text-2xl font-semibold text-[#f6f7f2]">
              {getPlateOutcomeOption(lastResult.appearance.outcome).label}
            </p>
            <p className="mt-1 text-sm text-[#aeb6bf]">
              Called{" "}
              {getPlateOutcomeOption(lastResult.predictedOutcome).label}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#3d454e] pt-4 text-sm">
              <div>
                <p className="text-[#87919c]">Base</p>
                <p className="mt-1 text-xl font-semibold">
                  {lastResult.baseScore}
                </p>
              </div>
              <div>
                <p className="text-[#87919c]">Bonus</p>
                <p className="mt-1 text-xl font-semibold">
                  {lastResult.timingBonus}
                </p>
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold text-[#dcff00]">
              +{lastResult.totalScore}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#aeb6bf]">No calls scored yet.</p>
        )}
      </section>

      <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-[#87919c]">
            Recent
          </p>
          <p className="text-xs font-medium text-[#87919c]">
            {formatTime(checkedAt)}
          </p>
        </div>
        <div className="mt-3 grid gap-3">
          {results
            .slice(-5)
            .reverse()
            .map((result) => (
              <div
                key={result.id}
                className="border-t border-[#3d454e] pt-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#f6f7f2]">
                    {result.appearance.batter}
                  </p>
                  <p className="font-semibold text-[#dcff00]">
                    +{result.totalScore}
                  </p>
                </div>
                <p className="mt-1 text-[#aeb6bf]">
                  {getPlateOutcomeOption(result.predictedOutcome).shortLabel} /{" "}
                  {getPlateOutcomeOption(result.appearance.outcome).shortLabel}
                </p>
              </div>
            ))}
          {!results.length && (
            <p className="text-sm text-[#aeb6bf]">No scored calls yet.</p>
          )}
        </div>
      </section>
    </aside>
  );
}

export default function LiveGameClient({ gamePk }: { gamePk: string }) {
  const [selectedOutcome, setSelectedOutcome] = useState<SelectedOutcome | null>(
    null
  );
  const [pendingPrediction, setPendingPrediction] =
    useState<PendingPrediction | null>(null);
  const [lastResult, setLastResult] = useState<ScoredPrediction | null>(null);
  const [results, setResults] = useState<ScoredPrediction[]>([]);
  const pendingPredictionRef = useRef<PendingPrediction | null>(null);

  const updatePendingPrediction = useCallback(
    (nextPrediction: PendingPrediction | null) => {
      pendingPredictionRef.current = nextPrediction;
      setPendingPrediction(nextPrediction);
    },
    []
  );

  const scorePendingPrediction = useCallback(
    (nextFeed: LiveGameResponse) => {
      const activePrediction = pendingPredictionRef.current;

      if (!activePrediction) {
        return;
      }

      const completedAppearance = nextFeed.completedPlateAppearances.find(
        (appearance) => appearance.atBatIndex === activePrediction.atBatIndex
      );

      if (!completedAppearance) {
        return;
      }

      const score = scorePlatePrediction({
        predictedOutcome: activePrediction.predictedOutcome,
        actualOutcome: completedAppearance.outcome,
        pitchCountAtLock: activePrediction.pitchCountAtLock,
      });

      const scoredPrediction: ScoredPrediction = {
        id: completedAppearance.key,
        appearance: completedAppearance,
        predictedOutcome: activePrediction.predictedOutcome,
        pitchCountAtLock: activePrediction.pitchCountAtLock,
        baseScore: score.baseScore,
        timingBonus: score.timingBonus,
        totalScore: score.totalScore,
        lockedAt: activePrediction.lockedAt,
      };

      setResults((currentResults) => {
        if (currentResults.some((result) => result.id === scoredPrediction.id)) {
          return currentResults;
        }

        return [...currentResults, scoredPrediction];
      });
      setLastResult(scoredPrediction);
      updatePendingPrediction(null);
      setSelectedOutcome(null);
    },
    [updatePendingPrediction]
  );

  const { feed, loading, error, refresh, checkedAt } = useLiveFeed(
    gamePk,
    scorePendingPrediction
  );

  const activeAtBat =
    feed?.status.isLive && feed.currentAtBat && !feed.currentAtBat.isComplete
      ? feed.currentAtBat
      : null;

  const activeSelectedOutcome =
    activeAtBat && selectedOutcome?.atBatIndex === activeAtBat.atBatIndex
      ? selectedOutcome.outcome
      : null;

  const lastCompletedAppearance = useMemo(() => {
    if (!feed?.completedPlateAppearances.length) {
      return null;
    }

    return feed.completedPlateAppearances[
      feed.completedPlateAppearances.length - 1
    ];
  }, [feed]);

  function selectOutcome(outcome: PlateOutcomeId) {
    if (!activeAtBat || pendingPrediction) {
      return;
    }

    setSelectedOutcome({
      atBatIndex: activeAtBat.atBatIndex,
      outcome,
    });
  }

  function lockPrediction() {
    if (!activeAtBat || !activeSelectedOutcome || pendingPrediction) {
      return;
    }

    setLastResult(null);
    updatePendingPrediction({
      atBatIndex: activeAtBat.atBatIndex,
      batter: activeAtBat.batter,
      pitcher: activeAtBat.pitcher,
      predictedOutcome: activeSelectedOutcome,
      pitchCountAtLock: activeAtBat.pitchCount,
      lockedAt: new Date().toISOString(),
    });
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#191b1f] px-4 py-5 text-[#f6f7f2] sm:px-6 sm:py-7">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-[#3d454e] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/live"
              className="text-sm font-semibold uppercase text-[#aeb6bf] transition hover:text-[#dcff00]"
            >
              Live Games
            </Link>
            <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
              Shot Caller
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase ${
                feed?.status.isLive
                  ? "border-[#dcff00] bg-[#dcff00] text-[#17191b]"
                  : "border-[#3d454e] bg-[#23272d] text-[#aeb6bf]"
              }`}
            >
              {feed?.status.detailedState ?? "Loading"}
            </span>
            <button
              onClick={() => void refresh(true)}
              className="h-10 rounded-lg border border-[#3d454e] bg-[#23272d] px-3 text-sm font-semibold text-[#f6f7f2] transition hover:border-[#5c6670]"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-[#7a3b3b] bg-[#332626] p-4 text-[#f5c7c7]">
            {error}
          </div>
        )}

        {loading && (
          <div className="h-[560px] animate-pulse rounded-lg border border-[#3d454e] bg-[#23272d]" />
        )}

        {!loading && feed && (
          <>
            <ScoreBug feed={feed} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid content-start gap-4">
                <BatterMatchup
                  atBat={activeAtBat}
                  pendingPrediction={pendingPrediction}
                />

                <PredictionConsole
                  atBat={activeAtBat}
                  selectedOutcome={activeSelectedOutcome}
                  pendingPrediction={pendingPrediction}
                  onSelectOutcome={selectOutcome}
                  onLock={lockPrediction}
                />

                {!activeAtBat && !pendingPrediction && lastCompletedAppearance && (
                  <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-xs font-semibold uppercase text-[#87919c]">
                      Latest PA
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[#f6f7f2]">
                      {lastCompletedAppearance.batter}:{" "}
                      {getPlateOutcomeOption(lastCompletedAppearance.outcome).label}
                    </p>
                    <p className="mt-1 text-sm text-[#aeb6bf]">
                      {lastCompletedAppearance.result}
                    </p>
                  </section>
                )}

                {!feed.status.isLive && (
                  <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-5 text-sm text-[#aeb6bf] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {feed.status.isFinal
                      ? "This game is final."
                      : "The live feed is not active yet."}
                  </section>
                )}
              </div>

              <ScoreRail
                results={results}
                lastResult={lastResult}
                checkedAt={checkedAt}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
