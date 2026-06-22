/**
 * One-shot backfill: ensure every CMS row that ships a cover image also ships
 * an og:image. Targets the four content collections, the path-keyed SeoPage
 * rows, and the CMS Page documents at /projects/<slug>, /services/<slug>,
 * /blog/<slug>, /about/<slug>.
 *
 * Idempotent: only touches rows whose og field is null or empty string.
 * Re-running reports zero updated.
 *
 *   cd backend && npx tsx scripts/backfill-og-images.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Turn any Cloudinary upload URL into a 1200×630 og-sized derivative. If the
// existing transform segment already encodes a different crop we replace it;
// if no transform segment is present we inject one before the version/filename.
const OG_TRANSFORM = "c_fill,w_1200,h_630,g_auto,q_auto,f_auto";

function toOgUrl(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(trimmed)) {
    // Non-Cloudinary URL — leave untouched.
    return trimmed;
  }
  const [prefix, rest] = trimmed.split("/image/upload/");
  if (!rest) return trimmed;
  const segments = rest.split("/");
  // A Cloudinary transform segment contains a comma or starts with `<letter>_`.
  // Version segments look like `v123456789` — those should NOT be treated as
  // transforms.
  const first = segments[0] ?? "";
  const isTransform =
    first.includes(",") ||
    /^[a-z]+_/i.test(first.replace(/^v\d+$/i, "")) && !/^v\d+$/i.test(first);
  if (isTransform) {
    segments[0] = OG_TRANSFORM;
  } else {
    segments.unshift(OG_TRANSFORM);
  }
  return `${prefix}/image/upload/${segments.join("/")}`;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

type Counts = { updated: number; alreadySet: number; noSource: number };
function blank(): Counts { return { updated: 0, alreadySet: 0, noSource: 0 }; }

async function backfillCollection(
  modelName: "project" | "service" | "article" | "leader",
  sourceField: string,
): Promise<Counts> {
  const counts = blank();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as unknown as Record<string, any>)[modelName];
  const rows = await m.findMany({
    select: { id: true, seoOgImage: true, [sourceField]: true },
  });
  for (const row of rows) {
    if (!isEmpty(row.seoOgImage)) { counts.alreadySet += 1; continue; }
    const source = (row as Record<string, unknown>)[sourceField];
    const og = toOgUrl(typeof source === "string" ? source : null);
    if (!og) { counts.noSource += 1; continue; }
    await m.update({ where: { id: row.id }, data: { seoOgImage: og } });
    counts.updated += 1;
  }
  return counts;
}

// Build a path → og-URL map from the four collections so we can resolve a
// SeoPage / Page row at /projects/<slug> back to the matching cover.
async function buildPathOgMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const [projects, services, articles, leaders] = await Promise.all([
    prisma.project.findMany({ select: { slug: true, coverImage: true, seoOgImage: true } }),
    prisma.service.findMany({ select: { slug: true, icon: true, seoOgImage: true } }),
    prisma.article.findMany({ select: { slug: true, cover: true, seoOgImage: true } }),
    prisma.leader.findMany({ select: { slug: true, portrait: true, seoOgImage: true } }),
  ]);
  const add = (path: string, og: string | null) => {
    if (og) map.set(path, og);
  };
  for (const p of projects) add(`/projects/${p.slug}`, toOgUrl(p.seoOgImage) || toOgUrl(p.coverImage));
  for (const s of services) add(`/services/${s.slug}`, toOgUrl(s.seoOgImage) || toOgUrl(s.icon));
  for (const a of articles) add(`/blog/${a.slug}`, toOgUrl(a.seoOgImage) || toOgUrl(a.cover));
  for (const l of leaders)  add(`/about/${l.slug}`,    toOgUrl(l.seoOgImage) || toOgUrl(l.portrait));
  return map;
}

async function backfillSeoPage(pathOg: Map<string, string>): Promise<Counts> {
  const counts = blank();
  const rows = await prisma.seoPage.findMany({ select: { id: true, path: true, ogImage: true } });
  for (const row of rows) {
    if (!isEmpty(row.ogImage)) { counts.alreadySet += 1; continue; }
    const og = pathOg.get(row.path);
    if (!og) { counts.noSource += 1; continue; }
    await prisma.seoPage.update({ where: { id: row.id }, data: { ogImage: og } });
    counts.updated += 1;
  }
  return counts;
}

async function backfillPage(pathOg: Map<string, string>): Promise<Counts> {
  const counts = blank();
  const rows = await prisma.page.findMany({ select: { id: true, path: true, seoOgImage: true } });
  for (const row of rows) {
    if (!isEmpty(row.seoOgImage)) { counts.alreadySet += 1; continue; }
    const og = pathOg.get(row.path);
    if (!og) { counts.noSource += 1; continue; }
    await prisma.page.update({ where: { id: row.id }, data: { seoOgImage: og } });
    counts.updated += 1;
  }
  return counts;
}

function fmt(label: string, c: Counts) {
  console.log(
    `  ${label.padEnd(10)}  updated=${String(c.updated).padStart(3)}  alreadySet=${String(c.alreadySet).padStart(3)}  noSource=${String(c.noSource).padStart(3)}`,
  );
}

async function main() {
  console.log("Backfilling og:image fields …");
  const results: Record<string, Counts> = {};
  results.project = await backfillCollection("project", "coverImage");
  results.service = await backfillCollection("service", "icon");
  results.article = await backfillCollection("article", "cover");
  results.leader  = await backfillCollection("leader", "portrait");
  const pathOg = await buildPathOgMap();
  results.seoPage = await backfillSeoPage(pathOg);
  results.page    = await backfillPage(pathOg);

  console.log("\nResults:");
  for (const [k, v] of Object.entries(results)) fmt(k, v);
  const total = Object.values(results).reduce((s, c) => s + c.updated, 0);
  console.log(`\nTotal rows updated: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
// Marker constant (unused — for cleanliness when this file is grep'd later).
void Prisma;
