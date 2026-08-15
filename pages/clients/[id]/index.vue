<script setup lang="ts">
import { useI18n } from 'vue-i18n'
// The one definition of what an hour of this client's time is worth. logic.ts is
// pure and imports nothing but types, so reusing it beats a second copy of the
// rounding rule drifting a cent away from the invoice.
import { minutesToMinor } from '~~/server/utils/logic'
import type { Client, Invoice, Page, Task, TimeEntry } from '~~/types/domain'

definePageMeta({ middleware: 'auth' })

const id = useRoute().params.id as string
const { t } = useI18n()
const { isOwner } = useAuth()
const { push } = useToast()

// useRequestFetch, not plain $fetch: during SSR the session cookie is on the
// incoming request, and only this wrapper forwards it to our own API.
const request = useRequestFetch()

/** The invoices route answers with a bare array; the paged routes answer with an envelope. */
function listOf<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : ((raw as { items?: T[] } | null)?.items ?? [])
}

const { data, error, refresh } = await useAsyncData(`client:${id}`, async () => {
  const [client, tasks, time, unbilled, invoices] = await Promise.all([
    request<Client>(`/api/clients/${id}`),
    request<Page<Task>>('/api/tasks', { query: { clientId: id, status: 'all', perPage: 100 } }),
    request<Page<TimeEntry>>('/api/time', { query: { clientId: id, perPage: 20 } }),
    request<Page<TimeEntry>>('/api/time', { query: { clientId: id, unbilledOnly: 'true', perPage: 100 } }),
    request<Invoice[] | Page<Invoice>>('/api/invoices', { query: { clientId: id } }),
  ])
  return {
    client,
    tasks: listOf<Task>(tasks),
    time: listOf<TimeEntry>(time),
    timeTotal: time.total,
    unbilled: listOf<TimeEntry>(unbilled),
    invoices: listOf<Invoice>(invoices),
  }
})

if (error.value || !data.value) {
  throw createError({
    statusCode: (error.value as { statusCode?: number } | null)?.statusCode ?? 404,
    statusMessage: 'Client not found',
    fatal: true,
  })
}

const client = computed(() => data.value!.client)
const openTasks = computed(() => data.value!.tasks.filter((t) => t.status !== 'done').length)

const unbilledMinutes = computed(() => data.value!.unbilled.reduce((sum, entry) => sum + entry.minutes, 0))
const unbilledValue = computed(() => minutesToMinor(unbilledMinutes.value, client.value.hourlyRateMinor))

// StatusBadge covers client and task statuses only, so invoices map their own.
const invoiceTones: Record<Invoice['status'], 'gray' | 'green' | 'amber' | 'red' | 'blue'> = {
  draft: 'gray',
  sent: 'amber',
  paid: 'green',
  void: 'red',
}

const TABS = ['tasks', 'time', 'invoices'] as const
const tabs = computed(() => TABS.map((key) => ({ key, label: t(`${key}.title`) })))
const tab = ref<(typeof TABS)[number]>('tasks')

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const invoicing = ref(false)

async function createInvoice() {
  invoicing.value = true
  const today = new Date().toISOString().slice(0, 10)
  try {
    const invoice = await $fetch<Invoice>('/api/invoices', {
      method: 'POST',
      body: { clientId: id, issuedOn: today, dueOn: addDays(today, 14), taxRateBp: 0 },
    })
    await refresh()
    tab.value = 'invoices'
    push(`Drafted ${invoice.number}`, 'ok')
  } catch (cause) {
    const err = cause as { statusCode?: number; data?: { statusMessage?: string } }
    // 409 is the expected answer when there is nothing to bill — an ordinary
    // outcome of pressing the button, not a failure worth an error toast.
    if (err.statusCode === 409) push('Nothing to invoice yet — no unbilled billable time for this client', 'info')
    else push(err.data?.statusMessage ?? 'Could not create the invoice', 'error')
  } finally {
    invoicing.value = false
  }
}

const confirmingArchive = ref(false)
const archiving = ref(false)

