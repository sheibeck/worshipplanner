<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
    <h2 class="text-sm font-semibold text-gray-300 mb-3">Organizations</h2>

    <!-- Onboard form -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="flex-1">
        <label for="onboard-church-name" class="text-xs text-gray-400 mb-1 block">Church name</label>
        <input
          id="onboard-church-name"
          v-model="churchName"
          type="text"
          placeholder="Church name"
          class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
        />
      </div>
      <div class="flex-1">
        <label for="onboard-admin-email" class="text-xs text-gray-400 mb-1 block">First admin email</label>
        <input
          id="onboard-admin-email"
          v-model="adminEmail"
          type="email"
          placeholder="First admin email"
          class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
          @keydown.enter="onOnboard"
        />
      </div>
      <button
        type="button"
        @click="onOnboard"
        :disabled="isOnboarding"
        class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors sm:self-end"
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
              <!-- Trailing chevron column (owner UX follow-up, 260824): mirrors
                   SongTable.vue's row-open pattern -- the row is data-only, and
                   every per-org action (Assign admin, Enter church, AI,
                   Deactivate/Reactivate, Delete) now lives exclusively in the
                   OrgConfigDrawer slideout opened by this chevron OR by
                   clicking anywhere else on the row. -->
              <th class="px-4 py-3 w-8"><span class="sr-only">Configure</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <tr
              v-for="org in orgs"
              :key="org.orgId"
              class="cursor-pointer hover:bg-gray-800/20 transition-colors"
              @click="configOrgId = org.orgId"
            >
              <td class="px-4 py-3 text-gray-200">
                {{ org.name }}
                <span
                  v-if="org.active === false"
                  class="ml-1 inline-flex items-center rounded-full bg-red-900/40 text-red-300 border border-red-800/50 px-1.5 py-0.5 text-xs font-medium"
                >
                  Deactivated
                </span>
                <!-- Phase 101 (R301) — per-row at-a-glance Bible API state.
                     Reuses the established "on" badge palette (indigo, same
                     shape as the Deactivated/pending badges above); default-
                     OFF orgs render no badge, matching how absent
                     aiMasterEnabled shows nothing. -->
                <span
                  v-if="org.bibleApiEnabled"
                  class="ml-1 inline-flex items-center rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 text-xs font-medium"
                >
                  Bible API
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
              <!-- Trailing chevron (opens the configure drawer for this org).
                   @click.stop avoids a double-trigger with the row's own
                   @click (harmless either way since both set the same id). -->
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  :aria-label="`Configure ${org.name}`"
                  @click.stop="configOrgId = org.orgId"
                  class="inline-flex items-center justify-center text-gray-500 hover:text-gray-300 p-1 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
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

    <!-- Quick task 260824 — rendered once at the component root (outside the
         v-for). `configOrg` is a COMPUTED lookup into `orgs.value` by id (not
         a captured snapshot), so the open drawer reflects post-refreshOrgs()
         state without needing to be reopened. Declared BEFORE the
         Delete/Deactivate confirm dialogs below so those Teleported dialogs
         stack visually on top of an open drawer (matches the established
         Deactivate-over-drawer order). -->
    <OrgConfigDrawer
      :org="configOrg"
      :ai-toggling="togglingAiOrgId === configOrg?.orgId"
      :ai-error="configOrg ? (aiToggleError[configOrg.orgId] ?? null) : null"
      :bible-toggling="togglingBibleOrgId === configOrg?.orgId"
      :bible-error="configOrg ? (bibleToggleError[configOrg.orgId] ?? null) : null"
      :active-toggling="togglingOrgId === configOrg?.orgId"
      :active-error="configOrg ? (toggleError[configOrg.orgId] ?? null) : null"
      :active-feedback="configOrg ? (toggleFeedback[configOrg.orgId] ?? null) : null"
      :active-feedback-is-warning="configOrg ? !!toggleFeedbackIsWarning[configOrg.orgId] : false"
      :assigning="assigningOrgId === configOrg?.orgId"
      :assign-email="assignEmail"
      :is-assigning="isAssigning"
      :assign-error="configOrg ? (assignError[configOrg.orgId] ?? null) : null"
      :assign-feedback="configOrg ? (assignFeedback[configOrg.orgId] ?? null) : null"
      :entering="enteringOrgId === configOrg?.orgId"
      :enter-disabled="enteringOrgId !== null"
      :enter-error="configOrg ? (enterError[configOrg.orgId] ?? null) : null"
      @close="onCloseDrawer"
      @toggle-ai="() => configOrg && onToggleAi(configOrg)"
      @toggle-bible="() => configOrg && onToggleBible(configOrg)"
      @reactivate="() => configOrg && onToggleActive(configOrg)"
      @request-deactivate="deactivateDialogOrg = configOrg"
      @request-delete="() => configOrg && openDeleteDialog(configOrg)"
      @start-assign="() => configOrg && startAssign(configOrg.orgId)"
      @cancel-assign="cancelAssign"
      @update:assign-email="assignEmail = $event"
      @confirm-assign="() => configOrg && onConfirmAssign(configOrg)"
      @enter-church="() => configOrg && onEnterChurch(configOrg)"
    />

    <!-- R220 (Phase 77) — rendered once at the component root, Teleported to
         body regardless of table position. Owner testing follow-up: Delete
         now opens exclusively from the drawer's request-delete emit above
         (deactivated-only), reusing openDeleteDialog/onConfirmDelete
         unchanged. -->
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

    <!-- Quick task 260824 — deactivate confirmation, gated in front of
         onToggleActive(org) whenever the drawer's Active button is clicked
         while the org is active. Reactivate applies directly (no dialog). -->
    <DeactivateOrgConfirmDialog
      :open="!!deactivateDialogOrg"
      :org-name="deactivateDialogOrg?.name ?? ''"
      :member-count="deactivateDialogOrg?.memberCount ?? 0"
      :confirming="togglingOrgId === deactivateDialogOrg?.orgId"
      :confirm-error="deactivateDialogOrg ? (toggleError[deactivateDialogOrg.orgId] ?? null) : null"
      @confirm="onConfirmDeactivate"
      @cancel="closeDeactivateDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import DeleteOrgConfirmDialog from './DeleteOrgConfirmDialog.vue'
