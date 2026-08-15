<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
  <div class="animate-pulse space-y-3" role="status" aria-label="Loading">
    <div
      v-for="row in rows"
      :key="row"
      class="h-4 rounded-lg bg-slate-200 dark:bg-slate-800"
      :class="row === rows ? 'w-2/3' : 'w-full'"
    />
  </div>
</template>
