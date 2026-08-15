<script setup lang="ts">
import type { DriverKind } from '~~/types/domain'

const driver = ref<DriverKind | null>(null)
const dismissed = ref(false)

// Client-side only: the banner is an honesty notice, not content worth blocking
// SSR (or a hydration mismatch) for.
onMounted(async () => {
  const health = await $fetch<{ driver: DriverKind }>('/api/health').catch(() => null)
  driver.value = health?.driver ?? null
})
</script>

<template>
  <div
    v-if="driver === 'memory' && !dismissed"
    role="status"
    data-print-hide
    class="border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
  >
    <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 5v3.5M8 11h.01" stroke-linecap="round" />
      </svg>
      <p class="min-w-0">{{ $t('common.memoryDriver') }}</p>
      <button
        type="button"
        class="ml-auto shrink-0 rounded-lg p-1 hover:bg-amber-100 dark:hover:bg-amber-500/20"
        :aria-label="$t('common.dismiss')"
        @click="dismissed = true"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
          <path d="m4 4 8 8M12 4l-8 8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>
