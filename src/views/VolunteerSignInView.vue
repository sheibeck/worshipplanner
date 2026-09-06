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

          <!-- R398 (Phase 128) — "find your church" lookup, the second half
               of the login-page dead-end fix: the login page has no slug in
               context, so it links here; this section resolves a typed
               church name/slug via the SAME public orgSlugs registry
               VolunteerRequestView itself reads (ADR-0007), then navigates
               to the church-scoped request page BY NAME (never a
               string-built path — 128-RESEARCH Pitfall 5). orgSlugs is
               intentionally public-read, so a direct "not found" here is
               fine — this is a public-registry lookup, not a roster check. -->
          <div class="pt-4 border-t border-gray-800 space-y-3">
            <h2 class="text-sm font-medium text-gray-100">Find your church</h2>
            <form @submit.prevent="handleFindChurch" class="space-y-3">
              <div>
                <label for="find-church-input" class="sr-only">Church name or sign-in link</label>
                <input
                  id="find-church-input"
                  v-model="churchInput"
                  type="text"
                  required
                  placeholder="Church name or sign-in link"
                  class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <p v-if="churchMissMessage" class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
                {{ churchMissMessage }}
              </p>
              <button
                type="submit"
                :disabled="isFindingChurch"
                class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isFindingChurch ? 'Searching…' : 'Continue' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
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

const churchInput = ref('')
const churchMissMessage = ref('')
const isFindingChurch = ref(false)

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

/**
 * Normalize a typed church name/slug OR a pasted sign-in link into a
 * candidate orgSlugs doc id: trim/lowercase, and if the input looks like a
 * URL, extract the last path segment (128-RESEARCH's recommended lookup
 * normalization; 128-PATTERNS "Find your church" section).
 */
function normalizeChurchInput(input: string): string {
  let value = input.trim()
  if (value.includes('/')) {
    const segments = value.split('/').filter((segment) => segment.length > 0)
    value = segments[segments.length - 1] ?? value
  }
  return value.trim().toLowerCase()
}

async function handleFindChurch(): Promise<void> {
  churchMissMessage.value = ''
  const candidate = normalizeChurchInput(churchInput.value)
  if (!candidate) {
    churchMissMessage.value = "We couldn't find that church. Check the spelling, or ask your leader for your church's sign-in link."
    return
  }

  isFindingChurch.value = true
  try {
    const snap = await getDoc(doc(db, 'orgSlugs', candidate))
    if (snap.exists()) {
      await router.push({ name: 'volunteer-request', params: { slug: candidate } })
    } else {
      churchMissMessage.value = "We couldn't find that church. Check the spelling, or ask your leader for your church's sign-in link."
    }
  } catch {
    churchMissMessage.value = "We couldn't find that church. Check the spelling, or ask your leader for your church's sign-in link."
  } finally {
    isFindingChurch.value = false
  }
}
</script>
