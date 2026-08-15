# Changelog

All notable changes to Forge Desk are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-15

First complete release: the Nuxt 3 flagship, the Nuxt 2 legacy twin and the Flutter companion all live
against one typed domain model.

### Added

- **Storage layer with two drivers behind one interface.** `server/utils/repo.ts` is the contract.
  `repo-postgres.ts` serves it when `DATABASE_URL` is set; `repo-memory.ts` serves it when it is not.
  `/api/health` names the driver that actually answered, and the UI shows a banner when the volatile one
  is serving, so the trade is never hidden. This is what lets CI run the whole suite with no database
  service and a reviewer clone the repo and see real data on `npm run dev` with no setup. (ADR 001)
- **Session auth with roles.** Signed `userId.expiry.hmac` cookie rather than a sessions table — one less
  round-trip per request on serverless, and rotating `SESSION_SECRET` invalidates every outstanding
  session. Passwords are scrypt with a per-user salt. Two seeded accounts: an owner who can change
  anything and a viewer whose writes come back 403. (ADR 002)
- **The domain: clients → tasks → time → invoices → activity.** 27 Nitro handlers across those five
  resources plus auth, health, stats, `sitemap.xml`, CSV time export and a demo reset. One `types/domain.ts`
  defines the shapes; `server/db/schema.sql`, `server/utils/schema.ts` and the Dart models all answer to it.
- **Money as integers.** Rates, line items and totals are minor units, tax is basis points, and rounding
  happens once at the end in `server/utils/logic.ts`. Both storage drivers call those same pure functions,
  so an invoice total has exactly one definition. (ADR 003)
- **Validation at every trust boundary.** Every request body and query string passes a zod schema before it
  reaches storage; failures return 422 with per-field messages the forms render inline.
- **UI.** 14 pages and 23 components — dashboard with hand-rolled SVG charts, list views with filters held
  in the URL so any view is linkable, forms with inline field errors, toasts, dark mode, print styles for
  invoices, and a style guide page. Keyboard-complete and labelled throughout. (ADR 005, ADR 007)
- **i18n.** English and Filipino message catalogues via vue-i18n, with locale held in a composable.
- **Tests and CI.** 121 vitest unit tests across 5 files, plus 17 Playwright cases — 10 desk journeys and
  7 accessibility checks — run against a real production build. GitHub Actions runs the contract/seed
  check, typecheck, unit tests, build and end-to-end on every push, with no database service, and a
  second job proves the Nuxt 2 app still generates. (ADR 008)
- **Docs.** `MIGRATION.md` maps 47 Nuxt 2→3 concepts across 1,850 lines with before/after code from both
  repos, and eight architecture decision records in `docs/adr/`.

### Fixed

- **Every public asset 500s when self-hosted.** Nitro's node-server preset rewrites `import.meta.url` to
  `_importMeta_.url` everywhere except inside `readAsset()`, where it ships raw. Public assets then resolve
  two directories too deep, so every CSS file, JS bundle, favicon and prerendered page returns 500.
  Reproduced on a pristine `nuxt build`; patched from a `nitro:init` hook in `nuxt.config.ts`.
- **Every error page returned 500 instead of its real status.** `@pinia/nuxt` registers a global SSR payload
  reducer that calls `.hasOwnProperty()` on every value in the payload. Nuxt builds its error payload from
  h3's `getQuery()`, which returns a null-prototype object, so the call throws mid-serialisation and Nuxt
  answers 500 — turning every 404 and 403 into a 500. Fixed in `plugins/pinia-payload-fix.server.ts` by
  re-registering the same reducer key with a prototype-safe equivalent.
- **The client edit page was unreachable.** `pages/clients/[id].vue` alongside `pages/clients/[id]/edit.vue`
  makes Nuxt treat `[id].vue` as the parent route, silently swallowing the child. Renamed to
  `pages/clients/[id]/index.vue`.
- **The auth guard ran before sessions existed.** Nitro orders server middleware alphabetically, so the guard
  executed before the session resolver had populated the context and every authenticated request looked
  anonymous. Fixed by numbering the files `1.session.ts` and `2.owner-routes.ts`.
- **The Postgres driver could never find its schema.** `nitro.serverAssets` declared `dir: './server/db'`.
  Nitro resolves that against its own srcDir — `<root>/server` under Nuxt — so it looked in
  `<root>/server/server/db`, bundled no SQL, and `applySchema()` threw "schema.sql not found in server
  assets" on the first real connection. The build gave no warning. Fixed with an absolute path,
  `fileURLToPath(new URL('./server/db', import.meta.url))`. (ADR 006, ADR 008)
- **An invoice rendered 123 rows of single characters.** Writes used `${JSON.stringify(lines)}::jsonb`, but
  postgres.js already JSON-encodes its parameters, so the column held a jsonb *string* rather than an array.
  `v-for="line in invoice.lines"` then iterated the string one character at a time. Fixed by passing
  `sql.json(lines)`, with a parse fallback in `toInvoice` for rows written before the fix. (ADR 008)

### Security

- Login is rate limited and does the same work whether or not the account exists, so response time is not an
  account-enumeration oracle.
- Writes are role-checked server-side, not only hidden in the UI: all 12 mutating endpoints call
  `requireWriter` from `server/utils/guard.ts`, so a viewer session gets 403 on every mutation regardless of
  what it posts. `server/middleware/2.owner-routes.ts` separately guards the owner-only *pages* before
  render, because an error thrown from async route middleware loses its status and comes back 500.
- Session cookies are `httpOnly`, `sameSite`, signed with HMAC and carry an expiry inside the signed payload,
  so a client cannot extend its own session.
- The demo credentials are public deliberately and printed on the login page. They guard nothing real: the
  data is a deterministic seed with a reset button.

[1.0.0]: https://forge-desk-nuxt3.vercel.app/
