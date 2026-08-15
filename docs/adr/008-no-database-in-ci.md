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

## Revisit when

The Postgres driver is more than a thin mapping layer, or a SQL-only bug reaches production once. Either
is enough to justify the service container.
