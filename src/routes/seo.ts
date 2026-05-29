import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { secondaryKeywordsField, sanitizeSecondaryKeywords } from "../lib/seoFields.js";
import { mirrorSeoPageToPage } from "../lib/seoPageMirror.js";

export const seoRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Shapes
// ─────────────────────────────────────────────────────────────────────────────

// Zod for the per-collection embedded SEO update body.
const collectionSeoSchema = z.object({
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  seoKeywords: z.array(z.string()).optional(),
  seoPrimaryKeyword: z.string().nullable().optional(),
  seoSecondaryKeywords: secondaryKeywordsField.optional(),
  seoOgTitle: z.string().nullable().optional(),
  seoOgDescription: z.string().nullable().optional(),
  seoCanonicalUrl: z.string().nullable().optional(),
  seoNoIndex: z.boolean().optional(),
  seoNoFollow: z.boolean().optional(),
});

// Zod for SeoPage create / update.
const seoPageCreate = z.object({
  path: z.string().min(1).regex(/^\//, "must start with /"),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  // Legacy single keyword list — kept for one release.
  keywords: z.array(z.string()).default([]),
  primaryKeyword: z.string().nullable().optional(),
  secondaryKeywords: secondaryKeywordsField,
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  noIndex: z.boolean().default(false),
  noFollow: z.boolean().default(false),
});
const seoPageUpdate = seoPageCreate.partial();

// Zod for the full seoSettings global. All fields optional so admin can save partial.
const addressShape = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});
const socialLinksShape = z.object({
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  youtube: z.string().optional(),
  whatsapp: z.string().optional(),
});
const contactInfoShape = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  address: addressShape.optional(),
});
const organizationSchemaShape = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  logo: z.string().optional(),
  description: z.string().optional(),
});
const localBusinessShape = z.object({
  telephone: z.string().optional(),
  email: z.string().optional(),
  priceRange: z.string().optional(),
  openingHours: z.array(z.string()).optional(),
  address: addressShape.optional(),
  geo: z
    .object({ latitude: z.number().optional(), longitude: z.number().optional() })
    .optional(),
});
const faqItemShape = z.object({
  question: z.string(),
  answer: z.string(),
});

const seoSettingsSchema = z.object({
  siteName: z.string().optional(),
  siteUrl: z.string().optional(),
  defaultTitle: z.string().optional(),
  titleTemplate: z.string().optional(),
  defaultDescription: z.string().optional(),
  defaultKeywords: z.array(z.string()).optional(),
  defaultPrimaryKeyword: z.string().optional(),
  defaultSecondaryKeywords: z.array(z.string()).optional(),
  defaultOgImage: z.string().optional(),
  favicon: z.string().optional(),
  appleTouchIcon: z.string().optional(),
  socialLinks: socialLinksShape.optional(),
  contactInfo: contactInfoShape.optional(),
  organizationSchema: organizationSchemaShape.optional(),
  localBusiness: localBusinessShape.optional(),
  faqItems: z.array(faqItemShape).optional(),
  googleSiteVerification: z.string().optional(),
  googleAnalyticsId: z.string().optional(),
  googleTagManagerId: z.string().optional(),
  facebookPixelId: z.string().optional(),
  customHeadScripts: z.string().optional(),
  robotsTxt: z.string().optional(),
});

const SETTINGS_KEY = "seoSettings";

