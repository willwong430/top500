import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchUniversePolygon, fetchUniverseFinnhub } from './vendors/picker.js';
import { toTop500, writeSnapshot } from './lib/rank.js';

export async function runClose() {
  const vendor = (process.env.VENDOR || 'polygon').toLowerCase();
  const today = new Date();
  console.log(`[close] building snapshot for ${today.toISOString().slice(0,10)} via ${vendor}`);
  const universe = vendor === 'polygon' ? await fetchUniversePolygon() : await fetchUniverseFinnhub();
  const top500 = toTop500(universe);
  await writeSnapshot(top500, today);
}
