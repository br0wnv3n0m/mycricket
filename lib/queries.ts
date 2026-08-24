import "server-only";
import matchesIndex from "../data/matches.json";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { Format, LiveMatch, MatchSummary } from "./types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

export const getAllMatches = cache((): MatchSummary[] => {
  // Statically bundled at build time so it works in serverless environments
  // (Netlify functions cannot read arbitrary files from disk at runtime).
  return matchesIndex as unknown as MatchSummary[];
});

export const getFixtures = cache((): LiveMatch[] => {
  const p = path.join(DATA_DIR, "live-fixtures.json");
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as { fixtures?: LiveMatch[] };
    return parsed.fixtures ?? [];
  } catch {
    return [];
  }
});

export function getRecentMatches(limit = 12): MatchSummary[] {
  const today = new Date().toISOString().slice(0, 10);
  return getAllMatches()
    .filter((m) => m.date && m.date <= today)
    .slice(0, limit);
}

export function getUpcomingMatches(limit = 20): MatchSummary[] {
  const today = new Date().toISOString().slice(0, 10);
  return getAllMatches()
    .filter((m) => m.date && m.date > today)
    .slice(0, limit);
}

export interface PastFilters {
  format?: Format | "all";
  team?: string;
  event?: string;
  query?: string;
  page?: number;
  perPage?: number;
}

export function getPastMatches(filters: PastFilters = {}) {
  const { format = "all", team = "", event = "", query = "", page = 1, perPage = 24 } = filters;
  const today = new Date().toISOString().slice(0, 10);
  let list = getAllMatches().filter((m) => m.date && m.date <= today);

  if (format !== "all") list = list.filter((m) => m.format === format);
  if (team) list = list.filter((m) => m.teams.some((t) => t === team));
  if (event) list = list.filter((m) => (m.event ?? "") === event);

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.teams.some((t) => t.toLowerCase().includes(q)) ||
        (m.event ?? "").toLowerCase().includes(q) ||
        (m.venue ?? "").toLowerCase().includes(q) ||
        (m.city ?? "").toLowerCase().includes(q)
    );
  }

  const total = list.length;
  const start = (page - 1) * perPage;
  return {
    total,
    page,
    perPage,
    matches: list.slice(start, start + perPage),
  };
}

export function getTeams(): string[] {
  const set = new Set<string>();
  for (const m of getAllMatches()) for (const t of m.teams) set.add(t);
  return [...set].sort();
}

export function getEvents(): string[] {
  const set = new Set<string>();
  for (const m of getAllMatches()) if (m.event) set.add(m.event);
  return [...set].sort();
}

export function getMatchById(format: string, id: string): MatchSummary | undefined {
  return getAllMatches().find((m) => m.format === format && m.id === id);
}

/** Stats widgets for the dashboard */
export function getDashboardStats() {
  const all = getAllMatches();
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return {
    total: all.length,
    last365: all.filter((m) => m.date >= yearAgo && m.date <= today).length,
    upcoming: all.filter((m) => m.date > today).length,
    formats: Object.fromEntries(
      ["ipl", "odis", "t20s", "tests"].map((f) => [f, all.filter((m) => m.format === f).length])
    ),
  };
}