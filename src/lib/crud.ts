import { Router } from "express";
import type { ZodSchema } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "./asyncHandler.js";
import { sanitizeRichTextFields } from "./sanitize.js";

type ModelName =
  | "project"
  | "service"
  | "market"
  | "article"
  | "leader"
  | "job"
  | "location"
  | "testimonial";

type Options = {
  model: ModelName;
  createSchema: ZodSchema;
  updateSchema: ZodSchema;
  /** When true and the model has a `slug` field, also expose GET /by-slug/:slug. */
  hasSlug?: boolean;
  /** Default sort. Defaults to `{ sortOrder: "asc" }`. */
  orderBy?: Record<string, "asc" | "desc">;
  /** Field names that hold rich-text HTML; sanitized on create/update. */
  richTextFields?: readonly string[];
};

/**
 * Generic CRUD router for content collections.
 * Endpoints:
 *   GET    /              list
 *   GET    /:id           get by id
 *   GET    /by-slug/:slug get by slug (if hasSlug)
 *   POST   /              create
 *   PATCH  /:id           partial update; auto-creates Redirect when slug changes
 *   DELETE /:id           delete
 */
export function crudRouter(opts: Options) {
  const r = Router();
  const m = (prisma as unknown as Record<string, any>)[opts.model];
  const orderBy = opts.orderBy ?? { sortOrder: "asc" };

  r.get(
    "/",
    asyncHandler(async (_req, res) => {
      const items = await m.findMany({ orderBy });
      res.json(items);
    }),
  );

  if (opts.hasSlug) {
    r.get(
      "/by-slug/:slug",
      asyncHandler(async (req, res) => {
        const item = await m.findUnique({ where: { slug: req.params.slug } });
        if (!item) return res.status(404).json({ error: "not_found" });
        res.json(item);
      }),
    );
  }

  r.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const item = await m.findUnique({ where: { id: req.params.id } });
      if (!item) return res.status(404).json({ error: "not_found" });
      res.json(item);
    }),
  );

  const sanitize = (input: unknown): unknown => {
    if (!opts.richTextFields || !input || typeof input !== "object") return input;
    return sanitizeRichTextFields(input as Record<string, unknown>, opts.richTextFields);
  };

  r.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = opts.createSchema.parse(sanitize(req.body));
      const created = await m.create({ data });
      res.status(201).json(created);
    }),
  );

  r.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const data = opts.updateSchema.parse(sanitize(req.body)) as Record<string, unknown>;
      const before = await m.findUnique({ where: { id: req.params.id } });
      if (!before) return res.status(404).json({ error: "not_found" });

      const updated = await m.update({ where: { id: req.params.id }, data });

      // Auto-create redirect when slug changes (only for models that route by slug).
      if (
        opts.hasSlug &&
        typeof (before as Record<string, unknown>).slug === "string" &&
        typeof data.slug === "string" &&
        data.slug !== (before as Record<string, unknown>).slug
      ) {
        const fromPath = `/${opts.model}s/${(before as Record<string, unknown>).slug}`;
        const toPath = `/${opts.model}s/${data.slug}`;
        await prisma.redirect
          .upsert({
            where: { fromPath },
            update: { toPath },
            create: { fromPath, toPath },
          })
          .catch(() => undefined);
      }

      res.json(updated);
    }),
  );

  r.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      await m.delete({ where: { id: req.params.id } });
      res.status(204).end();
    }),
  );

  return r;
}
