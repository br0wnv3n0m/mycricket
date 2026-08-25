import type { MatchDetail } from "@/lib/types";

/**
 * Live-style compact summary for past matches: both teams' final scores,
 * toss result, match winner, player of the match and the top two batters /
 * bowlers for each team. Styled consistently with the live `LiveSummary`
 * view. Server component.
 */

function overs(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

interface BatterAgg {
  name: string;
  runs: number;
  balls: number;
}

interface BowlerAgg {
  name: string;
  wickets: number;
  runs: number;
  overs: number;
  economy: number;
}

function topBatters(detail: MatchDetail, team: string): BatterAgg[] {
  const map = new Map<string, BatterAgg>();
  for (const inn of detail.innings) {
    if (inn.team !== team) continue;
    for (const b of inn.batting) {
      const cur = map.get(b.name) ?? { name: b.name, runs: 0, balls: 0 };
      cur.runs += b.runs;
      cur.balls += b.balls;
      map.set(b.name, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.runs - a.runs).slice(0, 2);
}

function topBowlers(detail: MatchDetail, team: string): BowlerAgg[] {
  const map = new Map<string, BowlerAgg>();
  for (const inn of detail.innings) {
    // bowling rows on an innings belong to the fielding side
    if (inn.team === team) continue;
    for (const b of inn.bowling) {
      const cur =
        map.get(b.name) ?? { name: b.name, wickets: 0, runs: 0, overs: 0, economy: b.economy };
      cur.wickets += b.wickets;
      cur.runs += b.runs;
      cur.overs += b.overs;
      map.set(b.name, cur);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
    .slice(0, 2);
}

export function PastMatchSummary({ detail }: { detail: MatchDetail }) {
  const { summary, innings, toss } = detail;
  const [teamA, teamB] = summary.teams;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Summary</h2>

      {/* Final scores */}
      <div className="glass p-5 sm:p-6">
        <div className="flex flex-col divide-y divide-white/5 border-b border-white/10 pb-4">
          {innings.map((inn, i) => (
            <div key={`${inn.team}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
              <span className="truncate text-sm font-semibold text-slate-200">{inn.team}</span>
              <span className="font-mono text-lg font-bold text-white">
                {inn.total}/{inn.wickets}
                <span className="ml-2 text-xs font-medium text-slate-400">{overs(inn.balls)} ov</span>
              </span>
            </div>
          ))}
        </div>

        {/* Result / toss / POTM lines */}
        <div className="mt-4 flex flex-col gap-2 text-sm">
          {summary.winner && (
            <p className="font-semibold text-accent-300">🏆 {summary.winner} won the match</p>
          )}
          {toss && (
            <p className="text-slate-300">
              🪙 {toss.winner} won the toss and chose to {toss.decision}
            </p>
          )}
          {summary.playerOfMatch && summary.playerOfMatch.length > 0 && (
            <p className="text-slate-300">⭐ Player of the match: {summary.playerOfMatch.join(", ")}</p>
          )}
          {summary.resultText && (
            <p className="text-xs text-slate-500">{summary.resultText}</p>
          )}
        </div>
      </div>

      {/* Top performers per team */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[teamA, teamB].map((team) => {
          const batters = topBatters(detail, team);
          const bowlers = topBowlers(detail, team);
          return (
            <div key={team} className="glass p-5">
              <h3 className="border-b border-white/10 pb-3 text-base font-extrabold tracking-tight text-white">
                {team}
              </h3>

              {batters.length > 0 && (
                <>
                  <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Top batters
                  </p>
                  <ul className="flex flex-col gap-2">
                    {batters.map((b) => {
                      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "—";
                      return (
                        <li key={b.name} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-white">{b.name}</span>
                          <span className="shrink-0 font-mono text-slate-300">
                            <span className="font-bold text-white">{b.runs}</span> ({b.balls})
                            <span className="ml-2 text-xs text-slate-500">SR {sr}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {bowlers.length > 0 && (
                <>
                  <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Top bowlers
                  </p>
                  <ul className="flex flex-col gap-2">
                    {bowlers.map((b) => (
                      <li key={b.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-white">{b.name}</span>
                        <span className="shrink-0 font-mono text-slate-300">
                          <span className="font-bold text-white">{b.wickets}/{b.runs}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            {b.overs.toFixed(1)} ov · econ {b.economy.toFixed(2)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}