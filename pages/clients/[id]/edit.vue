<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Client } from '~~/types/domain'

definePageMeta({ middleware: ['auth', 'owner-only'] })

const id = useRoute().params.id as string
const { t } = useI18n()

const { data: client, error } = await useFetch<Client>(`/api/clients/${id}`)

if (error.value || !client.value) {
  throw createError({
    statusCode: (error.value as { statusCode?: number } | null)?.statusCode ?? 404,
    statusMessage: 'Client not found',
    fatal: true,
  })
}

// Bare title — app.vue's titleTemplate appends the app name.
useSeoMeta({ title: () => `${t('clients.edit')} — ${client.value?.name ?? ''}` })
</script>

<template>
  <section v-if="client" class="mx-auto max-w-3xl">
    <nav class="text-sm text-slate-500 dark:text-slate-400">
      <NuxtLink to="/clients" class="hover:text-slate-900 dark:hover:text-slate-100">{{ $t('clients.title') }}</NuxtLink>
      <span aria-hidden="true"> / </span>
      <NuxtLink :to="`/clients/${client.id}`" class="hover:text-slate-900 dark:hover:text-slate-100">{{ client.name }}</NuxtLink>
      <span aria-hidden="true"> / </span>
      <span>{{ $t('form.edit') }}</span>
    </nav>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight">{{ $t('clients.edit') }} — {{ client.name }}</h1>
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ $t('clients.editHint') }}</p>

    <UiCard class="mt-6">
      <ClientForm :client="client" :submit-label="$t('clients.saveAction')" />
    </UiCard>
  </section>
</template>
