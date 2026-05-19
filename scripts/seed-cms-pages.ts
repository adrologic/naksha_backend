/**
 * One-shot seed: migrate the five legacy static React pages
 * (about + four /projects/<service> overviews) into the Page CMS so they
 * can be edited end-to-end from the admin.
 *
 * Idempotent: upserts each Page by `key`. Re-running is safe.
 *
 *   npx tsx scripts/seed-cms-pages.ts
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ── Image URLs already on Cloudinary (folder: naksha/services/...) ───────────
const IMG = {
  // Hero backdrops
  civilHero:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/c_fill,w_2000,h_900,g_auto,q_auto,f_auto/naksha/services/civil/civil-work-detail.jpg",
  interiorBanner:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/interior/page-banner.jpg",
  paintingHero:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/c_fill,w_2000,h_900,g_auto,q_auto,f_auto/naksha/services/painting/interior-wall-painting.jpg",
  aboutHero:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/c_fill,w_2000,h_900,g_auto,q_auto,f_auto/naksha/services/civil/civil-work-detail.jpg",

  // Architectural
  archDrawings1:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/architectural/design-drawings-1.jpg",
  archDrawings2:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/architectural/design-drawings-2.jpg",

  // Civil
  civilConstruction:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/civil/civil-work-construction.jpg",

  // Interior
  interiorWork1:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/interior/interior-work-1.jpg",
  modernHouseInterior:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/interior/modern-house-interior.jpg",
  homeInteriorDesign:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/our-work/home-interior-design.jpg",

  // Painting
  paintWork:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/painting/paint-work.jpg",
  paintingDetail:
    "https://res.cloudinary.com/dwmsbubv5/image/upload/q_auto,f_auto/naksha/services/painting/interior-wall-painting.jpg",
};

type PageBlock = Record<string, unknown> & { type: string };

type PageSeed = {
  key: string;
  path: string;
  title: string;
  blocks: PageBlock[];
  seoTitle?: string;
  seoDescription?: string;
};

// ── /about ───────────────────────────────────────────────────────────────────
const aboutPage: PageSeed = {
  key: "about",
  path: "/about",
  title: "About Us",
  seoTitle: "About Us | Naksha Construction",
  seoDescription:
    "Naksha Construction is a Jaipur-based construction and painting company with 10+ years of experience in residential and commercial projects.",
  blocks: [
    {
      type: "hero",
      title: "About Us",
      eyebrow: "",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "",
      image: IMG.aboutHero,
      imageAlt: "Construction site by Naksha Construction in Jaipur",
      size: "md",
      alignment: "center",
      overlayStrength: "heavy",
    },
    {
      type: "twoColumn",
      eyebrow: "ABOUT US",
      heading: "TRUSTED CONSTRUCTION COMPANY IN JAIPUR",
      body:
        '<p>Naksha Construction is a construction and painting services company based in Jaipur, Rajasthan, with 10+ years of industry experience. We specialize in residential and commercial construction, ' +
        '<a href="/projects/architectural-design-and-planning">Architectural design and planning</a>, ' +
        '<a href="/projects/interior-work-design">interior designing</a>, ' +
        "and professional painting services.</p>" +
        "<p>Our team of skilled civil engineers, contractors, and painters focuses on delivering projects with strong planning, quality workmanship, and timely completion. We aim to convert architectural drawings into well-executed real-world structures with attention to detail and cost efficiency.</p>" +
        "<p>We also provide home renovation and interior improvement solutions tailored to client requirements, ensuring practical design, durability, and functional living spaces.</p>" +
        "<p><strong>We have a team of 50+ experts</strong> who work on the latest, updated, and trending technology. The main objective of our company is to ensure that whatever is on the drawing sheet is completed successfully with the best quality, stipulated period, and minimum cost. We have well-trained and highly skilled professional civil contractors who always strive to meet your needs. We also have an experienced team for house " +
        '<a href="/projects/painting-and-finishing"><strong>painting services</strong></a> ' +
        "which is always ready to provide the required solutions to our clients. If you are looking to renovate the interior of your house or office Vastu friendly then feel free to connect with us and let us know about your requirements.</p>",
      bullets: [],
      image: null,
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "collage",
      layout: "asymmetric-3",
      images: [
        { url: IMG.modernHouseInterior, alt: "Modern living room interior" },
        { url: IMG.archDrawings1, alt: "Architectural design drawing of a modern home" },
        {
          url: IMG.civilConstruction,
          alt: "Residential bungalow built by Naksha Construction",
        },
      ],
    },
    {
      type: "projectsGrid",
      source: "projects",
      heading: "Our Projects",
      limit: 4,
    },
  ],
};

// ── /projects/architectural-design-and-planning ──────────────────────────────
const architecturalPage: PageSeed = {
  key: "service-architectural-design-and-planning",
  path: "/projects/architectural-design-and-planning",
  title: "Architectural Design and Planning",
  seoTitle:
    "Architectural Design and Planning Services Jaipur | Naksha Construction",
  seoDescription:
    "Get professional architectural design and planning services in Jaipur for residential and commercial projects. We provide house planning, 2D & 3D drawings & customized architectural solutions.",
  blocks: [
    {
      type: "hero",
      eyebrow: "Architectural Design and Planning",
      title: "Professional Architectural Design & Planning Services In Jaipur",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "",
      image: IMG.archDrawings1,
      imageAlt: "Architectural design and drawings",
      size: "md",
      alignment: "left",
      overlayStrength: "medium",
    },
    {
      type: "twoColumn",
      heading: "Professional Architectural Design & Planning Services In Jaipur",
      body:
        "<p>Naksha Construction offers professional architectural design and planning services in Jaipur, including reliable structural design and drawing solutions for residential and commercial projects. A well-planned architectural design and accurate structural drawing are essential to transform the owner's vision into a successful construction project. Without proper planning and expert execution, achieving the desired outcome becomes difficult.</p>" +
        "<p>That is why our team consists of experienced architects and design professionals who are dedicated to delivering high-quality building designs, house elevation plans, and customized drawing solutions. We focus on creating functional, modern, and aesthetically appealing spaces that match our clients' requirements while ensuring precision and structural reliability in every project.</p>",
      bullets: [],
      image: { url: IMG.archDrawings1, alt: "Pencil-sketch architectural design of a modern home" },
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "twoColumn",
      heading: "Exquisite Structural Design And Drawing In Jaipur",
      body:
        "<p>At Naksha Construction We provide you best structural design and drawing services in Jaipur, offering complete building planning, house design, and architectural drawing solutions for residential and commercial projects.</p>" +
        "<p>Our experienced and skilled professionals ensure that your ideas are transformed into practical, modern, and visually appealing designs while following the latest local building guidelines and standards. From home design drawings to customized structural plans, we focus on delivering high-quality solutions that match your vision and project requirements. If you have any questions or need expert guidance, our customer support team is always available to assist you</p>",
      bullets: [],
      image: { url: IMG.archDrawings2, alt: "3D wireframe house drawing" },
      imagePosition: "left",
      background: "tint",
    },
    {
      type: "twoColumn",
      heading: "Benefits To Hire Professional For Architectural Design Services",
      body:
        "<p>A good architectural design is a valuable investment for any residential or commercial project. Professional architects and engineers transform ideas into accurate technical drawings while ensuring proper space utilization, structural planning, and modern design solutions. Hiring experts for architectural design services in Jaipur helps you get creative designs, quality planning, and long-lasting construction results.</p>" +
        '<p>If you are searching for a trusted <a href="/contact">home design company in jaipur</a> then Naksha Construction offers complete architectural and structural design solutions for homes, flats, offices, and commercial buildings. Our experienced team provides customized plans, quality work, and expert guidance to turn your vision into reality. Get your Home designed by the best Architectures of Naksha Construction.</p>',
      bullets: [],
      image: null,
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "ctaStrip",
      text: "Ready to design your next project?",
      textSub: "",
      cta: { label: "Contact us", href: "/contact" },
      background: "tint",
    },
  ],
};

// ── /projects/civil-work ─────────────────────────────────────────────────────
const civilPage: PageSeed = {
  key: "service-civil-work",
  path: "/projects/civil-work",
  title: "Civil Work",
  seoTitle: "Best Civil Work Contractor in Jaipur | Naksha Construction",
  seoDescription:
    "Hire professional civil work contractors in Jaipur for residential and commercial construction. Design, construction, renovation and remodeling services by Naksha Construction.",
  blocks: [
    {
      type: "hero",
      eyebrow: "",
      title: "Best Civil Work Contractor",
      subtitle: "<p>DESIGN | CONSTRUCTION | RENOVATION | REMODELING</p>",
      ctaLabel: "Get in Touch with us for a Free Consultation",
      ctaHref: "/contact",
      image: IMG.civilHero,
      imageAlt: "Civil work site by Naksha Construction",
      size: "md",
      alignment: "center",
      overlayStrength: "heavy",
    },
    {
      type: "twoColumn",
      heading: "Professional Civil Work Contractor In Jaipur",
      body:
        "<p>When it comes to civil construction projects, quality and proper planning should never be compromised. Every residential and commercial project requires expert guidance, durable construction methods, and the use of quality materials to ensure the long life of buildings and houses. It is also important that all civil work construction is carried out according to the latest local building guidelines and safety standards. Hiring an experienced civil work contractor in Jaipur helps you avoid construction issues and ensures smooth project execution from start to finish.</p>" +
        "<p>Naksha Construction is a trusted and professional civil contractor in Jaipur with more than 11 years of experience in residential and commercial construction projects. Our highly skilled team focuses on delivering quality workmanship, timely project completion, and reliable construction solutions according to our clients' requirements. We provide complete civil work solutions for:</p>" +
        '<p>We also offer complete support for <a href="/projects/architectural-design-and-planning">Architectural Design and planning services</a> to help clients create strong and modern structures. If you are looking for customized building layouts, you can also explore our architectural design and planning services for residential and commercial projects</p>',
      bullets: [
        "Remodeling Services",
        "Renovation Work",
        "Rebuild Construction",
        "Residential Building Construction",
        "Commercial Civil Work",
      ],
      image: { url: IMG.civilConstruction, alt: "Civil Work Construction" },
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "ctaStrip",
      text: "Ready To Discuss Your Project? Contact Us Today!",
      textSub: "",
      cta: { label: "Contact us", href: "/contact" },
      background: "tint",
    },
    {
      type: "twoColumn",
      heading: "Why Choose Us For Civil Work ?",
      body:
        "<p>Naksha Construction is a trusted destination for clients looking to hire professional civil work contractors in Jaipur for residential and commercial projects. As an experienced civil contractor in Jaipur, we provide reliable and high-quality civil construction solutions with a focus on durability, proper planning, and customer satisfaction. Our skilled team of industry professionals ensures smooth project execution with turnkey construction solutions that help clients enjoy a hassle-free experience from planning to completion. Know what makes us different from others:</p>",
      bullets: [
        "proficient team",
        "Affordable budget",
        "High work efficiency",
        "Understanding customer's need",
        "Our more than 11 years of experience",
      ],
      image: { url: IMG.civilConstruction, alt: "Civil work on site" },
      imagePosition: "left",
      background: "tint",
    },
  ],
};

// ── /projects/interior-work-design ───────────────────────────────────────────
const interiorPage: PageSeed = {
  key: "service-interior-work-design",
  path: "/projects/interior-work-design",
  title: "Interior Work Design",
  seoTitle: "Best Interior Design Services in Jaipur | Naksha Construction",
  seoDescription:
    "Looking for the best interior design services in Jaipur? Naksha Construction offers modern interior solutions for homes, offices, and commercial spaces. Contact us today.",
  blocks: [
    {
      type: "hero",
      eyebrow: "",
      title: "Interior Work Design",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "",
      image: IMG.interiorBanner,
      imageAlt: "Interior design by Naksha Construction",
      size: "md",
      alignment: "center",
      overlayStrength: "heavy",
    },
    {
      type: "twoColumn",
      heading: "Professional Interior Design Services In Jaipur",
      body:
        "<p>Interior design plays a key role in creating attractive and comfortable living spaces, and everyone wants their interiors to look modern, functional, and visually appealing. That is why professional interior design is essential for every home and commercial space.</p>" +
        "<p>Can a renovation truly be considered complete if the interior has not been redesigned according to the owner's vision? Interior design and planning is a crucial part of any construction or renovation project, requiring careful attention to detail to ensure that the client's vision is properly executed.</p>" +
        "<p>At the same time, every interior project must also comply with local construction standards and guidelines to ensure safety and long-term durability. This is where Naksha Construction plays an important role, providing professional interior design services in Jaipur with a focus on functional layouts, modern aesthetics, and vastu-friendly interior solutions as per client requirements.</p>",
      bullets: [],
      image: { url: IMG.interiorWork1, alt: "Modern living room interior by Naksha Construction" },
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "twoColumn",
      heading: "Interior Wall Design Services At Affordable Prices",
      body:
        "<p>Interior walls play a key role in defining the overall look and feel of any space. Well-designed walls can completely transform interiors, making them more attractive, modern, and visually appealing.</p>" +
        "<p>Naksha Construction is a trusted provider of interior design services in Jaipur, offering creative and functional wall design solutions for residential and commercial spaces. As a professional interior designer in Jaipur, we focus on delivering high-quality interior solutions at affordable prices without compromising on design standards.</p>" +
        "<p>We provide a wide range of interior construction and design services, ensuring that every project is completed with attention to detail, durability, and client satisfaction. Our goal is to deliver 100% customized interior solutions that match the client's vision and requirements.</p>" +
        '<p>To ensure a smooth and hassle-free experience, we execute projects on a turnkey basis, handling everything from planning to final execution. This approach helps us maintain quality, efficiency, and complete project control for better results. With this we provide <a href="/projects/painting-and-finishing">painting and finishing services</a> also .</p>',
      bullets: [],
      image: { url: IMG.homeInteriorDesign, alt: "Home interior design with feature staircase" },
      imagePosition: "left",
      background: "tint",
    },
    {
      type: "twoColumn",
      heading: "Benefits To Hire Professional For Interior Designing",
      body:
        "<p>Hiring a professional for interior design services in Jaipur offers several important benefits for both residential and commercial projects. The main advantage is that experts handle complex design tasks efficiently while ensuring your home or office is designed according to your style, preferences, and functional needs.</p>" +
        "<p>Professional interior designers provide proper space planning, budget-friendly solutions, and high-quality execution with attention to detail. They ensure error-free work through careful planning and coordination, which adds long-term value to your property.</p>" +
        "<p>In addition, experienced interior designers maintain strong coordination with contractors, architects, and other professionals to ensure smooth project execution from start to finish. This helps in avoiding delays and ensures that the interior work is completed in a structured and organized manner.</p>" +
        "<p>Today, people are increasingly focused on improving the appearance and functionality of their homes and workplaces. As a result, services like living room interior design, home interior design, and office interior design are in high demand.</p>" +
        "<p>Naksha Construction is a trusted interior designer in Jaipur with a team of skilled, experienced, and creative professionals. We specialize in delivering modern and customized interior design solutions for small houses, flats, residential buildings, and office spaces, ensuring a perfect balance of functionality and aesthetics.</p>",
      bullets: [],
      image: { url: IMG.modernHouseInterior, alt: "Modern house interior in Jaipur" },
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "ctaStrip",
      text: "Hire Us!",
      textSub: "Professional Interior Designer",
      cta: { label: "Get in Touch", href: "/contact" },
      background: "tint",
    },
    {
      type: "twoColumn",
      eyebrow: "",
      heading: "Contemporary Interior Design Style",
      body:
        "<p>Many people think that contemporary design and modern design are the same, while it is not that they are slightly different, just some similarities. Contemporary designs are more fluid in nature. But interior designers use them both in an interchangeable pattern. Some of the elements that should use in interior designs as it uses metallic accent pieces, either very dark or very light wood tones, open spaces, include the use of natural light.</p>",
      bullets: [],
      image: { url: IMG.interiorWork1, alt: "Contemporary interior design example" },
      imagePosition: "left",
      background: "paper",
    },
    {
      type: "styleCards",
      heading: "Interior Designing Styles",
      intro:
        "<p>Before you are going to finalize your Interior design, you should always consider a variety of interior design styles, such as:</p>",
      columns: 3,
      background: "tint",
      cards: [
        {
          heading: "MODERN STYLE OF INTERIOR DESIGN",
          body:
            "It steals lots of people's hearts by looking attractive with bold color contrasts or neutral with primary colors, and getting an artistic look with accessories such as the glass and steel mostly used for this type of design. Keep in mind plain area rugs or geometric patterns, open floor plans, and furniture should be smooth and sleek.",
        },
        {
          heading: "BEACH STYLE INTERIOR DESIGN",
          body:
            "You can feel the entire beach in your place after executing the beach-style interior design. Mostly use light colors for painting, and the turquoise color gives an aesthetic touch to the interior. Some of the Elements of Beach Side Decor as white color painted for the backdrop, surf and shells must be of its element, use Natural oak frame and beachside decor should be light and breezy.",
        },
        {
          heading: "INDUSTRIAL INTERIOR DESIGN STYLE",
          body:
            "It is for factories, warehouses, industry. And it should look unfinished and raw as an interior design. That will make a presentation look like exposed brick. We can use the old timber to build its interiors; putting abstract art inside can be an idea, use a neutral color scheme that will be ideal here.",
        },
        {
          heading: "Minimalist Interior Design Style",
          body:
            "The design is perfect for those people who like the essence of simplicity. This design contains minimum accessories. And it will provide a clean elegance to your interiors. Never use vibrant colors and prints for Minimalist Interior Design; keep sufficient space for making the atmosphere airy.",
        },
        {
          heading: "ECLECTIC INTERIOR DESIGNING STYLE",
          body:
            "This design is ideal for youngsters, and this comes with high energy decor, having the freedom to use your creativity, and it is all about energy.",
        },
        {
          heading: "Traditional Interior Designing Style",
          body:
            "It gives an old and classy touch to the interior. And use some antiques for this, and the main focus is on the wooden furniture, which plays an important role and should be the style used by the traditional craftsman.",
        },
      ],
    },
  ],
};

// ── /projects/painting-and-finishing ─────────────────────────────────────────
const paintingPage: PageSeed = {
  key: "service-painting-and-finishing",
  path: "/projects/painting-and-finishing",
  title: "Painting and Finishing",
  seoTitle: "Best Painting Services in Jaipur | Naksha Construction",
  seoDescription:
    "Get the best painting services in Jaipur — residential, commercial, waterproof and decorative painting by experienced contractors.",
  blocks: [
    {
      type: "hero",
      eyebrow: "",
      title: "Painting & Finishing",
      subtitle: "",
      ctaLabel: "",
      ctaHref: "",
      image: IMG.paintingHero,
      imageAlt: "Painting and finishing services in Jaipur",
      size: "md",
      alignment: "center",
      overlayStrength: "heavy",
    },
    {
      type: "twoColumn",
      heading: "We Provide Best Painting Services In Jaipur",
      body:
        "<p>A fresh coat of paint can completely transform the look and feel of any space, whether it is an interior room or the exterior of a property. Painting not only enhances the visual appeal of a space but also protects walls and surfaces from moisture, damage, and long-term wear.</p>" +
        "<p>When it comes to professional painting services in Jaipur, Naksha Construction provides reliable and high-quality solutions for both residential and commercial projects. From modern home interiors to exterior building painting, we deliver durable and visually appealing finishes that improve the overall appearance of your property.</p>" +
        "<p>We offer a wide range of affordable house painting services in Jaipur and office painting solutions designed to meet different design preferences and budget requirements. Our focus is on delivering smooth finishes, quality materials, and long-lasting results to ensure complete customer satisfaction.</p>",
      bullets: [],
      image: { url: IMG.paintWork, alt: "Painter applying fresh coat of paint to an interior wall" },
      imagePosition: "right",
      background: "paper",
    },
    {
      type: "ctaStrip",
      text: "Hire Us Today!",
      textSub: "",
      cta: { label: "Contact us", href: "/contact" },
      background: "tint",
    },
    {
      type: "twoColumn",
      heading: "Painting Contractors In Jaipur",
      body:
        "<p>Hire professional painting contractors in Jaipur for reliable and high-quality residential and commercial painting services. At Naksha Construction, our experienced and trained professionals ensure smooth execution of painting projects that match your budget, design preferences, and timeline.</p>" +
        '<p>We focus on delivering hassle-free painting services with proper planning, quality materials, and long-lasting finishes. Whether you are searching for "paint services near me" or best painting services in Jaipur, we provide complete solutions for interior and exterior painting work.</p>' +
        "<p>Our services include residential painting, commercial painting, waterproof painting, and interior decorative painting solutions in Jaipur. With skilled workmanship and attention to detail, we ensure clean finishes and durable results for every project.</p>" +
        '<p>You can contact us hassle-free for <a href="/projects/interior-work-design">interior work</a> and <strong>deco paint in jaipur</strong>, and we are the supreme <strong>house painting contractor.</strong></p>',
      bullets: [],
      image: { url: IMG.paintingDetail, alt: "Interior wall painting in a residential living room" },
      imagePosition: "left",
      background: "tint",
    },
  ],
};

const PAGES: PageSeed[] = [
  aboutPage,
  architecturalPage,
  civilPage,
  interiorPage,
  paintingPage,
];

async function upsertPage(p: PageSeed) {
  const blocks = p.blocks as unknown as Prisma.InputJsonValue;
  const data: Prisma.PageUpdateInput = {
    path: p.path,
    title: p.title,
    blocks,
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
  };
  const created: Prisma.PageCreateInput = {
    key: p.key,
    path: p.path,
    title: p.title,
    blocks,
    seoTitle: p.seoTitle ?? null,
    seoDescription: p.seoDescription ?? null,
  };
  const result = await prisma.page.upsert({
    where: { key: p.key },
    update: data,
    create: created,
  });
  console.log(`  ✓ ${result.key.padEnd(40)} ${result.path}  (${p.blocks.length} blocks)`);
}

async function main() {
  console.log(`Seeding ${PAGES.length} CMS pages…`);
  for (const p of PAGES) {
    await upsertPage(p);
  }
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
