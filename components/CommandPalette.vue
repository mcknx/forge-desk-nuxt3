<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Client, Page } from '~~/types/domain'

interface Item {
  id: string
  label: string
  hint: string
  to: string
}

const { t } = useI18n()

// Computed, not a module constant: the labels are what the palette searches, so
// they have to be in the language the user is reading right now.
const routes = computed<Item[]>(() => [
  { id: 'r-dashboard', label: t('nav.dashboard'), hint: t('palette.overview'), to: '/dashboard' },
  { id: 'r-clients', label: t('nav.clients'), hint: t('palette.allClients'), to: '/clients' },
  { id: 'r-client-new', label: t('clients.new'), hint: t('palette.create'), to: '/clients/new' },
  { id: 'r-tasks', label: t('nav.tasks'), hint: t('palette.allTasks'), to: '/tasks' },
  { id: 'r-task-new', label: t('tasks.new'), hint: t('palette.create'), to: '/tasks/new' },
  { id: 'r-time', label: t('nav.time'), hint: t('palette.timesheet'), to: '/time' },
  { id: 'r-invoices', label: t('nav.invoices'), hint: t('palette.billing'), to: '/invoices' },
])

const open = ref(false)
const query = ref('')
const active = ref(0)
const remote = ref<Item[]>([])
const input = ref<HTMLInputElement | null>(null)
const listId = useId()

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matched = q ? routes.value.filter((r) => r.label.toLowerCase().includes(q)) : routes.value
  return [...matched, ...remote.value].slice(0, 8)
})

// Debounced: every keystroke firing a search is how a demo API looks slow.
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  active.value = 0
  clearTimeout(timer)
  const q = value.trim()
  if (!q) {
    remote.value = []
    return
  }
  timer = setTimeout(async () => {
    const page = await $fetch<Page<Client>>('/api/clients', { query: { q, perPage: 5 } }).catch(() => null)
    remote.value =
      page?.items.map((c) => ({
        id: `c-${c.id}`,
        label: c.name,
        hint: c.company || t('palette.client'),
        to: `/clients/${c.id}`,
      })) ?? []
  }, 200)
})

async function show() {
  open.value = true
  query.value = ''
  active.value = 0
  await nextTick()
  input.value?.focus()
}

function move(step: number) {
  const count = results.value.length
  if (!count) return
  active.value = (active.value + step + count) % count
}

async function choose(item?: Item) {
  const target = item ?? results.value[active.value]
  if (!target) return
  open.value = false
  await navigateTo(target.to)
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (open.value) open.value = false
    else show()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" data-print-hide>
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="open = false" />
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="$t('palette.label')"
        class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
          <svg class="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" stroke-linecap="round" />
          </svg>
          <input
            ref="input"
            v-model="query"
            type="text"
            role="combobox"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="results[active] ? `${listId}-${results[active]!.id}` : undefined"
            :aria-label="$t('palette.searchLabel')"
            :placeholder="$t('palette.placeholder')"
            autocomplete="off"
            class="w-full bg-transparent py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="choose()"
            @keydown.esc.prevent="open = false"
          />
        </div>

        <ul :id="listId" role="listbox" :aria-label="$t('palette.results')" class="max-h-72 overflow-y-auto p-2">
          <li
            v-for="(item, index) in results"
            :id="`${listId}-${item.id}`"
            :key="item.id"
            role="option"
            :aria-selected="index === active"
            class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm"
            :class="index === active ? 'bg-accent-50 text-accent-900 dark:bg-accent-500/15 dark:text-accent-100' : 'text-slate-700 dark:text-slate-300'"
            @mousemove="active = index"
            @click="choose(item)"
          >
            <span class="min-w-0 flex-1 truncate font-medium">{{ item.label }}</span>
            <span class="shrink-0 text-xs text-slate-400">{{ item.hint }}</span>
          </li>
          <li v-if="!results.length" class="px-3 py-6 text-center text-sm text-slate-500">
            {{ $t('palette.noMatch', { query }) }}
          </li>
        </ul>

        <p class="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
          {{ $t('palette.keys') }}
        </p>
      </div>
    </div>
  </Teleport>
</template>
