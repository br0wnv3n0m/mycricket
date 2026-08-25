import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchById } from "@/lib/queries";
import { parseMatchDetail, parseCommentaryEvents } from "@/lib/cricsheet";
import { WormChart } from "@/components/WormChart";
import { Scorecard } from "@/components/Scorecard";
import { CommentaryFeed } from "@/components/CommentaryFeed";
import { PastMatchSummary } from "@/components/PastMatchSummary";
import { MatchTabs, isMatchTab } from "@/components/MatchTabs";
import { FORMAT_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(d?: string): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return Number.isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ format: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ format, id }, { tab }] = await Promise.all([params, searchParams]);
  const activeTab = isMatchTab(tab) ? tab : "summary";

  const summary = getMatchById(format, id);
  if (!summary) notFound();

  const detail = await parseMatchDetail(summary);
  const [teamA, teamB] = summary.teams;

  // Full ball-by-ball commentary generated from raw Cricsheet deliveries
  const commentaryBalls = await parseCommentaryEvents(summary);

  // Derive an over-by-over timeline from worm data + fall of wickets
  const fowByOver = new Map<number, string[]>();
  for (const inn of detail?.innings ?? []) {
    for (const fow of inn.fallOfWickets) {
      const list = fowByOver.get(Math.floor(fow.over)) ?? [];
      list.push(`${fow.batter} (${inn.team.split(" ")[0]}, ${fow.score}/${fow.wicket})`);
      fowByOver.set(Math.floor(fow.over), list);
    }
  }
  const oversTimeline =
    detail && detail.worm.length > 1
      ? detail.worm.slice(1).map((pt) => {
          const prev = detail.worm[detail.worm.indexOf(pt) - 1];
          const runsA = Number(pt[teamA] ?? 0) - Number(prev[teamA] ?? 0);
          const runsB = Number(pt[teamB] ?? 0) - Number(prev[teamB] ?? 0);
          return {
            over: pt.over,
            runsA,
            runsB,
            wickets: fowByOver.get(pt.over) ?? [],
          };
        })
      : [];

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500">
        <Link href="/past" className="hover:text-accent-400">
          Results
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-300">
          {FORMAT_LABELS[summary.format] ?? summary.format} · {formatDate(summary.date)}
        </span>
      </nav>

      {/* Match header */}
      <header className="glass relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-500/10 via-transparent to-flame-500/10" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-400">
            {summary.event ?? FORMAT_LABELS[summary.format] ?? summary.matchType}
            {summary.season ? ` · ${summary.season}` : ""}
          </p>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              <span className={summary.winner === teamA ? "text-white" : "text-slate-300"}>{teamA}</span>
              <span className="mx-3 text-slate-600">vs</span>
              <span className={summary.winner === teamB ? "text-white" : "text-slate-300"}>{teamB}</span>
            </h1>

            {detail && detail.innings.length > 0 && (
              <div className="flex gap-5 font-mono text-sm">
                {detail.innings.map((inn) => (
                  <div key={inn.team} className="text-right">
                    <p className="truncate text-xs text-slate-400">{inn.team}</p>
                    <p className="text-lg font-bold text-white">
                      {inn.total}/{inn.wickets}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-3 font-medium text-accent-400">{summary.resultText}</p>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
            {(summary.venue || summary.city) && <span>📍 {summary.venue ?? summary.city}</span>}
            <span>📅 {formatDate(summary.date)}</span>
            {detail?.toss && (
              <span>
                🪙 {detail.toss.winner} won the toss and chose to {detail.toss.decision}
              </span>
            )}
            {summary.playerOfMatch && <span>⭐ Player of the match: {summary.playerOfMatch.join(", ")}</span>}
          </div>
        </div>
      </header>

      {/* Sub-tabs */}
      <MatchTabs basePath={`/match/${format}/${id}`} active={activeTab} />

      {/* Tab content */}
      {activeTab === "scorecard" ? (
        detail && detail.innings.length > 0 ? (
          <div className="flex flex-col gap-6">
            {detail.innings.map((inn, i) => (
              <Scorecard key={`${inn.team}-${i}`} innings={inn} index={i} />
            ))}
          </div>
        ) : (
          <div className="glass p-8 text-center text-slate-400">
            Full scorecard is not available for this match yet.
            {!summary.hasBallByBall &&
              " It will gain full ball-by-ball charts once Cricsheet publishes the data — re-download and run npm run index."}
          </div>
        )
      ) : activeTab === "commentary" ? (
        commentaryBalls && commentaryBalls.length > 0 ? (
          <CommentaryFeed
            balls={commentaryBalls}
            inningsLabels={detail?.innings.map((i) => i.team)}
          />
        ) : oversTimeline.length > 0 ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Over-by-over</h2>
            {[...oversTimeline].reverse().map((o) => (
              <div key={o.over} className="glass p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <span className="text-sm font-bold text-slate-200">Over {o.over}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {teamA.slice(0, 3)} {o.runsA} · {teamB.slice(0, 3)} {o.runsB}
                  </span>
                </div>
                {o.wickets.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {o.wickets.map((w, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-400/30 bg-red-500/20 text-xs font-bold text-red-300">
                          W
                        </span>
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ) : (
          <div className="glass p-8 text-center text-slate-400">
            Over-by-over data isn't available for this match yet.
            {!summary.hasBallByBall &&
              " It will appear once Cricsheet publishes the ball-by-ball data — re-download and run npm run index."}
          </div>
        )
      ) : (
        <>
          {/* Live-style compact summary */}
          {detail && detail.innings.length > 0 ? (
            <PastMatchSummary detail={detail} />
          ) : (
            <div className="glass p-8 text-center text-slate-400">
              Match summary is not available for this match yet.
              {!summary.hasBallByBall &&
                " It will appear once Cricsheet publishes the data — re-download and run npm run index."}
            </div>
          )}

          {/* Charts */}
          {detail && detail.worm.length > 1 && (
            <WormChart data={detail.worm} teams={[detail.innings[0].team, detail.innings[1].team]} />
          )}

          {detail && (detail.officials?.length ?? 0) > 0 && (
            <p className="text-center text-xs text-slate-500">Umpires: {detail.officials?.join(", ")}</p>
          )}
        </>
      )}
    </div>
  );
}