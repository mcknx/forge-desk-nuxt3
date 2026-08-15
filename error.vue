<script setup lang="ts">
const error = useError()

const status = computed(() => Number(error.value?.statusCode) || 500)
const isNotFound = computed(() => status.value === 404)

/**
 * `message` can carry a stack frame, a query fragment or a driver string on a
 * 500, so only the curated statusMessage is ever shown, and only for 4xx.
 * Anything server-side collapses to one line the visitor can act on.
 */
const headline = computed(() => {
  if (isNotFound.value) return 'That page does not exist'
  if (status.value === 403) return 'You do not have access to that'
  if (status.value < 500) return String(error.value?.statusMessage || 'That request could not be completed')
  return 'Something broke on our side'
})

const detail = computed(() =>
  isNotFound.value
    ? 'The link may be stale, or the record was deleted. The desk itself is fine.'
    : status.value < 500
      ? 'Check the address, then try again.'
      : 'The error was logged. Nothing you did caused it, and your data is untouched.',
)

useSeoMeta({ title: `${status.value} — ${headline.value}`, robots: 'noindex' })

async function goHome() {
  // clearError with a redirect is the only way out: without it the error state
  // survives client-side navigation and the page renders again on the next route.
  await clearError({ redirect: '/' })
}
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
  >
    <div class="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
      <p class="font-mono text-sm font-medium text-indigo-600 dark:text-indigo-400">Error {{ status }}</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{{ headline }}</h1>
      <p class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{{ detail }}</p>

      <div class="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          @click="goHome"
        >
          Back to Forge Desk
        </button>
        <NuxtLink
          to="/dashboard"
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          @click="clearError()"
        >
          Go to the dashboard
        </NuxtLink>
      </div>
    </div>

    <p class="mt-6 text-xs text-slate-500 dark:text-slate-500">
      Forge Desk — portfolio build. Source and demo credentials are public.
    </p>
  </div>
</template>
