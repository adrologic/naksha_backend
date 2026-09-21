import type { Request } from "express";
import geoip from "geoip-lite";

/**
 * Country-level geolocation only — no city/lat-lon, no external API calls,
 * no cost. Looked up from the bundled MaxMind GeoLite2-Country data and the
 * request IP is discarded immediately after; it is never stored.
 */
export function lookupCountry(ip: string | undefined): { country: string | null; region: string | null } {
  if (!ip) return { country: null, region: null };
  const clean = ip.replace(/^::ffff:/, "");
  const geo = geoip.lookup(clean);
  if (!geo) return { country: null, region: null };
  return { country: geo.country || null, region: geo.region || null };
}

/** First IP in X-Forwarded-For (trust proxy is enabled), or the socket's address. */
export function clientIp(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0]?.trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.socket.remoteAddress;
}
