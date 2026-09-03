"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PLATE_OUTCOME_OPTIONS,
  describePlateEvent,
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
const STORAGE_VERSION = 2;
const MAX_STORED_APPEARANCES = 140;
const RECENT_COLLAPSED_COUNT = 2;

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

type StoredGameState = {
  version: typeof STORAGE_VERSION;
  pendingPrediction: PendingPrediction | null;
  results: ScoredPrediction[];
  appearances: LivePlateAppearance[];
};

function storageKey(gamePk: string) {
  return `shot-caller:game:${gamePk}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const outcomeIds = new Set<PlateOutcomeId>(
  PLATE_OUTCOME_OPTIONS.map((option) => option.id)
);

function isPlateOutcomeId(value: unknown): value is PlateOutcomeId {
  return typeof value === "string" && outcomeIds.has(value as PlateOutcomeId);
}

function isStoredAppearance(value: unknown): value is LivePlateAppearance {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.key === "string" &&
    typeof value.atBatIndex === "number" &&
    typeof value.batter === "string" &&
    typeof value.pitcher === "string" &&
    typeof value.eventType === "string" &&
    isPlateOutcomeId(value.outcome)
  );
}

function isStoredPrediction(value: unknown): value is PendingPrediction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.atBatIndex === "number" &&
    typeof value.batter === "string" &&
    typeof value.pitcher === "string" &&
    isPlateOutcomeId(value.predictedOutcome) &&
    typeof value.pitchCountAtLock === "number" &&
    typeof value.lockedAt === "string"
  );
}

function isStoredResult(value: unknown): value is ScoredPrediction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isStoredAppearance(value.appearance) &&
    isPlateOutcomeId(value.predictedOutcome) &&
    typeof value.pitchCountAtLock === "number" &&
    typeof value.baseScore === "number" &&
    typeof value.timingBonus === "number" &&
    typeof value.totalScore === "number" &&
    typeof value.lockedAt === "string"
  );
}

function readStoredGameState(gamePk: string): StoredGameState | null {
  try {
    const rawState = window.localStorage.getItem(storageKey(gamePk));

    if (!rawState) {
      return null;
    }

    const parsedState = JSON.parse(rawState) as unknown;

    if (!isRecord(parsedState) || parsedState.version !== STORAGE_VERSION) {
      return null;
    }

    const appearances = Array.isArray(parsedState.appearances)
      ? parsedState.appearances.filter(isStoredAppearance)
      : [];
    const results = Array.isArray(parsedState.results)
      ? parsedState.results.filter(isStoredResult)
      : [];
    const pendingPrediction = isStoredPrediction(parsedState.pendingPrediction)
      ? parsedState.pendingPrediction
      : null;

    return {
      version: STORAGE_VERSION,
      pendingPrediction,
      appearances,
      results,
    };
  } catch {
    return null;
  }
}

function writeStoredGameState(gamePk: string, state: StoredGameState) {
  try {
    window.localStorage.setItem(storageKey(gamePk), JSON.stringify(state));
  } catch {
    // Storage can fail in private browsing or when a device is out of quota.
  }
}

function mergePlateAppearances(
  currentAppearances: LivePlateAppearance[],
  nextAppearances: LivePlateAppearance[]
) {
  const byKey = new Map<string, LivePlateAppearance>();

  currentAppearances.forEach((appearance) => {
    byKey.set(appearance.key, appearance);
  });

  nextAppearances.forEach((appearance) => {
    byKey.set(appearance.key, appearance);
  });

  return [...byKey.values()]
    .sort((firstAppearance, secondAppearance) => {
      return firstAppearance.atBatIndex - secondAppearance.atBatIndex;
    })
    .slice(-MAX_STORED_APPEARANCES);
}

function countLabel(balls: number | null, strikes: number | null, outs: number | null) {
  return `${balls ?? "-"}-${strikes ?? "-"}, ${outs ?? "-"} out`;
}

function teamLogoUrl(team: TeamSummary) {
  return team.id === null
    ? ""
    : `https://www.mlbstatic.com/team-logos/team-cap-on-light/${team.id}.svg`;
}

function lineupSpotLabel(lineupSpot: number | null | undefined) {
  return lineupSpot ? `#${lineupSpot}` : "";
}

function appearanceGroupLabel(appearance: LivePlateAppearance) {
  if (appearance.inningState && appearance.inning) {
    return `${appearance.inningState} ${appearance.inning}`;
  }

  return "Earlier";
}

