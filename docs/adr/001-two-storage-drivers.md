# 001 — Two storage drivers behind one interface

**Status:** Accepted · Aug 2026

## Context

The app has to satisfy three audiences at once:

1. A visitor opening the live URL, who must see real data immediately.
2. CI, which must run the full suite on every push without provisioning a database.
3. A reviewer who clones the repo and runs `npm run dev` with no `.env` file.

A single Postgres-only design fails 2 and 3. A single in-memory design fails 1 the moment a serverless
instance goes cold and someone's newly created client disappears.

## Decision

One `Repo` interface in `server/utils/repo.ts`, two implementations:

- `repo-postgres.ts` — used when `DATABASE_URL` is set.
- `repo-memory.ts` — used otherwise, and by every test.

`useRepo()` picks one per lambda instance and caches it. A malformed connection string logs loudly and
falls back to memory rather than taking the site down. `/api/health` reports which driver answered, and
the UI shows a banner when it is the memory one.

## Cost

Filtering, sorting and pagination are implemented twice, so the two can drift. Mitigated by keeping every
rule that can be pure — overdue, invoice totals, invoice numbering, the stats shape — in
`server/utils/logic.ts`, which both drivers call. The parts that genuinely differ are the query
mechanics: `Array.filter` versus a `WHERE` clause.

An interface with two implementations is the case where an interface earns itself. If the memory driver
were ever deleted, the interface should go with it.

## Revisit when

The memory driver stops being able to answer a query the Postgres one can. That is the signal the
abstraction has started lying, and at that point the honest move is to require a database everywhere and
run Postgres in CI as a service container.
