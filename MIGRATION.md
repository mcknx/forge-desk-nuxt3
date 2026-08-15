# Nuxt 2 → Nuxt 3: Forge Desk, migrated concept by concept

Forge Desk exists twice, over one fixture, on purpose.

- **`../forge-desk-nuxt2`** — the legacy console. Options API, `asyncData`, `fetch()`, Vuex with a
  namespaced module, `Vue.filter`, `head()`, `_id.vue` routing, `target: 'static'`. No server.
- **`.` (`forge-desk-nuxt3`)** — the same product. `<script setup>`, `useFetch`/`useAsyncData`/`$fetch`,
  Pinia setup stores, `useSeoMeta`, `[id].vue` routing, a Nitro API, Postgres or an in-process driver.

Both read the same `data/seed.json` — 12 clients, 48 tasks, 110 time entries, 6 invoices — and both
enforce the same four rules (money in minor units, a done task is never overdue, an undated task sorts
last in both directions, paging clamps). If the two apps ever disagree on a row, one of them has a bug.

Every snippet below is lifted from those two repos with its real path. Nothing here is illustrative.

---

## The two-minute version

| # | Concern | Nuxt 2 | Nuxt 3 |
|---|---------|--------|--------|
| 1 | Flat dynamic route | `pages/tasks/_id.vue` | `pages/tasks/[id].vue` |
| 2 | Nested dynamic route | `pages/clients/_id/index.vue` | `pages/clients/[id].vue`, `pages/clients/[id]/edit.vue` |
| 3 | Catch-all | `pages/_.vue` | `pages/[...slug].vue` |
| 4 | Route params | `asyncData({ params })` | `useRoute().params.id` |
| 5 | Query string | `this.$route.query` in `created()` | `useRoute()` inside `useListQuery` |
| 6 | Links | `<nuxt-link>` | `<NuxtLink>` |
| 7 | Page outlet | `<nuxt />` in the layout | `<slot />` in the layout, `<NuxtPage />` in `app.vue` |
| 8 | Page data | `asyncData()` merged into `data` | `useAsyncData()` returning refs |
| 9 | Store-filling hook | `fetch()` | store action called from setup |
| 10 | Imperative call | none (synchronous module read) | `$fetch` / `useRequestFetch()` |
| 11 | 404 from a page | `error({ statusCode: 404 })` | `throw createError({ statusCode: 404, fatal: true })` |
| 12 | The API | `lib/data.js` over a bundled JSON | `server/api/**` — 27 Nitro handlers |
| 13 | Server middleware | none | `server/middleware/session.ts` |
| 14 | Server assets | none | `nitro.serverAssets` + `useStorage('assets:db')` |
| 15 | Per-route rendering | `generate.routes()` | `routeRules` |
| 16 | Store | `store/index.js`, auto-registered Vuex | `stores/desk.ts`, `defineStore` + `@pinia/nuxt` |
| 17 | Store module | `store/tasks.js` → `tasks/` namespace | a second `defineStore('ui', …)` |
| 18 | Store internals | `state/getters/mutations/actions` | `ref` / `computed` / plain functions |
| 19 | Reading the store | `mapState`, `mapGetters` | direct access + `storeToRefs` |
| 20 | Store bootstrap | `nuxtServerInit` | no equivalent — `useState`, a plugin, or an action |
| 21 | Component style | `export default { … }` | `<script setup lang="ts">` |
| 22 | Props | `props: { error: { type: Object } }` | `defineProps<{…}>()` + `withDefaults` |
| 23 | Emits | implicit `this.$emit` | `defineEmits<{ close: [] }>()` |
| 24 | `v-model` contract | `value` + `input` | `modelValue` + `update:modelValue` / `defineModel()` |
| 25 | `.sync` | `:foo.sync="bar"` | `v-model:foo="bar"` |
| 26 | Slots | `<nuxt />`, `slot-scope` | `<slot />`, `<slot name="footer" />`, `$slots.header` |
| 27 | Functional components | `functional: true` | a normal SFC — the option is gone |
| 28 | Auto-imports | `components: false`, explicit imports | components, composables and `utils/` auto-imported |
| 29 | Portals | `<portal>` | `<Teleport to="body">` |
| 30 | Local state | `data()` | `ref()` / `reactive()` |
| 31 | Derived state | `computed: { … }` | `computed(() => …)` |
| 32 | Watchers | `watch: { q(value) {} }` | `watch(source, cb)` |
| 33 | Reactivity escape hatch | `this.$set`, whole-object replacement | direct assignment — Proxy sees it |
| 34 | Lifecycle | `created` / `beforeDestroy` / `destroyed` | setup body / `onBeforeUnmount` / `onUnmounted` |
| 35 | Formatting | `Vue.filter('money', …)` | `utils/format.ts`, auto-imported |
| 36 | Head / SEO | `head()` returning `{ title, meta }` | `useSeoMeta()` / `useHead()` |
| 37 | Error page | `layouts/error.vue` taking an `error` prop | root `error.vue` + `useError()` + `clearError()` |
| 38 | Per-page layout | `layout: 'print'` | `definePageMeta({ layout: 'print' })` |
| 39 | Route middleware | `middleware: 'track'` + a plain function | `definePageMeta({ middleware: 'auth' })` + `defineNuxtRouteMiddleware` |
| 40 | Plugins | `plugins: ['~/plugins/filters.js']` | `defineNuxtPlugin(nuxtApp => …)` |
| 41 | Transitions | on by default | `app.pageTransition` + CSS you must write |
| 42 | Config | `nuxt.config.js`, plain object | `nuxt.config.ts`, `defineNuxtConfig` |
| 43 | Env | none | `runtimeConfig` + `useRuntimeConfig()` |
| 44 | Modules | `modules` / `buildModules` | `modules` only |
| 45 | TypeScript | none | `typescript: { strict: true }`, `nuxt typecheck` |
| 46 | Aliases | `~/lib/data` | `~~/types/domain` |
| 47 | Build output | `nuxt generate` → `dist/` | `nuxt build` → `.output/` |

Sizes, for scale: the Nuxt 2 app is **2,846 lines** across 6 pages, 2 layouts, 2 Vuex files, 1 plugin,
1 middleware. The Nuxt 3 app is **10,113 lines** across 14 pages, 23 components, 5 composables, 2 Pinia
stores, 27 API handlers, 121 unit tests and 17 Playwright cases.

---

## 1. Routing

### 1.1 Flat dynamic route

`_id.vue` → `[id].vue`. Same segment, different spelling.

```
forge-desk-nuxt2/pages/tasks/_id.vue      →  forge-desk-nuxt3/pages/tasks/[id].vue
```

### 1.2 Nested dynamic route

Nuxt 2 needs a directory with an `index.vue` inside it the moment the segment has children. Nuxt 3 lets
the file and the directory coexist:

```
forge-desk-nuxt2/pages/clients/_id/index.vue
      ↓
forge-desk-nuxt3/pages/clients/[id].vue          # the detail page
forge-desk-nuxt3/pages/clients/[id]/edit.vue     # /clients/c1/edit
```

That is the single most common surprise in a real migration: `_id/index.vue` **is** `[id].vue`, not
`[id]/index.vue`. Getting it wrong gives you a route that resolves but renders the wrong component.

### 1.3 Catch-all

`pages/_.vue` → `pages/[...slug].vue`. Neither app ships one — unmatched URLs fall through to the error
surface (§9) — but the rename is the same shape as §1.1 and is worth knowing before you go looking for a
missing file.

### 1.4 Route params

**Nuxt 2** — `pages/tasks/_id.vue`, params arrive on the context:

```js
asyncData({ params, error }) {
  const task = getTask(params.id)
  if (!task) {
    return error({ statusCode: 404, message: 'No task with id "' + params.id + '".' })
  }
  // …
}
```

**Nuxt 3** — `pages/tasks/[id].vue`, params come from a composable:

```ts
const id = useRoute().params.id as string
```

### 1.5 Reading the query string

**Nuxt 2** — `pages/tasks/index.vue`, a `created()` hook copies the URL into the store:

```js
created() {
  // Links from the dashboard and the client detail page land here with a
  // query string; adopt it as the module's filter state.
  const query = this.$route.query
  const patch = {}
  if (query.q) patch.q = query.q
  if (query.clientId) patch.clientId = query.clientId
  if (query.status) patch.status = query.status
  if (query.overdue === '1' || query.overdue === 'true') patch.overdue = true
  if (Object.keys(patch).length) {
    this.$store.commit('tasks/setFilter', patch)
    this.q = this.$store.state.tasks.filters.q
  }
}
```

