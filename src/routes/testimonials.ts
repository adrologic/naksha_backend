import { z } from "zod";
import { crudRouter } from "../lib/crud.js";

const create = z.object({
  quote: z.string().min(1),
  author: z.string().min(1),
  role: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});
const update = create.partial();

export const testimonialsRouter = crudRouter({
  model: "testimonial",
  createSchema: create,
  updateSchema: update,
  richTextFields: ["quote"],
});
