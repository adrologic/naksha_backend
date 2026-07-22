import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { corsOrigins, env } from "./env.js";
import { revalidateWebsite } from "./lib/revalidate.js";
import { errorHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { servicesRouter } from "./routes/services.js";
import { articlesRouter } from "./routes/articles.js";
import { leadersRouter } from "./routes/leaders.js";
import { locationsRouter } from "./routes/locations.js";
import { testimonialsRouter } from "./routes/testimonials.js";
import { pagesRouter } from "./routes/pages.js";
import { globalsRouter } from "./routes/globals.js";
import { mediaRouter } from "./routes/media.js";
import { uploadsRouter } from "./routes/uploads.js";
import { redirectsRouter } from "./routes/redirects.js";
import { contactRouter } from "./routes/contact.js";
import { seoRouter } from "./routes/seo.js";
import { internalLinksRouter } from "./routes/internalLinks.js";
import { authRouter } from "./routes/auth.js";
import { protectApi } from "./middleware/requireAuth.js";

export function createServer() {
  const app = express();

  // Behind Coolify's reverse proxy; without this req.ip is the proxy's address
  // and the login throttle would count every attempt against one bucket.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  app.use((req, res, next) => {
    res.on("finish", () => {
      const mutating = req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE";
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      if (!mutating || !ok) return;
      const p = req.path;
      if (p.startsWith("/health") || p.startsWith("/uploads") || p.startsWith("/contact")) return;
      revalidateWebsite({ layout: true });
    });
    next();
  });

  app.get("/", (_req, res) => {
    res.json({ name: "naksha-backend", version: "0.2.0" });
  });

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);

  // Everything below requires an admin token for any state-changing request,
  // and for the handful of GETs that are admin-only. Public reads pass through.
  app.use(protectApi);

  // Content collections
  app.use("/projects", projectsRouter);
  app.use("/services", servicesRouter);
  app.use("/articles", articlesRouter);
  app.use("/leaders", leadersRouter);
  app.use("/locations", locationsRouter);
  app.use("/testimonials", testimonialsRouter);

  // Pages, globals, media, uploads, redirects, contact form
  app.use("/pages", pagesRouter);
  app.use("/globals", globalsRouter);
  app.use("/media", mediaRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/redirects", redirectsRouter);
  app.use("/contact", contactRouter);

  // Internal-link picker (admin) — aggregated index of linkable docs.
  app.use("/internal-links", internalLinksRouter);

  // SEO management API (global settings, page overrides, schemas, content coverage).
  app.use("/api/seo", seoRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use(errorHandler);

  return app;
}
