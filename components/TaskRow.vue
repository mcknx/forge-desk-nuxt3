<script setup lang="ts">
import type { Task } from '~~/types/domain'

const props = defineProps<{ task: Task; clientName?: string }>()
const emit = defineEmits<{ toggle: [task: Task] }>()

// Same rule as server/utils/logic.ts isOverdue — a done task is never late,
// however late it was finished. Duplicated rather than importing server code.
const overdue = computed(
  () => props.task.status !== 'done' && !!props.task.dueDate && props.task.dueDate < new Date().toISOString().slice(0, 10),
)
</script>

<template>
  <!-- A row, not a <tr>: every caller mounts this inside <ul><li>, where table
       elements are invalid and the browser hoists them out of the list. -->
  <div class="flex items-start gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/60">
    <input
      type="checkbox"
      :checked="task.status === 'done'"
      :aria-label="`${task.status === 'done' ? $t('tasks.markTodo') : $t('tasks.markDone')}: ${task.title}`"
      class="mt-0.5 h-4 w-4 shrink-0 accent-accent-600"
      @change="emit('toggle', task)"
    />

    <div class="min-w-0 flex-1">
      <NuxtLink
        :to="`/tasks/${task.id}`"
        class="font-medium text-slate-900 hover:text-accent-600 dark:text-slate-100 dark:hover:text-accent-400"
        :class="{ 'line-through opacity-60': task.status === 'done' }"
      >
        {{ task.title }}
      </NuxtLink>
      <p v-if="clientName" class="truncate text-xs text-slate-500 dark:text-slate-400">{{ clientName }}</p>
    </div>

    <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <StatusBadge :status="task.status" />
      <PriorityBadge :priority="task.priority" />
      <span
        class="text-sm tabular-nums"
        :class="overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'"
      >
        {{ shortDate(task.dueDate) }}
        <span v-if="overdue" class="ml-1 text-xs font-medium">{{ $t('tasks.overdue') }}</span>
      </span>
    </div>
  </div>
</template>