// Hardcoded defaults — ensure GET /api/seo/global always returns a usable shape
// even before the admin has saved anything.
const DEFAULT_SETTINGS = {
  siteName: "Naksha Construction",
  siteUrl: "https://naksha-construction-website.vercel.app",
  defaultTitle: "Naksha Construction — Building Construction Company in Jaipur",
  titleTemplate: "%s | Naksha Construction",
  defaultDescription:
    "Naksha Construction is a Jaipur-based design-build contractor delivering residential, commercial, industrial and infrastructure projects across Rajasthan and India. Construction management, turnkey delivery, interior fit-out and renovation services.",
  defaultKeywords: [
    "building construction company Jaipur",
    "construction services Jaipur",
    "design-build contractor Rajasthan",
    "commercial construction Jaipur",
    "residential construction Jaipur",
    "turnkey construction Jaipur",
    "interior fit-out Jaipur",
    "renovation contractor Jaipur",
    "industrial construction India",
    "construction management Rajasthan",
  ],
  defaultPrimaryKeyword: "building construction company Jaipur",
  defaultSecondaryKeywords: [
    "construction services Jaipur",
    "design-build contractor Rajasthan",
    "commercial construction Jaipur",
    "turnkey construction Jaipur",
  ],
  defaultOgImage: "",
  favicon: "",
  appleTouchIcon: "",
  socialLinks: {},
  contactInfo: {
    phone: "",
    email: "",
    address: {
      street: "Plot 12, Civil Lines",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "302006",
      country: "IN",
    },
  },
  organizationSchema: {
    type: "GeneralContractor",
    name: "Naksha Construction",
    logo: "",
    description:
      "Naksha Construction is a building construction, design-build and construction management firm headquartered in Jaipur, India.",
  },
  localBusiness: {
    telephone: "",
    email: "",
    priceRange: "$$$",
    openingHours: ["Mo-Sa 09:00-18:00"],
    address: {
      street: "Plot 12, Civil Lines",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "302006",
      country: "IN",
    },
    geo: { latitude: 26.9124, longitude: 75.7873 },
  },
  faqItems: [],
  googleSiteVerification: "",
  googleAnalyticsId: "",
  googleTagManagerId: "",
  facebookPixelId: "",
  customHeadScripts: "",
  robotsTxt: "",
};

