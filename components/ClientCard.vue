<script setup lang="ts">
import type { Client } from '~~/types/domain'

defineProps<{ client: Client }>()
</script>

<template>
  <article
    class="group relative rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-accent-400 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-accent-500"
  >
    <div class="flex items-start gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-sm font-semibold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"
        aria-hidden="true"
      >
        {{ initials(client.name) }}
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-semibold text-slate-900 dark:text-slate-100">
          <!-- Stretched link: the whole card is clickable but there is still exactly
               one tab stop and one accessible name. -->
          <NuxtLink :to="`/clients/${client.id}`" class="after:absolute after:inset-0 after:rounded-2xl">
            {{ client.name }}
          </NuxtLink>
        </h3>
        <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ client.company || 'Independent' }}</p>
      </div>
      <StatusBadge :status="client.status" />
    </div>

    <p v-if="client.notes" class="mt-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{{ client.notes }}</p>

    <dl class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
      <div>
        <dt class="text-slate-400">Rate</dt>
        <dd class="mt-0.5 font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {{ money(client.hourlyRateMinor, client.currency) }}<span class="text-slate-400">/h</span>
        </dd>
      </div>
      <div class="text-right">
        <dt class="text-slate-400">Updated</dt>
        <dd class="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{{ relativeDate(client.updatedAt) }}</dd>
      </div>
    </dl>
  </article>
</template>
