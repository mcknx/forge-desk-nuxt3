<script setup lang="ts">
import { defineComponent, h, type PropType } from 'vue'
import type { Client, Task } from '~~/types/domain'

definePageMeta({ layout: 'default' })

type PropRow = [prop: string, type: string, note: string]

/**
 * Rendered rather than hand-written per section: twenty copies of the same
 * three-column table markup is the kind of thing that goes stale in one place
 * and nowhere else.
 */
const PropTable = defineComponent({
  props: { rows: { type: Array as PropType<PropRow[]>, required: true } },
  setup: (props) => () =>
    h('div', { class: 'overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800' }, [
      h('table', { class: 'w-full min-w-[18rem] border-collapse text-left text-xs' }, [
        h('thead', { class: 'bg-slate-100 dark:bg-slate-800/60' }, [
          h('tr', ['Prop', 'Type', 'Notes'].map((label) =>
            h('th', { class: 'px-3 py-2 font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, label),
          )),
        ]),
        h('tbody', { class: 'divide-y divide-slate-200 dark:divide-slate-800' },
          props.rows.map(([prop, type, note]) =>
            h('tr', { class: 'align-top' }, [
              h('td', { class: 'whitespace-nowrap px-3 py-2 font-mono font-medium text-slate-900 dark:text-slate-100' }, prop),
              h('td', { class: 'px-3 py-2 font-mono text-indigo-600 dark:text-indigo-400' }, type),
              h('td', { class: 'px-3 py-2 text-slate-600 dark:text-slate-400' }, note),
            ]),
          ),
        ),
      ]),
    ]),
})

const sections = [
  ['tokens', 'Design tokens'],
  ['ui-button', 'UiButton'],
  ['ui-input', 'UiInput'],
  ['ui-select', 'UiSelect'],
  ['ui-textarea', 'UiTextarea'],
  ['ui-card', 'UiCard'],
  ['ui-badge', 'UiBadge'],
  ['status-badge', 'StatusBadge'],
  ['priority-badge', 'PriorityBadge'],
  ['stat-tile', 'StatTile'],
  ['spark-bars', 'SparkBars'],
  ['donut-chart', 'DonutChart'],
  ['ui-empty-state', 'UiEmptyState'],
  ['ui-pagination', 'UiPagination'],
  ['ui-skeleton', 'UiSkeleton'],
  ['ui-modal', 'UiModal'],
  ['client-card', 'ClientCard'],
  ['task-row', 'TaskRow'],
  ['chrome', 'App chrome'],
]

// Kept in script rather than inline in the template: template expressions are
// stripped of TypeScript, so `as const` there would lose the literal types the
// component props need.
const tones = ['gray', 'green', 'amber', 'red', 'blue'] as const
const clientStatuses = ['active', 'paused', 'archived'] as const
const taskStatuses = ['todo', 'in_progress', 'blocked', 'done'] as const
const priorities = ['urgent', 'high', 'medium', 'low'] as const

const sampleClient: Client = {
  id: 'c1',
  name: 'Northline Research',
  email: 'ops@northline.example',
  company: 'Northline Workforce',
  status: 'active',
  notes: 'Monthly retainer — SEO advisory site and keyword mapping.',
  hourlyRateMinor: 4500,
  currency: 'USD',
  createdAt: '2026-02-11T08:00:00.000Z',
  updatedAt: '2026-08-11T08:00:00.000Z',
}

const pausedClient: Client = {
  ...sampleClient,
  id: 'c2',
  name: 'Harbour & Vine',
  company: 'Harbour & Vine Ltd',
  email: 'accounts@harbourvine.example',
  status: 'paused',
  currency: 'GBP',
  hourlyRateMinor: 6000,
  notes: 'Nuxt 2 legacy maintenance. Paused pending their rebrand.',
}

const sampleTasks: Task[] = [
  {
    id: 't1',
    clientId: 'c1',
    title: 'Ship keyword map v2',
    description: 'Second pass over the advisory-page keyword clusters.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-08-18',
    estimateMinutes: 210,
    createdAt: '2026-08-04T08:00:00.000Z',
    updatedAt: '2026-08-12T08:00:00.000Z',
  },
  {
    id: 't2',
    clientId: 'c1',
    title: 'Fix N+1 on the tasks query',
    description: 'One query per row on the list page.',
    status: 'done',
    priority: 'urgent',
    dueDate: '2026-08-09',
    estimateMinutes: 90,
    createdAt: '2026-07-30T08:00:00.000Z',
    updatedAt: '2026-08-08T08:00:00.000Z',
  },
]

const sampleSeries = [
  180, 0, 240, 315, 90, 0, 0, 420, 260, 175, 330, 60, 0, 285,
].map((minutes, i) => ({ date: `2026-08-${String(2 + i).padStart(2, '0')}`, minutes }))

const sampleSegments = [
  { label: 'To do', value: 14, tone: 'gray' as const },
  { label: 'In progress', value: 9, tone: 'blue' as const },
  { label: 'Blocked', value: 3, tone: 'red' as const },
  { label: 'Done', value: 22, tone: 'green' as const },
]

const text = ref('Northline Research')
const email = ref('ops@northline')
const rate = ref(45)
const choice = ref('active')
const notes = ref('Pays on the 1st. Slow to review PRs — chase weekly.')
const page = ref(3)
const modalOpen = ref(false)

const { push } = useToast()

useSeoMeta({
  title: 'Component kit',
  description:
    'Every component in the Forge Desk UI kit, in every variant, with its prop table — the front-end proof surface for this build.',
  ogTitle: 'Forge Desk — component kit',
  ogDescription: 'Every component in the Forge Desk UI kit, in every variant, with its prop table.',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div class="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
    <nav aria-label="Component index" class="mb-10 lg:mb-0">
      <div class="lg:sticky lg:top-8">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">On this page</p>
        <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 lg:block lg:space-y-1">
          <li v-for="[id, name] in sections" :key="id">
            <a
              :href="`#${id}`"
              class="rounded text-sm text-slate-600 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-slate-400 dark:hover:text-indigo-400"
            >{{ name }}</a>
          </li>
        </ul>
      </div>
    </nav>

    <div class="min-w-0 space-y-12">
      <header>
        <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Component kit</h1>
        <p class="mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
          Every component the desk is built from, in every variant it supports, with the props beside it. This page
          is prerendered and uses no live data, so it is also the fastest way to check that a change did not quietly
          break something three screens away.
        </p>
      </header>

      <section id="tokens" class="scroll-mt-8">
        <div class="head">
          <h2>Design tokens</h2>
          <p>Slate neutrals, one indigo accent, semantic tones for state. Nothing else gets to introduce a colour.</p>
        </div>
        <div class="demo mt-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <p class="swatch-label">Accent</p>
              <div class="mt-2 flex gap-2">
                <span v-for="c in ['bg-indigo-400', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700']" :key="c" :class="c" class="h-10 flex-1 rounded-lg" />
              </div>
            </div>
            <div>
              <p class="swatch-label">Neutrals</p>
              <div class="mt-2 flex gap-2">
                <span v-for="c in ['bg-slate-100', 'bg-slate-300', 'bg-slate-600', 'bg-slate-900']" :key="c" :class="c" class="h-10 flex-1 rounded-lg" />
              </div>
            </div>
          </div>
          <dl class="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt class="swatch-label">Radius</dt><dd class="mt-1 text-slate-600 dark:text-slate-400">rounded-xl on surfaces, rounded-full on pills</dd></div>
            <div><dt class="swatch-label">Depth</dt><dd class="mt-1 text-slate-600 dark:text-slate-400">1px borders, not shadows</dd></div>
            <div><dt class="swatch-label">Focus</dt><dd class="mt-1 text-slate-600 dark:text-slate-400">2px indigo focus-visible ring on every control</dd></div>
          </dl>
        </div>
      </section>

      <section id="ui-button" class="scroll-mt-8">
        <div class="head">
          <h2>UiButton</h2>
          <p>Renders a NuxtLink when <code>to</code> is set, a button otherwise. Loading implies disabled.</p>
        </div>
        <div class="split">
          <div class="demo space-y-4">
            <div class="row">
              <UiButton variant="primary">Primary</UiButton>
              <UiButton variant="ghost">Ghost</UiButton>
              <UiButton variant="danger">Danger</UiButton>
              <UiButton variant="subtle">Subtle</UiButton>
            </div>
            <div class="row">
              <UiButton variant="primary" size="sm">Small</UiButton>
              <UiButton variant="ghost" size="sm">Small ghost</UiButton>
              <UiButton variant="danger" size="sm">Small danger</UiButton>
            </div>
            <div class="row">
              <UiButton variant="primary" :loading="true">Saving</UiButton>
              <UiButton variant="primary" :disabled="true">Disabled</UiButton>
              <UiButton variant="ghost" to="/dashboard">As a link</UiButton>
            </div>
          </div>
          <PropTable
            :rows="[
              ['variant', 'primary | ghost | danger | subtle', 'Defaults to primary.'],
              ['size', 'sm | md', 'md is the default.'],
              ['to', 'string?', 'Present ⇒ renders NuxtLink instead of button.'],
              ['type', 'button | submit', 'Ignored when to is set.'],
              ['loading', 'boolean', 'Shows a spinner and blocks the click.'],
              ['disabled', 'boolean', 'Also removes it from the tab order.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-input" class="scroll-mt-8">
        <div class="head">
          <h2>UiInput</h2>
          <p>Label is always rendered — placeholder-only fields lose their label the moment you type.</p>
        </div>
        <div class="split">
          <div class="demo space-y-5">
            <UiInput v-model="text" label="Client name" hint="Shown on invoices." :required="true" />
            <UiInput v-model="email" label="Email" type="email" error="must be a valid email" />
            <UiInput v-model="rate" label="Hourly rate" type="number" hint="Stored as minor units." />
          </div>
          <PropTable
            :rows="[
              ['modelValue', 'string | number', 'v-model.'],
              ['label', 'string', 'Bound to the input with a generated id.'],
              ['error', 'string?', 'Sets aria-invalid and renders below the field.'],
              ['hint', 'string?', 'Hidden while an error is showing.'],
              ['type', 'string', 'Native input type. Defaults to text.'],
              ['required', 'boolean', 'Marks the label and sets the attribute.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-select" class="scroll-mt-8">
        <div class="head">
          <h2>UiSelect</h2>
          <p>Native select on purpose — it beats every custom dropdown on mobile and with a screen reader.</p>
        </div>
        <div class="split">
          <div class="demo space-y-5">
            <UiSelect
              v-model="choice"
              label="Status"
              :options="[
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'archived', label: 'Archived' },
              ]"
            />
            <UiSelect
              v-model="choice"
              label="Status"
              error="pick one"
              :options="[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]"
            />
          </div>
          <PropTable
            :rows="[
              ['modelValue', 'string', 'v-model.'],
              ['label', 'string', 'Always rendered.'],
              ['options', '{ value, label }[]', 'Order is respected as given.'],
              ['error', 'string?', 'Same treatment as UiInput.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-textarea" class="scroll-mt-8">
        <div class="head">
          <h2>UiTextarea</h2>
          <p>For notes and descriptions. Same label and error contract as UiInput.</p>
        </div>
        <div class="split">
          <div class="demo space-y-5">
            <UiTextarea v-model="notes" label="Notes" :rows="4" />
            <UiTextarea v-model="notes" label="Notes" :rows="2" error="2000 characters max" />
          </div>
          <PropTable
            :rows="[
              ['modelValue', 'string', 'v-model.'],
              ['label', 'string', 'Always rendered.'],
              ['rows', 'number', 'Defaults to 4.'],
              ['error', 'string?', 'Same treatment as UiInput.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-card" class="scroll-mt-8">
        <div class="head">
          <h2>UiCard</h2>
          <p>The only surface primitive. Header and footer are optional slots that add their own dividers.</p>
        </div>
        <div class="split">
          <div class="demo space-y-4">
            <UiCard>
              <template #header><h3 class="font-semibold">With a header</h3></template>
              <p class="text-sm text-slate-600 dark:text-slate-400">Default slot content sits between the two.</p>
              <template #footer><p class="text-sm text-slate-500 dark:text-slate-400">And a footer.</p></template>
            </UiCard>
            <UiCard>
              <p class="text-sm text-slate-600 dark:text-slate-400">Body only — no dividers rendered.</p>
            </UiCard>
          </div>
          <PropTable
            :rows="[
              ['default', 'slot', 'Card body.'],
              ['header', 'slot?', 'Adds a bottom-divided header region.'],
              ['footer', 'slot?', 'Adds a top-divided footer region.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-badge" class="scroll-mt-8">
        <div class="head">
          <h2>UiBadge</h2>
          <p>The tone vocabulary every other badge is built from.</p>
        </div>
        <div class="split">
          <div class="demo">
            <div class="row">
              <UiBadge v-for="tone in tones" :key="tone" :tone="tone">{{ tone }}</UiBadge>
            </div>
          </div>
          <PropTable
            :rows="[
              ['tone', 'gray | green | amber | red | blue', 'Defaults to gray.'],
              ['default', 'slot', 'Label text. Keep it to one or two words.'],
            ]"
          />
        </div>
      </section>

      <section id="status-badge" class="scroll-mt-8">
        <div class="head">
          <h2>StatusBadge</h2>
          <p>Maps a client or task status to a tone, so status colour is decided once for the whole app.</p>
        </div>
        <div class="split">
          <div class="demo space-y-3">
            <div class="row">
              <StatusBadge v-for="s in clientStatuses" :key="s" :status="s" />
            </div>
            <div class="row">
              <StatusBadge v-for="s in taskStatuses" :key="s" :status="s" />
            </div>
          </div>
          <PropTable :rows="[['status', 'ClientStatus | TaskStatus', 'Label comes from statusLabel(), tone from the map.']]" />
        </div>
      </section>

      <section id="priority-badge" class="scroll-mt-8">
        <div class="head">
          <h2>PriorityBadge</h2>
          <p>Four levels, ranked urgent → low. Colour is not the only signal; the word is always there.</p>
        </div>
        <div class="split">
          <div class="demo">
            <div class="row">
              <PriorityBadge v-for="p in priorities" :key="p" :priority="p" />
            </div>
          </div>
          <PropTable :rows="[['priority', 'TaskPriority', 'urgent | high | medium | low.']]" />
        </div>
      </section>

      <section id="stat-tile" class="scroll-mt-8">
        <div class="head">
          <h2>StatTile</h2>
          <p>One number, one label, one optional line of context. Used across the dashboard header row.</p>
        </div>
        <div class="split">
          <div class="demo grid gap-4 sm:grid-cols-2">
            <StatTile label="Active clients" :value="8" hint="12 on the books" tone="blue" />
            <StatTile label="Overdue" :value="3" hint="Past their due date" tone="red" />
            <StatTile label="Unbilled work" value="$4,182.50" hint="Not yet invoiced" tone="amber" />
            <StatTile label="Paid this quarter" value="$19,240.00" tone="green" />
          </div>
          <PropTable
            :rows="[
              ['label', 'string', 'Sits above the value.'],
              ['value', 'string | number', 'Pre-format money and durations before passing them.'],
              ['hint', 'string?', 'Small line underneath.'],
              ['tone', 'gray | green | amber | red | blue', 'Defaults to gray.'],
            ]"
          />
        </div>
      </section>

      <section id="spark-bars" class="scroll-mt-8">
        <div class="head">
          <h2>SparkBars</h2>
          <p>Inline SVG, no charting library. Zero days stay visible as a baseline tick rather than disappearing.</p>
        </div>
        <div class="split">
          <div class="demo">
            <SparkBars :data="sampleSeries" />
          </div>
          <PropTable :rows="[['data', '{ date, minutes }[]', 'Oldest first. Scales to the tallest bar in the set.']]" />
        </div>
      </section>

      <section id="donut-chart" class="scroll-mt-8">
        <div class="head">
          <h2>DonutChart</h2>
          <p>Also inline SVG. Every segment carries its label and value in text, so it survives being read aloud.</p>
        </div>
        <div class="split">
          <div class="demo">
            <DonutChart :segments="sampleSegments" />
          </div>
          <PropTable :rows="[['segments', '{ label, value, tone }[]', 'Zero-value segments are dropped, not drawn as slivers.']]" />
        </div>
      </section>

      <section id="ui-empty-state" class="scroll-mt-8">
        <div class="head">
          <h2>UiEmptyState</h2>
          <p>Every list in the app has one. An empty table with headings and no rows is a bug report waiting to happen.</p>
        </div>
        <div class="split">
          <div class="demo">
            <UiEmptyState
              title="No clients match those filters"
              description="Nothing on the desk matches the current search and status. Clearing the filters brings the full list back."
              action-label="Clear filters"
              action-to="/clients"
            />
          </div>
          <PropTable
            :rows="[
              ['title', 'string', 'One short line.'],
              ['description', 'string', 'Say what to do next, not just that it is empty.'],
              ['actionLabel', 'string?', 'Omit both action props for a message-only state.'],
              ['actionTo', 'string?', 'Route for the action link.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-pagination" class="scroll-mt-8">
        <div class="head">
          <h2>UiPagination</h2>
          <p>Emits <code>update:page</code>; the page owns the state and writes it to the query string.</p>
        </div>
        <div class="split">
          <div class="demo space-y-3">
            <UiPagination :page="page" :pages="9" :total="176" :per-page="20" @update:page="page = $event" />
            <p class="text-xs text-slate-500 dark:text-slate-400">Current page: {{ page }}</p>
          </div>
          <PropTable
            :rows="[
              ['page', 'number', '1-indexed.'],
              ['pages', 'number', 'Total page count, never below 1.'],
              ['total', 'number', 'Row count, used for the “x–y of z” line.'],
              ['perPage', 'number', 'Page size.'],
              ['@update:page', '(n: number) => void', 'Controlled component — it never mutates its own page.'],
            ]"
          />
        </div>
      </section>

      <section id="ui-skeleton" class="scroll-mt-8">
        <div class="head">
          <h2>UiSkeleton</h2>
          <p>Shown only on client-side navigation. SSR renders real data, so the first paint never needs one.</p>
        </div>
        <div class="split">
          <div class="demo space-y-6">
            <UiSkeleton :rows="3" />
            <UiSkeleton :rows="1" />
          </div>
          <PropTable :rows="[['rows', 'number', 'Placeholder lines to draw. Defaults to 3.']]" />
        </div>
      </section>

      <section id="ui-modal" class="scroll-mt-8">
        <div class="head">
          <h2>UiModal</h2>
          <p>Focus is trapped while open and Escape closes it. Used for destructive confirmations.</p>
        </div>
        <div class="split">
          <div class="demo">
            <UiButton variant="ghost" @click="modalOpen = true">Open the modal</UiButton>
            <UiModal :open="modalOpen" title="Delete this client?" @close="modalOpen = false">
              <p class="text-sm text-slate-600 dark:text-slate-400">
                Their tasks, time entries and invoices go with them. This cannot be undone.
              </p>
              <template #footer>
                <div class="flex justify-end gap-3">
                  <UiButton variant="subtle" @click="modalOpen = false">Cancel</UiButton>
                  <UiButton variant="danger" @click="modalOpen = false">Delete</UiButton>
                </div>
              </template>
            </UiModal>
          </div>
          <PropTable
            :rows="[
              ['open', 'boolean', 'Controlled by the parent.'],
              ['title', 'string', 'Becomes the dialog’s accessible name.'],
              ['@close', '() => void', 'Fired by Escape, the backdrop and the close button.'],
              ['footer', 'slot?', 'Action row. Put the destructive button last.'],
            ]"
          />
        </div>
      </section>

      <section id="client-card" class="scroll-mt-8">
        <div class="head">
          <h2>ClientCard</h2>
          <p>The clients grid tile. Rate is formatted through <code>money()</code> in the client's own currency.</p>
        </div>
        <div class="split">
          <div class="demo grid gap-4 sm:grid-cols-2">
            <ClientCard :client="sampleClient" />
            <ClientCard :client="pausedClient" />
          </div>
          <PropTable :rows="[['client', 'Client', 'The whole record — the card links to /clients/:id itself.']]" />
        </div>
      </section>

      <section id="task-row" class="scroll-mt-8">
        <div class="head">
          <h2>TaskRow</h2>
          <p>One task in a list. Overdue is computed from the due date and the status, never stored.</p>
        </div>
        <div class="split">
          <div class="demo">
            <ul class="divide-y divide-slate-200 dark:divide-slate-800">
              <li v-for="task in sampleTasks" :key="task.id">
                <TaskRow :task="task" client-name="Northline Research" @toggle="push(`Toggled ${task.title}`, 'info')" />
              </li>
            </ul>
          </div>
          <PropTable
            :rows="[
              ['task', 'Task', 'The whole record.'],
              ['clientName', 'string?', 'Omit inside a single-client view.'],
              ['@toggle', '() => void', 'Parent owns the write — the row never calls the API itself.'],
            ]"
          />
        </div>
      </section>

      <section id="chrome" class="scroll-mt-8">
        <div class="head">
          <h2>App chrome</h2>
          <p>The pieces the default layout mounts once, around whatever page is rendering.</p>
        </div>
        <div class="split">
          <div class="demo space-y-5">
            <div>
              <p class="swatch-label">DriverBanner</p>
              <div class="mt-2"><DriverBanner /></div>
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Silent on Postgres. On the memory driver it says so, because a visitor should not discover that by
                losing work.
              </p>
            </div>
            <div>
              <p class="swatch-label">ToastHost</p>
              <div class="row mt-2">
                <UiButton size="sm" variant="subtle" @click="push('Client saved.', 'ok')">ok</UiButton>
                <UiButton size="sm" variant="subtle" @click="push('Could not reach the server.', 'error')">error</UiButton>
                <UiButton size="sm" variant="subtle" @click="push('Filters cleared.', 'info')">info</UiButton>
              </div>
            </div>
            <div>
              <p class="swatch-label">CommandPalette</p>
              <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Press <kbd class="kbd">⌘</kbd> <kbd class="kbd">K</kbd> (or <kbd class="kbd">Ctrl</kbd>
                <kbd class="kbd">K</kbd>) anywhere in the app.
              </p>
            </div>
          </div>
          <PropTable
            :rows="[
              ['DriverBanner', '—', 'Fetches /api/health. No props.'],
              ['ToastHost', '—', 'Reads the queue from useToast(). Mounted once in app.vue.'],
              ['CommandPalette', '—', 'Global Cmd/Ctrl+K navigation. Mounted once in the layout.'],
              ['AppHeader / AppFooter', '—', 'Nav, theme toggle, locale switch, account menu.'],
            ]"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.head h2 {
  @apply font-mono text-xl font-semibold tracking-tight;
}

.head p {
  @apply mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-400;
}

.head code,
.head kbd {
  @apply rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-slate-800;
}

.split {
  @apply mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem];
}

.demo {
  @apply rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900;
}

.row {
  @apply flex flex-wrap items-center gap-3;
}

.swatch-label {
  @apply text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400;
}

.kbd {
  @apply rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] dark:border-slate-700 dark:bg-slate-800;
}
</style>
