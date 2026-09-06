<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
        <p class="text-sm text-gray-400 mt-1">Volunteer sign-in</p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">
        <!-- Already signed in: this page has nothing useful to add — the real
             home is My Schedule (which carries the sign-out in the sidebar and
             the empty/populated states). Redirect there; show a brief holding
             line in the tick before the redirect lands. -->
        <p v-if="authStore.isAuthenticated" class="text-sm text-gray-400">
          Taking you to your schedule&hellip;
        </p>

        <!-- Not signed in: this device has no active volunteer session. -->
        <div v-else class="space-y-4">
          <p class="text-sm text-gray-400">
            Open the sign-in link from your reminder email on this device to continue.
          </p>

          <div v-if="!showReentry">
            <button
              type="button"
              @click="showReentry = true"
              class="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Already clicked the link but weren't recognized?
            </button>
          </div>

          <!-- Cross-device help: pre-storing the email here means a link opened
               on THIS device next will find it in localStorage and skip the
               verify page's re-entry prompt. Never a functional sign-in on its
               own — completion only ever happens via the real link's oobCode
               at /volunteer/verify. -->
          <form v-else @submit.prevent="handleRememberEmail" class="space-y-3">
            <p class="text-xs text-gray-500">
              Enter the email your reminder was sent to, then open the link from that email on this device.
            </p>
            <div>
              <label for="remember-email" class="sr-only">Email</label>
              <input
                id="remember-email"
                v-model="rememberEmail"
                type="email"
                autocomplete="email"
                required
                placeholder="Email address"
                class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <p v-if="rememberedConfirmation" class="text-sm text-green-400">{{ rememberedConfirmation }}</p>
            <button
              type="submit"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
            >
              Remember this email on this device
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Same key volunteerAuth.ts reads at completion time — pre-storing it here
// (before the volunteer opens the emailed link on this device) lets the
// verify page's stored-email lookup succeed on the first try instead of
// falling into the needsEmailReentry prompt.
const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn'

const router = useRouter()
const authStore = useAuthStore()

const showReentry = ref(false)
const rememberEmail = ref('')
const rememberedConfirmation = ref('')

// A signed-in volunteer has nothing to do on this landing page — send them to
// their schedule (its sidebar carries sign-out). immediate so a direct hit on
// /volunteer while already signed in bounces straight through.
watch(
  () => authStore.isAuthenticated,
  (signedIn) => {
    if (signedIn) router.replace({ name: 'my-schedule' })
  },
  { immediate: true },
)

function handleRememberEmail(): void {
  // WR-03 (125-REVIEW.md): normalize to lowercase, matching every other
  // email-claim comparison in this feature (invites/{email},
  // rehearseAccess's assignedEmailsLower).
  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, rememberEmail.value.trim().toLowerCase())
  rememberedConfirmation.value = 'Got it — now open the link from your email on this device.'
}
</script>
