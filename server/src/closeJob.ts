import 'dotenv/config';
import { fetchUniversePolygon, fetchUniverseFinnhub } from './vendors/picker.js';
import { toTop500, writeSnapshot } from './lib/rank.js';

export async function runClose() {
  const vendor = (process.env.VENDOR || 'polygon').toLowerCase();
  const today = new Date();
  console.log(`[close] building snapshot for ${today.toISOString().slice(0,10)} via ${vendor}`);

  try {
    const universe = vendor === 'polygon'
      ? await fetchUniversePolygon()
      : await fetchUniverseFinnhub();

    console.log(`[close] universe fetched: ${universe.length}`);
    const top500 = toTop500(universe);
    console.log(`[close] computed top500: ${top500.length}`);

    if (top500.length < 500) throw new Error(`too few rows (${top500.length})`);
    await writeSnapshot(top500, today);
    console.log(`[close] wrote ${today.toISOString().slice(0,10)}.json`);
  } catch (e: any) {
    const status = e?.response?.status;
    const body = e?.response?.data ? JSON.stringify(e.response.data) : e?.message || String(e);
    console.error(`[close] failed${status ? ' ('+status+')' : ''}: ${body}`);
    process.exit(1);
  }
}

// Run when invoked directly: `node dist/src/closeJob.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  runClose();
}
