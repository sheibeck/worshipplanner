<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Organizations</h2>

    <!-- Onboard form -->
    <div class="flex flex-col sm:flex-row gap-3">
      <input
        v-model="churchName"
        type="text"
        placeholder="Church name"
        class="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
      />
      <input
        v-model="adminEmail"
        type="email"
        placeholder="First admin email"
        class="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
        @keydown.enter="onOnboard"
      />
      <button
        type="button"
        @click="onOnboard"
        :disabled="isOnboarding"
        class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        {{ isOnboarding ? 'Onboarding...' : onboardedFeedback ? 'Onboarded!' : 'Onboard church' }}
      </button>
    </div>
    <p v-if="onboardError" class="text-red-400 text-sm mt-2">{{ onboardError }}</p>
    <p v-if="onboardedFeedback" class="text-green-400 text-sm mt-2">
      Onboarded {{ onboardedFeedback.name }} — admin {{ onboardedFeedback.status }}.
    </p>

    <!-- R220 (Phase 77) — page-level success banner after a successful
         delete: the row is gone from the list, so there is no per-row spot
         left to attach this feedback to (unlike Deactivate/Reactivate/Assign). -->
    <p v-if="deleteFeedback" class="text-green-400 text-sm mt-2">{{ deleteFeedback }}</p>

    <!-- Loading state -->
    <div v-if="!loaded" class="text-sm text-gray-400 py-8 text-center">
      Loading organizations...
    </div>

    <!-- Organizations table -->
    <div v-else class="mt-4 rounded-lg border border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-800/50 border-b border-gray-700">
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Church</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Org ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Members</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr v-for="org in orgs" :key="org.orgId" class="hover:bg-gray-800/20 transition-colors">
              <td class="px-4 py-3 text-gray-200">
                {{ org.name }}
                <span
                  v-if="org.active === false"
                  class="ml-1 inline-flex items-center rounded-full bg-red-900/40 text-red-300 border border-red-800/50 px-1.5 py-0.5 text-xs font-medium"
                >
                  Deactivated
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-xs font-mono">{{ org.orgId }}</td>
              <td class="px-4 py-3 text-gray-400 text-sm">{{ formatDate(org.createdAt) }}</td>
              <td class="px-4 py-3 text-gray-400 text-sm">
                {{ org.memberCount }}
                <span
                  v-if="org.pendingCount > 0"
                  class="ml-1 inline-flex items-center rounded-full bg-amber-900/40 text-amber-300 border border-amber-800/50 px-1.5 py-0.5 text-xs font-medium"
                >
                  {{ org.pendingCount }} pending
                </span>
              </td>
              <td class="px-4 py-3 align-top">
                <!-- Assign-admin inline form (this row only). -->
                <div
                  v-if="assigningOrgId === org.orgId"
                  class="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    v-model="assignEmail"
                    type="email"
                    placeholder="Admin email"
                    class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-2 py-1.5 text-xs w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                    @keydown.enter="onConfirmAssign(org)"
                  />
                  <div class="flex gap-2">
                    <button
                      type="button"
                      @click="onConfirmAssign(org)"
                      :disabled="isAssigning"
                      class="inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                    >
                      {{ isAssigning ? 'Assigning...' : 'Assign' }}
                    </button>
                    <button
                      type="button"
                      @click="cancelAssign"
                      class="inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                    >
                      Cancel assign
                    </button>
                  </div>
                </div>

                <!-- Row actions — side by side on >= sm, stacked only on mobile.
                     Consistent with the app's button family (bg-gray-800
                     secondary / bg-indigo-600 primary / bg-red-600 destructive).
                     Delete (Phase 77) is RENDERED only for an already-deactivated
                     org. All state changes go through the callables — no direct
                     Firestore writes. -->
                <div
                  v-else
                  class="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    @click="startAssign(org.orgId)"
                    class="inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    Assign admin
                  </button>
                  <button
                    type="button"
                    @click="onToggleActive(org)"
                    :disabled="togglingOrgId !== null"
                    class="inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    {{
                      togglingOrgId === org.orgId
                        ? org.active
                          ? 'Deactivating...'
                          : 'Reactivating...'
                        : org.active
                          ? 'Deactivate'
                          : 'Reactivate'
                    }}
                  </button>
                  <button
                    type="button"
                    @click="onEnterChurch(org)"
                    :disabled="enteringOrgId !== null"
                    class="inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    {{ enteringOrgId === org.orgId ? 'Entering...' : 'Enter church' }}
                  </button>
                  <button
                    v-if="org.active === false"
                    type="button"
                    @click="openDeleteDialog(org)"
                    class="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    Delete
                  </button>
                </div>

                <!-- Per-row feedback / errors (below the button row). -->
                <p v-if="assignError[org.orgId]" class="text-red-400 text-xs mt-1">{{ assignError[org.orgId] }}</p>
                <p v-if="assignFeedback[org.orgId]" class="text-green-400 text-xs mt-1">{{ assignFeedback[org.orgId] }}</p>
                <p v-if="toggleError[org.orgId]" class="text-red-400 text-xs mt-1">{{ toggleError[org.orgId] }}</p>
                <p
                  v-if="toggleFeedback[org.orgId]"
                  :class="toggleFeedbackIsWarning[org.orgId] ? 'text-amber-400' : 'text-green-400'"
                  class="text-xs mt-1"
                >
                  {{ toggleFeedback[org.orgId] }}
                </p>
                <p v-if="enterError[org.orgId]" class="text-red-400 text-xs mt-1">{{ enterError[org.orgId] }}</p>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-if="orgs.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">
                No organizations yet. Onboard one above.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p v-if="listError" class="text-red-400 text-sm mt-3">
      Couldn't load organizations. Refresh the page and try again.
    </p>

    <!-- R220 (Phase 77) — rendered once at the component root (outside the
         v-for), Teleported to body regardless of table position. -->
    <DeleteOrgConfirmDialog
      :open="!!deleteDialogOrg"
      :org-name="deleteDialogOrg?.name ?? ''"
      :member-count="deleteDialogOrg?.memberCount ?? 0"
      :pending-count="deleteDialogOrg?.pendingCount ?? 0"
      :confirming="isDeleting"
      :confirm-error="deleteDialogError"
      @confirm="onConfirmDelete"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import DeleteOrgConfirmDialog from './DeleteOrgConfirmDialog.vue'

