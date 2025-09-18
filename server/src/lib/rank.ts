import fs from 'node:fs/promises';
import path from 'node:path';

export type Ranked = { rank: number; ticker: string; name: string; marketCap: number };

export function toTop500(rows: { ticker: string; name: string; marketCap?: number }[]): Ranked[] {
  return rows
    .filter(r => Number.isFinite(r.marketCap))
    .sort((a,b) => (b.marketCap! - a.marketCap!))
    .slice(0, 500)
    .map((r, i) => ({ rank: i+1, ticker: r.ticker, name: r.name, marketCap: r.marketCap! }));
}

export async function writeSnapshot(top500: Ranked[], when: Date) {
  const DATA_DIR = path.resolve(process.cwd(), 'data', 'snapshots');
  await fs.mkdir(DATA_DIR, { recursive: true });
  const fname = `${when.toISOString().slice(0,10)}.json`;
  await fs.writeFile(path.join(DATA_DIR, fname), JSON.stringify(top500, null, 2));
  console.log(`[close] wrote ${fname}`);
}
