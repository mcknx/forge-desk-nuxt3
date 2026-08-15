<template>
  <div class="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <!-- First focusable element on every page, per WCAG 2.4.1. -->
    <a
      href="#main"
      class="sr-only rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
    >
      {{ $t('common.skipToContent') }}
    </a>

    <AppHeader />
    <DriverBanner />

    <!-- tabindex -1 so the skip link actually lands focus here, not just the scroll position. -->
    <main id="main" tabindex="-1" class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:px-8">
      <slot />
    </main>

    <AppFooter />
    <CommandPalette />
  </div>
</template>
