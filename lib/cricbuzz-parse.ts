import * as cheerio from "cheerio";
import type { BattingRow, BowlingRow, InningsDetail } from "./types";

/**
 * Pure Cricbuzz scorecard HTML -> InningsDetail[] parser.
 * Kept free of server-only imports so it can be unit-tested with plain node.
 */

function num(s: string | undefined): number {
  const n = Number((s ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function oversToBalls(o: string): number {
  const parts = o.split(".");
  const whole = Number(parts[0] ?? 0);
  const balls = Number(parts[1] ?? 0);
  return whole * 6 + balls;
}

interface RawInningsSlice {
  headerHtml: string;
  bodyHtml: string;
}

function splitInningsSlices(html: string): RawInningsSlice[] {
  const marker = /<div id="team-\d+-innings-\d+"/g;
  const starts: number[] = [];
  for (const m of html.matchAll(marker)) starts.push(m.index ?? 0);
  if (!starts.length) return [];
  const slices: RawInningsSlice[] = [];
  for (let i = 0; i < starts.length; i++) {
    slices.push({
      headerHtml: html.slice(starts[i], starts[i] + 2000),
      bodyHtml: html.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : undefined),
    });
  }
  return slices;
}

function parseBattingRows($: cheerio.CheerioAPI): BattingRow[] {
  const rows: BattingRow[] = [];
  $(".grid[class*='scorecard-bat-grid']").each((_, el) => {
    const row = $(el);
    const firstCellText = row.children().first().text().trim();
    if (firstCellText === "Batter") return; // header row
    const name = row.find("span[class='hover:underline']").first().text().trim();
    if (!name) return;
    const dismissal = row.find("[class*='text-cbTxtSec']").last().text().trim();
    const cells = row
      .find("div[class*='justify-center']")
      .map((_, c) => $(c).text().trim())
      .get()
      .filter((t) => t !== "");
    rows.push({
      name,
      dismissal,
      runs: num(cells[0]),
      balls: num(cells[1]),
      fours: num(cells[2]),
      sixes: num(cells[3]),
      strikeRate: num(cells[4]),
    });
  });
  return rows;
}

function parseBowlingRows($: cheerio.CheerioAPI): BowlingRow[] {
  const rows: BowlingRow[] = [];
  $(".grid[class*='scorecard-bowl-grid']").each((_, el) => {
    const row = $(el);
    const firstCellText = row.children().first().text().trim();
    if (firstCellText === "Bowler") return; // header row
    const name = row.find("span[class='hover:underline']").first().text().trim();
    if (!name) return;
    const cells = row
      .find("div[class*='justify-center']")
      .map((_, c) => $(c).text().trim())
      .get()
      .filter((t) => t !== "");
    rows.push({
      name,
      overs: num(cells[0]),
      maidens: num(cells[1]),
      runs: num(cells[2]),
      wickets: num(cells[3]),
      economy: num(cells[6] ?? cells[4]),
    });
  });
  return rows;
}

function parseExtrasAndTotal($: cheerio.CheerioAPI): {
  extras: InningsDetail["extras"];
  total: number;
  wickets: number;
  overs: number;
} {
  const extras = { total: 0, byes: 0, legbyes: 0, wides: 0, noballs: 0, penalty: 0 };
  let total = 0;
  let wickets = 0;
  let overs = 0;

  $("div.font-bold").each((_, el) => {
    const label = $(el).text().trim();
    if (label !== "Extras" && label !== "Total") return;
    const valueEl = $(el).next();
    const bold = valueEl.find("span.font-bold").first().text().trim();
    const detail = valueEl.find("span").last().text().trim();

    if (label === "Extras") {
      const b = num(detail.match(/b (\d+)/)?.[1]);
      const lb = num(detail.match(/lb (\d+)/)?.[1]);
      const w = num(detail.match(/w (\d+)/)?.[1]);
      const nb = num(detail.match(/nb (\d+)/)?.[1]);
      const p = num(detail.match(/p (\d+)/)?.[1]);
      Object.assign(extras, { total: num(bold), byes: b, legbyes: lb, wides: w, noballs: nb, penalty: p });
    } else {
      total = num(bold.split("-")[0]);
      wickets = num(bold.split("-")[1]);
      overs = num(detail.match(/([\d.]+)\s*Overs?/i)?.[1]);
    }
  });

  return { extras, total, wickets, overs };
}

function parseFow($: cheerio.CheerioAPI): InningsDetail["fallOfWickets"] {
  const fow: InningsDetail["fallOfWickets"] = [];
  $(".grid[class*='scorecard-fow-grid']").each((_, el) => {
    const row = $(el);
    const firstCellText = row.children().first().text().trim();
    if (firstCellText === "Fall of Wickets") return; // header row
    const cells = row
      .find("div[class*='justify-center']")
      .map((_, c) => $(c).text().trim())
      .get()
      .filter((t) => t !== "");
    const name = row.find("span[class='hover:underline']").first().text().trim();
    if (!name || cells.length < 2) return;
    // score cell format is "21-1" (runs-wickets)
    const scoreText = cells[0] ?? "";
    fow.push({
      over: num(cells[1]?.match(/[\d.]+/)?.[0]),
      score: num(scoreText.split("-")[0]),
      wicket: num(scoreText.split("-")[1]) || fow.length + 1,
      batter: name,
    });
  });
  return fow;
}

export interface CommentaryBall {
  text: string;
  over: number; // completed overs before this ball, e.g. 7 for ball 7.6
  ballInOver: number; // 1-6 (or more with extras)
  inningsId: number;
}

/**
 * Parse ball-by-ball commentary from a Cricbuzz commentary page.
 * The page embeds the commentary JSON in its Next.js data payload with
 * escaped quotes; we unescape and extract per-ball fields by key order.
 */
export function parseCommentaryHtml(html: string): CommentaryBall[] | null {
  if (!html.includes("commText")) return null;
  // Payload is multiply-escaped (\\"key\\"). Decode \\uXXXX escapes, then
  // drop remaining backslashes so standard JSON-ish regexes work.
  const u = html
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\/g, "");
  // Ball entries follow this exact key order:
  // "commText":"...","inningsId":N,"event":[...],"ballMetric":O.B,...
  // Non-ball entries (result notes etc.) don't match and are skipped.
  const re = /"commText":"([^"]*)","inningsId":(\d+),"event":\[[^\]]*\],"ballMetric":([0-9.]+)/g;
  const balls: CommentaryBall[] = [];
  for (const m of u.matchAll(re)) {
    const metric = Number(m[3]);
    balls.push({
      text: m[1].replace(/<[^>]*>/g, "").trim(),
      over: Math.floor(metric),
      ballInOver: Math.round((metric - Math.floor(metric)) * 10),
      inningsId: Number(m[2]),
    });
  }
  return balls.length ? balls : null;
}

