import "server-only";
import type { LiveMatch } from "./types";

/**
 * Live data source: the public LiveScore cricket feed (no API key required).
 *   https://prod-public-api.livescore.com/v1/api/app/date/cricket/{YYYYMMDD}/{page}?MD=1
 *
 * Optionally, if LIVE_API_BASE is set we also try the self-hosted
 * mskian/live-cricket-score-api instance and merge its results in.
 */

const LIVE_SCORE_BASE = "https://prod-public-api.livescore.com/v1/api/app/date/cricket";
const LEGACY_BASE = process.env.LIVE_API_BASE?.replace(/\/+$/, "");

interface LsTeam {
  Nm?: string;
}
interface LsEvent {
  Eid: string;
  T1?: LsTeam[];
  T2?: LsTeam[];
  /** status id: 0 = not started, 6 = finished, anything else = in progress */
  Esid?: number;
  /** human readable period e.g. "Innings Break", "Finished" */
  EpsL?: string;
  Eps?: string;
  /** result / commentary line */
  ECo?: string;
  /** series/stage name */
  ErnInf?: string;
  /** format text e.g. "Test", "ODI", "T20I" */
  EtTx?: string;
  /** start datetime compact form YYYYMMDDHHmmss */
  Esd?: number;
  /** per-innings team totals: runs */
  Tr1C1?: number;
  Tr1C2?: number;
  Tr1C3?: number;
  Tr1C4?: number;
  Tr2C1?: number;
  Tr2C2?: number;
  Tr2C3?: number;
  Tr2C4?: number;
  /** per-innings wickets */
  Tr1CW1?: number;
  Tr1CW2?: number;
  Tr1CW3?: number;
  Tr1CW4?: number;
  Tr2CW1?: number;
  Tr2CW2?: number;
  Tr2CW3?: number;
  Tr2CW4?: number;
  /** per-innings overs */
  Tr1CO1?: number;
  Tr1CO2?: number;
  Tr1CO3?: number;
  Tr1CO4?: number;
  Tr2CO1?: number;
  Tr2CO2?: number;
  Tr2CO3?: number;
  Tr2CO4?: number;
}
interface LsStage {
  Snm?: string;
  Cnm?: string;
  Events?: LsEvent[];
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchJson(url: string, timeoutMs = 10000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch LiveScore events for a given day offset relative to today (UTC) */
async function fetchLiveScoreDay(offsetDays: number): Promise<LsEvent[]> {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const json = await fetchJson(`${LIVE_SCORE_BASE}/${ymd(d)}/0?MD=1`);
  if (!json || typeof json !== "object") return [];
  const stages = (json as { Stages?: LsStage[] }).Stages ?? [];
  const events: LsEvent[] = [];
  for (const st of stages) {
    for (const ev of st.Events ?? []) events.push(ev);
  }
  return events;
}

/** Compact innings list -> "210 & 64/10 (52.3)" style score strings */
function inningsScores(ev: LsEvent, prefix: "Tr1" | "Tr2"): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const runs = ev[`${prefix}C${i}` as keyof LsEvent] as number | undefined;
    if (runs == null) continue;
    const wkts = ev[`${prefix}CW${i}` as keyof LsEvent] as number | undefined;
    const overs = ev[`${prefix}CO${i}` as keyof LsEvent] as number | undefined;
    let s = String(runs);
    if (wkts != null) s += `/${wkts}`;
    if (overs != null) s += ` (${overs})`;
    out.push(s);
  }
  return out;
}

function lsEventToMatch(ev: LsEvent): LiveMatch | null {
  const t1 = ev.T1?.[0]?.Nm ?? "";
  const t2 = ev.T2?.[0]?.Nm ?? "";
  if (!t1 || !t2) return null;

  const esid = ev.Esid ?? 0;
  const epsL = (ev.EpsL ?? "").toLowerCase();
  const notStarted = ev.Eps === "NS" || epsL.includes("not started");
  const state: LiveMatch["state"] =
    esid === 6 ? "recent" : notStarted ? "upcoming" : "live";

  const s1 = inningsScores(ev, "Tr1");
  const s2 = inningsScores(ev, "Tr2");
  const score =
    [...s1, ...s2].length > 0
      ? [s1.join(" & "), s2.join(" & ")].filter(Boolean).join(" | ")
      : undefined;

  // Esd is compact local-to-event time like 20260822000000
  let startTime: string | undefined;
  if (ev.Esd) {
    const raw = String(ev.Esd);
    const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10) ?? "00"}:${raw.slice(10, 12) ?? "00"}:00Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) startTime = parsed.toISOString();
  }

  return {
    id: `ls-${ev.Eid}`,
    state,
    title: `${t1} vs ${t2}`,
    teams: [t1, t2],
    status: ev.ECo || ev.EpsL || ev.Eps || "",
    score,
    formatHint: ev.EtTx || undefined,
    startTime,
  };
}

