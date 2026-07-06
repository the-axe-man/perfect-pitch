import Link from "next/link";
import { challenges } from "@/lib/challenges";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-10">
      <div className="w-full max-w-xl">

        <h1 className="text-6xl font-bold mb-2">
          Perfect Pitch
        </h1>

        <p className="text-slate-400 mb-10">
          Predict every pitch of a real MLB at-bat.
        </p>

        <h2 className="text-2xl font-bold mb-4">
          Challenges
        </h2>

        <div className="space-y-4">

          {challenges.map((challenge) => (

            <div
              key={challenge.id}
              className="rounded-xl border border-slate-700 bg-slate-900 p-5"
            >
              <h3 className="text-xl font-bold">
                {challenge.title}
              </h3>

              <p className="text-slate-400">
                Difficulty: {challenge.difficulty}
              </p>

              <p className="text-slate-400 mb-4">
                {challenge.pitches} pitches
              </p>

              <Link
                href="/play"
                className="inline-block rounded-lg bg-yellow-400 px-5 py-3 font-bold text-slate-900"
              >
                Play Challenge
              </Link>

            </div>

          ))}

        </div>

      </div>
    </main>
  );
}