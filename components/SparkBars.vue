<script setup lang="ts">
const props = defineProps<{ data: { date: string; minutes: number }[] }>()

const SLOT = 10
const HEIGHT = 40

const series = computed(() => props.data.slice(-14))
const peak = computed(() => Math.max(...series.value.map((d) => d.minutes), 0))

const bars = computed(() => {
  const max = Math.max(peak.value, 1)
  return series.value.map((point, i) => {
    // Empty days keep a 1.5-unit stub so the axis reads as a timeline, not a gap.
    const height = point.minutes > 0 ? Math.max(2, (point.minutes / max) * (HEIGHT - 2)) : 1.5
    return { ...point, i, x: i * SLOT + 1, y: HEIGHT - height, height }
  })
})

const busiest = computed(() => series.value.find((d) => d.minutes === peak.value))

// An SVG is invisible to a screen reader, so the numbers go in the label.
const label = computed(() => {
  const total = series.value.reduce((sum, d) => sum + d.minutes, 0)
  if (!total) return `No time logged in the last ${series.value.length} days`
  return `Time logged per day over the last ${series.value.length} days: ${hours(total)} total, busiest ${hours(peak.value)} on ${shortDate(busiest.value?.date ?? null)}`
})

const hovered = ref<number | null>(null)
const tip = computed(() => (hovered.value === null ? null : bars.value[hovered.value]))
</script>

<template>
  <div class="relative" @mouseleave="hovered = null">
    <svg
      :viewBox="`0 0 ${Math.max(series.length, 1) * SLOT} ${HEIGHT}`"
      preserveAspectRatio="none"
      class="h-24 w-full"
      role="img"
      :aria-label="label"
    >
      <rect
        v-for="bar in bars"
        :key="bar.date"
        :x="bar.x"
        :y="bar.y"
        :width="SLOT - 2"
        :height="bar.height"
        class="transition-opacity"
        :class="[
          bar.minutes > 0 ? 'fill-accent-500' : 'fill-slate-200 dark:fill-slate-800',
          hovered !== null && hovered !== bar.i ? 'opacity-40' : '',
        ]"
        @mouseenter="hovered = bar.i"
      />
    </svg>

    <div
      v-if="tip"
      class="pointer-events-none absolute bottom-full z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-slate-700"
      :style="{ left: `${((tip.i + 0.5) / Math.max(series.length, 1)) * 100}%` }"
    >
      {{ hours(tip.minutes) }} · {{ shortDate(tip.date) }}
    </div>

    <div v-if="series.length" class="mt-2 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
      <span>{{ shortDate(series[0]!.date) }}</span>
      <span>{{ shortDate(series[series.length - 1]!.date) }}</span>
    </div>
  </div>
</template>
