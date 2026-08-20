<template>
  <div>
    <label class="text-xs text-gray-400 mb-1 flex items-center gap-1">
      {{ label }}
      <span v-if="isDefault" class="text-xs text-gray-500 italic">(default)</span>
    </label>
    <div class="flex flex-col sm:flex-row gap-2">
      <input
        v-model.number="inputValue"
        type="number"
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
    <p v-if="displayError" class="text-red-400 text-sm mt-2">{{ displayError }}</p>
    <p v-else-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
  </div>
</template>

<script setup lang="ts">
// Phase 70 (R187) — reusable label + (default) badge + number input +
// Save-button + status-triad block, factored out of SettingsView.vue's
// repeated inline field pattern (no standalone field-component precedent
// existed prior to this phase — see 70-PATTERNS.md).
import { ref, computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min?: number
    max?: number
    integer?: boolean
    required?: boolean
    isDefault?: boolean
    externalError?: string | null
    saving?: boolean
    saved?: boolean
    saveError?: string | null
  }>(),
  {
    min: undefined,
    max: undefined,
    integer: false,
    required: false,
    isDefault: false,
    externalError: null,
    saving: false,
    saved: false,
    saveError: null,
  },
)

const emit = defineEmits<{
  save: [value: number]
}>()

const inputValue = ref<number>(props.modelValue)

// Re-sync the local input when the effective value changes from elsewhere
// (e.g. another onSnapshot update), matching every existing
// watch(() => authStore.settings.X, ...) re-sync block in SettingsView.vue.
watch(
  () => props.modelValue,
  (v) => {
    inputValue.value = v
  },
)

// Inline validation error, shown BEFORE Save is clicked so the owner sees
// WHY Save is disabled, not just that it is (UI-SPEC States & Interactions).
const ownError = computed<string | null>(() => {
  const n = inputValue.value
  if (n === null || n === undefined || Number.isNaN(n)) {
    return props.required ? 'This field is required.' : null
  }
  if (props.integer && !Number.isInteger(n)) return 'Must be a whole number.'
  if (props.min !== undefined && n < props.min) return `Must be at least ${props.min}.`
  if (props.max !== undefined && n > props.max) return `Must be ${props.max} or less.`
  return null
})

// The cross-field hook (e.g. rateLimitPerDay >= rateLimitPerMin) is owned
// by the parent card and passed in via externalError — it renders and
// disables Save exactly like an own-bounds error, even when own bounds
// pass.
const displayError = computed<string | null>(() => ownError.value ?? props.externalError ?? null)

const isDirty = computed(() => inputValue.value !== props.modelValue)

const isSaveDisabled = computed(
  () => displayError.value !== null || !isDirty.value || props.saving,
)

function onSave() {
  if (isSaveDisabled.value) return
  emit('save', inputValue.value)
}
</script>
