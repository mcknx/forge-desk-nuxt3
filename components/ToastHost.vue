<script setup lang="ts">
const { toasts, dismiss } = useToast()

const tones: Record<string, string> = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
  info: 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
}
</script>

<template>
  <!-- aria-live on the container, not the toast: a region added to the DOM at the
       same moment as its content is not reliably announced. -->
  <div
    role="status"
    aria-live="polite"
    data-print-hide
    class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
        :class="tones[toast.tone || 'info']"
      >
        <p class="min-w-0 flex-1">{{ toast.message }}</p>
        <button
          type="button"
          class="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100"
          :aria-label="$t('common.dismiss')"
          @click="dismiss(toast.id)"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="m4 4 8 8M12 4l-8 8" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
