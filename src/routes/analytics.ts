import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { resolveRange, pctChange } from "../lib/analytics/dateRange.js";
import {
  getOverview,
  getTrend,
  getPeakTimes,
  getTopPages,
  getSources,
  getGeo,
  getDevices,
  getRealtime,
  getHeatmap,
  getPagesList,
} from "../lib/analytics/queries.js";
import { loadAnalyticsSettings, saveAnalyticsSettings } from "../lib/analytics/settings.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const { start, end, prevStart, prevEnd } = resolveRange(req.query as Record<string, unknown>);
    const { current, previous } = await getOverview(start, end, prevStart, prevEnd);
    const changes = Object.fromEntries(
      (Object.keys(current) as (keyof typeof current)[]).map((k) => [k, pctChange(current[k], previous[k])]),
    );
    res.json({ current, previous, changes, range: { start, end } });
  }),
);

const TREND_METRICS = new Set(["visitors", "sessions", "pageViews", "newUsers", "returningUsers"]);

analyticsRouter.get(
  "/trend",
  asyncHandler(async (req, res) => {
    const metric = typeof req.query.metric === "string" && TREND_METRICS.has(req.query.metric) ? req.query.metric : "visitors";
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const series = await getTrend(metric, start, end);
    res.json({ metric, series });
  }),
);

analyticsRouter.get(
  "/peak-times",
  asyncHandler(async (req, res) => {
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const cells = await getPeakTimes(start, end);
    res.json({ cells });
  }),
);

analyticsRouter.get(
  "/top-pages",
  asyncHandler(async (req, res) => {
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const sort = typeof req.query.sort === "string" ? req.query.sort : "views";
    const pages = await getTopPages(start, end);
    const sorters: Record<string, (a: (typeof pages)[number], b: (typeof pages)[number]) => number> = {
      views: (a, b) => b.views - a.views,
      "views-asc": (a, b) => a.views - b.views,
      engagement: (a, b) => b.avgTimeSeconds - a.avgTimeSeconds,
      bounce: (a, b) => b.bounceRate - a.bounceRate,
    };
    pages.sort(sorters[sort] ?? sorters.views);
    res.json({ pages: pages.slice(0, 50) });
  }),
);

analyticsRouter.get(
  "/sources",
  asyncHandler(async (req, res) => {
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const sources = await getSources(start, end);
    res.json({ sources });
  }),
);

analyticsRouter.get(
  "/geo",
  asyncHandler(async (req, res) => {
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const countries = await getGeo(start, end);
    res.json({ countries });
  }),
);

analyticsRouter.get(
  "/devices",
  asyncHandler(async (req, res) => {
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const devices = await getDevices(start, end);
    res.json(devices);
  }),
);

analyticsRouter.get(
  "/realtime",
  asyncHandler(async (_req, res) => {
    const realtime = await getRealtime();
    res.json(realtime);
  }),
);

analyticsRouter.get(
  "/pages-list",
  asyncHandler(async (_req, res) => {
    const paths = await getPagesList();
    res.json({ paths });
  }),
);

analyticsRouter.get(
  "/heatmap",
  asyncHandler(async (req, res) => {
    const path = typeof req.query.path === "string" ? req.query.path : "/";
    const device = typeof req.query.device === "string" ? req.query.device : "all";
    const { start, end } = resolveRange(req.query as Record<string, unknown>);
    const heatmap = await getHeatmap(path, start, end, device);
    res.json(heatmap);
  }),
);

// SEO performance data (Google Search Console) — deferred: no OAuth wired up
// yet, so this always reports "not connected" rather than inventing numbers.
analyticsRouter.get(
  "/seo/status",
  asyncHandler(async (_req, res) => {
    const settings = await loadAnalyticsSettings();
    res.json({ connected: settings.searchConsole.connected, siteUrl: settings.searchConsole.siteUrl });
  }),
);

const settingsPatchSchema = z.object({
  trackingEnabled: z.boolean().optional(),
  heatmapEnabled: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(7).max(730).optional(),
  searchConsole: z.object({ siteUrl: z.string().optional() }).optional(),
});

analyticsRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const settings = await loadAnalyticsSettings();
    res.json({ settings });
  }),
);

analyticsRouter.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    const patch = settingsPatchSchema.parse(req.body ?? {});
    const settings = await saveAnalyticsSettings(patch);
    res.json({ settings });
  }),
);
