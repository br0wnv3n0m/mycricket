/**
 * sync-live.mjs
 * Fetches fixtures + recently completed matches from the public LiveScore
 * cricket feed and stores them locally so past results & schedule stay fresh
 * without re-downloading Cricsheet zips.
 *
 * Env:
 *   LIVE_API_BASE  (optional) base URL of a self-hosted live-score API
 *                  (https://github.com/mskian/live-cricket-score-api) whose
 *                  results are merged in alongside LiveScore.
 *
 * Writes:
 *   - data/live-fixtures.json  (upcoming fixtures)
 *   - data/live-synced.json    (completed matches, merged into the index by build-index.mjs)
 *
 * Run: npm run sync
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve project root relative to this file so the script works from any cwd
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data");
const LIVE_SCORE_BASE = "https://prod-public-api.livescore.com/v1/api/app/date/cricket";
const LEGACY_BASE = process.env.LIVE_API_BASE?.replace(/\/+$/, "");

async function fetchJson(url, timeoutMs = 15000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Fetch all cricket events from LiveScore for a day offset relative to today (UTC) */
async function fetchLiveScoreDay(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const json = await fetchJson(`${LIVE_SCORE_BASE}/${ymd(d)}/0?MD=1`);
  if (!json || typeof json !== "object") return [];
  const events = [];
  for (const st of json.Stages ?? []) {
    for (const ev of st.Events ?? []) events.push(ev);
  }
  return events;
}

function inningsScores(ev, prefix) {
  const out = [];
  for (let i = 1; i <= 4; i++) {
    const runs = ev[`${prefix}C${i}`];
    if (runs == null) continue;
    const wkts = ev[`${prefix}CW${i}`];
    const overs = ev[`${prefix}CO${i}`];
    let s = String(runs);
    if (wkts != null) s += `/${wkts}`;
    if (overs != null) s += ` (${overs})`;
    out.push(s);
  }
  return out;
}

