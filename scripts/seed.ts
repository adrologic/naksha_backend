/**
 * Seed script — populates the DB with all current site content so the admin
 * panel opens pre-filled. Idempotent: re-running upserts everything.
 *
 *   npm run seed                    # uploads placeholder images to Cloudinary
 *   npm run seed:no-uploads         # keeps original URLs (skip Cloudinary)
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const SKIP_UPLOADS = process.env.SEED_SKIP_UPLOADS === "1";

const LOREM = {
  short: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer fermentum nibh.",
  medium:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer fermentum nibh ut enim suscipit, in pulvinar lectus tincidunt. Mauris a porta lacus, vitae pharetra ipsum. Phasellus auctor lacus a metus convallis, in pretium urna ultrices.",
  long: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer fermentum nibh ut enim suscipit, in pulvinar lectus tincidunt. Mauris a porta lacus, vitae pharetra ipsum. Phasellus auctor lacus a metus convallis, in pretium urna ultrices. Etiam quis purus eget tortor pulvinar imperdiet.",
  paragraphs: [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer fermentum nibh ut enim suscipit, in pulvinar lectus tincidunt. Mauris a porta lacus.",
    "Phasellus auctor lacus a metus convallis, in pretium urna ultrices. Etiam quis purus eget tortor pulvinar imperdiet. Sed accumsan, sapien at faucibus dictum.",
  ],
};

const picsum = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

// ─────────────────────────────────────────────────────────────────────────────
// Image upload helper
// ─────────────────────────────────────────────────────────────────────────────
async function pushImage(remoteUrl: string, publicId: string, tags: string[] = []): Promise<string> {
  if (SKIP_UPLOADS) return remoteUrl;
  const existing = await prisma.mediaAsset.findUnique({ where: { publicId } });
  if (existing) return existing.secureUrl;
  try {
    const r = await cloudinary.uploader.upload(remoteUrl, {
      public_id: publicId,
      overwrite: false,
      tags,
      resource_type: "image",
    });
    await prisma.mediaAsset.upsert({
      where: { publicId: r.public_id },
      update: {
        url: r.url,
        secureUrl: r.secure_url,
        format: r.format ?? null,
        width: r.width ?? null,
        height: r.height ?? null,
        bytes: r.bytes ?? null,
        tags,
      },
      create: {
        publicId: r.public_id,
        url: r.url,
        secureUrl: r.secure_url,
        format: r.format ?? null,
        width: r.width ?? null,
        height: r.height ?? null,
        bytes: r.bytes ?? null,
        tags,
        folder: r.folder ?? null,
      },
    });
    return r.secure_url;
  } catch (e) {
    console.warn(`  ! Cloudinary upload failed for ${publicId}, falling back to remote URL: ${(e as Error).message}`);
    return remoteUrl;
  }
}

// Run async tasks with a concurrency cap so we don't hammer Cloudinary.
async function pmap<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source data (mirrors naksha-construction-site/lib/data.ts)
// ─────────────────────────────────────────────────────────────────────────────
const RAJASTHAN_CITIES = [
  "Jaipur", "Udaipur", "Jodhpur", "Ajmer", "Bikaner", "Kota",
  "Alwar", "Bhilwara", "Sikar", "Mount Abu", "Pushkar", "Chittorgarh",
];

const MARKETS = [
  { slug: "aviation", title: "Aviation", short: "Terminals, hangars, and airside facilities engineered for round-the-clock operations.", capabilities: ["Terminal expansions and renovations", "Cargo and maintenance hangars", "Air traffic and control facilities", "Airside support infrastructure"] },
  { slug: "commercial", title: "Commercial", short: "Office towers, mixed-use developments, and retail destinations across Rajasthan.", capabilities: ["Grade A office buildings", "Mixed-use developments", "Retail and hospitality interiors", "Tenant fit-outs and core-and-shell"] },
  { slug: "education", title: "Education", short: "Schools, universities, and research campuses built around how people actually learn.", capabilities: ["K-12 academic buildings", "University libraries and labs", "Research and innovation centers", "Student housing and recreation"] },
  { slug: "healthcare", title: "Healthcare", short: "Hospitals, diagnostic centers, and specialty clinics held to clinical-grade tolerances.", capabilities: ["Acute-care hospital additions", "Operating theaters and ICUs", "Outpatient and diagnostic centers", "Medical office and research wings"] },
  { slug: "pharmaceutical", title: "Pharmaceutical", short: "GMP manufacturing, R&D labs, and cleanroom environments held to regulatory standards.", capabilities: ["GMP manufacturing facilities", "Cleanroom and lab fit-outs", "Process utility infrastructure", "Validation and commissioning support"] },
  { slug: "sports", title: "Sports", short: "Stadiums, training facilities, and recreational venues for athletes and fans alike.", capabilities: ["Stadium and arena construction", "Training and performance centers", "Aquatic and indoor facilities", "Spectator and broadcast infrastructure"] },
  { slug: "government", title: "Government", short: "Civic, judicial, and infrastructure projects delivered to public-sector standards.", capabilities: ["Civic centers and administrative buildings", "Judicial and correctional facilities", "Transportation infrastructure", "Public realm and streetscape works"] },
  { slug: "data-centers", title: "Data Centers", short: "Mission-critical hyperscale and colocation facilities for the digital economy.", capabilities: ["Hyperscale data center cores", "Colocation fit-outs", "Power and cooling infrastructure", "Network and meet-me rooms"] },
];

const SERVICES = [
  { slug: "construction-management", title: "Construction Management", short: "End-to-end management of complex builds, from groundbreaking to handover.", outcomes: ["Single point of accountability through delivery", "Integrated cost and schedule controls", "Transparent reporting cadence with the owner", "Risk-managed trade coordination"] },
  { slug: "general-contracting", title: "General Contracting", short: "Lump-sum or GMP delivery with the trade depth Rajasthan projects demand.", outcomes: ["Competitive, scope-tight bids", "Self-perform capability on key trades", "Schedule and budget certainty", "Quality control across every package"] },
  { slug: "design-build", title: "Design-Build", short: "One contract, one team, one accountable outcome — design and construction integrated.", outcomes: ["Earlier price certainty", "Faster delivery via overlap", "Single source of design and build risk", "Tighter feedback between trades and design"] },
  { slug: "preconstruction", title: "Preconstruction", short: "Estimating, scheduling, and constructability work before a shovel hits the ground.", outcomes: ["Reliable conceptual estimates", "Constructability and value engineering", "Detailed CPM schedule modeling", "Procurement and long-lead planning"] },
  { slug: "special-projects", title: "Special Projects", short: "Fit-outs, renovations, and fast-track work where speed and surgical precision matter.", outcomes: ["Fast-track scheduling", "Minimal disruption to occupied spaces", "Phased delivery options", "Specialty trade coordination"] },
];

const PROJECT_TITLES: { title: string; category: string }[] = [
  { title: "Aravalli Tech Park", category: "Commercial" },
  { title: "Sundar Marg Civic Center", category: "Government" },
  { title: "Chand Mahal Hospital Wing", category: "Healthcare" },
  { title: "Pink City International School", category: "Education" },
  { title: "Marwar Hyperscale Campus", category: "Data Centers" },
  { title: "Thar Sports Arena", category: "Sports" },
  { title: "Dhola Bio-Pharma Facility", category: "Pharmaceutical" },
  { title: "Vidhya Nagar University Library", category: "Education" },
  { title: "Sambhar Aviation Hangar", category: "Aviation" },
  { title: "Ranthambore Retail Quarter", category: "Commercial" },
  { title: "Jal Mahal Wellness Center", category: "Healthcare" },
  { title: "Nathdwara Government Complex", category: "Government" },
];

const LEADERS = [
  { name: "Aarav Sharma", role: "Managing Director" },
  { name: "Diya Mehta", role: "Chief Operating Officer" },
  { name: "Vihaan Khandelwal", role: "Director of Preconstruction" },
  { name: "Anaya Rathore", role: "Head of Design-Build" },
  { name: "Reyansh Agarwal", role: "Director of Field Operations" },
  { name: "Kavya Bansal", role: "Head of Sustainability" },
  { name: "Arjun Choudhary", role: "Director of Healthcare Markets" },
  { name: "Saanvi Joshi", role: "Head of People & Culture" },
];

const ARTICLE_TITLES = [
  { t: "Why Modular Builds Are Reshaping Rajasthan", c: "Innovation" },
  { t: "Five Sustainability Wins From Our Last Twelve Months", c: "Sustainability" },
  { t: "What Owners Should Ask in a Preconstruction Kickoff", c: "Insight" },
  { t: "Lessons From Delivering a Hospital in Eighteen Months", c: "Healthcare" },
  { t: "Heat-Resilient Materials for the Thar Climate", c: "Materials" },
  { t: "How We Train First-Year Engineers at Naksha", c: "Careers" },
  { t: "Designing Education Spaces for the Next Decade", c: "Education" },
  { t: "Risk Modeling in Mid-Sized Construction", c: "Operations" },
];

const JOB_TITLES = [
  { t: "Senior Project Manager", d: "Operations" },
  { t: "Site Safety Officer", d: "Operations" },
  { t: "Estimator (Preconstruction)", d: "Preconstruction" },
  { t: "MEP Coordinator", d: "Engineering" },
  { t: "Quantity Surveyor", d: "Commercial" },
  { t: "Sustainability Lead", d: "Sustainability" },
  { t: "Junior Architect (Design-Build)", d: "Design" },
  { t: "Apprentice Carpenter", d: "Trades" },
];

const LOCATIONS = [
  { slug: "jaipur", city: "Jaipur (HQ)", address: ["Plot 12, Civil Lines", "Jaipur, Rajasthan 302006"], phone: "+91 98765 43210", email: "jaipur@nakshaconstruction.example" },
  { slug: "udaipur", city: "Udaipur", address: ["28 Lake View Marg", "Udaipur, Rajasthan 313001"], phone: "+91 98765 43211", email: "udaipur@nakshaconstruction.example" },
  { slug: "jodhpur", city: "Jodhpur", address: ["6 Industrial Estate, Phase II", "Jodhpur, Rajasthan 342003"], phone: "+91 98765 43212", email: "jodhpur@nakshaconstruction.example" },
  { slug: "kota", city: "Kota", address: ["44 Talwandi Sector", "Kota, Rajasthan 324005"], phone: "+91 98765 43213", email: "kota@nakshaconstruction.example" },
  { slug: "bikaner", city: "Bikaner", address: ["19 Rani Bazaar Road", "Bikaner, Rajasthan 334001"], phone: "+91 98765 43214", email: "bikaner@nakshaconstruction.example" },
  { slug: "ajmer", city: "Ajmer", address: ["Beawar Road, MIA", "Ajmer, Rajasthan 305002"], phone: "+91 98765 43215", email: "ajmer@nakshaconstruction.example" },
];

const TESTIMONIALS = [
  { quote: LOREM.medium, author: "Placeholder Client A", role: "Director of Facilities" },
  { quote: LOREM.medium, author: "Placeholder Client B", role: "Vice President, Real Estate" },
  { quote: LOREM.medium, author: "Placeholder Client C", role: "Chief Operating Officer" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seeders
// ─────────────────────────────────────────────────────────────────────────────
async function seedMarkets() {
  console.log("→ Markets");
  await pmap(MARKETS, 4, async (m, i) => {
    const image = await pushImage(picsum(`market-${m.slug}`, 1600, 1000), `naksha/markets/${m.slug}`, ["market"]);
    await prisma.market.upsert({
      where: { slug: m.slug },
      update: { title: m.title, summary: m.short, image, body: LOREM.long, sortOrder: i },
      create: { slug: m.slug, title: m.title, summary: m.short, image, body: LOREM.long, sortOrder: i },
    });
  });
}

async function seedServices() {
  console.log("→ Services");
  await pmap(SERVICES, 4, async (s, i) => {
    const image = await pushImage(picsum(`service-${s.slug}`, 1600, 1000), `naksha/services/${s.slug}`, ["service"]);
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        title: s.title,
        summary: s.short,
        body: LOREM.long,
        bullets: s.outcomes as Prisma.InputJsonValue,
        icon: image,
        sortOrder: i,
      },
      create: {
        slug: s.slug,
        title: s.title,
        summary: s.short,
        body: LOREM.long,
        bullets: s.outcomes as Prisma.InputJsonValue,
        icon: image,
        sortOrder: i,
      },
    });
  });
}

async function seedProjects() {
  console.log("→ Projects");
  await pmap(PROJECT_TITLES, 3, async (p, i) => {
    const slug = p.title.toLowerCase().replace(/\s+/g, "-");
    const cover = await pushImage(picsum(`project-${i}-cover`, 1600, 1000), `naksha/projects/${slug}/cover`, ["project"]);
    const galleryUrls = await Promise.all(
      [1, 2, 3, 4].map(async (g) =>
        pushImage(picsum(`project-${i}-g${g}`, 1400, 900), `naksha/projects/${slug}/g${g}`, ["project", "gallery"]),
      ),
    );
    const city = RAJASTHAN_CITIES[i % RAJASTHAN_CITIES.length];
    const data = {
      title: p.title,
      market: p.category,
      location: `${city}, Rajasthan`,
      year: 2024 - (i % 6),
      client: `Confidential Client ${String.fromCharCode(65 + i)}`,
      size: `${(80 + i * 23).toLocaleString()},000 sq ft`,
      duration: `${18 + (i % 18)} months`,
      summary: LOREM.medium,
      description: LOREM.long,
      coverImage: cover,
      gallery: galleryUrls.map((url) => ({ url, alt: p.title })) as unknown as Prisma.InputJsonValue,
      highlights: [
        "Delivered ahead of schedule",
        "Zero lost-time incidents",
        "Under-budget close-out",
        "Sustained client partnership",
      ] as Prisma.InputJsonValue,
      sortOrder: i,
    };
    await prisma.project.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  });
}

async function seedLeaders() {
  console.log("→ Leaders");
  await pmap(LEADERS, 4, async (l, i) => {
    const slug = l.name.toLowerCase().replace(/\s+/g, "-");
    const portrait = await pushImage(picsum(`leader-${i}`, 800, 800), `naksha/leaders/${slug}`, ["leader"]);
    await prisma.leader.upsert({
      where: { slug },
      update: { name: l.name, role: l.role, bio: LOREM.medium, portrait, sortOrder: i },
      create: { slug, name: l.name, role: l.role, bio: LOREM.medium, portrait, sortOrder: i },
    });
  });
}

async function seedArticles() {
  console.log("→ Articles");
  await pmap(ARTICLE_TITLES, 3, async (a, i) => {
    const slug = a.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const cover = await pushImage(picsum(`article-${i}`, 1600, 1000), `naksha/articles/${slug}`, ["article"]);
    const author = LEADERS[i % LEADERS.length].name;
    const publishedAt = new Date(2025, 11 - i, 5 + i);
    await prisma.article.upsert({
      where: { slug },
      update: {
        title: a.t,
        category: a.c,
        author,
        publishedAt,
        excerpt: LOREM.medium,
        body: [...LOREM.paragraphs, ...LOREM.paragraphs].join("\n\n"),
        cover,
        sortOrder: i,
      },
      create: {
        slug,
        title: a.t,
        category: a.c,
        author,
        publishedAt,
        excerpt: LOREM.medium,
        body: [...LOREM.paragraphs, ...LOREM.paragraphs].join("\n\n"),
        cover,
        sortOrder: i,
      },
    });
  });
}

async function seedJobs() {
  console.log("→ Jobs");
  for (let i = 0; i < JOB_TITLES.length; i++) {
    const j = JOB_TITLES[i];
    const slug = j.t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const type = i === 7 ? "Apprenticeship" : i === 4 ? "Contract" : "Full-time";
    const data = {
      title: j.t,
      department: j.d,
      location: RAJASTHAN_CITIES[i % RAJASTHAN_CITIES.length] + ", India",
      type,
      summary: LOREM.medium,
      responsibilities: [
        "Quality-first delivery rooted in 11 years of regional expertise",
        "Integrated preconstruction and value-engineering workflows",
        "Sustainable material sourcing across every project tier",
      ] as Prisma.InputJsonValue,
      requirements: [
        "5+ years delivering construction projects in Rajasthan",
        "Strong client and stakeholder management",
        "Hands-on with cost and schedule controls",
      ] as Prisma.InputJsonValue,
      benefits: [
        "Comprehensive medical and dental cover",
        "Annual professional development budget",
        "Hybrid working where the role allows",
        "Performance-linked annual bonus",
        "Family leave above statutory minimums",
      ] as Prisma.InputJsonValue,
      sortOrder: i,
    };
    await prisma.job.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  }
}

async function seedLocations() {
  console.log("→ Locations");
  await pmap(LOCATIONS, 4, async (l, i) => {
    const image = await pushImage(picsum(`loc-${l.slug}`, 1200, 800), `naksha/locations/${l.slug}`, ["location"]);
    await prisma.location.upsert({
      where: { slug: l.slug },
      update: {
        city: l.city,
        address: l.address as Prisma.InputJsonValue,
        phone: l.phone,
        email: l.email,
        image,
        sortOrder: i,
      },
      create: {
        slug: l.slug,
        city: l.city,
        address: l.address as Prisma.InputJsonValue,
        phone: l.phone,
        email: l.email,
        image,
        sortOrder: i,
      },
    });
  });
}

async function seedTestimonials() {
  console.log("→ Testimonials");
  for (let i = 0; i < TESTIMONIALS.length; i++) {
    const t = TESTIMONIALS[i];
    const existing = await prisma.testimonial.findFirst({ where: { author: t.author } });
    if (existing) {
      await prisma.testimonial.update({
        where: { id: existing.id },
        data: { quote: t.quote, role: t.role, sortOrder: i },
      });
    } else {
      await prisma.testimonial.create({
        data: { author: t.author, quote: t.quote, role: t.role, sortOrder: i },
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pages — block-based starter content for every route
// ─────────────────────────────────────────────────────────────────────────────
async function seedPages() {
  console.log("→ Pages");
  const tagline = "Building Rajasthan, brick by considered brick.";
  const heroImage = await pushImage(
    "https://picsum.photos/seed/naksha-hero/1920/1080",
    "naksha/pages/home-hero",
    ["page", "hero"],
  );

  const pages: Array<{
    key: string;
    path: string;
    title: string;
    blocks: unknown[];
    seoTitle?: string;
    seoDescription?: string;
  }> = [
    {
      key: "home",
      path: "/",
      title: "Home",
      seoTitle: "Naksha Construction",
      seoDescription: tagline,
      blocks: [
        { type: "hero", title: "Naksha Construction", subtitle: tagline, ctaLabel: "Start a project", ctaHref: "/contact", image: heroImage },
        { type: "stats", items: [
          { value: "11+", label: "Years of practice" },
          { value: "50+", label: "People across the studio" },
          { value: "120", label: "Projects delivered" },
          { value: "6M", label: "Sq. ft. built" },
        ]},
        { type: "intro", heading: "What we do", body: LOREM.long },
        { type: "marketsGrid", source: "markets" },
        { type: "projectsFeatured", source: "projects", limit: 6 },
        { type: "testimonials", source: "testimonials" },
        { type: "cta", heading: "Tell us what you're planning.", ctaLabel: "Contact us", ctaHref: "/contact" },
      ],
    },
    {
      key: "about",
      path: "/about",
      title: "About",
      seoTitle: "About — Naksha Construction",
      seoDescription: "Eleven years, fifty-strong, hundreds of buildings.",
      blocks: [
        { type: "hero", title: "Eleven years. Hundreds of buildings.", subtitle: "Who we are and how we work." },
        { type: "intro", heading: "Our practice", body: LOREM.long },
        { type: "leadership", source: "leaders" },
        { type: "timeline", items: [
          { year: "2014", title: "Naksha founded", body: LOREM.short },
          { year: "2016", title: "First commercial milestone", body: LOREM.short },
          { year: "2018", title: "Healthcare practice launched", body: LOREM.short },
          { year: "2020", title: "Sustainability framework introduced", body: LOREM.short },
          { year: "2022", title: "Expanded to four cities", body: LOREM.short },
          { year: "2024", title: "Crossed 100 projects delivered", body: LOREM.short },
        ]},
      ],
    },
    {
      key: "services-index",
      path: "/services",
      title: "Services",
      blocks: [
        { type: "hero", title: "Services", subtitle: "How we deliver." },
        { type: "servicesGrid", source: "services" },
      ],
    },
    {
      key: "markets-index",
      path: "/markets",
      title: "Markets",
      blocks: [
        { type: "hero", title: "Markets", subtitle: "The sectors we build for." },
        { type: "marketsGrid", source: "markets" },
      ],
    },
    {
      key: "projects-index",
      path: "/projects",
      title: "Projects",
      blocks: [
        { type: "hero", title: "Projects", subtitle: "Selected work across Rajasthan." },
        { type: "projectsGrid", source: "projects" },
      ],
    },
    {
      key: "insights-index",
      path: "/insights",
      title: "Insights",
      blocks: [
        { type: "hero", title: "Insights", subtitle: "Field notes and frameworks." },
        { type: "articlesGrid", source: "articles" },
      ],
    },
    {
      key: "careers-index",
      path: "/careers",
      title: "Careers",
      blocks: [
        { type: "hero", title: "Careers", subtitle: "Build with people who care." },
        { type: "intro", heading: "Why Naksha", body: LOREM.long },
        { type: "openRoles", source: "jobs" },
      ],
    },
    {
      key: "careers-openings",
      path: "/careers/openings",
      title: "Open roles",
      blocks: [
        { type: "hero", title: "Roles we're hiring for.", subtitle: LOREM.medium },
        { type: "openRoles", source: "jobs", filterable: true },
      ],
    },
    {
      key: "locations-index",
      path: "/locations",
      title: "Locations",
      blocks: [
        { type: "hero", title: "Locations", subtitle: "Where we work from." },
        { type: "locationsGrid", source: "locations" },
      ],
    },
    {
      key: "sustainability",
      path: "/sustainability",
      title: "Sustainability",
      blocks: [
        { type: "hero", title: "Sustainability", subtitle: "Our commitments — material, energy, water, community, safety." },
        { type: "commitments", items: [
          { key: "materials", title: "Sustainable Materials", body: LOREM.long },
          { key: "energy", title: "Energy & Carbon", body: LOREM.long },
          { key: "water", title: "Water Stewardship", body: LOREM.long },
          { key: "community", title: "Community & Skills", body: LOREM.long },
          { key: "safety", title: "Health & Safety", body: LOREM.long },
        ]},
      ],
    },
    {
      key: "contact",
      path: "/contact",
      title: "Contact",
      blocks: [
        { type: "hero", title: "Tell us what you're planning.", subtitle: "We'll come back within two business days." },
        { type: "contactForm" },
        { type: "locationsGrid", source: "locations", compact: true },
      ],
    },
    {
      key: "legal-privacy",
      path: "/legal/privacy",
      title: "Privacy",
      blocks: [
        { type: "hero", title: "Privacy", subtitle: "How we handle data." },
        { type: "longform", body: LOREM.long },
      ],
    },
    {
      key: "legal-terms",
      path: "/legal/terms",
      title: "Terms",
      blocks: [
        { type: "hero", title: "Terms", subtitle: "Site usage." },
        { type: "longform", body: LOREM.long },
      ],
    },
  ];

  for (const p of pages) {
    await prisma.page.upsert({
      where: { key: p.key },
      update: {
        path: p.path,
        title: p.title,
        blocks: p.blocks as Prisma.InputJsonValue,
        seoTitle: p.seoTitle ?? null,
        seoDescription: p.seoDescription ?? null,
      },
      create: {
        key: p.key,
        path: p.path,
        title: p.title,
        blocks: p.blocks as Prisma.InputJsonValue,
        seoTitle: p.seoTitle ?? null,
        seoDescription: p.seoDescription ?? null,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Globals — navbar, footer, siteSettings
// ─────────────────────────────────────────────────────────────────────────────
async function seedGlobals() {
  console.log("→ Globals");

  const navbar = {
    cta: { label: "Start a project", href: "/contact" },
    items: [
      {
        label: "About",
        href: "/about",
        children: [
          { label: "Who We Are", href: "/about" },
          { label: "Leadership", href: "/about#leadership" },
          { label: "Our Story", href: "/about#history" },
          { label: "Locations", href: "/locations" },
          { label: "Sustainability", href: "/sustainability" },
        ],
      },
      {
        label: "Markets",
        href: "/markets",
        children: MARKETS.map((m) => ({ label: m.title, href: `/markets/${m.slug}` })),
      },
      {
        label: "Services",
        href: "/services",
        children: SERVICES.map((s) => ({ label: s.title, href: `/services/${s.slug}` })),
      },
      { label: "Projects", href: "/projects" },
      { label: "Insights", href: "/insights" },
      {
        label: "Careers",
        href: "/careers",
        children: [
          { label: "Why Naksha", href: "/careers/why-naksha" },
          { label: "Open Roles", href: "/careers/openings" },
        ],
      },
    ],
  };

  const footer = {
    callout: {
      heading: "Build with us.",
      body: "Tell us what you're planning — we'll come back within two business days with the right team to talk to.",
      ctaLabel: "Start a Project",
      ctaHref: "/contact",
    },
    columns: [
      {
        heading: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Leadership", href: "/about#leadership" },
          { label: "Markets", href: "/markets" },
          { label: "Sustainability", href: "/sustainability" },
          { label: "Locations", href: "/locations" },
        ],
      },
      {
        heading: "Services",
        links: SERVICES.slice(0, 4)
          .map((s) => ({ label: s.title, href: `/services/${s.slug}` }))
          .concat([{ label: "Insights", href: "/insights" }]),
      },
      {
        heading: "Careers",
        links: [
          { label: "Why Naksha", href: "/careers/why-naksha" },
          { label: "Open Roles", href: "/careers/openings" },
          { label: "Contact", href: "/contact" },
          { label: "Press", href: "/contact" },
        ],
      },
    ],
    bottom: {
      copyright: "© {{year}} Naksha Construction. All rights reserved.",
      links: [
        { label: "Privacy", href: "/legal/privacy" },
        { label: "Terms", href: "/legal/terms" },
        { label: "Sitemap", href: "/sitemap.xml" },
      ],
    },
  };

  const siteSettings = {
    name: "Naksha Construction",
    shortName: "Naksha",
    wordmark: "NAKSHA",
    tagline: "Building Rajasthan, brick by considered brick.",
    founded: 2014,
    yearsExperience: 11,
    teamSize: "50+",
    url: "https://nakshaconstruction.example",
    email: "hello@nakshaconstruction.example",
    phone: "+91 98765 43210",
    address: { line1: "Plot 12, Civil Lines", line2: "Jaipur, Rajasthan 302006", country: "India" },
    social: { linkedin: "#", instagram: "#", facebook: "#", youtube: "#" },
    heroPosterImage: "https://picsum.photos/seed/naksha-hero/1920/1080",
  };

  for (const [key, value] of Object.entries({ navbar, footer, siteSettings })) {
    await prisma.global.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(SKIP_UPLOADS ? "(SEED_SKIP_UPLOADS=1 — keeping remote URLs)" : "Uploading placeholder images to Cloudinary…");
  await seedMarkets();
  await seedServices();
  await seedProjects();
  await seedLeaders();
  await seedArticles();
  await seedJobs();
  await seedLocations();
  await seedTestimonials();
  await seedPages();
  await seedGlobals();
  console.log("✔ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
