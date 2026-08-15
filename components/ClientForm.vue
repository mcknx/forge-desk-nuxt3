<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { Client, ClientStatus } from '~~/types/domain'

const props = withDefaults(defineProps<{ client?: Client | null; submitLabel?: string }>(), {
  client: null,
  submitLabel: 'Save client',
})

const { push } = useToast()

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]

const currencyOptions = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'PHP', 'SGD'].map((c) => ({ value: c, label: c }))

const form = reactive({
  name: '',
  email: '',
  company: '',
  status: 'active' as ClientStatus,
  notes: '',
  // Money crosses the wire in minor units, but nobody types a rate in cents —
  // the form holds major units and converts on load and on submit.
  hourlyRate: '0.00',
  currency: 'USD',
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)
const dirty = ref(false)
let pristine = JSON.stringify(form)

watch(
  () => props.client,
  (client) => {
    if (!client) return
    form.name = client.name
    form.email = client.email
    form.company = client.company
    form.status = client.status
    form.notes = client.notes
    form.hourlyRate = (client.hourlyRateMinor / 100).toFixed(2)
    form.currency = client.currency
    pristine = JSON.stringify(form)
    dirty.value = false
  },
  { immediate: true },
)

watch(form, () => {
  dirty.value = JSON.stringify(form) !== pristine
})

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return confirm('You have unsaved changes. Leave without saving?')
})

function validate() {
  for (const key of Object.keys(errors)) delete errors[key]
  if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address'
  const rate = Number(form.hourlyRate)
  if (!Number.isFinite(rate) || rate < 0) errors.hourlyRate = 'Rate must be zero or more'
  return Object.keys(errors).length === 0
}

// The 422 body names fields as the API knows them; the rate input has a
// different name because it lives in major units.
const FIELD_ALIASES: Record<string, string> = { hourlyRateMinor: 'hourlyRate' }

function applyServerErrors(cause: unknown) {
  const error = cause as { statusCode?: number; data?: any }
  const fields: Record<string, string> | undefined = error?.data?.data?.fields ?? error?.data?.fields
  if (fields && Object.keys(fields).length) {
    for (const [field, message] of Object.entries(fields)) {
      errors[FIELD_ALIASES[field] ?? field] = message
    }
    push('Check the highlighted fields', 'error')
    return
  }
  push(error?.data?.statusMessage ?? 'Could not save this client', 'error')
}

async function submit() {
  if (!validate()) return
  saving.value = true
  const body = {
    name: form.name.trim(),
    email: form.email.trim(),
    company: form.company.trim(),
    status: form.status,
    notes: form.notes.trim(),
    hourlyRateMinor: Math.round(Number(form.hourlyRate) * 100),
    currency: form.currency,
  }
  try {
    const saved = props.client
      ? await $fetch<Client>(`/api/clients/${props.client.id}`, { method: 'PUT', body })
      : await $fetch<Client>('/api/clients', { method: 'POST', body })
    // Clear before navigating or the leave guard prompts on our own redirect.
    dirty.value = false
    push(props.client ? `${saved.name} saved` : `${saved.name} added`, 'ok')
    await navigateTo(`/clients/${saved.id}`)
  } catch (cause) {
    applyServerErrors(cause)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form novalidate class="space-y-5" @submit.prevent="submit">
    <div class="grid gap-5 sm:grid-cols-2">
      <UiInput v-model="form.name" label="Name" required :error="errors.name" placeholder="Ada Lovelace" />
      <UiInput v-model="form.email" label="Email" type="email" required :error="errors.email" placeholder="ada@example.com" />
      <UiInput v-model="form.company" label="Company" :error="errors.company" placeholder="Analytical Engines Ltd" />
      <UiSelect v-model="form.status" label="Status" :options="statusOptions" :error="errors.status" />
      <UiInput
        v-model="form.hourlyRate"
        label="Hourly rate"
        type="number"
        :error="errors.hourlyRate"
        hint="In whole currency units — 85.50, not 8550."
      />
      <UiSelect v-model="form.currency" label="Currency" :options="currencyOptions" :error="errors.currency" />
    </div>

    <UiTextarea v-model="form.notes" label="Notes" :rows="4" :error="errors.notes" />

    <div class="flex items-center gap-3">
      <UiButton type="submit" :loading="saving">{{ submitLabel }}</UiButton>
      <UiButton variant="subtle" :to="props.client ? `/clients/${props.client.id}` : '/clients'">Cancel</UiButton>
      <span v-if="dirty" class="text-xs text-slate-500 dark:text-slate-400">Unsaved changes</span>
    </div>
  </form>
</template>
