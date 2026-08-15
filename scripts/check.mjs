#!/usr/bin/env node
/**
 * Pre-build sanity check — the failures that are cheap to find here and
 * expensive to find later: a missing file the auto-import contract promises, a
 * translation key added to one locale only, seed data pointing at rows that do
 * not exist, a dev URL left in shipped source.
 *
 * Collects everything before exiting, because a check that stops at the first
 * failure turns one fix into five runs.
 *
 *   node scripts/check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const fail = (message) => failures.push(message)

/* ---------- the files the contract promises ---------- */

const REQUIRED = [
  'app.vue',
  'error.vue',
  'types/domain.ts',
  'utils/format.ts',
  'data/seed.json',
  'i18n/en.json',
  'i18n/fil.json',

  ...['useAuth', 'useListQuery', 'useLocale', 'useTheme', 'useToast'].map((c) => `composables/${c}.ts`),

  ...[
    'AppFooter', 'AppHeader', 'ClientCard', 'CommandPalette', 'DonutChart', 'DriverBanner',
    'PriorityBadge', 'SparkBars', 'StatTile', 'StatusBadge', 'TaskRow', 'ToastHost',
    'UiBadge', 'UiButton', 'UiCard', 'UiEmptyState', 'UiInput', 'UiModal', 'UiPagination',
    'UiSelect', 'UiSkeleton', 'UiTextarea',
  ].map((c) => `components/${c}.vue`),

  ...['auth', 'guard', 'logic', 'repo', 'repo-memory', 'repo-postgres', 'schema'].map(
    (u) => `server/utils/${u}.ts`,
  ),
  // Numbered: Nitro runs server middleware alphabetically, and the session has
  // to resolve before the route guard reads event.context.user.
  'server/middleware/1.session.ts',
  'server/middleware/2.owner-routes.ts',

  'server/api/health.get.ts',
  'server/api/stats.get.ts',
  'server/api/sitemap.xml.get.ts',
  'server/api/activity/index.get.ts',
  'server/api/auth/login.post.ts',
  'server/api/auth/logout.post.ts',
  'server/api/auth/me.get.ts',
  'server/api/clients/index.get.ts',
  'server/api/clients/index.post.ts',
  'server/api/clients/[id].get.ts',
  'server/api/clients/[id].put.ts',
  'server/api/clients/[id].delete.ts',
  'server/api/tasks/index.get.ts',
  'server/api/tasks/index.post.ts',
  'server/api/tasks/[id].get.ts',
  'server/api/tasks/[id].put.ts',
  'server/api/tasks/[id].delete.ts',
  'server/api/time/index.get.ts',
  'server/api/time/index.post.ts',
  'server/api/time/[id].delete.ts',
  'server/api/invoices/index.get.ts',
  'server/api/invoices/index.post.ts',
  'server/api/invoices/[id].get.ts',
  'server/api/invoices/[id].patch.ts',
  'server/api/invoices/[id].delete.ts',
  'server/api/export/time.csv.get.ts',
  'server/api/demo/reset.post.ts',

  'pages/index.vue',
  'pages/login.vue',
  'pages/dashboard.vue',
  'pages/style-guide.vue',
  'pages/clients/index.vue',
  'pages/clients/new.vue',
  // index.vue, not [id].vue: with a sibling [id]/edit.vue, Nuxt turns [id].vue
  // into a PARENT route and the edit page silently never renders.
  'pages/clients/[id]/index.vue',
  'pages/clients/[id]/edit.vue',
  'pages/tasks/index.vue',
  'pages/tasks/new.vue',
  'pages/tasks/[id].vue',
  'pages/invoices/index.vue',
  'pages/invoices/[id].vue',
  'pages/time/index.vue',
]

function exists(path) {
  try {
    return statSync(join(root, path)).isFile()
  } catch {
    return false
  }
}

for (const path of REQUIRED) {
  if (!exists(path)) fail(`missing file: ${path}`)
}

