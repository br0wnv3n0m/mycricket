"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { MatchSummary } from "@/lib/types";
import { FORMAT_LABELS } from "@/lib/types";

function formatDate(d: string): string {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MatchCard({ match, index = 0 }: { match: MatchSummary; index?: number }) {
  const [teamA, teamB] = match.teams;
  const innA = match.innings?.find((i) => i.team === teamA);
  const innB = match.innings?.find((i) => i.team === teamB);

  const scoreLine = (team: string | undefined) => {
    if (!team) return null;
    const inn = match.innings?.find((i) => i.team === team);
    if (!inn || (inn.runs === 0 && inn.wickets === 0)) return null;
    return (
      <span className="font-mono text-sm text-white">
        {inn.runs}
        {inn.wickets < 10 ? `/${inn.wickets}` : ""}
        <span className="ml-1 text-xs text-slate-400">({inn.overs})</span>
      </span>
    );
  };

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
      className="glass glass-hover flex h-full flex-col gap-3 p-5"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-full border border-accent-500/30 bg-accent-500/10 px-2.5 py-0.5 font-semibold uppercase tracking-wider text-accent-400">
          {match.event ?? FORMAT_LABELS[match.format] ?? match.matchType}
        </span>
        <span className="text-slate-400">{formatDate(match.date)}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {[teamA, teamB].map((team, idx) => {
          const isWinner = match.winner === team;
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span
                className={`truncate text-sm ${isWinner ? "font-semibold text-white" : "text-slate-300"}`}
              >
                {team}
              </span>
              {scoreLine(team)}
            </div>
          );
        })}
      </div>

      <div className="mt-auto border-t border-white/5 pt-3">
        <p className="line-clamp-2 text-xs font-medium text-accent-400/90">{match.resultText}</p>
        {(match.venue || match.city) && (
          <p className="mt-1 truncate text-[11px] text-slate-500">
            📍 {match.venue ?? match.city}
          </p>
        )}
      </div>
    </motion.div>
  );

  return (
    <Link href={`/match/${match.format}/${match.id}`} className="block h-full outline-none">
      {inner}
    </Link>
  );
}