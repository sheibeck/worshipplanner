<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Onboarding Emails</h2>
    <p class="text-xs text-gray-400 mb-3">
      Send an automated onboarding email to invited members — a "set your password" link for
      non-Google addresses, and a sign-in notice for Gmail/Google Workspace addresses.
    </p>

    <!-- The ONE editable boolean on this card — immediate save on change,
         identical shape to MessagingConfigCard's scheduledCronEnabled toggle. -->
    <label class="flex items-center gap-3 cursor-pointer">
      <input
        v-model="emailsEnabledInput"
        type="checkbox"
        @change="onToggleEmailsEnabled"
        class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
      />
      <span class="text-sm text-gray-200">Send invite onboarding emails</span>
    </label>
    <p v-if="savedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
    <p v-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
  </div>
</template>

<script setup lang="ts">
// Phase 99-01 (R293) — Onboarding Emails card: the owner's on/off switch for
// invite/onboarding emails, backed by appConfig.onboarding.emailsEnabled.
// Mirrors MessagingConfigCard.vue's scheduledCronEnabled checkbox block
// exactly (immediate save, no Save button, revert-on-error).
import { ref, watch } from 'vue'
import { useAppConfigStore } from '@/stores/appConfig'

const store = useAppConfigStore()

const emailsEnabledInput = ref(store.resolvedConfig.onboarding.emailsEnabled)
watch(
  () => store.resolvedConfig.onboarding.emailsEnabled,
  (v) => {
    emailsEnabledInput.value = v
  },
)

const savedFeedback = ref(false)
const saveError = ref<string | null>(null)

async function onToggleEmailsEnabled(): Promise<void> {
  const newValue = emailsEnabledInput.value
  saveError.value = null
  try {
    await store.saveField('onboarding.emailsEnabled', newValue)
    savedFeedback.value = true
    setTimeout(() => {
      savedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[OnboardingConfigCard] save onboarding.emailsEnabled error:', err)
    saveError.value = 'Failed to save. Please try again.'
    emailsEnabledInput.value = !newValue // revert on failure, matching every existing toggle handler
  }
}
</script>
