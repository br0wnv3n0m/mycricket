# 🏏 MyCricket

A beautiful, modern cricket dashboard with live scores, past results and upcoming fixtures.

## Features

- **Live dashboard** — auto-polled live match cards with animated score updates
- **Past results** — 10,000+ matches (IPL, ODIs, T20s, Tests) with filters for team, series, format and free-text search
- **Match detail** — full scorecards, fall of wickets and an animated runs-progression (worm) chart built from Cricsheet ball-by-ball data
- **Schedule** — upcoming fixtures grouped by day, sourced from both the local database and the live API

## Tech Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [Framer Motion](https://www.framer.com/motion/) animations
- [Recharts](https://recharts.org) charts
- Data: [Cricsheet](https://cricsheet.org) ball-by-ball JSON + [live-cricket-score-api](https://github.com/mskian/live-cricket-score-api)

## Getting Started

```bash
npm install

# Build the searchable match index from the Data/ folder (Cricsheet JSON)
npm run index

# Optional: fetch upcoming fixtures + recently finished matches from your live-score API
set LIVE_API_BASE=https://your-live-api-host
npm run sync

npm run dev
```

Open http://localhost:3000

## Project Structure

```
Data/                  # Cricsheet ball-by-ball datasets (ipl_json, odis_json, t20s_json, tests_json)
scripts/
  build-index.mjs      # Generates data/matches.json from Data/
  sync-live.mjs        # Pulls fixtures + recent results from the live API into data/
app/                   # Next.js pages (dashboard, past, schedule, match detail)
components/            # UI components (match cards, charts, filters)
lib/                   # Types, Cricsheet parser, query layer, live API adapter
data/                  # Generated index + synced fixtures (gitignored)
```

## Staying Up To Date

1. Run `npm run sync` whenever you want fresh fixtures/results (no Cricsheet re-download needed).
2. Occasionally re-download the Cricsheet zips into `Data/` and run `npm run index` to get full
   ball-by-ball charts for newer matches. Live-synced matches are merged automatically.