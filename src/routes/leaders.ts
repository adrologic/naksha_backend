import { z } from "zod";
import { crudRouter } from "../lib/crud.js";

const create = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  bio: z.string().default(""),
  portrait: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const leadersRouter = crudRouter({
  model: "leader",
  createSchema: create,
  updateSchema: update,
  hasSlug: true,
});