// R224 (Phase 78) — useRouter() returns undefined in this file's existing
// router-less mount harness (OrganizationsTab.test.ts mounts with no
// global.plugins router). Guard every use with router?., mirroring
// OwnerConsoleView.vue's own established router?.replace(...) pattern.
const router = useRouter()
const authStore = useAuthStore()

// ── Types ──────────────────────────────────────────────────────────────────
// Mirrors functions/src/orgProvisioning.ts's OrgSummary/ListOrganizationsResponse
// and OnboardOrganization/AssignOrgAdmin request/response shapes (Plan 01).

interface OrgSummary {
  orgId: string
  name: string
  createdAt: unknown
  memberCount: number
  pendingCount: number
  active: boolean
}

// R212/R214 (Phase 76) — mirrors functions/src/orgProvisioning.ts's
// setOrgActiveHandler request/response contract exactly.
interface SetOrgActiveRequest {
  orgId: string
  active: boolean
}

interface SetOrgActiveResponse {
  orgId: string
  active: boolean
  memberCount: number
  claimFailures: number
  revokeFailures: number
}

interface ListOrganizationsResponse {
  organizations: OrgSummary[]
}

interface OnboardOrganizationRequest {
  name: string
  adminEmail: string
}

interface OnboardOrganizationResponse {
  status: 'added' | 'invited'
  orgId: string
  name: string
}

interface AssignOrgAdminRequest {
  orgId: string
  email: string
}

interface AssignOrgAdminResponse {
  status: 'added' | 'invited'
  uid?: string
}

// R220/R221 (Phase 77) — mirrors functions/src/orgDeletion.ts's
// deleteOrganizationHandler request/response contract exactly.
interface DeleteOrganizationRequest {
  orgId: string
  confirmName: string
}

interface DeleteOrganizationResponse {
  orgId: string
  name: string
  membersUnlinked: number
  invitesDeleted: number
  orgNameDeleted: boolean
  shareDocsDeleted: number
  storageObjectsDeleted: number
}

// ── List state (R196) ─────────────────────────────────────────────────────

const orgs = ref<OrgSummary[]>([])
const loaded = ref(false)
const listError = ref<string | null>(null)

// ── Onboard form state (R197/R201/R202) ───────────────────────────────────

const churchName = ref('')
const adminEmail = ref('')
const isOnboarding = ref(false)
const onboardError = ref<string | null>(null)
const onboardedFeedback = ref<{ name: string; status: 'added' | 'invited' } | null>(null)

// ── Assign-admin state (R203/R205), keyed per orgId ───────────────────────