**Nuxt 3** — `composables/useListQuery.ts` makes the URL the state, in both directions:

```ts
const filters = reactive({ ...defaults, ...fromUrl(route.query) }) as T

// Back/forward navigation changes the URL without going through setFilter.
watch(
  () => route.query,
  (query) => Object.assign(filters, defaults, fromUrl(query)),
)
```

The Nuxt 2 version reads the URL once, on entry. The Nuxt 3 version stays bound to it, which is why the
back button walks filter history instead of doing nothing.

### 1.6 Links and the page outlet

**Nuxt 2** — `layouts/default.vue`:

```html
<nuxt-link to="/clients">Clients</nuxt-link>
…
<main class="wrap page">
  <nuxt />
</main>
```

**Nuxt 3** — `layouts/default.vue` uses an ordinary slot, and `app.vue` owns the page outlet:

```html
<!-- layouts/default.vue -->
<main id="main" tabindex="-1" class="…">
  <slot />
</main>
```

```html
<!-- app.vue -->
<NuxtLayout>
  <NuxtPage />
</NuxtLayout>
```

---

## 2. Data fetching

### 2.1 `asyncData` → `useAsyncData`

**Nuxt 2** — `pages/index.vue`. Whatever the hook returns is merged into `data`, so `this.stats` just
exists and there is no loading state:

```js
/**
 * asyncData runs before the component is created — on the server for the
 * first render, in the browser on client-side navigation. Whatever it
 * returns is merged into `data`, which is why there is no loading state on
 * this page. Nuxt 3 replaces it with useAsyncData/useFetch.
 */
asyncData() {
  const clients = allClients()
  const tasks = allTasks()
  // …
  return { stats: getStats(), activity: listActivity(8), busiest: busiest }
}
```

**Nuxt 3** — `pages/tasks/[id].vue`. Same "resolve before render" guarantee, but you get refs back:

```ts
const { data, error } = await useAsyncData(`task:${id}`, async () => {
  const task = await request<Task>(`/api/tasks/${id}`)
  const [client, time] = await Promise.all([
    request<Client>(`/api/clients/${task.clientId}`),
    request<Page<TimeEntry>>('/api/time', { query: { taskId: id, perPage: 100 } }),
  ])
  return { task, client, entries: time.items }
})
```

Everything downstream now goes through `.value`, and `data` is nullable:

```ts
const task = computed(() => data.value!.task)
const client = computed(() => data.value!.client)
```

### 2.2 `useFetch` when the URL is the whole request

`useFetch(url, opts)` is `useAsyncData(key, () => $fetch(url, opts))` with the key derived for you. Use it
when there is one call and no orchestration — `pages/clients/[id]/edit.vue`:

```ts
const { data: client, error } = await useFetch<Client>(`/api/clients/${id}`)
```

Use `useAsyncData` when the page needs several calls to resolve as one unit — `pages/clients/[id].vue`
fans out five requests and returns one object, so the page has one loading state instead of five.

### 2.3 Reactive queries refetch themselves

**Nuxt 3** — `pages/clients/index.vue`:

```ts
// Snapshot copy so this works whether useListQuery hands back a ref or a
// reactive object, and so useFetch re-runs when any single key changes.
const query = computed<Record<string, any>>(() => ({ ...toValue(filters) }))

const { data, pending, error } = await useFetch<Page<Client>>('/api/clients', { query })
```

The Nuxt 2 equivalent is a Vuex getter chain recomputing in the browser over a payload loaded once
(`store/index.js`: `matchingClients` → `clientPage`). Different mechanism, same user-visible behaviour —
and that is the point of keeping both apps over one fixture.

### 2.4 `fetch()` (the store-filling hook) → an action call

**Nuxt 2** — `pages/clients/index.vue`. `fetch()` is the hook for "fill the store before render":

```js
/**
 * The fetch() hook, not asyncData: this page reads its rows out of Vuex
 * rather than out of `data`, and fetch() is the Nuxt 2 hook for "fill the
 * store before render". nuxtServerInit has already done it on a hard load;
 * this covers a client-side navigation into the page.
 */
fetch() {
  return this.$store.dispatch('ensureLoaded')
},
```

**Nuxt 3** — there is no `fetch()` hook. Either the page fetches (§2.1) or it awaits a store action in
setup. `stores/desk.ts` exposes the actions; `$fetch` does the work:

```ts
async function fetchClients(query = '') {
  const page = await load(
    () => $fetch<Page<Client>>(`/api/clients${query ? `?${query}` : ''}`),
    'Could not load clients',
  )
  if (page) clients.value = page.items
  return page
}
```

### 2.5 When each one is wrong

| Situation | Use | Never use |
|---|---|---|
| Page needs data before it renders | `useFetch` / `useAsyncData` | `$fetch` in setup — it runs twice, once on the server and once again after hydration |
| Reaction to a click, submit or keystroke | `$fetch` | `useFetch` — it caches by key and will hand you a stale result |
| SSR call to our own API needing the session cookie | `useRequestFetch()` | plain `$fetch` — the httpOnly cookie is on the incoming request, not on the server's outgoing one |
| Two calls to the same URL with different queries | `useFetch(url, { key, query })` | the same URL twice with no key — see §11.3 |

The cookie rule is written into `pages/clients/[id].vue`:

```ts
// useRequestFetch, not plain $fetch: during SSR the session cookie is on the
// incoming request, and only this wrapper forwards it to our own API.
const request = useRequestFetch()
```

…and, for a composable that has no event to draw on, into `composables/useAuth.ts`:

```ts
// The session cookie is httpOnly, so an SSR $fetch has to be handed the
// incoming cookie header explicitly or it calls /api/auth/me anonymously.
const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const res = await $fetch<{ user: User | null }>('/api/auth/me', { headers })
```

### 2.6 Failing a page

**Nuxt 2** — `error()` comes off the context and you **return** it:

```js
// pages/clients/_id/index.vue
asyncData({ params, error }) {
  const client = getClient(params.id)
  if (!client) {
    return error({ statusCode: 404, message: 'No client with id "' + params.id + '".' })
  }
```

**Nuxt 3** — `createError` is **thrown**, and `fatal: true` is what makes it render the error page rather
than a component-level error:

```ts
// pages/clients/[id].vue
if (error.value || !data.value) {
  throw createError({
    statusCode: (error.value as { statusCode?: number } | null)?.statusCode ?? 404,
    statusMessage: 'Client not found',
    fatal: true,
  })
}
```

---

## 3. The server story

### 3.1 No server → Nitro

**Nuxt 2** has no backend at all. `nuxt.config.js` sets `target: 'static'` and `lib/data.js` reads a
bundled fixture synchronously:

```js
/**
 * Data access layer over the bundled fixture. This is the Nuxt 2 stand-in for
 * the Nitro routes in ../forge-desk-nuxt3/server/api: same query options, same
 * filter/sort semantics, same { items, total, page, perPage, pages } envelope.
 */
export function listClients(query) {
  const opts = clientQuery(query)
  let items = seed.clients
  if (opts.status !== 'all') items = items.filter((c) => c.status === opts.status)
  if (opts.q) items = items.filter((c) => rules.matches([c.name, c.company, c.email, c.notes], opts.q))
  return rules.paginate(rules.sortClients(items, opts.sort, opts.dir), opts.page, opts.perPage)
}
```

**Nuxt 3** turns the same function into an HTTP route — `server/api/clients/index.get.ts`:

```ts
import { queryValid } from '../../utils/guard'
import { useRepo } from '../../utils/repo'
import { clientQuerySchema } from '../../utils/schema'

// Public: the demo is meant to be browsable without signing in.
export default defineEventHandler(async (event) => {
  const query = queryValid(event, clientQuerySchema)
  const repo = await useRepo()
  return repo.clients.list(query)
})
```

The filename carries the method and the path: `server/api/clients/[id].put.ts` is `PUT /api/clients/:id`.
There are 27 of them, covering clients, tasks, time, invoices, activity, stats, auth, health, sitemap,
CSV export and a demo reset.

### 3.2 Server middleware

No Nuxt 2 equivalent exists — there is nothing to run middleware *on*. `server/middleware/session.ts`
runs before every Nitro route:

