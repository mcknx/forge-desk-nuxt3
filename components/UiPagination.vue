<script setup lang="ts">
const props = defineProps<{
  page: number
  pages: number
  total: number
  perPage: number
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1))
const to = computed(() => Math.min(props.page * props.perPage, props.total))

// A sliding window of five keeps the control one line wide on mobile even at
// page 400 — first/last are always reachable through the arrows.
const windowed = computed(() => {
  const size = Math.min(5, props.pages)
  const start = Math.max(1, Math.min(props.page - 2, props.pages - size + 1))
  return Array.from({ length: size }, (_, i) => start + i)
})

function go(page: number) {
  if (page >= 1 && page <= props.pages && page !== props.page) emit('update:page', page)
}
</script>

<template>
  <nav
    v-if="total > 0"
    :aria-label="$t('common.pagination')"
    class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800"
  >
    <i18n-t keypath="common.showing" tag="p" class="text-xs text-slate-500 dark:text-slate-400">
      <template #range>
        <span class="font-medium text-slate-700 dark:text-slate-200">{{ from }}–{{ to }}</span>
      </template>
      <template #total>{{ total }}</template>
    </i18n-t>

    <div v-if="pages > 1" class="flex items-center gap-1">
      <UiButton variant="subtle" size="sm" :disabled="page <= 1" @click="go(page - 1)">{{ $t('common.previous') }}</UiButton>
      <button
        v-for="p in windowed"
        :key="p"
        type="button"
        class="h-8 min-w-8 rounded-lg px-2 text-xs font-medium transition-colors"
        :class="
          p === page
            ? 'bg-accent-600 text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        :aria-label="$t('common.pageNumber', { page: p })"
        :aria-current="p === page ? 'page' : undefined"
        @click="go(p)"
      >
        {{ p }}
      </button>
      <UiButton variant="subtle" size="sm" :disabled="page >= pages" @click="go(page + 1)">{{ $t('common.next') }}</UiButton>
    </div>
  </nav>
</template>
