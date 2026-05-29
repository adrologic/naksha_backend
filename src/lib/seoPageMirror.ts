import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

// Field mapping (Page <-> SeoPage) so SEO data stays one source of truth no
// matter which surface the editor used. Page stores legacy string columns
// (seoKeywords CSV, seoSecondaryKeywords CSV, seoRobots="noindex,nofollow"),
// SeoPage stores the typed shape (string[] + booleans). These helpers convert
// between them and upsert the other side after every write.
//
// Called from POST/PATCH /pages (mirror to SeoPage) and POST/PATCH/PUT
// /api/seo/pages (mirror to Page). All writes are silent — a missing Page or
// missing SeoPage just means there's no peer to update.

type PageRow = {
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoOgImage?: string | null;
  seoKeywords?: string | null;
  seoPrimaryKeyword?: string | null;
  seoSecondaryKeywords?: string | null;
  seoRobots?: string | null;
  seoCanonical?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
};

type SeoPageWrite = {
  title?: string | null;
  description?: string | null;
  keywords?: string[];
  primaryKeyword?: string | null;
  secondaryKeywords?: string[];
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  canonicalUrl?: string | null;
  noIndex?: boolean;
  noFollow?: boolean;
};

function parseCsv(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseRobots(s: string | null | undefined): { noIndex: boolean; noFollow: boolean } {
  const v = (s ?? "").toLowerCase();
  return { noIndex: v.includes("noindex"), noFollow: v.includes("nofollow") };
}

function formatRobots(noIndex: boolean, noFollow: boolean): string {
  return `${noIndex ? "noindex" : "index"},${noFollow ? "nofollow" : "follow"}`;
}

// Page write → SeoPage shape. Only includes fields the Page write actually
// touched, so we don't blow away SeoPage fields the editor didn't intend to
// change.
export function pageToSeoPage(page: PageRow): SeoPageWrite {
  const out: SeoPageWrite = {};
  if (page.seoTitle !== undefined) out.title = page.seoTitle;
  if (page.seoDescription !== undefined) out.description = page.seoDescription;
  if (page.seoOgImage !== undefined) out.ogImage = page.seoOgImage;
  if (page.seoCanonical !== undefined) out.canonicalUrl = page.seoCanonical;
  if (page.ogTitle !== undefined) out.ogTitle = page.ogTitle;
  if (page.ogDescription !== undefined) out.ogDescription = page.ogDescription;
  if (page.seoKeywords !== undefined) out.keywords = parseCsv(page.seoKeywords);
  if (page.seoPrimaryKeyword !== undefined) out.primaryKeyword = page.seoPrimaryKeyword;
  if (page.seoSecondaryKeywords !== undefined)
    out.secondaryKeywords = parseCsv(page.seoSecondaryKeywords);
  if (page.seoRobots !== undefined) {
    const flags = parseRobots(page.seoRobots);
    out.noIndex = flags.noIndex;
    out.noFollow = flags.noFollow;
  }
  return out;
}

// SeoPage write → Page shape. Mirrors only fields the SeoPage write touched.
export function seoPageToPage(seo: SeoPageWrite): Partial<Record<keyof PageRow, string | null>> {
  const out: Partial<Record<keyof PageRow, string | null>> = {};
  if (seo.title !== undefined) out.seoTitle = seo.title;
  if (seo.description !== undefined) out.seoDescription = seo.description;
  if (seo.ogImage !== undefined) out.seoOgImage = seo.ogImage;
  if (seo.canonicalUrl !== undefined) out.seoCanonical = seo.canonicalUrl;
  if (seo.ogTitle !== undefined) out.ogTitle = seo.ogTitle;
  if (seo.ogDescription !== undefined) out.ogDescription = seo.ogDescription;
  if (seo.keywords !== undefined) out.seoKeywords = seo.keywords.join(", ") || null;
  if (seo.primaryKeyword !== undefined) out.seoPrimaryKeyword = seo.primaryKeyword;
  if (seo.secondaryKeywords !== undefined)
    out.seoSecondaryKeywords = seo.secondaryKeywords.join(", ") || null;
  if (seo.noIndex !== undefined || seo.noFollow !== undefined) {
    out.seoRobots = formatRobots(seo.noIndex ?? false, seo.noFollow ?? false);
  }
  return out;
}

// Push Page SEO write to the path-keyed SeoPage row (upsert). Idempotent.
export async function mirrorPageToSeoPage(path: string, page: PageRow): Promise<void> {
  if (!path?.startsWith("/")) return;
  const data = pageToSeoPage(page);
  if (Object.keys(data).length === 0) return;
  await prisma.seoPage.upsert({
    where: { path },
    update: {
      ...data,
      ...(data.keywords !== undefined
        ? { keywords: data.keywords as Prisma.InputJsonValue }
        : {}),
      ...(data.secondaryKeywords !== undefined
        ? { secondaryKeywords: data.secondaryKeywords as Prisma.InputJsonValue }
        : {}),
    },
    create: {
      path,
      title: data.title ?? null,
      description: data.description ?? null,
      primaryKeyword: data.primaryKeyword ?? null,
      ogTitle: data.ogTitle ?? null,
      ogDescription: data.ogDescription ?? null,
      ogImage: data.ogImage ?? null,
      canonicalUrl: data.canonicalUrl ?? null,
      noIndex: data.noIndex ?? false,
      noFollow: data.noFollow ?? false,
      keywords: (data.keywords ?? []) as Prisma.InputJsonValue,
      secondaryKeywords: (data.secondaryKeywords ?? []) as Prisma.InputJsonValue,
    },
  });
}

// Push SeoPage write to the matching Page row when one exists at that path.
// No-op if no Page is authored there.
export async function mirrorSeoPageToPage(path: string, seo: SeoPageWrite): Promise<void> {
  if (!path?.startsWith("/")) return;
  const page = await prisma.page.findUnique({ where: { path } });
  if (!page) return;
  const data = seoPageToPage(seo);
  if (Object.keys(data).length === 0) return;
  await prisma.page.update({ where: { id: page.id }, data });
}