```ts
/**
 * Resolves the session cookie into event.context.user on every request, so no
 * route handler ever parses the cookie itself. A route that forgets to call
 * the guard fails closed at the guard, not here — this middleware only reads.
 */
export default defineEventHandler(async (event) => {
  event.context.user = null

  const userId = readSessionToken(getCookie(event, SESSION_COOKIE))
  if (!userId) return
  // …
  event.context.user = user
})
```

Note the distinction from route middleware (§10): `middleware/` guards navigation in the browser and
during SSR; `server/middleware/` guards requests.

### 3.3 Server assets

`nuxt.config.ts`:

```ts
nitro: {
  // Exposes server/db/*.sql to useStorage('assets:db') so schema.sql has one
  // definition instead of a copy pasted into a TS string.
  serverAssets: [{ baseName: 'db', dir: './server/db' }],
```

read back in `server/utils/repo-postgres.ts`:

```ts
const ddl = (await useStorage('assets:db').getItem('schema.sql')) as string | null
```

The alternative — `readFileSync` at runtime — works in dev and 500s in production because the file is not
in the serverless bundle. `docs/adr/006-schema-as-server-asset.md` records why.

### 3.4 Per-route rendering

**Nuxt 2** prerenders everything, and has to be told which dynamic routes exist because the crawler only
follows links that survived onto page one of a paginated table:

```js
generate: {
  routes() {
    const seed = require('./data/seed.json')
    return seed.clients
      .map((client) => '/clients/' + client.id)
      .concat(seed.tasks.map((task) => '/tasks/' + task.id))
  },
},
```

**Nuxt 3** decides per route pattern:

```ts
routeRules: {
  // Marketing page is pure content — prerender it and serve from the edge.
  '/': { prerender: true },
  '/style-guide': { prerender: true },
  // The desk is per-user data; render it per request, never cache it.
  '/dashboard': { ssr: true },
  '/clients/**': { ssr: true },
  // The Flutter companion is a separate origin, so the API needs CORS.
  '/api/**': { cors: true },
},
```

### 3.5 Responses that are not JSON

Nitro handlers set their own headers, which is how the same router serves a spreadsheet
(`server/api/export/time.csv.get.ts`) and a sitemap (`server/api/sitemap.xml.get.ts`):

```ts
setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
setResponseHeader(event, 'Content-Disposition', `attachment; filename="forge-desk-time-${todayISO()}.csv"`)
// CRLF: what RFC 4180 asks for and what Excel opens without a wizard.
return rows.map((row) => row.map(cell).join(',')).join('\r\n')
```

A statically generated Nuxt 2 app cannot do this at all.

---

## 4. State: Vuex → Pinia

### 4.1 Registration

**Nuxt 2** — every file under `store/` is registered for you. There is no `createStore()` and nothing to
import:

```js
// store/index.js
export const state = () => ({ clients: [], activity: [], stats: null, filters: { … } })
export const getters = { … }
export const mutations = { … }
export const actions = { … }
```

**Nuxt 3** — one module in `nuxt.config.ts` and one `defineStore` per store:

```ts
modules: ['@pinia/nuxt'],
```

```ts
// stores/desk.ts
export const useDeskStore = defineStore('desk', () => {
  const clients = ref<Client[]>([])
  // …
})
```

### 4.2 Modules → a second store

**Nuxt 2** — `store/tasks.js` becomes the `tasks` namespace purely from its filename:

```js
/**
 * Namespaced Vuex module. Nuxt 2 turns store/tasks.js into the "tasks"
 * namespace automatically — `this.$store.getters['tasks/page']`,
 * `this.$store.dispatch('tasks/load')`. No registerModule call anywhere.
 */
```

**Nuxt 3** — namespacing is just a second store with its own id. `stores/ui.ts`:

```ts
export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const sidebarOpen = ref(false)
  const theme = ref<'light' | 'dark'>('light')
  // …
  return { toasts, sidebarOpen, theme, push, dismiss }
})
```

The string-keyed `'tasks/setFilter'` call sites become typed method calls, which is where most of the
migration's typo class disappears.

### 4.3 Four buckets collapse to two

**Nuxt 2** — a getter, a mutation and an action to change one field:

```js
// store/tasks.js
export const getters = {
  matching(state) {
    let items = state.items
    const f = state.filters
    if (f.clientId) items = items.filter((t) => t.clientId === f.clientId)
    if (f.overdue) items = items.filter((t) => rules.isOverdue(t))
    return rules.sortTasks(items, f.sort, f.dir)
  },
}

export const mutations = {
  setFilter(state, payload) {
    const next = Object.assign({}, state.filters, payload)
    if (!Object.prototype.hasOwnProperty.call(payload, 'page')) next.page = 1
    state.filters = next
  },
}

export const actions = {
  /** Clicking a column header sorts by it, clicking it again flips direction. */
  toggleSort({ state, commit }, sort) {
    const dir = state.filters.sort === sort && state.filters.dir === 'asc' ? 'desc' : 'asc'
    commit('setFilter', { sort: sort, dir: dir })
  },
}
```

**Nuxt 3** — `getters` are `computed`, and `mutations`/`actions` are both just functions:

```ts
// stores/desk.ts
const clientName = computed(() => {
  const byId = new Map(clients.value.map((c) => [c.id, c.name]))
  return (id: string) => byId.get(id)
})

/**
 * Optimistic. Ticking a task has to feel instant, and a status flip is
 * trivially reversible — so the row updates first and rolls back with a toast
 * if the server refuses (a viewer account hits a 403 here every time).
 */
async function setTaskStatus(id: string, status: TaskStatus) {
  const task = tasks.value.find((t) => t.id === id)
  if (!task || task.status === status) return

  const previous = task.status
  task.status = status
  try {
    const updated = await $fetch<Task>(`/api/tasks/${id}`, { method: 'PUT', body: { status } })
    Object.assign(task, updated)
  } catch (e) {
    task.status = previous
    useToast().push(serverMessage(e, 'Could not update the task'), 'error')
  }
}
```

The mutation/action split existed so devtools could record every state change synchronously. Pinia keeps
the devtools trace without the ceremony, so the split goes away — it does not "become" anything.

### 4.4 `mapState` / `mapGetters` → `storeToRefs`

**Nuxt 2** — `pages/tasks/index.vue`:

```js
import { mapGetters, mapState } from 'vuex'

computed: {
  ...mapState('tasks', { filters: (state) => state.filters }),
  ...mapState({ clients: (state) => state.clients }),
  ...mapGetters('tasks', ['page', 'counts', 'matchCount', 'isFiltered'])
},
```

**Nuxt 3** — `composables/useToast.ts`. Actions come off the store directly; **state and getters must go
through `storeToRefs`** or they arrive as detached values:

```ts
import { storeToRefs } from 'pinia'
import { useUiStore, type ToastTone } from '~~/stores/ui'

export function useToast() {
  const ui = useUiStore()
  const { toasts } = storeToRefs(ui)

  function push(message: string, tone: ToastTone = 'info') {
    const id = ui.push(message, tone)
    // Client only: a timer started during SSR holds the request alive and then
    // fires against a store that was serialised and thrown away.
    if (import.meta.client) setTimeout(() => ui.dismiss(id), 4000)
    return id
  }

  return { toasts, push, dismiss: ui.dismiss }
}
```

### 4.5 `nuxtServerInit` has no replacement

**Nuxt 2** — `store/index.js`. Called once per request, before anything else:

```js
/**
 * Nuxt 2 calls this once per request (once per page at generate time) before
 * anything else, which is the classic place to seed a store from "the API".
 */
nuxtServerInit({ commit }) {
  commit('setClients', allClients())
  commit('setActivity', listActivity(8))
  commit('setStats', getStats())
},

// The client-side router never re-runs nuxtServerInit, so a page landed on
// directly after a client-side navigation asks for the data itself.
ensureLoaded({ state, commit }) {
  if (!state.clients.length) commit('setClients', allClients())
  // …
},
```

**Nuxt 3** deleted the hook. Three replacements, depending on what the state is:

- **per-user state resolved during SSR** → `useState`, which serialises into the payload.
  `composables/useAuth.ts`:

  ```ts
  // useState, not a plain ref: the value resolved during SSR is serialised into
  // the payload, so the client boots already knowing who is signed in.
  const user = useState<User | null>('auth:user', () => null)
  ```

- **app-wide singletons** → a plugin. `plugins/i18n.ts` reads a cookie on the server so the first HTML is
  already translated.
- **page data** → `useAsyncData`, which is what most of `nuxtServerInit` turns out to have been.

The `ensureLoaded` workaround above disappears with the hook: `useAsyncData` runs on both server and
client navigation, so there is no "the router never re-ran it" gap to patch.

