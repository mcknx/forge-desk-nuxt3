<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Client, Page, Task, TaskStatus } from '~~/types/domain'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()

const { filters, setFilter, reset } = useListQuery({
  q: '',
  clientId: '',
  status: 'all',
  priority: 'all',
  overdue: 'false',
  sort: 'dueDate',
  dir: 'asc',
  page: 1,
})

const query = computed<Record<string, any>>(() => ({ ...toValue(filters) }))

const { data, pending, error } = await useFetch<Page<Task>>('/api/tasks', { query })
const { data: clients } = await useFetch<Page<Client>>('/api/clients', {
  query: { status: 'all', perPage: 100, sort: 'name' },
})

const clientNames = computed(() => new Map((clients.value?.items ?? []).map((c) => [c.id, c.name])))

const search = ref(String(query.value.q ?? ''))
let debounce: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => setFilter('q', value), 300)
})

watch(
  () => query.value.q,
  (value) => {
    if (String(value ?? '') !== search.value) search.value = String(value ?? '')
  },
)

// Duplicated from schema.ts on purpose: importing a server util would drag zod
// into the client bundle for four strings.
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

const rowStatusOptions = computed(() => STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })))
const statusOptions = computed(() => [{ value: 'all', label: t('form.allStatuses') }, ...rowStatusOptions.value])
const priorityOptions = computed(() => [
  { value: 'all', label: t('form.allPriorities') },
  ...PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) })),
])
const clientOptions = computed(() => [
  { value: '', label: t('form.allClients') },
  ...(clients.value?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
])

const isFiltered = computed(
  () =>
    !!query.value.q ||
    !!query.value.clientId ||
    query.value.status !== 'all' ||
    query.value.priority !== 'all' ||
    query.value.overdue === 'true',
)

const today = new Date().toISOString().slice(0, 10)
const weekEnd = (() => {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 7)
  return date.toISOString().slice(0, 10)
})()

// Bucket ids, not labels — the heading text comes from the locale files.
const BUCKETS = ['overdue', 'thisWeek', 'later', 'noDate'] as const
type Bucket = (typeof BUCKETS)[number]

const BUCKET_KEYS: Record<Bucket, string> = {
  overdue: 'tasks.overdue',
  thisWeek: 'tasks.bucketThisWeek',
  later: 'tasks.bucketLater',
  noDate: 'tasks.bucketNoDate',
}

// The buckets answer "how urgent is this", so a finished task leaves the urgent
// groups whatever its due date says.
function bucketOf(task: Task): Bucket {
  if (task.status === 'done') return 'later'
  if (!task.dueDate) return 'noDate'
  if (task.dueDate < today) return 'overdue'
  return task.dueDate <= weekEnd ? 'thisWeek' : 'later'
}

const groups = computed(() =>
  BUCKETS.map((bucket) => ({
    bucket,
    label: t(BUCKET_KEYS[bucket]),
    tasks: (data.value?.items ?? []).filter((task) => bucketOf(task) === bucket),
  })).filter((group) => group.tasks.length > 0),
)

const desk = useDeskStore()
const { push } = useToast()

async function changeStatus(task: Task, next: string | undefined) {
  if (!next || next === task.status) return
  const previous = task.status
  task.status = next as TaskStatus
  try {
    await desk.setTaskStatus(task.id, next as TaskStatus)
  } catch {
    task.status = previous
    push('Could not update that task', 'error')
  }
}

useSeoMeta({
  title: () => t('tasks.title'),
  description: 'Every open task across the desk, grouped by how soon it is due.',
})
</script>

<template>
  <section>
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ $t('tasks.title') }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <template v-if="data">{{ data.total }} {{ $t('common.results') }}</template>
          <template v-else>{{ $t('common.loading') }}</template>
        </p>
      </div>
      <UiButton to="/tasks/new">{{ $t('tasks.new') }}</UiButton>
    </header>

    <UiCard class="mb-6">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[12rem] flex-1">
          <UiInput
            v-model="search"
            :label="$t('nav.search')"
            type="search"
            :placeholder="$t('tasks.searchPlaceholder')"
          />
        </div>
        <div class="w-44">
          <UiSelect
            :model-value="String(query.clientId ?? '')"
            :label="$t('tasks.client')"
            :options="clientOptions"
            @update:model-value="(value) => setFilter('clientId', value)"
          />
        </div>
        <div class="w-40">
          <UiSelect
            :model-value="String(query.status)"
            :label="$t('tasks.status')"
            :options="statusOptions"
            @update:model-value="(value) => setFilter('status', value)"
          />
        </div>
        <div class="w-40">
          <UiSelect
            :model-value="String(query.priority)"
            :label="$t('tasks.priority')"
            :options="priorityOptions"
            @update:model-value="(value) => setFilter('priority', value)"
          />
        </div>
        <label class="flex h-10 items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-accent-600 dark:border-slate-600 dark:bg-slate-900"
            :checked="query.overdue === 'true'"
            @change="setFilter('overdue', ($event.target as HTMLInputElement).checked ? 'true' : 'false')"
          />
          {{ $t('tasks.overdueOnly') }}
        </label>
        <UiButton v-if="isFiltered" variant="ghost" @click="reset">{{ $t('form.clear') }}</UiButton>
      </div>
    </UiCard>

    <UiSkeleton v-if="pending" :rows="8" />

    <p
      v-else-if="error"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      {{ $t('errors.loadFailed') }}
    </p>

    <UiEmptyState
      v-else-if="!data || data.total === 0"
      :title="isFiltered ? $t('tasks.emptyFiltered') : $t('tasks.empty')"
      :description="isFiltered ? $t('tasks.emptyFilteredHint') : $t('tasks.emptyHint')"
      :action-label="isFiltered ? $t('form.clearFilters') : $t('tasks.new')"
      :action-to="isFiltered ? '/tasks' : '/tasks/new'"
    />

    <template v-else-if="data">
      <div v-for="group in groups" :key="group.bucket" class="mb-8">
        <h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ group.label }}
          <span class="text-xs font-normal normal-case">{{ group.tasks.length }}</span>
        </h2>
        <ul class="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <li v-for="task in group.tasks" :key="task.id" class="flex flex-wrap items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/tasks/${task.id}`" class="font-medium text-accent-600 hover:underline dark:text-accent-400">
                {{ task.title }}
              </NuxtLink>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                <NuxtLink :to="`/clients/${task.clientId}`" class="hover:text-slate-900 dark:hover:text-slate-100">
                  {{ clientNames.get(task.clientId) ?? 'Unknown client' }}
                </NuxtLink>
                · due {{ shortDate(task.dueDate) }}
                <template v-if="task.estimateMinutes"> · est {{ hours(task.estimateMinutes) }}</template>
              </p>
            </div>
            <PriorityBadge :priority="task.priority" />
            <div class="w-40">
              <UiSelect
                :model-value="task.status"
                :options="rowStatusOptions"
                @update:model-value="(value) => changeStatus(task, value)"
              />
            </div>
          </li>
        </ul>
      </div>

      <UiPagination
        :page="data.page"
        :pages="data.pages"
        :total="data.total"
        :per-page="data.perPage"
        @update:page="(value: number) => setFilter('page', value)"
      />
    </template>
  </section>
</template>
