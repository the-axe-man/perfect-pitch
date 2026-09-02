"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PitchTarget,
  normalizeBatterSide,
  plateCoordinatesToPoint,
  type PitchPoint,
  type PitchView,
} from "@/components/PitchTarget";
import { challenges } from "@/lib/challenges";

const pitchTypes = [
  "Four-Seam Fastball",
  "Slider",
  "Changeup",
  "Curveball",
  "Sinker",
  "Cutter",
  "Splitter",
  "Sweeper",
];

type PitchResult = {
  pitchNumber: number;
  actualPitchType: string;
  guessedPitchType: string;
  outcome: string;
  locationScore: number;
  pitchTypeScore: number;
  totalScore: number;
};

export default function PlayPage() {
  return (
    <Suspense>
      <PlayGame />
    </Suspense>
  );
}

function PlayGame() {
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge") ?? challenges[0].id;

  const selectedChallenge =
    challenges.find((challenge) => challenge.id === challengeId) ?? challenges[0];

  const challenge = selectedChallenge.data;
  const samplePitches = challenge.pitches;

  const [pitchIndex, setPitchIndex] = useState(0);
  const [guess, setGuess] = useState<PitchPoint | null>(null);
  const [pitchType, setPitchType] = useState("");
  const [stage, setStage] = useState<"type" | "location">("type");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<PitchResult[]>([]);
  const [gameComplete, setGameComplete] = useState(false);
  const [view, setView] = useState<PitchView>("catcher");
  const [showPitchDetails, setShowPitchDetails] = useState(false);

  const actualPitch = samplePitches[pitchIndex];
  const batterSide = normalizeBatterSide(challenge.batterSide);
  const actualPoint = plateCoordinatesToPoint(
    actualPitch.plateX,
    actualPitch.plateZ,
    {
      top: actualPitch.strikeZoneTop,
      bottom: actualPitch.strikeZoneBottom,
    }
  );

  function getScore() {
    if (!guess) return null;

    const distance = actualPoint
      ? Math.sqrt(
          Math.pow(guess.x - actualPoint.x, 2) +
            Math.pow(guess.y - actualPoint.y, 2)
        )
      : 760;

    const locationScore = Math.max(0, Math.round(100 - distance / 2));
    const pitchTypeScore = pitchType === actualPitch.pitchType ? 100 : 0;
    const totalScore = locationScore + pitchTypeScore;

    return { locationScore, pitchTypeScore, totalScore };
  }

  function lockInGuess() {
    const score = getScore();
    if (!score) return;

    setResults([
      ...results,
      {
        pitchNumber: pitchIndex + 1,
        actualPitchType: actualPitch.pitchType,
        guessedPitchType: pitchType,
        outcome: actualPitch.outcome,
        locationScore: score.locationScore,
        pitchTypeScore: score.pitchTypeScore,
        totalScore: score.totalScore,
      },
    ]);

    setRevealed(true);
  }

  function nextPitch() {
    if (pitchIndex < samplePitches.length - 1) {
      setPitchIndex(pitchIndex + 1);
      setGuess(null);
      setPitchType("");
      setStage("type");
      setRevealed(false);
    } else {
      setGameComplete(true);
    }
  }

  const score = getScore();

  const finalScore = results.reduce((sum, result) => sum + result.totalScore, 0);
  const locationTotal = results.reduce(
    (sum, result) => sum + result.locationScore,
    0
  );

  const pitchTypeTotal = results.reduce(
    (sum, result) => sum + result.pitchTypeScore,
    0
  );

  const perfectPitchTypes =
    results.length > 0 && results.every((result) => result.pitchTypeScore === 100);

  const sniper =
    results.length > 0 && results.every((result) => result.locationScore >= 80);

  const painter =
    results.length > 0 &&
    results.some((result) => result.locationScore >= 95);

  const lockedIn = finalScore >= 500;

  if (gameComplete) {
    return (
      <main className="min-h-screen bg-[#202225] text-[#f5f5f1] flex flex-col items-center p-6">
        <section className="w-full max-w-md text-center">
          <Link
            href="/"
            className="text-3xl font-medium tracking-[-0.03em] transition-colors hover:text-[#dcff00]"
          >
            Perfect Pitch
          </Link>
          <p className="mt-2 text-[#a0a4aa]">{challenge.title}</p>
          <div className="mt-6 rounded-[28px] border border-[#444a50] bg-[#292c30] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#747a81]">
              Final Score
            </p>
            <p className="mt-3 text-7xl font-medium text-[#dcff00]">
              {finalScore}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#202225] p-4">
                <p className="text-xs uppercase tracking-wide text-[#747a81]">
                  Location
                </p>
                <p className="mt-1 text-3xl font-medium">{locationTotal}</p>
              </div>
              <div className="rounded-2xl bg-[#202225] p-4">
                <p className="text-xs uppercase tracking-wide text-[#747a81]">
                  Pitch Type
                </p>
                <p className="mt-1 text-3xl font-medium">{pitchTypeTotal}</p>
              </div>
            </div>
          </div>
          <section className="mt-5 rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <h2 className="text-xl font-medium">Achievements</h2>
            <div className="mt-4 space-y-4 text-[#e7e8e5]">
              {perfectPitchTypes && (
                <div>
                  <p className="font-medium">🧠 Ball Knower</p>
                  <p className="mt-1 text-sm text-[#a0a4aa]">
                    Correctly predicted every pitch type in the at-bat.
                  </p>
                </div>
              )}

              {sniper && (
                <div>
                  <p className="font-medium">🎯 Sniper</p>
                  <p className="mt-1 text-sm text-[#a0a4aa]">
                    Scored 80+ on location for every pitch.
                  </p>
                </div>
              )}

              {painter && (
                <div>
                  <p className="font-medium">🖌️ Painter</p>
                  <p className="mt-1 text-sm text-[#a0a4aa]">
                    Scored 95+ on location on at least one pitch.
                  </p>
                </div>
              )}

              {lockedIn && (
                <div>
                  <p className="font-medium">🔥 Locked In</p>
                  <p className="mt-1 text-sm text-[#a0a4aa]">
                    Scored 500+ total points in the at-bat.
                  </p>
                </div>
              )}

              {!perfectPitchTypes && !sniper && !painter && !lockedIn && (
                <p className="text-[#a0a4aa]">No achievements this time.</p>
              )}
            </div>
          </section>
          <section className="mt-5 rounded-[24px] border border-[#444a50] bg-[#292c30] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <button
              onClick={() => setShowPitchDetails(!showPitchDetails)}
              className="flex w-full items-center justify-between text-left font-medium text-[#e7e8e5] transition hover:text-[#dcff00]"
            >
              {showPitchDetails ? "Hide Pitch Details ↑" : "Show Pitch Details ↓"}
            </button>
            {showPitchDetails && (
              <div className="mt-4 space-y-3 text-left">
                {results.map((result) => (
                  <div
                    key={result.pitchNumber}
                    className="border-t border-[#3c4147] pt-3"
                  >
                    <p className="font-medium">Pitch {result.pitchNumber}</p>
                    <p className="text-[#c9ccd0]">
                      Guessed {result.guessedPitchType} · Actual{" "}
                      {result.actualPitchType}
                    </p>
                    <p className="text-[#a0a4aa]">{result.outcome}</p>
                    <p className="text-[#dcff00]">
                      {result.locationScore} location + {result.pitchTypeScore} type ={" "}
                      {result.totalScore}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
          <Link
            href="/"
            className="mt-6 inline-block rounded-2xl bg-[#dcff00] px-8 py-3.5 font-medium text-[#17191b] shadow-[0_4px_0_#91a800] transition hover:bg-[#c8e900] active:translate-y-[3px] active:shadow-[0_1px_0_#91a800]"
          >
            Back to Challenges
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#202225] text-[#f5f5f1] flex flex-col items-center p-4">
      <Link
        href="/"
        className="text-3xl font-medium tracking-[-0.03em] transition-colors hover:text-[#dcff00]"
      >
        Perfect Pitch
      </Link>

      <section className="mt-3 mb-4 text-center">
        <p className="text-sm text-[#c9ccd0]">
          <span className="font-medium text-[#f5f5f1]">
            {actualPitch.awayTeam} {actualPitch.awayScore} ·{" "}
            {actualPitch.homeTeam} {actualPitch.homeScore}
          </span>
          <span className="mx-2 text-[#596068]">|</span>
          {actualPitch.inning}
          <span className="mx-2 text-[#596068]">|</span>
          {actualPitch.outs} Out
          <span className="mx-2 text-[#596068]">|</span>
          {actualPitch.count} Count
        </p>

        <p className="text-sm text-[#a0a4aa] mt-1">
          {actualPitch.batter} vs {actualPitch.pitcher}
        </p>
      </section>

      {!revealed && stage === "type" && (
        <section className="w-full max-w-md text-center">
          <h2 className="mt-4 text-2xl font-medium">
            What pitch is coming next?
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {pitchTypes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  setPitchType(type);
                  setStage("location");
                }}
                className="rounded-2xl border border-[#444a50] bg-[#292c30] px-4 py-4 text-lg font-medium text-[#f5f5f1] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[#596068] hover:bg-[#33373c] active:scale-[0.98]"
              >
                {type}
              </button>
            ))}
          </div>
        </section>
      )}

      {stage === "location" && (
        <section className="flex w-full flex-col items-center">
          {/* Keep this row a fixed height so the field never jumps between guess/reveal states. */}
          <div className="mb-2 flex h-[52px] items-center justify-center">
            {!revealed ? (
              <div className="flex items-center gap-3 text-sm">
                <p className="text-[#c9ccd0]">
                  Selected:{" "}
                  <span className="font-medium text-[#f5f5f1]">{pitchType}</span>
                </p>
                <button
                  onClick={() => {
                    setPitchType("");
                    setGuess(null);
                    setStage("type");
                  }}
                  className="rounded-lg border border-[#444a50] bg-[#292c30] px-2.5 py-1.5 text-xs font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
                >
                  Back
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium text-[#f5f5f1]">
                  {actualPitch.velocity} mph {actualPitch.pitchType}
                </p>
                <p className="text-sm text-[#a0a4aa]">{actualPitch.outcome}</p>
              </div>
            )}
          </div>

          <PitchTarget
            enabled={!revealed}
            batterSide={batterSide}
            guessPoint={guess}
            actualPoint={revealed ? actualPoint : null}
            lockedPoint={null}
            strikeZoneBottom={actualPitch.strikeZoneBottom}
            strikeZoneTop={actualPitch.strikeZoneTop}
            view={view}
            onPick={setGuess}
          />

          {/* Compact, single-line perspective control. */}
          <div className="mt-2 flex h-[34px] items-center justify-center gap-2">
            <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#747a81]">
              Perspective
            </p>

            <div className="flex rounded-full border border-[#444a50] bg-[#202225] p-0.5">
              <button
                onClick={() => setView("catcher")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  view === "catcher"
                    ? "bg-[#4a5360] text-[#f5f5f1]"
                    : "text-[#747a81] hover:text-[#c9ccd0]"
                }`}
              >
                Catcher
              </button>

              <button
                onClick={() => setView("pitcher")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  view === "pitcher"
                    ? "bg-[#4a5360] text-[#f5f5f1]"
                    : "text-[#747a81] hover:text-[#c9ccd0]"
                }`}
              >
                Pitcher
              </button>
            </div>
          </div>

          {/* This fixed action slot is used before AND after reveal, so nothing moves. */}
          <div className="mt-3 flex h-[112px] flex-col items-center">
            {!revealed ? (
              <button
                aria-disabled={!(guess && pitchType)}
                onClick={() => {
                  if (!(guess && pitchType)) return;
                  lockInGuess();
                }}
                className={`rounded-2xl bg-[#dcff00] px-8 py-3 font-medium text-[#17191b] shadow-[0_4px_0_#91a800] transition active:translate-y-[3px] active:shadow-[0_1px_0_#91a800] ${
                  !(guess && pitchType) ? "cursor-not-allowed opacity-40" : "hover:bg-[#c8e900]"
                }`}
              >
                Lock In
              </button>
            ) : (
              score && (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-5 text-sm">
                    <p className="text-[#a0a4aa]">
                      Location{" "}
                      <span className="font-medium text-[#f5f5f1]">
                        {score.locationScore}
                      </span>
                    </p>

                    <span className="text-[#596068]">|</span>

                    <p className="text-[#a0a4aa]">
                      Pitch Type{" "}
                      <span className="font-medium text-[#f5f5f1]">
                        {score.pitchTypeScore}
                      </span>
                    </p>

                    <span className="text-[#596068]">|</span>

                    <p className="text-[#a0a4aa]">
                      Total{" "}
                      <span className="font-medium text-[#dcff00]">
                        {score.totalScore}
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={nextPitch}
                    className="mt-3 rounded-2xl bg-[#dcff00] px-8 py-3 font-medium text-[#17191b] shadow-[0_4px_0_#91a800] transition hover:bg-[#c8e900] active:translate-y-[3px] active:shadow-[0_1px_0_#91a800]"
                  >
                    {pitchIndex === samplePitches.length - 1
                      ? "See Results"
                      : "Next Pitch"}
                  </button>
                </div>
              )
            )}
          </div>
        </section>
      )}

    </main>
  );
}
