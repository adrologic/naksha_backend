import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { deepSanitizeHtmlStrings } from "../lib/sanitize.js";

export const pagesRouter = Router();

const upsertSchema = z.object({
  key: z.string().min(1),
  path: z.string().min(1).regex(/^\//, "must start with /"),
  title: z.string().min(1),
  blocks: z.array(z.unknown()).default([]),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  seoKeywords: z.string().nullable().optional(),
  seoRobots: z.string().nullable().optional(),
  seoCanonical: z.string().nullable().optional(),
  ogTitle: z.string().nullable().optional(),
  ogDescription: z.string().nullable().optional(),
  ogType: z.string().nullable().optional(),
  twitterCard: z.string().nullable().optional(),
  twitterTitle: z.string().nullable().optional(),
  twitterDescription: z.string().nullable().optional(),
  twitterImage: z.string().nullable().optional(),
});
const updateSchema = upsertSchema.partial();

pagesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const pages = await prisma.page.findMany({ orderBy: { path: "asc" } });
    res.json(pages);
  }),
);

pagesRouter.get(
  "/by-path",
  asyncHandler(async (req, res) => {
    const path = String(req.query.path ?? "");
    if (!path) return res.status(400).json({ error: "path_query_required" });
    const page = await prisma.page.findUnique({ where: { path } });
    if (!page) return res.status(404).json({ error: "not_found" });
    res.json(page);
  }),
);

pagesRouter.get(
  "/by-key/:key",
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({ where: { key: req.params.key } });
    if (!page) return res.status(404).json({ error: "not_found" });
    res.json(page);
  }),
);

pagesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const page = await prisma.page.findUnique({ where: { id: req.params.id } });
    if (!page) return res.status(404).json({ error: "not_found" });
    res.json(page);
  }),
);

pagesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body);
    const cleanBlocks = deepSanitizeHtmlStrings(data.blocks) as unknown[];
    const created = await prisma.page.create({
      data: { ...data, blocks: cleanBlocks as Prisma.InputJsonValue },
    });
    res.status(201).json(created);
  }),
);

pagesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.parse(req.body);
    const { blocks: rawBlocks, ...rest } = parsed;
    const blocks = rawBlocks !== undefined ? (deepSanitizeHtmlStrings(rawBlocks) as unknown[]) : undefined;
    const before = await prisma.page.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: "not_found" });
    const updated = await prisma.page.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(blocks !== undefined ? { blocks: blocks as Prisma.InputJsonValue } : {}),
      },
    });
    if (parsed.path && parsed.path !== before.path) {
      await prisma.redirect
        .upsert({
          where: { fromPath: before.path },
          update: { toPath: parsed.path },
          create: { fromPath: before.path, toPath: parsed.path },
        })
        .catch(() => undefined);
    }
    res.json(updated);
  }),
);

pagesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.page.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
