# 002 — Stateless signed-cookie sessions

**Status:** Accepted · Aug 2026

## Context

Every request that renders the desk needs to know who is asking. On serverless, a sessions table means a
database round-trip before any page can start rendering — on the critical path of every single request,
including the ones that would otherwise be cached.

## Decision

The session cookie carries `userId.expiresAt.hmac`, signed with `SESSION_SECRET` using HMAC-SHA256.
`server/middleware/1.session.ts` verifies the signature, checks expiry, and loads the user. The numeric
prefix is load-bearing rather than decorative: Nitro runs server middleware in alphabetical order, so
before the rename the owner guard sorted ahead of the session resolver and every authenticated request
looked anonymous to it.

Signature comparison uses `timingSafeEqual`, with a length check first because `timingSafeEqual` throws
on mismatched lengths — and the throw would itself leak the length.

Passwords are scrypt with a per-password random salt, stored as `salt:key` hex. Login compares in
constant time and does the same work whether or not the email exists, so response timing is not an
account-enumeration oracle.

An unset `SESSION_SECRET` generates a **random** key per process rather than falling back to a fixed
string. A hardcoded default in a public repo is a published signing key — anyone could mint a valid
session. Random degrades to "sessions do not survive a restart or span instances", which is an annoyance
rather than a hole, and `/api/health` reports `sessionSecretConfigured` so the degraded mode is visible
instead of silent.

An earlier version threw on startup instead. That was stricter and worse: it took the public demo down
whenever the variable was missing, which made the *safe* configuration the one nobody could use.

## Cost

No server-side revocation. Signing out clears the cookie on that device; a stolen token stays valid until
it expires, up to 12 hours. The blunt instrument is rotating `SESSION_SECRET`, which invalidates every
outstanding session at once.

## Revisit when

There is a real requirement to sign a specific device out, or sessions need to outlive 12 hours. Either
one means storing a token id server-side, and at that point the round-trip is the price of the feature
rather than a habit.
