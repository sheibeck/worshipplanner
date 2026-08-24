<template>
  <div>
    <label :for="fieldId" class="text-xs text-gray-400 mb-1 flex items-center gap-1">
      {{ label }}
      <span v-if="isDefault" class="text-xs text-gray-500 italic">(default)</span>
    </label>
    <div class="flex flex-col sm:flex-row gap-2">
      <input
        :id="fieldId"
        v-model="inputValue"
        type="text"
        class="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <button
        type="button"
        @click="onSave"
        :disabled="isSaveDisabled"
        class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        {{ saving ? 'Saving...' : saved ? 'Saved!' : 'Save' }}
      </button>
    </div>
    <p v-if="ownError" class="text-red-400 text-sm mt-2">{{ ownError }}</p>
    <p v-else-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
    <p v-if="warning" class="text-yellow-500 text-sm mt-2">{{ warning }}</p>
  </div>
</template>

<script setup lang="ts">
// Phase 70 (R187/R191/R192) — text-field equivalent of ConfigNumberField.vue,
// used by the Sender card's fromName/fromAddress and the AI Proxy card's
// comma-separated allowedModels field.
import { ref, computed, watch, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: string
    required?: boolean
    maxLength?: number
    isDefault?: boolean
    // Non-blocking hook — e.g. the Resend-unverifiable-host warning. Renders
    // in amber and NEVER disables Save (UI-SPEC Color: yellow is scoped to
    // this one warning).
    warning?: string | null
    // Parent-owned validity (e.g. isValidEmailFormat) for checks this
    // component cannot know about on its own. Combined with required/
    // maxLength via isSaveDisabled below.
    valid?: boolean
    saving?: boolean
    saved?: boolean
    saveError?: string | null
  }>(),
  {
    required: false,
    maxLength: undefined,
    isDefault: false,
    warning: null,
    valid: true,
    saving: false,
    saved: false,
    saveError: null,
  },
)

const emit = defineEmits<{
  save: [value: string]
  // Phase 70-02 addition (Rule 2 — missing critical functionality): a parent
  // card needs the LIVE edited value to compute format/warning checks while
  // the user types (e.g. SenderConfigCard's email-shape validity and the
  // .web.app/.firebaseapp.com unverifiable-host warning). Purely additive —
  // nothing feeds this back into `modelValue`, so isDirty/re-sync semantics
  // above are unchanged for every existing consumer.
  'update:modelValue': [value: string]
}>()

// R239 (81-02) — a unique, render-stable id so the <label>'s `for` targets
// this instance's <input> specifically. useId() guarantees per-instance
// uniqueness with zero call-site changes (no id prop to plumb through every
// caller, no label-text slugification that could collide across cards).
const fieldId = useId()

const inputValue = ref<string>(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    inputValue.value = v
  },
)

// Notify the parent of every live edit (see emit comment above).
watch(inputValue, (v) => {
  emit('update:modelValue', v)
})

const trimmed = computed(() => inputValue.value.trim())

const ownError = computed<string | null>(() => {
  if (props.required && trimmed.value.length === 0) return 'This field is required.'
  if (props.maxLength !== undefined && trimmed.value.length > props.maxLength) {
    return `Must be ${props.maxLength} characters or less.`
  }
  return null
})

// IN-03: compare trimmed-to-trimmed. Comparing the trimmed local input
// against the RAW (untrimmed) prop meant a stored value carrying incidental
// whitespace (a direct Firestore console edit, a migration, etc.) rendered
// the field as dirty — Save enabled — the instant it mounted, before the
// owner typed anything.
const isDirty = computed(() => trimmed.value !== props.modelValue.trim())

const isSaveDisabled = computed(
  () => ownError.value !== null || !props.valid || !isDirty.value || props.saving,
)

function onSave() {
  if (isSaveDisabled.value) return
  emit('save', trimmed.value)
}
</script>