/** Map a LiveScore event into our normalized match shape */
function lsEventToMatch(ev) {
  const t1 = ev.T1?.[0]?.Nm ?? "";
  const t2 = ev.T2?.[0]?.Nm ?? "";
  if (!t1 || !t2) return null;

  const esid = ev.Esid ?? 0;
  const epsL = (ev.EpsL ?? "").toLowerCase();
  const notStarted = ev.Eps === "NS" || epsL.includes("not started");
  const state = esid === 6 ? "recent" : notStarted ? "upcoming" : "live";

  const s1 = inningsScores(ev, "Tr1");
  const s2 = inningsScores(ev, "Tr2");
  const score =
    [...s1, ...s2].length > 0
      ? [s1.join(" & "), s2.join(" & ")].filter(Boolean).join(" | ")
      : undefined;

  let startTime;
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

async function fetchLegacyState(state) {
  if (!LEGACY_BASE) return [];
  const candidates = [`${LEGACY_BASE}/api.php?endpoint=${state}`, `${LEGACY_BASE}/${state}`];
  for (const url of candidates) {
    const json = await fetchJson(url);
    if (!json) continue;
    let list = [];
    if (Array.isArray(json)) list = json;
    else if (Array.isArray(json?.response)) list = json.response;
    else if (Array.isArray(json?.matches)) list = json.matches;
    else if (Array.isArray(json?.data)) list = json.data;
    else if (json && typeof json === "object") list = Object.values(json).find(Array.isArray) ?? [];

    const mapped = list
      .map((m) => {
        const info = m.matchInfo ?? m;
        const nameOf = (t) =>
          typeof t === "string"
            ? t
            : t && typeof t === "object"
              ? String(t.teamName ?? t.name ?? "")
              : "";
        const a = nameOf(info.team1);
        const b = nameOf(info.team2);
        const title = info.title ?? info.matchTitle ?? (a && b ? `${a} vs ${b}` : "");
        if (!title) return null;
        return {
          id: String(info.matchId ?? info.id ?? `${title}-${state}`),
          state,
          title,
          teams: [String(a), String(b)],
          status: info.status ?? info.state ?? "",
          score:
            info.score ??
            ([info.team1Score, info.team2Score].filter(Boolean).join(" | ") || undefined),
          venue: info.venueInfo?.ground ?? info.venue ?? undefined,
          formatHint: info.matchFormat ?? info.format ?? undefined,
          startTime: info.startDate ?? info.startTime ?? undefined,
        };
      })
      .filter(Boolean);
    if (mapped.length) return mapped;
  }
  return [];
}

function guessFormat(m) {
  const hay = `${m.title} ${m.formatHint ?? ""}`.toLowerCase();
  if (hay.includes("ipl") || hay.includes("indian premier")) return "ipl";
  if (hay.includes("test")) return "tests";
  if (hay.includes("t20")) return "t20s";
  return "odis";
}

function toDate(m) {
  if (!m.startTime) return new Date().toISOString().slice(0, 10);
  const ts = Number(m.startTime);
  if (!Number.isNaN(ts) && ts > 1e12) return new Date(ts).toISOString().slice(0, 10);
  return String(m.startTime).slice(0, 10);
}

function toSummary(m) {
  return {
    id: m.id.startsWith("live-") ? m.id : `live-${m.id}`,
    format: guessFormat(m),
    matchType: m.formatHint ?? "",
    date: toDate(m),
    event: undefined,
    teams: m.teams,
    venue: m.venue,
    winner: undefined,
    resultText: m.status,
    innings: [],
    playerOfMatch: [],
    hasBallByBall: false,
    source: "live",
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("Fetching live data from LiveScore ...");

  // LiveScore: yesterday through +3 days covers recent, live and upcoming
  const days = await Promise.all([-1, 0, 1, 2, 3].map(fetchLiveScoreDay));
  const byId = new Map();
  for (const ev of days.flat()) {
    const m = lsEventToMatch(ev);
    if (m && !byId.has(m.id)) byId.set(m.id, m);
  }

  // Merge in legacy self-hosted API results when configured
  if (LEGACY_BASE) {
    console.log(`Also fetching from legacy API ${LEGACY_BASE} ...`);
    const states = await Promise.all(["live", "recent", "upcoming"].map(fetchLegacyState));
    for (const m of states.flat()) {
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  }

  const all = [...byId.values()];
  const recent = all.filter((m) => m.state === "recent");
  const upcoming = all.filter((m) => m.state === "upcoming");

  if (!all.length) {
    console.error("Could not fetch any matches from LiveScore.");
    process.exitCode = 1;
  }

  // Save upcoming fixtures
  fs.writeFileSync(
    path.join(OUT_DIR, "live-fixtures.json"),
    JSON.stringify({ fetchedAt: new Date().toISOString(), fixtures: upcoming })
  );
  console.log(`Saved ${upcoming.length} upcoming fixtures -> data/live-fixtures.json`);

  // Append completed matches (dedupe by id)
  const syncedPath = path.join(OUT_DIR, "live-synced.json");
  let existing = [];
  if (fs.existsSync(syncedPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(syncedPath, "utf8"));
    } catch {
      existing = [];
    }
  }
  const bySyncId = new Map(existing.map((m) => [m.id, m]));
  let added = 0;
  for (const m of recent) {
    const summary = toSummary(m);
    if (!bySyncId.has(summary.id)) {
      bySyncId.set(summary.id, summary);
      added += 1;
    } else {
      bySyncId.set(summary.id, { ...bySyncId.get(summary.id), resultText: summary.resultText });
    }
  }
  const merged = [...bySyncId.values()].sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(syncedPath, JSON.stringify(merged));
  console.log(`Live-synced completed matches: ${added} new, ${merged.length} total -> data/live-synced.json`);
  console.log('Run "npm run index" to rebuild the combined index.');
}

main();