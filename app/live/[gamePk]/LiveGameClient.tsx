"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PitchTarget,
  normalizeBatterSide,
  plateCoordinatesToPoint,
  type PitchPoint,
  type PitchView,
} from "@/components/PitchTarget";
import {
  LIVE_PITCH_TYPES,
  type LiveGameResponse,
  type LivePitch,
  type LivePollResponse,
} from "@/lib/mlb-live";

const REVEAL_DELAY_STORAGE_KEY = "perfect-pitch-reveal-delay";
const MAX_REVEAL_DELAY_SECONDS = 90;
const CALIBRATION_SAFETY_BUFFER_SECONDS = 2;
const CALIBRATION_REACTION_GRACE_SECONDS = 2;

const PITCH_OPTIONS = [...LIVE_PITCH_TYPES, "Other"];
const REVEAL_DELAY_OPTIONS = [0, 15, 30, 45, 60, 90];

type PendingGuess = {
  pitchType: string;
  point: PitchPoint;
  baselineSequence: number;
};

type ScoredPitch = {
  id: string;
  pitch: LivePitch;
  guessedPitchType: string;
  point: PitchPoint;
  locationScore: number;
  pitchTypeScore: number;
  totalScore: number;
};

type Calibration =
  | { status: "idle" }
  | { status: "waiting"; baselinePitchCount: number }
  | {
      status: "ready";
      baselinePitchCount: number;
      pitchSequence: number;
      receivedAtMs: number;
      timecode: string;
    }
  | {
      status: "set";
      delaySeconds: number;
      measuredSeconds: number;
      pitchSequence: number;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePitchType(value: string) {
  return LIVE_PITCH_TYPES.some((type) => type === value) ? value : "Other";
}

function scorePitch(guess: PendingGuess, pitch: LivePitch): ScoredPitch {
  const actualPoint = plateCoordinatesToPoint(
    pitch.plateX,
    pitch.plateZ,
    pitch.batterSide
  );
  const distance = actualPoint
    ? Math.sqrt(
        Math.pow(guess.point.x - actualPoint.x, 2) +
          Math.pow(guess.point.y - actualPoint.y, 2)
      )
    : 760;

  const locationScore = Math.max(0, Math.round(100 - distance / 2));
  const pitchTypeScore =
    guess.pitchType === normalizePitchType(pitch.pitchType) ? 100 : 0;

  return {
    id: pitch.key,
    pitch,
    guessedPitchType: guess.pitchType,
    point: guess.point,
    locationScore,
    pitchTypeScore,
    totalScore: locationScore + pitchTypeScore,
  };
}

function countLabel(balls: number | null, strikes: number | null, outs: number | null) {
  return `${balls ?? "-"}-${strikes ?? "-"}, ${outs ?? "-"} out`;
}

function speedLabel(speed: number | null) {
  return speed === null ? "-- mph" : `${Math.round(speed)} mph`;
}

function normalizeRevealDelay(delaySeconds: number) {
  if (!Number.isFinite(delaySeconds)) {
    return 0;
  }

  return Math.round(clamp(delaySeconds, 0, MAX_REVEAL_DELAY_SECONDS));
}

function getInitialRevealDelay() {
  if (typeof window === "undefined") {
    return 0;
  }

  const savedDelay = normalizeRevealDelay(
    Number(window.localStorage.getItem(REVEAL_DELAY_STORAGE_KEY))
  );

  return savedDelay;
}

function formatTime(value: string) {
  if (!value) {
    return "Not checked";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function useLiveFeed(
  gamePk: string,
  feedDelaySeconds: number,
  holdVisibleUpdates: boolean,
  onFeedUpdate: (feed: LiveGameResponse) => void,
  onRawFeedUpdate: (
    feed: LiveGameResponse,
    receivedAtMs: number,
    timecode: string
  ) => void
) {
  const [feed, setFeed] = useState<LiveGameResponse | null>(null);
  const [timecode, setTimecode] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoadedFeed = useRef(false);
  const appliedTimecode = useRef("");
  const delayedFeedTimers = useRef<number[]>([]);

  const clearDelayedFeeds = useCallback(() => {
    delayedFeedTimers.current.forEach((timer) => window.clearTimeout(timer));
    delayedFeedTimers.current = [];
  }, []);

  const applyFeed = useCallback(
    (nextFeed: LiveGameResponse, nextTimecode: string) => {
      if (nextTimecode && appliedTimecode.current > nextTimecode) {
        return;
      }

      appliedTimecode.current = nextTimecode;
      hasLoadedFeed.current = true;
      setFeed(nextFeed);
      onFeedUpdate(nextFeed);
    },
    [onFeedUpdate]
  );

  useEffect(() => {
    return () => {
      clearDelayedFeeds();
    };
  }, [clearDelayedFeeds]);

  const loadFeed = useCallback(async (force = false) => {
    try {
      setError("");

      if (force) {
        clearDelayedFeeds();
      }

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
        const receivedAtMs = performance.now();
        onRawFeedUpdate(data.feed, receivedAtMs, data.timecode);

        if (holdVisibleUpdates && !force && hasLoadedFeed.current) {
          return;
        }

        const shouldApplyImmediately =
          force || !hasLoadedFeed.current || feedDelaySeconds === 0;

        if (shouldApplyImmediately) {
          applyFeed(data.feed, data.timecode);
        } else {
          const timer = window.setTimeout(() => {
            applyFeed(data.feed as LiveGameResponse, data.timecode);
            delayedFeedTimers.current = delayedFeedTimers.current.filter(
              (activeTimer) => activeTimer !== timer
            );
          }, feedDelaySeconds * 1000);

          delayedFeedTimers.current.push(timer);
        }
      }
    } catch {
      setError("Could not load live feed.");
    } finally {
      setLoading(false);
    }
  }, [
    applyFeed,
    clearDelayedFeeds,
    feedDelaySeconds,
    gamePk,
    holdVisibleUpdates,
    onRawFeedUpdate,
    timecode,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFeed();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadFeed();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [loadFeed]);

  return {
    feed,
    loading,
    error,
    refresh: loadFeed,
    checkedAt,
    timecode,
  };
}

function MiniScoreboard({ feed }: { feed: LiveGameResponse }) {
  return (
    <section className="grid gap-3 rounded-[24px] border border-[#444a50] bg-[#292c30] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#747a81]">
            Away
          </p>
          <p className="mt-1 text-3xl font-medium">{feed.away.abbreviation}</p>
        </div>
        <p className="text-4xl font-medium">{feed.away.score ?? "-"}</p>
      </div>

      <div className="hidden h-12 w-px bg-[#3c4147] sm:block" />

      <div className="flex items-center justify-between gap-4 sm:flex-row-reverse">
        <div className="sm:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#747a81]">
            Home
          </p>
          <p className="mt-1 text-3xl font-medium">{feed.home.abbreviation}</p>
        </div>
        <p className="text-4xl font-medium">{feed.home.score ?? "-"}</p>
      </div>
    </section>
  );
}

export default function LiveGameClient({ gamePk }: { gamePk: string }) {
  const [pitchType, setPitchType] = useState("");
  const [guessPoint, setGuessPoint] = useState<PitchPoint | null>(null);
  const [pendingGuess, setPendingGuess] = useState<PendingGuess | null>(null);
  const [lastResult, setLastResult] = useState<ScoredPitch | null>(null);
  const [results, setResults] = useState<ScoredPitch[]>([]);
  const [view, setView] = useState<PitchView>("catcher");
  const [revealDelaySeconds, setRevealDelaySeconds] = useState(
    getInitialRevealDelay
  );
  const [calibration, setCalibration] = useState<Calibration>({ status: "idle" });
  const latestRawPitchCount = useRef(0);

  const handleFeedUpdate = useCallback(
    (nextFeed: LiveGameResponse) => {
      if (
        !pendingGuess ||
        nextFeed.pitchCount <= pendingGuess.baselineSequence
      ) {
        return;
      }

      const revealedPitch = nextFeed.recentPitches.find(
        (pitch) => pitch.sequence > pendingGuess.baselineSequence
      );

      if (!revealedPitch) {
        return;
      }

      const scoredPitch = scorePitch(pendingGuess, revealedPitch);

      setResults((currentResults) => {
        if (currentResults.some((result) => result.id === scoredPitch.id)) {
          return currentResults;
        }

        return [...currentResults, scoredPitch];
      });
      setLastResult(scoredPitch);
      setPendingGuess(null);
      setGuessPoint(null);
      setPitchType("");
    },
    [pendingGuess]
  );

  const handleRawFeedUpdate = useCallback(
    (nextFeed: LiveGameResponse, receivedAtMs: number, timecode: string) => {
      latestRawPitchCount.current = Math.max(
        latestRawPitchCount.current,
        nextFeed.pitchCount
      );

      setCalibration((currentCalibration) => {
        if (
          currentCalibration.status !== "waiting" ||
          nextFeed.pitchCount <= currentCalibration.baselinePitchCount
        ) {
          return currentCalibration;
        }

        const calibrationPitch =
          nextFeed.recentPitches.find(
            (pitch) => pitch.sequence > currentCalibration.baselinePitchCount
          ) ?? nextFeed.latestPitch;

        if (!calibrationPitch) {
          return currentCalibration;
        }

        return {
          status: "ready",
          baselinePitchCount: currentCalibration.baselinePitchCount,
          pitchSequence: calibrationPitch.sequence,
          receivedAtMs,
          timecode,
        };
      });
    },
    []
  );

  const isCalibrating =
    calibration.status === "waiting" || calibration.status === "ready";

  const { feed, loading, error, refresh, checkedAt } = useLiveFeed(
    gamePk,
    revealDelaySeconds,
    isCalibrating,
    handleFeedUpdate,
    handleRawFeedUpdate
  );

  const canPlay = Boolean(feed?.status.isLive && feed.currentAtBat);
  const targetBatterSide = normalizeBatterSide(
    lastResult?.pitch.batterSide ??
      feed?.currentAtBat?.batterSide ??
      feed?.latestPitch?.batterSide
  );
  const actualPoint = lastResult
    ? plateCoordinatesToPoint(
        lastResult.pitch.plateX,
        lastResult.pitch.plateZ,
        lastResult.pitch.batterSide
      )
    : null;
  const totalScore = useMemo(
    () => results.reduce((sum, result) => sum + result.totalScore, 0),
    [results]
  );
  const pitchAccuracy = useMemo(() => {
    if (!results.length) {
      return 0;
    }

    return Math.round(
      (results.filter((result) => result.pitchTypeScore === 100).length /
        results.length) *
      100
    );
  }, [results]);
  const delayIsPreset = REVEAL_DELAY_OPTIONS.includes(revealDelaySeconds);
  const revealDelayLabel =
    revealDelaySeconds === 0 ? "Off" : `${revealDelaySeconds}s`;

  function lockGuess() {
    if (!feed || !pitchType || !guessPoint || !canPlay || pendingGuess) {
      return;
    }

    setLastResult(null);
    setPendingGuess({
      pitchType,
      point: guessPoint,
      baselineSequence: feed.pitchCount,
    });
  }

  function chooseRevealDelay(delaySeconds: number) {
    const normalizedDelay = normalizeRevealDelay(delaySeconds);
    setRevealDelaySeconds(normalizedDelay);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        REVEAL_DELAY_STORAGE_KEY,
        String(normalizedDelay)
      );
    }

    if (normalizedDelay === 0) {
      void refresh(true);
    }
  }

  function startCalibration() {
    if (!feed) {
      return;
    }

    latestRawPitchCount.current = Math.max(
      latestRawPitchCount.current,
      feed.pitchCount
    );
    setCalibration({
      status: "waiting",
      baselinePitchCount: latestRawPitchCount.current,
    });
  }

  function cancelCalibration() {
    setCalibration({ status: "idle" });
    void refresh(true);
  }

  function sawCalibrationPitch() {
    if (calibration.status !== "ready") {
      return;
    }

    const measuredSeconds = Math.max(
      0,
      (performance.now() - calibration.receivedAtMs) / 1000
    );
    const delaySeconds =
      measuredSeconds < CALIBRATION_REACTION_GRACE_SECONDS
        ? 0
        : normalizeRevealDelay(
            Math.ceil(measuredSeconds + CALIBRATION_SAFETY_BUFFER_SECONDS)
          );

    chooseRevealDelay(delaySeconds);
    setCalibration({
      status: "set",
      delaySeconds,
      measuredSeconds,
      pitchSequence: calibration.pitchSequence,
    });
    void refresh(true);
  }

  return (
    <main className="min-h-screen bg-[#202225] px-4 py-5 text-[#f5f5f1] sm:px-6 sm:py-7">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-[#3c4147] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/live"
              className="text-sm font-medium uppercase tracking-[0.16em] text-[#a0a4aa] transition hover:text-[#dcff00]"
            >
              Live Games
            </Link>
            <h1 className="mt-2 text-4xl font-medium sm:text-5xl">
              Perfect Pitch Live
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] ${
                feed?.status.isLive
                  ? "border-[#dcff00] bg-[#dcff00] text-[#17191b]"
                  : "border-[#444a50] bg-[#292c30] text-[#c9ccd0]"
              }`}
            >
              {feed?.status.detailedState ?? "Loading"}
            </span>
            <button
              onClick={() => void refresh(false)}
              className="rounded-xl border border-[#444a50] bg-[#292c30] px-3 py-2 text-sm font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-[20px] border border-[#7a3b3b] bg-[#332626] p-4 text-[#f5c7c7]">
            {error}
          </div>
        )}

        {loading && (
          <div className="h-[560px] animate-pulse rounded-[24px] border border-[#3c4147] bg-[#292c30]" />
        )}

        {!loading && feed && (
          <>
            <MiniScoreboard feed={feed} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-[24px] border border-[#444a50] bg-[#292c30] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#dcff00]">
                      {feed.inningState && feed.inning
                        ? `${feed.inningState} ${feed.inning}`
                        : feed.status.detailedState}
                    </p>
                    <h2 className="mt-1 text-2xl font-medium">
                      {feed.currentAtBat
                        ? `${feed.currentAtBat.batter} vs ${feed.currentAtBat.pitcher}`
                        : "Waiting for the next at-bat"}
                    </h2>
                    <p className="mt-1 text-sm text-[#a0a4aa]">
                      {feed.currentAtBat
                        ? countLabel(
                            feed.currentAtBat.balls,
                            feed.currentAtBat.strikes,
                            feed.currentAtBat.outs
                          )
                        : countLabel(feed.balls, feed.strikes, feed.outs)}
                    </p>
                  </div>

                  <div className="flex rounded-full border border-[#444a50] bg-[#202225] p-0.5">
                    <button
                      onClick={() => setView("catcher")}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        view === "catcher"
                          ? "bg-[#4a5360] text-[#f5f5f1]"
                          : "text-[#747a81] hover:text-[#c9ccd0]"
                      }`}
                    >
                      Catcher
                    </button>
                    <button
                      onClick={() => setView("pitcher")}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        view === "pitcher"
                          ? "bg-[#4a5360] text-[#f5f5f1]"
                          : "text-[#747a81] hover:text-[#c9ccd0]"
                      }`}
                    >
                      Pitcher
                    </button>
                  </div>
                </div>

                {!pitchType && !pendingGuess && (
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PITCH_OPTIONS.map((option) => (
                      <button
                        key={option}
                        disabled={!canPlay}
                        onClick={() => {
                          setPitchType(option);
                          setGuessPoint(null);
                          setLastResult(null);
                        }}
                        className="min-h-12 rounded-2xl border border-[#444a50] bg-[#202225] px-3 py-2 text-sm font-medium text-[#f5f5f1] transition hover:border-[#596068] hover:bg-[#33373c] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {(pitchType || pendingGuess || lastResult) && (
                  <div className="mt-5">
                    <div className="mb-2 flex min-h-[48px] items-center justify-center text-center">
                      {pendingGuess ? (
                        <p className="text-sm font-medium text-[#dcff00]">
                          Locked: {pendingGuess.pitchType}
                        </p>
                      ) : pitchType ? (
                        <div className="flex items-center gap-3 text-sm">
                          <p className="text-[#c9ccd0]">
                            Selected:{" "}
                            <span className="font-medium text-[#f5f5f1]">
                              {pitchType}
                            </span>
                          </p>
                          <button
                            onClick={() => {
                              setPitchType("");
                              setGuessPoint(null);
                            }}
                            className="rounded-lg border border-[#444a50] bg-[#202225] px-2.5 py-1.5 text-xs font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
                          >
                            Back
                          </button>
                        </div>
                      ) : lastResult ? (
                        <div>
                          <p className="text-sm font-medium text-[#f5f5f1]">
                            {speedLabel(lastResult.pitch.velocity)}{" "}
                            {lastResult.pitch.pitchType}
                          </p>
                          <p className="text-sm text-[#a0a4aa]">
                            {lastResult.pitch.outcome}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-col items-center">
                      <PitchTarget
                        enabled={canPlay && Boolean(pitchType) && !pendingGuess}
                        batterSide={targetBatterSide}
                        guessPoint={guessPoint}
                        actualPoint={actualPoint}
                        lockedPoint={pendingGuess?.point ?? null}
                        view={view}
                        onPick={setGuessPoint}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex min-h-[80px] flex-col items-center justify-center gap-3 text-center">
                  {pendingGuess ? (
                    <>
                      <p className="text-sm text-[#a0a4aa]">
                        Waiting on pitch {pendingGuess.baselineSequence + 1}
                      </p>
                    </>
                  ) : (
                    <>
                      {pitchType && (
                        <button
                          disabled={!canPlay || !guessPoint}
                          onClick={lockGuess}
                          className="rounded-2xl bg-[#dcff00] px-8 py-3 font-medium text-[#17191b] shadow-[0_4px_0_#91a800] transition hover:bg-[#c8e900] active:translate-y-[3px] active:shadow-[0_1px_0_#91a800] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#dcff00]"
                        >
                          Lock In
                        </button>
                      )}
                      {!canPlay && (
                        <p className="text-sm text-[#a0a4aa]">
                          {feed.status.isFinal
                            ? "This game is final."
                            : "Live pitch feed is not active yet."}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </section>

              <aside className="flex flex-col gap-4">
                <section className="rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#747a81]">
                      Reveal Delay
                    </p>
                    <p className="text-xs font-medium text-[#a0a4aa]">
                      Checked {formatTime(checkedAt)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {REVEAL_DELAY_OPTIONS.map((delaySeconds) => (
                      <button
                        key={delaySeconds}
                        onClick={() => chooseRevealDelay(delaySeconds)}
                        className={`h-10 rounded-xl border text-sm font-medium transition ${
                          revealDelaySeconds === delaySeconds
                            ? "border-[#dcff00] bg-[#dcff00] text-[#17191b]"
                            : "border-[#444a50] bg-[#202225] text-[#c9ccd0] hover:border-[#596068] hover:text-[#f5f5f1]"
                        }`}
                      >
                        {delaySeconds === 0 ? "Off" : `${delaySeconds}s`}
                      </button>
                    ))}
                  </div>

                  <p className="mt-3 text-sm text-[#a0a4aa]">
                    {revealDelaySeconds === 0
                      ? "Fastest available MLB feed."
                      : `${revealDelaySeconds}s behind MLB feed updates.`}
                  </p>

                  {!delayIsPreset && (
                    <p className="mt-2 text-sm font-medium text-[#dcff00]">
                      Calibrated: {revealDelayLabel}
                    </p>
                  )}

                  <div className="mt-4 border-t border-[#3c4147] pt-4">
                    {calibration.status === "idle" && (
                      <button
                        disabled={!feed}
                        onClick={startCalibration}
                        className="w-full rounded-2xl border border-[#444a50] bg-[#202225] px-4 py-3 text-sm font-medium text-[#f5f5f1] transition hover:border-[#596068] hover:bg-[#33373c] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Calibrate With Stream
                      </button>
                    )}

                    {calibration.status === "waiting" && (
                      <div className="grid gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#dcff00]">
                            Waiting for next pitch
                          </p>
                          <p className="mt-1 text-sm text-[#a0a4aa]">
                            MLB feed held at pitch{" "}
                            {calibration.baselinePitchCount}.
                          </p>
                        </div>
                        <button
                          onClick={cancelCalibration}
                          className="rounded-2xl border border-[#444a50] bg-[#202225] px-4 py-3 text-sm font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {calibration.status === "ready" && (
                      <div className="grid gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#dcff00]">
                            Pitch detected
                          </p>
                          <p className="mt-1 text-sm text-[#a0a4aa]">
                            Tap when it crosses the plate.
                          </p>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <button
                            onClick={sawCalibrationPitch}
                            className="rounded-2xl bg-[#dcff00] px-4 py-3 text-sm font-medium text-[#17191b] shadow-[0_4px_0_#91a800] transition hover:bg-[#c8e900] active:translate-y-[3px] active:shadow-[0_1px_0_#91a800]"
                          >
                            Saw Pitch
                          </button>
                          <button
                            onClick={cancelCalibration}
                            className="rounded-2xl border border-[#444a50] bg-[#202225] px-4 py-3 text-sm font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {calibration.status === "set" && (
                      <div className="grid gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#dcff00]">
                            Set to{" "}
                            {calibration.delaySeconds === 0
                              ? "no delay"
                              : `${calibration.delaySeconds}s`}
                          </p>
                          <p className="mt-1 text-sm text-[#a0a4aa]">
                            Measured {Math.round(calibration.measuredSeconds)}s
                            on pitch {calibration.pitchSequence}.
                          </p>
                        </div>
                        <button
                          onClick={startCalibration}
                          className="rounded-2xl border border-[#444a50] bg-[#202225] px-4 py-3 text-sm font-medium text-[#f5f5f1] transition hover:border-[#596068] hover:bg-[#33373c]"
                        >
                          Calibrate Again
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#747a81]">
                    Score
                  </p>
                  <p className="mt-2 text-6xl font-medium text-[#dcff00]">
                    {totalScore}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-[#202225] p-3">
                      <p className="text-[#747a81]">Reads</p>
                      <p className="mt-1 text-2xl font-medium">{results.length}</p>
                    </div>
                    <div className="rounded-2xl bg-[#202225] p-3">
                      <p className="text-[#747a81]">Type</p>
                      <p className="mt-1 text-2xl font-medium">{pitchAccuracy}%</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#747a81]">
                    Last Pitch
                  </p>
                  {lastResult ? (
                    <div className="mt-3">
                      <p className="text-2xl font-medium">
                        {speedLabel(lastResult.pitch.velocity)}{" "}
                        {lastResult.pitch.pitchType}
                      </p>
                      <p className="mt-1 text-sm text-[#a0a4aa]">
                        {lastResult.pitch.outcome}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-2xl bg-[#202225] p-3">
                          <p className="text-[#747a81]">Loc</p>
                          <p className="mt-1 font-medium">
                            {lastResult.locationScore}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#202225] p-3">
                          <p className="text-[#747a81]">Type</p>
                          <p className="mt-1 font-medium">
                            {lastResult.pitchTypeScore}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#202225] p-3">
                          <p className="text-[#747a81]">Total</p>
                          <p className="mt-1 font-medium text-[#dcff00]">
                            {lastResult.totalScore}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : feed.latestPitch ? (
                    <div className="mt-3">
                      <p className="text-xl font-medium">
                        {speedLabel(feed.latestPitch.velocity)}{" "}
                        {feed.latestPitch.pitchType}
                      </p>
                      <p className="mt-1 text-sm text-[#a0a4aa]">
                        {feed.latestPitch.outcome}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-[#a0a4aa]">No pitches yet.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#747a81]">
                    Feed
                  </p>
                  <div className="mt-3 space-y-3">
                    {results.slice(-5).reverse().map((result) => (
                      <div
                        key={result.id}
                        className="border-t border-[#3c4147] pt-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{result.pitch.pitchType}</p>
                          <p className="text-[#dcff00]">{result.totalScore}</p>
                        </div>
                        <p className="mt-1 text-[#a0a4aa]">
                          Guessed {result.guessedPitchType}
                        </p>
                      </div>
                    ))}
                    {!results.length && (
                      <p className="text-sm text-[#a0a4aa]">No locked reads yet.</p>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