---

## 5. Components

### 5.1 Options API → `<script setup>`

**Nuxt 2** — `pages/tasks/_id.vue`:

```js
export default {
  middleware: 'track',
  asyncData({ params, error }) { … },
  computed: {
    overdue() {
      return rules.isOverdue(this.task)
    },
    varianceMinutes() {
      return this.loggedMinutes - this.task.estimateMinutes
    },
  },
  head() { … }
}
```

**Nuxt 3** — `pages/tasks/[id].vue`: no `this`, no option keys, top-level `await` allowed.

```ts
definePageMeta({ middleware: 'auth' })

const totalMinutes = computed(() => entries.value.reduce((sum, entry) => sum + entry.minutes, 0))
const billableMinutes = computed(() =>
  entries.value.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.minutes, 0),
)
// Same rule as the server's minutesToMinor: round once, at the end, on integers.
const billableValue = computed(() => Math.round((billableMinutes.value * client.value.hourlyRateMinor) / 60))
```

### 5.2 Props

**Nuxt 2** — `layouts/error.vue`, runtime declaration:

```js
props: {
  error: {
    type: Object,
    default: null
  }
},
```

**Nuxt 3** — `components/UiInput.vue`, type-level declaration with `withDefaults`:

```ts
const props = withDefaults(
  defineProps<{
    label?: string
    error?: string
    hint?: string
    type?: string
    required?: boolean
    placeholder?: string
    disabled?: boolean
  }>(),
  { label: '', error: '', hint: '', type: 'text', required: false, placeholder: '', disabled: false },
)
```

`withDefaults` is not optional decoration: a type-only `defineProps` gives every optional prop
`undefined`, and `undefined` in a class binding renders the string "undefined".

### 5.3 Emits

Nuxt 2 emits implicitly with `this.$emit` and declares nothing. Nuxt 3 declares the contract, and it is
type-checked — `components/UiPagination.vue`:

```ts
const emit = defineEmits<{ 'update:page': [page: number] }>()

function go(page: number) {
  if (page >= 1 && page <= props.pages && page !== props.page) emit('update:page', page)
}
```

### 5.4 The `v-model` contract change

Vue 2: `value` prop + `input` event. Vue 3: `modelValue` prop + `update:modelValue` event. On a native
element nothing changes — `pages/clients/index.vue` in the Nuxt 2 app and `pages/tasks/[id].vue` in the
Nuxt 3 app both write `v-model="…"` on an `<input>`. On a **component** it changes completely.

**Nuxt 3** — `components/UiSelect.vue` declares the model in one line:

```ts
const model = defineModel<string>()
```

```html
<select :id="id" v-model="model" …>
```

and a caller can either bind it (`pages/tasks/new.vue`: `<UiInput v-model="form.title" … />`) or drive
the halves by hand when the value lives in the URL rather than in a ref —
`pages/tasks/index.vue`:

```html
<UiSelect
  :model-value="String(query.status)"
  label="Status"
  :options="statusOptions"
  @update:model-value="(value) => setFilter('status', value)"
/>
```

That second form is what a Vue 2 `.sync` becomes. `.sync` was removed outright; the replacement is
`v-model:foo` or the explicit pair above. Neither repo ships a `.sync` — the Nuxt 2 app has no shared
components at all (`components: false`), which is exactly why the Nuxt 3 app grew 23 of them.

### 5.5 Slots

**Nuxt 2**: the layout's only "slot" is `<nuxt />`, and scoped slots use `slot-scope`.

**Nuxt 3** — `components/UiCard.vue` uses a default slot, named slots, and `$slots` to decide whether the
chrome renders at all:

```html
<section class="rounded-2xl border …">
  <header v-if="$slots.header" class="…">
    <slot name="header" />
  </header>
  <div :class="padded ? 'p-5' : ''">
    <slot />
  </div>
  <footer v-if="$slots.footer" class="…">
    <slot name="footer" />
  </footer>
</section>
```

Filled at the call site with `#footer` — `pages/clients/[id].vue`:

```html
<UiModal :open="confirmingArchive" title="Archive this client?" @close="confirmingArchive = false">
  <p class="…">{{ client.name }} drops out of the active roster. …</p>
  <template #footer>
    <UiButton variant="subtle" @click="confirmingArchive = false">Cancel</UiButton>
    <UiButton variant="danger" :loading="archiving" @click="archive">Archive client</UiButton>
  </template>
</UiModal>
```

### 5.6 Functional components

`functional: true` and functional `<template>` blocks are gone in Vue 3 — the optimisation they bought no
longer exists, so a functional component becomes an ordinary SFC with no ceremony. Neither repo ships
one; the closest thing is `components/StatusBadge.vue`, which is a pure map from status to tone and would
have been a functional component in 2019:

```ts
const props = defineProps<{ status: ClientStatus | TaskStatus }>()

const tones: Record<ClientStatus | TaskStatus, 'gray' | 'green' | 'amber' | 'red' | 'blue'> = {
  active: 'green', paused: 'amber', archived: 'gray',
  todo: 'gray', in_progress: 'blue', blocked: 'red', done: 'green',
}

const tone = computed(() => tones[props.status] ?? 'gray')
```

### 5.7 Auto-imports

**Nuxt 2** — `nuxt.config.js` turns the feature off, and everything is imported by hand:

```js
// Nuxt 2 has no auto-imports for lib/ or store/, and components/ auto-import
// is opt-in. This app has no shared components, so it stays off.
components: false,
```

```js
import { getTask, getClient, listTimeEntries, listTasksForClient } from '~/lib/data'
import rules from '~/lib/rules'
import { mapGetters, mapState } from 'vuex'
```

**Nuxt 3** — components, `composables/`, `utils/` and the Vue/Nuxt APIs are all auto-imported.
`components/SparkBars.vue` calls `hours()` and `shortDate()` from `utils/format.ts` with no import line at
all, and `pages/tasks/index.vue` imports only *types*:

```ts
import type { Client, Page, Task, TaskStatus } from '~~/types/domain'
```

The cost is that a typo in a helper name becomes a runtime `undefined is not a function` instead of a
build error, which is why `scripts/check.mjs` asserts every file the auto-import contract promises still
exists.

### 5.8 Teleport

`<portal>` (a library in Vue 2) is `<Teleport>` (built in) — `components/UiModal.vue` and
`components/CommandPalette.vue` both open with:

```html
<Teleport to="body">
```

---

## 6. Reactivity

### 6.1 `data()` → `ref` / `reactive`

**Nuxt 2** — `pages/clients/index.vue`:

```js
data() {
  return {
    // Search is debounced through a local mirror so every keystroke does not
    // commit a mutation and re-run every getter.
    q: this.$store.state.filters.q,
    debounce: null,
    tasks: []
  }
},
```

**Nuxt 3** — `pages/clients/index.vue`. The debounce handle is a plain `let`, not reactive state, because
nothing renders it:

```ts
const search = ref(String(query.value.q ?? ''))
let debounce: ReturnType<typeof setTimeout> | undefined
```

`reactive` is for object-shaped form state — `pages/tasks/[id].vue`:

```ts
const log = reactive({
  minutes: '60',
  workedOn: new Date().toISOString().slice(0, 10),
  note: '',
  billable: true,
})
const logErrors = reactive<Record<string, string>>({})
```

### 6.2 `computed`

`computed: { openCount() { return this.tasks.filter(…).length } }` in
`pages/clients/_id/index.vue` becomes, in `pages/clients/[id].vue`:

```ts
const openTasks = computed(() => data.value!.tasks.filter((t) => t.status !== 'done').length)
```

### 6.3 `watch`

**Nuxt 2** — keyed by property name:

```js
watch: {
  q(value) {
    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => {
      this.setFilter({ q: value })
    }, 180)
  }
},
```

**Nuxt 3** — the source is an argument, so you can watch anything, including a getter:

```ts
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => setFilter('q', value), 300)
})

// Back/forward and the empty state's "clear filters" link move the URL, not the box.
watch(
  () => query.value.q,
  (value) => {
    if (String(value ?? '') !== search.value) search.value = String(value ?? '')
  },
)
```

`components/ClientForm.vue` shows the `immediate` option doing the job a `created()` hook used to:

```ts
watch(
  () => props.client,
  (client) => {
    if (!client) return
    form.name = client.name
    // …
    form.hourlyRate = (client.hourlyRateMinor / 100).toFixed(2)
    pristine = JSON.stringify(form)
    dirty.value = false
  },
  { immediate: true },
)
```

