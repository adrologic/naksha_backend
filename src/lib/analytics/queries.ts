import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export type OverviewMetrics = {
  visitors: number;
  sessions: number;
  pageViews: number;
  newUsers: number;
  returningUsers: number;
  avgSessionDuration: number;
  bounceRate: number;
  organicTraffic: number;
};

async function overviewForWindow(start: Date, end: Date): Promise<OverviewMetrics> {
  const [sessionAgg, pageViewCount, newUsers, returningUsersRow, organicRow] = await Promise.all([
    prisma.$queryRaw<{ visitors: bigint; sessions: bigint; avg_duration: number | null; bounce_rate: number | null }[]>`
      SELECT
        COUNT(DISTINCT "visitorId") AS visitors,
        COUNT(*) AS sessions,
        AVG("durationSeconds") AS avg_duration,
        (COUNT(*) FILTER (WHERE "isBounce") * 100.0 / NULLIF(COUNT(*), 0)) AS bounce_rate
      FROM "AnalyticsSession"
      WHERE "startedAt" >= ${start} AND "startedAt" < ${end}
    `,
    prisma.pageView.count({ where: { enteredAt: { gte: start, lt: end } } }),
    prisma.analyticsVisitor.count({ where: { firstSeenAt: { gte: start, lt: end } } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT s."visitorId") AS count
      FROM "AnalyticsSession" s
      JOIN "AnalyticsVisitor" v ON v."visitorId" = s."visitorId"
      WHERE s."startedAt" >= ${start} AND s."startedAt" < ${end} AND v."firstSeenAt" < ${start}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT "visitorId") AS count
      FROM "AnalyticsSession"
      WHERE "startedAt" >= ${start} AND "startedAt" < ${end} AND "trafficSource" = 'organic'
    `,
  ]);

  const row = sessionAgg[0];
  return {
    visitors: Number(row?.visitors ?? 0),
    sessions: Number(row?.sessions ?? 0),
    pageViews: pageViewCount,
    newUsers,
    returningUsers: Number(returningUsersRow[0]?.count ?? 0),
    avgSessionDuration: Math.round(row?.avg_duration ?? 0),
    bounceRate: Math.round((row?.bounce_rate ?? 0) * 10) / 10,
    organicTraffic: Number(organicRow[0]?.count ?? 0),
  };
}

export async function getOverview(start: Date, end: Date, prevStart: Date, prevEnd: Date) {
  const [current, previous] = await Promise.all([overviewForWindow(start, end), overviewForWindow(prevStart, prevEnd)]);
  return { current, previous };
}

const METRIC_COLUMN = {
  visitors: Prisma.sql`COUNT(DISTINCT "visitorId")`,
  sessions: Prisma.sql`COUNT(*)`,
} as const;

export async function getTrend(metric: string, start: Date, end: Date) {
  if (metric === "pageViews") {
    const rows = await prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "enteredAt") AS day, COUNT(*) AS value
      FROM "PageView"
      WHERE "enteredAt" >= ${start} AND "enteredAt" < ${end}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), value: Number(r.value) }));
  }
  if (metric === "newUsers") {
    const rows = await prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "firstSeenAt") AS day, COUNT(*) AS value
      FROM "AnalyticsVisitor"
      WHERE "firstSeenAt" >= ${start} AND "firstSeenAt" < ${end}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), value: Number(r.value) }));
  }
  if (metric === "returningUsers") {
    const rows = await prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', s."startedAt") AS day, COUNT(DISTINCT s."visitorId") AS value
      FROM "AnalyticsSession" s
      JOIN "AnalyticsVisitor" v ON v."visitorId" = s."visitorId"
      WHERE s."startedAt" >= ${start} AND s."startedAt" < ${end} AND v."firstSeenAt" < date_trunc('day', s."startedAt")
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), value: Number(r.value) }));
  }

  // visitors | sessions
  const column = METRIC_COLUMN[metric === "visitors" ? "visitors" : "sessions"];
  const rows = await prisma.$queryRaw<{ day: Date; value: bigint }[]>`
    SELECT date_trunc('day', "startedAt") AS day, ${column} AS value
    FROM "AnalyticsSession"
    WHERE "startedAt" >= ${start} AND "startedAt" < ${end}
    GROUP BY 1 ORDER BY 1
  `;
  return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), value: Number(r.value) }));
}

export async function getPeakTimes(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ dow: number; hour: number; count: bigint }[]>`
    SELECT EXTRACT(DOW FROM "startedAt")::int AS dow, EXTRACT(HOUR FROM "startedAt")::int AS hour, COUNT(*) AS count
    FROM "AnalyticsSession"
    WHERE "startedAt" >= ${start} AND "startedAt" < ${end}
    GROUP BY 1, 2
  `;
  return rows.map((r) => ({ dayOfWeek: r.dow, hour: r.hour, count: Number(r.count) }));
}

export async function getTopPages(start: Date, end: Date) {
  const [pageStats, bounceStats] = await Promise.all([
    prisma.$queryRaw<{ path: string; views: bigint; unique_visitors: bigint; avg_time: number | null }[]>`
      SELECT pv.path,
        COUNT(*) AS views,
        COUNT(DISTINCT pv."sessionId") AS unique_visitors,
        AVG(pv."durationSeconds") AS avg_time
      FROM "PageView" pv
      WHERE pv."enteredAt" >= ${start} AND pv."enteredAt" < ${end}
      GROUP BY pv.path
      ORDER BY views DESC
      LIMIT 100
    `,
    prisma.$queryRaw<{ path: string; bounce_rate: number | null }[]>`
      SELECT "entryPath" AS path, (COUNT(*) FILTER (WHERE "isBounce") * 100.0 / NULLIF(COUNT(*), 0)) AS bounce_rate
      FROM "AnalyticsSession"
      WHERE "startedAt" >= ${start} AND "startedAt" < ${end}
      GROUP BY "entryPath"
    `,
  ]);
  const bounceByPath = new Map(bounceStats.map((b) => [b.path, Math.round((b.bounce_rate ?? 0) * 10) / 10]));
  return pageStats.map((p) => ({
    path: p.path,
    views: Number(p.views),
    uniqueVisitors: Number(p.unique_visitors),
    avgTimeSeconds: Math.round(p.avg_time ?? 0),
    bounceRate: bounceByPath.get(p.path) ?? 0,
  }));
}

export async function getSources(start: Date, end: Date) {
  const rows = await prisma.analyticsSession.groupBy({
    by: ["trafficSource"],
    where: { startedAt: { gte: start, lt: end } },
    _count: { _all: true },
  });
  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  return rows
    .map((r) => ({
      source: r.trafficSource,
      sessions: r._count._all,
      percentage: total ? Math.round((r._count._all / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export async function getGeo(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<{ country: string | null; region: string | null; visitors: bigint }[]>`
    SELECT country, region, COUNT(DISTINCT "visitorId") AS visitors
    FROM "AnalyticsSession"
    WHERE "startedAt" >= ${start} AND "startedAt" < ${end} AND country IS NOT NULL
    GROUP BY country, region
    ORDER BY visitors DESC
    LIMIT 100
  `;
  return rows.map((r) => ({ country: r.country, region: r.region, visitors: Number(r.visitors) }));
}

export async function getDevices(start: Date, end: Date) {
  const [deviceType, browser, os] = await Promise.all([
    prisma.analyticsSession.groupBy({
      by: ["deviceType"],
      where: { startedAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.analyticsSession.groupBy({
      by: ["browser"],
      where: { startedAt: { gte: start, lt: end }, browser: { not: null } },
      _count: { _all: true },
    }),
    prisma.analyticsSession.groupBy({
      by: ["os"],
      where: { startedAt: { gte: start, lt: end }, os: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const bySessions = (a: { sessions: number }, b: { sessions: number }) => b.sessions - a.sessions;
  return {
    deviceType: deviceType
      .map((r) => ({ label: r.deviceType, sessions: r._count._all }))
      .sort(bySessions),
    browser: browser
      .map((r) => ({ label: r.browser ?? "Unknown", sessions: r._count._all }))
      .sort(bySessions),
    os: os.map((r) => ({ label: r.os ?? "Unknown", sessions: r._count._all })).sort(bySessions),
  };
}

export async function getRealtime() {
  const cutoff = new Date(Date.now() - 5 * 60_000);
  const sessions = await prisma.analyticsSession.findMany({
    where: { lastSeenAt: { gte: cutoff } },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    select: { sessionId: true, exitPath: true, entryPath: true, deviceType: true, country: true },
  });
  return {
    count: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.sessionId.slice(0, 8),
      currentPage: s.exitPath ?? s.entryPath,
      deviceType: s.deviceType,
      country: s.country,
    })),
  };
}

export async function getPagesList() {
  const rows = await prisma.pageView.findMany({
    distinct: ["path"],
    select: { path: true },
    orderBy: { path: "asc" },
    take: 300,
  });
  return rows.map((r) => r.path);
}

export async function getHeatmap(path: string, start: Date, end: Date, device: string) {
  const deviceFilter = device === "all" ? Prisma.sql`` : Prisma.sql`AND "deviceType" = ${device}`;

  const [clickCells, topElements, scrollDepths] = await Promise.all([
    prisma.$queryRaw<{ x_bucket: number; y_bucket: number; count: bigint; type: string }[]>`
      SELECT FLOOR("xPct" / 5) * 5 AS x_bucket, FLOOR("yPct" / 5) * 5 AS y_bucket, type, COUNT(*) AS count
      FROM "HeatmapEvent"
      WHERE path = ${path} AND type IN ('click', 'rage_click', 'dead_click')
        AND "createdAt" >= ${start} AND "createdAt" < ${end} ${deviceFilter}
      GROUP BY 1, 2, type
    `,
    prisma.$queryRaw<{ target_selector: string | null; target_text: string | null; type: string; count: bigint }[]>`
      SELECT "targetSelector" AS target_selector, "targetText" AS target_text, type, COUNT(*) AS count
      FROM "AnalyticsEvent"
      WHERE path = ${path} AND type IN ('click', 'button_click', 'link_click')
        AND "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY 1, 2, 3
      ORDER BY count DESC
      LIMIT 20
    `,
    prisma.$queryRaw<{ bucket: number; sessions: bigint }[]>`
      SELECT FLOOR(max_depth."yPct" / 10) * 10 AS bucket, COUNT(*) AS sessions
      FROM (
        SELECT "sessionId", MAX("yPct") AS "yPct"
        FROM "HeatmapEvent"
        WHERE path = ${path} AND type = 'scroll' AND "createdAt" >= ${start} AND "createdAt" < ${end} ${deviceFilter}
        GROUP BY "sessionId"
      ) AS max_depth
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  return {
    cells: clickCells.map((c) => ({ x: c.x_bucket, y: c.y_bucket, type: c.type, count: Number(c.count) })),
    topElements: topElements.map((t) => ({
      selector: t.target_selector,
      text: t.target_text,
      type: t.type,
      count: Number(t.count),
    })),
    scrollDepth: scrollDepths.map((s) => ({ depth: s.bucket, sessions: Number(s.sessions) })),
  };
}
