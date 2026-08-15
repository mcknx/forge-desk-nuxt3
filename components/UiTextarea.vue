<script setup lang="ts">
// See UiInput: undeclared attributes belong on the control, not the wrapper.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label?: string
    error?: string
    hint?: string
    rows?: number
    required?: boolean
    placeholder?: string
    disabled?: boolean
  }>(),
  { label: '', error: '', hint: '', rows: 4, required: false, placeholder: '', disabled: false },
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
    <textarea
      v-bind="$attrs"
      :id="id"
      v-model="model"
      :rows="rows"
      :required="required"
      :disabled="disabled"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="field resize-y"
      :class="{ 'field-invalid': error }"
    />
    <p v-if="hint && !error" :id="hintId" class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="mt-1.5 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>
