import { z } from "zod";

// Shared Zod fragment for the embedded-SEO columns added to content collections.
// Spread into a collection's create schema so the existing seoTitle / seoDescription /
// seoOgImage are joined by the new richer fields.
export const seoFieldsShape = {
  seoKeywords: z.array(z.string()).default([]),
  seoOgTitle: z.string().nullable().optional(),
  seoOgDescription: z.string().nullable().optional(),
  seoCanonicalUrl: z.string().nullable().optional(),
  seoNoIndex: z.boolean().default(false),
  seoNoFollow: z.boolean().default(false),
} as const;
