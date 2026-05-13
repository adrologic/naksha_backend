import { z } from "zod";
import { crudRouter } from "../lib/crud.js";
import { seoFieldsShape } from "../lib/seoFields.js";

const galleryItem = z.object({ url: z.string(), alt: z.string().default("") });

const create = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  market: z.string().min(1),
  location: z.string().min(1),
  year: z.number().int(),
  client: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  summary: z.string().min(1),
  description: z.string().default(""),
  coverImage: z.string().nullable().optional(),
  gallery: z.array(galleryItem).default([]),
  highlights: z.array(z.string()).default([]),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  ...seoFieldsShape,
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const projectsRouter = crudRouter({
  model: "project",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
});
