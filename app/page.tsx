import Link from "next/link";
import { challenges } from "@/lib/challenges";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#1e2023] text-[#f4f4f2] p-8">
      <section className="mx-auto max-w-3xl">
        <h1 className="text-6xl font-bold mb-3">Perfect Pitch</h1>
        <p className="text-[#9ca0a7] mb-10">
          Predict every pitch of a real MLB at-bat.
        </p>

        <div className="space-y-5">
          {challenges.map((challenge) => (
            <Link
              key={challenge.id}
              href={`/play?challenge=${challenge.id}`}
              className="group block overflow-hidden rounded-3xl border border-[#3a3f45] bg-[#2b2f33] hover:border-yellow-400 transition"
            >
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-full bg-[#363b40] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#c5c8cc]">
                    Matchup
                  </span>
                  <span className="text-sm font-bold text-yellow-400 group-hover:translate-x-1 transition">
                    Play →
                  </span>
                </div>
                <h2 className="text-4xl font-black leading-none">
                  {challenge.title.split(" vs ")[0]}
                </h2>
                <p className="my-3 text-xl font-bold text-[#73777d]">vs</p>
                <h2 className="text-4xl font-black leading-none">
                  {challenge.title.split(" vs ")[1]}
                </h2>
                <p className="mt-6 text-[#9ca0a7]">{challenge.matchup}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
