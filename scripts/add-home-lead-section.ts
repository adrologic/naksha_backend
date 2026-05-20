/**
 * One-shot, idempotent script.
 *
 * Inserts (or replaces) the "best construction company in jaipur" lead
 * section on the home page. The home page is block-based, so we patch
 * page.blocks JSON rather than re-seeding the page.
 *
 *   cd backend && npx tsx scripts/add-home-lead-section.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const HEADING = "best construction company in jaipur";
const P1 =
  "At Naksha Construction, we bring your vision to life with expert building and remodeling services in Jaipur. Whether you&rsquo;re planning a new residential property or a commercial space, our experienced team ensures top-quality craftsmanship and timely project delivery.";
const P2 =
  "We specialize in a wide range of services including residential and commercial construction, remodeling, and professional house painting. Our client-first approach guarantees a seamless experience from designs and drawings to the finishing touches. If you are looking for best construction company in Jaipur then partner with Naksha Construction to build the home or office you&rsquo;ve always dreamed of&mdash;reliable, professional, and locally trusted.";
const BODY_HTML = `<p>${P1}</p><p>${P2}</p>`;

// Plain-text fingerprint used to detect an existing lead section we
// should replace (covers the previous intro block AND a re-run of this
// script).
const BODY_FINGERPRINT_START = "At Naksha Construction, we bring your vision";

const DEFAULT_IMAGE_URL =
  "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/civil/civil-work-construction.jpg";
const IMAGE_ALT = "Residential home built by Naksha Construction in Jaipur";

type Block = Record<string, unknown> & { type: string };

function siteRendererHasTwoColumn(): boolean {
  const path = resolve(
    process.cwd(),
    "..",
    "naksha-construction-site",
    "components",
    "blocks",
    "BlockRenderer.tsx",
  );
  try {
    const src = readFileSync(path, "utf8");
    return /case\s+["']twoColumn["']\s*:/.test(src);
  } catch {
    return false;
  }
}

async function findResidentialImage(): Promise<string> {
  const hit = await prisma.mediaAsset.findFirst({
    where: { publicId: { contains: "residential", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  return hit?.secureUrl ?? DEFAULT_IMAGE_URL;
}

function buildTwoColumn(imageUrl: string): Block {
  return {
    type: "twoColumn",
    eyebrow: "",
    heading: HEADING,
    body: BODY_HTML,
    image: { url: imageUrl, alt: IMAGE_ALT },
    imagePosition: "right",
    background: "paper",
  };
}

function buildFallback(imageUrl: string): Block[] {
  return [
    {
      type: "intro",
      heading: HEADING,
      body: BODY_HTML,
    },
    {
      type: "gallery",
      heading: "",
      intro: "",
      columns: 2,
      images: [{ url: imageUrl, alt: IMAGE_ALT }],
    },
  ];
}

function isOurLead(block: Block): boolean {
  if (typeof block.heading === "string" && block.heading.trim().toLowerCase() === HEADING) {
    return true;
  }
  const body = typeof block.body === "string" ? block.body : "";
  // Body may be HTML or plain text; strip a leading <p> and check.
  const plain = body.replace(/^<p[^>]*>/i, "").trimStart();
  return plain.startsWith(BODY_FINGERPRINT_START);
}

function summarize(blocks: Block[]): void {
  console.log("\nResulting blocks:");
  blocks.forEach((b, i) => {
    const label =
      (typeof b.heading === "string" && b.heading) ||
      (typeof (b as { title?: unknown }).title === "string" && (b as { title: string }).title) ||
      (typeof (b as { text?: unknown }).text === "string" && (b as { text: string }).text) ||
      "";
    const short = label.replace(/<[^>]+>/g, "").slice(0, 60);
    console.log(`  [${i}] ${b.type}${short ? ` — ${short}` : ""}`);
  });
}

async function main() {
  const page = await prisma.page.findUnique({ where: { key: "home" } });
  if (!page) {
    console.error("✘ No Page with key='home' found. Aborting.");
    process.exit(1);
  }

  const current: Block[] = Array.isArray(page.blocks) ? (page.blocks as Block[]) : [];
  const useTwoColumn = siteRendererHasTwoColumn();
  const imageUrl = await findResidentialImage();

  console.log(`Renderer supports twoColumn: ${useTwoColumn}`);
  console.log(`Image: ${imageUrl}`);

  const newPayload: Block[] = useTwoColumn
    ? [buildTwoColumn(imageUrl)]
    : buildFallback(imageUrl);

  // Find first existing block that matches our fingerprint.
  const existingIdx = current.findIndex(isOurLead);

  let next: Block[];
  if (existingIdx >= 0) {
    // Replace in place. Keep neighbours intact.
    // If we previously inserted the fallback pair, the second block
    // (the gallery) is recognised only via its image URL — clean it
    // up too so we don't end up with an orphan gallery.
    const after = current.slice(existingIdx + 1);
    const trailingGalleryAt =
      after.length > 0 &&
      typeof (after[0] as Block).type === "string" &&
      (after[0] as Block).type === "gallery" &&
      JSON.stringify(after[0]).includes("Residential home built by Naksha Construction")
        ? 1
        : 0;
    next = [
      ...current.slice(0, existingIdx),
      ...newPayload,
      ...current.slice(existingIdx + 1 + trailingGalleryAt),
    ];
    console.log(`Replaced existing lead at index ${existingIdx}.`);
  } else {
    // Insert at index 1 (immediately after the hero at 0).
    next = [...current.slice(0, 1), ...newPayload, ...current.slice(1)];
    console.log("Inserted new lead at index 1.");
  }

  await prisma.page.update({
    where: { key: "home" },
    data: { blocks: next as unknown as Prisma.InputJsonValue },
  });

  summarize(next);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