function groupAppearancesByHalf(appearances: LivePlateAppearance[]) {
  const groups: {
    key: string;
    label: string;
    appearances: LivePlateAppearance[];
  }[] = [];

  appearances.forEach((appearance) => {
    const label = appearanceGroupLabel(appearance);
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.label === label) {
      currentGroup.appearances.push(appearance);
      return;
    }

    groups.push({
      key: `${label}-${appearance.key}`,
      label,
      appearances: [appearance],
    });
  });

  return groups;
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

function activeAtBatFromFeed(feed: LiveGameResponse | null) {
  return feed?.status.isLive && feed.currentAtBat && !feed.currentAtBat.isComplete
    ? feed.currentAtBat
    : null;
}

function useLiveFeed(
  gamePk: string,
  enabled: boolean,
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
    if (!enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadFeed();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enabled, loadFeed]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadFeed();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [enabled, loadFeed]);

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
    "absolute h-5 w-5 rotate-45 rounded-[3px] border-2 transition-colors";
  const occupiedClass = "border-[#dcff00] bg-[#dcff00]";
  const emptyClass = "border-[#65717d] bg-[#191b1f]";

  return (
    <div aria-label="Base state" className="relative h-11 w-16 shrink-0">
      <span
        className={`${baseClass} left-[40px] top-[19px] ${
          bases.first ? occupiedClass : emptyClass
        }`}
      />
      <span
        className={`${baseClass} left-[22px] top-[1px] ${
          bases.second ? occupiedClass : emptyClass
        }`}
      />
      <span
        className={`${baseClass} left-[4px] top-[19px] ${
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
  const logoUrl = teamLogoUrl(team);

  return (
    <div
      className={`flex h-12 min-w-0 items-center gap-2.5 border-l border-[#3d454e] px-3 first:border-l-0 sm:px-4 ${
        batting ? "bg-[#2d3329]" : ""
      }`}
    >
      {batting && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#dcff00]" />
      )}
      {logoUrl && (
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 bg-center bg-contain bg-no-repeat"
          style={{
            backgroundImage: `url("${logoUrl}")`,
          }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f6f7f2]">
          {team.abbreviation}
        </p>
      </div>
      <p className="shrink-0 text-2xl font-semibold text-[#f6f7f2]">
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
      <div className="grid gap-0">
        <div className="grid grid-cols-2">
          <ScoreBugTeam team={feed.away} batting={topHalf} />
          <ScoreBugTeam team={feed.home} batting={bottomHalf} />
        </div>

        <div className="grid min-h-14 grid-cols-[5.75rem_minmax(5.25rem,auto)_minmax(0,1fr)] border-t border-[#3d454e] sm:grid-cols-[7rem_minmax(7rem,auto)_minmax(0,1fr)]">
          <div className="flex items-center justify-center border-r border-[#3d454e] px-2">
            <BaseDiamond bases={feed.bases} />
          </div>
          <div className="flex flex-col items-center justify-center border-r border-[#3d454e] px-3 py-2 text-center">
            <p className="text-xs font-semibold uppercase text-[#87919c]">
              Count
            </p>
            <p className="mt-1 text-sm font-semibold text-[#f6f7f2]">
              {countLabel(feed.balls, feed.strikes, feed.outs)}
            </p>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2">
            <p className="truncate text-sm font-semibold text-[#dcff00]">
              {inningLabel(feed)}
            </p>
            <p className="truncate text-xs font-medium text-[#87919c]">
              {feed.status.detailedState}
            </p>
          </div>
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
  const batterName = atBat?.batter ?? pendingPrediction?.batter;
  const pitcherName = atBat?.pitcher ?? pendingPrediction?.pitcher;
  const batterLineupSpot = lineupSpotLabel(atBat?.batterLineupSpot);
  const matchupStatus = atBat
    ? `${countLabel(atBat.balls, atBat.strikes, atBat.outs)} | ${lockTimingLabel(
        atBat.pitchCount
      )}`
    : pendingPrediction
      ? "Waiting for the official result"
      : "No active PA in the feed";

  return (
    <div className="rounded-lg border border-[#3d454e] bg-[#23272d] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-[#87919c]">
          Current Matchup
        </p>
        <p className="text-xs font-medium text-[#aeb6bf] sm:text-sm">
          {matchupStatus}
        </p>
      </div>

      {batterName && pitcherName ? (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#3d454e] pt-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#87919c]">
              Batter{batterLineupSpot ? ` ${batterLineupSpot}` : ""}
            </p>
            <h2 className="mt-1 break-words text-lg font-semibold leading-snug text-[#f6f7f2] sm:text-2xl">
              {batterName}
            </h2>
            <div className="mt-2 grid gap-0.5 text-xs font-medium text-[#aeb6bf] sm:text-sm">
              <p>
                <span className="text-[#87919c]">Slash</span>{" "}
                {atBat?.batterSummary?.slashLine || "--/--/--"}
              </p>
              <p>
                <span className="text-[#87919c]">Today</span>{" "}
                {atBat?.batterSummary?.today || "No results yet"}
              </p>
            </div>
          </div>

          <div className="min-w-0 border-l border-[#3d454e] pl-3 sm:pl-4">
            <p className="text-xs font-semibold uppercase text-[#87919c]">
              Pitcher
            </p>
            <h2 className="mt-1 break-words text-lg font-semibold leading-snug text-[#f6f7f2] sm:text-2xl">
              {pitcherName}
            </h2>
            <div className="mt-2 grid gap-0.5 text-xs font-medium text-[#aeb6bf] sm:text-sm">
              <p>
                <span className="text-[#87919c]">Season</span>{" "}
                {atBat?.pitcherSummary?.seasonLine || "-- ERA / -- WHIP"}
              </p>
              <p>
                <span className="text-[#87919c]">Today</span>{" "}
                {atBat?.pitcherSummary?.today || "No line yet"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <h2 className="mt-2 text-xl font-semibold leading-tight text-[#f6f7f2] sm:text-2xl">
          Waiting for the next plate appearance
        </h2>
      )}
    </div>
  );
}

function OutcomeButton({
  outcomeId,
  selected,
  disabled,
  availableScore,
  onSelect,
  onLock,
}: {
  outcomeId: PlateOutcomeId;
  selected: boolean;
  disabled: boolean;
  availableScore: number;
  onSelect: (outcomeId: PlateOutcomeId) => void;
  onLock: () => void;
}) {
  const outcome = getPlateOutcomeOption(outcomeId);

  return (
    <button
      disabled={disabled}
      aria-label={
        selected ? `Lock ${outcome.label}` : `Select ${outcome.label}`
      }
      onClick={() => {
        if (selected) {
          onLock();
          return;
        }

        onSelect(outcomeId);
      }}
      className={`relative min-h-[76px] rounded-lg border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[84px] sm:p-3 ${
        selected
          ? "border-[#dcff00] bg-[#dcff00] pb-10 text-[#17191b] shadow-[0_4px_0_#8ea500]"
          : "border-[#3d454e] bg-[#191b1f] text-[#f6f7f2] hover:border-[#5c6670] hover:bg-[#272c33]"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-semibold uppercase ${
            selected ? "text-[#394100]" : "text-[#87919c]"
          }`}
        >
          {outcome.shortLabel}
        </span>
        {!selected && (
          <span className="text-xs font-semibold text-[#aeb6bf]">
            {outcome.basePoints} pts
          </span>
        )}
      </span>
      <span className="mt-1 text-base font-semibold leading-tight sm:text-lg">
        {outcome.label}
      </span>
      {selected && (
        <span className="absolute bottom-2 left-2 right-2 rounded-md bg-[#17191b] px-2 py-1 text-center text-sm font-semibold text-[#dcff00]">
          Lock +{availableScore}
        </span>
      )}
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
  const timingBonus = atBat ? timingBonusForPitchCount(atBat.pitchCount) : 0;
  const disabled = !atBat || Boolean(pendingPrediction);

  return (
    <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#87919c]">
            Make The Call
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#f6f7f2] sm:text-2xl">
            Pick this PA result
          </h3>
        </div>
        {pendingPrediction ? (
          <div className="text-sm font-medium text-[#aeb6bf] sm:text-right">
            <p className="font-semibold text-[#dcff00]">
              Locked:{" "}
              {getPlateOutcomeOption(pendingPrediction.predictedOutcome).label}
            </p>
            <p>{lockTimingLabel(pendingPrediction.pitchCountAtLock)}</p>
          </div>
        ) : (
          <p className="text-sm font-medium text-[#aeb6bf]">
            Early bonus:{" "}
            <span className="font-semibold text-[#dcff00]">+{timingBonus}</span>
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {PLATE_OUTCOME_OPTIONS.map((outcome) => (
          <OutcomeButton
            key={outcome.id}
            outcomeId={outcome.id}
            selected={selectedOutcome === outcome.id}
            disabled={disabled}
            availableScore={outcome.basePoints + timingBonus}
            onSelect={onSelectOutcome}
            onLock={onLock}
          />
        ))}
      </div>
    </section>
  );
}

function ScoreFooter({
  results,
  appearances,
}: {
  results: ScoredPrediction[];
  appearances: LivePlateAppearance[];
}) {
  const totalScore = results.reduce((sum, result) => sum + result.totalScore, 0);
  const correctCalls = results.filter(
    (result) => result.predictedOutcome === result.appearance.outcome
  ).length;
  const accuracy =
    results.length === 0 ? 0 : Math.round((correctCalls / results.length) * 100);
  const streak = currentStreak(results);
  const lastResult = results[results.length - 1] ?? null;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[#3d454e] bg-[#111316]/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-[#f6f7f2] shadow-[0_-12px_36px_rgba(0,0,0,0.28)] backdrop-blur sm:px-5">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(4.5rem,auto)_repeat(3,minmax(0,1fr))] items-center gap-3 sm:grid-cols-[minmax(7rem,auto)_repeat(4,minmax(0,1fr))_minmax(9rem,auto)]">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase text-[#87919c]">
            Score
          </p>
          <p className="text-3xl font-semibold leading-none text-[#dcff00] sm:text-4xl">
            {totalScore}
          </p>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase text-[#87919c]">
            Calls
          </p>
          <p className="mt-0.5 text-sm font-semibold sm:text-lg">
            {results.length}
          </p>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase text-[#87919c]">
            Right
          </p>
          <p className="mt-0.5 text-sm font-semibold sm:text-lg">{accuracy}%</p>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase text-[#87919c]">
            Streak
          </p>
          <p className="mt-0.5 text-sm font-semibold sm:text-lg">{streak}</p>
        </div>

        <div className="hidden min-w-0 text-center sm:block">
          <p className="text-[10px] font-semibold uppercase text-[#87919c]">
            PAs
          </p>
          <p className="mt-0.5 text-lg font-semibold">{appearances.length}</p>
        </div>

        <div className="hidden min-w-0 text-right sm:block">
          <p className="text-[10px] font-semibold uppercase text-[#87919c]">
            Last
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[#f6f7f2]">
            {lastResult
              ? `+${lastResult.totalScore} ${describePlateEvent(
                  lastResult.appearance.eventType,
                  lastResult.appearance.result
                )}`
              : "No call yet"}
          </p>
        </div>
      </div>
    </footer>
  );
}

function RecentPlaysPanel({
  results,
  appearances,
  checkedAt,
}: {
  results: ScoredPrediction[];
  appearances: LivePlateAppearance[];
  checkedAt: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const resultByAppearance = new Map(
    results.map((result) => [result.appearance.key, result])
  );
  const visibleAppearances = (
    expanded ? appearances : appearances.slice(-RECENT_COLLAPSED_COUNT)
  )
    .slice()
    .reverse();
  const groupedAppearances = groupAppearancesByHalf(visibleAppearances);
  const canExpand = appearances.length > RECENT_COLLAPSED_COUNT;

  return (
    <section className="rounded-lg border border-[#3d454e] bg-[#23272d] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#87919c]">
            Recent Plays
          </p>
          <p className="text-xs font-medium text-[#87919c]">
            {formatTime(checkedAt)}
          </p>
        </div>
        {canExpand && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((currentExpanded) => !currentExpanded)}
            className="rounded-md border border-[#3d454e] px-2.5 py-1 text-xs font-semibold text-[#f6f7f2] transition hover:border-[#5c6670]"
          >
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        {groupedAppearances.map((group) => (
          <div key={group.key} className="grid gap-2">
            <p className="text-[11px] font-semibold uppercase text-[#87919c]">
              {group.label}
            </p>
            {group.appearances.map((appearance) => {
              const result = resultByAppearance.get(appearance.key) ?? null;
              const actualLabel = describePlateEvent(
                appearance.eventType,
                appearance.result
              );
              const detail =
                appearance.description &&
                appearance.description !== appearance.result &&
                appearance.description !== actualLabel
                  ? appearance.description
                  : "";
              const batterOrder = lineupSpotLabel(appearance.batterLineupSpot);

              return (
                <div
                  key={appearance.key}
                  className="rounded-md border border-[#3d454e] bg-[#191b1f] p-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#f6f7f2]">
                        {batterOrder ? `${batterOrder} ` : ""}
                        {appearance.batter}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-[#dcff00]">
                        Result: {actualLabel}
                      </p>
                    </div>
                    {result ? (
                      <p className="shrink-0 font-semibold text-[#dcff00]">
                        +{result.totalScore}
                      </p>
                    ) : (
                      <p className="shrink-0 text-xs font-semibold uppercase text-[#87919c]">
                        No call
                      </p>
                    )}
                  </div>
                  {detail && (
                    <p className="mt-1 line-clamp-1 text-xs text-[#87919c] sm:line-clamp-2">
                      {detail}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#aeb6bf]">
                    <span className="font-semibold text-[#87919c]">
                      Your call:
                    </span>{" "}
                    {result
                      ? getPlateOutcomeOption(result.predictedOutcome).label
                      : "No call"}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
        {!visibleAppearances.length && (
          <p className="text-sm text-[#aeb6bf]">No completed PAs yet.</p>
        )}
      </div>
    </section>
  );
}

export default function LiveGameClient({ gamePk }: { gamePk: string }) {
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<SelectedOutcome | null>(
    null
  );
  const [pendingPrediction, setPendingPrediction] =
    useState<PendingPrediction | null>(null);
  const [results, setResults] = useState<ScoredPrediction[]>([]);
  const [appearances, setAppearances] = useState<LivePlateAppearance[]>([]);
  const pendingPredictionRef = useRef<PendingPrediction | null>(null);

  const updatePendingPrediction = useCallback(
    (nextPrediction: PendingPrediction | null) => {
      pendingPredictionRef.current = nextPrediction;
      setPendingPrediction(nextPrediction);
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedState = readStoredGameState(gamePk);

      setSelectedOutcome(null);
      setResults(storedState?.results ?? []);
      setAppearances(storedState?.appearances ?? []);
      updatePendingPrediction(storedState?.pendingPrediction ?? null);
      setStorageLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [gamePk, updatePendingPrediction]);

  useEffect(() => {
    if (!storageLoaded) {
      return;
    }

    writeStoredGameState(gamePk, {
      version: STORAGE_VERSION,
      pendingPrediction,
      results,
      appearances,
    });
  }, [appearances, gamePk, pendingPrediction, results, storageLoaded]);

  const handleFeedUpdate = useCallback(
    (nextFeed: LiveGameResponse) => {
      const nextActiveAtBat = activeAtBatFromFeed(nextFeed);

      setSelectedOutcome((currentSelection) => {
        if (
          currentSelection &&
          (!nextActiveAtBat ||
            currentSelection.atBatIndex !== nextActiveAtBat.atBatIndex)
        ) {
          return null;
        }

        return currentSelection;
      });

      setAppearances((currentAppearances) =>
        mergePlateAppearances(
          currentAppearances,
          nextFeed.completedPlateAppearances
        )
      );

      const activePrediction = pendingPredictionRef.current;

      if (!activePrediction) {
        return;
      }

      const completedAppearance = nextFeed.completedPlateAppearances.find(
        (appearance) => appearance.atBatIndex === activePrediction.atBatIndex
      );

      if (!completedAppearance) {
        const feedAdvancedPastPrediction =
          nextFeed.completedPlateAppearances.some(
            (appearance) => appearance.atBatIndex > activePrediction.atBatIndex
          ) ||
          Boolean(
            nextActiveAtBat &&
              (nextActiveAtBat.atBatIndex !== activePrediction.atBatIndex ||
                nextActiveAtBat.batter !== activePrediction.batter ||
                nextActiveAtBat.pitcher !== activePrediction.pitcher)
          );

        if (feedAdvancedPastPrediction) {
          updatePendingPrediction(null);
          setSelectedOutcome(null);
        }

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
      updatePendingPrediction(null);
      setSelectedOutcome(null);
    },
    [updatePendingPrediction]
  );

  const { feed, loading, error, refresh, checkedAt } = useLiveFeed(
    gamePk,
    storageLoaded,
    handleFeedUpdate
  );

  const activeAtBat =
    activeAtBatFromFeed(feed);

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
    <main className="min-h-screen overflow-x-clip bg-[#191b1f] px-4 pb-28 pt-5 text-[#f6f7f2] sm:px-6 sm:pb-24 sm:pt-7">
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

              <RecentPlaysPanel
                results={results}
                appearances={appearances}
                checkedAt={checkedAt}
              />
            </div>

            <ScoreFooter results={results} appearances={appearances} />
          </>
        )}
      </section>
    </main>
  );
}
