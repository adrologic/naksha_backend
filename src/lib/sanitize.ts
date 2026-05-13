import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "del", "ins", "span",
  "a", "ol", "ul", "li", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "sub", "sup", "img", "iframe", "figure", "figcaption", "hr",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "class", "style", "target", "rel",
  "data-internal", "data-doc-id", "data-doc-type",
  "allowfullscreen", "frameborder", "allow", "width", "height", "loading",
];

const DANGEROUS_STYLE = /(expression\s*\(|javascript:|<|vbscript:)/i;
const SAFE_URL_STYLE = /url\s*\(\s*(?!['"]?(https?:|data:image\/|\/))/i;

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "style") {
    const v = data.attrValue || "";
    if (DANGEROUS_STYLE.test(v) || SAFE_URL_STYLE.test(v)) {
      data.keepAttr = false;
      return;
    }
  }
  if (data.attrName === "href" || data.attrName === "src") {
    const v = (data.attrValue || "").trim();
    if (/^(javascript|vbscript|data:(?!image\/))/i.test(v)) {
      data.keepAttr = false;
      return;
    }
  }
  // Strip on* event handlers
  if (data.attrName.startsWith("on")) {
    data.keepAttr = false;
  }
});

export function sanitizeRichText(input: unknown): string {
  if (typeof input !== "string") return "";
  if (input.length === 0) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

export function sanitizeRichTextFields<T extends Record<string, unknown>>(
  body: T,
  fields: readonly string[],
): T {
  if (!body || typeof body !== "object") return body;
  const out: Record<string, unknown> = { ...body };
  for (const f of fields) {
    if (typeof out[f] === "string") out[f] = sanitizeRichText(out[f]);
  }
  return out as T;
}

/** Walk a JSON tree and sanitize any string value that looks like HTML (contains `<`). */
export function deepSanitizeHtmlStrings(input: unknown): unknown {
  if (typeof input === "string") {
    return /<[a-z!\/]/i.test(input) ? sanitizeRichText(input) : input;
  }
  if (Array.isArray(input)) return input.map(deepSanitizeHtmlStrings);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) out[k] = deepSanitizeHtmlStrings(obj[k]);
    return out;
  }
  return input;
}
