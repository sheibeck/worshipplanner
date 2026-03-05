<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-100">Settings</h1>
        <p v-if="authStore.orgName" class="text-sm text-gray-400 mt-1">{{ authStore.orgName }}</p>
      </div>

      <!-- Organization section -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Organization</h2>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Organization Name</label>
          <input
            v-model="editName"
            type="text"
            placeholder="Enter organization name"
            class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
            @keydown.enter="onSave"
          />
        </div>

        <div class="mt-3 flex items-center gap-3">
          <button
            type="button"
            @click="onSave"
            :disabled="isSaveDisabled"
            class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            {{ isSaving ? 'Saving...' : savedFeedback ? 'Saved!' : 'Save' }}
          </button>
        </div>

        <p v-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
      </div>

      <!-- Planning Center Integration section -->
      <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Planning Center Integration</h2>

        <!-- Display mode: credentials saved and not editing -->
        <template v-if="authStore.hasPcCredentials && !editingPcCreds">
          <div class="space-y-2 mb-3">
            <div>
              <span class="text-xs text-gray-400">App ID: </span>
              <span class="font-mono text-sm text-gray-400">............</span>
            </div>
            <div>
              <span class="text-xs text-gray-400">Secret: </span>
              <span class="font-mono text-sm text-gray-400">............</span>
            </div>
          </div>

          <!-- Success feedback after saving -->
          <p v-if="pcSaveSuccess" class="text-green-400 text-sm mb-2">Credentials saved!</p>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              @click="startEditPcCreds"
              class="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Edit Credentials
            </button>
            <button
              type="button"
              @click="onClearPcCredentials"
              class="bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Clear Credentials
            </button>
          </div>
        </template>

        <!-- Edit mode: no credentials yet, or editing existing -->
        <template v-else>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">App ID</label>
              <input
                v-model="pcAppIdInput"
                type="text"
                placeholder="Your Planning Center App ID"
                class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Secret</label>
              <input
                v-model="pcSecretInput"
                type="password"
                placeholder="Your Planning Center Secret"
                class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
              />
            </div>
            <p class="text-xs">
              <a
                href="https://planningcenteronline.com/api_passwords"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-400 hover:text-indigo-300"
              >
                Generate at planningcenteronline.com/api_passwords
              </a>
            </p>
          </div>

          <p v-if="pcValidationError" class="text-red-400 text-sm mt-2">{{ pcValidationError }}</p>
          <p v-if="pcSaveSuccess" class="text-green-400 text-sm mt-2">Credentials saved!</p>

          <div class="mt-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              @click="onSavePcCredentials"
              :disabled="pcValidating || !pcAppIdInput.trim() || !pcSecretInput.trim()"
              class="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              {{ pcValidating ? 'Validating...' : 'Save & Validate' }}
            </button>
            <button
              v-if="editingPcCreds"
              type="button"
              @click="cancelEditPcCreds"
              class="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </template>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
import { validatePcCredentials } from '@/utils/planningCenterApi'

const authStore = useAuthStore()

// ── Local state ────────────────────────────────────────────────────────────────

const editName = ref(authStore.orgName ?? '')
const isSaving = ref(false)
const savedFeedback = ref(false)
const saveError = ref<string | null>(null)

// ── PC credential state ────────────────────────────────────────────────────────

const editingPcCreds = ref(false)
const pcAppIdInput = ref('')
const pcSecretInput = ref('')
const pcValidating = ref(false)
const pcValidationError = ref<string | null>(null)
const pcSaveSuccess = ref(false)

// ── Computed ───────────────────────────────────────────────────────────────────

const isSaveDisabled = computed(() => {
  return (
    isSaving.value ||
    editName.value.trim() === '' ||
    editName.value.trim() === authStore.orgName
  )
})

// ── Sync editName if orgName changes externally (skip during save) ────────────

