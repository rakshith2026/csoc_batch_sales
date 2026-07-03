# CsoC Batch Explorer

A web dashboard for browsing CircleChess (CsoC) batch schedules, with a serverless
API that pulls live data on every page load.

## Files
- `index.html` — the dashboard. On load it fetches `/api/data`; if that fails
  (e.g. running the file locally without the API) it falls back to the
  embedded snapshot so the page still works.
- `api/data.js` — Vercel serverless function. Logs into the SQL Explorer
  (`explorer.circlechess.com/224/`), downloads the batch data, looks up each
  coach's FIDE rating from `api.chesstools.org`, and returns clean JSON.
- `batches.json` — snapshot of batch data, used only to regenerate the
  embedded fallback in `index.html`.

## Environment variables (required for live data)
Set these in the Vercel project settings (Settings → Environment Variables),
not in the code:
- `EXPLORER_USERNAME`
- `EXPLORER_PASSWORD`

Without them, `/api/data` returns an error and the page silently falls back
to the last embedded snapshot.

## Features
- Filter by **Level** (parsed from batch code, e.g. `B`, `F1`, `F2`, `IN3`, `ADV`, `MP`, `PG`; `F` and `F1` are merged)
- Filter by **Country** (first letters of batch code, e.g. `IND` → India, `US`, `UK`, `AUS`)
- Filter by **Status** (registration open/closed, defaults to Open) and **Coach** (including "no coach assigned")
- Views: **All batches**, **Starting this week**, **Unfilled — last week**
  - "Unfilled" = batch started last week but registration is still open
- **FIDE Rating** column — highest of classical/rapid/blitz per coach
- "Ask about this data" — answers common questions directly from the loaded table (client-side pattern matching, no external AI call)
- Search by coach name or batch code, sortable columns

## Usage
Deployed on Vercel — static `index.html` + `api/data.js` function, zero build step.
To run locally, serve the folder with any static server; without the API route
available it'll show the cached snapshot instead of live data.

## Updating the fallback snapshot
Re-export from the SQL Explorer query, enrich with FIDE ratings, and replace
the `FALLBACK_RAW` array in `index.html` (and `batches.json`) — this is just
the safety net shown when `/api/data` is unreachable.