// Deep-merge utility. Right side wins for primitive/array fields; nested objects recurse.
function deepMerge<T extends Record<string, unknown>>(base: T, override: unknown): T {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const existing = out[k];
    if (
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = deepMerge(existing as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

async function loadSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const row = await prisma.global.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_SETTINGS;
  return deepMerge(DEFAULT_SETTINGS, row.value as unknown);
}

async function saveSettings(value: Record<string, unknown>) {
  return prisma.global.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: value as Prisma.InputJsonValue },
    create: { key: SETTINGS_KEY, value: value as Prisma.InputJsonValue },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/seo/global   — site-wide SEO settings (single Global row)
// ─────────────────────────────────────────────────────────────────────────────

seoRouter.get(
  "/global",
  asyncHandler(async (_req, res) => {
    const settings = await loadSettings();
    res.json({ settings });
  }),
);

seoRouter.patch(
  "/global",
  asyncHandler(async (req, res) => {
    const patch = seoSettingsSchema.parse(req.body ?? {});
    const current = await loadSettings();
    const merged = deepMerge(current, patch);
    await saveSettings(merged);
    res.json({ settings: merged });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// /api/seo/pages    — path-keyed SEO overrides
// ─────────────────────────────────────────────────────────────────────────────

seoRouter.get(
  "/pages",
  asyncHandler(async (_req, res) => {
    const pages = await prisma.seoPage.findMany({ orderBy: { path: "asc" } });
    res.json({ pages });
  }),
);

seoRouter.get(
  "/pages/:path(*)",
  asyncHandler(async (req, res) => {
    const decoded = decodeURIComponent(req.params.path ?? "");
    const path = decoded.startsWith("/") ? decoded : `/${decoded}`;
    const page = await prisma.seoPage.findUnique({ where: { path } });
    res.json({ page: page ?? null });
  }),
);

seoRouter.post(
  "/pages",
  asyncHandler(async (req, res) => {
    const data = seoPageCreate.parse(req.body);
    const created = await prisma.seoPage.create({
      data: {
        ...data,
        keywords: data.keywords as Prisma.InputJsonValue,
        secondaryKeywords: data.secondaryKeywords as Prisma.InputJsonValue,
      },
    });
    await mirrorSeoPageToPage(created.path, data).catch(() => undefined);
    res.status(201).json({ page: created });
  }),
);

seoRouter.patch(
  "/pages/:id",
  asyncHandler(async (req, res) => {
    const data = seoPageUpdate.parse(req.body);
    const { keywords, secondaryKeywords, ...rest } = data;
    const page = await prisma.seoPage.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(keywords !== undefined ? { keywords: keywords as Prisma.InputJsonValue } : {}),
        ...(secondaryKeywords !== undefined
          ? { secondaryKeywords: secondaryKeywords as Prisma.InputJsonValue }
          : {}),
      },
    });
    await mirrorSeoPageToPage(page.path, data).catch(() => undefined);
    res.json({ page });
  }),
);

seoRouter.delete(
  "/pages/:id",
  asyncHandler(async (req, res) => {
    await prisma.seoPage.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

// PUT /pages/by-path/:path → upsert by path. Used by surfaces that already
// know the URL (e.g. the Pages-collection edit form, which knows page.path)
// so they can sync their SEO fields with the SEO admin's path-keyed row
// without first looking up the SeoPage id.
seoRouter.put(
  "/pages/by-path/:path(*)",
  asyncHandler(async (req, res) => {
    const decoded = decodeURIComponent(req.params.path ?? "");
    const path = decoded.startsWith("/") ? decoded : `/${decoded}`;
    const data = seoPageUpdate.parse(req.body ?? {});
    const { keywords, secondaryKeywords, ...rest } = data;
    // For upsert, drop the path from `rest` if present (we use the URL param).
    delete (rest as Record<string, unknown>).path;
    const page = await prisma.seoPage.upsert({
      where: { path },
      update: {
        ...rest,
        ...(keywords !== undefined ? { keywords: keywords as Prisma.InputJsonValue } : {}),
        ...(secondaryKeywords !== undefined
          ? { secondaryKeywords: secondaryKeywords as Prisma.InputJsonValue }
          : {}),
      },
      create: {
        path,
        title: rest.title ?? null,
        description: rest.description ?? null,
        primaryKeyword: rest.primaryKeyword ?? null,
        ogTitle: rest.ogTitle ?? null,
        ogDescription: rest.ogDescription ?? null,
        ogImage: rest.ogImage ?? null,
        canonicalUrl: rest.canonicalUrl ?? null,
        noIndex: rest.noIndex ?? false,
        noFollow: rest.noFollow ?? false,
        keywords: (keywords ?? []) as Prisma.InputJsonValue,
        secondaryKeywords: (secondaryKeywords ?? []) as Prisma.InputJsonValue,
      },
    });
    await mirrorSeoPageToPage(page.path, data).catch(() => undefined);
    res.json({ page });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// /api/seo/schemas  — LocalBusiness + FAQ slice of seoSettings
// ─────────────────────────────────────────────────────────────────────────────

seoRouter.get(
  "/schemas",
  asyncHandler(async (_req, res) => {
    const settings = await loadSettings();
    res.json({
      localBusiness: settings.localBusiness ?? {},
      faqItems: settings.faqItems ?? [],
    });
  }),
);

seoRouter.patch(
  "/schemas",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      localBusiness: localBusinessShape.optional(),
      faqItems: z.array(faqItemShape).optional(),
    });
    const patch = schema.parse(req.body ?? {});
    const current = await loadSettings();
    const merged = deepMerge(current, patch);
    await saveSettings(merged);
    res.json({
      localBusiness: merged.localBusiness ?? {},
      faqItems: merged.faqItems ?? [],
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// /api/seo/content  — coverage report across content collections
// ─────────────────────────────────────────────────────────────────────────────

type WithSEO = {
  id: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  [k: string]: unknown;
};

function hasSEO(item: WithSEO): boolean {
  return Boolean(item.seoTitle && item.seoDescription);
}

// All SEO columns the admin Content SEO modal needs in one place — keeps the
// /content response shape consistent across collections.
const contentSeoSelect = {
  id: true,
  slug: true,
  title: true,
  seoTitle: true,
  seoDescription: true,
  seoOgImage: true,
  seoKeywords: true,
  seoPrimaryKeyword: true,
  seoSecondaryKeywords: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoCanonicalUrl: true,
  seoNoIndex: true,
  seoNoFollow: true,
  updatedAt: true,
} as const;

seoRouter.get(
  "/content",
  asyncHandler(async (_req, res) => {
    const [projects, services, articles] = await Promise.all([
      prisma.project.findMany({ orderBy: { sortOrder: "asc" }, select: contentSeoSelect }),
      prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: contentSeoSelect }),
      prisma.article.findMany({ orderBy: { publishedAt: "desc" }, select: contentSeoSelect }),
    ]);
    const decorate = <T extends WithSEO>(items: T[]) =>
      items.map((it) => ({ ...it, hasSEO: hasSEO(it) }));
    res.json({
      projects: decorate(projects),
      services: decorate(services),
      articles: decorate(articles),
    });
  }),
);

// Per-collection SEO patch endpoints. URL-style: /api/seo/projects/:id, etc.
const collectionMap = {
  projects: "project",
  services: "service",
  articles: "article",
  leaders: "leader",
} as const;

for (const [urlSegment, modelKey] of Object.entries(collectionMap)) {
  seoRouter.patch(
    `/${urlSegment}/:id`,
    asyncHandler(async (req, res) => {
      const data = collectionSeoSchema.parse(req.body ?? {});
      const { seoKeywords, seoSecondaryKeywords, ...rest } = data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (prisma as unknown as Record<string, any>)[modelKey];
      const updated = await m.update({
        where: { id: req.params.id },
        data: {
          ...rest,
          ...(seoKeywords !== undefined ? { seoKeywords: seoKeywords as Prisma.InputJsonValue } : {}),
          ...(seoSecondaryKeywords !== undefined
            ? { seoSecondaryKeywords: seoSecondaryKeywords as Prisma.InputJsonValue }
            : {}),
        },
      });
      res.json({ item: updated });
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/seo/bulk-generate  — auto-fill missing title/description/keywords
// ─────────────────────────────────────────────────────────────────────────────

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > 80 ? slice.slice(0, lastSpace).trim() : slice.trim();
}

// Split a legacy seoKeywords array into a primary keyword + secondary keywords.
// Returns null when the row already has a primary keyword or the legacy list is
// empty, so callers can skip writing.
function splitLegacyKeywords(
  existingPrimary: string | null,
  existingSecondary: unknown,
  legacy: unknown,
): { seoPrimaryKeyword: string; seoSecondaryKeywords: string[] } | null {
  if (existingPrimary && existingPrimary.trim()) return null;
  const arr = Array.isArray(legacy)
    ? legacy.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  if (arr.length === 0) return null;
  const primary = arr[0].trim();
  const restRaw = arr.slice(1);
  const existingSecondaryArr = Array.isArray(existingSecondary)
    ? existingSecondary.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  // Merge legacy tail with whatever is already in secondary, dedupe.
  const merged = sanitizeSecondaryKeywords([...existingSecondaryArr, ...restRaw]);
  return { seoPrimaryKeyword: primary, seoSecondaryKeywords: merged };
}

seoRouter.post(
  "/bulk-generate",
  asyncHandler(async (_req, res) => {
    const settings = await loadSettings();
    const siteName = settings.siteName || "Naksha Construction";

    const reports: Record<string, { updated: number; total: number }> = {};

    // Projects
    {
      const items = await prisma.project.findMany();
      let updated = 0;
      for (const it of items) {
        const split = splitLegacyKeywords(it.seoPrimaryKeyword, it.seoSecondaryKeywords, it.seoKeywords);
        const needsCore = !it.seoTitle || !it.seoDescription;
        if (!needsCore && !split) continue;
        const title = it.seoTitle ?? `${it.title} | ${siteName}`;
        const description =
          it.seoDescription ?? clip(it.summary || it.description || it.title, 155);
        await prisma.project.update({
          where: { id: it.id },
          data: {
            seoTitle: title,
            seoDescription: description,
            ...(split
              ? {
                  seoPrimaryKeyword: split.seoPrimaryKeyword,
                  seoSecondaryKeywords: split.seoSecondaryKeywords as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
        updated += 1;
      }
      reports.projects = { updated, total: items.length };
    }

    // Services
    {
      const items = await prisma.service.findMany();
      let updated = 0;
      for (const it of items) {
        const split = splitLegacyKeywords(it.seoPrimaryKeyword, it.seoSecondaryKeywords, it.seoKeywords);
        const needsCore = !it.seoTitle || !it.seoDescription;
        if (!needsCore && !split) continue;
        const title = it.seoTitle ?? `${it.title} | ${siteName}`;
        const description = it.seoDescription ?? clip(it.summary || it.body || it.title, 155);
        await prisma.service.update({
          where: { id: it.id },
          data: {
            seoTitle: title,
            seoDescription: description,
            ...(split
              ? {
                  seoPrimaryKeyword: split.seoPrimaryKeyword,
                  seoSecondaryKeywords: split.seoSecondaryKeywords as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
        updated += 1;
      }
      reports.services = { updated, total: items.length };
    }

    // Articles
    {
      const items = await prisma.article.findMany();
      let updated = 0;
      for (const it of items) {
        const split = splitLegacyKeywords(it.seoPrimaryKeyword, it.seoSecondaryKeywords, it.seoKeywords);
        const needsCore = !it.seoTitle || !it.seoDescription;
        if (!needsCore && !split) continue;
        const title = it.seoTitle ?? `${it.title} | ${siteName}`;
        const description = it.seoDescription ?? clip(it.excerpt || it.body || it.title, 155);
        const keywords =
          (it.seoKeywords as unknown as string[] | null)?.length
            ? (it.seoKeywords as unknown as string[])
            : it.category
              ? [it.category]
              : [];
        await prisma.article.update({
          where: { id: it.id },
          data: {
            seoTitle: title,
            seoDescription: description,
            seoKeywords: keywords as Prisma.InputJsonValue,
            ...(split
              ? {
                  seoPrimaryKeyword: split.seoPrimaryKeyword,
                  seoSecondaryKeywords: split.seoSecondaryKeywords as Prisma.InputJsonValue,
                }
              : it.seoPrimaryKeyword
                ? {}
                : it.category
                  ? { seoPrimaryKeyword: it.category }
                  : {}),
          },
        });
        updated += 1;
      }
      reports.articles = { updated, total: items.length };
    }

    res.json({ reports });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// /api/seo/stats
// ─────────────────────────────────────────────────────────────────────────────

seoRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const settings = await loadSettings();

    const [seoPages, projects, services, articles] = await Promise.all([
      prisma.seoPage.count(),
      prisma.project.findMany({ select: { seoTitle: true, seoDescription: true } }),
      prisma.service.findMany({ select: { seoTitle: true, seoDescription: true } }),
      prisma.article.findMany({ select: { seoTitle: true, seoDescription: true } }),
    ]);

    const cov = (rows: { seoTitle: string | null; seoDescription: string | null }[]) => {
      const total = rows.length;
      const optimized = rows.filter((r) => r.seoTitle && r.seoDescription).length;
      return { total, optimized, missing: total - optimized };
    };

    res.json({
      seoPages,
      projects: cov(projects),
      services: cov(services),
      articles: cov(articles),
      tracking: {
        googleSiteVerification: Boolean(settings.googleSiteVerification),
        googleAnalyticsId: Boolean(settings.googleAnalyticsId),
        googleTagManagerId: Boolean(settings.googleTagManagerId),
        facebookPixelId: Boolean(settings.facebookPixelId),
      },
    });
  }),
);
