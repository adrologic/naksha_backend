/**
 * One-shot, idempotent: fix the heading outline on the /about page for SEO.
 *
 * The page used <h1>About Us</h1> (hero) + <h2>TRUSTED CONSTRUCTION COMPANY
 * IN JAIPUR</h2> (two-column). For SEO the keyword-rich heading should be the
 * H1. This swaps the *tag levels only* (the frontend renders the same styling
 * regardless of level, via block.headingLevel):
 *   - hero "About Us"                              -> h2
 *   - two-column "TRUSTED CONSTRUCTION COMPANY..." -> h1
 *
 * Other blocks/pages are untouched. Re-running reports "already set".
 *
 *   cd backend && npx tsx scripts/set-about-heading-levels.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_HEADING = "TRUSTED CONSTRUCTION COMPANY IN JAIPUR";

async function main() {
  const page = await prisma.page.findUnique({ where: { path: "/about" } });
  if (!page) throw new Error("No /about page found");

  const blocks = (page.blocks as Array<Record<string, unknown>>) ?? [];
  let heroFixed = false;
  let headingFixed = false;

  const next = blocks.map((b) => {
    if (b?.type === "hero" && b?.headingLevel !== "h2") {
      heroFixed = true;
      return { ...b, headingLevel: "h2" };
    }
    if (
      b?.type === "twoColumn" &&
      typeof b?.heading === "string" &&
      b.heading.trim().toUpperCase() === TARGET_HEADING &&
      b?.headingLevel !== "h1"
    ) {
      headingFixed = true;
      return { ...b, headingLevel: "h1" };
    }
    return b;
  });

  if (!heroFixed && !headingFixed) {
    console.log("Nothing to change — heading levels already set (hero=h2, target=h1).");
    return;
  }

  await prisma.page.update({
    where: { path: "/about" },
    data: { blocks: next as unknown as Prisma.InputJsonValue },
  });

  console.log(
    `Updated /about: hero->${heroFixed ? "h2" : "unchanged"}, ` +
      `"${TARGET_HEADING}"->${headingFixed ? "h1" : "unchanged"}.`,
  );

  // Verify the new outline.
  const h1s = next.filter(
    (b) =>
      (b?.type === "hero" && (b?.headingLevel ?? "h1") === "h1") ||
      ((b?.type === "twoColumn" || b?.type === "splitFeature") && b?.headingLevel === "h1"),
  );
  console.log(`H1 count on /about is now: ${h1s.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
