<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Cleanup</h2>
    <p class="text-xs text-gray-400 mb-3">
      These control the four scheduled data-cleanup jobs (media, PPTX renders, backgrounds, PPTX
      sources). Below you can adjust how long each type of data is kept and the most it can delete
      in one run.
    </p>

    <!-- Enable/Disable cleanup rows (Phase 71, R189/R190) — the status checkbox
         stays a pure, disabled indicator with NO @change handler; the explicit
         Enable/Disable buttons are the only write triggers. -->
    <div class="space-y-2">
      <div v-for="row in CLEANUP_ROWS" :key="row.type" :data-testid="`cleanup-row-${row.type}`">
        <div class="flex items-center justify-between gap-3">
          <label class="flex items-center gap-3 opacity-60 cursor-not-allowed">
            <input
              type="checkbox"
              :checked="store.resolvedConfig.cleanup[row.field]"
              disabled
              class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600"
            />
            <span class="text-sm text-gray-200">{{ row.label }}</span>
          </label>

          <button
            v-if="!store.resolvedConfig.cleanup[row.field]"
            type="button"
            :disabled="cleanupStateFor(row.type).status === 'previewing'"
            class="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            @click="onEnableClick(row.type)"
          >
            {{ cleanupStateFor(row.type).status === 'previewing' ? 'Checking…' : 'Enable' }}
          </button>
          <button
            v-else
            type="button"
            :disabled="cleanupStateFor(row.type).status === 'disabling'"
            class="text-sm text-gray-400 hover:text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            @click="onDisableClick(row.type)"
          >
            {{ cleanupStateFor(row.type).status === 'disabling' ? 'Disabling…' : 'Disable' }}
          </button>
        </div>
        <p v-if="cleanupStateFor(row.type).previewError" class="text-red-400 text-xs mt-1">
          {{ cleanupStateFor(row.type).previewError }}
        </p>
        <p v-if="cleanupStateFor(row.type).disableError" class="text-red-400 text-xs mt-1">
          {{ cleanupStateFor(row.type).disableError }}
        </p>
        <p v-if="cleanupStateFor(row.type).savedFlash" class="text-green-400 text-xs mt-1">
          {{ cleanupStateFor(row.type).savedFlash }}
        </p>
      </div>
    </div>
    <p class="text-xs text-gray-500 mt-2">
      Enabling requires a dry-run preview showing exactly what would be deleted, and an explicit
      confirm. Disabling is immediate — turning a cleanup off is always safe.
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

    <CleanupEnableConfirmDialog
      :open="activeDialog !== null"
      :type-label="activeDialog?.typeLabel ?? ''"
      :would-delete-count="activeDialog?.wouldDeleteCount ?? 0"
      :would-delete-bytes="activeDialog?.wouldDeleteBytes ?? 0"
      :references-complete="activeDialog?.referencesComplete"
      :confirming="confirming"
      :confirm-error="confirmError"
      @confirm="onDialogConfirm"
      @cancel="onDialogCancel"
    />
  </div>
</template>

