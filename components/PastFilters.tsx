"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";

const FORMATS = [
  { value: "all", label: "All" },
  { value: "ipl", label: "IPL" },
  { value: "odis", label: "ODIs" },
  { value: "t20s", label: "T20s" },
  { value: "tests", label: "Tests" },
];

export function PastFilters({ teams, events }: { teams: string[]; events: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const current = {
    format: searchParams.get("format") ?? "all",
    team: searchParams.get("team") ?? "",
    event: searchParams.get("event") ?? "",
  };

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`/past?${params.toString()}`));
  };

  const submitQuery = (e: React.FormEvent) => {
    e.preventDefault();
    update("q", query.trim());
  };

  return (
    <motion.div
      layout
      className={`glass flex flex-col gap-4 p-4 transition-opacity ${isPending ? "opacity-60" : ""}`}
    >
      {/* Format pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FORMATS.map((f) => {
          const active = current.format === f.value;
          return (
            <button
              key={f.value}
              onClick={() => update("format", f.value)}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active ? "text-pitch-950" : "text-slate-300 hover:text-white"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="format-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-accent-400 to-accent-500"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={submitQuery} className="flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team, venue, city or series…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-accent-500/50"
          />
        </form>

        <select
          value={current.team}
          onChange={(e) => update("team", e.target.value)}
          className="rounded-xl border border-white/10 bg-pitch-800 px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/50"
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={current.event}
          onChange={(e) => update("event", e.target.value)}
          className="max-w-48 rounded-xl border border-white/10 bg-pitch-800 px-3 py-2.5 text-sm text-white outline-none focus:border-accent-500/50"
        >
          <option value="">All series</option>
          {events.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
      </div>
    </motion.div>
  );
}