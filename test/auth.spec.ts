import { describe, expect, it } from "vitest";
import {
  canWrite,
  createSessionToken,
  hashPassword,
  readSessionToken,
  verifyPassword
} from "../server/utils/auth";
import type { User } from "~~/types/domain";

const PASSWORD = "forge-desk-demo";
const TTL_MS = 12 * 60 * 60 * 1000;
// A whole second so floor(now / 1000) loses nothing and the expiry boundary is exact.
const NOW = 1_770_000_000_000;

function user(role: User["role"]): User {
  return {
    id: "u1",
    email: "demo@forgedesk.dev",
    name: "McKeen Asma",
    role,
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("hashPassword", () => {
  it("salts, so the same password never hashes to the same string twice", async () => {
    const [a, b] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);
    expect(a).not.toBe(b);
    expect(a.split(":")).toHaveLength(2);
  });

  it("stores salt and key as hex of the expected length", async () => {
    const [saltHex, keyHex] = (await hashPassword(PASSWORD)).split(":");
    expect(saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(keyHex).toMatch(/^[0-9a-f]{128}$/);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password against either of two salted hashes", async () => {
    const [a, b] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);
    expect(await verifyPassword(PASSWORD, a)).toBe(true);
    expect(await verifyPassword(PASSWORD, b)).toBe(true);
  });

  it("rejects the wrong password, including a near miss", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword("wrong", stored)).toBe(false);
    expect(await verifyPassword(`${PASSWORD} `, stored)).toBe(false);
    expect(await verifyPassword(PASSWORD.toUpperCase(), stored)).toBe(false);
  });

  it("rejects an empty password against a real hash", async () => {
    expect(await verifyPassword("", await hashPassword(PASSWORD))).toBe(false);
  });

  it("rejects a truncated hash instead of throwing", async () => {
    const stored = await hashPassword(PASSWORD);
    await expect(verifyPassword(PASSWORD, stored.slice(0, -10))).resolves.toBe(false);
  });

  it("rejects malformed stored values of every shape", async () => {
    expect(await verifyPassword(PASSWORD, "")).toBe(false);
    expect(await verifyPassword(PASSWORD, "no-colon-here")).toBe(false);
    expect(await verifyPassword(PASSWORD, ":")).toBe(false);
    expect(await verifyPassword(PASSWORD, "abcd:")).toBe(false);
    expect(await verifyPassword(PASSWORD, ":abcd")).toBe(false);
    // Non-hex parses to an empty buffer; the length check has to catch it.
    expect(await verifyPassword(PASSWORD, "zzzz:zzzz")).toBe(false);
  });

  it("rejects the placeholder hash the login route uses for unknown users", async () => {
    expect(await verifyPassword(PASSWORD, "x:y")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a user id", () => {
    const token = createSessionToken("u1", NOW);
    expect(readSessionToken(token, NOW)).toBe("u1");
  });

  it("is a three-part payload.expiry.signature token", () => {
    const parts = createSessionToken("u1", NOW).split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("u1");
    expect(Number(parts[1])).toBe(Math.floor(NOW / 1000) + TTL_MS / 1000);
  });

  it("rejects a tampered signature", () => {
    const [id, exp, sig] = createSessionToken("u1", NOW).split(".");
    const flipped = sig!.slice(0, -1) + (sig!.endsWith("a") ? "b" : "a");
    expect(readSessionToken(`${id}.${exp}.${flipped}`, NOW)).toBeNull();
    expect(readSessionToken(`${id}.${exp}.${sig!.slice(0, -1)}`, NOW)).toBeNull();
  });

  it("rejects a swapped user id — the whole point of signing the payload", () => {
    const [, exp, sig] = createSessionToken("u1", NOW).split(".");
    expect(readSessionToken(`u2.${exp}.${sig}`, NOW)).toBeNull();
  });

  it("rejects a stretched expiry", () => {
    const [id, exp, sig] = createSessionToken("u1", NOW).split(".");
    expect(readSessionToken(`${id}.${Number(exp) + 86_400}.${sig}`, NOW)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(readSessionToken(undefined, NOW)).toBeNull();
    expect(readSessionToken("", NOW)).toBeNull();
    expect(readSessionToken("nonsense", NOW)).toBeNull();
    expect(readSessionToken("u1.123", NOW)).toBeNull();
    expect(readSessionToken("u1.123.sig.extra", NOW)).toBeNull();
  });

  it("expires exactly at the 12-hour mark", () => {
    const token = createSessionToken("u1", NOW);
    expect(readSessionToken(token, NOW + TTL_MS - 1000)).toBe("u1");
    expect(readSessionToken(token, NOW + TTL_MS)).toBe("u1");
    expect(readSessionToken(token, NOW + TTL_MS + 1)).toBeNull();
    expect(readSessionToken(token, NOW + TTL_MS + 86_400_000)).toBeNull();
  });
});

describe("canWrite", () => {
  it("is owner-only", () => {
    expect(canWrite(user("owner"))).toBe(true);
    expect(canWrite(user("viewer"))).toBe(false);
    expect(canWrite(null)).toBe(false);
  });
});
