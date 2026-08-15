<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Activity, Client, DashboardStats, Page, Task } from '~~/types/domain'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const { isOwner } = useAuth()
const { push } = useToast()

// Explicit generics rather than Nitro's inferred route types: this page has to
// type-check even while the API handlers are still being written.
const { data: stats, status: statsStatus, refresh: refreshStats } = await useFetch<DashboardStats>('/api/stats')
const { data: activity, refresh: refreshActivity } = await useFetch<Activity[]>('/api/activity', {
  query: { limit: 8 },
})
const { data: taskPage, refresh: refreshTasks } = await useFetch<Page<Task>>('/api/tasks', {
  query: { sort: 'dueDate', dir: 'asc', perPage: 40 },
})
const { data: clientPage } = await useFetch<Page<Client>>('/api/clients', {
  query: { status: 'all', perPage: 100 },
})

const clientNames = computed(() => new Map((clientPage.value?.items ?? []).map((c) => [c.id, c.name])))

/**
 * "Today" comes off the last bucket of the server's 14-day series rather than
 * the browser clock — otherwise a client in a different timezone disagrees with
 * SSR about the date and the list hydrates differently than it rendered.
 */
const week = computed(() => {
  const start = stats.value?.time.daily.at(-1)?.date
  if (!start) return null
  const end = new Date(`${start}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start, end: end.toISOString().slice(0, 10) }
})

const dueThisWeek = computed(() => {
  const range = week.value
  if (!range) return []
  return (taskPage.value?.items ?? [])
    .filter((t) => t.status !== 'done' && t.dueDate && t.dueDate >= range.start && t.dueDate <= range.end)
    .slice(0, 6)
})

const taskSegments = computed(() => {
  const counts = stats.value?.tasks
  if (!counts) return []
  return [
    { label: t('status.todo'), value: counts.todo, tone: 'gray' as const },
    { label: t('status.in_progress'), value: counts.inProgress, tone: 'blue' as const },
    { label: t('status.blocked'), value: counts.blocked, tone: 'red' as const },
    { label: t('status.done'), value: counts.done, tone: 'green' as const },
  ]
})

const openTasks = computed(() => {
  const counts = stats.value?.tasks
  return counts ? counts.total - counts.done : 0
})

const resetting = ref(false)

async function resetDemo() {
  if (!confirm('Reset the demo data? Every client, task, time entry and invoice goes back to the seed snapshot.')) {
    return
  }
  resetting.value = true
  try {
    await $fetch('/api/demo/reset', { method: 'POST' })
    await Promise.all([refreshStats(), refreshActivity(), refreshTasks()])
    push('Demo data restored to the seed snapshot.', 'ok')
  } catch (error: any) {
    push(error?.data?.statusMessage || error?.statusMessage || 'Reset failed.', 'error')
  } finally {
    resetting.value = false
  }
}

async function toggleTask(task: Task) {
  const next = task.status === 'done' ? 'todo' : 'done'
  try {
    await $fetch(`/api/tasks/${task.id}`, { method: 'PUT', body: { status: next } })
    await Promise.all([refreshStats(), refreshTasks(), refreshActivity()])
    push(next === 'done' ? `Closed “${task.title}”.` : `Reopened “${task.title}”.`, 'ok')
  } catch (error: any) {
    push(error?.data?.statusMessage || error?.statusMessage || 'Could not update that task.', 'error')
  }
}

useSeoMeta({ title: () => t('dashboard.title'), robots: 'noindex' })
</script>

<template>
  <div class="space-y-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">{{ $t('dashboard.title') }}</h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ $t('dashboard.subtitle') }}</p>
      </div>
      <UiButton v-if="isOwner" variant="danger" size="sm" :loading="resetting" :disabled="resetting" @click="resetDemo">
        {{ $t('common.demoReset') }}
      </UiButton>
    </div>

    <UiSkeleton v-if="statsStatus === 'pending' && !stats" :rows="4" />

    <template v-else-if="stats">
      <section aria-label="Key figures" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          :label="$t('dashboard.activeClients')"
          :value="stats.clients.active"
          :hint="`${stats.clients.total} on the books`"
          tone="blue"
        />
        <StatTile
          :label="$t('dashboard.openTasks')"
          :value="openTasks"
          :hint="`${stats.tasks.done} closed`"
          tone="gray"
        />
        <StatTile
          :label="$t('dashboard.overdue')"
          :value="stats.tasks.overdue"
          :hint="`${stats.tasks.dueThisWeek} due in the next 7 days`"
          :tone="stats.tasks.overdue > 0 ? 'red' : 'green'"
        />
        <StatTile
          :label="$t('dashboard.unbilledWork')"
          :value="money(stats.revenue.unbilledMinor, stats.revenue.currency)"
          hint="Billable time not yet on an invoice"
          tone="amber"
        />
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <UiCard class="lg:col-span-2">
          <template #header>
            <h2 class="text-lg font-semibold">{{ $t('dashboard.timeLast14Days') }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ hours(stats.time.totalMinutes) }} total · {{ hours(stats.time.billableMinutes) }} billable
            </p>
          </template>
          <SparkBars :data="stats.time.daily" />
        </UiCard>

        <UiCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ $t('dashboard.tasksByStatus') }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ stats.tasks.total }} tracked</p>
          </template>
          <DonutChart :segments="taskSegments" />
        </UiCard>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <UiCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">{{ $t('dashboard.dueThisWeek') }}</h2>
              <NuxtLink
                to="/tasks"
                class="rounded text-sm font-medium text-indigo-600 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-indigo-400"
              >
                {{ $t('dashboard.allTasks') }}
              </NuxtLink>
            </div>
          </template>

          <UiEmptyState
            v-if="!dueThisWeek.length"
            :title="$t('dashboard.nothingDue')"
            :description="$t('dashboard.nothingDueHint')"
            :action-label="$t('dashboard.openTaskList')"
            action-to="/tasks"
          />
          <ul v-else class="divide-y divide-slate-200 dark:divide-slate-800">
            <li v-for="task in dueThisWeek" :key="task.id">
              <TaskRow :task="task" :client-name="clientNames.get(task.clientId)" @toggle="toggleTask(task)" />
            </li>
          </ul>
        </UiCard>

        <UiCard>
          <template #header>
            <h2 class="text-lg font-semibold">{{ $t('dashboard.recentActivity') }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Written server-side on every mutation.</p>
          </template>

          <UiEmptyState
            v-if="!activity?.length"
            :title="$t('dashboard.noActivity')"
            :description="$t('dashboard.activityEmptyHint')"
            :action-label="$t('dashboard.goToClients')"
            action-to="/clients"
          />
          <ul v-else class="space-y-4">
            <li v-for="item in activity" :key="item.id" class="flex gap-3">
              <span
                aria-hidden="true"
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
              >
                {{ initials(item.actorName) }}
              </span>
              <div class="min-w-0">
                <p class="text-sm text-slate-800 dark:text-slate-200">{{ item.summary }}</p>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span class="font-mono">{{ item.action }}</span> · {{ relativeDate(item.createdAt) }}
                </p>
              </div>
            </li>
          </ul>
        </UiCard>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400">
        Revenue figures are reported in {{ stats.revenue.currency }}. Clients bill in several currencies and this
        demo does not convert between them — it shows the majority currency and says so rather than adding numbers
        that do not add up.
      </p>
    </template>
  </div>
</template>
