<script setup lang="ts">
withDefaults(defineProps<{ padded?: boolean }>(), { padded: true })
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
    <header
      v-if="$slots.header"
      class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800"
    >
      <slot name="header" />
    </header>
    <div :class="padded ? 'p-5' : ''">
      <slot />
    </div>
    <footer
      v-if="$slots.footer"
      class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