### 6.4 `$set` and array index assignment

Vue 2 could not detect `obj.newKey = x` or `arr[i] = x`, which is why `this.$set` existed and why Vuex
code defensively replaces whole objects. `store/index.js` does exactly that:

```js
setFilter(state, payload) {
  const next = Object.assign({}, state.filters, payload)
  if (!Object.prototype.hasOwnProperty.call(payload, 'page')) next.page = 1
  state.filters = next
},
```

Vue 3 uses a Proxy, so `$set` is gone and both patterns are reactive. `stores/desk.ts` assigns a new key
onto a tracked object and mutates an array element in place, and both are seen:

```ts
const task = tasks.value.find((t) => t.id === id)
task.status = status                    // in-place mutation of an array element
const updated = await $fetch<Task>(…)
Object.assign(task, updated)            // new keys land reactively
```

**Do not mechanically rewrite the Vuex pattern while migrating.** Whole-object replacement is still
correct — it is just no longer *required*. Rewriting it is a diff with no behaviour change and a real
chance of dropping the `page` reset hidden inside it.

### 6.5 Disposal

`beforeDestroy() { clearTimeout(this.debounce) }` becomes `onBeforeUnmount`, or — inside a composable
that has no component of its own — `onScopeDispose` (`composables/useListQuery.ts`):

```ts
onScopeDispose(() => clearTimeout(timer))
```

---

## 7. Lifecycle hook renames

| Vue 2 (Nuxt 2) | Vue 3 (`<script setup>`) | Used in this repo |
|---|---|---|
| `beforeCreate`, `created` | the setup body itself | everywhere |
| `beforeMount` | `onBeforeMount` | — |
| `mounted` | `onMounted` | `composables/useTheme.ts`, `components/DriverBanner.vue`, `components/CommandPalette.vue` |
| `beforeUpdate` / `updated` | `onBeforeUpdate` / `onUpdated` | — |
| `beforeDestroy` | `onBeforeUnmount` | `components/UiModal.vue`, `components/CommandPalette.vue` |
| `destroyed` | `onUnmounted` | — |
| `errorCaptured` | `onErrorCaptured` | — |
| — | `onScopeDispose` | `composables/useListQuery.ts` |

The two renames that actually bite: `beforeDestroy` → `onBeforeUnmount` and `destroyed` → `onUnmounted`.
They fail silently — an Options-API `destroyed()` key on a Vue 3 component is not an error, it is just a
property nobody calls, so your listener never gets removed and you find out from a memory leak.

`pages/clients/index.vue` (Nuxt 2) and `components/CommandPalette.vue` (Nuxt 3) are the before/after:

```js
beforeDestroy() {
  clearTimeout(this.debounce)
},
```

```ts
onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  clearTimeout(timer)
})
```

---

## 8. Filters: removed, with no direct replacement

This is the single largest mechanical change in the migration and the reason `plugins/filters.js` is the
best migration material in the Nuxt 2 repo.

**Nuxt 2** — `plugins/filters.js`:

```js
import Vue from 'vue'
import rules from '~/lib/rules'

// Money arrives in minor units everywhere, so the filter takes the currency as
// an argument: {{ client.hourlyRateMinor | money(client.currency) }}
Vue.filter('money', function (minor, currency) {
  return rules.formatMoney(minor, currency)
})

Vue.filter('hours', function (minutes) { return rules.formatHours(minutes) })
Vue.filter('shortDate', function (iso) { return rules.formatDate(iso) })
Vue.filter('statusLabel', function (value) { return rules.statusLabel(value) })
Vue.filter('rate', function (minor, currency) { return rules.formatMoney(minor, currency) + '/hr' })
```

registered in `nuxt.config.js`:

```js
plugins: ['~/plugins/filters.js'],
```

Templates then read:

```html
<!-- pages/clients/_id/index.vue -->
<td>{{ client.hourlyRateMinor | rate(client.currency) }}</td>
<td>{{ client.createdAt | shortDate }}</td>
<span class="tag" :class="task.status">{{ task.status | statusLabel }}</span>
```

**Vue 3 removed `Vue.filter` entirely.** There is no shim. Every pipe becomes a function call.

**Nuxt 3** — `utils/format.ts`, auto-imported, callable from any template:

```ts
export function hours(minutes: number): string {
  const whole = Math.trunc(Math.abs(minutes) / 60)
  const rest = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  if (!whole) return `${sign}${rest}m`
  return rest ? `${sign}${whole}h ${rest}m` : `${sign}${whole}h`
}

export function statusLabel(s: string): string {
  const words = s.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
```

```html
<!-- pages/tasks/[id].vue -->
<td class="whitespace-nowrap px-4 py-3">{{ shortDate(entry.workedOn) }}</td>
<td class="whitespace-nowrap px-4 py-3">{{ hours(entry.minutes) }}</td>
```

**The real cost, counted:** the Nuxt 2 app has **54 filter call sites** across `pages/` and `layouts/` —
`shortDate` 19, `hours` 13, `statusLabel` 12, `money` 7, `rate` 3. Each is a hand edit in a template.
`| money(client.currency)` → `money(x, client.currency)` reverses the argument order in your head, and a
regex that does it blindly will happily rewrite `a | b` inside a JavaScript expression.

Two things make this survivable, and both are deliberate in the Nuxt 2 repo:

1. The filters are **thin wrappers**. The logic lives in `lib/rules.js`, not in the filter:
   *"Formatting lives here rather than in plugins/filters.js so it is testable outside a browser. The Vue
   filters are thin wrappers over these."* So the migration is a call-site rewrite, not a reimplementation.
2. `rate` is the only filter with no direct counterpart — `utils/format.ts` has no `rate()`, and the Nuxt
   3 app writes `{{ money(client.hourlyRateMinor, client.currency) }}/h` inline instead
   (`pages/clients/[id].vue`). A composite filter is the case where "one filter, one function" breaks
   down and you have to decide whether it was ever worth a name.

---

## 9. Head, SEO, layouts, error pages

### 9.1 `head()` → `useSeoMeta()`

**Nuxt 2** — `pages/clients/_id/index.vue`. A method on the component, with `hid` to dedupe against the
global tag in `nuxt.config.js`:

```js
head() {
  // asyncData bailed with error() — the error layout renders instead.
  if (!this.client) return {}
  return {
    title: this.client.name + ' — Forge Desk (Nuxt 2)',
    meta: [
      {
        hid: 'description',
        name: 'description',
        content: this.client.name + ' — ' + this.tasks.length + ' tasks, ' + this.openCount + ' still open.'
      }
    ]
  }
}
```

**Nuxt 3** — `pages/clients/[id].vue`. Flat keys, no `meta` array, no `hid` (later calls win by tag
identity), and **getters** so the tag tracks async data instead of freezing at first render:

```ts
useSeoMeta({
  title: () => data.value?.client.name ?? 'Client',
  description: () => `Tasks, logged time and invoices for ${data.value?.client.name ?? 'this client'}.`,
})
```

### 9.2 Title template

**Nuxt 2** — in the config:

```js
head: {
  titleTemplate: (chunk) => chunk || 'Forge Desk — Nuxt 2 legacy console',
```

**Nuxt 3** — in `app.vue`, where it can read runtime config:

```ts
const { appName } = useRuntimeConfig().public

useHead({
  titleTemplate: (title) => (title ? `${title} · ${appName}` : `${appName} — freelance ops desk`),
})
```

### 9.3 Error page

**Nuxt 2** — `layouts/error.vue`, a layout that receives the error as a **prop**:

```js
export default {
  // No `layout` property on purpose: Nuxt 2 drops this component into the
  // default layout, so the header nav still works from a 404.
  props: {
    error: { type: Object, default: null }
  },
  computed: {
    statusCode() { return (this.error && this.error.statusCode) || 500 },
  },
  head() {
    return { title: this.statusCode + ' — Forge Desk (Nuxt 2)' }
  }
}
```

**Nuxt 3** — a root `error.vue`, outside the layout system, reading a composable, with an explicit exit:

```ts
const error = useError()

const status = computed(() => Number(error.value?.statusCode) || 500)

async function goHome() {
  // clearError with a redirect is the only way out: without it the error state
  // survives client-side navigation and the page renders again on the next route.
  await clearError({ redirect: '/' })
}
```

`clearError` has no Nuxt 2 equivalent, and forgetting it is a bug that only shows up on the *second*
navigation.

### 9.4 Per-page layout

