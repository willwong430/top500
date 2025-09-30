import axios from "axios";
import { withBackoff, sleep } from "../lib/retry.js";

const BASE = "https://api.polygon.io";
const apiKey = process.env.POLYGON_API_KEY!;

// Tunables (override via .env if needed)
const PAGE_LIMIT     = Number(process.env.POLYGON_PAGE_LIMIT     || 1000); // list page size
const MAX_PAGES      = Number(process.env.POLYGON_MAX_PAGES      || 10);   // ~10k symbols
const PAGE_PAUSE_MS  = Number(process.env.POLYGON_PAGE_PAUSE     || 150);
const REQ_TIMEOUT    = Number(process.env.POLYGON_REQ_TIMEOUT    || 30000);

const DETAIL_CONC    = Number(process.env.POLYGON_DETAIL_CONC    || 10);   // concurrent detail calls
const DETAIL_DELAY   = Number(process.env.POLYGON_DETAIL_DELAY   || 100);  // ms between detail calls per worker
const DETAIL_MAX     = Number(process.env.POLYGON_DETAIL_MAX     || 2500); // enrich up to N symbols (enough to rank 500)

const OVERRIDE_DATE  = process.env.POLYGON_DATE || ""; // optional YYYY-MM-DD

export type Row = { ticker: string; name: string; marketCap?: number };

export async function listUSFromPolygon(): Promise<Row[]> {
  if (!apiKey) throw new Error("POLYGON_API_KEY missing");

  // 1) pick a date
  const ymd = await getMostRecentTradingDay();

  // 2) build US ticker list (basic)
  const tickers = await fetchUSTickers();
  if (tickers.length === 0) throw new Error("no US tickers returned from /v3/reference/tickers");

  // 3) per-ticker detail to get market_cap (until we have enough)
  const enriched = await enrichMarketCapsByDetail(tickers, ymd);

  // 4) sort & return (caller will slice Top 500)
  const out = enriched
    .filter(r => r.marketCap && r.marketCap > 0)
    .sort((a, b) => (b.marketCap! - a.marketCap!));

  if (out.length === 0) throw new Error("polygon detail returned 0 market caps; check plan/permissions");
  return out;
}

/* ---------- helpers ---------- */

async function getMostRecentTradingDay(): Promise<string> {
  if (OVERRIDE_DATE) return OVERRIDE_DATE;

  const toYMD = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);

  let d = new Date();
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 7; i++) {
    const day = d.getDay(); // 0 Sun, 6 Sat
    if (day !== 0 && day !== 6) {
      // sanity ping: list 1 ticker with &date to ensure the day is valid
      const url = `${BASE}/v3/reference/tickers?active=true&market=stocks&locale=us&limit=1&date=${toYMD(d)}&apiKey=${apiKey}`;
      try {
        const { data } = await withBackoff(() => axios.get(url, { timeout: REQ_TIMEOUT }), { tries: 3 });
        if (Array.isArray(data?.results) && data.results.length > 0) return toYMD(d);
      } catch { /* try previous biz day */ }
    }
    d.setDate(d.getDate() - 1);
  }
  throw new Error("could not find a recent trading day");
}

async function fetchUSTickers(): Promise<{ ticker: string; name: string }[]> {
  let url =
    `${BASE}/v3/reference/tickers?` +
    `active=true&market=stocks&locale=us&limit=${PAGE_LIMIT}&apiKey=${apiKey}`;

  const out: { ticker: string; name: string }[] = [];
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    pages++;
    const { data } = await withBackoff(
      () => axios.get(url, { timeout: REQ_TIMEOUT }),
      { tries: 6, baseMs: 800, maxMs: 20000 }
    );
    const batch: any[] = Array.isArray(data?.results) ? data.results : [];
    for (const r of batch) {
      if (r?.ticker) out.push({ ticker: r.ticker, name: r.name || r.ticker });
    }
    url = data?.next_url ? `${data.next_url}&apiKey=${apiKey}` : "";
    if (url) await sleep(PAGE_PAUSE_MS);
  }
  return out;
}

async function enrichMarketCapsByDetail(
  tickers: { ticker: string; name: string }[],
  dateYMD: string
): Promise<Row[]> {
  const out: Row[] = [];
  let i = 0;
  const total = Math.min(DETAIL_MAX, tickers.length);

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= total) break;
      const t = tickers[idx];
      try {
        const mc = await fetchOneMarketCap(t.ticker, dateYMD);
        if (Number.isFinite(mc) && (mc as number) > 0) {
          out.push({ ticker: t.ticker, name: t.name, marketCap: mc as number });
        }
      } catch { /* ignore symbol and continue */ }
      if (DETAIL_DELAY > 0) await sleep(DETAIL_DELAY);
    }
  }

  await Promise.all(Array.from({ length: DETAIL_CONC }, () => worker()));
  return out;
}

async function fetchOneMarketCap(ticker: string, dateYMD: string): Promise<number | undefined> {
  const url = `${BASE}/v3/reference/tickers/${encodeURIComponent(ticker)}?date=${dateYMD}&apiKey=${apiKey}`;
  const { data } = await withBackoff(
    () => axios.get(url, { timeout: REQ_TIMEOUT }),
    { tries: 4, baseMs: 800, maxMs: 15000 }
  );

  const r = data?.results || data;
  // prefer the exact field you observed
  const candidates = [
    Number(r?.market_cap),
    Number(r?.marketcap),
    Number(r?.marketCapitalization),
  ].filter(n => Number.isFinite(n) && n > 0);

  return candidates[0];
}