import OrgConfigDrawer from './OrgConfigDrawer.vue'
import DeactivateOrgConfirmDialog from './DeactivateOrgConfirmDialog.vue'

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
  // Phase 82 (R242) — mirrors the server OrgSummary's new field
  // (functions/src/orgProvisioning.ts's listOrganizationsHandler, Plan 01).
  // Optional/absent reads as OFF, matching the org doc's own
  // aiMasterEnabled?: boolean default (src/types/organization.ts).
  aiMasterEnabled?: boolean
  // Phase 101 (R295) — mirrors the server OrgSummary's new field
  // (functions/src/orgProvisioning.ts's listOrganizationsHandler, Plan 01).
  // Optional/absent reads as OFF, matching the org doc's own
  // bibleApiEnabled?: boolean default (src/types/organization.ts).
  bibleApiEnabled?: boolean
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

// Phase 82 (R242) — mirrors functions/src/orgProvisioning.ts's
// setOrgAiEnabledHandler request/response contract exactly (Plan 01). The
// callable ships UNDEPLOYED with Plan 01 (client-only this plan); tests mock
// httpsCallable, so an undeployed target does not block this plan.
interface SetOrgAiEnabledRequest {
  orgId: string
  aiEnabled: boolean
}

interface SetOrgAiEnabledResponse {
  orgId: string
  aiEnabled: boolean
}

// Phase 101 (R295) — mirrors functions/src/orgProvisioning.ts's
// setOrgBibleEnabledHandler request/response contract exactly (Plan 01).
// The callable field is `enabled` (not `bibleEnabled`), the agreed
// cross-plan contract.
interface SetOrgBibleEnabledRequest {
  orgId: string
  enabled: boolean
}

