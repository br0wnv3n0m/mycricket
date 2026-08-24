/**
 * build-index.mjs
 * Reads the Cricsheet JSON datasets in ./Data and generates:
 *   - data/matches.json  (lightweight normalized index of every match)
 *
 * Run: npm run index
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve project root relative to this file so the script works from any cwd
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "Data");
const OUT_DIR = path.join(ROOT, "data");

const FORMATS = ["ipl", "odis", "t20s", "tests"];

function computeInningsTotals(raw) {
  const innings = [];
  for (const inn of raw.innings ?? []) {
    let runs = 0;
    let wickets = 0;
    let legalBalls = 0;
    for (const over of inn.overs ?? []) {
      for (const d of over.deliveries ?? []) {
        runs += d.runs?.total ?? 0;
        wickets += d.wickets?.length ?? 0;
        const ex = d.extras ?? {};
        if (!ex.wides && !ex.noballs) legalBalls += 1;
      }
    }
    innings.push({
      team: inn.team,
      runs,
      wickets,
      overs: Math.floor(legalBalls / 6) + (legalBalls % 6 ? (legalBalls % 6) / 10 : 0),
    });
  }
  return innings;
}

function buildResultText(info) {
  const o = info.outcome ?? {};
  if (o.winner) {
    const by = o.by ?? {};
    if (by.runs != null) return `${o.winner} won by ${by.runs} run${by.runs === 1 ? "" : "s"}`;
    if (by.wickets != null) return `${o.winner} won by ${by.wickets} wicket${by.wickets === 1 ? "" : "s"}`;
    if (by.innings != null) return `${o.winner} won by an innings and ${by.runs ?? 0} run${by.runs === 1 ? "" : "s"}`;
    return `${o.winner} won`;
  }
  if (o.result === "tie") return "Match tied";
  if (o.result === "no result") return "No result";
  if (o.result === "abandoned") return "Match abandoned";
  if (o.method) return `Result: ${o.method}`;
  return "Result unavailable";
}

function summarize(format, id, raw) {
  const info = raw.info ?? {};
  const dates = info.dates ?? [];
  const event = info.event?.name;
  return {
    id,
    format,
    matchType: info.match_type ?? "",
    date: dates[0] ?? "",
    endDate: dates.length > 1 ? dates[dates.length - 1] : undefined,
    event,
    season: info.season != null ? String(info.season) : undefined,
    teams: info.teams ?? [],
    venue: info.venue,
    city: info.city,
    gender: info.gender,
    winner: info.outcome?.winner,
    resultText: buildResultText(info),
    innings: computeInningsTotals(raw),
    playerOfMatch: info.player_of_match,
    hasBallByBall: Array.isArray(raw.innings) && raw.innings.length > 0,
  };
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found at ${DATA_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Merge in any live-synced matches captured by scripts/sync-live.mjs
  const syncedPath = path.join(OUT_DIR, "live-synced.json");
  let synced = [];
  if (fs.existsSync(syncedPath)) {
    try {
      synced = JSON.parse(fs.readFileSync(syncedPath, "utf8"));
      console.log(`Merging ${synced.length} live-synced matches`);
    } catch {
      synced = [];
    }
  }

  const all = [...synced];
  const counts = {};

  for (const format of FORMATS) {
    const dir = path.join(DATA_DIR, `${format}_json`);
    if (!fs.existsSync(dir)) {
      console.warn(`Skipping missing dataset folder: ${dir}`);
      continue;
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    let ok = 0;
    let failed = 0;
    for (const file of files) {
      const id = path.basename(file, ".json");
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        all.push(summarize(format, id, raw));
        ok += 1;
      } catch (err) {
        failed += 1;
        console.warn(`Failed to parse ${format}/${file}: ${err.message}`);
      }
    }
    counts[format] = { total: files.length, indexed: ok, failed };
    console.log(`${format}: indexed ${ok}/${files.length}`);
  }

  // Sort newest first
  all.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id));

  fs.writeFileSync(path.join(OUT_DIR, "matches.json"), JSON.stringify(all));
  fs.writeFileSync(
    path.join(OUT_DIR, "meta.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), counts, total: all.length }, null, 2)
  );
  console.log(`Done. Wrote ${all.length} matches to data/matches.json`);
}

main();