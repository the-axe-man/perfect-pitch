import Link from "next/link";
import { challenges } from "@/lib/challenges";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-6xl font-bold mb-3">Perfect Pitch</h1>
        <p className="text-slate-400 mb-10">
          Predict every pitch of a real MLB at-bat.
        </p>

        <div className="space-y-5">
          {challenges.map((challenge) => (
            <Link
              key={challenge.id}
              href={`/play?challenge=${challenge.id}`}
              className="group block overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 hover:border-yellow-400 transition"
            >
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-300">
                    Matchup
                  </span>
                  <span className="text-sm font-bold text-yellow-400 group-hover:translate-x-1 transition">
                    Play →
                  </span>
                </div>
                <h2 className="text-4xl font-black leading-none">
                  {challenge.title.split(" vs ")[0]}
                </h2>
                <p className="my-3 text-xl font-bold text-slate-500">vs</p>
                <h2 className="text-4xl font-black leading-none">
                  {challenge.title.split(" vs ")[1]}
                </h2>
                <p className="mt-6 text-slate-400">{challenge.matchup}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}