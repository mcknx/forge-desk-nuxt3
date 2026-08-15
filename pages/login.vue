<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const DEMO_EMAIL = 'demo@forgedesk.dev'
const DEMO_PASSWORD = 'forge-desk-demo'
const VIEWER_EMAIL = 'viewer@forgedesk.dev'

const route = useRoute()
const { t } = useI18n()
const { login } = useAuth()
const { push } = useToast()

// Prefilled on purpose: this is a public demo and making people copy-paste
// credentials off the marketing page is friction with no security value.
const email = ref(DEMO_EMAIL)
const password = ref(DEMO_PASSWORD)
const pending = ref(false)
const formError = ref('')
const fields = ref<Record<string, string>>({})

/**
 * Only same-origin paths are honoured. `?redirect=https://evil.example` on a
 * login page is the classic open-redirect phishing setup, and `//host` is the
 * protocol-relative version of the same trick.
 */
const target = computed(() => {
  const raw = route.query.redirect
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
})

function fillAccount(address: string) {
  email.value = address
  password.value = DEMO_PASSWORD
  formError.value = ''
  fields.value = {}
}

async function submit() {
  if (pending.value) return
  pending.value = true
  formError.value = ''
  fields.value = {}

  try {
    await login(email.value, password.value)
    push('Signed in.', 'ok')
    await navigateTo(target.value)
  } catch (error: any) {
    // Nitro puts the zod field map at data.data.fields on a 422; 401 and 429
    // carry only a statusMessage, and 429's already names the retry window.
    const body = error?.data
    const status = error?.statusCode ?? body?.statusCode
    const map = body?.data?.fields
    if (status === 422 && map && typeof map === 'object') {
      fields.value = map
      formError.value = 'Check the highlighted fields.'
    } else {
      formError.value = body?.statusMessage || error?.statusMessage || 'Could not sign in. Try again.'
    }
  } finally {
    pending.value = false
  }
}

useSeoMeta({
  title: () => t('nav.signIn'),
  description: 'Sign in to the Forge Desk demo. The credentials are public.',
  robots: 'noindex',
})
</script>

<template>
  <div class="mx-auto max-w-md py-6 sm:py-12">
    <h1 class="text-3xl font-semibold tracking-tight">{{ $t('nav.signIn') }}</h1>
    <p class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
      The demo account is filled in below. These credentials are public on purpose — this desk holds seed data, not
      anybody's business.
    </p>

    <UiCard class="mt-8">
      <form novalidate @submit.prevent="submit">
        <div
          v-if="formError"
          role="alert"
          aria-live="assertive"
          class="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        >
          {{ formError }}
        </div>

        <div class="space-y-5">
          <UiInput
            v-model="email"
            :label="$t('clients.email')"
            type="email"
            name="email"
            autocomplete="username"
            :error="fields.email"
            :required="true"
          />
          <UiInput
            v-model="password"
            :label="$t('form.password')"
            type="password"
            name="password"
            autocomplete="current-password"
            :error="fields.password"
            :required="true"
          />
        </div>

        <div class="mt-7">
          <UiButton type="submit" variant="primary" :loading="pending" :disabled="pending">
            {{ pending ? $t('form.signingIn') : $t('nav.signIn') }}
          </UiButton>
        </div>
      </form>

      <template #footer>
        <div class="space-y-3 text-sm">
          <p class="font-medium text-slate-900 dark:text-slate-100">Two accounts, same password</p>
          <ul class="space-y-2 text-slate-600 dark:text-slate-400">
            <li class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                class="rounded font-mono text-indigo-600 underline underline-offset-2 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-indigo-400"
                @click="fillAccount(DEMO_EMAIL)"
              >
                {{ DEMO_EMAIL }}
              </button>
              <span>owner — can create, edit, invoice and reset the demo.</span>
            </li>
            <li class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                class="rounded font-mono text-indigo-600 underline underline-offset-2 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-indigo-400"
                @click="fillAccount(VIEWER_EMAIL)"
              >
                {{ VIEWER_EMAIL }}
              </button>
              <span>read-only — every write comes back as a 403 from the server, not just a hidden button.</span>
            </li>
          </ul>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Password for both: <code class="font-mono">{{ DEMO_PASSWORD }}</code>. Login is rate limited to 8
            attempts a minute per IP.
          </p>
        </div>
      </template>
    </UiCard>
  </div>
</template>
