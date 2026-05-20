/**
 * One-shot, idempotent script.
 *
 * Appends (or replaces in place) the "We help people make their dreams
 * come true!" video gallery + the closing paragraph + the WhatsApp CTA
 * on the home page.
 *
 *   cd backend && npx tsx scripts/add-home-video-section.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Block = Record<string, unknown> & { type: string };

const VIDEO_TITLES = [
  "Newly Constructed Home",
  "Trendy Interior Design Ideas | Affordable",
  "Latest Wall Painting Designs For Home",
];

const CHANNEL_URL = "https://www.youtube.com/@nakshaconstruction";
const CHANNEL_LINK_LABEL = "See more on YouTube";

const VIDEO_HEADING = "We help people make their dreams come true!";
const LONGFORM_BODY =
  "<p>Make hassle-free conversation with us related to services we provide and believe in giving a shape of conversation. We always remember and notice all the issues that affect your buildings, offices, or home. We always understand what kind of activity is beneficial and good for you. You can hand over your building or home <strong>interior work service</strong> as well as construction. We never delay in responding you, and the support team is active.</p>";
const CTA_HEADING =
  "Get a Free Consultation From The Best Construction Company in Jaipur";
const CTA_LABEL = "Let's Chat us";
const CTA_HREF = "https://wa.me/919828727701";

async function fetchYoutubeIdsFromWP(): Promise<string[]> {
  try {
    const res = await fetch("https://www.nakshaconstruction.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (naksha-seed)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const raw = await res.text();
    // Some WP block payloads ship JSON-escaped URLs (\/ instead of /) inside
    // attribute values. Normalise so the same regex catches both forms.
    const html = raw.replace(/\\\//g, "/");
    const matches = Array.from(
      html.matchAll(
        /youtube(?:-nocookie)?\.com\/(?:embed|shorts|watch\?v=)([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})/g,
      ),
    );
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const id = m[1] ?? m[2];
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

function buildVideoBlock(ids: string[]): Block {
  const videos = VIDEO_TITLES.map((title, i) => ({
    title,
    url: ids[i] ? `https://www.youtube.com/watch?v=${ids[i]}` : "",
  }));
  return {
    type: "videoGallery",
    heading: VIDEO_HEADING,
    intro: "",
    videos,
    channelUrl: CHANNEL_URL,
    channelLinkLabel: CHANNEL_LINK_LABEL,
  };
}

const LONGFORM_BLOCK: Block = {
  type: "longform",
  body: LONGFORM_BODY,
};

const CTA_BLOCK: Block = {
  type: "cta",
  heading: CTA_HEADING,
  sub: "",
  ctaLabel: CTA_LABEL,
  ctaHref: CTA_HREF,
};

type Matcher = {
  name: string;
  payload: Block;
  match: (b: Block) => boolean;
};

function shortLabel(b: Block): string {
  if (typeof b.heading === "string" && b.heading) return b.heading;
  if (typeof (b as { title?: unknown }).title === "string")
    return (b as { title: string }).title;
  if (typeof b.body === "string" && b.body) {
    return b.body.replace(/<[^>]+>/g, "").trim().slice(0, 60);
  }
  return "";
}

async function main() {
  const page = await prisma.page.findUnique({ where: { key: "home" } });
  if (!page) {
    console.error("✘ No Page with key='home'. Aborting.");
    process.exit(1);
  }

  const ids = await fetchYoutubeIdsFromWP();
  const usable = ids.slice(0, 3);
  console.log(`YouTube IDs extracted from WP: ${usable.length} (${usable.join(", ") || "none"})`);

  const videoBlock = buildVideoBlock(usable);

  const targets: Matcher[] = [
    {
      name: "videoGallery — We help people make their dreams come true",
      payload: videoBlock,
      match: (b) =>
        b.type === "videoGallery" &&
        typeof b.heading === "string" &&
        b.heading.startsWith("We help people make their dreams come true"),
    },
    {
      name: "longform — Make hassle-free conversation",
      payload: LONGFORM_BLOCK,
      match: (b) =>
        b.type === "longform" &&
        typeof b.body === "string" &&
        b.body.includes("Make hassle-free conversation with us"),
    },
    {
      name: "cta — Get a Free Consultation From The Best Construction Company",
      payload: CTA_BLOCK,
      match: (b) =>
        b.type === "cta" &&
        typeof b.heading === "string" &&
        b.heading.startsWith("Get a Free Consultation From The Best Construction Company"),
    },
  ];

  const current: Block[] = Array.isArray(page.blocks) ? (page.blocks as Block[]) : [];
  let blocks = [...current];

  for (const t of targets) {
    const idx = blocks.findIndex(t.match);
    if (idx >= 0) {
      blocks[idx] = t.payload;
      console.log(`✓ ${t.name} → replaced in place at index ${idx}`);
    } else {
      blocks.push(t.payload);
      console.log(`+ ${t.name} → appended at index ${blocks.length - 1}`);
    }
  }

  await prisma.page.update({
    where: { key: "home" },
    data: { blocks: blocks as unknown as Prisma.InputJsonValue },
  });

  console.log("\nResulting blocks:");
  blocks.forEach((b, i) => {
    const lbl = shortLabel(b);
    console.log(`  [${i}] ${b.type}${lbl ? ` — ${lbl.slice(0, 60)}` : ""}`);
  });

  const missingTitles = videoBlock.videos
    ? (videoBlock.videos as { url: string; title: string }[])
        .filter((v) => !v.url)
        .map((v) => v.title)
    : [];
  if (missingTitles.length > 0) {
    console.log(
      "\n⚠  WARNING: could not auto-extract YouTube URLs from the WP home page",
    );
    console.log(
      "    (lazy-loaded embeds hide the src until JS runs). The video block",
    );
    console.log("    was created with empty URLs for these titles:");
    for (const t of missingTitles) console.log(`      • ${t}`);
    console.log(
      `\n    Open the admin → Pages → Home → expand the Video gallery block`,
    );
    console.log(
      `    and paste the three URLs from ${CHANNEL_URL} into the URL field`,
    );
    console.log(`    of each row.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
