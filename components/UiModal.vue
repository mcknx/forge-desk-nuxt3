<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title?: string }>(), { title: '' })
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const id = useId()
let restoreTo: HTMLElement | null = null

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const items = focusables()
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement

  // Wrap at both ends, and pull focus back in if it escaped the panel entirely.
  if (event.shiftKey && (active === first || !panel.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function teardown() {
  document.removeEventListener('keydown', onKeydown)
  document.documentElement.classList.remove('overflow-hidden')
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      restoreTo = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown)
      document.documentElement.classList.add('overflow-hidden')
      await nextTick()
      ;(focusables()[0] ?? panel.value)?.focus()
    } else {
      teardown()
      restoreTo?.focus()
      restoreTo = null
    }
  },
)

onBeforeUnmount(teardown)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="emit('close')" />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? id : undefined"
        tabindex="-1"
        class="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 :id="id" class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ title }}</h2>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close dialog"
            @click="emit('close')"
          >
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="m4 4 8 8M12 4l-8 8" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <div class="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
          <slot />
        </div>
        <footer
          class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
