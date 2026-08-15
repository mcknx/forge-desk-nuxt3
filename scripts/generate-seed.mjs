#!/usr/bin/env node
/**
 * Regenerates data/seed.json.
 *
 * Deterministic on purpose: a fixed PRNG seed means the demo, the tests and the
 * screenshots in the case study all describe the same numbers. Re-running this
 * must never produce a diff unless BASE_DAY or the fixtures below change.
 *
 *   node scripts/generate-seed.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'seed.json')

/** The desk's "today". Everything else is an offset from this. */
const BASE_DAY = '2026-08-15'

// mulberry32 — 4 lines, good enough distribution, reproducible across Node versions.
function rng(seed) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20260815)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const int = (min, max) => min + Math.floor(rand() * (max - min + 1))

const day = (offset) => {
  const d = new Date(`${BASE_DAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
const stamp = (offset, hour = 9) => `${day(offset)}T${String(hour).padStart(2, '0')}:00:00.000Z`

const CLIENTS = [
  ['Northline Research', 'Northline Workforce', 'ops@northline.example', 'active', 4500, 'USD', 'Monthly retainer — SEO advisory site and keyword mapping.'],
  ['Kape Koy', 'Kape Koy Pop-up', 'hello@kapekoy.example', 'active', 3000, 'USD', 'POS build plus location-scouting tooling. Pays on the 1st.'],
  ['Lumen Skin Co', 'Lumen Skin Co', 'studio@lumen.example', 'paused', 5500, 'USD', 'Shopify theme and motion commerce. Paused pending their rebrand.'],
  ['Harbour & Vine', 'Harbour & Vine Ltd', 'accounts@harbourvine.example', 'active', 6000, 'GBP', 'Nuxt 2 legacy maintenance. Slow to review PRs — chase weekly.'],
  ['Tidewater Logistics', 'Tidewater Group', 'it@tidewater.example', 'active', 5000, 'USD', 'Internal dashboards. Strict on accessibility sign-off.'],
  ['Meridian Dental', 'Meridian Dental Care', 'front@meridiandental.example', 'active', 3500, 'AUD', 'Booking funnel and reminder automations.'],
  ['Fernbrook Studio', 'Fernbrook Creative', 'hi@fernbrook.example', 'paused', 4000, 'USD', 'Design-to-code sprints. Budget resets each quarter.'],
  ['Cinder & Oak', 'Cinder and Oak Co', 'orders@cinderoak.example', 'active', 3800, 'USD', 'WooCommerce checkout work and payment-method integration.'],
  ['Polaris Freight', 'Polaris Freight NV', 'dev@polarisfreight.example', 'archived', 5200, 'EUR', 'Wrapped Feb 2026. Kept for invoice history.'],
  ['Sablefish Media', 'Sablefish Media', 'prod@sablefish.example', 'active', 4200, 'USD', 'Video landing pages, heavy motion work.'],
  ['Wrenford Legal', 'Wrenford & Partners', 'ops@wrenford.example', 'active', 7000, 'GBP', 'Compliance-heavy. Everything needs an audit trail.'],
  ['Basalt Fitness', 'Basalt Fitness Group', 'team@basaltfit.example', 'archived', 3200, 'USD', 'Completed 2025. Reference available.'],
]

const TASK_TITLES = [
  'Ship keyword map v2', 'Lighthouse pass on advisory pages', 'Render deploy smoke test',
  'Scroll-linked hero section', 'Migrate list page off asyncData', 'Add session cookie auth',
  'Fix N+1 on the tasks query', 'Wire Stripe test webhooks', 'Accessibility audit — colour contrast',
  'Import legacy CSV into Postgres', 'Add pagination to the client table', 'Set up GitHub Actions CI',
  'Write the 2 to 3 migration notes', 'Cache the dashboard stats query', 'Add overdue filter to tasks',
  'Replace Vuex store with Pinia', 'Server-side render the invoice view', 'Add CSV export for time entries',
  'Fix layout shift on the client cards', 'Add keyboard shortcuts to the desk', 'Rate-limit the login route',
  'Backfill activity log entries', 'Add empty states to every list', 'Dark mode token pass',
  'Split the seed script from the migration', 'Add zod validation to POST routes', 'Retry logic on the Flutter client',
  'Offline cache for the mobile list', 'Write Playwright happy-path spec', 'Handle 404 on deleted clients',
  'Add due-this-week grouping', 'Tune the Postgres indexes', 'Prerender the marketing page',
  'Sitemap and robots for SEO', 'Fix the timezone bug in due dates', 'Add optimistic update on status change',
  'Document the API contract', 'Add health check endpoint', 'Guard the archive action behind confirm',
  'Localise the dashboard to Filipino', 'Add invoice PDF print styles', 'Fix double-submit on the new form',
  'Add error boundary to the layout', 'Trim the client bundle by 40kb', 'Write ADR for the storage choice',
  'Add search debounce', 'Chase the Harbour & Vine review', 'Rotate the demo credentials',
]

const NOTES = [
  'Paired on this with the client dev.', 'Blocked on their staging access for two days.',
  'Went long — the legacy code had no tests.', 'Straightforward once the schema was clear.',
  'Reviewed and merged same day.', 'Second pass after QA feedback.',
  'Spike first, then the real implementation.', 'Mostly debugging their CDN cache.',
  '', '', '',
]

const clients = CLIENTS.map(([name, company, email, status, rate, currency, notes], i) => ({
  id: `c${i + 1}`,
  name,
  email,
  company,
  status,
  notes,
  hourlyRateMinor: rate,
  currency,
  createdAt: stamp(-int(120, 400), 8),
  updatedAt: stamp(-int(0, 30), 14),
}))

const activeClients = clients.filter((c) => c.status !== 'archived')

const tasks = []
let taskNo = 0
for (const title of TASK_TITLES) {
  taskNo++
  const client = pick(rand() < 0.85 ? activeClients : clients)
  const status = pick(['todo', 'todo', 'in_progress', 'in_progress', 'blocked', 'done', 'done', 'done'])
  // Done work sits in the past; open work spreads either side of today so the
  // overdue filter has something real to catch.
  const dueOffset = status === 'done' ? -int(1, 60) : int(-14, 45)
  tasks.push({
    id: `t${taskNo}`,
    clientId: client.id,
    title,
    description: `${title}. Agreed scope with ${client.name}; tracked against the ${client.company} retainer.`,
    status,
    priority: pick(['low', 'medium', 'medium', 'high', 'high', 'urgent']),
    dueDate: rand() < 0.9 ? day(dueOffset) : null,
    estimateMinutes: int(1, 16) * 30,
    createdAt: stamp(dueOffset - int(3, 25), 9),
    updatedAt: stamp(-int(0, 20), 16),
  })
}

const timeEntries = []
let timeNo = 0
for (const task of tasks) {
  // Done tasks always have time against them; open ones sometimes do.
  const sessions = task.status === 'done' ? int(2, 5) : task.status === 'todo' ? int(0, 1) : int(1, 4)
  for (let s = 0; s < sessions; s++) {
    timeNo++
    timeEntries.push({
      id: `te${timeNo}`,
      taskId: task.id,
      clientId: task.clientId,
      minutes: int(2, 14) * 15,
      note: pick(NOTES),
      workedOn: day(-int(0, 45)),
      billable: rand() < 0.88,
      invoiceId: null,
      createdAt: stamp(-int(0, 45), int(9, 18)),
    })
  }
}

// Invoices bill the oldest billable time per client, then mark it billed so the
// unbilled figure on the dashboard is real rather than decorative.
const invoices = []
let invNo = 0
for (const client of clients.slice(0, 7)) {
  const pool = timeEntries
    .filter((t) => t.clientId === client.id && t.billable && !t.invoiceId)
    .sort((a, b) => a.workedOn.localeCompare(b.workedOn))
    .slice(0, int(3, 9))
  if (pool.length < 2) continue
  invNo++

  const byTask = new Map()
  for (const entry of pool) {
    byTask.set(entry.taskId, (byTask.get(entry.taskId) ?? 0) + entry.minutes)
  }
  const lines = [...byTask.entries()].map(([taskId, minutes]) => ({
    taskId,
    title: tasks.find((t) => t.id === taskId)?.title ?? 'Work',
    minutes,
    rateMinor: client.hourlyRateMinor,
    amountMinor: Math.round((minutes / 60) * client.hourlyRateMinor),
  }))

  const subtotalMinor = lines.reduce((sum, l) => sum + l.amountMinor, 0)
  const taxRateBp = client.currency === 'GBP' ? 2000 : 0
  const taxMinor = Math.round((subtotalMinor * taxRateBp) / 10_000)
  const issuedOffset = -int(5, 70)
  const id = `inv${invNo}`

  invoices.push({
    id,
    clientId: client.id,
    number: `FD-2026-${String(invNo).padStart(4, '0')}`,
    status: pick(['draft', 'sent', 'sent', 'paid', 'paid']),
    issuedOn: day(issuedOffset),
    dueOn: day(issuedOffset + 30),
    currency: client.currency,
    lines,
    subtotalMinor,
    taxRateBp,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
    createdAt: stamp(issuedOffset, 10),
  })
  for (const entry of pool) entry.invoiceId = id
}

const ACTIVITY_TEMPLATES = [
  ['client.created', (c) => `Added ${c.name} to the desk`],
  ['client.updated', (c) => `Updated billing details for ${c.name}`],
  ['task.completed', (c) => `Closed a task for ${c.name}`],
  ['time.logged', (c) => `Logged time against ${c.name}`],
  ['invoice.sent', (c) => `Sent an invoice to ${c.name}`],
  ['invoice.paid', (c) => `${c.name} paid an invoice`],
]

const activity = Array.from({ length: 40 }, (_, i) => {
  const [action, summary] = pick(ACTIVITY_TEMPLATES)
  const client = pick(clients)
  return {
    id: `a${i + 1}`,
    actorId: 'u1',
    actorName: 'McKeen Asma',
    action,
    subject: `client:${client.id}`,
    summary: summary(client),
    createdAt: stamp(-int(0, 30), int(8, 20)),
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

const seed = {
  /** Bump when the shape changes so a stale cached seed is obvious. */
  version: 2,
  baseDay: BASE_DAY,
  users: [
    { id: 'u1', email: 'demo@forgedesk.dev', name: 'McKeen Asma', role: 'owner', createdAt: stamp(-400, 8) },
    { id: 'u2', email: 'viewer@forgedesk.dev', name: 'Read-only Guest', role: 'viewer', createdAt: stamp(-200, 8) },
  ],
  clients,
  tasks,
  timeEntries,
  invoices,
  activity,
}

writeFileSync(OUT, `${JSON.stringify(seed, null, 2)}\n`)
console.log(
  `seed.json → ${clients.length} clients, ${tasks.length} tasks, ` +
    `${timeEntries.length} time entries, ${invoices.length} invoices, ${activity.length} activity rows`,
)
