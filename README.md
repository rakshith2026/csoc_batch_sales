# CsoC Batch Explorer

A self-contained web dashboard for browsing CircleChess (CsoC) batch schedules.

## Files
- `index.html` — the dashboard (data embedded inline, no build step, no server required)
- `batches.json` — snapshot of batch data pulled from the SQL Explorer (`explorer.circlechess.com/224/`)

## Features
- Filter by **Level** (parsed from batch code, e.g. `B`, `F`, `F2`, `IN3`, `ADV`, `MP`, `PG`)
- Filter by **Country** (first letters of batch code, e.g. `IND` → India, `US`, `UK`, `AUS`)
- Views: **All batches**, **Starting this week**, **Unfilled — last week**
  - "Unfilled" = batch started last week but registration is still open
- Search by coach name or batch code, sortable columns

## Usage
Open `index.html` directly in a browser — no dependencies.

## Updating data
Data is a static snapshot. To refresh, re-export from the SQL Explorer query and replace `batches.json`, then re-embed it into `index.html`'s `RAW` constant.