/* ---------- translations agree in both directions ---------- */

function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(join(root, path), 'utf8'))
  } catch (error) {
    fail(`${path} does not parse: ${error.message}`)
    return null
  }
}

const en = readJson('i18n/en.json')
const fil = readJson('i18n/fil.json')

if (en && fil) {
  const enKeys = new Set(flatten(en))
  const filKeys = new Set(flatten(fil))
  const missingInFil = [...enKeys].filter((k) => !filKeys.has(k))
  const missingInEn = [...filKeys].filter((k) => !enKeys.has(k))

  if (missingInFil.length) fail(`i18n/fil.json is missing ${missingInFil.length} key(s): ${missingInFil.join(', ')}`)
  if (missingInEn.length) fail(`i18n/en.json is missing ${missingInEn.length} key(s): ${missingInEn.join(', ')}`)
}

/* ---------- seed data holds together ---------- */

const seed = readJson('data/seed.json')

if (seed) {
  const ids = (rows) => new Set((rows ?? []).map((row) => row.id))
  const clientIds = ids(seed.clients)
  const taskIds = ids(seed.tasks)
  const invoiceIds = ids(seed.invoices)

  if (!clientIds.size) fail('data/seed.json has no clients')
  if (!taskIds.size) fail('data/seed.json has no tasks')

  // A dangling reference here is a 404 or a crash in the app, and the seed is
  // regenerated by a script — exactly the place a silent break hides.
  for (const task of seed.tasks ?? []) {
    if (!clientIds.has(task.clientId)) fail(`seed task ${task.id} points at unknown client ${task.clientId}`)
  }
  for (const entry of seed.timeEntries ?? []) {
    if (!taskIds.has(entry.taskId)) fail(`seed time entry ${entry.id} points at unknown task ${entry.taskId}`)
    if (!clientIds.has(entry.clientId)) fail(`seed time entry ${entry.id} points at unknown client ${entry.clientId}`)
    if (entry.invoiceId !== null && !invoiceIds.has(entry.invoiceId)) {
      fail(`seed time entry ${entry.id} points at unknown invoice ${entry.invoiceId}`)
    }
  }
  for (const invoice of seed.invoices ?? []) {
    if (!clientIds.has(invoice.clientId)) fail(`seed invoice ${invoice.id} points at unknown client ${invoice.clientId}`)
  }
}

/* ---------- no dev URLs in shipped source ---------- */

const SOURCE_DIRS = ['components', 'composables', 'layouts', 'middleware', 'pages', 'plugins', 'server', 'stores', 'utils']
const SOURCE_FILES = ['app.vue', 'error.vue']
const SOURCE_EXTENSIONS = ['.ts', '.vue', '.mjs', '.js']

function walk(dir) {
  let out = []
  let entries
  try {
    entries = readdirSync(join(root, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = `${dir}${sep}${entry.name}`
    if (entry.isDirectory()) out = out.concat(walk(path))
    else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(path)
  }
  return out
}

// Config and tests are allowed a dev URL — that is where one belongs.
const sources = [...SOURCE_DIRS.flatMap(walk), ...SOURCE_FILES.filter(exists)]

for (const path of sources) {
  const line = readFileSync(join(root, path), 'utf8')
    .split('\n')
    .findIndex((text) => text.includes('http://localhost'))
  if (line !== -1) fail(`${relative(root, join(root, path))}:${line + 1} hardcodes http://localhost`)
}

/* ---------- report ---------- */

if (failures.length) {
  console.error(`\ncheck failed — ${failures.length} problem(s):\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error('')
  process.exit(1)
}

console.log(
  `check ok — ${REQUIRED.length} contract files, ${flatten(en ?? {}).length} translation keys, ` +
    `${seed?.clients.length ?? 0} clients / ${seed?.tasks.length ?? 0} tasks / ` +
    `${seed?.timeEntries.length ?? 0} time entries / ${seed?.invoices.length ?? 0} invoices intact`,
)
