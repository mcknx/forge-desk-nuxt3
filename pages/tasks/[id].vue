<script setup lang="ts">
import { useI18n } from 'vue-i18n'
// The one definition of what an hour of this client's time is worth. logic.ts is
// pure and imports nothing but types, so reusing it beats a second copy of the
// rounding rule drifting a cent away from the invoice.
import { minutesToMinor } from '~~/server/utils/logic'
import type { Client, Page, Task, TaskPriority, TaskStatus, TimeEntry } from '~~/types/domain'

definePageMeta({ middleware: 'auth' })

const id = useRoute().params.id as string
const { t } = useI18n()
const { isOwner } = useAuth()
const { push } = useToast()

// useRequestFetch, not plain $fetch: during SSR the session cookie rides on the
// incoming request and only this wrapper forwards it to our own API.
const request = useRequestFetch()

const { data, error } = await useAsyncData(`task:${id}`, async () => {
  const task = await request<Task>(`/api/tasks/${id}`)
  const [client, time] = await Promise.all([
    request<Client>(`/api/clients/${task.clientId}`),
    request<Page<TimeEntry>>('/api/time', { query: { taskId: id, perPage: 100 } }),
  ])
  return { task, client, entries: time.items }
})

if (error.value || !data.value) {
  throw createError({
    statusCode: (error.value as { statusCode?: number } | null)?.statusCode ?? 404,
    statusMessage: 'Task not found',
    fatal: true,
  })
}

const task = computed(() => data.value!.task)
const client = computed(() => data.value!.client)

// Held locally so a successful log updates the totals in place instead of
// re-running the whole page fetch.
const entries = ref<TimeEntry[]>([...data.value.entries])

const totalMinutes = computed(() => entries.value.reduce((sum, entry) => sum + entry.minutes, 0))
const billableMinutes = computed(() =>
  entries.value.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.minutes, 0),
)
const billableValue = computed(() => minutesToMinor(billableMinutes.value, client.value.hourlyRateMinor))