const assigningOrgId = ref<string | null>(null)
const assignEmail = ref('')
const isAssigning = ref(false)
const assignError = ref<Record<string, string>>({})
const assignFeedback = ref<Record<string, string>>({})

// ── Deactivate/Reactivate state (R212/R214), keyed per orgId ──────────────

const togglingOrgId = ref<string | null>(null)
const toggleError = ref<Record<string, string>>({})
const toggleFeedback = ref<Record<string, string>>({})
// WR-01 (76-REVIEW.md): tracks whether a given org's current toggleFeedback
// message is a partial-failure warning (claimFailures > 0) rather than a
// clean success, so the template can style it distinctly (amber, not green).
const toggleFeedbackIsWarning = ref<Record<string, boolean>>({})

// ── Delete state (R220/R221) ──────────────────────────────────────────────
// deleteDialogOrg doubles as the dialog's `open` flag via
// `!!deleteDialogOrg.value` -- the row currently targeted for deletion.
const deleteDialogOrg = ref<OrgSummary | null>(null)
const isDeleting = ref(false)
const deleteDialogError = ref<string | null>(null)
// Page-level success banner: the row is gone from the list after a
// successful delete, so there is no row left to attach per-row feedback to
// (unlike Deactivate/Reactivate/Assign).
const deleteFeedback = ref<string | null>(null)

// ── Helpers ────────────────────────────────────────────────────────────────
// Copied from ConfigurationTab.vue verbatim (Plan 74-02 instructions).

function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

function toDate(ts: unknown): Date | null {
  if (!ts) return null
  // Client Firestore Timestamp (has toDate()).
  const withToDate = ts as { toDate?: () => Date }
  if (typeof withToDate.toDate === 'function') return withToDate.toDate()
  // Admin Timestamp serialized over the callable wire: { _seconds } or { seconds }.
  const secs =
    (ts as { _seconds?: number })._seconds ?? (ts as { seconds?: number }).seconds ?? null
  if (typeof secs === 'number') return new Date(secs * 1000)
  // Epoch millis or an ISO string.
  if (typeof ts === 'number') return new Date(ts)
  if (typeof ts === 'string') return new Date(ts)
  return null
}

function formatDate(ts: unknown): string {
  const d = toDate(ts)
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Extended with an already-exists branch (R201) beyond ConfigurationTab's
// original permission-denied/not-found mapping. R220 (Phase 77) added
// failed-precondition (not deactivated) and invalid-argument (name mismatch
// or blank input) branches for deleteOrganization's error codes.
function friendlyCallableError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('already-exists')) {
    return 'That church name is taken.'
  }
  if (code.includes('failed-precondition')) {
    return 'Deactivate the church first.'
  }
  if (code.includes('invalid-argument')) {
    return "The name doesn't match."
  }
  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'You do not have permission to perform this action.'
  }
  if (code.includes('not-found')) {
    return 'No organization was found.'
  }
  const message = (err as { message?: string })?.message
  return message || 'Something went wrong. Please try again.'
}

// ── List loading (R196) ───────────────────────────────────────────────────
// Pure httpsCallable consumer -- this component imports NO firestore write
// helpers and never writes organizations/orgNames/members directly
// (R200/R204, T-74-07).

async function refreshOrgs() {
  try {
    const listOrganizations = httpsCallable<void, ListOrganizationsResponse>(
      functions,
      'listOrganizations',
    )
    const result = await listOrganizations()
    orgs.value = result.data.organizations
    listError.value = null
  } catch (err) {
    console.error('[OrganizationsTab] listOrganizations error:', err)
    listError.value = 'Couldn\'t load organizations. Refresh the page and try again.'
  } finally {
    loaded.value = true
  }
}

// ── Onboard action (R197/R201/R202) ───────────────────────────────────────

async function onOnboard() {
  // WR-03: the Enter-key handler on the admin-email input isn't gated by
  // :disabled the way the submit button is, so a fast double-Enter could
  // double-submit while a prior onboard call is still in flight. Guard here
  // (shared by both the click and keydown.enter triggers) to match the
  // button's :disabled="isOnboarding".
  if (isOnboarding.value) return

  onboardError.value = null
  const name = churchName.value.trim()
  const email = adminEmail.value.trim()

  if (!name || !isValidEmailFormat(email)) {
    onboardError.value = 'Enter a church name and a valid admin email address.'
    return
  }

  isOnboarding.value = true
  try {
    const onboardOrganization = httpsCallable<OnboardOrganizationRequest, OnboardOrganizationResponse>(
      functions,
      'onboardOrganization',
    )
    const result = await onboardOrganization({ name, adminEmail: email })
    onboardedFeedback.value = { name, status: result.data.status }
    churchName.value = ''
    adminEmail.value = ''
    await refreshOrgs()

    // Clear success feedback after 2 seconds (mirrors ConfigurationTab's
    // Grant/Granted! recipe).
    setTimeout(() => {
      onboardedFeedback.value = null
    }, 2000)
  } catch (err) {
    console.error('[OrganizationsTab] onboardOrganization error:', err)
    onboardError.value = friendlyCallableError(err)
  } finally {
    isOnboarding.value = false
  }
}

