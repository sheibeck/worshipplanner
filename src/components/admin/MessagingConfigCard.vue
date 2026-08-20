<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Messaging</h2>
    <p class="text-xs text-gray-400 mb-3">
      The scheduled reminder job and the send-volume limits for volunteer email, across every
      organization.
    </p>

    <!-- The ONE editable boolean on this whole surface — immediate save on
         change, identical to SettingsView.vue's onToggleAiEnabled shape. -->
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        v-model="cronEnabledInput"
        type="checkbox"
        @change="onToggleCron"
        class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
      />
      <span class="text-sm text-gray-200">Run the scheduled messaging cron</span>
    </label>
    <p v-if="cronSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
    <p v-if="cronSaveError" class="text-red-400 text-sm mt-2">{{ cronSaveError }}</p>

    <div class="mt-6 pt-6 border-t border-gray-800 space-y-6">
      <ConfigNumberField
        label="Max recipients per message"
        :model-value="store.resolvedConfig.messaging.maxRecipients"
        :min="1"
        :max="5000"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'messaging.maxRecipients')"
        :saving="stateFor('messaging.maxRecipients').saving"
        :saved="stateFor('messaging.maxRecipients').saved"
        :save-error="stateFor('messaging.maxRecipients').error"
        @save="(v) => onSaveNumber('messaging.maxRecipients', v)"
      />
      <ConfigNumberField
        label="Max emails per org per day"
        :model-value="store.resolvedConfig.messaging.orgDailyEmailQuota"
        :min="1"
        :max="50000"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'messaging.orgDailyEmailQuota')"
        :saving="stateFor('messaging.orgDailyEmailQuota').saving"
        :saved="stateFor('messaging.orgDailyEmailQuota').saved"
        :save-error="stateFor('messaging.orgDailyEmailQuota').error"
        @save="(v) => onSaveNumber('messaging.orgDailyEmailQuota', v)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Phase 70-02 (R186/R187) — Messaging card: the one editable
// messaging.scheduledCronEnabled toggle (immediate save, no Save button —
// mirrors SettingsView.vue's onToggleAiEnabled/onToggleMessagingEnabled shape)
// plus two editable numbers via ConfigNumberField.
import { ref, reactive, watch } from 'vue'
import ConfigNumberField from './ConfigNumberField.vue'
import { useAppConfigStore } from '@/stores/appConfig'
import { isExplicitlySet } from '@/config/appConfigDefaults'

const store = useAppConfigStore()

const cronEnabledInput = ref(store.resolvedConfig.messaging.scheduledCronEnabled)
watch(
  () => store.resolvedConfig.messaging.scheduledCronEnabled,
  (v) => {
    cronEnabledInput.value = v
  },
)

const cronSavedFeedback = ref(false)
const cronSaveError = ref<string | null>(null)

async function onToggleCron(): Promise<void> {
  const newValue = cronEnabledInput.value
  cronSaveError.value = null
  try {
    await store.saveField('messaging.scheduledCronEnabled', newValue)
    cronSavedFeedback.value = true
    setTimeout(() => {
      cronSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[MessagingConfigCard] save messaging.scheduledCronEnabled error:', err)
    cronSaveError.value = 'Failed to save. Please try again.'
    cronEnabledInput.value = !newValue // revert on failure, matching every existing toggle handler
  }
}

interface FieldSaveState {
  saving: boolean
  saved: boolean
  error: string | null
}

const fieldStates = reactive<Record<string, FieldSaveState>>({
  'messaging.maxRecipients': { saving: false, saved: false, error: null },
  'messaging.orgDailyEmailQuota': { saving: false, saved: false, error: null },
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
    console.error(`[MessagingConfigCard] save ${path} error:`, err)
    state.error = 'Failed to save. Please try again.'
  } finally {
    state.saving = false
  }
}
</script>
