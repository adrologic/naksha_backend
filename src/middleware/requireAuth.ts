import type { RequestHandler } from "express";
import { authConfig, verifyToken } from "../lib/auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: { email: string };
    }
  }
}

function bearer(req: Parameters<RequestHandler>[0]): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null;
  }
  return null;
}

/** Rejects the request unless it carries a valid admin token. */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!authConfig) {
    return res.status(401).json({ error: "auth_not_configured" });
  }
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "unauthorized" });

  const payload = verifyToken(token, authConfig);
  if (!payload) return res.status(401).json({ error: "invalid_token" });

  req.admin = { email: payload.sub };
  next();
};

/**
 * Route-level gate for the whole API.
 *
 * Reads stay open — the public website fetches its content from this API
 * anonymously at build/ISR time, and locking GETs down would take the site
 * offline. Everything that changes state requires a login, with two carve-outs
 * that are genuinely public (the contact form) or genuinely internal (health).
 */
const PUBLIC_POST_PATHS = [/^\/contact\/?$/];

/** GET endpoints that serve the admin only and must not be world-readable. */
const PRIVATE_GET_PATHS = [
  /^\/contact\/?$/, // contact inbox — names, emails, phone numbers
  /^\/internal-links/, // full index of every document in the CMS
];

export const protectApi: RequestHandler = (req, res, next) => {
  const path = req.path;

  if (req.method === "GET" || req.method === "HEAD") {
    if (PRIVATE_GET_PATHS.some((re) => re.test(path))) return requireAuth(req, res, next);
    return next();
  }

  if (req.method === "OPTIONS") return next();

  if (PUBLIC_POST_PATHS.some((re) => re.test(path)) && req.method === "POST") return next();

  return requireAuth(req, res, next);
};
