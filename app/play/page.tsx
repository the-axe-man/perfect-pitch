"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const [pitchType, setPitchType] = useState("");
  const [stage, setStage] = useState<"type" | "location">("type");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<PitchResult[]>([]);
  const [gameComplete, setGameComplete] = useState(false);
  const [view, setView] = useState<"catcher" | "pitcher">("catcher");
  const [showPitchDetails, setShowPitchDetails] = useState(false);

  const actualPitch = samplePitches[pitchIndex];

  const canvasWidth = 430;
  const zoneLeft = 90;
  const zoneTop = 55;
  const zoneWidth = 250;
  const zoneHeight = 255;

  function plateXToScreen(plateX: number) {
    return Math.round(zoneLeft + ((plateX + 2) / 4) * zoneWidth);
  }

  function plateZToScreen(plateZ: number) {
    return Math.round(zoneTop + zoneHeight - (plateZ / 5) * zoneHeight);
  }

  const actualCatcherX = plateXToScreen(actualPitch.plateX);
  const actualY = plateZToScreen(actualPitch.plateZ);

  const actualX =
    view === "pitcher" ? canvasWidth - actualCatcherX : actualCatcherX;

  const displayedGuess =
    guess && view === "pitcher"
      ? { x: canvasWidth - guess.x, y: guess.y }
      : guess;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (revealed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickedX = e.clientX - rect.left;
    const clickedY = e.clientY - rect.top;

    setGuess({
      x: view === "pitcher" ? canvasWidth - clickedX : clickedX,
      y: clickedY,
    });
  }

  function getScore() {
    if (!guess) return null;

    const distance = Math.sqrt(
      Math.pow(guess.x - actualCatcherX, 2) + Math.pow(guess.y - actualY, 2)
    );

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

  const pitchTypeAccuracy =
    results.length > 0
      ? Math.round(
          (results.filter((result) => result.pitchTypeScore === 100).length /
            results.length) *
            100
        )
      : 0;

  const averageLocation =
    results.length > 0 ? Math.round(locationTotal / results.length) : 0;

  const perfectPitchTypes =
    results.length > 0 && results.every((result) => result.pitchTypeScore === 100);

  const sniper =
    results.length > 0 && results.every((result) => result.locationScore >= 80);

  const painter = results.length > 0 && averageLocation >= 85;
  const lockedIn = finalScore >= 500;

  if (gameComplete) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-6">
        <section className="w-full max-w-md text-center">
          <Link
            href="/"
            className="text-3xl font-bold hover:text-yellow-400 transition-colors"
          >
            Perfect Pitch
          </Link>
          <p className="mt-2 text-slate-400">{challenge.title}</p>
          <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
              Final Score
            </p>
            <p className="mt-3 text-7xl font-black text-yellow-400">
              {finalScore}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Location
                </p>
                <p className="mt-1 text-3xl font-bold">{averageLocation}</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Pitch Type
                </p>
                <p className="mt-1 text-3xl font-bold">{pitchTypeAccuracy}%</p>
              </div>
            </div>
          </div>
          <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900 p-5 text-left">
            <h2 className="text-xl font-bold">Achievements</h2>
            <div className="mt-3 space-y-2 text-slate-200">
              {perfectPitchTypes && <p>🧠 Ball Knower</p>}
              {sniper && <p>🎯 Sniper</p>}
              {painter && <p>🖌️ Painter</p>}
              {lockedIn && <p>🔥 Locked In</p>}
              {!perfectPitchTypes && !sniper && !painter && !lockedIn && (
                <p className="text-slate-400">No achievements this time.</p>
              )}
            </div>
          </section>
          <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900 p-5">
            <button
              onClick={() => setShowPitchDetails(!showPitchDetails)}
              className="w-full text-left font-bold text-slate-200"
            >
              {showPitchDetails ? "Hide Pitch Details ↑" : "Show Pitch Details ↓"}
            </button>
            {showPitchDetails && (
              <div className="mt-4 space-y-3 text-left">
                {results.map((result) => (
                  <div
                    key={result.pitchNumber}
                    className="border-t border-slate-800 pt-3"
                  >
                    <p className="font-bold">Pitch {result.pitchNumber}</p>
                    <p className="text-slate-300">
                      Guessed {result.guessedPitchType} · Actual{" "}
                      {result.actualPitchType}
                    </p>
                    <p className="text-slate-400">{result.outcome}</p>
                    <p className="text-yellow-400">
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
            className="mt-6 inline-block rounded bg-yellow-400 px-8 py-3 font-bold text-slate-950 hover:bg-yellow-300 transition-colors"
          >
            Back to Challenges
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4">
      <Link
        href="/"
        className="text-3xl font-bold hover:text-yellow-400 transition-colors"
      >
        Perfect Pitch
      </Link>

      <section className="mt-3 mb-4 text-center">
        <p className="text-sm text-slate-300">
          <span className="font-bold text-white">
            {actualPitch.awayTeam} {actualPitch.awayScore} ·{" "}
            {actualPitch.homeTeam} {actualPitch.homeScore}
          </span>
          <span className="mx-2 text-slate-600">|</span>
          {actualPitch.inning}
          <span className="mx-2 text-slate-600">|</span>
          {actualPitch.outs} Out
          <span className="mx-2 text-slate-600">|</span>
          {actualPitch.count} Count
        </p>

        <p className="text-sm text-slate-400 mt-1">
          {actualPitch.batter} vs {actualPitch.pitcher}
        </p>
      </section>

      {!revealed && stage === "type" && (
        <section className="w-full max-w-md text-center">
          <h2 className="mt-4 text-2xl font-bold">
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
                className="px-4 py-3 rounded border bg-slate-900 text-white border-slate-600 text-lg"
              >
                {type}
              </button>
            ))}
          </div>
        </section>
      )}

      {stage === "location" && (
        <section className="flex flex-col items-center">
          {!revealed && (
            <div className="mb-2 flex items-center gap-4">
              <p className="text-sm text-slate-300">
                Selected:{" "}
                <span className="font-bold text-white">{pitchType}</span>
              </p>

              <button
                aria-disabled={!(guess && pitchType)}
                onClick={() => {
                  if (!(guess && pitchType)) return;
                  lockInGuess();
                }}
                className={`px-5 py-2 rounded bg-yellow-400 text-slate-950 font-bold ${
                  !(guess && pitchType) ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                Lock In
              </button>
            </div>
          )}

          <div
            onClick={handleClick}
            className="relative h-[420px] w-[430px] cursor-crosshair overflow-visible"
          >
            <div className="absolute left-[90px] top-[55px] h-[255px] w-[250px] border-2 border-orange-500">
              <div className="absolute left-1/3 top-0 h-full border-l border-dashed border-slate-600" />
              <div className="absolute left-2/3 top-0 h-full border-l border-dashed border-slate-600" />
              <div className="absolute top-1/3 left-0 w-full border-t border-dashed border-slate-600" />
              <div className="absolute top-2/3 left-0 w-full border-t border-dashed border-slate-600" />
            </div>

            <div
              className="absolute left-1/2 bottom-0 h-7 w-[250px] -translate-x-1/2 bg-slate-800/80"
              style={{
                clipPath:
                  view === "catcher"
                    ? "polygon(8% 0, 92% 0, 100% 55%, 50% 100%, 0 55%)"
                    : "polygon(50% 0, 92% 55%, 100% 100%, 0 100%, 8% 55%)",
              }}
            />

            {displayedGuess && (
              <div
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-300 bg-transparent"
                style={{ left: displayedGuess.x, top: displayedGuess.y }}
              />
            )}

            {revealed && (
              <>
                {displayedGuess && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    <line
                      x1={displayedGuess.x}
                      y1={displayedGuess.y}
                      x2={actualX}
                      y2={actualY}
                      stroke="rgb(203 213 225)"
                      strokeWidth="3"
                      strokeDasharray="8 8"
                    />
                  </svg>
                )}

                <div
                  className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500"
                  style={{ left: actualX, top: actualY }}
                />
              </>
            )}
          </div>

          {!revealed && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Perspective
              </p>

              <div className="flex rounded-full border border-slate-700 bg-slate-950 p-1">
                <button
                  onClick={() => setView("catcher")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    view === "catcher"
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Catcher
                </button>

                <button
                  onClick={() => setView("pitcher")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    view === "pitcher"
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Pitcher
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {revealed && score && (
        <section className="mt-3 text-center">
          <p>
            Actual pitch: {actualPitch.velocity} mph {actualPitch.pitchType}
          </p>

          <p>Outcome: {actualPitch.outcome}</p>
          <p>Location score: {score.locationScore}</p>
          <p>Pitch type score: {score.pitchTypeScore}</p>

          <p className="text-2xl font-bold mt-1">Total: {score.totalScore}</p>

          <button
            onClick={nextPitch}
            className="mt-3 px-8 py-3 rounded bg-yellow-400 text-slate-950 font-bold"
          >
            {pitchIndex === samplePitches.length - 1
              ? "See Results"
              : "Next Pitch"}
          </button>
        </section>
      )}
    </main>
  );
}