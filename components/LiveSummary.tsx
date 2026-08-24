import type { CommentaryBall, LiveSnapshot } from "@/lib/cricbuzz-parse";
import { classify, groupByOver } from "@/components/CommentaryFeed";

/**
 * ESPNcricinfo-style live summary: team score, batters table (R · B · 4s · 6s · SR),
 * bowlers table (O · M · R · W · ECON), partnership/last-wicket footer and a
 * recent-balls chip strip. Falls back gracefully when fields are missing.
 */

export function parseBatterScore(score?: string): { runs: number; balls: number } | null {
  const m = score?.match(/^(\d+)\((\d+)\)$/);
  return m ? { runs: Number(m[1]), balls: Number(m[2]) } : null;
}

export function parseBowlerFigures(score?: string): {
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
} | null {
  const m = score?.match(/^(\d+)-(\d+)-(\d+)-(\d+)$/);
  return m
    ? { overs: Number(m[1]), maidens: Number(m[2]), runs: Number(m[3]), wickets: Number(m[4]) }
    : null;
}

/** Best-effort 4s/6s counts per batter scraped from commentary text ("X to Y, FOUR") */
function boundaryCounts(balls: CommentaryBall[]): Map<string, { fours: number; sixes: number }> {
  const map = new Map<string, { fours: number; sixes: number }>();
  for (const b of balls) {
    const m = b.text.match(/\bto\s+([^,]+),/i);
    if (!m) continue;
    const name = m[1].trim();
    const cur = map.get(name) ?? { fours: 0, sixes: 0 };
    if (/\bFOUR\b/i.test(b.text)) cur.fours += 1;
    if (/\bSIX\b/i.test(b.text)) cur.sixes += 1;
    map.set(name, cur);
  }
  return map;
}

const TH = "px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const TD = "px-2 py-2 text-right font-mono text-sm text-slate-200";

function BatterTable({
  snapshot,
  boundaries,
}: {
  snapshot: LiveSnapshot;
  boundaries: Map<string, { fours: number; sixes: number }>;
}) {
  const rows = [snapshot.striker, snapshot.nonStriker].filter(
    (b): b is NonNullable<typeof b> => Boolean(b),
  );
  if (!rows.length) return null;
  return (
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
          {rows.map((b, i) => {
            const s = parseBatterScore(b.score);
            const bw = boundaries.get(b.name);
            const sr = s && s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : "—";
            return (
              <tr key={b.name} className="border-b border-white/5 last:border-0">
                <td className="px-2 py-2 text-sm">
                  <span className="font-medium text-white">{b.name}</span>
                  {i === 0 && <span className="ml-1.5 text-accent-400" title="On strike">●</span>}
                </td>
                <td className={`${TD} font-bold`}>{s?.runs ?? "—"}</td>
                <td className={TD}>{s?.balls ?? "—"}</td>
                <td className={TD}>{bw?.fours ?? 0}</td>
                <td className={TD}>{bw?.sixes ?? 0}</td>
                <td className={TD}>{sr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BowlerTable({ snapshot }: { snapshot: LiveSnapshot }) {
  if (!snapshot.bowler) return null;
  const f = parseBowlerFigures(snapshot.bowler.score);
  const econ = f && f.overs > 0 ? (f.runs / f.overs).toFixed(2) : "—";
  return (
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
          <tr>
            <td className="px-2 py-2 text-sm font-medium text-white">{snapshot.bowler.name}</td>
            <td className={`${TD} font-bold`}>{f?.overs ?? "—"}</td>
            <td className={TD}>{f?.maidens ?? "—"}</td>
            <td className={TD}>{f?.runs ?? "—"}</td>
            <td className={TD}>{f?.wickets ?? "—"}</td>
            <td className={TD}>{econ}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal strip of recent ball chips, ESPNcricinfo-style */
function RecentBalls({
  balls,
  snapshot,
}: {
  balls: CommentaryBall[];
  snapshot: LiveSnapshot;
}) {
  // Prefer real per-ball data grouped by over; fall back to the overSummary tokens.
  const groups = groupByOver(balls).slice(0, 4);
  if (groups.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.over} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">Over {g.over + 1}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[...g.balls].reverse().map((ball, i) => {
                const { label, cls } = classify(ball.text);
                return (
                  <span
                    key={i}
                    title={ball.text}
                    className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-bold ${cls}`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const tokens = snapshot.lastOverSummary?.split(/\s+/).filter(Boolean) ?? [];
  if (!tokens.length) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-400">
        Over {(snapshot.overNumber ?? 0) + 1}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {tokens.map((t, i) => {
          const label = /^w/i.test(t) ? "W" : t === "4" ? "4" : t === "6" ? "6" : t === "0" ? "•" : t;
          const cls =
            label === "W"
              ? "bg-red-500/20 text-red-300 border-red-400/30"
              : label === "6"
                ? "bg-flame-500/20 text-flame-300 border-flame-400/30"
                : label === "4"
                  ? "bg-accent-500/20 text-accent-300 border-accent-400/30"
                  : "bg-white/5 text-slate-400 border-white/10";
          return (
            <span
              key={i}
              className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-bold ${cls}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function LiveSummary({
  snapshot,
  balls,
}: {
  snapshot: LiveSnapshot;
  balls?: CommentaryBall[] | null;
}) {
  const boundaries = boundaryCounts(balls ?? []);
  const hasFooter = Boolean(snapshot.partnership || snapshot.lastWicket);

  return (
    <section className="flex flex-col gap-4">
      {/* Team score row */}
      <div className="glass p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-4">
          <h2 className="text-lg font-extrabold tracking-tight text-white">
            {snapshot.battingTeam ?? "Batting"}
          </h2>
          <p className="font-mono text-xl font-bold text-white">
            ({snapshot.teamScore ?? "—"})
            {typeof snapshot.overNumber === "number" && (
              <span className="ml-2 text-sm font-medium text-slate-400">{snapshot.overNumber} ov</span>
            )}
          </p>
        </div>

        {snapshot.striker || snapshot.nonStriker ? (
          <>
            <p className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Batters
            </p>
            <BatterTable snapshot={snapshot} boundaries={boundaries} />
          </>
        ) : null}

        {snapshot.bowler && (
          <>
            <p className="mt-5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Bowler
            </p>
            <BowlerTable snapshot={snapshot} />
          </>
        )}

        {hasFooter && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/5 pt-3 text-xs text-slate-400">
            {snapshot.partnership && <span>🤝 Partnership: {snapshot.partnership}</span>}
            {snapshot.lastWicket && <span>🎯 Last wkt: {snapshot.lastWicket}</span>}
          </div>
        )}
      </div>

      {/* Recent overs strip */}
      <div className="glass p-5 sm:p-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Recent overs
        </p>
        <RecentBalls balls={balls ?? []} snapshot={snapshot} />
      </div>
    </section>
  );
}