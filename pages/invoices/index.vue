<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { todayISO } from '~~/server/utils/logic'
import type { Client, Invoice, InvoiceStatus, Page } from '~~/types/domain'

// Without this, useAuth() never refreshes on a fresh SSR load and `isOwner`
// is false — the owner would see no status controls on any row.
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()

// Bare title — app.vue's titleTemplate appends the app name.
useSeoMeta({ title: () => t('invoices.title') })

const toast = useToast()
const { isOwner } = useAuth()

const { data: invoiceData, pending } = await useFetch<Page<Invoice> | Invoice[]>('/api/invoices', {
  key: 'invoice-list',
})
const { data: clientPage } = await useFetch<Page<Client>>('/api/clients', {
  key: 'invoice-clients',
  query: { status: 'all', perPage: 100 },
})

const invoices = computed(() =>
  Array.isArray(invoiceData.value) ? invoiceData.value : (invoiceData.value?.items ?? []),
)
const clientById = computed(() => new Map((clientPage.value?.items ?? []).map((c) => [c.id, c])))

// StatusBadge covers client and task statuses; invoices have their own four.
const GROUPS: { status: InvoiceStatus; tone: 'gray' | 'blue' | 'green' | 'red' }[] = [
  { status: 'draft', tone: 'gray' },
  { status: 'sent', tone: 'blue' },
  { status: 'paid', tone: 'green' },
  { status: 'void', tone: 'red' },
]

// Only forward moves plus a void escape hatch: a paid invoice going back to
// draft is an accounting rewrite, not a UI affordance. Computed so the labels
// follow the locale switch.
const NEXT = computed<Record<InvoiceStatus, { status: InvoiceStatus; label: string; variant: 'primary' | 'ghost' }[]>>(
  () => ({
    draft: [
      { status: 'sent', label: t('invoices.markSent'), variant: 'primary' },
      { status: 'void', label: t('invoices.voidInvoice'), variant: 'ghost' },
    ],
    sent: [
      { status: 'paid', label: t('invoices.markPaid'), variant: 'primary' },
      { status: 'void', label: t('invoices.voidInvoice'), variant: 'ghost' },
    ],
    paid: [],
    void: [{ status: 'draft', label: t('invoices.reopen'), variant: 'ghost' }],
  }),
)

const today = todayISO()

function isOverdue(invoice: Invoice) {
  return invoice.status === 'sent' && invoice.dueOn < today
}

/** Currencies never get added together — one running total per currency. */
function sumByCurrency(list: Invoice[]) {
  const byCurrency = new Map<string, number>()
  for (const invoice of list) {
    byCurrency.set(invoice.currency, (byCurrency.get(invoice.currency) ?? 0) + invoice.totalMinor)
  }
  return [...byCurrency.entries()].map(([currency, minor]) => money(minor, currency)).join(' · ')
}

const groups = computed(() =>
  GROUPS.map((group) => {
    const items = invoices.value.filter((i) => i.status === group.status)
    return { ...group, items, total: sumByCurrency(items) }
  }),
)

const busy = ref<string | null>(null)

async function setStatus(invoice: Invoice, status: InvoiceStatus) {
  const previous = invoice.status
  // Optimistic: the row jumps to its new group before the round trip, and jumps
  // back if the server refuses.
  invoice.status = status
  busy.value = invoice.id
  try {
    const updated = await $fetch<Invoice>(`/api/invoices/${invoice.id}`, { method: 'PATCH', body: { status } })
    Object.assign(invoice, updated)
    toast.push(`${invoice.number} is now ${statusLabel(status).toLowerCase()}`, 'ok')
  } catch (error: any) {
    invoice.status = previous
    toast.push(error?.data?.statusMessage || error?.statusMessage || 'Status change failed — rolled back', 'error')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {{ $t('invoices.title') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ $t('invoices.subtitle') }}</p>
      </div>
      <UiButton variant="subtle" to="/time">{{ $t('invoices.reviewUnbilled') }}</UiButton>
    </div>

    <UiSkeleton v-if="pending" :rows="8" />

    <UiEmptyState
      v-else-if="!invoices.length"
      :title="$t('invoices.empty')"
      :description="$t('invoices.emptyHint')"
      :action-label="$t('invoices.openTimesheet')"
      action-to="/time"
    />

    <template v-else>
      <UiCard v-for="group in groups" :key="group.status">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <UiBadge :tone="group.tone">{{ $t(`status.${group.status}`) }}</UiBadge>
              <span class="text-sm text-slate-500 dark:text-slate-400">
                {{ group.items.length }} · {{ $t(`invoices.blurb.${group.status}`) }}
              </span>
            </div>
            <span class="tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ group.total || '—' }}
            </span>
          </div>
        </template>

        <p v-if="!group.items.length" class="py-2 text-sm text-slate-500 dark:text-slate-400">
          {{ $t('common.none') }}
        </p>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[44rem] text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th scope="col" class="py-2 pr-4 font-medium">{{ $t('invoices.number') }}</th>
                <th scope="col" class="py-2 pr-4 font-medium">{{ $t('tasks.client') }}</th>
                <th scope="col" class="py-2 pr-4 font-medium">{{ $t('invoices.issuedOn') }}</th>
                <th scope="col" class="py-2 pr-4 font-medium">{{ $t('invoices.dueOn') }}</th>
                <th scope="col" class="py-2 pr-4 text-right font-medium">{{ $t('invoices.total') }}</th>
                <th scope="col" class="py-2 text-right font-medium"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="invoice in group.items" :key="invoice.id">
                <td class="whitespace-nowrap py-3 pr-4 font-medium">
                  <NuxtLink
                    :to="`/invoices/${invoice.id}`"
                    class="rounded font-mono text-slate-900 hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-slate-100 dark:hover:text-accent-400"
                  >
                    {{ invoice.number }}
                  </NuxtLink>
                </td>
                <td class="py-3 pr-4 text-slate-700 dark:text-slate-300">
                  {{ clientById.get(invoice.clientId)?.company || clientById.get(invoice.clientId)?.name || '—' }}
                </td>
                <td class="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-400">
                  {{ shortDate(invoice.issuedOn) }}
                </td>
                <td class="whitespace-nowrap py-3 pr-4">
                  <span class="text-slate-600 dark:text-slate-400">{{ shortDate(invoice.dueOn) }}</span>
                  <UiBadge v-if="isOverdue(invoice)" tone="red" class="ml-2">{{ $t('tasks.overdue') }}</UiBadge>
                </td>
                <td class="whitespace-nowrap py-3 pr-4 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {{ money(invoice.totalMinor, invoice.currency) }}
                </td>
                <td class="py-3 text-right">
                  <div class="flex justify-end gap-2">
                    <UiButton
                      v-for="action in (isOwner ? NEXT[invoice.status] : [])"
                      :key="action.status"
                      :variant="action.variant"
                      size="sm"
                      :loading="busy === invoice.id"
                      @click="setStatus(invoice, action.status)"
                    >
                      {{ action.label }}
                    </UiButton>
                    <UiButton variant="subtle" size="sm" :to="`/invoices/${invoice.id}`">
                      {{ $t('invoices.view') }}
                    </UiButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiCard>
    </template>
  </section>
</template>
