<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    actionLabel?: string
    actionTo?: string
  }>(),
  { title: '', description: '', actionLabel: '', actionTo: '' },
)
</script>

<template>
  <div
    class="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700"
  >
    <div
      class="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
      aria-hidden="true"
    >
      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <path d="M3 8h14M7 12h6" stroke-linecap="round" />
      </svg>
    </div>
    <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ title || $t('common.nothingHere') }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{{ description }}</p>
    <UiButton v-if="actionLabel && actionTo" :to="actionTo" size="sm" class="mt-5">{{ actionLabel }}</UiButton>
    <slot />
  </div>
</template>
