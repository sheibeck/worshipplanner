<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">AI Proxy</h2>
    <p class="text-xs text-gray-400 mb-3">
      Rate limits and the allowed AI models for song suggestions, scripture discovery, and
      congregational-reading-split features, across every organization.
    </p>

    <div class="space-y-6">
      <ConfigNumberField
        label="Requests per minute"
        :model-value="store.resolvedConfig.aiProxy.rateLimitPerMin"
        @update:model-value="rateLimitPerMinLive = $event"
        :min="1"
        :max="1000"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'aiProxy.rateLimitPerMin')"
        :external-error="rateLimitPerMinCrossFieldError"
        :saving="stateFor('aiProxy.rateLimitPerMin').saving"
        :saved="stateFor('aiProxy.rateLimitPerMin').saved"
        :save-error="stateFor('aiProxy.rateLimitPerMin').error"
        @save="(v) => onSaveNumber('aiProxy.rateLimitPerMin', v)"
      />
      <ConfigNumberField
        label="Requests per day"
        :model-value="store.resolvedConfig.aiProxy.rateLimitPerDay"
        @update:model-value="rateLimitPerDayLive = $event"
        :min="1"
        :max="100000"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'aiProxy.rateLimitPerDay')"
        :external-error="rateLimitPerDayCrossFieldError"
        :saving="stateFor('aiProxy.rateLimitPerDay').saving"
        :saved="stateFor('aiProxy.rateLimitPerDay').saved"
        :save-error="stateFor('aiProxy.rateLimitPerDay').error"
        @save="(v) => onSaveNumber('aiProxy.rateLimitPerDay', v)"
      />
      <ConfigTextField
        label="Allowed models (comma-separated)"
        :model-value="allowedModelsText"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'aiProxy.allowedModels')"
        :saving="stateFor('aiProxy.allowedModels').saving"
        :saved="stateFor('aiProxy.allowedModels').saved"
        :save-error="stateFor('aiProxy.allowedModels').error"
        @save="onSaveAllowedModels"
      />
      <p v-if="allowedModelsError" class="text-red-400 text-sm -mt-4">{{ allowedModelsError }}</p>
      <ConfigNumberField
        label="Max tokens per request"
        :model-value="store.resolvedConfig.aiProxy.maxTokensCeiling"
        :min="1"
        :max="200000"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'aiProxy.maxTokensCeiling')"
        :saving="stateFor('aiProxy.maxTokensCeiling').saving"
        :saved="stateFor('aiProxy.maxTokensCeiling').saved"
        :save-error="stateFor('aiProxy.maxTokensCeiling').error"
        @save="(v) => onSaveNumber('aiProxy.maxTokensCeiling', v)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Phase 70-02 (R186/R187) — AI Proxy card: three ConfigNumberField number
// knobs (incl. the rateLimitPerDay >= rateLimitPerMin cross-field rule, RESEARCH
// Pitfall 4) plus allowedModels as ONE comma-separated ConfigTextField (RESEARCH
// Pitfall 3 — split/trim/filter/require-non-empty before saving a string[]).
import { ref, reactive, computed, watch } from 'vue'
import ConfigNumberField from './ConfigNumberField.vue'
import ConfigTextField from './ConfigTextField.vue'
import { useAppConfigStore } from '@/stores/appConfig'
import { isExplicitlySet } from '@/config/appConfigDefaults'

const store = useAppConfigStore()

interface FieldSaveState {
  saving: boolean
  saved: boolean
  error: string | null
}

const fieldStates = reactive<Record<string, FieldSaveState>>({
  'aiProxy.rateLimitPerMin': { saving: false, saved: false, error: null },
  'aiProxy.rateLimitPerDay': { saving: false, saved: false, error: null },
  'aiProxy.allowedModels': { saving: false, saved: false, error: null },
  'aiProxy.maxTokensCeiling': { saving: false, saved: false, error: null },
})

// `noUncheckedIndexedAccess` makes a bare Record index access `T | undefined`
// even for a key known (by this file's own literal object above) to always
// be present. This helper centralizes the one non-null assertion instead of
// repeating it at every call site (template + script).
function stateFor(path: string): FieldSaveState {
  return fieldStates[path]!
}

async function onSaveNumber(path: string, value: number): Promise<void> {
  const state = stateFor(path)
  state.error = null
  state.saving = true
  try {
    await store.saveField(path, value)
    state.saved = true
    setTimeout(() => {
      state.saved = false
    }, 2000)
  } catch (err) {
    console.error(`[AiProxyConfigCard] save ${path} error:`, err)
    state.error = 'Failed to save. Please try again.'
  } finally {
    state.saving = false
  }
}

// ── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH Pitfall 4) ──
// ConfigNumberField's `update:modelValue` (70-02 addition) exposes the LIVE
// edited value so this reacts to what the owner is currently typing, not just
// the last-saved effective value — a naive "compare only saved values" check
// would let a genuinely invalid save through.
const rateLimitPerDayLive = ref(store.resolvedConfig.aiProxy.rateLimitPerDay)
watch(
  () => store.resolvedConfig.aiProxy.rateLimitPerDay,
  (v) => {
    rateLimitPerDayLive.value = v
  },
)

const rateLimitPerDayCrossFieldError = computed<string | null>(() => {
  if (rateLimitPerDayLive.value < store.resolvedConfig.aiProxy.rateLimitPerMin) {
    return 'Daily limit must be at least the per-minute limit.'
  }
  return null
})

// Mirror of the above (review WR-01): the original cross-field rule was only
// wired onto the rateLimitPerDay field, so an owner could raise
// rateLimitPerMin above the (unchanged) rateLimitPerDay with no warning and
// Save would succeed. Bidirectional by construction — both computeds react
// to the OTHER field's live edited value the same way, so raising either
// field past the other's current effective value blocks Save on the field
// being edited.
const rateLimitPerMinLive = ref(store.resolvedConfig.aiProxy.rateLimitPerMin)
watch(
  () => store.resolvedConfig.aiProxy.rateLimitPerMin,
  (v) => {
    rateLimitPerMinLive.value = v
  },
)

const rateLimitPerMinCrossFieldError = computed<string | null>(() => {
  if (rateLimitPerMinLive.value > store.resolvedConfig.aiProxy.rateLimitPerDay) {
    return 'Per-minute limit cannot exceed the daily limit.'
  }
  return null
})

// ── allowedModels: one comma-separated text field, split/trim/filter on save ──
const allowedModelsText = computed(() => store.resolvedConfig.aiProxy.allowedModels.join(', '))
const allowedModelsError = ref<string | null>(null)

async function onSaveAllowedModels(rawInput: string): Promise<void> {
  const parsed = rawInput
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (parsed.length === 0) {
    allowedModelsError.value = 'Enter at least one model.'
    return
  }
  allowedModelsError.value = null

  const state = stateFor('aiProxy.allowedModels')
  state.error = null
  state.saving = true
  try {
    await store.saveField('aiProxy.allowedModels', parsed)
    state.saved = true
    setTimeout(() => {
      state.saved = false
    }, 2000)
  } catch (err) {
    console.error('[AiProxyConfigCard] save aiProxy.allowedModels error:', err)
    state.error = 'Failed to save. Please try again.'
  } finally {
    state.saving = false
  }
}
</script>
