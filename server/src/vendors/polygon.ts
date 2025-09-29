// server/src/vendors/polygon.ts
import axios from "axios";
import { withBackoff, sleep } from "../lib/retry.js";

const BASE = "https://api.polygon.io";
const apiKey = process.env.POLYGON_API_KEY!;

// Tunables (override in .env if needed)
const PAGE_LIMIT    = Number(process.env.POLYGON_PAGE_LIMIT    || 1000); // tickers page size (max 1000)
const MAX_PAGES     = Number(process.env.POLYGON_MAX_PAGES     || 10);   // ~10k symbols max
const PAGE_PAUSE    = Number(process.env.POLYGON_PAGE_PAUSE    || 150);  // ms between ticker pages
const REQ_TIMEOUT   = Number(process.env.POLYGON_REQ_TIMEOUT   || 30000);
const FIN_CONC      = Number(process.env.POLYGON_FIN_CONC      || 6);    // concurrent financials fetches
const FIN_DELAY_MS  = Number(process.env.POLYGON_FIN_DELAY_MS  || 120);  // stagger between financial calls
const FIN_MAX_TICKS = Number(process.env.POLYGON_FIN_MAX_TICKS || 1500); // safety cap: how many tickers to enrich

type Row = { ticker: string; name: string; marketCap?: number };

export async function listUSFromPolygon(): Promise<Row[]> {
  if (!apiKey) throw new Error("POLYGON_API_KEY missing");

  // 1) Bulk previous close for all US stocks (1 request)
  const prev = await fetchPrevCloseMap();

  // 2) Build US ticker list (basic)
  const tickers = await fetchUSTickers();
  if (tickers.length === 0) throw new Error("no US tickers returned from /v3/reference/tickers");

  // 3) Fetch shares outstanding for a subset (until we have enough to rank 500)
  const sharesMap = await fetchSharesOutstandingForMany(
    tickers.map(t => t.ticker),
    Math.min(FIN_MAX_TICKS, tickers.length)
  );

  // 4) Join and compute market cap
  const out: Row[] = [];
  for (const t of tickers) {
    const price = prev.get(t.ticker);
    const soRec = sharesMap.get(t.ticker);
    if (!price || !soRec) continue;
    const mc = price * soRec.shares;
    if (Number.isFinite(mc) && mc > 0) {
      out.push({ ticker: t.ticker, name: t.name, marketCap: mc });
    }
  }

  // 5) Sort desc and return (caller slices Top 500)
  out.sort((a, b) => (b.marketCap! - a.marketCap!));
  return out;
}

/* ---------- helpers ---------- */

// /v2/aggs/grouped/…/prev — prev close for ALL tickers
// Replace your fetchPrevCloseMap() with this:

async function fetchPrevCloseMap(): Promise<Map<string, number>> {
  // Try most recent business days until we get data (max 7 days back)
  const map = new Map<string, number>();

  // Helper: format date as YYYY-MM-DD in America/New_York (close is based on US markets)
  const toYMD = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // Start from "yesterday" ET and walk back skipping weekends/holidays
  let d = new Date();
  d.setDate(d.getDate() - 1);

  for (let tries = 0; tries < 7; tries++) {
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day === 0) { d.setDate(d.getDate() - 1); continue; } // skip Sun
    if (day === 6) { d.setDate(d.getDate() - 1); continue; } // skip Sat

    const ymd = toYMD(d);
    const url = `${BASE}/v2/aggs/grouped/locale/us/market/stocks/${ymd}?adjusted=true&apiKey=${apiKey}`;

    const { data } = await withBackoff(
      () => axios.get(url, { timeout: REQ_TIMEOUT }),
      { tries: 6, baseMs: 800, maxMs: 20000 }
    );

    const rows: any[] = Array.isArray(data?.results) ? data.results : [];
    if (rows.length > 0) {
      for (const r of rows) {
        if (!r?.T || !Number.isFinite(r?.c)) continue;
        map.set(r.T, Number(r.c)); // T=ticker, c=close
      }
      if (map.size > 0) return map;
    }

    // No data (holiday?) → go back one more day
    d.setDate(d.getDate() - 1);
  }

  throw new Error("grouped prices: no data found for the last 7 calendar days");
}


// /v3/reference/tickers — US active stocks, paginated
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
    if (url) await sleep(PAGE_PAUSE);
  }
  return out;
}

// Fetch shares outstanding for many tickers via Financials endpoint
async function fetchSharesOutstandingForMany(symbols: string[], maxTickers: number) {
  // process with limited concurrency
  const out = new Map<string, { shares: number }>();
  let idx = 0;
  const total = Math.min(maxTickers, symbols.length);

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= total) break;
      const sym = symbols[i];
      try {
        const so = await fetchOneShares(sym);
        if (Number.isFinite(so) && so > 0) out.set(sym, { shares: so });
      } catch {
        // ignore this symbol; continue
      }
      if (FIN_DELAY_MS > 0) await sleep(FIN_DELAY_MS);
    }
  }

  const workers = Array.from({ length: FIN_CONC }, () => worker());
  await Promise.all(workers);
  return out;
}

// Fetch most recent shares outstanding for a single ticker
async function fetchOneShares(ticker: string): Promise<number> {
  // NOTE: Adjust this endpoint/field if your plan names differ.
  // Common Polygon path: /vX/reference/financials?ticker={T}&timeframe=quarterly&limit=1
  const url =
    `${BASE}/vX/reference/financials?` +
    `ticker=${encodeURIComponent(ticker)}` +
    `&timeframe=quarterly&limit=1&apiKey=${apiKey}`;

  const { data } = await withBackoff(
    () => axios.get(url, { timeout: REQ_TIMEOUT }),
    { tries: 6, baseMs: 800, maxMs: 20000 }
  );

  // Try multiple common fields for shares outstanding
  // Depending on Polygon plan/version, the field may be inside data.results[0].financials
  const rec: any = Array.isArray(data?.results) ? data.results[0] : null;
  const fin: any = rec?.financials || rec || {};

  const candidates = [
    fin?.income_statement?.weighted_average_shares_outstanding,
    fin?.income_statement?.weightedAverageShsOut,
    fin?.shares_outstanding,
    fin?.share_class_shares_outstanding,
  ].map(Number).filter((n: any) => Number.isFinite(n) && n > 0);

  if (candidates.length) return candidates[0];

  // Some plans expose a flat market cap or shares directly; keep this as a fallback
  const flatCandidates = [
    Number(rec?.shares_outstanding),
    Number(rec?.share_class_shares_outstanding),
  ].filter((n: any) => Number.isFinite(n) && n > 0);

  if (flatCandidates.length) return flatCandidates[0];

  throw new Error(`no shares data for ${ticker}`);
}
