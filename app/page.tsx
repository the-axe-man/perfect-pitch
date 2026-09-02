import Link from "next/link";
import { challenges } from "@/lib/challenges";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#202225] px-5 py-8 text-[#f5f5f1] sm:px-8 sm:py-12">
      <section className="mx-auto max-w-5xl">
        <div className="mb-10 border-b border-[#3c4147] pb-10 sm:mb-12 sm:pb-12">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[#747a81]">
            MLB pitch prediction
          </p>
          <h1 className="text-5xl font-medium sm:text-7xl">Perfect Pitch</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#a0a4aa] sm:text-xl">
            Lock in the next pitch type and location while a real MLB game is on.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/live"
              className="rounded-2xl bg-[#dcff00] px-6 py-3.5 font-medium text-[#17191b] shadow-[0_4px_0_#91a800] transition hover:bg-[#c8e900] active:translate-y-[3px] active:shadow-[0_1px_0_#91a800]"
            >
              Play Live
            </Link>
            <a
              href="#classic"
              className="rounded-2xl border border-[#444a50] bg-[#292c30] px-6 py-3.5 font-medium text-[#c9ccd0] transition hover:border-[#596068] hover:text-[#f5f5f1]"
            >
              Classic Challenges
            </a>
          </div>
        </div>

        <div id="classic" className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#747a81]">
            Classic challenges
          </p>
          <h2 className="mt-2 text-3xl font-medium">Saved at-bats</h2>
        </div>

        <div className="space-y-5">
          {challenges.map((challenge, index) => {
            const [batter, pitcher] = challenge.title.split(" vs ");

            return (
              <Link
                key={challenge.id}
                href={`/play?challenge=${challenge.id}`}
                className="group block overflow-hidden rounded-[28px] border border-[#444a50] bg-[#292c30] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-[#596068] hover:bg-[#2f3337]"
              >
                <div className="p-6 sm:p-8">
                  <div className="mb-8 flex items-center justify-between gap-4">
                    <span className="rounded-full border border-[#444a50] bg-[#33373c] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#c9ccd0]">
                      Challenge {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="rounded-full bg-[#dcff00] px-4 py-2 text-sm font-medium text-[#17191b] shadow-[0_3px_0_#91a800] transition group-hover:bg-[#c8e900] group-active:translate-y-[2px] group-active:shadow-[0_1px_0_#91a800]">
                      Play
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-6">
                    <h2 className="text-3xl font-medium leading-none sm:text-5xl">
                      {batter}
                    </h2>
                    <span className="text-lg font-medium text-[#747a81] sm:pb-1">vs</span>
                    <h2 className="text-3xl font-medium leading-none sm:text-5xl sm:text-right">
                      {pitcher}
                    </h2>
                  </div>

                  <div className="mt-8 border-t border-[#3c4147] pt-5 text-sm font-medium text-[#a0a4aa] sm:text-base">
                    {challenge.matchup}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