// ── Assign-admin action (R203/R205) ───────────────────────────────────────

function startAssign(orgId: string) {
  assigningOrgId.value = orgId
  assignEmail.value = ''
  delete assignError.value[orgId]
  delete assignFeedback.value[orgId]
}

function cancelAssign() {
  assigningOrgId.value = null
  assignEmail.value = ''
}

async function onConfirmAssign(org: OrgSummary) {
  // WR-03: same double-Enter guard as onOnboard -- the row's Enter-key
  // handler isn't gated by :disabled the way the Assign button is.
  if (isAssigning.value) return

  const orgId = org.orgId
  delete assignError.value[orgId]

  const email = assignEmail.value.trim()
  if (!isValidEmailFormat(email)) {
    assignError.value = { ...assignError.value, [orgId]: 'Enter a valid email address.' }
    return
  }

  isAssigning.value = true
  try {
    const assignOrgAdmin = httpsCallable<AssignOrgAdminRequest, AssignOrgAdminResponse>(
      functions,
      'assignOrgAdmin',
    )
    const result = await assignOrgAdmin({ orgId, email })
    // Clear the just-submitted email so the row doesn't sit with a stale value,
    // and surface the success message; mirror the onboard form's 2s auto-dismiss.
    assignEmail.value = ''
    assignFeedback.value = {
      ...assignFeedback.value,
      [orgId]: result.data.status === 'added' ? 'Added as admin.' : 'No account yet — invited as admin.',
    }
    await refreshOrgs()
    setTimeout(() => {
      // Collapse the row and drop its feedback — guard against the user having
      // meanwhile opened a different row's assign control.
      if (assigningOrgId.value === orgId) assigningOrgId.value = null
      const { [orgId]: _removed, ...rest } = assignFeedback.value
      assignFeedback.value = rest
    }, 2000)
  } catch (err) {
    console.error('[OrganizationsTab] assignOrgAdmin error:', err)
    assignError.value = { ...assignError.value, [orgId]: friendlyCallableError(err) }
  } finally {
    isAssigning.value = false
  }
}

// ── Deactivate/Reactivate action (R212/R214) ──────────────────────────────
// Pure httpsCallable consumer — this component writes NO organizations
// document directly (T-74-07); setOrgActive is the only channel.

async function onToggleActive(org: OrgSummary) {
  // WR-03: same double-submit guard shape as isOnboarding/isAssigning above.
  if (togglingOrgId.value) return

  const orgId = org.orgId
  const nextActive = !org.active
  togglingOrgId.value = orgId
  delete toggleError.value[orgId]
  try {
    const setOrgActive = httpsCallable<SetOrgActiveRequest, SetOrgActiveResponse>(
      functions,
      'setOrgActive',
    )
    const result = await setOrgActive({ orgId, active: nextActive })
    // WR-01 (76-REVIEW.md): claimFailures is the resilience signal
    // 76-RESEARCH.md's Pitfall 4 designs around ("calling setOrgActive again
    // is a safe, idempotent retry") -- previously dropped on the floor, so an
    // operator had no way to know Storage enforcement never reached anyone.
    // Surface it as a non-blocking warning instead of an unqualified success.
    const claimFailures = result.data.claimFailures
    const verb = nextActive ? 'Reactivated' : 'Deactivated'
    const hasFailures = claimFailures > 0
    toggleFeedback.value = {
      ...toggleFeedback.value,
      [orgId]: hasFailures
        ? `${verb}, but ${claimFailures} member claim update${claimFailures === 1 ? '' : 's'} failed — click again to retry.`
        : `${verb}.`,
    }
    toggleFeedbackIsWarning.value = { ...toggleFeedbackIsWarning.value, [orgId]: hasFailures }
    await refreshOrgs()
    // Clear feedback after a delay (mirrors onboard/assign's 2s auto-dismiss)
    // -- a failure warning gets longer on-screen time since it demands a
    // follow-up action (retry) rather than just confirming success.
    setTimeout(
      () => {
        const { [orgId]: _removed, ...rest } = toggleFeedback.value
        toggleFeedback.value = rest
        const { [orgId]: _removedWarning, ...restWarning } = toggleFeedbackIsWarning.value
        toggleFeedbackIsWarning.value = restWarning
      },
      hasFailures ? 8000 : 2000,
    )
  } catch (err) {
    console.error('[OrganizationsTab] setOrgActive error:', err)
    toggleError.value = { ...toggleError.value, [orgId]: friendlyCallableError(err) }
  } finally {
    togglingOrgId.value = null
  }
}

