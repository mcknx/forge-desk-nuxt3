# 006 — Schema SQL loaded as a Nitro server asset

**Status:** Accepted · Aug 2026

## Context

`server/db/schema.sql` has to reach the running server. The obvious options each have a flaw:

- `readFileSync` at runtime — the file is not in the serverless bundle, so it works in dev and 500s in
  production.
- Paste the DDL into a TypeScript template string — now the file a reviewer reads and the SQL that runs
  are two artefacts that drift.
- A build step generating the TS from the SQL — machinery to maintain for one file.

## Decision

Declare the directory as a Nitro server asset:

```ts
nitro: {
  serverAssets: [
    { baseName: 'db', dir: fileURLToPath(new URL('./server/db', import.meta.url)) }
  ]
}
```

and read it with `useStorage('assets:db').getItem('schema.sql')`. Nitro bundles the file, the SQL stays
in a `.sql` file with syntax highlighting, and there is exactly one copy.

The path has to be absolute. The obvious `dir: './server/db'` resolves against Nitro's own srcDir, which
under Nuxt is `<root>/server` — so it looked in `<root>/server/server/db`, found nothing, and bundled no
SQL, without warning at build time. That shipped, and the failure is written up in ADR 008.

The DDL is idempotent — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` — so applying it on
cold start converges instead of needing a separate migration runner.

## Cost

Idempotent DDL only handles additive change. Renaming a column or adding a constraint to existing data
needs a real migration tool, because "if not exists" cannot express "alter what is already there".

## Revisit when

The first destructive schema change. That is the point to bring in a migration runner with ordered,
versioned files — not before.