/* ---------- Optional legacy adapter (self-hosted live-cricket-score-api) ---------- */

async function fetchLegacyState(state: string): Promise<LiveMatch[]> {
  if (!LEGACY_BASE) return [];
  const candidates = [`${LEGACY_BASE}/api.php?endpoint=${state}`, `${LEGACY_BASE}/${state}`];
  for (const url of candidates) {
    const json = await fetchJson(url);
    if (!json) continue;
    let list: Record<string, unknown>[] = [];
    if (Array.isArray(json)) list = json as Record<string, unknown>[];
    else if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      for (const key of ["response", "matches", "data"]) {
        if (Array.isArray(obj[key])) {
          list = obj[key] as Record<string, unknown>[];
          break;
        }
      }
      if (!list.length) {
        const firstArray = Object.values(obj).find((v) => Array.isArray(v));
        if (firstArray) list = firstArray as Record<string, unknown>[];
      }
    }
    const mapped = list
      .map((m) => {
        const info = ((m.matchInfo ?? m) ?? {}) as Record<string, unknown>;
        const nameOf = (t: unknown): string => {
          if (typeof t === "string") return t;
          if (t && typeof t === "object") {
            const o = t as Record<string, unknown>;
            return String(o.teamName ?? o.name ?? "");
          }
          return "";
        };
        const a = nameOf(info.team1);
        const b = nameOf(info.team2);
        const title = String(info.title ?? info.matchTitle ?? "") || (a && b ? `${a} vs ${b}` : "");
        if (!title) return null;
        const venueInfo = info.venueInfo as Record<string, unknown> | undefined;
        return {
          id: String(info.matchId ?? info.id ?? `${title}-${state}`),
          state: state as LiveMatch["state"],
          title,
          teams: [a, b],
          status: String(info.status ?? info.state ?? ""),
          score:
            typeof info.score === "string" && info.score
              ? info.score
              : ([info.team1Score, info.team2Score].filter((s) => s != null && s !== "").map(String).join(" | ") ||
                  undefined),
          venue: venueInfo ? String(venueInfo.ground ?? "") : info.venue ? String(info.venue) : undefined,
          formatHint: info.matchFormat ? String(info.matchFormat) : info.format ? String(info.format) : undefined,
          startTime: info.startDate ? String(info.startDate) : info.startTime ? String(info.startTime) : undefined,
        } as LiveMatch;
      })
      .filter((m): m is LiveMatch => m !== null);
    if (mapped.length) return mapped;
  }
  return [];
}

export interface LiveDataResult {
  live: LiveMatch[];
  recent: LiveMatch[];
  upcoming: LiveMatch[];
  fetchedAt: string;
  ok: boolean;
}

export async function getLiveData(): Promise<LiveDataResult> {
  // LiveScore: yesterday through +2 days covers recent, live and upcoming
  const days = await Promise.all([-1, 0, 1, 2].map(fetchLiveScoreDay));

  const byId = new Map<string, LiveMatch>();
  for (const ev of days.flat()) {
    const m = lsEventToMatch(ev);
    if (m && !byId.has(m.id)) byId.set(m.id, m);
  }

  // Merge in legacy self-hosted API results when configured
  if (LEGACY_BASE) {
    const [live, recent, upcoming] = await Promise.all([
      fetchLegacyState("live"),
      fetchLegacyState("recent"),
      fetchLegacyState("upcoming"),
    ]);
    for (const m of [...live, ...recent, ...upcoming]) {
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  }

  const all = [...byId.values()];
  return {
    live: all.filter((m) => m.state === "live"),
    recent: all.filter((m) => m.state === "recent"),
    upcoming: all.filter((m) => m.state === "upcoming"),
    fetchedAt: new Date().toISOString(),
    ok: all.length > 0,
  };
}