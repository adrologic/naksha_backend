import { Router } from "express";
import { z } from "zod";
import { cloudinary } from "../cloudinary.js";
import { env } from "../env.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const uploadsRouter = Router();

const signSchema = z.object({
  folder: z.string().default("naksha"),
  tags: z.array(z.string()).default([]),
});

// Returns a short-lived signature the admin's Cloudinary upload widget uses
// to upload directly from the browser to Cloudinary. The backend never
// touches the file bytes.
uploadsRouter.post(
  "/sign",
  asyncHandler(async (req, res) => {
    const { folder, tags } = signSchema.parse(req.body ?? {});
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
      ...(tags.length ? { tags: tags.join(",") } : {}),
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);
    res.json({
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder,
      tags,
    });
  }),
);
