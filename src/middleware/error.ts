import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "validation_error", issues: err.flatten() });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "unique_violation", target: err.meta?.target });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "not_found" });
    }
    return res.status(400).json({ error: "database_error", code: err.code });
  }
  console.error(err);
  res.status(500).json({ error: "internal_error" });
};
