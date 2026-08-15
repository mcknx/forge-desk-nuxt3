<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
    size?: 'sm' | 'md'
    to?: string
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', size: 'md', to: undefined, type: 'button', loading: false, disabled: false },
)

const variants: Record<string, string> = {
  primary: 'border-transparent bg-accent-600 text-white hover:bg-accent-700',
  ghost: 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'border-transparent bg-red-600 text-white hover:bg-red-700',
  subtle:
    'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
}

const sizes: Record<string, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
}

// Loading counts as disabled: a second submit while the first is in flight is
// the double-charge bug in every invoice app.
const isInert = computed(() => props.disabled || props.loading)

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-xl border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  variants[props.variant],
  sizes[props.size],
])
</script>

<template>
  <NuxtLink v-if="to && !isInert" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="isInert" :aria-busy="loading || undefined" :class="classes">
    <svg v-if="loading" class="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <slot />
  </button>
</template>