`layout: 'print'` as a component option becomes a macro — `pages/invoices/[id].vue`:

```ts
definePageMeta({ layout: 'print' })
```

`layouts/print.vue` then deliberately drops all chrome:

```html
<!-- No chrome: an invoice printed with a nav bar on it looks amateur. Paper is
     always white, so this layout deliberately opts out of the dark palette. -->
<div class="min-h-screen bg-white text-slate-900">
  <main id="main" class="mx-auto w-full max-w-3xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
    <slot />
  </main>
</div>
```

---

## 10. Route middleware

**Nuxt 2** — a named function file plus a page property. `middleware/track.js`:

```js
/**
 * Route middleware, named by the `middleware: 'track'` property on each page.
 * Runs on the server for the first render and in the browser for every
 * client-side navigation after it.
 */
export default function ({ store, route }) {
  store.commit('setLastRoute', route.fullPath)
}
```

used as `middleware: 'track'` on every page (`pages/index.vue`, `pages/about.vue`,
`pages/clients/index.vue`, `pages/clients/_id/index.vue`, `pages/tasks/index.vue`, `pages/tasks/_id.vue`).

**Nuxt 3** — `middleware/auth.ts`, wrapped in `defineNuxtRouteMiddleware`, taking `to`/`from` instead of a
context object, and returning `navigateTo(…)` instead of calling `redirect(…)`:

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refresh } = useAuth()

  // Resolve during SSR, not after hydration. Without the await the server
  // renders the signed-out shell, ships it, and the page visibly rebuilds — or
  // bounces to /login — the moment the client learns who is actually signed in.
  if (!user.value) await refresh().catch(() => {})

  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
```

Declared per page with the macro, and it takes an array — `pages/clients/[id]/edit.vue`:

```ts
definePageMeta({ middleware: ['auth', 'owner-only'] })
```

`middleware/owner-only.ts` shows the third change: refusing a navigation outright is
`abortNavigation(createError(…))`, which has no Nuxt 2 counterpart at all:

```ts
if (!isOwner.value) {
  // The API rejects the write anyway; this stops a viewer filling in a form
  // that was never going to save.
  return abortNavigation(
    createError({
      statusCode: 403,
      statusMessage: 'Read-only account — ask the owner to make this change',
    }),
  )
}
```

Note that it re-resolves the session itself rather than assuming `auth` ran first — *"middleware order is
per-page config, and a page that lists only this one must still fail closed."* That is a real migration
trap: in Nuxt 2 middleware ordering came from the config array plus the page property, and moving to
per-page arrays makes ordering assumptions silently wrong.

---

## 11. Plugins, transitions, config, types, build

### 11.1 Plugins

**Nuxt 2** — a bare module that touches the global `Vue`, listed in the config:

```js
// plugins/filters.js
import Vue from 'vue'
Vue.filter('money', function (minor, currency) { … })
```

```js
// nuxt.config.js
plugins: ['~/plugins/filters.js'],
```

**Nuxt 3** — `plugins/i18n.ts` is auto-registered by directory, gets the app instance handed to it, and
can call composables:

```ts
export default defineNuxtPlugin((nuxtApp) => {
  // Read on the server too, so the first HTML is already translated instead of
  // rendering English and swapping after hydration.
  const stored = useCookie<string>(LOCALE_COOKIE).value
  const locale = LOCALES.some((l) => l.code === stored) ? stored : 'en'

  const i18n = createI18n({
    legacy: false,
    // Templates use $t directly; without this only setup-scope useI18n() works.
    globalInjection: true,
    locale,
    fallbackLocale: 'en',
    messages: { en, fil },
  })

  nuxtApp.vueApp.use(i18n)
})
```

`inject('name', value)` becomes `return { provide: { name: value } }` from the plugin. This repo has no
injection — the Nuxt 3 idiom is a composable in `composables/`, which is why there are five of them and
zero injected helpers. If you are migrating a codebase full of `inject`, that is the target shape: an
injected `$formatMoney` becomes an exported `money()` in `utils/`, reachable everywhere with no plumbing.

### 11.2 Transitions

Nuxt 2 shipped a default page transition. Nuxt 3 makes it explicit in `nuxt.config.ts`:

```ts
app: {
  pageTransition: { name: 'page', mode: 'out-in' },
},
```

…and the CSS is **yours to write** — `app.vue`:

```css
/* nuxt.config declares app.pageTransition `page`; without these classes it is a no-op. */
.page-enter-active,
.page-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
```

Two renames come with it: `v-enter` → `v-enter-from`, `v-leave-to` stays. A migrated stylesheet keeping
`.page-enter` compiles fine and animates nothing.

### 11.3 Config and env

**Nuxt 2** — a plain object export, no types, no runtime config:

```js
/**
 * Nuxt 2 configuration. Kept as a plain object export — no defineNuxtConfig,
 * no TypeScript — because that is what a real 2.x codebase looks like.
 */
