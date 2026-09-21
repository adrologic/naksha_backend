const SEARCH_ENGINES = [
  "google.",
  "bing.",
  "yahoo.",
  "duckduckgo.",
  "baidu.",
  "yandex.",
  "ecosia.",
];

const SOCIAL_NETWORKS = [
  "facebook.",
  "instagram.",
  "twitter.",
  "x.com",
  "t.co",
  "linkedin.",
  "pinterest.",
  "youtube.",
  "wa.me",
  "whatsapp.",
  "tiktok.",
  "reddit.",
];

/** Classifies a session's entry into a human-readable traffic source bucket. */
export function classifyTrafficSource(params: {
  referrer?: string | null;
  utmMedium?: string | null;
  utmSource?: string | null;
  siteHost: string;
}): "organic" | "direct" | "social" | "referral" | "paid" | "other" {
  const { referrer, utmMedium, utmSource, siteHost } = params;

  const medium = (utmMedium ?? "").toLowerCase();
  if (medium === "cpc" || medium === "ppc" || medium === "paid" || medium === "paidsearch" || medium === "display") {
    return "paid";
  }
  if (medium === "social") return "social";
  if (medium === "email" || medium === "organic" || medium === "referral") {
    if (medium === "organic") return "organic";
    if (medium === "referral") return "referral";
    return "other";
  }
  if (utmSource) return "other";

  if (!referrer) return "direct";

  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }

  if (host === siteHost) return "direct";
  if (SEARCH_ENGINES.some((s) => host.includes(s))) return "organic";
  if (SOCIAL_NETWORKS.some((s) => host.includes(s))) return "social";
  return "referral";
}
