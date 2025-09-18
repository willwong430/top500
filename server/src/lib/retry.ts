// server/src/lib/retry.ts
export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  {
    tries = 6,           // total attempts
    baseMs = 800,        // base backoff
    maxMs = 20_000,      // cap
    jitter = true
  } = {}
): Promise<T> {
  let attempt = 0;
  let lastErr: any;
  while (attempt < tries) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      // Retry only on 429 and 5xx (transient)
      if (status !== 429 && !(status >= 500 && status < 600)) break;

      // Respect Retry-After if present
      const ra = Number(e?.response?.headers?.['retry-after']);
      let wait = !Number.isNaN(ra) && ra > 0 ? ra * 1000
               : Math.min(maxMs, baseMs * Math.pow(2, attempt));
      if (jitter) wait = Math.round(wait * (0.75 + Math.random() * 0.5));

      await sleep(wait);
      attempt++;
    }
  }
  throw lastErr;
}

