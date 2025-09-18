import axios from 'axios';
const base = 'https://finnhub.io/api/v1';
const token = process.env.FINNHUB_TOKEN!;

type Row = { ticker: string; name: string; marketCap?: number };

export async function listUSFromFinnhub(): Promise<Row[]> {
  if (!token) throw new Error('FINNHUB_TOKEN missing');
  const us = ['US'];
  const all: Row[] = [];
  for (const exch of us) {
    const { data } = await axios.get(`${base}/stock/symbol`, { params: { exchange: exch, token } });
    const symbols = (data || []).slice(0, 2000);
    for (const s of symbols) {
      try {
        const prof = await axios.get(`${base}/stock/profile2`, { params: { symbol: s.symbol, token } });
        const cap = prof.data?.marketCapitalization ? Number(prof.data.marketCapitalization) * 1e6 : undefined;
        all.push({ ticker: s.symbol, name: s.description, marketCap: cap });
      } catch {}
    }
  }
  return all.filter(r => r.marketCap && r.marketCap! > 0);
}