interface SetOrgBibleEnabledResponse {
  orgId: string
  enabled: boolean
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

// ── AI on/off toggle state (R242), keyed per orgId — mirrors the
// Deactivate/Reactivate state block above exactly. ──
const togglingAiOrgId = ref<string | null>(null)
const aiToggleError = ref<Record<string, string>>({})

// ── Bible API on/off toggle state (Phase 101, R295), keyed per orgId —
// mirrors the AI on/off toggle state block immediately above. ──
const togglingBibleOrgId = ref<string | null>(null)
const bibleToggleError = ref<Record<string, string>>({})

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

// ── Configure drawer state (quick task 260824) ────────────────────────────
// configOrgId doubles as the drawer's open flag; configOrg is a COMPUTED
// lookup into orgs.value by id (never a captured snapshot) so the open
// drawer reflects post-refreshOrgs() state without needing to be reopened
// (this plan's key_links).
const configOrgId = ref<string | null>(null)
const configOrg = computed(() => orgs.value.find((o) => o.orgId === configOrgId.value) ?? null)

// Owner UX follow-up (260824): Assign admin now lives inside the drawer
// instead of the row, so closing the drawer must also collapse an
// in-progress assign form -- otherwise reopening the drawer (even for a
// different org) would show a stale expanded email input from whichever
// org was last being assigned.
function onCloseDrawer() {
  configOrgId.value = null
  cancelAssign()
}

// deactivateDialogOrg doubles as DeactivateOrgConfirmDialog's `open` flag,
// mirroring deleteDialogOrg above.
const deactivateDialogOrg = ref<OrgSummary | null>(null)

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

// ── Deactivate confirm dialog (quick task 260824) ─────────────────────────
// Gates onToggleActive(org) when the drawer's Active checkbox is unchecked
// (deactivating). Reactivating (checkbox re-checked) calls onToggleActive
// directly from the drawer's @reactivate handler in the template — no
// dialog, no function here.

function closeDeactivateDialog() {
  // Never closable mid-request, mirrors closeDeleteDialog's in-flight guard.
  if (togglingOrgId.value !== null && togglingOrgId.value === deactivateDialogOrg.value?.orgId) return
  deactivateDialogOrg.value = null
}

async function onConfirmDeactivate() {
  if (!deactivateDialogOrg.value) return
  if (togglingOrgId.value !== null) return

  const org = deactivateDialogOrg.value
  const orgId = org.orgId
  // org is active (that's the only state that opens this dialog), so
  // onToggleActive issues setOrgActive({ active: false }) — same callable,
  // claimFailures handling, and refreshOrgs() as every other toggle.
  await onToggleActive(org)

  // Success closes the dialog; the drawer stays open and its Active checkbox
  // re-renders unchecked from the refreshed configOrg. On failure, leave the
  // dialog open so its confirmError (read from toggleError) shows.
  if (!toggleError.value[orgId]) {
    deactivateDialogOrg.value = null
  }
}

// ── AI on/off toggle action (R242) ────────────────────────────────────────
// Pure httpsCallable consumer — this component writes NO organizations
// document directly (mirrors T-74-07/onToggleActive above); setOrgAiEnabled
// is the only channel. The callable ships UNDEPLOYED with Plan 01, which is
// fine for this client-only plan: a rejection surfaces the same friendly
// error path any other undeployed-callable failure would.

async function onToggleAi(org: OrgSummary) {
  // Same double-submit guard shape as togglingOrgId/isAssigning above.
  if (togglingAiOrgId.value) return

  const orgId = org.orgId
  const nextEnabled = !org.aiMasterEnabled
  togglingAiOrgId.value = orgId
  delete aiToggleError.value[orgId]
  try {
    const setOrgAiEnabled = httpsCallable<SetOrgAiEnabledRequest, SetOrgAiEnabledResponse>(
      functions,
      'setOrgAiEnabled',
    )
    await setOrgAiEnabled({ orgId, aiEnabled: nextEnabled })
    await refreshOrgs()
  } catch (err) {
    console.error('[OrganizationsTab] setOrgAiEnabled error:', err)
    aiToggleError.value = { ...aiToggleError.value, [orgId]: friendlyCallableError(err) }
  } finally {
    togglingAiOrgId.value = null
  }
}

// ── Bible API on/off toggle action (Phase 101, R295) ──────────────────────
// Pure httpsCallable consumer — this component writes NO organizations
// document directly (mirrors onToggleAi above); setOrgBibleEnabled is the
// only channel.

async function onToggleBible(org: OrgSummary) {
  // Same double-submit guard shape as togglingAiOrgId above.
  if (togglingBibleOrgId.value) return

  const orgId = org.orgId
  const nextEnabled = !org.bibleApiEnabled
  togglingBibleOrgId.value = orgId
  delete bibleToggleError.value[orgId]
  try {
    const setOrgBibleEnabled = httpsCallable<SetOrgBibleEnabledRequest, SetOrgBibleEnabledResponse>(
      functions,
      'setOrgBibleEnabled',
    )
    await setOrgBibleEnabled({ orgId, enabled: nextEnabled })
    await refreshOrgs()
  } catch (err) {
    console.error('[OrganizationsTab] setOrgBibleEnabled error:', err)
    bibleToggleError.value = { ...bibleToggleError.value, [orgId]: friendlyCallableError(err) }
  } finally {
    togglingBibleOrgId.value = null
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
