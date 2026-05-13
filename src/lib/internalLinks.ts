import { prisma } from "../db.js";

type InternalDocType = "page" | "project" | "service" | "market" | "article" | "job" | "location";

type InternalDoc = {
  id: string;
  type: InternalDocType;
  title: string;
  slug: string;
  url: string;
};

type Index = Record<InternalDocType, InternalDoc[]>;

const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; data: Index } | null = null;

function url(type: InternalDocType, slug: string, pagePath?: string): string {
  switch (type) {
    case "page":
      return pagePath ?? `/${slug}`;
    case "project":
      return `/projects/${slug}`;
    case "service":
      return `/services/${slug}`;
    case "market":
      return `/markets/${slug}`;
    case "article":
      return `/insights/${slug}`;
    case "job":
      return `/careers/${slug}`;
    case "location":
      return `/locations/${slug}`;
  }
}

export async function getInternalLinksIndex(): Promise<Index> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

  const [pages, projects, services, markets, articles, jobs, locations] = await Promise.all([
    prisma.page.findMany({ select: { id: true, key: true, path: true, title: true }, orderBy: { path: "asc" } }),
    prisma.project.findMany({ select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } }),
    prisma.service.findMany({ select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } }),
    prisma.market.findMany({ select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } }),
    prisma.article.findMany({ select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } }),
    prisma.job.findMany({ select: { id: true, slug: true, title: true }, orderBy: { sortOrder: "asc" } }),
    prisma.location.findMany({ select: { id: true, slug: true, city: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const data: Index = {
    page: pages.map((p) => ({ id: p.id, type: "page", title: p.title, slug: p.key, url: url("page", p.key, p.path) })),
    project: projects.map((p) => ({ id: p.id, type: "project", title: p.title, slug: p.slug, url: url("project", p.slug) })),
    service: services.map((p) => ({ id: p.id, type: "service", title: p.title, slug: p.slug, url: url("service", p.slug) })),
    market: markets.map((p) => ({ id: p.id, type: "market", title: p.title, slug: p.slug, url: url("market", p.slug) })),
    article: articles.map((p) => ({ id: p.id, type: "article", title: p.title, slug: p.slug, url: url("article", p.slug) })),
    job: jobs.map((p) => ({ id: p.id, type: "job", title: p.title, slug: p.slug, url: url("job", p.slug) })),
    location: locations.map((p) => ({ id: p.id, type: "location", title: p.city, slug: p.slug, url: url("location", p.slug) })),
  };

  cached = { at: Date.now(), data };
  return data;
}

export type ResolvedLink = { id: string; type: InternalDocType; title: string; slug: string; url: string };

export async function resolveInternalLinks(refs: { id: string; type: InternalDocType }[]): Promise<Record<string, ResolvedLink>> {
  const idx = await getInternalLinksIndex();
  const out: Record<string, ResolvedLink> = {};
  for (const ref of refs) {
    const list = idx[ref.type];
    if (!list) continue;
    const hit = list.find((d) => d.id === ref.id);
    if (hit) out[`${ref.type}:${ref.id}`] = hit;
  }
  return out;
}

export function invalidateInternalLinksCache(): void {
  cached = null;
}
