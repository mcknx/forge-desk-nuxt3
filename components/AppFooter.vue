<script setup lang="ts">
const { appName, commit } = useRuntimeConfig().public
</script>

<template>
  <footer data-print-hide class="mt-16 border-t border-slate-200 dark:border-slate-800">
    <div
      class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400"
    >
      <p>{{ appName }} — {{ $t('footer.tagline') }}</p>
      <div class="flex items-center gap-4">
        <NuxtLink to="/style-guide" class="hover:text-slate-900 dark:hover:text-slate-200">{{ $t('nav.styleGuide') }}</NuxtLink>
        <!-- i18n-t, not concatenation: the shortcut sits mid-sentence in English
             and other languages put it somewhere else entirely. -->
        <i18n-t keypath="footer.searchHint" tag="span" class="hidden sm:inline">
          <template #key>
            <kbd class="rounded border border-slate-300 px-1 font-mono text-[10px] dark:border-slate-700">⌘K</kbd>
          </template>
        </i18n-t>
        <span class="font-mono">{{ commit }}</span>
      </div>
    </div>
  </footer>
</template>
