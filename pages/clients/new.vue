<script setup lang="ts">
import { useI18n } from 'vue-i18n'

definePageMeta({ middleware: ['auth', 'owner-only'] })

const { t } = useI18n()

useSeoMeta({
  title: () => t('clients.new'),
  description: 'Add a client to the desk.',
})
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <nav class="text-sm text-slate-500 dark:text-slate-400">
      <NuxtLink to="/clients" class="hover:text-slate-900 dark:hover:text-slate-100">{{ $t('clients.title') }}</NuxtLink>
      <span aria-hidden="true"> / </span>
      <span>{{ $t('form.new') }}</span>
    </nav>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight">{{ $t('clients.new') }}</h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ $t('clients.newHint') }}</p>

    <UiCard class="mt-6">
      <ClientForm :submit-label="$t('clients.createAction')" />
    </UiCard>
  </section>
</template>
