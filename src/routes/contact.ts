import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const contactRouter = Router();

const submitSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
  meta: z.record(z.unknown()).optional(),
});

contactRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = submitSchema.parse(req.body);
    const created = await prisma.contactSubmission.create({
      data: {
        ...data,
        meta: (data.meta ?? {}) as object,
      },
    });
    res.status(201).json({ id: created.id });
  }),
);

contactRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.contactSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(items);
  }),
);

contactRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.contactSubmission.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
