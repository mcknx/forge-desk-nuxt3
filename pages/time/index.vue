<script setup lang="ts">
// Same rounding rule the invoice builder uses. logic.ts is pure and imports
// nothing but types, so reusing it beats a second definition of "what an hour
// of this client's time is worth" drifting a cent away from the invoice.
import { useI18n } from 'vue-i18n'
import { minutesToMinor } from '~~/server/utils/logic'
import type { Client, Invoice, Page, TimeEntry } from '~~/types/domain'

// Without this, useAuth() never refreshes on a fresh SSR load and `isOwner` is
// false — the owner would see no Delete button on any row.
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()

// Bare title — app.vue's titleTemplate appends the app name.
useSeoMeta({ title: () => t('time.title') })

const toast = useToast()
const { isOwner } = useAuth()
const { filters, setFilter, reset } = useListQuery({ clientId: '', from: '', to: '', unbilledOnly: '', page: 1 })
const f = computed<Record<string, any>>(() => unref(filters) as Record<string, any>)

const unbilledOnly = computed(() => f.value.unbilledOnly === true || f.value.unbilledOnly === 'true')

/**
 * Blank filters are dropped, never sent. `clientId=`, `from=` and
 * `unbilledOnly=` all fail timeQuerySchema, so an untouched form would 422 the
 * whole page instead of meaning "no filter".
 */
const active = computed(() => {
  const out: Record<string, string> = {}
  for (const key of ['clientId', 'from', 'to'] as const) {
    if (f.value[key]) out[key] = String(f.value[key])
  }
  if (unbilledOnly.value) out.unbilledOnly = 'true'
  return out
})

const listQuery = computed(() => ({ ...active.value, page: Number(f.value.page) || 1, perPage: 25 }))
// ponytail: the summary is a second read of the same filter capped at the
// schema's 100-row page, so an unfiltered desk with more entries than that
// reports on a prefix — the strip says so. Real fix is an aggregate endpoint.
const summaryQuery = computed(() => ({ ...active.value, page: 1, perPage: 100 }))

const { data: list, pending, refresh } = await useFetch<Page<TimeEntry>>('/api/time', {
  key: 'time-list',
  query: listQuery,
})
const { data: summary, refresh: refreshSummary } = await useFetch<Page<TimeEntry>>('/api/time', {
  key: 'time-summary',
  query: summaryQuery,
})
const { data: clientPage } = await useFetch<Page<Client>>('/api/clients', {
  key: 'time-clients',
  query: { status: 'all', perPage: 100 },
})
const { data: invoiceData } = await useFetch<Page<Invoice> | Invoice[]>('/api/invoices', { key: 'time-invoices' })

const entries = computed(() => list.value?.items ?? [])
const clients = computed(() => clientPage.value?.items ?? [])
const clientById = computed(() => new Map(clients.value.map((c) => [c.id, c])))
const invoiceById = computed(() => {
  const raw = Array.isArray(invoiceData.value) ? invoiceData.value : (invoiceData.value?.items ?? [])
  return new Map(raw.map((i) => [i.id, i]))
})

const clientOptions = computed(() => [
  { value: '', label: t('form.allClients') },
  ...clients.value.map((c) => ({ value: c.id, label: c.company || c.name })),
])

function entryValue(entry: TimeEntry): { minor: number; currency: string } | null {
  const client = clientById.value.get(entry.clientId)
  if (!client || !entry.billable) return null
  return { minor: minutesToMinor(entry.minutes, client.hourlyRateMinor), currency: client.currency }
}

const totals = computed(() => {
  const rows = summary.value?.items ?? []
  // Clients bill in four currencies here, so unbilled value is a set of totals,
  // not one number — adding USD to EUR would be a lie with a decimal point.
  const unbilled = new Map<string, number>()
  let minutes = 0
  let billable = 0
  for (const entry of rows) {
    minutes += entry.minutes
    if (entry.billable) billable += entry.minutes
    if (entry.invoiceId) continue
    const value = entryValue(entry)
    if (value) unbilled.set(value.currency, (unbilled.get(value.currency) ?? 0) + value.minor)
  }
  return { minutes, billable, unbilled: [...unbilled.entries()] }
})

