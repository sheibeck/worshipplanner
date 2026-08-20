<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Sender</h2>
    <p class="text-xs text-gray-400 mb-3">
      The email address volunteer notifications send from. It must belong to a domain verified in
      Resend — this app can't verify a domain for you.
    </p>

    <div class="space-y-6">
      <ConfigTextField
        label="Display name"
        :model-value="store.resolvedConfig.sender.fromName"
        :required="false"
        :max-length="100"
        :is-default="!isExplicitlySet(store.rawDoc, 'sender.fromName')"
        :saving="stateFor('sender.fromName').saving"
        :saved="stateFor('sender.fromName').saved"
        :save-error="stateFor('sender.fromName').error"
        @save="(v) => onSaveText('sender.fromName', v)"
      />
      <div>
        <ConfigTextField
          label="From address"
          :model-value="store.resolvedConfig.sender.fromAddress"
          @update:model-value="fromAddressLive = $event"
          :required="true"
          :is-default="!isExplicitlySet(store.rawDoc, 'sender.fromAddress')"
          :valid="fromAddressValid"
          :warning="fromAddressWarning"
          :saving="stateFor('sender.fromAddress').saving"
          :saved="stateFor('sender.fromAddress').saved"
          :save-error="stateFor('sender.fromAddress').error"
          @save="(v) => onSaveText('sender.fromAddress', v)"
        />
        <p
          v-if="fromAddressLive.trim().length > 0 && !fromAddressValid"
          class="text-red-400 text-sm mt-2"
        >
          Enter a valid email address.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Phase 70-02 (R191/R192) — Sender card: exactly two inputs (fromName,
// fromAddress). No secret/credential field of any kind renders here —
// AppConfig.sender has no secret field by construction (R192), so there is
// nothing to redact because nothing secret is ever requested.
import { ref, reactive, computed, watch } from 'vue'
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
  'sender.fromName': { saving: false, saved: false, error: null },
  'sender.fromAddress': { saving: false, saved: false, error: null },
})

// `noUncheckedIndexedAccess` makes a bare Record index access `T | undefined`
// even for a key known (by this file's own literal object above) to always
// be present. This helper centralizes the one non-null assertion instead of
// repeating it at every call site (template + script).
function stateFor(path: string): FieldSaveState {
  return fieldStates[path]!
}

async function onSaveText(path: string, value: string): Promise<void> {
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
    console.error(`[SenderConfigCard] save ${path} error:`, err)
    state.error = 'Failed to save. Please try again.'
  } finally {
    state.saving = false
  }
}

// ── fromAddress format check — reuses the SAME lax shape check already
// established by OwnerConsoleView.vue's own isValidEmailFormat (lines
// 161-164): contains '@', contains '.', non-empty. Duplicated here (not
// imported) because OwnerConsoleView.vue does not export it — deliberately
// NOT a stricter regex (UI-SPEC resolved decision #5). ──
function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

// The two confirmed-unreachable Firebase-managed hosts named in
// functions/src/index.ts's own comment and in R192 — deliberately narrow,
// do not expand to guess at other providers.
const UNVERIFIABLE_HOST_PATTERNS = [/\.web\.app$/i, /\.firebaseapp\.com$/i]

function isUnverifiableHost(address: string): boolean {
  const at = address.lastIndexOf('@')
  if (at === -1) return false
  const host = address.slice(at + 1)
  return UNVERIFIABLE_HOST_PATTERNS.some((re) => re.test(host))
}

// ConfigTextField's `update:modelValue` (70-02 addition) exposes the LIVE
// edited value so validity/warning react to what the owner is currently
// typing, not just the last-saved effective value.
const fromAddressLive = ref(store.resolvedConfig.sender.fromAddress)
watch(
  () => store.resolvedConfig.sender.fromAddress,
  (v) => {
    fromAddressLive.value = v
  },
)

const fromAddressValid = computed(() => isValidEmailFormat(fromAddressLive.value))

// Non-blocking amber warning — never disables Save (UI-SPEC Color: yellow is
// scoped to this one warning).
const fromAddressWarning = computed<string | null>(() => {
  if (!fromAddressValid.value) return null
  if (isUnverifiableHost(fromAddressLive.value.trim())) {
    return "This domain can't be verified in Resend (Firebase-managed, no DNS access). Emails from it will fail to send until you configure a custom domain."
  }
  return null
})
</script>
