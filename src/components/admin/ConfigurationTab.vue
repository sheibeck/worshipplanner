<template>
  <!-- Super-admin roster (R179) -->
  <div class="mb-6 rounded-lg bg-gray-900 border border-gray-800 p-4">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Super-admins</h2>
    <p class="text-xs text-gray-500 mb-4">
      Super-admins can access this console on any organization. Grant and revoke here call the
      server-verified setSuperAdminClaim function — no privileged writes ever happen directly
      from this page.
    </p>

    <!-- Grant form -->
    <label for="grant-email" class="text-xs text-gray-400 mb-1 block">Email address</label>
    <div class="flex flex-col sm:flex-row gap-3">
      <input
        id="grant-email"
        v-model="grantEmail"
        type="email"
        placeholder="Enter email address"
        class="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
        @keydown.enter="onGrant"
      />
      <button
        type="button"
        @click="onGrant"
        :disabled="isGranting"
        class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        {{ isGranting ? 'Granting...' : grantedFeedback ? 'Granted!' : 'Grant' }}
      </button>
    </div>
    <p v-if="grantError" class="text-red-400 text-sm mt-2">{{ grantError }}</p>
    <p v-if="grantedFeedback" class="text-green-400 text-sm mt-2">Granted super-admin to {{ grantedFeedback }}!</p>

    <!-- Loading state -->
    <div v-if="!loaded" class="text-sm text-gray-400 py-8 text-center">
      Loading roster...
    </div>

    <!-- Roster table -->
    <div v-else class="mt-4 rounded-lg border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-800/50 border-b border-gray-700">
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Granted</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr v-for="admin in superAdmins" :key="admin.uid" class="hover:bg-gray-800/20 transition-colors">
              <td class="px-4 py-3 text-gray-200">{{ admin.email }}</td>
              <td class="px-4 py-3 text-gray-400 text-sm">{{ formatDate(admin.grantedAt) }}</td>
              <td class="px-4 py-3">
                <!-- Current user: show "You" label — never self-revoke from this row -->
                <span v-if="admin.uid === authStore.user?.uid" class="text-xs text-gray-500 italic">You</span>

                <template v-else>
                  <!-- Inline revoke confirmation -->
                  <template v-if="confirmingRevokeUid === admin.uid">
                    <span class="text-xs text-gray-300 mr-2">Revoke {{ admin.email }}?</span>
                    <button
                      type="button"
                      @click="onConfirmRevoke(admin)"
                      class="text-xs text-red-400 hover:text-red-300 mr-2 transition-colors"
                    >Confirm</button>
                    <button
                      type="button"
                      @click="confirmingRevokeUid = null"
                      class="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >Cancel</button>
                  </template>

                  <template v-else>
                    <button
                      type="button"
                      @click="confirmingRevokeUid = admin.uid"
                      class="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >Revoke</button>
                  </template>
                </template>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-if="superAdmins.length === 0">
              <td colspan="3" class="px-4 py-8 text-center text-sm text-gray-500">
                No super-admins yet. Grant one above.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p v-if="actionError" class="text-red-400 text-sm mt-3">{{ actionError }}</p>
  </div>

  <!-- Platform configuration (R186/R187/R191/R192, Phase 70) — four config
       cards built from Plan 01's store + field components, plus the
       single global provenance stamp and a read-only deploy-time note. -->
  <div class="mt-6">
    <h2 class="text-sm font-semibold text-gray-300">Platform configuration</h2>
    <p v-if="appConfigStore.resolvedConfig.updatedBy" class="text-xs text-gray-500 mt-1 mb-4">
      Last changed by {{ appConfigStore.resolvedConfig.updatedBy }} at
      {{ formatStamp(appConfigStore.resolvedConfig.updatedAt) }}
    </p>

    <div v-if="!appConfigStore.loaded" class="text-sm text-gray-400 py-8 text-center">
      Loading configuration...
    </div>
    <div v-else-if="appConfigStore.loadError" class="text-sm text-red-400 py-8 text-center">
      Couldn't load platform configuration. Refresh the page and try again.
    </div>
    <template v-else>
      <CleanupConfigCard />
      <AiProxyConfigCard />
      <MessagingConfigCard />
      <OnboardingConfigCard />
      <SenderConfigCard />
    </template>

    <div class="rounded-lg bg-gray-900 border border-gray-800 border-dashed p-4 mt-6">
      <h2 class="text-sm font-semibold text-gray-500">Deploy-time settings (requires redeploy)</h2>
      <p class="text-xs text-gray-600 mt-1">
        Function instance limits (AI proxy, global, and render-service concurrency caps) are set
        in deploy-time environment configuration, not here. Changing them requires a redeploy —
        see functions/.env and render-service deploy config.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useAppConfigStore } from '@/stores/appConfig'
import { isPermissionDenied } from '@/utils/firestoreListener'
import CleanupConfigCard from '@/components/admin/CleanupConfigCard.vue'
import AiProxyConfigCard from '@/components/admin/AiProxyConfigCard.vue'
import MessagingConfigCard from '@/components/admin/MessagingConfigCard.vue'
import OnboardingConfigCard from '@/components/admin/OnboardingConfigCard.vue'
import SenderConfigCard from '@/components/admin/SenderConfigCard.vue'

