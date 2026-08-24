import "server-only";

/**
 * IPTV integration for the Watch tab.
 *
 * Supports two provider styles (configure via .env.local):
 *   1. Plain M3U playlist:      IPTV_M3U_URL=https://.../playlist.m3u
 *   2. Xtream Codes login:      IPTV_XTREAM_HOST / IPTV_XTREAM_USERNAME / IPTV_XTREAM_PASSWORD
 *
 * Channels are cached in-memory (playlist ~6h, EPG ~10min) so match pages stay fast.
 * Everything degrades gracefully: no config -> Watch tab shows setup instructions.
 */

export interface IptvChannel {
  id: string;
  name: string;
  group: string;
  logo?: string;
  /** playable URL (m3u8 / ts) */
  url: string;
}

export interface IptvProgramme {
  title: string;
  description?: string;
  start?: number; // epoch ms
  stop?: number;
}

type IptvConfig =
  | { kind: "m3u"; m3uUrl: string }
  | { kind: "xtream"; host: string; username: string; password: string };

/* ------------------------------ config ------------------------------ */

export function getIptvConfig(): IptvConfig | null {
  const m3uUrl = process.env.IPTV_M3U_URL?.trim();
  if (m3uUrl) return { kind: "m3u", m3uUrl };

  const host = process.env.IPTV_XTREAM_HOST?.trim().replace(/\/+$/, "");
  const username = process.env.IPTV_XTREAM_USERNAME?.trim();
  const password = process.env.IPTV_XTREAM_PASSWORD?.trim();
  if (host && username && password) return { kind: "xtream", host, username, password };

  return null;
}

export function isIptvConfigured(): boolean {
  return getIptvConfig() !== null;
}

/* ------------------------------ fetching ---------------------------- */

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T | null> {
  const text = await fetchText(url, timeoutMs);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/* ------------------------------ M3U parsing ------------------------- */

function parseM3U(text: string): IptvChannel[] {
  const channels: IptvChannel[] = [];
  const lines = text.split(/\r?\n/);
  let pending: Partial<IptvChannel> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const name = line.slice(line.lastIndexOf(",") + 1).trim();
      const group = line.match(/group-title="([^"]*)"/i)?.[1] ?? "";
      const logo = line.match(/tvg-logo="([^"]*)"/i)?.[1] ?? undefined;
      pending = { name, group, logo };
    } else if (!line.startsWith("#") && pending?.name) {
      channels.push({
        id: `ch-${channels.length}`,
        name: pending.name,
        group: pending.group || "Other",
        logo: pending.logo,
        url: line,
      });
      pending = null;
    }
  }
  return channels;
}

/* ------------------------------ Xtream ------------------------------ */

interface XtreamStream {
  num?: number;
  name?: string;
  stream_id?: number;
  stream_icon?: string;
  category_id?: string;
}
interface XtreamCategory {
  category_id?: string;
  category_name?: string;
}
interface XtreamEpgEntry {
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  start_timestamp?: string;
  stop_timestamp?: string;
}

function xtreamApiUrl(cfg: Extract<IptvConfig, { kind: "xtream" }>, params: Record<string, string>): string {
  const qs = new URLSearchParams({ username: cfg.username!, password: cfg.password!, ...params });
  return `${cfg.host}/player_api.php?${qs.toString()}`;
}

async function fetchXtreamChannels(cfg: Extract<IptvConfig, { kind: "xtream" }>): Promise<IptvChannel[]> {
  const [cats, streams] = await Promise.all([
    fetchJson<XtreamCategory[]>(xtreamApiUrl(cfg, { action: "get_live_categories" })),
    fetchJson<XtreamStream[]>(xtreamApiUrl(cfg, { action: "get_live_streams" })),
  ]);
  if (!streams || !Array.isArray(streams)) return [];

  const catNames = new Map<string, string>();
  for (const c of cats ?? []) {
    if (c.category_id && c.category_name) catNames.set(String(c.category_id), c.category_name);
  }

  return streams
    .filter((s) => s.stream_id != null && s.name)
    .map((s) => ({
      id: `x-${s.stream_id}`,
      name: s.name!,
      group: catNames.get(String(s.category_id)) ?? "Other",
      logo: s.stream_icon,
      url: `${cfg.host}/live/${cfg.username}/${cfg.password}/${s.stream_id}.m3u8`,
    }));
}

/** Current programme per stream id (only sports-ish groups to limit requests) */
async function fetchXtreamEpg(
  cfg: Extract<IptvConfig, { kind: "xtream" }>,
  channels: IptvChannel[],
): Promise<Map<string, IptvProgramme>> {
  const epg = new Map<string, IptvProgramme>();
  const sportsIds = channels
    .filter((c) => /sport|cricket|willow|star|sky|tnt|supersport|kayo|ptv|ten ?sports|astro|willow/i.test(`${c.group} ${c.name}`))
    .slice(0, 60); // cap concurrent-ish work

  const results = await Promise.allSettled(
    sportsIds.map(async (ch) => {
      const sid = ch.id.replace(/^x-/, "");
      const data = await fetchJson<{ epg_listings?: XtreamEpgEntry[] }>(
        xtreamApiUrl(cfg, { action: "get_short_epg", stream_id: sid, limit: "2" }),
        8000,
      );
      const now = Date.now() / 1000;
      const listing =
        data?.epg_listings?.find((p) => {
          const s = Number(p.start_timestamp ?? 0);
          const e = Number(p.stop_timestamp ?? 0);
          return s && e && now >= s && now < e;
        }) ?? data?.epg_listings?.[0];
      if (listing?.title) {
        // titles are often base64-encoded by Xtream
        let title = listing.title;
        try {
          if (/^[A-Za-z0-9+/]+=*$/.test(title) && title.length % 4 === 0) {
            title = Buffer.from(title, "base64").toString("utf8") || title;
          }
        } catch {
          /* keep raw */
        }
        epg.set(ch.id, {
          title,
          description: listing.description,
          start: Number(listing.start_timestamp ?? 0) * 1000 || undefined,
          stop: Number(listing.stop_timestamp ?? 0) * 1000 || undefined,
        });
      }
    }),
  );
  void results;
  return epg;
}

