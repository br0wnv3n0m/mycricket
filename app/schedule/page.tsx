import { getFixtures } from "@/lib/queries";
import { getUpcomingMatches } from "@/lib/queries";
import { FixtureCard } from "@/components/LiveMatchCard";

export const dynamic = "force-dynamic";

function groupByDate<
  T extends { startTime?: string; date?: string }
>(items: T[], getDate: (item: T) => string | undefined): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const raw = getDate(item) ?? "";
    const d = new Date(raw);
    const key = !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : raw || "Date to be announced";
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return [...groups.entries()];
}

export default async function SchedulePage() {
  const fixtures = getFixtures();
  const upcoming = getUpcomingMatches(60);

  const fixtureGroups = groupByDate(fixtures, (f) => f.startTime);
  const upcomingGroups = groupByDate(upcoming, (m) => m.date);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Match <span className="text-gradient">Schedule</span>
        </h1>
        <p className="mt-1 text-slate-400">All upcoming fixtures in one place.</p>
      </header>

      {fixtures.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-accent-400">
            <span className="live-dot" /> From live feed
          </h2>
          {fixtureGroups.map(([date, matches]) => (
            <div key={date}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
                {date}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {matches.map((m, i) => (
                  <FixtureCard key={m.id} match={m} index={i} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-6">
        {fixtures.length > 0 && (
          <h2 className="text-lg font-bold text-slate-300">From database</h2>
        )}
        {upcomingGroups.length > 0 ? (
          upcomingGroups.map(([date, matches]) => (
            <div key={date}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
                {date}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {matches.map((m, i) => (
                  <FixtureCard
                    key={`${m.format}-${m.id}`}
                    match={{
                      id: m.id,
                      state: "upcoming",
                      title: `${m.teams[0]} vs ${m.teams[1]}`,
                      teams: m.teams,
                      status: m.event ?? m.matchType ?? "",
                      venue: m.venue,
                      startTime: m.date,
                    }}
                    index={i}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="glass p-10 text-center text-slate-400">
            No upcoming fixtures indexed yet. Run{" "}
            <code className="text-accent-400">npm run sync</code> with your live API to fetch the
            latest schedule.
          </div>
        )}
      </section>
    </div>
  );
}