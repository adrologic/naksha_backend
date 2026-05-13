import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { deepSanitizeHtmlStrings } from "../lib/sanitize.js";

export const globalsRouter = Router();

const upsertSchema = z.object({ value: z.unknown() });

globalsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.global.findMany({ orderBy: { key: "asc" } });
    res.json(items);
  }),
);

globalsRouter.get(
  "/:key",
  asyncHandler(async (req, res) => {
    const item = await prisma.global.findUnique({ where: { key: req.params.key } });
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  }),
);

// PUT upserts — globals are singletons keyed by name (e.g. "navbar").
globalsRouter.put(
  "/:key",
  asyncHandler(async (req, res) => {
    const { value } = upsertSchema.parse(req.body);
    const cleaned = deepSanitizeHtmlStrings(value);
    const item = await prisma.global.upsert({
      where: { key: req.params.key },
      update: { value: cleaned as object },
      create: { key: req.params.key, value: cleaned as object },
    });
    res.json(item);
  }),
);

globalsRouter.delete(
  "/:key",
  asyncHandler(async (req, res) => {
    await prisma.global.delete({ where: { key: req.params.key } });
    res.status(204).end();
  }),
);