const statusOptions = computed(() =>
  (['todo', 'in_progress', 'blocked', 'done'] as TaskStatus[]).map((s) => ({ value: s, label: t(`status.${s}`) })),
)
const priorityOptions = computed(() =>
  (['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => ({ value: p, label: t(`priority.${p}`) })),
)

async function patchTask(patch: Partial<Pick<Task, 'status' | 'priority'>>) {
  const previous = { status: task.value.status, priority: task.value.priority }
  Object.assign(task.value, patch)
  try {
    await $fetch(`/api/tasks/${id}`, { method: 'PUT', body: patch })
  } catch (cause) {
    Object.assign(task.value, previous)
    push((cause as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Could not update the task', 'error')
  }
}

const log = reactive({
  minutes: '60',
  workedOn: new Date().toISOString().slice(0, 10),
  note: '',
  billable: true,
})
const logErrors = reactive<Record<string, string>>({})
const logging = ref(false)

async function logTime() {
  for (const key of Object.keys(logErrors)) delete logErrors[key]
  const minutes = Number(log.minutes)
  if (!Number.isInteger(minutes) || minutes < 1) logErrors.minutes = 'Log at least one whole minute'
  if (!log.workedOn) logErrors.workedOn = 'Pick the day the work happened'
  if (Object.keys(logErrors).length) return

  logging.value = true
  try {
    const entry = await $fetch<TimeEntry>('/api/time', {
      method: 'POST',
      body: { taskId: id, minutes, workedOn: log.workedOn, note: log.note.trim(), billable: log.billable },
    })
    entries.value = [entry, ...entries.value]
    log.note = ''
    push(`${hours(entry.minutes)} logged`, 'ok')
  } catch (cause) {
    const err = cause as { data?: any }
    const fields: Record<string, string> | undefined = err?.data?.data?.fields ?? err?.data?.fields
    if (fields && Object.keys(fields).length) {
      for (const [field, message] of Object.entries(fields)) logErrors[field] = message
    } else {
      push(err?.data?.statusMessage ?? 'Could not log that time', 'error')
    }
  } finally {
    logging.value = false
  }
}

useSeoMeta({
  title: () => data.value?.task.title ?? 'Task',
  description: () => `Status, logged time and estimate for ${data.value?.task.title ?? 'this task'}.`,
})
</script>

<template>
  <section v-if="data">
    <nav class="text-sm text-slate-500 dark:text-slate-400">
      <NuxtLink to="/tasks" class="hover:text-slate-900 dark:hover:text-slate-100">{{ $t('tasks.title') }}</NuxtLink>
      <span aria-hidden="true"> / </span>
      <NuxtLink :to="`/clients/${client.id}`" class="hover:text-slate-900 dark:hover:text-slate-100">{{ client.name }}</NuxtLink>
    </nav>

    <header class="mt-2 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ task.title }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Due {{ shortDate(task.dueDate) }} · created {{ relativeDate(task.createdAt) }}
          <template v-if="task.estimateMinutes"> · estimated {{ hours(task.estimateMinutes) }}</template>
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-40">
          <UiSelect
            :model-value="task.status"
            :label="$t('tasks.status')"
            :options="statusOptions"
            :disabled="!isOwner"
            @update:model-value="(value) => value && patchTask({ status: value as TaskStatus })"
          />
        </div>
        <div class="w-40">
          <UiSelect
            :model-value="task.priority"
            :label="$t('tasks.priority')"
            :options="priorityOptions"
            :disabled="!isOwner"
            @update:model-value="(value) => value && patchTask({ priority: value as TaskPriority })"
          />
        </div>
      </div>
    </header>

    <p v-if="task.description" class="mt-6 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
      {{ task.description }}
    </p>

    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <StatTile
        :label="$t('dashboard.hoursLogged')"
        :value="hours(totalMinutes)"
        :hint="`${entries.length} entries`"
        tone="blue"
      />
      <StatTile
        :label="$t('time.billable')"
        :value="hours(billableMinutes)"
        :hint="money(billableValue, client.currency)"
        tone="green"
      />
      <StatTile
        :label="$t('tasks.againstEstimate')"
        :value="task.estimateMinutes ? `${Math.round((totalMinutes / task.estimateMinutes) * 100)}%` : '—'"
        :hint="task.estimateMinutes ? `of ${hours(task.estimateMinutes)}` : 'no estimate set'"
        :tone="task.estimateMinutes && totalMinutes > task.estimateMinutes ? 'red' : 'gray'"
      />
    </div>

    <div class="mt-8 grid gap-8 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <h2 class="mb-3 text-lg font-medium">{{ $t('time.entries') }}</h2>
        <UiEmptyState v-if="!entries.length" :title="$t('time.empty')" :description="$t('time.emptyHint')" />
        <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-3">{{ $t('time.date') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('time.note') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('time.title') }}</th>
                <th scope="col" class="px-4 py-3">{{ $t('time.billing') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr v-for="entry in entries" :key="entry.id">
                <td class="whitespace-nowrap px-4 py-3">{{ shortDate(entry.workedOn) }}</td>
                <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ entry.note || '—' }}</td>
                <td class="whitespace-nowrap px-4 py-3">{{ hours(entry.minutes) }}</td>
                <td class="px-4 py-3">
                  <UiBadge v-if="!entry.billable" tone="gray">{{ $t('time.nonBillable') }}</UiBadge>
                  <UiBadge v-else-if="entry.invoiceId" tone="green">{{ $t('time.billed') }}</UiBadge>
                  <UiBadge v-else tone="amber">{{ $t('dashboard.unbilled') }}</UiBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="isOwner">
        <h2 class="mb-3 text-lg font-medium">{{ $t('time.log') }}</h2>
        <UiCard>
          <form novalidate class="space-y-4" @submit.prevent="logTime">
            <UiInput
              v-model="log.minutes"
              :label="$t('time.minutes')"
              type="number"
              required
              :error="logErrors.minutes"
              hint="90 for an hour and a half."
            />
            <UiInput
              v-model="log.workedOn"
              :label="$t('time.workedOn')"
              type="date"
              required
              :error="logErrors.workedOn"
            />
            <UiInput
              v-model="log.note"
              :label="$t('time.note')"
              :error="logErrors.note"
              placeholder="What moved forward"
            />
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                v-model="log.billable"
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-accent-600 dark:border-slate-600 dark:bg-slate-900"
              />
              {{ $t('time.billable') }}
            </label>
            <UiButton type="submit" :loading="logging">{{ $t('time.log') }}</UiButton>
          </form>
        </UiCard>
      </div>
    </div>
  </section>
</template>
