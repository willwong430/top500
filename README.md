# Top 500 (US) — Daily Close MVP

A simplified React + Node app that, once per day at US market close, fetches the 500 most valuable US public companies by market cap and exposes:
- `/api/top500.json` — Top 500 ranks for the latest day
- `/api/movers.json` — Top 10 movers by rank vs previous day
- `/api/changes.json` — Entered / Exited vs previous day

## Quick start
```bash
cp .env.example .env
# Set VENDOR and API key in .env (Polygon or Finnhub)
docker compose up --build
# (Optional) Trigger a snapshot immediately instead of waiting for 4:05pm ET:
docker compose exec server node dist/src/closeJob.js
```
- Web UI: http://localhost:5173
- API: http://localhost:4000/api/top500.json
# top500
