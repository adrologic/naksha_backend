/**
 * One-shot, idempotent script.
 *
 * Appends (or replaces in place) the Our Services / Work Process /
 * Our Projects / Why Naksha sections on the home page using only
 * existing block types: commitments, intro, projectsGrid, longform.
 *
 *   cd backend && npx tsx scripts/add-home-remaining-sections.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Block = Record<string, unknown> & { type: string };

const SERVICES_HEADING = "Our Services";
const SERVICES_INTRO =
  "We are the leading commercial & residential home construction in jaipur that are always on the mission of serving customers with innovative approaches.";

const SERVICE_CARDS: { title: string; body: string; image: string; imageAlt: string }[] = [
  {
    title: "Architectural Design & Planning",
    body: "We stand tall as a best construction company in Jaipur. We create clear and practical drawings for smooth construction work.",
    image:
      "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/architectural/design-drawings-1.jpg",
    imageAlt: "Architectural design and planning by Naksha Construction",
  },
  {
    title: "Civil Work Service",
    body: "Our team of professional civil contractors in Jaipur is always ready to work on your commercial projects. Now, stay connected with us!",
    image:
      "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/civil/civil-work-construction.jpg",
    imageAlt: "Civil work service by Naksha Construction",
  },
  {
    title: "Interior Designing",
    body: "practical interior designing solutions along with finishing work that improves usability and modern appearance of residential and commercial spaces.",
    image:
      "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/interior/interior-work-1.jpg",
    imageAlt: "Interior designing by Naksha Construction",
  },
  {
    title: "Painting & Finishing",
    body: "We provide high quality interior and exterior painting solutions for long-lasting protection and aesthetic appeal.",
    image:
      "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/painting/paint-work.jpg",
    imageAlt: "Painting and finishing by Naksha Construction",
  },
];

const WORK_PROCESS_BODY =
  "<h2>We Are Proud To Be Your Choice!</h2>" +
  "<p>Naksha Construction stands tall among reputed <strong>residential &amp; commercial building construction</strong> companies in Jaipur with quality construction material. When you discuss your needs with us, we try to cover all the aspects that should be included in your planning.</p>" +
  "<p>From <strong>construction to remodeling</strong>, we cover everything that you need to escalate the look and feel of the property. We believe in instantly changing the vibes of the property and ensuring you meet your purposes in a seamless way. We use the best approaches to ensure that high-quality construction is done. We are committed to providing world-class jobs and completing all the projects on time. We can also bet that you will get unmatched <strong>construction services</strong> here. Furthermore, we are available to assist you round the clock. Now, feel free to connect with us for the best designs for your house, flats and offices.</p>";

const WORK_PROCESS_STEPS = [
  "Consult with Customers",
  "Customers Requirements",
  "Design",
  "Implement",
];

const WHY_BODY =
  "<h2>Why Naksha Construction Is A Leading Construction Company In Jaipur</h2>" +
  "<ul>" +
  "<li>Keep 100% transparency of charges and don&rsquo;t take any hidden charges.</li>" +
  "<li>Having more than 10+years of experience &amp; we have a team of 50+ experts.</li>" +
  "<li>Provide you <strong>professional construction services in Jaipur</strong> for residential &amp; commercial properties such as flats, offices, homes, and buildings.</li>" +
  "<li>Our construction team is highly skilled, experienced, well-mannered, and behaves nicely with all clients</li>" +
  "<li>Do work accordingly to what clients exactly want from us.</li>" +
  "<li>Convert your premises into a place of pride and serve a comprehensive range of services such as construction, interior, civil, paintwork, <strong>architect design</strong>, and structural drawings.</li>" +
  "<li>Never do raw work because we also want excellence and more perfection in our work, so we work with hearts.</li>" +
  "<li>Plan to do work before starting any projects, furthermore scheduling, constructing, and finishing.</li>" +
  "<li>In addition, when you want to avail of <strong>With material construction services</strong>, all the headache of material and labor is ours.</li>" +
  "<li>Complete projects at the right time and listen carefully to what clients say.</li>" +
  "<li>Our main objective is to develop your dream home where you can live happily and spend your time in a positive environment.</li>" +
  "</ul>";

const BLOCK_A: Block = {
  type: "commitments",
  heading: SERVICES_HEADING,
  intro: SERVICES_INTRO,
  items: SERVICE_CARDS.map((c) => ({
    title: c.title,
    body: c.body,
    image: c.image,
    imageAlt: c.imageAlt,
  })),
};

const BLOCK_B: Block = {
  type: "intro",
  heading: "WORK PROCESS",
  body: WORK_PROCESS_BODY,
};

const BLOCK_C: Block = {
  type: "commitments",
  heading: "",
  items: WORK_PROCESS_STEPS.map((title) => ({
    title,
    body: "",
    image: "",
    imageAlt: "",
  })),
};

const BLOCK_D: Block = {
  type: "projectsGrid",
  source: "projects",
  heading: "Our Projects",
  limit: 3,
};

const BLOCK_E: Block = {
  type: "longform",
  body: WHY_BODY,
};

type Matcher = { name: string; payload: Block; match: (b: Block) => boolean };

const TARGETS: Matcher[] = [
  {
    name: "BLOCK A — Our Services",
    payload: BLOCK_A,
    match: (b) =>
      b.type === "commitments" &&
      typeof b.heading === "string" &&
      b.heading.trim() === SERVICES_HEADING,
  },
  {
    name: "BLOCK B — Work Process intro",
    payload: BLOCK_B,
    match: (b) =>
      b.type === "intro" &&
      typeof b.body === "string" &&
      b.body.includes("We Are Proud To Be Your Choice"),
  },
  {
    name: "BLOCK C — Work Process steps",
    payload: BLOCK_C,
    match: (b) => {
      if (b.type !== "commitments") return false;
      const items = Array.isArray(b.items)
        ? (b.items as { title?: string }[])
        : [];
      return items.some((it) => typeof it.title === "string" && it.title === "Consult with Customers");
    },
  },
  {
    name: "BLOCK D — Our Projects",
    payload: BLOCK_D,
    match: (b) =>
      b.type === "projectsGrid" &&
      typeof b.heading === "string" &&
      b.heading.trim() === "Our Projects",
  },
  {
    name: "BLOCK E — Why Naksha",
    payload: BLOCK_E,
    match: (b) =>
      b.type === "longform" &&
      typeof b.body === "string" &&
      b.body.includes("Why Naksha Construction Is A Leading"),
  },
];

function shortLabel(b: Block): string {
  if (typeof b.heading === "string" && b.heading) return b.heading;
  if (typeof (b as { title?: unknown }).title === "string")
    return (b as { title: string }).title;
  const items = (b as { items?: unknown }).items;
  if (Array.isArray(items) && items.length > 0) {
    const first = items[0] as { title?: string };
    if (first && typeof first.title === "string" && first.title) return first.title;
  }
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

  const current: Block[] = Array.isArray(page.blocks) ? (page.blocks as Block[]) : [];
  let blocks = [...current];

  for (const t of TARGETS) {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