watch(
  () => authStore.orgName,
  (newName) => {
    if (newName !== null && !isSaving.value) {
      editName.value = newName
    }
  },
)

// ── Save action (Org name) ─────────────────────────────────────────────────────

async function onSave() {
  if (isSaveDisabled.value) return
  if (!authStore.orgId) return

  saveError.value = null
  isSaving.value = true

  try {
    const trimmed = editName.value.trim()
    await updateDoc(doc(db, 'organizations', authStore.orgId), { name: trimmed })
    authStore.orgName = trimmed

    savedFeedback.value = true
    setTimeout(() => {
      savedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save org name error:', err)
    saveError.value = 'Failed to save. Please try again.'
  } finally {
    isSaving.value = false
  }
}

// ── PC credential actions ──────────────────────────────────────────────────────

function startEditPcCreds() {
  // Do NOT pre-fill inputs with actual values (per plan pitfall 6)
  pcAppIdInput.value = ''
  pcSecretInput.value = ''
  pcValidationError.value = null
  editingPcCreds.value = true
}

function cancelEditPcCreds() {
  editingPcCreds.value = false
  pcAppIdInput.value = ''
  pcSecretInput.value = ''
  pcValidationError.value = null
}

async function onSavePcCredentials() {
  if (!authStore.orgId) return
  if (!pcAppIdInput.value.trim() || !pcSecretInput.value.trim()) return

  pcValidating.value = true
  pcValidationError.value = null
  pcSaveSuccess.value = false

  try {
    const result = await validatePcCredentials(pcAppIdInput.value.trim(), pcSecretInput.value.trim())

    if (!result.valid) {
      pcValidationError.value = result.error ?? 'Invalid credentials'
      return
    }

    // Save to Firestore
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      pcAppId: pcAppIdInput.value.trim(),
      pcSecret: pcSecretInput.value.trim(),
    })

    // Update auth store
    authStore.setPcCredentials(
      pcAppIdInput.value.trim(),
      pcSecretInput.value.trim(),
      authStore.pcServiceTypeId,
    )

    // Fetch service types
    pcServiceTypes.value = await fetchServiceTypes(pcAppIdInput.value.trim(), pcSecretInput.value.trim())

    // Set selected service type to existing value if available
    if (authStore.pcServiceTypeId) {
      pcSelectedServiceTypeId.value = authStore.pcServiceTypeId
    }

    pcSaveSuccess.value = true
    editingPcCreds.value = false
    setTimeout(() => {
      pcSaveSuccess.value = false
    }, 2000)

    // Clear inputs
    pcAppIdInput.value = ''
    pcSecretInput.value = ''
  } catch (err) {
    console.error('[SettingsView] save PC credentials error:', err)
    pcValidationError.value = err instanceof Error ? err.message : 'Failed to save credentials'
  } finally {
    pcValidating.value = false
  }
}

async function onClearPcCredentials() {
  if (!authStore.orgId) return

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      pcAppId: null,
      pcSecret: null,
      pcServiceTypeId: null,
    })
    authStore.setPcCredentials(null, null, null)
    pcServiceTypes.value = []
    pcSelectedServiceTypeId.value = ''
    editingPcCreds.value = false
  } catch (err) {
    console.error('[SettingsView] clear PC credentials error:', err)
  }
}

async function onSaveServiceType() {
  if (!authStore.orgId) return
  if (!pcSelectedServiceTypeId.value) return

  pcServiceTypeSaving.value = true
  pcServiceTypeSaved.value = false

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      pcServiceTypeId: pcSelectedServiceTypeId.value,
    })
    authStore.setPcCredentials(
      authStore.pcAppId,
      authStore.pcSecret,
      pcSelectedServiceTypeId.value,
    )
    pcServiceTypeSaved.value = true
    setTimeout(() => {
      pcServiceTypeSaved.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save service type error:', err)
  } finally {
    pcServiceTypeSaving.value = false
  }
}
</script>