interface SuperAdminEntry {
  uid: string
  email: string
  grantedBy?: string
  grantedAt: { toDate?: () => Date } | null
}

interface SetSuperAdminClaimRequest {
  targetEmail: string
  grant: boolean
}

interface SetSuperAdminClaimResponse {
  ok?: boolean
}

const authStore = useAuthStore()
const appConfigStore = useAppConfigStore()

// ── Data state ─────────────────────────────────────────────────────────────────

const superAdmins = ref<SuperAdminEntry[]>([])
const loaded = ref(false)
let superAdminsUnsub: Unsubscribe | null = null

// ── Grant form state ───────────────────────────────────────────────────────────

const grantEmail = ref('')
const isGranting = ref(false)
const grantError = ref<string | null>(null)
const grantedFeedback = ref<string | null>(null)

// ── Revoke action state ────────────────────────────────────────────────────────

const confirmingRevokeUid = ref<string | null>(null)
const actionError = ref<string | null>(null)

// ── Helpers ────────────────────────────────────────────────────────────────────

function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

function formatDate(ts: { toDate?: () => Date } | null): string {
  if (!ts || !ts.toDate) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Platform configuration provenance stamp (R186, Phase 70) — extends (does
// not replace) the date-only formatDate above with a date+time rendering for
// appConfig/global's updatedAt, which may arrive as either a Firestore
// Timestamp (has .toDate()) or a plain Date (e.g. a test's serverTimestamp
// mock, or an emulator round-trip before the SDK converts it).
function formatStamp(ts: unknown): string {
  let date: Date | null = null
  if (ts instanceof Date) {
    date = ts
  } else if (ts && typeof ts === 'object' && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate()
  }
  if (!date) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// R179 — the ONLY path this view ever uses to change super-admin status. The
// setSuperAdminClaim onCall independently re-verifies the caller is already a
// super-admin server-side and performs the superAdmins/* write itself; this
// client NEVER calls setDoc/deleteDoc against superAdmins/* directly (that
// write is also rules-gated to isSuperAdmin() regardless — Plan 03).
function callSetSuperAdminClaim(targetEmail: string, grant: boolean) {
  const setSuperAdminClaim = httpsCallable<SetSuperAdminClaimRequest, SetSuperAdminClaimResponse>(
    functions,
    'setSuperAdminClaim',
  )
  return setSuperAdminClaim({ targetEmail, grant })
}

function friendlyCallableError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) {
    return 'You do not have permission to perform this action.'
  }
  if (code.includes('not-found')) {
    return 'No user was found with that email address.'
  }
  const message = (err as { message?: string })?.message
  return message || 'Something went wrong. Please try again.'
}

// ── Grant action ───────────────────────────────────────────────────────────────

async function onGrant() {
  grantError.value = null
  const email = grantEmail.value.trim()

  if (!email || !isValidEmailFormat(email)) {
    grantError.value = 'Enter a valid email address'
    return
  }

  const normalized = email.toLowerCase()

  isGranting.value = true
  try {
    await callSetSuperAdminClaim(normalized, true)
    grantedFeedback.value = normalized
    grantEmail.value = ''

    // Clear success feedback after 2 seconds
    setTimeout(() => {
      grantedFeedback.value = null
    }, 2000)
  } catch (err) {
    console.error('[ConfigurationTab] grant error:', err)
    grantError.value = friendlyCallableError(err)
  } finally {
    isGranting.value = false
  }
}

// ── Revoke action ──────────────────────────────────────────────────────────────

async function onConfirmRevoke(admin: SuperAdminEntry) {
  actionError.value = null
  try {
    await callSetSuperAdminClaim(admin.email, false)
    confirmingRevokeUid.value = null
  } catch (err) {
    console.error('[ConfigurationTab] revoke error:', err)
    actionError.value = friendlyCallableError(err)
    confirmingRevokeUid.value = null
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  // Rules-gated (Plan 03's isSuperAdmin() rule) — a non-super-admin session
  // cannot subscribe successfully even if it somehow reached this view.
  superAdminsUnsub = onSnapshot(
    collection(db, 'superAdmins'),
    (snap) => {
      superAdmins.value = snap.docs.map((d) => ({
        uid: d.id,
        ...(d.data() as Omit<SuperAdminEntry, 'uid'>),
      }))
      loaded.value = true
    },
    (err) => {
      // Bug 2b (quick 260830-l9c) — a super-admin's own logout can hit this
      // handler with a benign permission-denied once the token is revoked;
      // suppress ONLY the console.error for that code, state-setting below
      // stays unchanged for a genuine error.
      if (!isPermissionDenied(err)) {
        console.error('[ConfigurationTab] roster subscription error:', err)
      }
      loaded.value = true
    },
  )

  // Platform configuration (Phase 70) — separate subscription, does not
  // disturb the roster subscription above.
  appConfigStore.subscribe()
})

onUnmounted(() => {
  superAdminsUnsub?.()
  appConfigStore.unsubscribe()
})
</script>
