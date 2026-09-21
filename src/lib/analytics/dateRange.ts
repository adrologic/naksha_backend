export type ResolvedRange = { start: Date; end: Date; prevStart: Date; prevEnd: Date };

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Resolves the admin dashboard's date-filter presets into a concrete
 * [start, end) window plus the immediately-preceding window of equal length,
 * used for the "vs previous period" comparison on every KPI card.
 */
export function resolveRange(query: Record<string, unknown>): ResolvedRange {
  const range = typeof query.range === "string" ? query.range : "7d";
  const now = new Date();
  let start: Date;
  let end: Date = now;

  if (range === "custom" && typeof query.from === "string" && typeof query.to === "string") {
    const from = new Date(query.from);
    const to = new Date(query.to);
    start = Number.isNaN(from.getTime()) ? new Date(now.getTime() - 7 * DAY_MS) : from;
    end = Number.isNaN(to.getTime()) ? now : to;
  } else {
    switch (range) {
      case "today":
        start = startOfDay(now);
        break;
      case "yesterday": {
        const y = new Date(now.getTime() - DAY_MS);
        start = startOfDay(y);
        end = startOfDay(now);
        break;
      }
      case "30d":
        start = new Date(now.getTime() - 30 * DAY_MS);
        break;
      case "90d":
        start = new Date(now.getTime() - 90 * DAY_MS);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "7d":
      default:
        start = new Date(now.getTime() - 7 * DAY_MS);
        break;
    }
  }

  const durationMs = Math.max(end.getTime() - start.getTime(), DAY_MS);
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
