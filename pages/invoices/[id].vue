<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { todayISO } from '~~/server/utils/logic'
import type { Client, Invoice } from '~~/types/domain'

// layout `print` renders no AppHeader, but the page still reads /api/invoices,
// and `isOwner` on the parent list depends on the session being loaded.
definePageMeta({ layout: 'print', middleware: 'auth' })

const route = useRoute()
const { public: config } = useRuntimeConfig()
const { t } = useI18n()

const { data: invoice } = await useFetch<Invoice>(`/api/invoices/${route.params.id}`)
if (!invoice.value) {
  throw createError({ statusCode: 404, statusMessage: 'Invoice not found', fatal: true })
}

// Sequential on purpose: the client id only exists once the invoice has loaded.
const { data: client } = await useFetch<Client>(`/api/clients/${invoice.value.clientId}`)

// Bare title — app.vue's titleTemplate appends the app name.
useSeoMeta({ title: () => invoice.value?.number ?? t('invoices.title') })

const TONE = { draft: 'gray', sent: 'blue', paid: 'green', void: 'red' } as const

const overdue = computed(
  () => invoice.value!.status !== 'paid' && invoice.value!.status !== 'void' && invoice.value!.dueOn < todayISO(),
)

// Basis points → the percentage a human reads on the line: 1250bp is 12.5%,
// and trailing zeros are noise on a printed document.
const taxPercent = computed(() => `${(invoice.value!.taxRateBp / 100).toFixed(2).replace(/\.?0+$/, '')}%`)

const totalMinutes = computed(() => invoice.value!.lines.reduce((sum, line) => sum + line.minutes, 0))

// `window` is not in the template's global allowlist, so the call lives here.
function printInvoice() {
  window.print()
}
</script>

<template>
  <!-- No `dark:` variants anywhere below. This page runs under layouts/print,
       which mounts no AppHeader, so useTheme() never bootstraps `html.dark` on
       this route — a dark variant here could only ever be dead markup. An
       invoice is paper, and paper is white. -->
  <div v-if="invoice" class="mx-auto w-full max-w-[210mm] px-4 py-8 print:px-0 print:py-0">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <UiButton variant="ghost" size="sm" to="/invoices">← {{ $t('invoices.allInvoices') }}</UiButton>
      <div class="flex items-center gap-3">
        <UiBadge :tone="TONE[invoice.status]">{{ $t(`status.${invoice.status}`) }}</UiBadge>
        <UiButton variant="primary" @click="printInvoice">{{ $t('invoices.print') }}</UiButton>
      </div>
    </div>

    <div
      v-if="overdue"
      class="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 print:border-black print:bg-transparent print:text-black"
    >
      <strong class="font-semibold">{{ $t('tasks.overdue') }}.</strong>
      Payment was due {{ shortDate(invoice.dueOn) }} ({{ relativeDate(invoice.dueOn) }}) and this invoice is still
      {{ statusLabel(invoice.status).toLowerCase() }}.
    </div>

    <article
      class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black"
    >
      <header class="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6 print:border-slate-300">
        <div>
          <p class="text-lg font-semibold tracking-tight">{{ config.appName }}</p>
          <address class="mt-1 text-sm not-italic leading-relaxed text-slate-600 print:text-slate-700">
            <span class="block">Independent product studio</span>
            <span class="block">Davao City, Philippines</span>
            <span class="block">billing@forgedesk.dev</span>
          </address>
        </div>
        <div class="text-right">
          <h1 class="text-2xl font-semibold uppercase tracking-[0.2em]">{{ $t('invoices.title') }}</h1>
          <p class="mt-1 font-mono text-sm text-slate-600 print:text-slate-700">
            {{ invoice.number }}
          </p>
        </div>
      </header>

      <section class="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2 print:border-slate-300">
        <div>
          <h2 class="text-xs font-medium uppercase tracking-wide text-slate-500 print:text-slate-600">
            {{ $t('invoices.billedTo') }}
          </h2>
          <p class="mt-2 font-medium">{{ client?.company || client?.name || $t('tasks.client') }}</p>
          <p v-if="client?.company && client.name" class="text-sm text-slate-600 print:text-slate-700">
            Attn: {{ client.name }}
          </p>
          <p v-if="client?.email" class="text-sm text-slate-600 print:text-slate-700">
            {{ client.email }}
          </p>
        </div>
        <dl class="grid grid-cols-2 gap-y-2 text-sm sm:justify-self-end sm:text-right">
          <dt class="text-slate-500 print:text-slate-600">{{ $t('invoices.issuedOn') }}</dt>
          <dd class="font-medium">{{ shortDate(invoice.issuedOn) }}</dd>
          <dt class="text-slate-500 print:text-slate-600">{{ $t('invoices.dueOn') }}</dt>
          <dd class="font-medium" :class="overdue && 'text-red-700 print:text-black'">
            {{ shortDate(invoice.dueOn) }}
          </dd>
          <dt class="text-slate-500 print:text-slate-600">{{ $t('clients.currency') }}</dt>
          <dd class="font-medium">{{ invoice.currency }}</dd>
        </dl>
      </section>

      <section class="py-6">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[32rem] text-sm">
            <caption class="sr-only">Work billed on invoice {{ invoice.number }}</caption>
            <thead>
              <tr class="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500 print:text-slate-600">
                <th scope="col" class="py-2 pr-4 font-medium">{{ $t('invoices.work') }}</th>
                <th scope="col" class="py-2 pr-4 text-right font-medium">{{ $t('time.hours') }}</th>
                <th scope="col" class="py-2 pr-4 text-right font-medium">{{ $t('clients.hourlyRate') }}</th>
                <th scope="col" class="py-2 text-right font-medium">{{ $t('invoices.amount') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 print:divide-slate-300">
              <tr v-for="line in invoice.lines" :key="line.taskId">
                <td class="py-3 pr-4">{{ line.title }}</td>
                <td class="whitespace-nowrap py-3 pr-4 text-right tabular-nums">{{ hours(line.minutes) }}</td>
                <td class="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
                  {{ money(line.rateMinor, invoice.currency) }}/h
                </td>
                <td class="whitespace-nowrap py-3 text-right tabular-nums font-medium">
                  {{ money(line.amountMinor, invoice.currency) }}
                </td>
              </tr>
              <tr v-if="!invoice.lines.length">
                <td colspan="4" class="py-6 text-center text-slate-500">
                  {{ $t('invoices.noLines') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-6 flex justify-end">
          <dl class="w-full max-w-xs space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-slate-500 print:text-slate-600">
                {{ $t('invoices.subtotal') }} · {{ hours(totalMinutes) }}
              </dt>
              <dd class="tabular-nums">{{ money(invoice.subtotalMinor, invoice.currency) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-500 print:text-slate-600">{{ $t('invoices.tax') }} ({{ taxPercent }})</dt>
              <dd class="tabular-nums">{{ money(invoice.taxMinor, invoice.currency) }}</dd>
            </div>
            <div class="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold print:border-black">
              <dt>{{ $t('invoices.totalDue') }}</dt>
              <dd class="tabular-nums">{{ money(invoice.totalMinor, invoice.currency) }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <footer class="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500 print:border-slate-300 print:text-slate-600">
        <p>Payment within the terms above by bank transfer to the account on file. Reference {{ invoice.number }}.</p>
        <p class="mt-1">Raised {{ shortDate(invoice.createdAt.slice(0, 10)) }} · {{ config.appName }}</p>
      </footer>
    </article>
  </div>
</template>
