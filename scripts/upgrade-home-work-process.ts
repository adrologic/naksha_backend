/**
 * One-shot, idempotent script.
 *
 * Replaces the flat Work Process pair on the home page (intro + commitments)
 * with a single splitFeature block: dark band, construction-site background,
 * left-aligned text + 2x2 grid of cards with icons.
 *
 *   cd backend && npx tsx scripts/upgrade-home-work-process.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Block = Record<string, unknown> & { type: string };

const HEADING = "We Are Proud To Be Your Choice!";
const BODY_FINGERPRINT = "We Are Proud To Be Your Choice";
const COMMITMENTS_TITLE_FINGERPRINT = "Consult with Customers";

const NEW_BLOCK: Block = {
  type: "splitFeature",
  eyebrow: "WORK PROCESS",
  heading: HEADING,
  body:
    "<p>Naksha Construction stands tall among reputed <strong>residential &amp; commercial building construction</strong> companies in Jaipur with quality construction material. When you discuss your needs with us, we try to cover all the aspects that should be included in your planning.</p>" +
    "<p>From <strong>construction to remodeling</strong>, we cover everything that you need to escalate the look and feel of the property. We believe in instantly changing the vibes of the property and ensuring you meet your purposes in a seamless way. We use the best approaches to ensure that high-quality construction is done. We are committed to providing world-class jobs and completing all the projects on time. We can also bet that you will get unmatched <strong>construction services</strong> here. Furthermore, we are available to assist you round the clock. Now, feel free to connect with us for the best designs for your house, flats and offices.</p>",
  textPosition: "left",
  background: "image",
  backgroundImage: {
    url: "https://res.cloudinary.com/dwmsbubv5/image/upload/c_fill,w_2400,h_1400,g_auto,q_auto,f_auto/naksha/services/civil/civil-work-detail.jpg",
    alt: "Construction site by Naksha Construction",
  },
  overlayStrength: "heavy",
  cardColumns: 2,
  cards: [
    { title: "Consult with Customers", body: "", icon: "Handshake" },
    { title: "Customers Requirements", body: "", icon: "Users" },
    { title: "Design", body: "", icon: "PencilRuler" },
    { title: "Implement", body: "", icon: "House" },
  ],
};

function isIntroWorkProcess(b: Block): boolean {
  if (b.type !== "intro") return false;
  const body = typeof b.body === "string" ? b.body : "";
  const heading = typeof b.heading === "string" ? b.heading : "";
  return body.includes(BODY_FINGERPRINT) || heading.toUpperCase().includes("WORK PROCESS");
}

function isCommitmentsWorkProcess(b: Block): boolean {
  if (b.type !== "commitments") return false;
  const items = Array.isArray((b as Record<string, unknown>).items)
    ? ((b as { items: unknown[] }).items as Record<string, unknown>[])
    : [];
  return items.some(
    (it) => typeof it?.title === "string" && (it.title as string).includes(COMMITMENTS_TITLE_FINGERPRINT),
  );
}

function isExistingSplitFeature(b: Block): boolean {
  return (
    b.type === "splitFeature" &&
    typeof (b as Record<string, unknown>).heading === "string" &&
    ((b as { heading: string }).heading.startsWith("We Are Proud To Be Your Choice") ||
      (b as { heading: string }).heading.startsWith(HEADING.slice(0, 30)))
  );
}

async function main() {
  const page = await prisma.page.findUnique({ where: { key: "home" } });
  if (!page) {
    console.error("Home page (key='home') not found. Aborting.");
    process.exit(1);
  }

  const raw = Array.isArray(page.blocks) ? (page.blocks as unknown[]) : [];
  const blocks: Block[] = raw
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => b as Block);

  // Find positions of the old work-process pair.
  const introIdx = blocks.findIndex(isIntroWorkProcess);
  const commitIdx = blocks.findIndex(isCommitmentsWorkProcess);
  const existingIdx = blocks.findIndex(isExistingSplitFeature);

  let insertIdx: number;
  let next: Block[];

  if (existingIdx >= 0) {
    // Replace in place.
    insertIdx = existingIdx;
    next = blocks.map((b, i) => (i === existingIdx ? NEW_BLOCK : b));
    // Also remove any leftover old intro/commitments that may coexist.
    next = next.filter(
      (b, i) => i === insertIdx || (!isIntroWorkProcess(b) && !isCommitmentsWorkProcess(b)),
    );
  } else {
    // Splice out the old pair, insert the new block at the earlier index.
    const candidateIndices = [introIdx, commitIdx].filter((i) => i >= 0);
    insertIdx = candidateIndices.length > 0 ? Math.min(...candidateIndices) : blocks.length;
    next = blocks.filter((b) => !isIntroWorkProcess(b) && !isCommitmentsWorkProcess(b));
    next.splice(Math.min(insertIdx, next.length), 0, NEW_BLOCK);
  }

  await prisma.page.update({
    where: { key: "home" },
    data: { blocks: next as unknown as Prisma.InputJsonValue },
  });

  console.log("Home page blocks after update:");
  next.forEach((b, i) => {
    const head =
      typeof (b as Record<string, unknown>).heading === "string"
        ? ((b as { heading: string }).heading || "").slice(0, 60)
        : "";
    console.log(`  [${i}] ${b.type} — ${head}`);
  });
  console.log(`\nDone. splitFeature inserted at index ${next.findIndex((b) => b.type === "splitFeature" && (b as { heading?: string }).heading?.startsWith("We Are Proud"))}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
