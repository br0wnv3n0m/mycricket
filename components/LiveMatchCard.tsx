"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LiveMatch } from "@/lib/types";

export function LiveMatchCard({ match, index = 0 }: { match: LiveMatch; index?: number }) {
  return (
    <Link href={`/match/live/${match.id}`} className="block h-full outline-none">
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.08, 0.5), ease: "easeOut" }}
      className="glass glass-hover relative h-full overflow-hidden p-5"
    >
      {/* animated gradient border glow */}
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

      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-400">
          <span className="live-dot" /> Live
        </span>
        {match.formatHint && (
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            {match.formatHint}
          </span>
        )}
      </div>

      <h3 className="relative mt-3 text-base font-semibold text-white">{match.title}</h3>

      {match.score && (
        <motion.p
          key={match.score}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          className="relative mt-2 font-mono text-sm text-accent-400"
        >
          {match.score}
        </motion.p>
      )}

      <p className="relative mt-2 line-clamp-1 text-xs text-slate-400">{match.status}</p>
      {match.venue && <p className="relative mt-1 truncate text-[11px] text-slate-500">📍 {match.venue}</p>}
    </motion.div>
    </Link>
  );
}

export function FixtureCard({ match, index = 0 }: { match: LiveMatch; index?: number }) {
  return (
    <Link href={`/match/live/${match.id}`} className="block outline-none">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
        className="glass glass-hover flex items-center justify-between gap-4 p-4"
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{match.title}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {match.status || "Upcoming"}
            {match.venue ? ` · ${match.venue}` : ""}
          </p>
        </div>
        {match.startTime && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {formatTime(match.startTime)}
          </span>
        )}
      </motion.div>
    </Link>
  );
}

function formatTime(t: string): string {
  const ts = Number(t);
  const d = !Number.isNaN(ts) && ts > 1e12 ? new Date(ts) : new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}