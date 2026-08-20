<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Cleanup</h2>
    <p class="text-xs text-gray-400 mb-3">
      These control the four scheduled data-cleanup jobs (media, PPTX renders, backgrounds, PPTX
      sources). Turning a cleanup ON uses a dry-run safety flow — coming in a future release. Below
      you can adjust how long each type of data is kept and the most it can delete in one run.
    </p>

    <!-- Read-only cleanup toggles (scope fence with Phase 71, R188-R190) — no
         @change/@click handler, always disabled, reflects live effective state only. -->
    <div class="space-y-2">
      <label class="flex items-center gap-3 opacity-60 cursor-not-allowed">
        <input
          type="checkbox"
          :checked="store.resolvedConfig.cleanup.mediaEnabled"
          disabled
          class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600"
        />
        <span class="text-sm text-gray-200">Delete media after inactivity</span>
        <span class="text-xs text-gray-500 italic">(read-only)</span>
      </label>
      <label class="flex items-center gap-3 opacity-60 cursor-not-allowed">
        <input
          type="checkbox"
          :checked="store.resolvedConfig.cleanup.pptxRenderEnabled"
          disabled
          class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600"
        />
        <span class="text-sm text-gray-200">Delete orphaned PPTX renders</span>
        <span class="text-xs text-gray-500 italic">(read-only)</span>
      </label>
      <label class="flex items-center gap-3 opacity-60 cursor-not-allowed">
        <input
          type="checkbox"
          :checked="store.resolvedConfig.cleanup.backgroundEnabled"
          disabled
          class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600"
        />
        <span class="text-sm text-gray-200">Delete orphaned backgrounds</span>
        <span class="text-xs text-gray-500 italic">(read-only)</span>
      </label>
      <label class="flex items-center gap-3 opacity-60 cursor-not-allowed">
        <input
          type="checkbox"
          :checked="store.resolvedConfig.cleanup.pptxSourceEnabled"
          disabled
          class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600"
        />
        <span class="text-sm text-gray-200">Delete orphaned PPTX sources</span>
        <span class="text-xs text-gray-500 italic">(read-only)</span>
      </label>
    </div>
    <p class="text-xs text-gray-500 mt-2">
      Enabling a cleanup requires a dry-run preview and a confirm step, coming in a future release.
      These switches reflect the current state but can't be changed here.
    </p>

    <!-- Editable retention/delete-cap numbers -->
    <div class="mt-6 pt-6 border-t border-gray-800 space-y-6">
      <ConfigNumberField
        label="Media retention (days)"
        :model-value="store.resolvedConfig.retention.mediaDays"
        :min="1"
        :max="365"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'retention.mediaDays')"
        :saving="stateFor('retention.mediaDays').saving"
        :saved="stateFor('retention.mediaDays').saved"
        :save-error="stateFor('retention.mediaDays').error"
        @save="(v) => onSaveNumber('retention.mediaDays', v)"
      />
      <ConfigNumberField
        label="Orphan render staleness (hours)"
        :model-value="store.resolvedConfig.retention.orphanRenderStaleHours"
        :min="1"
        :max="720"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'retention.orphanRenderStaleHours')"
        :saving="stateFor('retention.orphanRenderStaleHours').saving"
        :saved="stateFor('retention.orphanRenderStaleHours').saved"
        :save-error="stateFor('retention.orphanRenderStaleHours').error"
        @save="(v) => onSaveNumber('retention.orphanRenderStaleHours', v)"
      />
      <ConfigNumberField
        label="Background retention (days)"
        :model-value="store.resolvedConfig.retention.backgroundDays"
        :min="1"
        :max="365"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'retention.backgroundDays')"
        :saving="stateFor('retention.backgroundDays').saving"
        :saved="stateFor('retention.backgroundDays').saved"
        :save-error="stateFor('retention.backgroundDays').error"
        @save="(v) => onSaveNumber('retention.backgroundDays', v)"
      />
      <ConfigNumberField
        label="PPTX source retention (days)"
        :model-value="store.resolvedConfig.retention.pptxSourceDays"
        :min="1"
        :max="365"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'retention.pptxSourceDays')"
        :saving="stateFor('retention.pptxSourceDays').saving"
        :saved="stateFor('retention.pptxSourceDays').saved"
        :save-error="stateFor('retention.pptxSourceDays').error"
        @save="(v) => onSaveNumber('retention.pptxSourceDays', v)"
      />
      <ConfigNumberField
        label="Max deletions per run"
        :model-value="store.resolvedConfig.deleteCapPerRun"
        :min="1"
        :max="5000"
        :integer="true"
        :required="true"
        :is-default="!isExplicitlySet(store.rawDoc, 'deleteCapPerRun')"
        :saving="stateFor('deleteCapPerRun').saving"
        :saved="stateFor('deleteCapPerRun').saved"
        :save-error="stateFor('deleteCapPerRun').error"
        @save="(v) => onSaveNumber('deleteCapPerRun', v)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Phase 70-02 (R186/R187) — Cleanup card: four READ-ONLY cleanup.*Enabled
// toggles (scope fence with Phase 71's dry-run confirm-to-flip, R188-R190)
// plus five editable retention/delete-cap numbers via ConfigNumberField.
import { reactive } from 'vue'
import ConfigNumberField from './ConfigNumberField.vue'
import { useAppConfigStore } from '@/stores/appConfig'
import { isExplicitlySet } from '@/config/appConfigDefaults'

const store = useAppConfigStore()

interface FieldSaveState {
  saving: boolean
  saved: boolean
  error: string | null
}

const fieldStates = reactive<Record<string, FieldSaveState>>({
  'retention.mediaDays': { saving: false, saved: false, error: null },
  'retention.orphanRenderStaleHours': { saving: false, saved: false, error: null },
  'retention.backgroundDays': { saving: false, saved: false, error: null },
  'retention.pptxSourceDays': { saving: false, saved: false, error: null },
  deleteCapPerRun: { saving: false, saved: false, error: null },
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
    console.error(`[CleanupConfigCard] save ${path} error:`, err)
    state.error = 'Failed to save. Please try again.'
  } finally {
    state.saving = false
  }
}
</script>
