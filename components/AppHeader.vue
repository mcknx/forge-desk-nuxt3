<script setup lang="ts">
const { user, logout } = useAuth()
const { theme, toggle } = useTheme()
const { locale, locales, setLocale } = useLocale()
const route = useRoute()

// Labels are keys, translated in the template — a plain string here would keep
// the language chosen at first render after the locale switches.
const links = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/clients', key: 'nav.clients' },
  { to: '/tasks', key: 'nav.tasks' },
  { to: '/time', key: 'nav.time' },
  { to: '/invoices', key: 'nav.invoices' },
]

const menuOpen = ref(false)
const menuId = useId()

// Leaving the panel open across a navigation covers the page you just opened.
watch(() => route.fullPath, () => (menuOpen.value = false))

async function signOut() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <header
    data-print-hide
    class="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80"
  >
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
      <NuxtLink to="/" class="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-600 text-xs font-bold text-white" aria-hidden="true">FD</span>
        <span class="text-slate-900 dark:text-slate-100">Forge Desk</span>
      </NuxtLink>

      <nav aria-label="Main" class="hidden md:flex md:items-center md:gap-1">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          active-class="bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
          class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {{ $t(link.key) }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <label class="sr-only" :for="`${menuId}-locale`">{{ $t('nav.language') }}</label>
        <select
          :id="`${menuId}-locale`"
          :value="locale"
          class="hidden rounded-lg border border-slate-300 bg-transparent py-1.5 pl-2 pr-7 text-xs text-slate-600 sm:block dark:border-slate-700 dark:text-slate-300"
          @change="setLocale(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in locales" :key="option.code" :value="option.code">{{ option.label }}</option>
        </select>

        <button
          type="button"
          class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          :aria-label="$t('nav.toggleTheme')"
          @click="toggle"
        >
          <svg v-if="theme === 'dark'" class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="8" cy="8" r="3.25" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M12.8 3.2l-1 1M4.2 11.8l-1 1" stroke-linecap="round" />
          </svg>
          <svg v-else class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="hidden sm:block">
          <UiButton v-if="!user" to="/login" size="sm">{{ $t('nav.signIn') }}</UiButton>
          <UiButton v-else variant="subtle" size="sm" @click="signOut">{{ $t('nav.signOut') }}</UiButton>
        </div>

        <button
          type="button"
          class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          :aria-expanded="menuOpen"
          :aria-controls="menuId"
          :aria-label="$t('nav.menu')"
          @click="menuOpen = !menuOpen"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
            <path v-if="menuOpen" d="m5 5 10 10M15 5 5 15" stroke-linecap="round" />
            <path v-else d="M3 6h14M3 10h14M3 14h14" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="menuOpen" :id="menuId" class="border-t border-slate-200 md:hidden dark:border-slate-800">
      <nav aria-label="Mobile" class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          active-class="bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
          class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400"
        >
          {{ $t(link.key) }}
        </NuxtLink>

        <div class="mt-2 flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <select
            :value="locale"
            :aria-label="$t('nav.language')"
            class="rounded-lg border border-slate-300 bg-transparent py-1.5 pl-2 pr-7 text-xs text-slate-600 sm:hidden dark:border-slate-700 dark:text-slate-300"
            @change="setLocale(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="option in locales" :key="option.code" :value="option.code">{{ option.label }}</option>
          </select>
          <UiButton v-if="!user" to="/login" size="sm" class="sm:hidden">{{ $t('nav.signIn') }}</UiButton>
          <UiButton v-else variant="subtle" size="sm" class="sm:hidden" @click="signOut">{{ $t('nav.signOut') }}</UiButton>
          <span v-if="user" class="ml-auto text-xs text-slate-500">{{ user.name }}</span>
        </div>
      </nav>
    </div>
  </header>
</template>
