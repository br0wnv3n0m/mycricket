import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CommentaryBall } from "./cricbuzz-parse";
import type {
  BattingRow,
  BowlingRow,
  Format,
  InningsDetail,
  MatchDetail,
  MatchSummary,
  WormPoint,
} from "./types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "Data");

interface RawDelivery {
  batter?: string;
  bowler?: string;
  non_striker?: string;
  runs?: { batter?: number; extras?: number; total?: number };
  extras?: Record<string, number>;
  wickets?: { kind: string; player_out: string; fielders?: { name?: string; substitution?: boolean }[] }[];
}

interface RawInnings {
  team?: string;
  overs?: { over: number; deliveries: RawDelivery[] }[];
  target?: { overs?: number };
}

interface RawMatch {
  meta?: unknown;
  info?: Record<string, unknown>;
  innings?: RawInnings[];
}

export function rawMatchPath(format: Format, id: string): string {
  return path.join(DATA_DIR, `${format}_json`, `${id}.json`);
}

/**
 * Remote fallback for deployed environments: fetch raw match JSON from a
 * static host (e.g. the data branch of this repo served via GitHub raw).
 * Configure with DATA_REMOTE_BASE, e.g.
 *   DATA_REMOTE_BASE=https://raw.githubusercontent.com/<user>/<repo>/data
 */
const REMOTE_BASE = process.env.DATA_REMOTE_BASE ?? "";
const remoteCache = new Map<string, RawMatch>();

export async function readRawMatch(format: Format, id: string): Promise<RawMatch | null> {
  const p = rawMatchPath(format, id);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")) as RawMatch;
    } catch {
      // fall through to remote
    }
  }
  if (!REMOTE_BASE) return null;
  const key = `${format}/${id}`;
  const cached = remoteCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(`${REMOTE_BASE}/${key}.json`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = (await res.json()) as RawMatch;
    remoteCache.set(key, json);
    return json;
  } catch {
    return null;
  }
}

function oversFromBalls(balls: number): number {
  return Math.floor(balls / 6) + (balls % 6 ? (balls % 6) / 10 : 0);
}

function dismissalText(w: NonNullable<RawDelivery["wickets"]>[number], bowler?: string): string {
  const fielderNames = (w.fielders ?? [])
    .map((f) => f.name ?? "")
    .filter(Boolean)
    .filter((n) => n !== w.player_out);
  switch (w.kind) {
    case "bowled":
      return "b " + (bowler ?? "");
    case "caught":
      return `c ${fielderNames[0] ?? "?"} b ${bowler ?? ""}`;
    case "caught and bowled":
      return `c & b ${bowler ?? ""}`;
    case "lbw":
      return "lbw b " + (bowler ?? "");
    case "stumped":
      return `st ${fielderNames[0] ?? "?"} b ${bowler ?? ""}`;
    case "run out":
      return fielderNames.length ? `run out (${fielderNames.join(", ")})` : "run out";
    case "hit wicket":
      return "hit wicket b " + (bowler ?? "");
    case "retired hurt":
      return "retired hurt";
    case "retired out":
      return "retired out";
    case "obstructing the field":
      return "obstructing the field";
    default:
      return w.kind;
  }
}

