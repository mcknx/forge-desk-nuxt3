<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue'
  }>(),
  { hint: '', tone: 'gray' },
)

const tones: Record<string, string> = {
  gray: 'text-slate-900 dark:text-slate-100',
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  blue: 'text-accent-600 dark:text-accent-400',
}

const bars: Record<string, string> = {
  gray: 'bg-slate-300 dark:bg-slate-700',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-accent-500',
}
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60"
  >
    <span class="absolute inset-y-0 left-0 w-1" :class="bars[tone]" aria-hidden="true" />
    <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ label }}</p>
    <p class="mt-2 text-2xl font-semibold tabular-nums" :class="tones[tone]">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
  </div>
</template>
