// server/src/vendors/polygon.ts
import axios from 'axios';
import { withBackoff, sleep } from '../lib/retry.js';

const base = 'https://api.polygon.io';
const apiKey = process.env.POLYGON_API_KEY!;

// Tune via env if needed
const PAGE_LIMIT = Number(process.env.POLYGON_PAGE_LIMIT || 200);   // items per page
const MAX_PAGES  = Number(process.env.POLYGON_MAX_PAGES  || 20);    // cap pages
const PAGE_PAUSE = Number(process.env.POLYGON_PAGE_PAUSE || 200);   // ms between pages

type Row = { ticker: string; name: string; marketCap?: number };

export async function listUSFromPolygon(): Promise<Row[]> {
  if (!apiKey) throw new Error('POLYGON_API_KEY missing');

  let url =
    `${base}/v3/reference/tickers` +
    `?active=true&type=CS&market=stocks&locale=us` +
    `&limit=${PAGE_LIMIT}` +
    `&apiKey=${apiKey}`;

  const out: Row[] = [];
  let page = 0;

  while (url && page < MAX_PAGES) {
    page++;
    const { data } = await withBackoff(() => axios.get(url), {
      tries: 6, baseMs: 800, maxMs: 20_000
    });

    const batch = (data?.results || [])
      .filter((r: any) => r?.active && r?.type === 'CS' && (r?.locale || 'us') === 'us')
      .map((r: any) => ({
        ticker: r.ticker,
        name: r.name,
        marketCap: r.market_cap
      }));

    out.push(...batch);

    // Append apiKey to next_url (Polygon omits it)
    url = data?.next_url ? `${data.next_url}&apiKey=${apiKey}` : '';

    // Gentle pause between pages to avoid 429s
    if (url) await sleep(PAGE_PAUSE);
  }

  // Keep only rows with a market cap, then sort locally
  const cleaned = out.filter(r => Number.isFinite(r.marketCap) && (r.marketCap as number) > 0);
  cleaned.sort((a, b) => (b.marketCap! - a.marketCap!));
  return cleaned;
}

