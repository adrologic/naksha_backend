/**
 * One-shot migration: split the legacy seoKeywords / keywords columns into
 * the new seoPrimaryKeyword + seoSecondaryKeywords (for Project / Service /
 * Article / Leader / SeoPage) and seoPrimaryKeyword + seoSecondaryKeywords
 * String columns (for Page).
 *
 * Idempotent: only touches rows whose new primary is still empty. Re-running
 * reports zero migrated.
 *
 *   cd backend && npx tsx scripts/migrate-keywords-to-primary-secondary.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Counts = { migrated: number; skipped: number; unchanged: number };

function trim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

// Trim, dedupe (case-sensitive, first wins), drop empties.
function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function migrateJsonModel(
  modelName: "project" | "service" | "article" | "leader",
): Promise<Counts> {
  const counts: Counts = { migrated: 0, skipped: 0, unchanged: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (prisma as unknown as Record<string, any>)[modelName];
  const rows: Array<{
    id: string;
    seoPrimaryKeyword: string | null;
    seoSecondaryKeywords: unknown;
    seoKeywords: unknown;
  }> = await m.findMany({
    select: {
      id: true,
      seoPrimaryKeyword: true,
      seoSecondaryKeywords: true,
      seoKeywords: true,
    },
  });
  for (const row of rows) {
    const legacy = asStringArray(row.seoKeywords);
    const hasPrimary = Boolean(trim(row.seoPrimaryKeyword));
    if (hasPrimary) {
      counts.skipped += 1;
      continue;
    }
    if (legacy.length === 0) {
      counts.unchanged += 1;
      continue;
    }
    const primary = legacy[0];
    const existingSecondary = asStringArray(row.seoSecondaryKeywords);
    const secondary = dedupe([...existingSecondary, ...legacy.slice(1)]);
    await m.update({
      where: { id: row.id },
      data: {
        seoPrimaryKeyword: primary,
        seoSecondaryKeywords: secondary as Prisma.InputJsonValue,
      },
    });
    counts.migrated += 1;
  }
  return counts;
}

async function migrateSeoPage(): Promise<Counts> {
  const counts: Counts = { migrated: 0, skipped: 0, unchanged: 0 };
  const rows = await prisma.seoPage.findMany({
    select: {
      id: true,
      primaryKeyword: true,
      secondaryKeywords: true,
      keywords: true,
    },
  });
  for (const row of rows) {
    const legacy = asStringArray(row.keywords);
    if (trim(row.primaryKeyword)) {
      counts.skipped += 1;
      continue;
    }
    if (legacy.length === 0) {
      counts.unchanged += 1;
      continue;
    }
    const primary = legacy[0];
    const existingSecondary = asStringArray(row.secondaryKeywords);
    const secondary = dedupe([...existingSecondary, ...legacy.slice(1)]);
    await prisma.seoPage.update({
      where: { id: row.id },
      data: {
        primaryKeyword: primary,
        secondaryKeywords: secondary as Prisma.InputJsonValue,
      },
    });
    counts.migrated += 1;
  }
  return counts;
}

async function migratePage(): Promise<Counts> {
  const counts: Counts = { migrated: 0, skipped: 0, unchanged: 0 };
  const rows = await prisma.page.findMany({
    select: {
      id: true,
      seoPrimaryKeyword: true,
      seoSecondaryKeywords: true,
      seoKeywords: true,
    },
  });
  for (const row of rows) {
    if (trim(row.seoPrimaryKeyword)) {
      counts.skipped += 1;
      continue;
    }
    const csv = trim(row.seoKeywords);
    if (!csv) {
      counts.unchanged += 1;
      continue;
    }
    const parts = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      counts.unchanged += 1;
      continue;
    }
    const primary = parts[0];
    // Merge with any existing secondary string, dedupe.
    const existingSecondary = trim(row.seoSecondaryKeywords)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const secondary = dedupe([...existingSecondary, ...parts.slice(1)]);
    const secondaryString = secondary.length ? secondary.join(", ") : null;
    await prisma.page.update({
      where: { id: row.id },
      data: {
        seoPrimaryKeyword: primary,
        seoSecondaryKeywords: secondaryString,
      },
    });
    counts.migrated += 1;
  }
  return counts;
}

function fmt(label: string, c: Counts) {
  console.log(
    `  ${label.padEnd(12)}  migrated=${String(c.migrated).padStart(3)}  skipped=${String(
      c.skipped,
    ).padStart(3)}  unchanged=${String(c.unchanged).padStart(3)}`,
  );
}

async function main() {
  console.log("Splitting legacy keywords into primary + secondary …");
  const results: Record<string, Counts> = {};
  for (const model of ["project", "service", "article", "leader"] as const) {
    results[model] = await migrateJsonModel(model);
  }
  results.seoPage = await migrateSeoPage();
  results.page = await migratePage();

  console.log("\nResults:");
  for (const [name, c] of Object.entries(results)) fmt(name, c);

  const totalMigrated = Object.values(results).reduce((s, c) => s + c.migrated, 0);
  console.log(`\nTotal rows migrated: ${totalMigrated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