export async function parseMatchDetail(summary: MatchSummary): Promise<MatchDetail | null> {
  const raw = await readRawMatch(summary.format, summary.id);
  if (!raw) return null;

  const info = raw.info ?? {};
  const inningsDetails: InningsDetail[] = [];
  const wormTeams: string[] = [];
  const wormSeries: Map<number, number>[] = [];

  for (const inn of raw.innings ?? []) {
    const team = inn.team ?? "?";
    const batting = new Map<string, BattingRow>();
    const bowling = new Map<string, BowlingRow>();
    const extras = { total: 0, byes: 0, legbyes: 0, wides: 0, noballs: 0, penalty: 0 };
    let total = 0;
    let wickets = 0;
    let legalBalls = 0;
    const fow: InningsDetail["fallOfWickets"] = [];
    let cumulative = 0;

    // per-over run tracking for maidens
    const overRunsByBowler = new Map<string, number[]>(); // bowler -> array of per-over totals

    for (const over of inn.overs ?? []) {
      let overRuns = 0;
      for (const d of over.deliveries ?? []) {
        const batter = d.batter ?? "?";
        const bowler = d.bowler ?? "?";
        const runs = d.runs ?? {};
        const ex = d.extras ?? {};
        const isLegal = !ex.wides && !ex.noballs;

        total += runs.total ?? 0;
        cumulative += runs.total ?? 0;
        overRuns += runs.total ?? 0;
        if (isLegal) legalBalls += 1;

        // batting
        const b =
          batting.get(batter) ??
          ({ name: batter, dismissal: "not out", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 } as BattingRow);
        b.runs += runs.batter ?? 0;
        if (isLegal) b.balls += 1;
        if ((runs.batter ?? 0) === 4 && !(ex.byes || ex.legbyes || ex.penalty)) b.fours += 1;
        if ((runs.batter ?? 0) === 6 && !(ex.byes || ex.legbyes || ex.penalty)) b.sixes += 1;
        batting.set(batter, b);

        // bowling
        const bw =
          bowling.get(bowler) ??
          ({ name: bowler, overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 } as BowlingRow);
        bw.runs += (runs.batter ?? 0) + (ex.wides ?? 0) + (ex.noballs ?? 0);
        if (isLegal) bw.overs += 1;
        bowling.set(bowler, bw);

        // extras
        extras.total += ex.byes ?? 0;
        extras.total += ex.legbyes ?? 0;
        extras.total += ex.wides ?? 0;
        extras.total += ex.noballs ?? 0;
        extras.total += ex.penalty ?? 0;
        extras.byes += ex.byes ?? 0;
        extras.legbyes += ex.legbyes ?? 0;
        extras.wides += ex.wides ?? 0;
        extras.noballs += ex.noballs ?? 0;
        extras.penalty += ex.penalty ?? 0;

        // wickets
        for (const w of d.wickets ?? []) {
          wickets += 1;
          fow.push({ over: over.over + 1, score: cumulative, wicket: wickets, batter: w.player_out });
          const outRow = batting.get(w.player_out);
          if (outRow) outRow.dismissal = dismissalText(w, bowler);
        }
      }
      // record per-over runs for maiden detection
      const lastBowler = inn.overs?.[over.over]?.deliveries?.at(-1)?.bowler;
      if (lastBowler) {
        const arr = overRunsByBowler.get(lastBowler) ?? [];
        arr.push(overRuns);
        overRunsByBowler.set(lastBowler, arr);
      }
    }

    // finalize batting rows
    const battingRows = [...batting.values()].map((r) => ({
      ...r,
      strikeRate: r.balls > 0 ? Math.round((r.runs / r.balls) * 1000) / 10 : 0,
    }));

    // finalize bowling rows
    const bowlingRows = [...bowling.values()].map((r) => {
      const balls = r.overs;
      const o = oversFromBalls(balls);
      const perOver = overRunsByBowler.get(r.name) ?? [];
      const maidens = perOver.filter((v) => v === 0).length;
      return {
        ...r,
        overs: Math.round(o * 10) / 10,
        maidens,
        economy: balls > 0 ? Math.round((r.runs / (balls / 6)) * 100) / 100 : 0,
      };
    });

    inningsDetails.push({
      team,
      total,
      wickets,
      balls: legalBalls,
      extras,
      batting: battingRows,
      bowling: bowlingRows,
      fallOfWickets: fow,
    });

    wormTeams.push(team);
    const cumMap = new Map<number, number>();
    let c = 0;
    cumMap.set(0, 0);
    for (const over of inn.overs ?? []) {
      for (const d of over.deliveries ?? []) c += d.runs?.total ?? 0;
      cumMap.set(over.over + 1, c);
    }
    wormSeries.push(cumMap);
  }

  // Build worm points (only for limited-overs style comparisons of first two innings)
  const worm: WormPoint[] = [];
  if (wormSeries.length >= 2) {
    const maxOver = Math.max(...wormSeries.map((m) => Math.max(...m.keys())));
    for (let o = 0; o <= maxOver; o++) {
      const point: WormPoint = { over: o };
      point[wormTeams[0]] = wormSeries[0].get(o) ?? wormSeries[0].get(Math.min(o, Math.max(...wormSeries[0].keys()))) ?? 0;
      point[wormTeams[1]] = wormSeries[1].get(o) ?? wormSeries[1].get(Math.min(o, Math.max(...wormSeries[1].keys()))) ?? 0;
      worm.push(point);
    }
  }

  const tossInfo = info.toss as { winner?: string; decision?: string } | undefined;
  const officialsRaw = info.officials as { umpires?: string[] } | undefined;
  const officials = officialsRaw?.umpires ?? [];

  return {
    summary,
    innings: inningsDetails,
    worm,
    toss: tossInfo?.winner ? { winner: tossInfo.winner, decision: tossInfo.decision ?? "" } : undefined,
    officials,
  };
}

