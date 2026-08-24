export type Format = "ipl" | "odis" | "t20s" | "tests";

export const FORMATS: Format[] = ["ipl", "odis", "t20s", "tests"];

export const FORMAT_LABELS: Record<Format, string> = {
  ipl: "IPL",
  odis: "ODIs",
  t20s: "T20s",
  tests: "Tests",
};

/** Per-innings totals used in list views */
export interface InningsSummary {
  team: string;
  runs: number;
  wickets: number;
  overs: number;
}

/** Lightweight normalized match record stored in data/matches.json */
export interface MatchSummary {
  id: string;
  /** which dataset folder the raw file lives in */
  format: Format;
  /** Cricsheet match_type e.g. T20, ODI, Test, IT20 */
  matchType: string;
  date: string;
  endDate?: string;
  event?: string;
  season?: string;
  teams: [string, string];
  venue?: string;
  city?: string;
  gender?: string;
  winner?: string;
  resultText?: string;
  innings?: InningsSummary[];
  playerOfMatch?: string[];
  hasBallByBall: boolean;
}

/** A match coming from the live-score API (synced or polled at runtime) */
export interface LiveMatch {
  id: string;
  state: "live" | "recent" | "upcoming";
  title: string;
  teams: [string, string];
  status: string;
  score?: string;
  venue?: string;
  formatHint?: string;
  startTime?: string;
}

export interface LiveData {
  live: LiveMatch[];
  recent: LiveMatch[];
  upcoming: LiveMatch[];
  fetchedAt: string;
  ok: boolean;
}

/** Batting card row on the match detail page */
export interface BattingRow {
  name: string;
  dismissal: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
}

export interface BowlingRow {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface InningsDetail {
  team: string;
  total: number;
  wickets: number;
  balls: number;
  extras: { total: number; byes: number; legbyes: number; wides: number; noballs: number; penalty: number };
  batting: BattingRow[];
  bowling: BowlingRow[];
  fallOfWickets: { over: number; score: number; wicket: number; batter: string }[];
}

/** Cumulative runs per over for the worm graph */
export interface WormPoint {
  over: number;
  [team: string]: number | string;
}

export interface MatchDetail {
  summary: MatchSummary;
  innings: InningsDetail[];
  worm: WormPoint[];
  toss?: { winner: string; decision: string };
  officials?: string[];
}