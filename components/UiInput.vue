<script setup lang="ts">
// Without this, everything the caller does not declare below — name,
// autocomplete, inputmode, maxlength — lands on the wrapper div, where the
// browser and password managers never look for it.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label?: string
    error?: string
    hint?: string
    type?: string
    required?: boolean
    placeholder?: string
    disabled?: boolean
  }>(),
  { label: '', error: '', hint: '', type: 'text', required: false, placeholder: '', disabled: false },
)

const model = defineModel<string | number>()

const id = useId()
const errorId = `${id}-error`
const hintId = `${id}-hint`

// Only point at ids that actually render, or the screen reader announces nothing.
const describedBy = computed(
  () => [props.error ? errorId : '', props.hint ? hintId : ''].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div>
    <label v-if="label" :for="id" class="field-label">
      {{ label }}
      <span v-if="required" class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
    </label>
    <input
      v-bind="$attrs"
      :id="id"
      v-model="model"
      :type="type"
      :required="required"
      :disabled="disabled"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="field"
      :class="{ 'field-invalid': error }"
    />
    <p v-if="hint && !error" :id="hintId" class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="mt-1.5 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>
