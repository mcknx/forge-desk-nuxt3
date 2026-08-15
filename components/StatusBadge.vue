<script setup lang="ts">
import type { ClientStatus, TaskStatus } from '~~/types/domain'

const props = defineProps<{ status: ClientStatus | TaskStatus }>()

const tones: Record<ClientStatus | TaskStatus, 'gray' | 'green' | 'amber' | 'red' | 'blue'> = {
  active: 'green',
  paused: 'amber',
  archived: 'gray',
  todo: 'gray',
  in_progress: 'blue',
  blocked: 'red',
  done: 'green',
}

const tone = computed(() => tones[props.status] ?? 'gray')
</script>

<template>
  <UiBadge :tone="tone">{{ $t(`status.${status}`) }}</UiBadge>
</template>
