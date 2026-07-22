import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler.js";
import { authConfig, issueToken, safeEqual, verifyPassword } from "../lib/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

// ── Brute-force throttle ─────────────────────────────────────────────────────
// In-memory and per-IP. One backend instance, one admin — a shared store would
// be more machinery than the threat warrants. Restarting clears it, which is
// acceptable: the window is short and the cost to an attacker is still real.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

function throttleKey(ip: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) return { blocked: false, retryAfter: 0 };
  if (rec.count < MAX_ATTEMPTS) return { blocked: false, retryAfter: 0 };
  return { blocked: true, retryAfter: Math.ceil((rec.first + WINDOW_MS - now) / 1000) };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return;
  }
  rec.count += 1;
  // Bound the map so a spray of spoofed IPs cannot grow it without limit.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) {
      if (now - v.first > WINDOW_MS) attempts.delete(k);
    }
  }
}

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    if (!authConfig) {
      return res.status(503).json({ error: "auth_not_configured" });
    }

    const ip = req.ip ?? "unknown";
    const { blocked, retryAfter } = throttleKey(ip);
    if (blocked) {
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "too_many_attempts", retryAfter });
    }

    const { email, password } = loginSchema.parse(req.body);

    // Check both factors before answering so a wrong email and a wrong password
    // cost the same time and return the same message.
    const emailOk = safeEqual(email, authConfig.email);
    const passwordOk = verifyPassword(password, authConfig.passwordHash);

    if (!emailOk || !passwordOk) {
      recordFailure(ip);
      return res.status(401).json({ error: "invalid_credentials" });
    }

    attempts.delete(ip);
    const { token, expiresAt } = issueToken(authConfig);
    res.json({ token, expiresAt, user: { email: authConfig.email } });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: { email: req.admin!.email } });
  }),
);

// Tokens are stateless, so there is nothing to revoke server-side — the admin
// drops its copy. Kept as an endpoint so the client has one call to make and
// logout stays a POST.
authRouter.post("/logout", (_req, res) => {
  res.status(204).end();
});
