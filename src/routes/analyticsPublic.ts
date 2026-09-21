import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { clientIp, lookupCountry } from "../lib/analytics/geo.js";
import { classifyUserAgent } from "../lib/analytics/ua.js";
import { classifyTrafficSource } from "../lib/analytics/trafficSource.js";
import { loadAnalyticsSettings } from "../lib/analytics/settings.js";
import { isRateLimited } from "../lib/analytics/rateLimit.js";

export const analyticsPublicRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /analytics/settings/public — the site reads this to decide whether to
// load the tracker at all. Never exposes anything beyond these two flags.
// ─────────────────────────────────────────────────────────────────────────────

analyticsPublicRouter.get(
  "/settings/public",
  asyncHandler(async (_req, res) => {
    const settings = await loadAnalyticsSettings();
    res.json({ trackingEnabled: settings.trackingEnabled, heatmapEnabled: settings.heatmapEnabled });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /analytics/collect — public, unauthenticated ingestion. Validates and
// caps everything: batch size, string lengths, opaque-token shape. No PII is
// ever written — the request IP is used only to derive a country and then
// discarded, and the User-Agent is reduced to coarse device/browser/OS
// categories before anything touches the database.
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYPES_BUSINESS = [
  "session_start",
  "page_view",
  "click",
  "button_click",
  "link_click",
  "form_start",
  "form_submit",
  "search",
  "conversion",
] as const;

const EVENT_TYPES_HEATMAP = ["click", "rage_click", "dead_click", "scroll"] as const;

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);

const eventSchema = z.object({
  kind: z.enum(["event", "heatmap"]),
  type: z.string().min(1).max(40),
  path: z.string().min(1).max(500),
  ts: z.number().finite(),
  title: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  targetSelector: z.string().max(300).optional(),
  targetText: z.string().max(200).optional(),
  xPct: z.number().min(0).max(100).optional(),
  yPct: z.number().min(0).max(100).optional(),
  scrollDepth: z.number().min(0).max(100).optional(),
  meta: z.record(z.unknown()).optional(),
});

const collectSchema = z.object({
  visitorId: tokenSchema,
  sessionId: tokenSchema,
  events: z.array(eventSchema).min(1).max(25),
});

function safeHost(url: string | undefined | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function safeDate(ts: number): Date {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

analyticsPublicRouter.post(
  "/collect",
  asyncHandler(async (req, res) => {
    const ip = clientIp(req);
    if (isRateLimited(ip ?? "unknown")) {
      return res.status(429).json({ error: "rate_limited" });
    }

    const settings = await loadAnalyticsSettings();
    if (!settings.trackingEnabled) {
      return res.status(202).json({ ok: true, skipped: "tracking_disabled" });
    }

    const { visitorId, sessionId, events } = collectSchema.parse(req.body);

    const { country, region } = lookupCountry(ip);
    const { deviceType, browser, os } = classifyUserAgent(req.get("user-agent") ?? undefined);
    const siteHost = safeHost(req.get("origin") ?? req.get("referer"));

    const validEvents = events.filter((e) =>
      e.kind === "event"
        ? (EVENT_TYPES_BUSINESS as readonly string[]).includes(e.type)
        : (EVENT_TYPES_HEATMAP as readonly string[]).includes(e.type),
    );
    if (validEvents.length === 0) {
      return res.status(202).json({ ok: true, skipped: "no_valid_events" });
    }

    const pageViews = validEvents.filter((e) => e.kind === "event" && e.type === "page_view");
    const meaningfulEvents = validEvents.filter(
      (e) => e.kind === "event" && ["button_click", "link_click", "form_start", "form_submit", "search", "conversion"].includes(e.type),
    );
    const deepScroll = validEvents.some((e) => e.kind === "heatmap" && e.type === "scroll" && (e.scrollDepth ?? 0) >= 50);
    const firstPath = validEvents[0]?.path ?? "/";
    const lastPath = validEvents[validEvents.length - 1]?.path ?? firstPath;

    await prisma.analyticsVisitor.upsert({
      where: { visitorId },
      update: { lastSeenAt: new Date() },
      create: { visitorId },
    });

    const existingSession = await prisma.analyticsSession.findUnique({ where: { sessionId } });

    if (!existingSession) {
      const first = validEvents[0];
      const trafficSource = classifyTrafficSource({
        referrer: first?.referrer,
        utmSource: first?.utmSource,
        utmMedium: first?.utmMedium,
        siteHost,
      });
      await prisma.analyticsSession.create({
        data: {
          sessionId,
          visitorId,
          entryPath: firstPath,
          exitPath: lastPath,
          referrer: first?.referrer,
          utmSource: first?.utmSource,
          utmMedium: first?.utmMedium,
          utmCampaign: first?.utmCampaign,
          trafficSource,
          deviceType,
          browser,
          os,
          country,
          region,
          pageViewCount: pageViews.length,
          isBounce: pageViews.length <= 1 && meaningfulEvents.length === 0 && !deepScroll,
        },
      });
      await prisma.analyticsVisitor.update({ where: { visitorId }, data: { sessionsCount: { increment: 1 } } });
    } else {
      const stillBounce = existingSession.isBounce && pageViews.length === 0 && meaningfulEvents.length === 0 && !deepScroll;
      await prisma.analyticsSession.update({
        where: { sessionId },
        data: {
          lastSeenAt: new Date(),
          exitPath: lastPath,
          pageViewCount: { increment: pageViews.length },
          durationSeconds: Math.max(existingSession.durationSeconds, Math.floor((Date.now() - existingSession.startedAt.getTime()) / 1000)),
          isBounce: stillBounce,
        },
      });
    }

    if (pageViews.length) {
      await prisma.pageView.createMany({
        data: pageViews.map((e) => ({
          sessionId,
          path: e.path,
          title: e.title ?? null,
          enteredAt: safeDate(e.ts),
        })),
      });
    }

    const analyticsEvents = validEvents.filter((e) => e.kind === "event" && e.type !== "page_view" && e.type !== "session_start");
    if (analyticsEvents.length) {
      await prisma.analyticsEvent.createMany({
        data: analyticsEvents.map((e) => ({
          sessionId,
          path: e.path,
          type: e.type,
          targetSelector: e.targetSelector ?? null,
          targetText: e.targetText ?? null,
          meta: (e.meta ?? {}) as Prisma.InputJsonValue,
          createdAt: safeDate(e.ts),
        })),
      });
    }

    if (settings.heatmapEnabled) {
      const heatmapEvents = validEvents.filter((e) => e.kind === "heatmap");
      if (heatmapEvents.length) {
        await prisma.heatmapEvent.createMany({
          data: heatmapEvents.map((e) => ({
            sessionId,
            path: e.path,
            type: e.type,
            xPct: e.type === "scroll" ? 0 : (e.xPct ?? 0),
            yPct: e.type === "scroll" ? (e.scrollDepth ?? 0) : (e.yPct ?? 0),
            deviceType,
            createdAt: safeDate(e.ts),
          })),
        });
      }
    }

    res.status(202).json({ ok: true });
  }),
);
