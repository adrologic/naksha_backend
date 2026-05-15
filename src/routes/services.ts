import { z } from "zod";
import { crudRouter } from "../lib/crud.js";
import { seoFieldsShape } from "../lib/seoFields.js";

const create = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  icon: z.string().nullable().optional(),
  iconAlt: z.string().nullable().optional(),
  bullets: z.array(z.string()).default([]),
  body: z.string().default(""),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  ...seoFieldsShape,
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const servicesRouter = crudRouter({
  model: "service",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
  richTextFields: ["summary", "body"],
});
