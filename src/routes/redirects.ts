import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const redirectsRouter = Router();

const create = z.object({
  fromPath: z.string().regex(/^\//),
  toPath: z.string().regex(/^\//),
  statusCode: z.number().int().default(301),
});
const update = create.partial();

redirectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
    res.json(items);
  }),
);

redirectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = create.parse(req.body);
    const item = await prisma.redirect.upsert({
      where: { fromPath: data.fromPath },
      update: data,
      create: data,
    });
    res.status(201).json(item);
  }),
);

redirectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = update.parse(req.body);
    const item = await prisma.redirect.update({ where: { id: req.params.id }, data });
    res.json(item);
  }),
);

redirectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await prisma.redirect.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);
