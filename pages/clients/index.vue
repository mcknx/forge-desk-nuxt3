<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Client, Page } from '~~/types/domain'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()

const { filters, setFilter, reset } = useListQuery({
  q: '',
  status: 'all',
  sort: 'name',
  dir: 'asc',
  page: 1,
})

// Snapshot copy so this works whether useListQuery hands back a ref or a
// reactive object, and so useFetch re-runs when any single key changes.
const query = computed<Record<string, any>>(() => ({ ...toValue(filters) }))

const { data, pending, error } = await useFetch<Page<Client>>('/api/clients', { query })

const view = useCookie<'table' | 'cards'>('fd-clients-view', {
  default: () => 'table',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})

const search = ref(String(query.value.q ?? ''))
let debounce: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => setFilter('q', value), 300)
})

// Back/forward and the empty state's "clear filters" link move the URL, not the box.
watch(
  () => query.value.q,
  (value) => {
    if (String(value ?? '') !== search.value) search.value = String(value ?? '')
  },
)

const statusOptions = computed(() => [
  { value: 'all', label: t('form.allStatuses') },
  { value: 'active', label: t('status.active') },
  { value: 'paused', label: t('status.paused') },
  { value: 'archived', label: t('status.archived') },
])

const isFiltered = computed(() => !!query.value.q || query.value.status !== 'all')

function sortBy(key: 'name' | 'createdAt' | 'updatedAt') {
  // paginate() clamps an out-of-range page server-side, so a stale page= in the
  // URL self-corrects instead of showing an empty list.
  if (query.value.sort === key) setFilter('dir', query.value.dir === 'asc' ? 'desc' : 'asc')
  else setFilter('sort', key)
}

function ariaSort(key: string) {
  if (query.value.sort !== key) return 'none'
  return query.value.dir === 'desc' ? 'descending' : 'ascending'
}

function marker(key: string) {
  if (query.value.sort !== key) return ''
  return query.value.dir === 'desc' ? ' ↓' : ' ↑'
}

useSeoMeta({
  title: () => t('clients.title'),
  description: 'Every client on the desk with status, billing rate and last activity.',
})
</script>

<template>
  <section>
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ $t('clients.title') }}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          <template v-if="data">{{ data.total }} {{ $t('common.results') }}</template>
          <template v-else>{{ $t('common.loading') }}</template>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-xl border border-slate-300 p-0.5 dark:border-slate-700" role="group" aria-label="Layout">
          <UiButton size="sm" :variant="view === 'table' ? 'subtle' : 'ghost'" @click="view = 'table'">
            {{ $t('common.table') }}
          </UiButton>
          <UiButton size="sm" :variant="view === 'cards' ? 'subtle' : 'ghost'" @click="view = 'cards'">
            {{ $t('common.cards') }}
          </UiButton>
        </div>
        <UiButton to="/clients/new">{{ $t('clients.new') }}</UiButton>
      </div>
    </header>

    <UiCard class="mb-6">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-[14rem] flex-1">
          <UiInput
            v-model="search"
            :label="$t('nav.search')"
            type="search"
            :placeholder="$t('clients.searchPlaceholder')"
          />
        </div>
        <div class="w-44">
          <UiSelect
            :model-value="String(query.status)"
            :label="$t('clients.status')"
            :options="statusOptions"
            @update:model-value="(value) => setFilter('status', value)"
          />
        </div>
        <UiButton v-if="isFiltered" variant="ghost" @click="reset">{{ $t('form.clear') }}</UiButton>
      </div>
    </UiCard>

    <UiSkeleton v-if="pending" :rows="6" />

    <p v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {{ $t('errors.loadFailed') }}
    </p>

    <UiEmptyState
      v-else-if="!data || data.total === 0"
      :title="isFiltered ? $t('clients.emptyFiltered') : $t('clients.empty')"
      :description="isFiltered ? $t('clients.emptyFilteredHint') : $t('clients.emptyHint')"
      :action-label="isFiltered ? $t('form.clearFilters') : $t('clients.new')"
      :action-to="isFiltered ? '/clients' : '/clients/new'"
    />

    <template v-else-if="data">
      <div v-if="view === 'table'" class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" class="px-4 py-3" :aria-sort="ariaSort('name')">
                <button type="button" class="rounded font-semibold hover:text-slate-900 dark:hover:text-slate-100" @click="sortBy('name')">
                  {{ $t('clients.name') }}{{ marker('name') }}
                </button>
              </th>
              <th scope="col" class="px-4 py-3">{{ $t('clients.company') }}</th>
              <th scope="col" class="px-4 py-3">{{ $t('clients.status') }}</th>
              <th scope="col" class="px-4 py-3">{{ $t('clients.hourlyRate') }}</th>
              <th scope="col" class="px-4 py-3" :aria-sort="ariaSort('updatedAt')">
                <button type="button" class="rounded font-semibold hover:text-slate-900 dark:hover:text-slate-100" @click="sortBy('updatedAt')">
                  {{ $t('clients.updated') }}{{ marker('updatedAt') }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            <tr v-for="client in data.items" :key="client.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
              <td class="px-4 py-3">
                <NuxtLink :to="`/clients/${client.id}`" class="font-medium text-accent-600 hover:underline dark:text-accent-400">
                  {{ client.name }}
                </NuxtLink>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ client.email }}</p>
              </td>
              <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ client.company || '—' }}</td>
              <td class="px-4 py-3"><StatusBadge :status="client.status" /></td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                {{ money(client.hourlyRateMinor, client.currency) }}/h
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">{{ relativeDate(client.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ClientCard v-for="client in data.items" :key="client.id" :client="client" />
      </div>

      <UiPagination
        class="mt-6"
        :page="data.page"
        :pages="data.pages"
        :total="data.total"
        :per-page="data.perPage"
        @update:page="(value: number) => setFilter('page', value)"
      />
    </template>
  </section>
</template>