export interface LiveSnapshot {
  battingTeam?: string; // e.g. "ODW"
  teamScore?: string; // e.g. "46-2"
  overNumber?: number; // completed overs
  striker?: { name: string; score: string }; // score like "3(7)"
  nonStriker?: { name: string; score: string };
  bowler?: { name: string; score: string }; // score like "2-0-7-0"
  lastOverSummary?: string; // e.g. "1 0 1 1 0 1"
  partnership?: string; // e.g. "23(31)" — present on some payloads
  lastWicket?: string; // e.g. "c Silva b Kumara 12(9)" — present on some payloads
}

/**
 * Extract the current match-state snapshot (batters/bowler/score) from the
 * newest overSeparator entry embedded in a Cricbuzz commentary page.
 */
export function parseLiveSnapshot(html: string): LiveSnapshot | null {
  if (!html.includes("overSeparator")) return null;
  const u = html
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\/g, "");
  const start = u.indexOf('"overSeparator":{');
  if (start === -1) return null;
  // extract the balanced JSON object
  let depth = 0;
  let end = start;
  for (let i = start + '"overSeparator":'.length; i < u.length; i++) {
    if (u[i] === "{") depth++;
    else if (u[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const obj = u.slice(start, end);
  const field = (key: string): string | undefined => {
    const m = obj.match(new RegExp(`"${key}":"([^"]*)"`));
    return m?.[1];
  };
  const numField = (key: string): number | undefined => {
    const m = obj.match(new RegExp(`"${key}":(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  const player = (key: string): { name: string; score: string } | undefined => {
    const m = obj.match(new RegExp(`"${key}Obj":\\{"playerId":\\d+,"playerName":"([^"]*)","playerScore":"([^"]*)"\\}`));
    return m ? { name: m[1], score: m[2] } : undefined;
  };
  return {
    battingTeam: field("teamName"),
    teamScore: field("teamScore"),
    overNumber: numField("overNumber"),
    striker: player("batStriker"),
    nonStriker: player("batNonStriker"),
    bowler: player("bowler"),
    lastOverSummary: field("overSummary"),
    partnership: field("partnership"),
    lastWicket: field("lastWicket"),
  };
}

/** Parse a full scorecard (all innings) from raw Cricbuzz scorecard page HTML */
export function parseScorecardHtml(html: string): InningsDetail[] | null {
  const slices = splitInningsSlices(html);
  if (!slices.length) return null;

  const inningsList: InningsDetail[] = [];
  for (const slice of slices) {
    const header$ = cheerio.load(slice.headerHtml);
    // Team name: e.g. "India 1st Innings" or just "North Delhi Strikers".
    // Prefer the longest variant (full name over abbreviation).
    let team = "";
    header$("div.font-bold").each((_, el) => {
      const t = header$(el).text().trim();
      const stripped = t.replace(/\s+\d+(?:st|nd|rd|th)?\s*Innings$/i, "").trim();
      if (stripped && stripped.length > team.length) team = stripped;
    });
    if (!team) continue;

    const $ = cheerio.load(slice.bodyHtml);
    const batting = parseBattingRows($);
    const bowling = parseBowlingRows($);
    const { extras, total, wickets, overs } = parseExtrasAndTotal($);
    const fallOfWickets = parseFow($);

    inningsList.push({
      team,
      total,
      wickets,
      balls: oversToBalls(String(overs)),
      extras,
      batting,
      bowling,
      fallOfWickets,
    });
  }

  return inningsList.length ? inningsList : null;
}