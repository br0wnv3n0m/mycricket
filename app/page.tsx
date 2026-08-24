import Link from "next/link";
import { getDashboardStats, getFixtures, getRecentMatches, getUpcomingMatches } from "@/lib/queries";
import { getLiveData } from "@/lib/live";
import { MatchCard } from "@/components/MatchCard";
import { LiveMatchCard, FixtureCard } from "@/components/LiveMatchCard";
import { StatCard } from "@/components/StatCard";
import { HeroTitle } from "@/components/HeroTitle";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [liveData] = await Promise.all([getLiveData()]);
  const stats = getDashboardStats();
  const recent = getRecentMatches(8);
  const upcomingFromIndex = getUpcomingMatches(6);
  const fixtures = getFixtures().slice(0, 6);

  return (
    <div className="flex flex-col gap-12">
      <HeroTitle />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Matches in database" value={stats.total} accent="accent" delay={0} />
        <StatCard label="Past 365 days" value={stats.last365} accent="sky" delay={0.08} />
        <StatCard label="Upcoming fixtures" value={stats.upcoming} accent="flame" delay={0.16} />
        <StatCard label="Live right now" value={liveData.live.length} accent="accent" delay={0.24} />
      </section>

      {/* Live matches */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-3 text-xl font-bold">
            {liveData.live.length > 0 ? (
              <>
                <span className="live-dot" /> Live Now
              </>
            ) : (
              "Live Cricket"
            )}
          </h2>
          {liveData.ok && (
            <span className="text-xs text-slate-500">
              updated {new Date(liveData.fetchedAt).toLocaleTimeString("en-US")}
            </span>
          )}
        </div>

        {liveData.live.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveData.live.map((m, i) => (
              <LiveMatchCard key={m.id} match={m} index={i} />
            ))}
          </div>
        ) : (
          <div className="glass flex flex-col items-center gap-2 p-10 text-center">
            <span className="text-3xl">🏏</span>
            <p className="font-medium text-slate-300">No live matches at the moment</p>
            <p className="text-sm text-slate-500">
              Check out recent results below or browse the{" "}
              <Link href="/schedule" className="text-accent-400 hover:underline">
                schedule
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      {/* Recent results */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Results</h2>
          <Link href="/past" className="text-sm font-medium text-accent-400 hover:underline">
            View all →
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((m, i) => (
              <MatchCard key={`${m.format}-${m.id}`} match={m} index={i} />
            ))}
          </div>
        ) : (
          <div className="glass p-8 text-center text-slate-400">
            No indexed matches yet — run <code className="text-accent-400">npm run index</code> to build the database.
          </div>
        )}
      </section>

      {/* Upcoming */}
      {(fixtures.length > 0 || upcomingFromIndex.length > 0) && (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">Coming Up</h2>
            <Link href="/schedule" className="text-sm font-medium text-accent-400 hover:underline">
              Full schedule →
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {fixtures.map((m, i) => (
              <FixtureCard key={`fx-${m.id}`} match={m} index={i} />
            ))}
            {upcomingFromIndex.map((m, i) => (
              <FixtureCard
                key={`idx-${m.format}-${m.id}`}
                match={{
                  id: m.id,
                  state: "upcoming",
                  title: `${m.teams[0]} vs ${m.teams[1]}`,
                  teams: m.teams,
                  status: m.event ?? "",
                  startTime: m.date,
                  venue: m.venue,
                }}
                index={i}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}