// ── Delete action (R220/R221) ─────────────────────────────────────────────
// Pure httpsCallable consumer — this component never writes organizations/*,
// orgNames/*, or inviteLookup/* directly; deleteOrganization is the only
// channel (mirrors T-74-07/T-77-09).

function openDeleteDialog(org: OrgSummary) {
  deleteDialogOrg.value = org
  deleteDialogError.value = null
}

function closeDeleteDialog() {
  // Never closable mid-request, mirrors CleanupEnableConfirmDialog's
  // in-flight guard.
  if (isDeleting.value) return
  deleteDialogOrg.value = null
}

async function onConfirmDelete(typedName: string) {
  if (isDeleting.value || !deleteDialogOrg.value) return

  const orgId = deleteDialogOrg.value.orgId
  isDeleting.value = true
  deleteDialogError.value = null
  try {
    const deleteOrganization = httpsCallable<DeleteOrganizationRequest, DeleteOrganizationResponse>(
      functions,
      'deleteOrganization',
    )
    const result = await deleteOrganization({ orgId, confirmName: typedName })
    deleteFeedback.value = `Deleted ${result.data.name} — ${result.data.membersUnlinked} member(s) unlinked, ${result.data.invitesDeleted} invite(s) removed, ${result.data.storageObjectsDeleted} file(s) removed.`
    deleteDialogOrg.value = null
    await refreshOrgs()

    // Auto-clear after 5s -- longer than the 2s onboard/assign pattern,
    // since this is a bigger deal to read.
    setTimeout(() => {
      deleteFeedback.value = null
    }, 5000)
  } catch (err) {
    console.error('[OrganizationsTab] deleteOrganization error:', err)
    // Keep the dialog open on failure so the user sees the error inline and
    // can retry or cancel -- do NOT clear deleteDialogOrg.value here.
    deleteDialogError.value = friendlyCallableError(err)
  } finally {
    isDeleting.value = false
  }
}

// ── Enter-church action (R224) ────────────────────────────────────────────
// Pure authStore consumer -- no direct Firestore reads/writes here; all
// authorization lives in enterOrgAsSuperAdmin (auth.ts) + firestore.rules'
// super-admin arm (78-01-PLAN.md). Not gated on org.active -- entering a
// deactivated org is an explicit, intended support scenario.

// WR-02 (78-REVIEW.md): mirrors this file's other row-action in-flight
// guards (isOnboarding/isAssigning/togglingOrgId/isDeleting) -- previously
// this button had no double-submit guard at all, so a rapid double-click
// (or two different rows in quick succession) could fire two overlapping
// enterOrgAsSuperAdmin calls that interleave.
const enteringOrgId = ref<string | null>(null)
// WR-03 (78-REVIEW.md), keyed per orgId to match this file's other
// per-row error state (assignError/toggleError).
const enterError = ref<Record<string, string>>({})

async function onEnterChurch(org: OrgSummary): Promise<void> {
  if (enteringOrgId.value !== null) return

  const orgId = org.orgId
  enteringOrgId.value = orgId
  delete enterError.value[orgId]
  try {
    // WR-03 (78-REVIEW.md): enterOrgAsSuperAdmin now signals success/failure
    // instead of silently no-oping (not a super-admin, denied/errored read,
    // or a stale/missing org doc). Only navigate on a genuine entry --
    // otherwise the super-admin was previously bounced to /select-church by
    // the router's org-selection gate with zero explanation.
    const entered = await authStore.enterOrgAsSuperAdmin(orgId)
    if (!entered) {
      enterError.value = {
        ...enterError.value,
        [orgId]: "Couldn't enter this church. Refresh and try again.",
      }
      return
    }
    // 'services' has no requiresEditor gate (unlike 'dashboard'), so it is
    // the safer universal landing route regardless of the forced 'editor'
    // role.
    router?.push({ name: 'services' })
  } finally {
    enteringOrgId.value = null
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  refreshOrgs()
})
</script>
