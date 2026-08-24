/**
 * sync-cricsheet.mjs
 * Downloads Cricsheet's 'recently added' incremental dataset (matches added in the
 * previous 2 days), sorts each match into the right local dataset folder
 * (tests / odis / t20s / ipl) based on its metadata, and rebuilds the index.
 * Usage: npm run sync-data
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'Data');
const RECENT_URL = 'https://cricsheet.org/downloads/recently_added_2_json.zip';

function log(m) {
  console.log(`[sync] ${m}`);
}

function bucketFor(info) {
  const type = String(info.match_type ?? '').toLowerCase();
  const event = String(info.event?.name ?? '').toLowerCase();
  if (event.includes('indian premier league') || event === 'ipl') return 'ipl';
  if (type.includes('test')) return 'tests';
  if (type.includes('odi')) return 'odis';
  if (type.includes('t20')) return 't20s';
  return null;
}

async function main() {
  const zipPath = path.join(DATA_DIR, 'recently_added_2_json.zip');
  const outDir = path.join(DATA_DIR, '_recent_tmp');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  log('downloading recently_added_2_json.zip ...');
  const res = await fetch(RECENT_URL);
  if (!res.ok || !res.body) {
    log(`download failed (${res.status})`);
    process.exit(1);
  }
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  fs.rmSync(outDir, { recursive: true, force: true });
  log('extracting...');
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${zipPath}' -DestinationPath '${outDir}'`],
    { stdio: 'inherit' },
  );

  // files may sit at the root of the zip or inside one folder
  let src = outDir;
  const entries = fs.readdirSync(outDir);
  if (entries.length === 1 && fs.statSync(path.join(outDir, entries[0])).isDirectory()) {
    src = path.join(outDir, entries[0]);
  }

  const counts = {};
  let added = 0;
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.json')) continue;
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8')); } catch { continue; }
    const bucket = bucketFor(raw.info ?? {});
    if (!bucket) continue;
    const destDir = path.join(DATA_DIR, `${bucket}_json`);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(path.join(src, f), path.join(destDir, f));
    counts[bucket] = (counts[bucket] ?? 0) + 1;
    added += 1;
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
  log(`sorted ${added} new matches: ${JSON.stringify(counts)}`);

  if (added > 0) {
    log('rebuilding index...');
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-index.mjs')], { stdio: 'inherit' });
  } else {
    log('nothing new; index unchanged');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
