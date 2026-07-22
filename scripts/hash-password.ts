/**
 * Generate the values that go in ADMIN_PASSWORD_HASH and AUTH_SECRET.
 *
 *   npx tsx scripts/hash-password.ts 'the-password'
 *
 * Paste the printed lines into backend/.env (local) or the host's environment
 * settings (Coolify). The plaintext password is never stored anywhere.
 */
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npx tsx scripts/hash-password.ts '<password>'");
  process.exit(1);
}

const N = 16384;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N });

console.log(`ADMIN_PASSWORD_HASH=scrypt$${N}$${salt.toString("hex")}$${hash.toString("hex")}`);
console.log(`AUTH_SECRET=${randomBytes(48).toString("base64url")}`);
