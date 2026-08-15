# Forge Desk

[![CI](https://github.com/mcknx/forge-desk-nuxt3/actions/workflows/ci.yml/badge.svg)](https://github.com/mcknx/forge-desk-nuxt3/actions/workflows/ci.yml)

A freelance operations desk — clients, tasks, timesheets, invoices — behind one typed domain model, served
to a Nuxt 3 app, a Nuxt 2 legacy slice and a Flutter companion.

Live: **https://forge-desk-nuxt3.vercel.app/**

Sign in and change anything. The data is a deterministic seed and there is a reset button on the dashboard.

| Account                  | Password          | Can                                         |
| ------------------------ | ----------------- | ------------------------------------------- |
| `demo@forgedesk.dev`     | `forge-desk-demo` | everything — create, edit, invoice, reset    |
| `viewer@forgedesk.dev`   | `forge-desk-demo` | read only; every write comes back 403        |

```bash
npm install && npm run dev
```

No `.env` needed. Without one the app runs on an in-process store seeded from `data/seed.json`, and says so
in a banner. `.env.example` documents what each variable changes.

## Architecture

Nuxt 3.17 (SSR) · Nitro API · Pinia · Tailwind · zod · vue-i18n · TypeScript strict.

**One domain model.** `types/domain.ts` defines what a client, task, time entry and invoice are. `server/db/schema.sql`,
`server/utils/schema.ts` and the Dart models in the Flutter companion all answer to it.

**Two storage drivers behind one interface.** `server/utils/repo.ts` is the contract; `repo-postgres.ts` serves it when
`DATABASE_URL` is set and `repo-memory.ts` serves it when it is not. That is not indirection for its own sake — it is
what lets the demo stay live before a database is attached, lets CI run the whole suite with no database service, and
lets a reviewer clone the repo and see real data on `npm run dev` with zero setup. `/api/health` names the driver that
actually answered, and the UI shows a banner when it is the volatile one, so nothing about the trade is hidden.

**Stateless sessions.** The session cookie is a signed `userId.expiry.hmac` triple, not a row in a sessions table. On
serverless that removes a database round-trip from every request, and there is no logout-everywhere requirement here to
justify server state. Rotating `SESSION_SECRET` invalidates every outstanding session, which is the escape hatch if one
leaks. Passwords are scrypt with a per-user salt; the login route is rate limited and does the same work whether or not
the account exists, so response time is not an account-enumeration oracle.

**Money never touches a float.** Rates, line items and totals are integers in minor units; tax is basis points; rounding
happens once, at the end, in `server/utils/logic.ts`. Both drivers call those same pure functions, so "what an invoice
total is" has exactly one definition.

**Validation at the boundary.** Every request body and query string passes a zod schema before it reaches storage.
Failures come back as 422s carrying per-field messages the forms render inline.

The reasoning behind each of these lives in `docs/adr/` as eight short decision records.

## Tests

| Command             | What runs                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `npm run check`     | contract files exist, `en`/`fil` translations agree both ways, seed referential integrity   |
| `npm run typecheck` | `vue-tsc`, strict                                                                           |
| `npm run test`      | 121 vitest unit tests — invoice maths, overdue rules, pagination, zod schemas, scrypt and session tokens, the memory driver, the formatters |
| `npm run test:e2e`  | Playwright journeys against a real production build                                        |
| `npm run verify`    | check → typecheck → test → build                                                            |

`e2e/desk.spec.ts` walks the journeys that would embarrass the app if they broke: the auth redirect carries its
`?redirect=`, a bad password shows the server's own message, search moves the URL and narrows the table, a client
survives create-edit-reload, the overdue filter leaves only late work, logging time moves the client's unbilled figure,
and the read-only account is refused by the server rather than only by a hidden button.

`e2e/a11y.spec.ts` audits `/`, `/login`, `/dashboard`, `/clients` and `/style-guide` for unnamed form controls, images
without alt text, more or fewer than one `h1`, skipped heading levels and a skip link that is not the first tab stop —
then drives the command palette and a modal entirely on the keyboard.

CI (`.github/workflows/ci.yml`) runs all of it on Node 20 with no database service, so the memory driver's
correctness is a tested claim rather than an asserted one.

## Accessibility and performance

Lighthouse against the live URL, measured 15 Aug 2026:

| Performance | Accessibility | Best practices | SEO |
|---|---|---|---|
| 96 | 100 | 100 | 100 |

LCP 1.9s · CLS 0.064 · TBT 10ms. Reproduce with
`npx lighthouse https://forge-desk-nuxt3.vercel.app/ --only-categories=performance,accessibility,best-practices,seo`.

Skip link on every page, a single `:focus-visible` rule so nothing focusable is ever invisible, real empty states on
every list, `aria-sort` on sortable columns, focus trapped and restored around modals, a keyboard-driven command
palette, and tables that scroll inside themselves so the page body never moves sideways. Motion respects
`prefers-reduced-motion`. Dark mode is a class on `<html>`, so the toggle can override the OS.

The marketing page and style guide are prerendered; desk pages are SSR'd per request and never cached. Charts are
hand-rolled inline SVG rather than a charting library — the whole client bundle stays smaller than one would have been.
Every `Intl` formatter pins its locale and timezone so the server and the browser render the same string.

## Honest note

This is a portfolio build from August 2026, not client work and not a product. Nobody's business runs on it and no
invoice here was ever sent to anyone. The demo credentials are public on purpose, anything typed into the demo is
visible to the next visitor, and when the deploy has no database attached the writes vanish on the next cold start —
which the app says on screen rather than letting you find out by losing work.

## File map

```
app.vue error.vue          shell, title template, error page
types/domain.ts            the domain model everything answers to
server/
  utils/schema.ts          zod schemas — the validation contract
  utils/logic.ts           pure rules: invoice maths, overdue, stats, pagination
  utils/repo.ts            storage interface + driver selection
  utils/repo-memory.ts     in-process driver (demo, CI, local)
  utils/repo-postgres.ts   Postgres driver
  utils/auth.ts            scrypt + signed session cookies
  utils/guard.ts           requireUser / requireWriter / readValid / rateLimit
  middleware/1.session.ts  resolves the cookie into event.context.user
  middleware/2.owner-routes.ts  403s a viewer on owner-only pages
                           (numbered — Nitro runs these alphabetically)
  api/                     clients, tasks, time, invoices, activity, stats,
                           export, health, sitemap, demo reset, auth
  db/schema.sql            served as a Nitro asset, one definition
pages/                     marketing, login, dashboard, clients, tasks, time,
                           invoices, style guide
components/                Ui* kit, badges, charts, app chrome, command palette
composables/               useAuth, useToast, useTheme, useLocale, useListQuery
stores/                    Pinia: desk data, UI state
utils/format.ts            money, hours, dates, initials — locale-pinned
middleware/                auth, owner-only route guards
i18n/                      en + fil, kept in step by npm run check
data/seed.json             deterministic seed (regenerate: npm run seed)
test/                      vitest unit specs
e2e/                       Playwright journeys + accessibility audit
docs/adr/                  eight decision records
```

## Related

- Nuxt 2 legacy slice: `../forge-desk-nuxt2/` — the same screens before the migration
- Migration notes: `MIGRATION.md`
- Flutter companion: `../forge-desk-flutter/`