<script setup lang="ts">
// Phase 70-02 (R186/R187) — read-only cleanup toggles + retention/cap
// numbers, extended by Phase 71-02 (R189/R190) with the Enable -> dry-run
// preview -> confirm flow and immediate Disable. Flipping the flag NEVER
// deletes in-band -- enabling only arms the next scheduled cron; the only
// write is the plain store.saveField call below.
import { reactive, ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import ConfigNumberField from './ConfigNumberField.vue'
import CleanupEnableConfirmDialog from './CleanupEnableConfirmDialog.vue'
import { useAppConfigStore } from '@/stores/appConfig'
import { isExplicitlySet, type AppConfig } from '@/config/appConfigDefaults'
import { functions } from '@/firebase'

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

// ── Enable/Disable cleanup flow (Phase 71-02, R189/R190) ──────────────────

type CleanupType = 'media' | 'orphanRenders' | 'backgrounds' | 'pptxSources'

interface CleanupRow {
  type: CleanupType
  field: keyof AppConfig['cleanup']
  label: string
  typeLabel: string
}

const CLEANUP_ROWS: CleanupRow[] = [
  { type: 'media', field: 'mediaEnabled', label: 'Delete media after inactivity', typeLabel: 'media cleanup' },
  {
    type: 'orphanRenders',
    field: 'pptxRenderEnabled',
    label: 'Delete orphaned PPTX renders',
    typeLabel: 'PPTX render cleanup',
  },
  {
    type: 'backgrounds',
    field: 'backgroundEnabled',
    label: 'Delete orphaned backgrounds',
    typeLabel: 'background cleanup',
  },
  {
    type: 'pptxSources',
    field: 'pptxSourceEnabled',
    label: 'Delete orphaned PPTX sources',
    typeLabel: 'PPTX source cleanup',
  },
]

function configFieldFor(type: CleanupType): keyof AppConfig['cleanup'] {
  return CLEANUP_ROWS.find((row) => row.type === type)!.field
}

function typeLabelFor(type: CleanupType): string {
  return CLEANUP_ROWS.find((row) => row.type === type)!.typeLabel
}

interface CleanupRowState {
  status: 'idle' | 'previewing' | 'disabling'
  previewError: string | null
  disableError: string | null
  savedFlash: string | null
}

const cleanupStates = reactive<Record<CleanupType, CleanupRowState>>({
  media: { status: 'idle', previewError: null, disableError: null, savedFlash: null },
  orphanRenders: { status: 'idle', previewError: null, disableError: null, savedFlash: null },
  backgrounds: { status: 'idle', previewError: null, disableError: null, savedFlash: null },
  pptxSources: { status: 'idle', previewError: null, disableError: null, savedFlash: null },
})

function cleanupStateFor(type: CleanupType): CleanupRowState {
  return cleanupStates[type]
}

interface PreviewCleanupDryRunResponse {
  wouldDeleteCount: number
  wouldDeleteBytes: number
  referencesComplete?: boolean
}

interface ActiveDialogState {
  type: CleanupType
  typeLabel: string
  wouldDeleteCount: number
  wouldDeleteBytes: number
  referencesComplete?: boolean
}

// Only one confirm dialog can be open at a time — a single card-level ref,
// per 71-UI-SPEC.md Resolved Design Decision 5.
const activeDialog = ref<ActiveDialogState | null>(null)
const confirming = ref(false)
const confirmError = ref<string | null>(null)

// Mirrors src/views/OwnerConsoleView.vue's callSetSuperAdminClaim/
// friendlyCallableError httpsCallable pattern.
async function onEnableClick(type: CleanupType): Promise<void> {
  const state = cleanupStateFor(type)
  state.status = 'previewing'
  state.previewError = null
  try {
    const preview = httpsCallable<{ type: CleanupType }, PreviewCleanupDryRunResponse>(
      functions,
      'previewCleanupDryRun',
    )
    const result = await preview({ type })
    activeDialog.value = {
      type,
      typeLabel: typeLabelFor(type),
      wouldDeleteCount: result.data.wouldDeleteCount,
      wouldDeleteBytes: result.data.wouldDeleteBytes,
      referencesComplete: result.data.referencesComplete,
    }
  } catch (err) {
    console.error(`[CleanupConfigCard] preview ${type} error:`, err)
    state.previewError = "Couldn't check what would be deleted. Please try again."
  } finally {
    state.status = 'idle'
  }
}

async function onDialogConfirm(): Promise<void> {
  if (!activeDialog.value) return
  const { type } = activeDialog.value
  confirming.value = true
  confirmError.value = null
  try {
    await store.saveField(`cleanup.${configFieldFor(type)}`, true)
    activeDialog.value = null
    const state = cleanupStateFor(type)
    state.savedFlash = 'Enabled!'
    setTimeout(() => {
      state.savedFlash = null
    }, 2000)
  } catch (err) {
    console.error(`[CleanupConfigCard] enable ${type} error:`, err)
    confirmError.value = 'Failed to enable. Please try again.'
  } finally {
    confirming.value = false
  }
}

function onDialogCancel(): void {
  activeDialog.value = null
  confirmError.value = null
}

// Disabling is immediate -- no preview call, no dialog. Turning a cleanup
// off is always safe.
async function onDisableClick(type: CleanupType): Promise<void> {
  const state = cleanupStateFor(type)
  state.status = 'disabling'
  state.disableError = null
  try {
    await store.saveField(`cleanup.${configFieldFor(type)}`, false)
    state.savedFlash = 'Saved!'
    setTimeout(() => {
      state.savedFlash = null
    }, 2000)
  } catch (err) {
    console.error(`[CleanupConfigCard] disable ${type} error:`, err)
    state.disableError = 'Failed to save. Please try again.'
  } finally {
    state.status = 'idle'
  }
}
</script>
