import type { CommentaryBall } from "@/lib/cricbuzz-parse";

interface OverGroup {
  over: number;
  inningsId: number;
  balls: CommentaryBall[];
}

/**
 * Group balls into overs (input is newest-first; groups come out newest-first).
 * Groups are keyed by inningsId + over so two innings with the same over
 * numbers never collide.
 */
export function groupByOver(balls: CommentaryBall[]): OverGroup[] {
  const groups: OverGroup[] = [];
  for (const ball of balls) {
    const last = groups[groups.length - 1];
    if (last && last.over === ball.over && last.inningsId === ball.inningsId) {
      last.balls.push(ball);
    } else {
      groups.push({ over: ball.over, inningsId: ball.inningsId, balls: [ball] });
    }
  }
  return groups;
}

export function classify(text: string): { label: string; cls: string } {
  if (/\bwicket\b|\bout\b/i.test(text)) return { label: "W", cls: "bg-red-500/20 text-red-300 border-red-400/30" };
  if (/\bSIX\b/i.test(text)) return { label: "6", cls: "bg-flame-500/20 text-flame-300 border-flame-400/30" };
  if (/\bFOUR\b/i.test(text)) return { label: "4", cls: "bg-accent-500/20 text-accent-300 border-accent-400/30" };
  if (/\bno run\b/i.test(text)) return { label: "•", cls: "bg-white/5 text-slate-400 border-white/10" };
  const runs = text.match(/,\s*(\d+)\s*run/);
  if (runs) return { label: runs[1], cls: "bg-white/10 text-slate-200 border-white/15" };
  return { label: "·", cls: "bg-white/5 text-slate-400 border-white/10" };
}

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

/**
 * Ball-by-ball commentary feed, ESPNcricinfo-style:
 * newest first, grouped by over with per-ball chips.
 * `inningsLabels` (optional) maps inningsId -> team name for dividers.
 */
export function CommentaryFeed({
  balls,
  inningsLabels,
}: {
  balls: CommentaryBall[];
  inningsLabels?: string[];
}) {
  const groups = groupByOver(balls);
  let prevInningsId: number | null = null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Commentary</h2>
      {groups.map((group) => {
        const inningsChanged = prevInningsId !== null && prevInningsId !== group.inningsId;
        prevInningsId = group.inningsId;
        const inningsLabel =
          inningsLabels?.[group.inningsId] ??
          `${ORDINALS[group.inningsId] ?? `${group.inningsId + 1}th`} innings`;
        return (
          <div key={`${group.inningsId}-${group.over}`} className="flex flex-col gap-4">
            {inningsChanged && (
              <div className="glass flex items-center gap-3 px-4 py-2.5">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-400">
                  Innings break · {inningsLabel}
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            )}
            <div className="glass p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-sm font-bold text-slate-200">End of over {group.over + 1}</span>
                <span className="font-mono text-xs text-slate-500">
                  {(group.over + 1).toFixed(0)} OV · {group.balls.length} balls
                </span>
              </div>
              <ul className="mt-3 flex flex-col gap-3">
                {[...group.balls].reverse().map((ball, i) => {
                  const { label, cls } = classify(ball.text);
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${cls}`}
                      >
                        {label}
                      </span>
                      <p className="text-sm leading-relaxed text-slate-300">
                        <span className="mr-2 font-mono text-xs text-slate-500">{ball.over + 1}.{ball.ballInOver}</span>
                        {ball.text}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </section>
  );
}