const unbilledLabel = computed(() =>
  totals.value.unbilled.length ? totals.value.unbilled.map(([cur, minor]) => money(minor, cur)).join(' · ') : '—',
)
const partial = computed(() => (summary.value?.total ?? 0) > (summary.value?.items.length ?? 0))

// The export has to hand over what the screen is showing; page size is a
// viewing concern, so it stays out of the CSV query.
const exportHref = computed(() => {
  const qs = new URLSearchParams(active.value).toString()
  return qs ? `/api/export/time.csv?${qs}` : '/api/export/time.csv'
})

const hasFilters = computed(() => Object.keys(active.value).length > 0)
const pendingDelete = ref<TimeEntry | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  const entry = pendingDelete.value
  if (!entry) return
  deleting.value = true
  try {
    await $fetch(`/api/time/${entry.id}`, { method: 'DELETE' })
    pendingDelete.value = null
    await Promise.all([refresh(), refreshSummary()])
    toast.push('Time entry deleted', 'ok')
  } catch (error: any) {
    toast.push(error?.data?.statusMessage || error?.statusMessage || 'Could not delete that entry', 'error')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{{ $t('time.title') }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ $t('time.subtitle') }}</p>
      </div>
      <a
        :href="exportHref"
        class="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
      >
        {{ $t('time.export') }}
        <span class="text-xs font-normal text-slate-500 dark:text-slate-400">
          {{ hasFilters ? 'filtered' : 'all' }}
        </span>
      </a>
    </div>

    <UiCard>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UiSelect
          :label="$t('tasks.client')"
          :model-value="f.clientId"
          :options="clientOptions"
          @update:model-value="setFilter('clientId', $event)"
        />
        <UiInput
          :label="$t('time.from')"
          type="date"
          :model-value="f.from"
          @update:model-value="setFilter('from', $event)"
        />
        <UiInput
          :label="$t('time.to')"
          type="date"
          :model-value="f.to"
          @update:model-value="setFilter('to', $event)"
        />
        <div class="flex items-end gap-2">
          <UiButton
            :variant="unbilledOnly ? 'primary' : 'subtle'"
            :aria-pressed="unbilledOnly"
            @click="setFilter('unbilledOnly', unbilledOnly ? '' : 'true')"
          >
            {{ $t('time.unbilledOnly') }}
          </UiButton>
          <UiButton v-if="hasFilters" variant="ghost" @click="reset()">{{ $t('form.clear') }}</UiButton>
        </div>
      </div>
    </UiCard>

    <div class="grid gap-4 sm:grid-cols-3">
      <StatTile
        :label="$t('time.totalHours')"
        :value="hours(totals.minutes)"
        :hint="`${summary?.total ?? 0} entries matched`"
      />
      <StatTile
        :label="$t('dashboard.billableHours')"
        :value="hours(totals.billable)"
        hint="Non-billable time is tracked but never invoiced"
        tone="blue"
      />
      <StatTile
        :label="$t('time.unbilledValue')"
        :value="unbilledLabel"
        hint="Billable, not yet on an invoice"
        tone="amber"
      />
    </div>

    <p v-if="partial" class="text-xs text-slate-500 dark:text-slate-400">
      Totals cover the first {{ summary?.items.length }} of {{ summary?.total }} matching entries — narrow the filters
      for an exact figure.
    </p>

    <UiCard>
      <UiSkeleton v-if="pending" :rows="6" />
      <UiEmptyState
        v-else-if="!entries.length"
        :title="hasFilters ? $t('time.emptyFiltered') : $t('time.empty')"
        :description="hasFilters ? $t('time.emptyFilteredHint') : $t('time.emptyHint')"
        :action-label="$t('time.goToTasks')"
        action-to="/tasks"
      />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[46rem] text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th scope="col" class="py-2 pr-4 font-medium">{{ $t('time.date') }}</th>
              <th scope="col" class="py-2 pr-4 font-medium">{{ $t('tasks.client') }}</th>
              <th scope="col" class="py-2 pr-4 font-medium">{{ $t('time.note') }}</th>
              <th scope="col" class="py-2 pr-4 text-right font-medium">{{ $t('time.hours') }}</th>
              <th scope="col" class="py-2 pr-4 text-right font-medium">{{ $t('time.value') }}</th>
              <th scope="col" class="py-2 pr-4 font-medium">{{ $t('time.billing') }}</th>
              <th scope="col" class="py-2 text-right font-medium"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="entry in entries" :key="entry.id" class="align-top">
              <td class="whitespace-nowrap py-3 pr-4 text-slate-700 dark:text-slate-300">
                {{ shortDate(entry.workedOn) }}
              </td>
              <td class="py-3 pr-4 text-slate-700 dark:text-slate-300">
                <NuxtLink
                  :to="`/clients/${entry.clientId}`"
                  class="rounded hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:text-accent-400"
                >
                  {{ clientById.get(entry.clientId)?.company || clientById.get(entry.clientId)?.name || 'Unknown client' }}
                </NuxtLink>
              </td>
              <td class="py-3 pr-4 text-slate-600 dark:text-slate-400">{{ entry.note || '—' }}</td>
              <td class="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-slate-900 dark:text-slate-100">
                {{ hours(entry.minutes) }}
              </td>
              <td class="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                {{ entryValue(entry) ? money(entryValue(entry)!.minor, entryValue(entry)!.currency) : '—' }}
              </td>
              <td class="py-3 pr-4">
                <UiBadge v-if="!entry.billable" tone="gray">{{ $t('time.nonBillable') }}</UiBadge>
                <UiBadge v-else-if="entry.invoiceId" tone="green">{{ $t('time.billed') }}</UiBadge>
                <UiBadge v-else tone="amber">{{ $t('dashboard.unbilled') }}</UiBadge>
              </td>
              <td class="py-3 text-right">
                <UiButton
                  v-if="isOwner && !entry.invoiceId"
                  variant="ghost"
                  size="sm"
                  @click="pendingDelete = entry"
                >
                  {{ $t('form.delete') }}
                </UiButton>
                <p v-else-if="entry.invoiceId" class="text-xs text-slate-500 dark:text-slate-400">
                  On
                  <NuxtLink
                    :to="`/invoices/${entry.invoiceId}`"
                    class="rounded font-medium text-accent-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400"
                  >
                    {{ invoiceById.get(entry.invoiceId)?.number ?? 'an invoice' }}
                  </NuxtLink>
                  — void that invoice to release the time.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template v-if="list && list.pages > 1" #footer>
        <UiPagination
          :page="list.page"
          :pages="list.pages"
          :total="list.total"
          :per-page="list.perPage"
          @update:page="setFilter('page', $event)"
        />
      </template>
    </UiCard>

    <UiModal :open="!!pendingDelete" :title="$t('time.deleteConfirm')" @close="pendingDelete = null">
      <p class="text-sm text-slate-600 dark:text-slate-300">
        {{ hours(pendingDelete?.minutes ?? 0) }} on {{ shortDate(pendingDelete?.workedOn ?? null) }} for
        {{ clientById.get(pendingDelete?.clientId ?? '')?.name ?? 'this client' }}. Deleting it removes the minutes from
        every total on this page — there is no undo.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="pendingDelete = null">{{ $t('form.cancel') }}</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="confirmDelete">{{ $t('form.delete') }}</UiButton>
      </template>
    </UiModal>
  </section>
</template>
