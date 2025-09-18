import axios from 'axios';
const base = 'https://api.polygon.io';
const apiKey = process.env.POLYGON_API_KEY!;

type Row = { ticker: string; name: string; marketCap?: number };

export async function listUSFromPolygon(): Promise<Row[]> {
  if (!apiKey) throw new Error('POLYGON_API_KEY missing');
  let url = `${base}/v3/reference/tickers?active=true&type=CS&market=stocks&limit=1000&apiKey=${apiKey}`;
  const out: Row[] = [];
  for (let page = 0; page < 5 && url; page++) {
    const { data } = await axios.get(url);
    for (const r of (data.results || [])) {
      out.push({ ticker: r.ticker, name: r.name, marketCap: r.market_cap });
    }
    url = data.next_url ? `${data.next_url}&apiKey=${apiKey}` : '';
  }
  return out.filter(r => r.marketCap && r.marketCap > 0);
}
