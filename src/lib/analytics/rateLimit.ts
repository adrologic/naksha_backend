/**
 * Minimal in-memory sliding-window rate limiter for the public analytics
 * ingestion endpoint. No new dependency (no Redis/express-rate-limit) —
 * this process is the only instance, and the limit only needs to stop
 * obvious abuse, not be perfectly accurate across restarts/replicas.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

const hits = new Map<string, number[]>();

// Periodically drop stale keys so this map can't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, timestamps] of hits) {
    const kept = timestamps.filter((t) => t > cutoff);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}, WINDOW_MS).unref();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > MAX_REQUESTS_PER_WINDOW;
}
