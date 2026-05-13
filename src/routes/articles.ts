import { z } from "zod";
import { crudRouter } from "../lib/crud.js";
import { seoFieldsShape } from "../lib/seoFields.js";

const create = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  body: z.string().default(""),
  cover: z.string().nullable().optional(),
  author: z.string().min(1),
  category: z.string().nullable().optional(),
  publishedAt: z.coerce.date().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  ...seoFieldsShape,
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const articlesRouter = crudRouter({
  model: "article",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
  orderBy: { publishedAt: "desc" },
});
