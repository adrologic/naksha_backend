import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

/**
 * Single-admin authentication for the CMS.
 *
 * No JWT/bcrypt dependency: the token is an HMAC-SHA256-signed payload and the
 * password is stored as a scrypt hash. Both come from node:crypto, which keeps
 * the backend's dependency list unchanged.
 */

const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;

// ── Password hashing ─────────────────────────────────────────────────────────

/**
 * Produce a `scrypt:<N>:<saltHex>:<hashHex>` string for ADMIN_PASSWORD_HASH.
 *
 * Colon-separated rather than the conventional `$`: this value is pasted into
 * env files and hosting-provider UIs, and Docker Compose interpolates `$FOO`,
 * so a `$`-separated hash silently arrives truncated. Legacy `$` hashes are
 * still accepted on the read path.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `scrypt:${SCRYPT_N}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.includes(":") ? stored.split(":") : stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  if (!Number.isInteger(N) || N < 1024) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[2], "hex");
    expected = Buffer.from(parts[3], "hex");
  } catch {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  const actual = scryptSync(plain, salt, expected.length, { N });
  return timingSafeEqual(actual, expected);
}

/** Constant-time string compare that does not leak length via early exit. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still burn a comparison so the timing is roughly flat.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

// ── Config ───────────────────────────────────────────────────────────────────

export type AuthConfig = {
  email: string;
  passwordHash: string;
  secret: string;
  ttlMs: number;
};

const MIN_SECRET_LENGTH = 32;

function resolveConfig(): { config: AuthConfig | null; problems: string[] } {
  const problems: string[] = [];

  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) problems.push("ADMIN_EMAIL is not set");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problems.push(`ADMIN_EMAIL is not a valid email address ("${email}")`);
  }

  const secret = env.AUTH_SECRET?.trim();
  if (!secret) problems.push("AUTH_SECRET is not set");
  else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `AUTH_SECRET is too short (${secret.length} chars, needs ${MIN_SECRET_LENGTH}+)`,
    );
  }

  // ADMIN_PASSWORD_HASH is preferred. ADMIN_PASSWORD (plaintext) is accepted as
  // a convenience for local dev and hashed once at boot — never persisted.
  let passwordHash = env.ADMIN_PASSWORD_HASH?.trim();
  if (passwordHash && !/^scrypt[:$]\d+[:$][0-9a-f]+[:$][0-9a-f]+$/.test(passwordHash)) {
    problems.push(
      `ADMIN_PASSWORD_HASH is malformed (got ${passwordHash.length} chars starting ` +
        `"${passwordHash.slice(0, 12)}…") — expected scrypt:<N>:<salt>:<hash>. ` +
        "Regenerate with `npx tsx scripts/hash-password.ts '<password>'` and paste the whole value.",
    );
    passwordHash = undefined;
  }
  if (!passwordHash && env.ADMIN_PASSWORD) {
    passwordHash = hashPassword(env.ADMIN_PASSWORD);
  }
  if (!passwordHash) problems.push("neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is usable");

  if (problems.length || !email || !secret || !passwordHash) return { config: null, problems };

  return {
    config: { email, passwordHash, secret, ttlMs: env.AUTH_TOKEN_TTL_HOURS * 60 * 60 * 1000 },
    problems,
  };
}

const resolved = resolveConfig();
export const authConfig = resolved.config;

if (!authConfig) {
  // Deliberately a warning, not a hard exit: the public website reads this API
  // and must keep serving even if the admin credentials were never set on the
  // host. Login returns 503 and every protected route returns 401 until they
  // are — the CMS is locked, the site is not.
  console.warn(
    "[auth] Admin auth is NOT configured, so /auth/login returns 503 and every " +
      "write endpoint rejects with 401. Public reads are unaffected. Problems:",
  );
  for (const p of resolved.problems) console.warn(`[auth]   - ${p}`);
} else {
  console.log(`[auth] Admin auth configured for ${authConfig.email}`);
}

// ── Tokens ───────────────────────────────────────────────────────────────────

export type TokenPayload = { sub: string; iat: number; exp: number };

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function issueToken(cfg: AuthConfig): { token: string; expiresAt: number } {
  const now = Date.now();
  const payload: TokenPayload = { sub: cfg.email, iat: now, exp: now + cfg.ttlMs };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return { token: `${body}.${sign(body, cfg.secret)}`, expiresAt: payload.exp };
}

/** Returns the payload for a well-formed, unexpired, correctly signed token. */
export function verifyToken(token: string, cfg: AuthConfig): TokenPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(body, cfg.secret))) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }
  if (typeof payload?.exp !== "number" || typeof payload?.sub !== "string") return null;
  if (Date.now() >= payload.exp) return null;
  // A token signed for a different admin email than the one now configured is
  // stale (credentials rotated) and must not be honoured.
  if (payload.sub.toLowerCase() !== cfg.email) return null;
  return payload;
}
