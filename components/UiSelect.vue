<script setup lang="ts">
// See UiInput: undeclared attributes belong on the control, not the wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label?: string
    options: { value: string; label: string }[]
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
  }>(),
  { label: '', error: '', hint: '', required: false, disabled: false },
)

const model = defineModel<string>()

const id = useId()
const errorId = `${id}-error`
const hintId = `${id}-hint`

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
    <select
      v-bind="$attrs"
      :id="id"
      v-model="model"
      :required="required"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="field pr-8"
      :class="{ 'field-invalid': error }"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <p v-if="hint && !error" :id="hintId" class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="mt-1.5 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>
