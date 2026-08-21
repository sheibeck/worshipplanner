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
              <td class="px-4 py-3 text-gray-200">{{ org.name }}</td>
              <td class="px-4 py-3 text-gray-500 text-xs font-mono">{{ org.orgId }}</td>
              <td class="px-4 py-3 text-gray-400 text-sm">{{ formatDate(org.createdAt) }}</td>
              <td class="px-4 py-3 text-gray-400 text-sm">{{ org.memberCount }}</td>
              <td class="px-4 py-3">
                <template v-if="assigningOrgId === org.orgId">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="assignEmail"
                      type="email"
                      placeholder="Admin email"
                      class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                      @keydown.enter="onConfirmAssign(org)"
                    />
                    <button
                      type="button"
                      @click="onConfirmAssign(org)"
                      :disabled="isAssigning"
                      class="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
                    >
                      {{ isAssigning ? 'Assigning...' : 'Assign' }}
                    </button>
                    <button
                      type="button"
                      @click="cancelAssign"
                      class="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Cancel assign
                    </button>
                  </div>
                  <p v-if="assignError[org.orgId]" class="text-red-400 text-xs mt-1">{{ assignError[org.orgId] }}</p>
                  <p v-if="assignFeedback[org.orgId]" class="text-green-400 text-xs mt-1">{{ assignFeedback[org.orgId] }}</p>
                </template>

                <template v-else>
                  <button
                    type="button"
                    @click="startAssign(org.orgId)"
                    class="text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
                  >
                    Assign admin
                  </button>
                </template>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

// ── Types ──────────────────────────────────────────────────────────────────
// Mirrors functions/src/orgProvisioning.ts's OrgSummary/ListOrganizationsResponse
// and OnboardOrganization/AssignOrgAdmin request/response shapes (Plan 01).

interface OrgSummary {
  orgId: string
  name: string
  createdAt: unknown
  memberCount: number
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

// ── Helpers ────────────────────────────────────────────────────────────────
// Copied from ConfigurationTab.vue verbatim (Plan 74-02 instructions).

function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

function formatDate(ts: unknown): string {
  const t = ts as { toDate?: () => Date } | null
  if (!t || !t.toDate) return '—'
  const d = t.toDate()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Extended with an already-exists branch (R201) beyond ConfigurationTab's
// original permission-denied/not-found mapping.
function friendlyCallableError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('already-exists')) {
    return 'That church name is taken.'
  }
  if (code.includes('permission-denied')) {
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
    assignFeedback.value = {
      ...assignFeedback.value,
      [orgId]: result.data.status === 'added' ? 'Added as admin.' : 'No account yet — invited as admin.',
    }
    await refreshOrgs()
  } catch (err) {
    console.error('[OrganizationsTab] assignOrgAdmin error:', err)
    assignError.value = { ...assignError.value, [orgId]: friendlyCallableError(err) }
  } finally {
    isAssigning.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(() => {
  refreshOrgs()
})
</script>