/** Build standard commentary text for a single raw delivery */
function deliveryText(
  d: RawDelivery,
  batScore: Map<string, { runs: number; balls: number }>,
): string {
  const bowler = d.bowler ?? "?";
  const batter = d.batter ?? "?";
  const runs = d.runs ?? {};
  const ex = d.extras ?? {};

  let core: string;
  if (ex.wides) core = `${ex.wides} wide${ex.wides > 1 ? "s" : ""}`;
  else if (ex.noballs) core = `${ex.noballs} no ball${ex.noballs > 1 ? "s" : ""}`;
  else if (ex.byes || ex.legbyes || ex.penalty) {
    const b = (ex.byes ?? 0) + (ex.legbyes ?? 0) + (ex.penalty ?? 0);
    const kind = ex.byes ? "bye" : ex.legbyes ? "leg bye" : "penalty";
    core = `${b} ${kind}${b > 1 ? "s" : ""}`;
  } else {
    const r = runs.batter ?? 0;
    core = r === 0 ? "no run" : r === 4 ? "FOUR" : r === 6 ? "SIX" : `${r} run${r > 1 ? "s" : ""}`;
  }

  // update the striker's cumulative score before rendering any wicket line
  const st = batScore.get(batter) ?? { runs: 0, balls: 0 };
  st.runs += runs.batter ?? 0;
  if (!ex.wides && !ex.noballs) st.balls += 1;
  batScore.set(batter, st);

  let text = `${bowler} to ${batter}, ${core}`;

  const w = d.wickets?.[0];
  if (w) {
    const out = batScore.get(w.player_out) ?? { runs: 0, balls: 0 };
    text = `WICKET! ${dismissalText(w, bowler)} ${out.runs}(${out.balls})`;
  }
  return text;
}

/**
 * Generate ball-by-ball commentary events (newest first) from every raw
 * Cricsheet delivery, shaped like the live Cricbuzz commentary feed so both
 * tabs render through the same ESPNcricinfo-style component.
 */
export async function parseCommentaryEvents(summary: MatchSummary): Promise<CommentaryBall[] | null> {
  const raw = await readRawMatch(summary.format, summary.id);
  if (!raw) return null;

  const balls: CommentaryBall[] = [];
  const inningsList = raw.innings ?? [];
  // newest-first overall: reverse innings order, then reverse overs/balls
  for (let i = inningsList.length - 1; i >= 0; i--) {
    const inn = inningsList[i];
    const batScore = new Map<string, { runs: number; balls: number }>();
    const overs = inn.overs ?? [];
    for (let o = overs.length - 1; o >= 0; o--) {
      const over = overs[o];
      const dels = over.deliveries ?? [];
      // forward pass to assign legal-ball numbers within the over
      let legal = 0;
      const numbered = dels.map((d) => {
        const ex = d.extras ?? {};
        if (!ex.wides && !ex.noballs) legal += 1;
        return { d, n: legal };
      });
      for (let k = numbered.length - 1; k >= 0; k--) {
        const { d, n } = numbered[k];
        balls.push({
          text: deliveryText(d, batScore),
          over: over.over,
          ballInOver: n,
          inningsId: i,
        });
      }
    }
  }
  return balls.length ? balls : null;
}
