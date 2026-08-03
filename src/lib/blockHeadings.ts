// Validation for the per-heading HTML tag fields inside a Page's `blocks` JSON.
//
// Blocks are stored as free-form JSON (schemas live in the website/admin code,
// not the DB) so the route keeps accepting `z.array(z.unknown())`. This pass
// narrowly guards the heading-tag fields: a bad value would otherwise reach
// React as a tag name and render a literal `<foo>` element.
//
// Deliberately non-destructive — an invalid value is *dropped*, never coerced
// to some other level. A missing field makes the website fall back to the tag
// that block has always rendered, which is exactly the desired outcome.

/** Fields whose value must be an HTML heading tag (or "p" for eyebrow slots). */
const HEADING_LEVEL_KEY = /^(heading|itemHeading|cardHeading)Level$/;

const ALLOWED_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);

export function isHeadingTag(value: unknown): boolean {
  return typeof value === "string" && ALLOWED_TAGS.has(value);
}

/**
 * Walk a blocks tree and strip any heading-tag field holding a value outside
 * h1–h6 / p. Everything else is passed through byte-for-byte.
 */
export function normalizeBlockHeadingLevels(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(normalizeBlockHeadingLevels);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      if (HEADING_LEVEL_KEY.test(k)) {
        // Drop empty strings too — admin sends "" for "no explicit choice".
        if (isHeadingTag(obj[k])) out[k] = obj[k];
        continue;
      }
      out[k] = normalizeBlockHeadingLevels(obj[k]);
    }
    return out;
  }
  return input;
}
