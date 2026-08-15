<script setup lang="ts">
import type { TaskPriority } from '~~/types/domain'

const props = defineProps<{ priority: TaskPriority }>()

const tones: Record<TaskPriority, 'gray' | 'blue' | 'amber' | 'red'> = {
  low: 'gray',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
}

const dots: Record<TaskPriority, string> = {
  low: 'bg-slate-400',
  medium: 'bg-accent-500',
  high: 'bg-amber-500',
  urgent: 'bg-red-500',
}

const tone = computed(() => tones[props.priority] ?? 'gray')
</script>

<template>
  <UiBadge :tone="tone">
    <span class="mr-1.5 h-1.5 w-1.5 rounded-full" :class="dots[priority]" aria-hidden="true" />
    {{ $t(`priority.${priority}`) }}
  </UiBadge>
</template>
