import { z } from "zod";
import { crudRouter } from "../lib/crud.js";

const create = z.object({
  slug: z.string().min(1),
  city: z.string().min(1),
  address: z.array(z.string()).default([]),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  image: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const locationsRouter = crudRouter({
  model: "location",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
});
