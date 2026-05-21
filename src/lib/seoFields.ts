import { z } from "zod";

// Trim, drop empties, dedupe (case-sensitive, first occurrence wins).
// Returns a fresh array; safe to call on every write path that accepts a
// secondary-keyword list (Project/Service/Article/Leader/SeoPage).
export function sanitizeSecondaryKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Reusable zod field for the new secondary-keyword list. The .transform call
// applies sanitizeSecondaryKeywords on every parse, so every write path that
// uses this field inherits the sanitizer automatically (B.4).
export const secondaryKeywordsField = z
  .array(z.string())
  .default([])
  .transform(sanitizeSecondaryKeywords);

// Shared Zod fragment for the embedded-SEO columns added to content collections.
// Spread into a collection's create schema so the existing seoTitle / seoDescription /
// seoOgImage are joined by the new richer fields.
export const seoFieldsShape = {
  // Legacy single keyword list — kept for one release so existing payloads keep
  // working while admin migrates to seoPrimaryKeyword + seoSecondaryKeywords.
  seoKeywords: z.array(z.string()).default([]),
  seoPrimaryKeyword: z.string().nullable().optional(),
  seoSecondaryKeywords: secondaryKeywordsField,
  seoOgTitle: z.string().nullable().optional(),
  seoOgDescription: z.string().nullable().optional(),
  seoCanonicalUrl: z.string().nullable().optional(),
  seoNoIndex: z.boolean().default(false),
  seoNoFollow: z.boolean().default(false),
} as const;
