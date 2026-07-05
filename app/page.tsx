"use client";

import { useState } from "react";
import challenge from "@/challenges/current.json";

const samplePitches = challenge.pitches;

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

export default function Home() {
  const [pitchIndex, setPitchIndex] = useState(0);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const [pitchType, setPitchType] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<PitchResult[]>([]);
  const [gameComplete, setGameComplete] = useState(false);

  const actualPitch = samplePitches[pitchIndex];

  function plateXToScreen(plateX: number) {
    return Math.round(((plateX + 2) / 4) * 320);
  }

  function plateZToScreen(plateZ: number) {
    return Math.round(384 - (plateZ / 5) * 384);
  }

  const actualX = plateXToScreen(actualPitch.plateX);
  const actualY = plateZToScreen(actualPitch.plateZ);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (revealed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setGuess({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function getScore() {
    if (!guess) return null;

    const distance = Math.sqrt(
      Math.pow(guess.x - actualX, 2) + Math.pow(guess.y - actualY, 2)
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
      setRevealed(false);
    } else {
      setGameComplete(true);
    }
  }

  function restartGame() {
    setPitchIndex(0);
    setGuess(null);
    setPitchType("");
    setRevealed(false);
    setResults([]);
    setGameComplete(false);
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
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-8">
        <section className="w-full max-w-xl text-center">
          <h1 className="text-5xl font-bold mt-8 mb-2">Perfect Pitch</h1>
          <p className="text-slate-300 mb-8">{challenge.title}</p>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 mb-6">
            <p className="text-slate-400 mb-2">Final Score</p>
            <p className="text-6xl font-bold text-yellow-400">{finalScore}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-slate-400 text-sm">Avg Location</p>
              <p className="text-2xl font-bold">{averageLocation}</p>
            </div>
            <div className="rounded-xl bg-slate-900 p-4">
              <p className="text-slate-400 text-sm">Pitch Type</p>
              <p className="text-2xl font-bold">{pitchTypeAccuracy}%</p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left mb-6">
            <h2 className="text-2xl font-bold mb-4">Pitch-by-Pitch</h2>

            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.pitchNumber}
                  className="border-b border-slate-800 pb-3 last:border-b-0"
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
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left mb-6">
            <h2 className="text-2xl font-bold mb-4">Achievements</h2>

            <div className="space-y-3">
              {perfectPitchTypes && (
                <p>🧠 Ball Knower — all pitch types correct</p>
              )}
              {sniper && <p>🎯 Sniper — 80+ location score on every pitch</p>}
              {painter && <p>🖌️ Painter — 85+ average location score</p>}
              {lockedIn && <p>🔥 Locked In — 500+ total score</p>}

              {!perfectPitchTypes && !sniper && !painter && !lockedIn && (
                <p className="text-slate-400">
                  No achievements this time. Run it back.
                </p>
              )}
            </div>
          </section>

          <button
            onClick={restartGame}
            className="px-8 py-3 rounded bg-yellow-400 text-slate-950 font-bold"
          >
            Play Again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-8">
      <h1 className="text-5xl font-bold mt-8 mb-2">Perfect Pitch</h1>

      <p className="text-slate-300 mb-8">
        Guess the next pitch location and pitch type.
      </p>

      <section className="mb-6 text-center">
        <p className="text-xl font-semibold">
          {actualPitch.awayTeam} {actualPitch.awayScore} ·{" "}
          {actualPitch.homeTeam} {actualPitch.homeScore}
        </p>

        <p className="text-slate-300">
          {actualPitch.inning} · {actualPitch.outs} Out · {actualPitch.count} Count
        </p>

        <p className="text-slate-300">
          {actualPitch.batter} vs {actualPitch.pitcher}
        </p>
      </section>

      <div
        onClick={handleClick}
        className="relative w-80 h-96 bg-slate-900 border-2 border-white rounded cursor-crosshair"
      >
        <div className="absolute left-16 top-20 w-48 h-56 border-4 border-yellow-400" />

        {guess && (
          <div
            className="absolute w-4 h-4 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ left: guess.x, top: guess.y }}
          />
        )}

        {revealed && (
          <div
            className="absolute w-5 h-5 bg-green-400 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ left: actualX, top: actualY }}
          />
        )}
      </div>

      {!revealed && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {pitchTypes.map((type) => (
              <button
                key={type}
                onClick={() => setPitchType(type)}
                className={`px-4 py-2 rounded border ${
                  pitchType === type
                    ? "bg-white text-slate-950"
                    : "bg-slate-900 text-white border-slate-600"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            disabled={!guess || !pitchType}
            onClick={lockInGuess}
            className="mt-8 px-8 py-3 rounded bg-yellow-400 text-slate-950 font-bold disabled:opacity-40"
          >
            Lock In Guess
          </button>
        </>
      )}

      {revealed && score && (
        <section className="mt-8 text-center">
          <p>
            Actual pitch: {actualPitch.velocity} mph {actualPitch.pitchType}
          </p>

          <p>Outcome: {actualPitch.outcome}</p>
          <p>Location score: {score.locationScore}</p>
          <p>Pitch type score: {score.pitchTypeScore}</p>

          <p className="text-3xl font-bold mt-2">Total: {score.totalScore}</p>

          <button
            onClick={nextPitch}
            className="mt-6 px-8 py-3 rounded bg-yellow-400 text-slate-950 font-bold"
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