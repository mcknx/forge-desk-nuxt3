<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Client, Page, Task } from '~~/types/domain'

definePageMeta({ middleware: ['auth', 'owner-only'] })

const { t } = useI18n()
const route = useRoute()
const { push } = useToast()

const { data: clients } = await useFetch<Page<Client>>('/api/clients', {
  query: { status: 'all', perPage: 100, sort: 'name' },
})

const clientOptions = computed(() => [
  { value: '', label: t('form.selectClient') },
  ...(clients.value?.items ?? []).map((c) => ({ value: c.id, label: c.company ? `${c.name} — ${c.company}` : c.name })),
])

const priorityOptions = computed(() =>
  ['low', 'medium', 'high', 'urgent'].map((p) => ({ value: p, label: t(`priority.${p}`) })),
)

const form = reactive({
  // Deep-linked from a client page, so the picker starts on the right client.
  clientId: typeof route.query.clientId === 'string' ? route.query.clientId : '',
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  estimateHours: '',
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)

function validate() {
  for (const key of Object.keys(errors)) delete errors[key]
  if (!form.clientId) errors.clientId = 'Pick the client this belongs to'
  if (form.title.trim().length < 3) errors.title = 'Title must be at least 3 characters'
  const estimate = Number(form.estimateHours || 0)
  if (!Number.isFinite(estimate) || estimate < 0) errors.estimateHours = 'Estimate must be zero or more'
  return Object.keys(errors).length === 0
}

const FIELD_ALIASES: Record<string, string> = { estimateMinutes: 'estimateHours' }

async function submit() {
  if (!validate()) return
  saving.value = true
  const body = {
    clientId: form.clientId,
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    // The form asks for hours because that is how anyone estimates; the API
    // stores minutes.
    estimateMinutes: Math.round(Number(form.estimateHours || 0) * 60),
    dueDate: form.dueDate || null,
  }
  try {
    const task = await $fetch<Task>('/api/tasks', { method: 'POST', body })
    push(`${task.title} created`, 'ok')
    await navigateTo(`/tasks/${task.id}`)
  } catch (cause) {
    const error = cause as { data?: any }
    const fields: Record<string, string> | undefined = error?.data?.data?.fields ?? error?.data?.fields
    if (fields && Object.keys(fields).length) {
      for (const [field, message] of Object.entries(fields)) errors[FIELD_ALIASES[field] ?? field] = message
      push('Check the highlighted fields', 'error')
    } else {
      push(error?.data?.statusMessage ?? 'Could not create the task', 'error')
    }
  } finally {
    saving.value = false
  }
}

useSeoMeta({ title: () => t('tasks.new'), description: 'Add a task to the desk.' })
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <nav class="text-sm text-slate-500 dark:text-slate-400">
      <NuxtLink to="/tasks" class="hover:text-slate-900 dark:hover:text-slate-100">{{ $t('tasks.title') }}</NuxtLink>
      <span aria-hidden="true"> / </span>
      <span>{{ $t('form.new') }}</span>
    </nav>
    <h1 class="mt-2 text-2xl font-semibold tracking-tight">{{ $t('tasks.new') }}</h1>

    <UiCard class="mt-6">
      <form novalidate class="space-y-5" @submit.prevent="submit">
        <UiSelect
          v-model="form.clientId"
          :label="$t('tasks.client')"
          required
          :options="clientOptions"
          :error="errors.clientId"
        />
        <UiInput
          v-model="form.title"
          :label="$t('tasks.taskTitle')"
          required
          :error="errors.title"
          placeholder="Ship the checkout rewrite"
        />
        <UiTextarea
          v-model="form.description"
          :label="$t('tasks.description')"
          :rows="4"
          :error="errors.description"
        />

        <div class="grid gap-5 sm:grid-cols-3">
          <UiSelect
            v-model="form.priority"
            :label="$t('tasks.priority')"
            :options="priorityOptions"
            :error="errors.priority"
          />
          <UiInput v-model="form.dueDate" :label="$t('tasks.dueDate')" type="date" :error="errors.dueDate" />
          <UiInput
            v-model="form.estimateHours"
            :label="$t('tasks.estimate')"
            type="number"
            :error="errors.estimateHours"
            hint="In hours — 1.5 for 90 minutes."
          />
        </div>

        <div class="flex items-center gap-3">
          <UiButton type="submit" :loading="saving">{{ $t('form.create') }}</UiButton>
          <UiButton variant="subtle" to="/tasks">{{ $t('form.cancel') }}</UiButton>
        </div>
      </form>
    </UiCard>
  </section>
</template>
