# 008 — CI runs against the memory driver

**Status:** Accepted · Aug 2026

## Context

The test suite needs storage. The usual answer is a Postgres service container in the workflow, which
adds startup time to every run and a second place where connection configuration can be wrong.

## Decision

CI sets no `DATABASE_URL`, so `useRepo()` selects the memory driver and the whole suite — unit,
integration and Playwright end-to-end — runs against it. No service container, no migration step, no
credentials in the workflow.

Test isolation comes from `repo.reset()` in `beforeEach`, which rebuilds state from `data/seed.json`.
Because the seed is generated deterministically, every run asserts against the same numbers.

## Cost

**The SQL is not exercised by CI.** Anything the Postgres driver alone can get wrong — a typo in a query,
a bad column mapping, a transaction that does not roll back — passes CI and fails in production. That is
a real hole, not a theoretical one.

It is covered partially rather than pretended away: `/api/health` runs a live query and names the driver,
so a broken Postgres path shows up on the first request after deploy rather than silently.

## What actually happened — 2026-08-15

A database was attached for the first time. The driver had never run. **Two bugs surfaced within
minutes**, both invisible to a green CI run:

1. **The schema never loaded.** `nitro.serverAssets` was configured as `dir: './server/db'`. Nitro
   resolves that relative to its own srcDir, which under Nuxt is `<root>/server` — so it looked in
   `<root>/server/server/db`, found nothing, and bundled no SQL. `applySchema()` threw
   *"schema.sql not found in server assets"*. Fixed with an absolute path via `import.meta.url`.

2. **Invoice lines were double-encoded.** Writes used `${JSON.stringify(lines)}::jsonb`, but postgres.js
   JSON-encodes parameters itself, so the column held a jsonb *string* rather than an array —
   `jsonb_typeof` returned `string`. The invoice page does `v-for="line in invoice.lines"`, and
   iterating a string yields characters, so it rendered **123 rows of single characters** instead of one
   line. Fixed with `sql.json()`, plus a parse fallback in `toInvoice` for rows already written.

Bug 1 failed loudly and safely: the driver threw, `useRepo()` fell back to memory, and the app kept
serving — only `/api/health` revealed it, exactly as this ADR intended. Bug 2 did not. It would have
reached a visitor as a garbled invoice, and nothing in 234 passing tests would have said a word.

That is the cost of this decision, paid in full and on schedule.

## Revisit when

Already due. The stated trigger was "a SQL-only bug reaches production once" — two did. The driver is no
longer a thin mapping layer either: it carries a transaction with `FOR UPDATE` locks, a window-function
pagination count and a jsonb column. **Next change to `repo-postgres.ts` should come with a Postgres
service container in CI**, running the existing `repo-memory.spec.ts` suite against both drivers to prove
they still agree.
