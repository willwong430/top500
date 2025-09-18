import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import cron from 'node-cron';
import { runClose } from './closeJob.js';

const app = express();
const DATA_DIR = path.resolve(process.cwd(), 'data', 'snapshots');

app.get('/api/top500.json', async (_req: Request, res: Response) => {
  try {
    const latest = await latestFile();
    res.sendFile(path.join(DATA_DIR, latest));
  } catch (e:any) {
    res.status(404).json({ error: e?.message || 'No snapshot yet' });
  }
});

app.get('/api/movers.json', async (_req: Request, res: Response) => {
  try {
    const out = await loadMovers();
    res.json(out);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'Failed to build movers' });
  }
});

app.get('/api/changes.json', async (_req: Request, res: Response) => {
  try {
    const out = await loadChanges();
    res.json(out);
  } catch (e:any) {
    res.status(500).json({ error: e?.message || 'Failed to build changes' });
  }
});

// Run once daily at ~4:05pm ET
const buf = Number(process.env.CLOSE_BUFFER_MIN || 5);
cron.schedule(`0 ${buf} 16 * * 1-5`, () => runClose(), { timezone: 'America/New_York' });

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`MVP server on :${PORT}`));

async function latestFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json')).sort();
  if (!files.length) throw new Error('No snapshots yet');
  return files[files.length - 1];
}

async function loadMovers() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json')).sort();
  if (files.length < 2) return [];
  const prev = JSON.parse(await fs.readFile(path.join(DATA_DIR, files[files.length - 2]), 'utf8'));
  const cur  = JSON.parse(await fs.readFile(path.join(DATA_DIR, files[files.length - 1]), 'utf8'));
  const mapPrev = new Map(prev.map((r: any) => [r.ticker, r.rank]));
  const deltas = cur.map((r: any) => ({ ticker: r.ticker, prevRank: mapPrev.get(r.ticker) ?? null, newRank: r.rank }))
    .filter((d:any) => d.prevRank !== null)
    .map((d:any) => ({ ...d, rankDelta: (d.prevRank as number) - (d.newRank as number) }))
    .sort((a:any,b:any) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta))
    .slice(0, 10);
  return deltas;
}

async function loadChanges() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json')).sort();
  if (files.length < 2) return { entered: [], exited: [] };
  const prev = JSON.parse(await fs.readFile(path.join(DATA_DIR, files[files.length - 2]), 'utf8'));
  const cur  = JSON.parse(await fs.readFile(path.join(DATA_DIR, files[files.length - 1]), 'utf8'));
  const prevSet = new Set(prev.map((r: any) => r.ticker));
  const curSet  = new Set(cur.map((r: any) => r.ticker));
  const entered = [...curSet].filter((t:any) => !prevSet.has(t));
  const exited  = [...prevSet].filter((t:any) => !curSet.has(t));
  return { entered, exited };
}
