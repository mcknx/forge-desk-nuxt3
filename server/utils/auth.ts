/**
 * Password hashing and session tokens.
 *
 * Sessions are stateless signed cookies rather than rows in a sessions table.
 * On serverless that avoids a database round-trip on every request, and there
 * is no logout-everywhere requirement here that would justify server state.
 * Rotating SESSION_SECRET invalidates every outstanding session, which is the
 * escape hatch if one is ever leaked.
 */
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import type { User } from "~~/types/domain";

const scrypt = promisify(scryptCb) as (
  p: string,
  s: Buffer,
  k: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const SESSION_COOKIE = "forge_session";

/**
 * An unset SESSION_SECRET generates a random one per process rather than
 * falling back to a fixed string. A hardcoded default is a published signing
 * key — anyone reading the repo could mint a valid session. Random means the
 * worst case is sessions not surviving a restart or spanning instances, which
 * is an annoyance rather than a hole. /api/health reports whether it is set so
 * the degraded mode is visible instead of silent.
 */
let generatedSecret: string | null = null;

export function isSessionSecretConfigured(): boolean {
  return !!process.env.SESSION_SECRET;
}

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (!generatedSecret) {
    generatedSecret = randomBytes(32).toString("hex");
    console.warn(
      "[forge-desk] SESSION_SECRET is not set — using a random per-process key. " +
        "Sessions will not survive a restart or span instances. Set it in production."
    );
  }
  return generatedSecret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  const expected = Buffer.from(keyHex, "hex");
  // Length check first: timingSafeEqual throws on a mismatch instead of
  // returning false, and the throw itself would leak the length.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id, or null for anything tampered with, malformed or expired. */
export function readSessionToken(
  token: string | undefined,
  now = Date.now()
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;

  const expected = Buffer.from(sign(`${userId}.${expiresAt}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry * 1000 < now) return null;
  return userId;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS
};

/** Viewers can read the whole desk but may not change it. */
export function canWrite(user: User | null): boolean {
  return user?.role === "owner";
}
