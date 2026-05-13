import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getInternalLinksIndex, resolveInternalLinks } from "../lib/internalLinks.js";

export const internalLinksRouter = Router();

internalLinksRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await getInternalLinksIndex();
    res.set("Cache-Control", "private, max-age=60");
    res.json(data);
  }),
);

internalLinksRouter.post(
  "/resolve",
  asyncHandler(async (req, res) => {
    const refs = Array.isArray(req.body?.refs) ? req.body.refs : [];
    const valid = refs.filter(
      (r: unknown): r is { id: string; type: "page" | "project" | "service" | "market" | "article" | "job" | "location" } =>
        !!r &&
        typeof (r as { id: unknown }).id === "string" &&
        ["page", "project", "service", "market", "article", "job", "location"].includes((r as { type: unknown }).type as string),
    );
    const out = await resolveInternalLinks(valid);
    res.json(out);
  }),
);
