"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import type { InningsDetail, LiveMatch } from "@/lib/types";
import type { CommentaryBall, LiveSnapshot } from "@/lib/cricbuzz-parse";
import { Scorecard } from "@/components/Scorecard";
import { CommentaryFeed } from "@/components/CommentaryFeed";
import { LiveSummary } from "@/components/LiveSummary";

const REFRESH_MS = 30_000;

function formatDateTime(t?: string): string {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LiveMatchDetail({
  match,
  activeTab,
  innings,
  commentary,
  snapshot,
  toss,
}: {
  match: LiveMatch;
  activeTab: "summary" | "scorecard" | "commentary";
  innings?: InningsDetail[] | null;
  commentary?: CommentaryBall[] | null;
  snapshot?: LiveSnapshot | null;
  toss?: { winner: string; decision: string } | null;
}) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => {
      router.refresh();
      setLastRefresh(new Date());
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  // score string is "innings for team A | innings for team B"
  const teamScores: { team: string; score?: string }[] = (() => {
    if (!match.score) return match.teams.map((team) => ({ team }));
    const parts = match.score.split("|").map((s) => s.trim());
    return match.teams.map((team, i) => ({ team, score: parts[i] }));
  })();

  const isLive = match.state === "live";
  const isUpcoming = match.state === "upcoming";

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-accent-400">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-300">{match.title}</span>
      </nav>

      {/* Match header */}
      <header className="glass relative overflow-hidden p-6 sm:p-8">
        {isLive && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                "linear-gradient(120deg, rgba(56,232,198,0.12), transparent 40%, rgba(255,122,89,0.10))",
            }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${
                isLive ? "text-red-400" : isUpcoming ? "text-flame-400" : "text-slate-400"
              }`}
            >
              {isLive && <span className="live-dot" />}
              {isLive ? "Live" : isUpcoming ? "Upcoming" : "Finished"}
            </span>
            {match.formatHint && (
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                {match.formatHint}
              </span>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{match.title}</h1>

          {/* Per-team scores */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {teamScores.map(({ team, score }) => (
              <div key={team} className="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
                <span className="truncate text-sm text-slate-300">{team}</span>
                <span className="font-mono text-lg font-bold text-white">{score ?? "—"}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 font-medium text-accent-400">{match.status || (isUpcoming ? "Not started yet" : "")}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-400">
            {toss && (
              <span>
                🪙 {toss.winner} won the toss and chose to {toss.decision}
              </span>
            )}
            {match.startTime && <span>📅 {formatDateTime(match.startTime)}</span>}
            {isLive && lastRefresh && (
              <motion.span key={lastRefresh.toISOString()} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                🔄 updated {lastRefresh.toLocaleTimeString("en-US")} · auto-refreshes every{" "}
                {REFRESH_MS / 1000}s
              </motion.span>
            )}
          </div>
        </div>
      </header>

      {/* Tab content */}
      {activeTab === "summary" ? (
        snapshot ? (
          <LiveSummary snapshot={snapshot} balls={commentary} />
        ) : (
          <section className="glass p-6 text-sm text-slate-400">
            <p className="font-medium text-slate-300">Live match state</p>
            <p className="mt-1">
              A detailed live summary isn't available for this match right now. It appears here once
              ball-by-ball data starts flowing — check the Commentary and Scorecard tabs meanwhile.
            </p>
          </section>
        )
      ) : activeTab === "commentary" ? (
        commentary != null && commentary.length > 0 ? (
          <CommentaryFeed balls={commentary} />
        ) : (
          <section className="glass p-6 text-sm text-slate-400">
            Ball-by-ball commentary isn't available for this match right now.
          </section>
        )
      ) : innings && innings.length > 0 ? (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-bold">Scorecard</h2>
          {innings.map((inn, i) => (
            <Scorecard key={`${inn.team}-${i}`} innings={inn} index={i} />
          ))}
        </section>
      ) : (
        <section className="glass p-6 text-sm text-slate-400">
          <p className="font-medium text-slate-300">Full ball-by-ball scorecard</p>
          <p className="mt-1">
            A live scorecard isn't available for this match right now. Detailed ball-by-ball data
            becomes available once Cricsheet publishes it — usually shortly after the match finishes —
            and will then appear in the{" "}
            <Link href="/past" className="text-accent-400 hover:underline">
              Past results
            </Link>{" "}
            section with a full scorecard and worm chart.
          </p>
        </section>
      )}
    </div>
  );
}