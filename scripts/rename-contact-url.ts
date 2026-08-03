/**
 * One-shot, idempotent script.
 *
 * Renames the public contact URL from /contact to /contact-us:
 *   - Page "contact": path /contact -> /contact-us
 *   - every ctaHref/href === "/contact" inside any page's blocks JSON
 *   - the navbar and footer globals
 *   - keeps the /contact -> /contact-us 301 so the old URL still resolves
 *
 * It also deletes two reciprocal redirect rows that currently form loops.
 * Both directions exist for each pair, so the next frontend build (which
 * bakes the CMS redirect table into next.config.mjs) would serve an endless
 * bounce:
 *   /contact-us -> /contact                                    (reverse of this rename)
 *   /services/interior-work-design -> /services/interior-design-jaipur
 * In each case the row pointing AT the page that actually exists is kept.
 *
 * Only link fields are rewritten — no heading, body or other content is
 * touched. Safe to re-run: a second pass finds nothing to change.
 *
 *   cd backend && npx tsx scripts/rename-contact-url.ts          # dry run
 *   cd backend && APPLY=1 npx tsx scripts/rename-contact-url.ts  # write
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.env.APPLY === "1";
const OLD = "/contact";
const NEW = "/contact-us";

/** fromPath values whose rows are the wrong half of a redirect loop. */
const LOOP_ROWS_TO_DELETE = ["/contact-us", "/services/interior-work-design"];

/**
 * Rewrite OLD -> NEW in link-bearing fields only. Deliberately keyed on the
 * field name rather than the value, so a heading or body that happens to read
 * "/contact" is left alone.
 */
function rewriteLinks(node: unknown): number {
  let changed = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const obj = v as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if ((k === "href" || k === "ctaHref") && obj[k] === OLD) {
        obj[k] = NEW;
        changed++;
      } else {
        walk(obj[k]);
      }
    }
  };
  walk(node);
  return changed;
}

async function main() {
  const plan: string[] = [];

  // ── Pages: the contact page's own path, plus links inside every page ──────
  for (const page of await prisma.page.findMany({ orderBy: { path: "asc" } })) {
    const data: Prisma.PageUpdateInput = {};
    if (page.key === "contact" && page.path === OLD) data.path = NEW;

    const blocks = JSON.parse(JSON.stringify(page.blocks));
    const n = rewriteLinks(blocks);
    if (n) data.blocks = blocks as Prisma.InputJsonValue;

    if (!Object.keys(data).length) continue;
    plan.push(
      `page ${page.path} — ${[data.path && `path -> ${NEW}`, n && `${n} link(s)`]
        .filter(Boolean)
        .join(", ")}`,
    );
    if (APPLY) await prisma.page.update({ where: { id: page.id }, data });
  }

  // ── Globals: navbar + footer nav links ───────────────────────────────────
  for (const key of ["navbar", "footer"]) {
    const row = await prisma.global.findUnique({ where: { key } });
    if (!row) continue;
    const value = JSON.parse(JSON.stringify(row.value));
    const n = rewriteLinks(value);
    if (!n) continue;
    plan.push(`global ${key} — ${n} link(s)`);
    if (APPLY) {
      await prisma.global.update({ where: { key }, data: { value: value as Prisma.InputJsonValue } });
    }
  }

  // ── Redirects: keep /contact -> /contact-us, drop the loop halves ────────
  const existing = await prisma.redirect.findUnique({ where: { fromPath: OLD } });
  if (!existing) {
    plan.push(`redirect ${OLD} -> ${NEW} (create)`);
    if (APPLY) {
      await prisma.redirect.create({ data: { fromPath: OLD, toPath: NEW, statusCode: 301 } });
    }
  } else if (existing.toPath !== NEW) {
    plan.push(`redirect ${OLD} -> ${NEW} (was ${existing.toPath})`);
    if (APPLY) {
      await prisma.redirect.update({ where: { fromPath: OLD }, data: { toPath: NEW, statusCode: 301 } });
    }
  }

  for (const fromPath of LOOP_ROWS_TO_DELETE) {
    const row = await prisma.redirect.findUnique({ where: { fromPath } });
    if (!row) continue;
    plan.push(`DELETE redirect ${row.fromPath} -> ${row.toPath}  [loop]`);
    if (APPLY) await prisma.redirect.delete({ where: { fromPath } });
  }

  console.log(APPLY ? "APPLIED:" : "DRY RUN — nothing written:");
  plan.forEach((p) => console.log("  " + p));
  console.log(`\n${plan.length} change(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
