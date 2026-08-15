<script setup lang="ts">
const { appName } = useRuntimeConfig().public

useHead({
  titleTemplate: (title) => (title ? `${title} · ${appName}` : `${appName} — freelance ops desk`),
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator color="#6366f1" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ToastHost />
  </div>
</template>

<style>
/* nuxt.config declares app.pageTransition `page`; without these classes it is a no-op. */
.page-enter-active,
.page-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
    transform: none;
  }
}
</style>
