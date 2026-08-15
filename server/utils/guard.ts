/**
 * Route guards and input helpers. Every mutating endpoint calls requireWriter;
 * every endpoint taking a body calls readValid. Skipping either is the bug
 * these exist to make obvious in review.
 */
import type { H3Event } from "h3";
import type { TypeOf, ZodTypeAny } from "zod";
import { canWrite } from "./auth";
import type { User } from "~~/types/domain";

export function requireUser(event: H3Event): User {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Sign in to continue" });
  }
  return user;
}

export function requireWriter(event: H3Event): User {
  const user = requireUser(event);
  if (!canWrite(user)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Read-only account — ask the owner to make this change"
    });
  }
  return user;
}

/** Turns a Zod failure into a 422 with per-field messages the form can render. */
function toValidationError(error: unknown): never {
  const issues = (error as any)?.issues;
  if (!Array.isArray(issues)) throw error;
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = issue.message;
  }
  throw createError({
    statusCode: 422,
    statusMessage: "Validation failed",
    data: { fields }
  });
}

/**
 * Generic over the schema, not over its result. `ZodSchema<T>` collapses a
 * schema's input and output types into one, which is wrong for every schema
 * using `.default()` or `.transform()` — there the caller sends a partial
 * object and gets a complete one back. Inferring from the schema keeps both
 * halves honest.
 */
export async function readValid<S extends ZodTypeAny>(
  event: H3Event,
  schema: S
): Promise<TypeOf<S>> {
  const body = await readBody(event).catch(() => ({}));
  const result = schema.safeParse(body ?? {});
  if (!result.success) toValidationError(result.error);
  return result.data;
}

export function queryValid<S extends ZodTypeAny>(event: H3Event, schema: S): TypeOf<S> {
  const result = schema.safeParse(getQuery(event));
  if (!result.success) toValidationError(result.error);
  return result.data;
}

/** 404s instead of returning null, so handlers stay one line. */
export function orNotFound<T>(value: T | null, what: string): T {
  if (value === null || value === undefined) {
    throw createError({ statusCode: 404, statusMessage: `${what} not found` });
  }
  return value;
}

/**
 * Fixed-window limiter kept in module scope.
 *
 * ponytail: per-instance counters — a multi-instance deploy multiplies the
 * effective limit by the instance count. Correct fix is Redis/Upstash; for a
 * demo login this stops credential stuffing from one host, which is the threat
 * that actually shows up.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(event: H3Event, key: string, limit: number, windowMs: number) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  const bucket = `${key}:${ip}`;
  const now = Date.now();
  const current = hits.get(bucket);

  if (!current || current.resetAt < now) {
    hits.set(bucket, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    return;
  }

  current.count++;
  if (current.count > limit) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    setResponseHeader(event, "retry-after", retryAfter);
    throw createError({
      statusCode: 429,
      statusMessage: `Too many attempts — try again in ${retryAfter}s`
    });
  }
}
