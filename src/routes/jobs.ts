import { z } from "zod";
import { crudRouter } from "../lib/crud.js";

const create = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  type: z.enum(["Full-time", "Contract", "Apprenticeship"]),
  summary: z.string().min(1),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoOgImage: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const jobsRouter = crudRouter({
  model: "job",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
});