export default {
  target: 'static',
  css: ['~/assets/main.css'],
  plugins: ['~/plugins/filters.js'],
  components: false,
  build: { extractCSS: true },
}
```

**Nuxt 3** — `defineNuxtConfig`, with `runtimeConfig` splitting server-only from public:

```ts
runtimeConfig: {
  sessionSecret: '',
  demoPassword: '',
  databaseUrl: '',
  public: {
    appName: 'Forge Desk',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  },
},
```

read with `useRuntimeConfig()` — `app.vue`:

```ts
const { appName } = useRuntimeConfig().public
```

Anything not under `public` never reaches the browser bundle. Nuxt 2's `env` option had no such split, so
migrating an `env` block means auditing every key for whether it was ever meant to be public.

### 11.4 Modules

Nuxt 2's `modules` / `buildModules` split (runtime vs build-time, to keep dev deps out of production)
collapses to one `modules` array. The Nuxt 2 app uses neither key; the Nuxt 3 app uses one module:

```ts
modules: ['@pinia/nuxt'],
```

Tailwind is deliberately **not** a module here — the config explains why, which is the kind of note that
saves a migration a day:

```ts
// Tailwind runs through plain PostCSS rather than @nuxtjs/tailwindcss: the
// module broke the build on this Node version and buys nothing we use.
postcss: {
  plugins: { tailwindcss: {}, autoprefixer: {} },
},
```

### 11.5 TypeScript

Nuxt 2: none. No `tsconfig.json`, no type-check step, `lib/rules.js` is deliberately ES5-flavoured
CommonJS so a plain `require` can load it.

Nuxt 3: `typescript: { strict: true }` in the config, a `tsconfig.json` that extends the generated
`.nuxt/tsconfig.json`, `npm run typecheck` running `vue-tsc`, and one domain model everything answers to
(`types/domain.ts`). It is also honest about the framework's own gaps — the `nitro` key in `nuxt.config.ts`
carries a documented `@ts-expect-error` with the exact versions tried and the condition for removing it.

### 11.6 Aliases

`~/lib/data` (Nuxt 2) → `~~/types/domain` (Nuxt 3). `~` is the source directory and `~~` the project root;
when `srcDir` is the root they coincide, and code written with `~` keeps working — but `~~` is the one
that stays correct if `srcDir` ever moves, which is why this repo uses it throughout.

### 11.7 Build output

| | Command | Output | Runtime |
|---|---|---|---|
| Nuxt 2 | `npm run generate` | `dist/` | none — any static host |
| Nuxt 3 | `npm run build` | `.output/` | `node .output/server/index.mjs`, or a Vercel/Netlify preset |

`.output/` contains a Nitro server, its bundled node_modules, and `public/`. It is what
`playwright.config.ts` boots for the e2e run:

```ts
// The built server, not `nuxt dev`. Route rules, the prerendered marketing
// page and SSR only behave like production after a real build, and those
// are the things these journeys are checking.
command: 'npm run build && node .output/server/index.mjs',
```

---

## What actually bites

Eleven things that cost real time. Symptom → cause → fix.

### 1. `Vue.filter` has no Vue 3 equivalent, and the count is worse than you think

- **Symptom:** the build fails on the first `{{ x | money }}`, or (worse, in a partial migration) the
  template compiles and prints nothing useful.
- **Cause:** filters were removed in Vue 3. There is no shim, no compat flag worth using, no codemod that
  understands `| money(client.currency)`.
- **Fix:** move the logic out of the filter *before* you touch a template. `lib/rules.js` already holds it
  and `plugins/filters.js` is five one-line wrappers, so the Nuxt 3 side only needed `utils/format.ts` and
  the auto-import. Then rewrite call sites by hand: **54 of them** in this app.
- **Trap inside the trap:** the pipe reverses the argument order in your head, and `rate` (a filter that
  appends `/hr`) has no counterpart at all — it became inline template text.

### 2. `asyncData` merges into the instance; `useFetch` hands you refs

- **Symptom:** `[object Object]` in the template, `Cannot read properties of undefined`, or a value that
  never updates.
- **Cause:** `asyncData()` returning `{ stats }` makes `this.stats` a plain object. `useFetch` returns
  `{ data, pending, error, refresh }` where `data` is a `Ref` — and it is `Ref<T | null>`, because the
  request can fail.
- **Fix:** `.value` everywhere outside the template, and treat null as a real state. The Nuxt 3 pages
  wrap the whole section (`<section v-if="data">` in `pages/tasks/[id].vue`) or funnel through computeds
  (`const task = computed(() => data.value!.task)`) *after* an explicit `throw createError`.
- **Related:** `asyncData` had no loading state, ever. `useFetch` has `pending`, and a migrated page that
  ignores it renders an empty table for a frame on client-side navigation — which is why
  `pages/tasks/index.vue` has `<UiSkeleton v-if="pending" :rows="8" />`.

### 3. `useFetch` deduplicates by key, so two identical calls share one result

- **Symptom:** two different lists on the page show the same rows; one `refresh()` updates both; a filtered
  and an unfiltered read of the same endpoint return identical data.
- **Cause:** `useFetch` derives its cache key from the URL and options. Two calls to `/api/time` in the
  same component can collide.
- **Fix:** give each one an explicit key. `pages/time/index.vue` needs a paged list *and* a wider summary
  read from the same endpoint, so all four calls are keyed by hand:

  ```ts
  const { data: list, pending, refresh } = await useFetch<Page<TimeEntry>>('/api/time', {
    key: 'time-list',
    query: listQuery,
  })
  const { data: summary, refresh: refreshSummary } = await useFetch<Page<TimeEntry>>('/api/time', {
    key: 'time-summary',
    query: summaryQuery,
  })
  ```

  `useAsyncData` makes the key the first argument precisely so you cannot forget — `pages/tasks/[id].vue`
  uses `` `task:${id}` ``, which also makes two different task pages cache separately.

### 4. Hydration mismatch from the clock

- **Symptom:** `Hydration text content mismatch` in the console; a date or a relative time flickers on
  load; a list is grouped one way in the HTML and another way a frame later.
- **Cause:** `Date.now()` / `new Date()` in setup or in a template runs once on the server and again in the
  browser, milliseconds-to-hours apart and often in a different timezone.
- **Fix:** derive "today" from data the server already sent. `pages/dashboard.vue`:

  ```ts
  /**
   * "Today" comes off the last bucket of the server's 14-day series rather than
   * the browser clock — otherwise a client in a different timezone disagrees with
   * SSR about the date and the list hydrates differently than it rendered.
   */
  const week = computed(() => {
    const start = stats.value?.time.daily.at(-1)?.date
    …
  })
  ```

  For anything genuinely "now" — a relative timestamp — either accept that it renders client-side, or pin
  it. `utils/format.ts` keeps `relativeDate` honest by pinning every other formatter around it.

### 5. Hydration mismatch from `Intl`

- **Symptom:** the same mismatch warning, but on money or dates, and only on some machines.
- **Cause:** `Intl.NumberFormat` and `Intl.DateTimeFormat` fall back to the *runtime's* locale. The Node
  server and the visitor's browser are not the same runtime. `new Date('2026-08-15')` near midnight UTC is
  a different calendar day in Manila than on the server.
- **Fix:** pin locale **and** timezone. `utils/format.ts`:

  ```ts
  // timeZone matters as much as locale here. dueDate and workedOn are date-only
  // strings with no zone, and a timestamp near midnight UTC lands on a different
  // calendar day for a browser in Manila than for the server rendering it.
  const dateFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
  ```

  The Nuxt 2 app dodges this by not using `Intl` at all — `lib/rules.js` inserts thousands separators with
  a regex and says why: *"Intl renders differently in Node and the browser unless every call pins a locale,
  and a mismatch is a hydration bug."* When you migrate, that hand-rolled formatter is not naïve code to
  clean up; it is the bug report.

### 6. Destructuring a Pinia store silently kills reactivity

- **Symptom:** the store updates, devtools shows the new value, the component does not re-render.
- **Cause:** `const { toasts } = useUiStore()` copies the current value out of the reactive proxy. Actions
  survive destructuring (they are plain functions); state and getters do not.
- **Fix:** `storeToRefs` for state and getters, direct property access for actions —
  `composables/useToast.ts` does both in four lines:

  ```ts
  const ui = useUiStore()
  const { toasts } = storeToRefs(ui)
  …
  return { toasts, push, dismiss: ui.dismiss }
  ```

- **Why it bites migrators specifically:** `mapState` in Vuex was safe to spread. The muscle memory
  transfers and the failure is silent.

### 7. `process.client` / `process.server` → `import.meta.client` / `import.meta.server`

- **Symptom:** `process is not defined` in the browser bundle, or a branch that is supposed to be stripped
  shipping anyway.
- **Cause:** `process.*` is a Node global that Nuxt 2's webpack build replaced. Nuxt 3/Vite keys off
  `import.meta`, and the old names are deprecated.
- **Fix:** rename. Both live in this repo:

  ```ts
  // composables/useToast.ts — client only: a timer started during SSR holds the
  // request alive and then fires against a store that was serialised and thrown away.
  if (import.meta.client) setTimeout(() => ui.dismiss(id), 4000)
  ```

  ```ts
  // composables/useAuth.ts
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  ```

- **Second-order bite:** the reason to branch at all is usually a timer or a listener. Those are the exact
  things that leak when `beforeDestroy` silently stops firing (§7 of the mapping, and gotcha 10 below).

### 8. SSR `$fetch` to your own API is anonymous

- **Symptom:** the page renders signed-out on the server and signed-in after hydration; or a detail page
  401s during SSR and works on a client-side navigation into it.
- **Cause:** the session cookie is `httpOnly` and lives on the *incoming* request. A bare `$fetch` on the
  server creates a fresh outgoing request with no cookies.
- **Fix:** `useRequestFetch()` inside a page (`pages/clients/[id].vue`, `pages/tasks/[id].vue`), or
  `useRequestHeaders(['cookie'])` inside a composable with no event to draw on (`composables/useAuth.ts`).
- **Nuxt 2 relevance:** zero — there was no API to authenticate against. This is a class of bug the
  migration *introduces*, which is why it is worth naming before it happens.

### 9. `nuxtServerInit` is gone and its absence is structural

- **Symptom:** the store is empty on the first render; or the fix works on a hard refresh and not on a
  client-side navigation, or vice versa.
- **Cause:** the hook was Nuxt 2's one guaranteed "before everything, on the server" slot. Nuxt 3 has no
  such slot, and Pinia stores on the server are per-request — nothing survives to the client unless it is
  serialised into the payload.
- **Fix:** pick by kind of state. `useState` for per-request values that must reach the client
  (`composables/useAuth.ts`), a plugin for app-wide singletons (`plugins/i18n.ts`), `useAsyncData` for page
  data. Do **not** port `nuxtServerInit` into a plugin wholesale — you get one giant blocking call before
  every route, which is what it was, but now without the framework guaranteeing it ran.
- **Bonus:** the Nuxt 2 `ensureLoaded` action exists purely because *"the client-side router never re-runs
  nuxtServerInit"*. Workarounds like that are dead code after the migration. Delete them; do not port them.

### 10. Lifecycle hooks that fail silently

- **Symptom:** a memory leak, a `keydown` listener firing on a page that no longer exists, a debounce
  timer firing into a destroyed component.
- **Cause:** `beforeDestroy` and `destroyed` were renamed. An unknown key on an options object is not an
  error — it is ignored.
- **Fix:** `onBeforeUnmount` / `onUnmounted`, and `onScopeDispose` inside composables. Grep for
  `beforeDestroy|destroyed` as a migration checklist item; the compiler will not do it for you.

### 11. `pageTransition` is a no-op until you write the CSS

- **Symptom:** transitions "stopped working" after the migration and nothing errors.
- **Cause:** Nuxt 2 shipped default transition styles. Nuxt 3 declares the transition *name* and expects
  your stylesheet to define the classes — and Vue 3 renamed `v-enter` to `v-enter-from`.
- **Fix:** the block in `app.vue` above. The comment on it exists because this was found the hard way:
  *"nuxt.config declares app.pageTransition `page`; without these classes it is a no-op."*

---

## Migration order

Do it in this order. Each phase leaves the app in a state you can run, and each one removes a class of
noise from the next.

### Phase 1 — Config and build (one commit, cannot be incremental)

`nuxt.config.js` → `nuxt.config.ts` with `defineNuxtConfig`, `target`/`generate` → `routeRules`, `env` →
`runtimeConfig`, `buildModules` merged into `modules`, `components: false` removed, TypeScript switched on.

**Why first:** nothing else can even boot until the app builds. Also, this is where you discover the
module you depend on has no Nuxt 3 version — which changes the whole plan, and you want to know on day one,
not in week three. The `postcss`/Tailwind note in this repo's config is exactly that discovery, written
down.

**Why one commit:** there is no half-migrated config. The dev server either starts or it does not.

### Phase 2 — Routing and the shell (one commit per route tree, incremental after that)

Rename `_id.vue` → `[id].vue` and `_id/index.vue` → `[id].vue`. Replace `<nuxt />` with `<slot />` in
layouts, add `app.vue` with `<NuxtLayout><NuxtPage /></NuxtLayout>`, `<nuxt-link>` → `<NuxtLink>`, move
`layouts/error.vue` to a root `error.vue`.

**Why second:** every later phase is "open a page and check it". If the router is wrong you will be
debugging the wrong file. This is also cheap and almost entirely mechanical, so it buys momentum.

**Incremental?** Per route tree, yes — `/clients` can be on the new shape while `/tasks` is not, as long as
the layout and `app.vue` moved together. The layout and `app.vue` themselves are one commit.

### Phase 3 — Components and reactivity, page by page (fully incremental)

Options API → `<script setup>`; `data()` → `ref`/`reactive`; `computed:` → `computed()`; `watch:` →
`watch()`; lifecycle renames; props/emits declarations; `v-model` contract; **filters last within each
page**, because a page that still reads from Vuex and still uses filters is easier to reason about than one
that is half-converted in three dimensions at once.

**Why third:** it is the bulk of the work and it is per-file. One page per commit, reviewable, revertable.

**Incremental?** Completely. Vue 3 runs Options API components fine — a `<script setup>` page and an
Options-API component can sit in the same tree indefinitely. Use that. Do not big-bang it.

**Except:** filters. `Vue.filter` is gone the moment you are on Vue 3, so every template using a pipe has
to be converted in the same commit that removes the plugin. Sequence it as: add `utils/format.ts` first
(both spellings coexist, nothing breaks), convert the 54 call sites across as many commits as you like,
then delete `plugins/filters.js` last.

### Phase 4 — Data fetching (per page, but each page is atomic)

`asyncData` → `useAsyncData`/`useFetch`; `fetch()` → an action call or a page fetch; `error()` →
`throw createError({ fatal: true })`; add loading and error states that `asyncData` never needed.

**Why fourth, not first:** it is the phase where behaviour actually changes — refs instead of merged
instance data, real loading states, real failure paths, cookie forwarding during SSR. Doing it while the
component is still Options API means debugging two unfamiliar things at once.

**Incremental?** Per page, yes. Within a page, no: `asyncData` returning `{ task, client, entries }` feeds
a template that reads `task.title`. Half-converting it gives you a page where some values need `.value`
and some do not, which is the most confusing possible intermediate state.

### Phase 5 — State (last)

Vuex → Pinia. `mapState`/`mapGetters` → `storeToRefs`; mutations and actions collapse into functions;
`nuxtServerInit` gets replaced by whichever of `useState` / plugin / `useAsyncData` fits.

**Why last:** it is the only global change left, and by now every consumer is a `<script setup>` component
that can call `useDeskStore()` directly. Migrating the store first means writing Pinia-to-Options-API
bridges you throw away a week later.

**Incremental?** Yes, and this surprises people: Pinia and Vuex can both be installed, so one store can be
Pinia while another is still Vuex. Migrate the leaf modules first (`store/tasks.js`, whose consumers are
two pages) and the root store last (its consumers include the layout).

**The one thing that cannot be split:** `nuxtServerInit`. The hook is either there or it is not. Decide
what replaces it before you delete `store/index.js`, not after.

---

## How this was verified

Both apps have a cheap check that runs the *same* file the bundle uses, so a green check cannot coexist
with a broken rule.

### Nuxt 2

```bash
cd local-sites/forge-desk-nuxt2
npm install
npm run check      # fixture integrity + the four shared rules
npm run dev        # http://localhost:3000
npm run generate   # static build → dist/
```

`npm run check` runs `scripts/check.mjs`, which `require`s `lib/rules.js` directly — *"the same file
webpack bundles — so this cannot pass while the app is wrong"* — and asserts the rules that are easy to
break:

```js
assert.equal(rules.isOverdue({ status: 'done', dueDate: '2020-01-01' }, TODAY), false, 'a done task is never overdue')
assert.deepEqual(rules.sortTasks(dated, 'dueDate', 'desc').map((t) => t.id), ['a', 'c', 'b'])
assert.deepEqual(rules.paginate([1, 2, 3, 4, 5], 99, 2), { items: [5], total: 5, page: 3, perPage: 2, pages: 3 })
assert.equal(rules.formatMoney(123456789, 'USD'), '$1,234,567.89')
```

Confirmed output:

```
forge-desk-nuxt2 check ok — 12 clients, 48 tasks, 110 time entries, 6 invoices
```

### Nuxt 3

```bash
cd local-sites/forge-desk-nuxt3
npm install
npm run verify     # check → typecheck → test → build
npm run test:e2e   # Playwright against a real production build
```

| Command | What it proves |
|---|---|
| `npm run check` | every file the auto-import contract promises exists; `en`/`fil` translations agree both ways; seed referential integrity |
| `npm run typecheck` | `vue-tsc` under `strict` |
| `npm run test` | **121 vitest tests across 5 files** — invoice maths, overdue rules, pagination, zod schemas, scrypt and session tokens, the memory driver, the formatters |
| `npm run build` | Nitro builds `.output/` |
| `npm run test:e2e` | **17 Playwright cases** — 10 desk journeys + 7 accessibility checks — against `node .output/server/index.mjs` |

Confirmed output of `npm run test`:

```
 ✓ test/logic.spec.ts (35 tests)
 ✓ test/schema.spec.ts (24 tests)
 ✓ test/format.spec.ts (15 tests)
 ✓ test/auth.spec.ts (16 tests)
 ✓ test/repo-memory.spec.ts (31 tests)

 Test Files  5 passed (5)
      Tests  121 passed (121)