/* ------------------------------ caching ----------------------------- */

const PLAYLIST_TTL_MS = 6 * 60 * 60 * 1000;
const EPG_TTL_MS = 10 * 60 * 1000;

let cache: {
  channels: IptvChannel[];
  fetchedAt: number;
} | null = null;

let epgCache: {
  epg: Map<string, IptvProgramme>;
  fetchedAt: number;
} | null = null;

export async function getIptvChannels(force = false): Promise<IptvChannel[]> {
  const cfg = getIptvConfig();
  if (!cfg) return [];
  if (!force && cache && Date.now() - cache.fetchedAt < PLAYLIST_TTL_MS) return cache.channels;

  let channels: IptvChannel[] = [];
  if (cfg.kind === "m3u") {
    const text = await fetchText(cfg.m3uUrl!);
    if (text) channels = parseM3U(text);
  } else {
    channels = await fetchXtreamChannels(cfg);
  }

  if (channels.length > 0) cache = { channels, fetchedAt: Date.now() };
  else if (cache) return cache.channels; // stale-but-better-than-empty
  return channels;
}

export async function getIptvEpg(channels: IptvChannel[]): Promise<Map<string, IptvProgramme>> {
  const cfg = getIptvConfig();
  if (!cfg || cfg.kind !== "xtream") return new Map();
  if (epgCache && Date.now() - epgCache.fetchedAt < EPG_TTL_MS) return epgCache.epg;

  const epg = await fetchXtreamEpg(cfg, channels);
  if (epg.size > 0) epgCache = { epg, fetchedAt: Date.now() };
  return epgCache?.epg ?? epg;
}

/* --------------------------- match -> channel ------------------------ */

const COMPETITION_KEYWORDS: Record<string, string[]> = {
  ipl: ["ipl", "indian premier league"],
  psl: ["psl", "pakistan super league"],
  bbl: ["bbl", "big bash"],
  hundred: ["the hundred"],
  t20wc: ["t20 world cup", "world cup"],
  odiwc: ["odi world cup", "world cup"],
  test: ["test"],
};

/** Words worth matching against channel/EPG text */
function teamTokens(team: string): string[] {
  return team
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

export interface ChannelMatchResult {
  best: IptvChannel | null;
  ranked: { channel: IptvChannel; score: number; reason: string }[];
  method: "epg" | "keywords" | "none";
}

/**
 * Find which IPTV channel is showing a given match.
 * Layer 1: EPG programme title contains both teams' tokens.
 * Layer 2: keyword scoring over channel name/group (+ EPG titles as bonus).
 */
export function findChannelsForMatch(
  match: { teams: [string, string]; formatHint?: string },
  channels: IptvChannel[],
  epg: Map<string, IptvProgramme>,
): ChannelMatchResult {
  if (channels.length === 0) return { best: null, ranked: [], method: "none" };

  const [teamA, teamB] = match.teams;
  const tokensA = teamTokens(teamA);
  const tokensB = teamTokens(teamB);

  // Layer 1: EPG contains both teams
  if (epg.size > 0) {
    const hits: { channel: IptvChannel; score: number; reason: string }[] = [];
    for (const ch of channels) {
      const prog = epg.get(ch.id);
      if (!prog) continue;
      const hay = `${prog.title} ${prog.description ?? ""}`.toLowerCase();
      const hasA = tokensA.some((t) => hay.includes(t));
      const hasB = tokensB.some((t) => hay.includes(t));
      if (hasA && hasB) {
        hits.push({ channel: ch, score: 100, reason: `EPG: “${prog.title}”` });
      }
    }
    if (hits.length > 0) {
      hits.sort((a, b) => a.channel.name.localeCompare(b.channel.name));
      return { best: hits[0].channel, ranked: hits.slice(0, 8), method: "epg" };
    }
  }

  // Layer 2: keyword scoring
  const fmt = (match.formatHint ?? "").toLowerCase();

  const scored = channels.map((ch) => {
    const prog = epg.get(ch.id);
    const hay = `${ch.name} ${ch.group} ${prog?.title ?? ""}`.toLowerCase();
    let score = 0;
    let reason = "";

    for (const w of [...tokensA, ...tokensB]) {
      if (hay.includes(w)) {
        score += 20;
        reason = reason || `matches “${w}”`;
      }
    }
    for (const kw of Object.entries(COMPETITION_KEYWORDS)) {
      if (kw[1].some((k) => hay.includes(k))) {
        score += fmt.includes(kw[0]) ? 30 : 15;
        reason = reason || `carries ${kw[0].toUpperCase()} cricket`;
      }
    }
    // generic cricket/sports channels get a small nudge so they outrank news/movie channels
    if (/cricket/.test(hay)) score += 10;
    else if (/sport/.test(hay)) score += 5;
    else score -= 25; // movies/news/kids groups sink

    return { channel: ch, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  const positive = scored.filter((s) => s.score > 0);
  if (positive.length === 0) return { best: null, ranked: [], method: "none" };
  return { best: positive[0].channel, ranked: positive.slice(0, 8), method: "keywords" };
}

// Feature flag: flip to true to re-enable the Watch tab
export const WATCH_ENABLED = false;