async function archive() {
  archiving.value = true
  try {
    await $fetch(`/api/clients/${id}`, { method: 'PUT', body: { status: 'archived' } })
    confirmingArchive.value = false
    await refresh()
    push(`${client.value.name} archived`, 'ok')
  } catch (cause) {
    push((cause as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Could not archive this client', 'error')
  } finally {
    archiving.value = false
  }
}

useSeoMeta({
  title: () => data.value?.client.name ?? 'Client',
  description: () => `Tasks, logged time and invoices for ${data.value?.client.name ?? 'this client'}.`,
})
</script>

<template>
  <section v-if="data">
    <nav class="text-sm text-slate-500 dark:text-slate-400">
      <NuxtLink to="/clients" class="hover:text-slate-900 dark:hover:text-slate-100">{{ $t('clients.title') }}</NuxtLink>
      <span aria-hidden="true"> / </span>
      <span>{{ client.name }}</span>
    </nav>

    <header class="mt-2 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">{{ client.name }}</h1>
          <StatusBadge :status="client.status" />
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <span v-if="client.company">{{ client.company }} · </span>
          <a :href="`mailto:${client.email}`" class="hover:text-slate-900 dark:hover:text-slate-100">{{ client.email }}</a>
          · {{ money(client.hourlyRateMinor, client.currency) }}/h
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiButton variant="subtle" :to="`/tasks/new?clientId=${client.id}`">{{ $t('tasks.new') }}</UiButton>
        <template v-if="isOwner">
          <UiButton variant="subtle" :to="`/clients/${client.id}/edit`">{{ $t('form.edit') }}</UiButton>
          <UiButton :loading="invoicing" @click="createInvoice">{{ $t('invoices.fromUnbilled') }}</UiButton>
          <UiButton
            v-if="client.status !== 'archived'"
            variant="danger"
            @click="confirmingArchive = true"
          >
            {{ $t('clients.archive') }}
          </UiButton>
        </template>
      </div>
    </header>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile :label="$t('dashboard.openTasks')" :value="openTasks" :hint="`${data.tasks.length} total`" tone="blue" />
      <StatTile
        :label="$t('clients.recentTime')"
        :value="hours(data.time.reduce((sum, entry) => sum + entry.minutes, 0))"
        :hint="`latest of ${data.timeTotal} entries`"
      />
      <StatTile
        :label="$t('dashboard.unbilled')"
        :value="hours(unbilledMinutes)"
        :hint="money(unbilledValue, client.currency)"
        tone="amber"
      />
      <StatTile
        :label="$t('invoices.title')"
        :value="data.invoices.length"
        :hint="`${data.invoices.filter((i) => i.status === 'sent').length} awaiting payment`"
        tone="green"
      />
    </div>

    <p v-if="client.notes" class="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
      {{ client.notes }}
    </p>

    <div class="mt-8 border-b border-slate-200 dark:border-slate-800" role="tablist" aria-label="Client detail">
      <button
        v-for="item in tabs"
        :key="item.key"
        role="tab"
        type="button"
        :aria-selected="tab === item.key"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
        :class="
          tab === item.key
            ? 'border-accent-600 text-accent-700 dark:border-accent-400 dark:text-accent-300'
            : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        "
        @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="mt-6" role="tabpanel">
      <template v-if="tab === 'tasks'">
        <UiEmptyState
          v-if="!data.tasks.length"
          :title="$t('clients.noTasks')"
          :description="$t('clients.noTasksHint')"
          :action-label="$t('tasks.new')"
          :action-to="`/tasks/new?clientId=${client.id}`"
        />
        <ul v-else class="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <li v-for="task in data.tasks" :key="task.id" class="flex flex-wrap items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/tasks/${task.id}`" class="font-medium text-accent-600 hover:underline dark:text-accent-400">
                {{ task.title }}
              </NuxtLink>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ $t('tasks.dueDate') }}: {{ shortDate(task.dueDate) }}
              </p>
            </div>
            <PriorityBadge :priority="task.priority" />
            <StatusBadge :status="task.status" />
          </li>
        </ul>
      </template>

      <template v-else-if="tab === 'time'">
        <UiEmptyState
          v-if="!data.time.length"
          :title="$t('time.empty')"
          :description="$t('time.emptyHint')"
        />
        <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-3">{{ $t('time.date') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('time.note') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('time.title') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('time.billing') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr v-for="entry in data.time" :key="entry.id">
                <td class="whitespace-nowrap px-4 py-3">{{ shortDate(entry.workedOn) }}</td>
                <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ entry.note || '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3">{{ hours(entry.minutes) }}</td>
                <td class="px-4 py-3">
                  <UiBadge v-if="!entry.billable" tone="gray">{{ $t('time.nonBillable') }}</UiBadge>
                  <UiBadge v-else-if="entry.invoiceId" tone="green">{{ $t('time.billed') }}</UiBadge>
                  <UiBadge v-else tone="amber">{{ $t('dashboard.unbilled') }}</UiBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <UiEmptyState
          v-if="!data.invoices.length"
          :title="$t('invoices.empty')"
          :description="$t('invoices.emptyHint')"
        />
        <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-3">{{ $t('invoices.number') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('invoices.issuedOn') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('invoices.dueOn') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('invoices.status') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('invoices.total') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr v-for="invoice in data.invoices" :key="invoice.id">
                <td class="whitespace-nowrap px-4 py-3">
                  <NuxtLink :to="`/invoices/${invoice.id}`" class="font-medium text-accent-600 hover:underline dark:text-accent-400">
                    {{ invoice.number }}
                  </NuxtLink>
                </td>
                <td class="whitespace-nowrap px-4 py-3">{{ shortDate(invoice.issuedOn) }}</td>
                <td class="whitespace-nowrap px-4 py-3">{{ shortDate(invoice.dueOn) }}</td>
                <td class="px-4 py-3"><UiBadge :tone="invoiceTones[invoice.status]">{{ $t(`status.${invoice.status}`) }}</UiBadge></td>
                <td class="whitespace-nowrap px-4 py-3">{{ money(invoice.totalMinor, invoice.currency) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <UiModal :open="confirmingArchive" :title="$t('clients.archiveConfirm')" @close="confirmingArchive = false">
      <p class="text-sm text-slate-600 dark:text-slate-300">
        {{ client.name }} drops out of the active roster. Tasks, time and invoices stay exactly as they are, and you can
        set the status back to active whenever you want.
      </p>
      <template #footer>
        <UiButton variant="subtle" @click="confirmingArchive = false">{{ $t('form.cancel') }}</UiButton>
        <UiButton variant="danger" :loading="archiving" @click="archive">{{ $t('clients.archiveAction') }}</UiButton>
      </template>
    </UiModal>
  </section>
</template>
