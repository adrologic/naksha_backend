import { z } from "zod";
import { crudRouter } from "../lib/crud.js";

const create = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  image: z.string().nullable().optional(),
  body: z.string().default(""),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const marketsRouter = crudRouter({
  model: "market",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
});
