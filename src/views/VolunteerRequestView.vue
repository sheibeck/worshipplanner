<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
        <p class="text-sm text-gray-400 mt-1">Get your sign-in link</p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">
        <!-- Loading: resolving the slug via the public orgSlugs registry -->
        <div v-if="isLoading" class="flex flex-col items-center gap-3 py-4">
          <svg class="w-6 h-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <p class="text-sm text-gray-400">Loading&hellip;</p>
        </div>

        <!-- Unknown/expired slug — a "not found" state is never a broken page (R394). -->
        <div v-else-if="notFound" class="text-center space-y-3">
          <div class="w-10 h-10 rounded-full bg-red-950 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="text-sm font-medium text-gray-100">We couldn't find that church</h2>
          <p class="text-sm text-gray-400">
            This link may be out of date. Double-check the web address, or ask your church's team leader for
            the correct sign-in link.
          </p>
        </div>

        <!-- Enumeration-safe confirmation (R395) — the IDENTICAL render path on
             resolve, regardless of roster-hit/miss/rate-limited outcome. The
             callable's own resolved message is never read/branched on. -->
        <div v-else-if="submitted" class="text-center space-y-3">
          <div class="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-sm font-medium text-gray-100">Check your email</h2>
          <p class="text-sm text-gray-300">
            If you're on {{ churchName || "this church" }}'s team, a sign-in link is on its way to your inbox.
          </p>
          <p class="text-xs text-gray-500">
            Didn't get it? Check your spam folder, or try again in a few minutes.
          </p>
          <!-- Recovery: a mistyped email lands the volunteer here with no way
               back. Returning to the form (email preserved so a typo is easy to
               fix) leaks nothing — the confirmation above is enumeration-safe
               regardless (R395). -->
          <button
            type="button"
            data-testid="volunteer-request-different-email"
            class="text-sm text-indigo-400 hover:text-indigo-300"
            @click="submitted = false"
          >
            Use a different email
          </button>
        </div>

        <!-- Email request form -->
        <form v-else @submit.prevent="handleSubmit" class="space-y-4">
          <h2 v-if="churchName" class="text-lg font-semibold text-white text-center">{{ churchName }}</h2>
          <p class="text-sm text-gray-400">
            <template v-if="churchName">Enter your email to get a sign-in link for {{ churchName }}.</template>
            <template v-else>Enter your email to get a sign-in link.</template>
          </p>
          <div>
            <label for="volunteer-request-email" class="sr-only">Email</label>
            <input
              id="volunteer-request-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="Email address"
              class="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>
          <p v-if="validationError" class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
            {{ validationError }}
          </p>
          <p v-if="genuineError" class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
            {{ genuineError }}
          </p>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmitting ? 'Sending…' : 'Send my sign-in link' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// VolunteerRequestView (Phase 128, R394/R395/R399) — the public /:slug/volunteer
// self-service request page. Resolves orgId (+ an OPTIONAL denormalized church
// name — see src/utils/slug.ts's claimSlug, which may be absent on slugs
// claimed before this feature shipped) from the public-read orgSlugs/{slug}
// registry (ADR-0007), then calls the requestVolunteerLink callable built in
// 128-01. See .planning/codebase/ARCHITECTURE.md (Views Behavioral Notes
// (R318) § src/views/VolunteerRequestView.vue)
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/firebase'

interface RequestVolunteerLinkRequest {
  orgId: string
  email: string
  slug: string
}
interface RequestVolunteerLinkResponse {
  message: string
}

const route = useRoute()

const isLoading = ref(true)
const notFound = ref(false)
const orgId = ref('')
const churchName = ref('')

const email = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)
const validationError = ref('')
const genuineError = ref('')

/** Mirrors the codebase's established shallow email-format convention (e.g. TeamView.vue). */
function isShallowValidEmail(value: string): boolean {
  return value.includes('@') && value.includes('.')
}

async function handleSubmit(): Promise<void> {
  validationError.value = ''
  genuineError.value = ''
  const trimmed = email.value.trim()
  if (!isShallowValidEmail(trimmed)) {
    validationError.value = 'Enter a valid email address.'
    return
  }

  isSubmitting.value = true
  try {
    await httpsCallable<RequestVolunteerLinkRequest, RequestVolunteerLinkResponse>(
      functions,
      'requestVolunteerLink',
    )({ orgId: orgId.value, email: trimmed, slug: route.params.slug as string })
    // R395: ALWAYS the same confirmation on resolve — the resolved message is
    // intentionally never read or branched on here.
    submitted.value = true
  } catch {
    // The ONE state allowed to differ from the confirmation — a genuine
    // client/transport failure (the callable never returned), never a
    // roster-revealing message.
    genuineError.value = 'Something went wrong. Please try again in a moment.'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  const slug = route.params.slug as string
  try {
    const snap = await getDoc(doc(db, 'orgSlugs', slug))
    if (!snap.exists()) {
      notFound.value = true
    } else {
      const data = snap.data() as { orgId?: string; name?: string }
      if (!data.orgId) {
        notFound.value = true
      } else {
        orgId.value = data.orgId
        churchName.value = data.name ?? ''
      }
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
</script>
