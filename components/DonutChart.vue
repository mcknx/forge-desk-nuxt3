<script setup lang="ts">
const props = defineProps<{ segments: { label: string; value: number; tone: 'gray' | 'green' | 'amber' | 'red' | 'blue' }[] }>()

const strokes: Record<string, string> = {
  gray: 'stroke-slate-300 dark:stroke-slate-700',
  green: 'stroke-emerald-500',
  amber: 'stroke-amber-500',
  red: 'stroke-red-500',
  blue: 'stroke-accent-500',
}

const dots: Record<string, string> = {
  gray: 'bg-slate-300 dark:bg-slate-700',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-accent-500',
}

const total = computed(() => props.segments.reduce((sum, s) => sum + s.value, 0))

// r = 15.915 gives a circumference of ~100, so dash lengths are literal percents.
const arcs = computed(() => {
  let offset = 25
  return props.segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = (s.value / total.value) * 100
      const arc = { ...s, pct, dash: `${pct} ${100 - pct}`, offset }
      offset -= pct
      return arc
    })
})

const label = computed(() =>
  total.value === 0
    ? 'No data to chart'
    : `Breakdown of ${total.value}: ${props.segments.map((s) => `${s.label} ${s.value}`).join(', ')}`,
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-6">
    <div class="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 42 42" class="h-full w-full" role="img" :aria-label="label">
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="none"
          stroke-width="4"
          class="stroke-slate-100 dark:stroke-slate-800"
        />
        <circle
          v-for="arc in arcs"
          :key="arc.label"
          cx="21"
          cy="21"
          r="15.915"
          fill="none"
          stroke-width="4"
          stroke-linecap="butt"
          :stroke-dasharray="arc.dash"
          :stroke-dashoffset="arc.offset"
          :class="strokes[arc.tone]"
        />
      </svg>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{{ total }}</span>
        <span class="text-[11px] uppercase tracking-wide text-slate-400">total</span>
      </div>
    </div>

    <ul class="min-w-0 flex-1 space-y-2 text-sm">
      <li v-for="segment in segments" :key="segment.label" class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="dots[segment.tone]" aria-hidden="true" />
        <span class="truncate text-slate-600 dark:text-slate-300">{{ segment.label }}</span>
        <span class="ml-auto tabular-nums font-medium text-slate-900 dark:text-slate-100">{{ segment.value }}</span>
      </li>
    </ul>
  </div>
</template>
