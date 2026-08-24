import "server-only";
import type { InningsDetail } from "./types";
import {
  parseScorecardHtml,
  parseCommentaryHtml,
  parseLiveSnapshot,
  type CommentaryBall,
  type LiveSnapshot,
} from "./cricbuzz-parse";

/**
 * Unofficial scraper for Cricbuzz live scorecards.
 * The public HTML pages are accessible with a browser-like User-Agent.
 * If the markup changes, parsing fails gracefully (returns null) and callers
 * should fall back to summary-only views.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 30 },
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export interface CricbuzzLiveMatch {
  id: string;
  slug: string;
  teamCodes: [string, string];
}

/** Scrape the live-scores page for currently live/recent match links */
export async function getLiveMatches(): Promise<CricbuzzLiveMatch[]> {
  const html = await fetchHtml("https://www.cricbuzz.com/cricket-match/live-scores");
  if (!html) return [];
  const byId = new Map<string, CricbuzzLiveMatch>();
  for (const m of html.matchAll(/href="\/live-cricket-scores\/(\d+)\/([a-z0-9-]+)"/g)) {
    const id = m[1];
    if (byId.has(id)) continue;
    const slug = m[2];
    // slug format: "{team1code}-vs-{team2code}-{description...}"
    const vsSplit = slug.split("-vs-");
    if (vsSplit.length < 2) continue;
    const code1 = vsSplit[0];
    const code2 = vsSplit[1].split("-")[0];
    byId.set(id, { id, slug, teamCodes: [code1, code2] });
  }
  return [...byId.values()];
}

const TEAM_CODE_MAP: Record<string, string> = {
  india: "ind",
  srilanka: "sl",
  australia: "aus",
  bangladesh: "ban",
  england: "eng",
  pakistan: "pak",
  southafrica: "sa",
  newzealand: "nz",
  westindies: "wi",
  zimbabwe: "zim",
  ireland: "ire",
  afghanistan: "afg",
  scotland: "sco",
  nepal: "nep",
  netherlands: "ned",
  namibia: "nam",
  uae: "uae",
  oman: "oma",
  usa: "usa",
  canada: "can",
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function codesFor(teamNames: string[]): string[] {
  return teamNames.map((t) => TEAM_CODE_MAP[normalize(t)] ?? normalize(t).slice(0, 3));
}

/** Find the Cricbuzz match id matching a pair of team names */
export async function findCricbuzzId(teams: string[]): Promise<string | null> {
  const wanted = codesFor(teams);
  const matches = await getLiveMatches();
  for (const m of matches) {
    const [a, b] = m.teamCodes;
    if (
      (a === wanted[0] && b === wanted[1]) ||
      (a === wanted[1] && b === wanted[0])
    ) {
      return m.id;
    }
  }
  // fallback: substring match on slug
  for (const m of matches) {
    const s = m.slug.replace(/-/g, "");
    if (wanted.every((c) => s.includes(c))) return m.id;
  }
  return null;
}

/** Fetch and parse a full scorecard (all innings) from a Cricbuzz scorecard page */
export async function getScorecard(cricbuzzId: string): Promise<InningsDetail[] | null> {
  const html = await fetchHtml(`https://www.cricbuzz.com/live-cricket-scorecard/${cricbuzzId}`);
  if (!html) return null;
  return parseScorecardHtml(html);
}

/** Fetch and parse ball-by-ball commentary from a Cricbuzz commentary page */
export async function getCommentary(cricbuzzId: string): Promise<CommentaryBall[] | null> {
  const html = await fetchHtml(`https://www.cricbuzz.com/live-cricket-commentary/${cricbuzzId}`);
  if (!html) return null;
  return parseCommentaryHtml(html);
}

/** Fetch commentary page and return both ball-by-ball and the live match-state snapshot */
export async function getLiveState(
  cricbuzzId: string,
): Promise<{ balls: CommentaryBall[] | null; snapshot: LiveSnapshot | null } | null> {
  const html = await fetchHtml(`https://www.cricbuzz.com/live-cricket-commentary/${cricbuzzId}`);
  if (!html) return null;
  return { balls: parseCommentaryHtml(html), snapshot: parseLiveSnapshot(html) };
}
