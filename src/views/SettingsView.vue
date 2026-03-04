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
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'

const authStore = useAuthStore()

// ── Local state ────────────────────────────────────────────────────────────────

const editName = ref(authStore.orgName ?? '')
const isSaving = ref(false)
const savedFeedback = ref(false)
const saveError = ref<string | null>(null)

// ── Computed ───────────────────────────────────────────────────────────────────

const isSaveDisabled = computed(() => {
  return (
    isSaving.value ||
    editName.value.trim() === '' ||
    editName.value.trim() === authStore.orgName
  )
})

// ── Sync editName if orgName changes externally ────────────────────────────────

watch(
  () => authStore.orgName,
  (newName) => {
    if (newName !== null) {
      editName.value = newName
    }
  },
)

// ── Save action ────────────────────────────────────────────────────────────────

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
</script>
