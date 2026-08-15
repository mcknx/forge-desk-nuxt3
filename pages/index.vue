<script setup lang="ts">
definePageMeta({ layout: 'default' })

const SITE = 'https://forge-desk-nuxt3.vercel.app'
const DESCRIPTION =
  'A freelance operations desk — clients, tasks, timesheets and invoices — built as one domain model served to a Nuxt 3 app, a Nuxt 2 legacy slice and a Flutter companion.'

const surfaces = [
  {
    badge: 'Primary',
    tone: 'blue' as const,
    title: 'Nuxt 3 app',
    stack: 'Nuxt 3 · Nitro · Pinia · Tailwind',
    body: 'Server-rendered lists with URL-bound filters, a typed Nitro REST API, zod at every trust boundary, signed-cookie sessions and role-gated writes.',
    points: ['SSR list pages with real pagination', 'Zod-validated API, 422s carry field errors', 'Owner/viewer roles enforced server-side'],
  },
  {
    badge: 'Legacy',
    tone: 'amber' as const,
    title: 'Nuxt 2 slice',
    stack: 'Nuxt 2 · Options API · Vuex',
    body: 'The same client and task screens as they existed before the migration, kept runnable so the diff between the two eras is something you can open rather than something I claim.',
    points: ['asyncData and Vuex, not composables', 'Same REST contract, older data flow', 'MIGRATION.md walks the delta'],
  },
  {
    badge: 'Companion',
    tone: 'green' as const,
    title: 'Flutter app',
    stack: 'Flutter · Dart models',
    body: 'A read-and-log mobile client hitting the same API from a second origin, which is why the Nitro routes carry CORS and the domain types are mirrored in Dart.',
    points: ['Dart models mirror types/domain.ts', 'Cross-origin auth against the same API', 'Log time from a phone, see it on the desk'],
  },
]

const features = [
  ['Money never touches a float', 'Rates, line items and totals are integers in minor units. Tax is basis points. Rounding happens once, at the end.'],
  ['Two storage drivers', 'Postgres when DATABASE_URL is set, an in-process store when it is not. /api/health names which one answered, and the app says so on screen.'],
  ['Validation at the boundary', 'Every body and query string goes through a zod schema before it reaches storage. Failures come back as 422s with per-field messages the form renders.'],
  ['Invoices from real time', 'Billing groups unbilled billable entries by task, stamps them with the invoice id, and refuses to bill the same minute twice.'],
  ['Filters that live in the URL', 'Search, status, sort and page are query-string state, so a filtered list is a link you can send someone.'],
  ['Accessible by default', 'Skip link, focus-visible rings on every control, real empty states, tables that scroll inside themselves instead of shoving the page sideways.'],
  ['Deterministic seed data', 'A fixed PRNG seed means the demo, the tests and the screenshots all describe the same numbers.'],
  ['Rate-limited auth', 'Fixed-window limiting on login, constant-work password checks, and a signed stateless session cookie with a 12-hour TTL.'],
]

useSeoMeta({
  title: 'Freelance ops desk, built three ways',
  description: DESCRIPTION,
  ogTitle: 'Forge Desk — freelance ops desk, built three ways',
  ogDescription: DESCRIPTION,
  ogType: 'website',
  ogUrl: SITE,
  ogSiteName: 'Forge Desk',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Forge Desk — freelance ops desk, built three ways',
  twitterDescription: DESCRIPTION,
})

useHead({
  link: [{ rel: 'canonical', href: SITE }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Forge Desk',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Android, iOS',
        url: SITE,
        description: DESCRIPTION,
        author: { '@type': 'Person', name: 'McKeen Asma' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }),
    },
  ],
})
</script>

<template>
  <div class="space-y-20 sm:space-y-24">
    <section class="pt-4 sm:pt-10">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
        Portfolio build · one domain model, three surfaces
      </p>
      <h1 class="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
        A freelance ops desk that survives contact with real data.
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
        Clients, tasks, timesheets and invoices behind one typed domain model — served to a Nuxt 3 app, a Nuxt 2
        legacy slice and a Flutter companion. Sign in with the public demo account and change anything you like.
      </p>

      <div class="mt-9 flex flex-wrap items-center gap-3">
        <UiButton to="/dashboard" variant="primary">Open the dashboard</UiButton>
        <UiButton to="/style-guide" variant="ghost">See the component kit</UiButton>
      </div>

      <dl class="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
        <div v-for="[term, value] in [['Demo email', 'demo@forgedesk.dev'], ['Password', 'forge-desk-demo'], ['Read-only', 'viewer@forgedesk.dev']]" :key="term" class="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ term }}</dt>
          <dd class="mt-1 truncate font-mono text-sm text-slate-900 dark:text-slate-100">{{ value }}</dd>
        </div>
      </dl>
    </section>

    <section>
      <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">Three surfaces, one contract</h2>
      <p class="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
        The interesting part of this project is not any one app. It is that <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] dark:bg-slate-800">types/domain.ts</code>
        is the single definition of what a client, a task and an invoice are, and three very different clients
        have to agree with it.
      </p>

      <div class="mt-8 grid gap-6 lg:grid-cols-3">
        <UiCard v-for="surface in surfaces" :key="surface.title">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-lg font-semibold">{{ surface.title }}</h3>
              <UiBadge :tone="surface.tone">{{ surface.badge }}</UiBadge>
            </div>
            <p class="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">{{ surface.stack }}</p>
          </template>

          <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{{ surface.body }}</p>
          <ul class="mt-4 space-y-2">
            <li v-for="point in surface.points" :key="point" class="flex gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <span aria-hidden="true" class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              <span>{{ point }}</span>
            </li>
          </ul>
        </UiCard>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-semibold tracking-tight sm:text-3xl">The decisions worth defending</h2>
      <p class="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
        Every one of these is a thing that bites in production, handled here rather than deferred.
      </p>

      <div class="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="[title, body] in features" :key="title">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{{ body }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-amber-300/60 bg-amber-50 p-6 dark:border-amber-500/25 dark:bg-amber-500/5 sm:p-8">
      <h2 class="text-lg font-semibold text-amber-900 dark:text-amber-200">What this actually is</h2>
      <div class="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/80">
        <p>
          Forge Desk is a portfolio build, not a product and not client work. Nobody's real business runs on it and
          no invoice here was ever sent to anybody.
        </p>
        <p>
          The code is public, the demo credentials above are public on purpose, and the data is a deterministic seed
          you can reset from the dashboard at any time — so treat anything you type into it as visible to the next
          visitor.
        </p>
        <p>
          If the deploy has no database attached it falls back to an in-process store and writes vanish on the next
          cold start. The app tells you that in a banner rather than letting you find out by losing work.
        </p>
      </div>
    </section>

    <section class="border-t border-slate-200 pt-12 dark:border-slate-800">
      <h2 class="text-2xl font-semibold tracking-tight">Go and poke at it</h2>
      <p class="mt-3 max-w-xl text-slate-600 dark:text-slate-400">
        The dashboard reads every number off the API. The style guide is the full component kit with its prop
        tables, which is the fastest way to judge the front-end work.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <UiButton to="/login" variant="primary">Sign in with the demo account</UiButton>
        <UiButton to="/style-guide" variant="subtle">Component kit</UiButton>
      </div>
    </section>
  </div>
</template>
