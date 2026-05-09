import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { cloudinary } from "../cloudinary.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const mediaRouter = Router();

const registerSchema = z.object({
  publicId: z.string().min(1),
  url: z.string().url(),
  secureUrl: z.string().url(),
  format: z.string().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  bytes: z.number().int().nullable().optional(),
  alt: z.string().default(""),
  tags: z.array(z.string()).default([]),
  folder: z.string().nullable().optional(),
});

const updateSchema = z.object({
  alt: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

mediaRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    const folder = typeof req.query.folder === "string" ? req.query.folder : undefined;
    const items = await prisma.mediaAsset.findMany({
      where: {
        ...(tag ? { tags: { has: tag } } : {}),
        ...(folder ? { folder } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  }),
);

mediaRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  }),
);

// Register a Cloudinary upload that the client just completed (signed upload widget).
mediaRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const created = await prisma.mediaAsset.upsert({
      where: { publicId: data.publicId },
      update: data,
      create: data,
    });
    res.status(201).json(created);
  }),
);

mediaRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateSchema.parse(req.body);
    const updated = await prisma.mediaAsset.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  }),
);

// Delete from Cloudinary first, then from DB.
mediaRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: "not_found" });
    await cloudinary.uploader.destroy(item.publicId).catch(() => undefined);
    await prisma.mediaAsset.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