```

The e2e run boots the built server, not `nuxt dev`, with no `DATABASE_URL` — so the in-memory driver is a
tested path rather than an asserted one. `.github/workflows/forge-desk.yml` runs the whole sequence on Node 20 with
no database service, and says why:

```yaml
# There is deliberately no postgres service here. DATABASE_URL is left unset, so
# every job runs against the in-process memory driver — the same fallback the
# public demo uses when no database is attached.
```

### Cross-checking the two apps

The strongest verification is not a command, it is the shared fixture. `forge-desk-nuxt2/lib/rules.js`
mirrors `forge-desk-nuxt3/server/utils/logic.ts` function for function:

```js
// lib/rules.js
function isOverdue(task, today) {
  var day = today || todayISO()
  return task.status !== 'done' && !!task.dueDate && task.dueDate < day
}
```

```ts
// server/utils/logic.ts
export function isOverdue(task: Pick<Task, 'status' | 'dueDate'>, today = todayISO()): boolean {
  // A closed task is never overdue, however late it was finished.
  return task.status !== 'done' && !!task.dueDate && task.dueDate < today
}
```

Run both apps side by side, apply the same filter, and the same rows come back. If they disagree, one has
a bug — which is a stronger contract than either test suite alone.

---

## Honest framing

These are **portfolio builds from August 2026**, not client work and not a product. Nobody's business runs
on Forge Desk and no invoice in it was ever sent to anyone. The Nuxt 2 app is a legacy surface written on
purpose — dated CSS included — so that a migration can be *shown* rather than described.

What this document is evidence of: that the Nuxt 2 idioms are understood well enough to write them
correctly and unpick them deliberately, and that the Nuxt 3 replacements were chosen with their failure
modes known rather than copied from a guide.

What it is not: multi-year production Nuxt employment. Vue production history is WAL Software Solutions,
2021–22.
