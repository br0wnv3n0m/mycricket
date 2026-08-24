import type { InningsDetail } from "@/lib/types";

/**
 * ESPNcricinfo-style final-summary cards for past matches: one card per
 * innings with team score header, batters table (R · B · 4s · 6s · SR),
 * bowlers table (O · M · R · W · ECON) and an extras / fall-of-wickets footer.
 * Styled consistently with the live `LiveSummary` view. Server component.
 */

function overs(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

const TH = "px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const TD = "px-2 py-2 text-right font-mono text-sm text-slate-200";

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

export function MatchSummaryCards({ innings }: { innings: InningsDetail[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Summary</h2>
      {innings.map((inn, idx) => (
        <div key={`${inn.team}-${idx}`} className="glass p-5 sm:p-6">
          {/* Team score header */}
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-4">
            <h3 className="text-lg font-extrabold tracking-tight text-white">
              {inn.team}
              <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {ORDINALS[idx] ?? `${idx + 1}th`} innings
              </span>
            </h3>
            <p className="font-mono text-xl font-bold text-white">
              ({inn.total}-{inn.wickets})
              <span className="ml-2 text-sm font-medium text-slate-400">{overs(inn.balls)} ov</span>
            </p>
          </div>

          {/* Batters */}
          {inn.batting.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Batting
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[340px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className={`${TH} !text-left`}>Batter</th>
                      <th className={TH}>R</th>
                      <th className={TH}>B</th>
                      <th className={TH}>4s</th>
                      <th className={TH}>6s</th>
                      <th className={TH}>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inn.batting.map((b) => (
                      <tr key={b.name} className="border-b border-white/5 last:border-0">
                        <td className="px-2 py-2 text-sm">
                          <span className="font-medium text-white">{b.name}</span>
                          <span className="block text-xs text-slate-500">{b.dismissal}</span>
                        </td>
                        <td className={`${TD} font-bold`}>{b.runs}</td>
                        <td className={TD}>{b.balls}</td>
                        <td className={TD}>{b.fours}</td>
                        <td className={TD}>{b.sixes}</td>
                        <td className={TD}>{b.strikeRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Bowlers */}
          {inn.bowling.length > 0 && (
            <>
              <p className="mt-5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Bowling
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[340px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className={`${TH} !text-left`}>Bowler</th>
                      <th className={TH}>O</th>
                      <th className={TH}>M</th>
                      <th className={TH}>R</th>
                      <th className={TH}>W</th>
                      <th className={TH}>ECON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inn.bowling.map((b) => (
                      <tr key={b.name} className="border-b border-white/5 last:border-0">
                        <td className="px-2 py-2 text-sm font-medium text-white">{b.name}</td>
                        <td className={`${TD} font-bold`}>{b.overs}</td>
                        <td className={TD}>{b.maidens}</td>
                        <td className={TD}>{b.runs}</td>
                        <td className={TD}>{b.wickets}</td>
                        <td className={TD}>{b.economy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Footer: extras + fall of wickets */}
          {(inn.extras.total > 0 || inn.fallOfWickets.length > 0) && (
            <div className="mt-4 flex flex-col gap-1 border-t border-white/5 pt-3 text-xs text-slate-400">
              {inn.extras.total > 0 && (
                <p>
                  <span className="font-semibold text-slate-300">Extras {inn.extras.total}</span>{" "}
                  <span className="text-slate-500">
                    (b {inn.extras.byes}, lb {inn.extras.legbyes}, w {inn.extras.wides}, nb{" "}
                    {inn.extras.noballs})
                  </span>
                </p>
              )}
              {inn.fallOfWickets.length > 0 && (
                <p>
                  <span className="font-semibold text-slate-300">Fall of wickets: </span>
                  {inn.fallOfWickets
                    .map((f) => `${f.score}-${f.wicket} (${f.batter}, ${f.over} ov)`)
                    .join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}