<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
        <p class="text-sm text-gray-400 mt-1">Signing you in&hellip;</p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">
        <!-- In progress -->
        <div v-if="isVerifying" class="flex flex-col items-center gap-3 py-4">
          <svg class="w-6 h-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <p class="text-sm text-gray-400">Verifying your sign-in link&hellip;</p>
        </div>

        <!-- Cross-device: no stored email — ask for it, never read from the URL. -->
        <form
          v-else-if="volunteerAuth.needsEmailReentry"
          @submit.prevent="handleReentrySubmit"
          class="space-y-3"
        >
          <p class="text-sm text-gray-400">
            To finish signing in on this device, please confirm the email your reminder was sent to.
          </p>
          <div>
            <label for="reentry-email" class="sr-only">Email</label>
            <input
              id="reentry-email"
              v-model="reenteredEmail"
              type="email"
              autocomplete="email"
              required
              placeholder="Email address"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>
          <p v-if="volunteerAuth.errorMessage" class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
            {{ volunteerAuth.errorMessage }}
          </p>
          <button
            type="submit"
            :disabled="isSubmittingReentry"
            class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmittingReentry ? 'Confirming...' : 'Confirm and sign in' }}
          </button>
        </form>

        <!-- Error state (invalid/expired link, or a Firebase error incl. operation-not-allowed). -->
        <div v-else-if="volunteerAuth.errorMessage" class="text-center space-y-3">
          <div class="w-10 h-10 rounded-full bg-red-950 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p class="text-sm text-gray-300">{{ volunteerAuth.errorMessage }}</p>
          <!-- R399 (Phase 128) — one-tap recovery: the slug travels in the
               minted link's continue-URL query (128-01's mintAndSendVolunteerLink),
               so re-requesting returns to the SAME church with no re-selection.
               Navigates via router.push to a NAMED route target only (never a
               raw redirect URL) — 128-RESEARCH Pitfall 5 / threat T-128-C3.
               A plain button + router.push (not RouterLink) mirrors this
               codebase's established pattern for testability under a fully
               mocked 'vue-router' module (see LoginView.vue). -->
          <button
            type="button"
            @click="router.push(requestNewLinkTarget)"
            class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
          >
            Request a new link
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useVolunteerAuthStore } from '@/stores/volunteerAuth'

const router = useRouter()
const route = useRoute()
const volunteerAuth = useVolunteerAuthStore()

const isVerifying = ref(true)
const isSubmittingReentry = ref(false)
const reenteredEmail = ref('')

// R399 — the slug round-trips on the continue-URL query (minted by 128-01's
// mintAndSendVolunteerLink). Fallback is 'volunteer-home', the SAME concrete
// route Task 2 makes public and targets from the login entry — NOT the
// superseded 'volunteer-request-generic' placeholder name from RESEARCH.md.
const requestNewLinkTarget = computed(() =>
  typeof route.query.slug === 'string'
    ? { name: 'volunteer-request', params: { slug: route.query.slug } }
    : { name: 'volunteer-home' },
)

async function attemptCompletion(reenteredValue?: string): Promise<void> {
  const success = await volunteerAuth.completeSignIn(window.location.href, reenteredValue)
  if (success) {
    await router.replace({ name: 'my-schedule' })
  }
}

async function handleReentrySubmit(): Promise<void> {
  isSubmittingReentry.value = true
  try {
    await attemptCompletion(reenteredEmail.value)
  } finally {
    isSubmittingReentry.value = false
  }
}

onMounted(async () => {
  try {
    await attemptCompletion()
  } finally {
    isVerifying.value = false
  }
})
</script>
