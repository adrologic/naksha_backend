import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { corsOrigins, env } from "./env.js";
import { errorHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { servicesRouter } from "./routes/services.js";
import { marketsRouter } from "./routes/markets.js";
import { articlesRouter } from "./routes/articles.js";
import { leadersRouter } from "./routes/leaders.js";
import { jobsRouter } from "./routes/jobs.js";
import { locationsRouter } from "./routes/locations.js";
import { testimonialsRouter } from "./routes/testimonials.js";
import { pagesRouter } from "./routes/pages.js";
import { globalsRouter } from "./routes/globals.js";
import { mediaRouter } from "./routes/media.js";
import { uploadsRouter } from "./routes/uploads.js";
import { redirectsRouter } from "./routes/redirects.js";
import { contactRouter } from "./routes/contact.js";

export function createServer() {
  const app = express();

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

  app.get("/", (_req, res) => {
    res.json({ name: "naksha-backend", version: "0.2.0" });
  });

  app.use("/health", healthRouter);

  // Content collections
  app.use("/projects", projectsRouter);
  app.use("/services", servicesRouter);
  app.use("/markets", marketsRouter);
  app.use("/articles", articlesRouter);
  app.use("/leaders", leadersRouter);
  app.use("/jobs", jobsRouter);
  app.use("/locations", locationsRouter);
  app.use("/testimonials", testimonialsRouter);

  // Pages, globals, media, uploads, redirects, contact form
  app.use("/pages", pagesRouter);
  app.use("/globals", globalsRouter);
  app.use("/media", mediaRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/redirects", redirectsRouter);
  app.use("/contact", contactRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use(errorHandler);

  return app;
}
