<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-100">Team</h1>
        <p v-if="authStore.orgName" class="text-sm text-gray-400 mt-1">{{ authStore.orgName }}</p>
      </div>

      <!-- Invite form -->
      <div class="mb-6 rounded-lg bg-gray-900 border border-gray-800 p-4">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Invite a team member</h2>
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="Enter email address"
            class="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
            @keydown.enter="onInvite"
          />
          <select
            v-model="inviteRole"
            class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            type="button"
            @click="onInvite"
            :disabled="isInviting"
            class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            {{ isInviting ? 'Inviting...' : invitedFeedback ? 'Invited!' : 'Invite' }}
          </button>
        </div>
        <p v-if="inviteError" class="text-red-400 text-sm mt-2">{{ inviteError }}</p>
        <p v-if="invitedFeedback" class="text-green-400 text-sm mt-2">Invite sent to {{ invitedFeedback }}!</p>
      </div>

      <!-- Loading state -->
      <div v-if="!authStore.orgId" class="text-sm text-gray-400 py-8 text-center">
        Loading team...
      </div>

      <!-- Member table -->
      <div v-else class="rounded-lg border border-gray-800 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-800/50 border-b border-gray-700">
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            <!-- Active members -->
            <tr v-for="member in members" :key="member.uid" class="hover:bg-gray-800/20 transition-colors">
              <td class="px-4 py-3 text-gray-200">{{ member.displayName || (member.email ? member.email.split('@')[0] : 'Unknown') }}</td>
              <td class="px-4 py-3 text-gray-400">{{ member.email || '' }}</td>
              <td class="px-4 py-3">
                <span
                  class="px-1.5 py-0.5 text-xs rounded"
                  :class="member.role === 'editor'
                    ? 'bg-indigo-900/50 text-indigo-300'
                    : 'bg-gray-700 text-gray-300'"
                >
                  {{ member.role === 'editor' ? 'Editor' : 'Viewer' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-400 text-sm">{{ formatDate(member.joinedAt) }}</td>
              <td class="px-4 py-3">
                <!-- Current user: show "You" label -->
                <span v-if="member.uid === authStore.user?.uid" class="text-xs text-gray-500 italic">You</span>

                <!-- Other members: show action buttons -->
                <template v-else>
                  <!-- Inline remove confirmation -->
                  <template v-if="confirmingRemoveUid === member.uid">
                    <span class="text-xs text-gray-300 mr-2">Remove {{ member.displayName || member.email.split('@')[0] }}?</span>
                    <button
                      type="button"
                      @click="onConfirmRemove(member.uid)"
                      class="text-xs text-red-400 hover:text-red-300 mr-2 transition-colors"
                    >Confirm</button>
                    <button
                      type="button"
                      @click="confirmingRemoveUid = null"
                      class="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >Cancel</button>
                  </template>

                  <template v-else>
                    <button
                      type="button"
                      @click="onToggleRole(member)"
                      class="text-sm text-gray-400 hover:text-gray-200 mr-3 transition-colors"
                    >
                      {{ member.role === 'editor' ? 'Make Viewer' : 'Make Editor' }}
                    </button>
                    <button
                      type="button"
                      @click="confirmingRemoveUid = member.uid"
                      class="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >Remove</button>
                  </template>
                </template>
              </td>
            </tr>

            <!-- Pending invite rows -->
            <tr v-for="invite in pendingInvites" :key="invite.email" class="hover:bg-gray-800/20 transition-colors opacity-80">
              <td class="px-4 py-3 text-gray-400">{{ invite.email }}</td>
              <td class="px-4 py-3 text-gray-400">{{ invite.email }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    class="px-1.5 py-0.5 text-xs rounded"
                    :class="invite.role === 'editor'
                      ? 'bg-indigo-900/50 text-indigo-300'
                      : 'bg-gray-700 text-gray-300'"
                  >
                    {{ invite.role === 'editor' ? 'Editor' : 'Viewer' }}
                  </span>
                  <span class="bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 text-xs rounded">Pending</span>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-400 text-sm">Invited</td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  @click="onCancelInvite(invite.email)"
                  class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >Cancel</button>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-if="members.length === 0 && pendingInvites.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">
                No team members yet. Invite someone above.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Action error (for role toggle / remove errors) -->
      <p v-if="actionError" class="text-red-400 text-sm mt-3">{{ actionError }}</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  doc,
  collection,
  onSnapshot,
  writeBatch,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'

interface Member {
  uid: string
  role: 'editor' | 'viewer'
  joinedAt: { toDate?: () => Date } | null
  displayName?: string
  email?: string
}

interface PendingInvite {
  email: string
  role: 'editor' | 'viewer'
  invitedAt: { toDate?: () => Date } | null
  invitedBy: string
  status: string
}

const authStore = useAuthStore()

// ── Data state ─────────────────────────────────────────────────────────────────

const members = ref<Member[]>([])
const pendingInvites = ref<PendingInvite[]>([])

// ── Invite form state ──────────────────────────────────────────────────────────

const inviteEmail = ref('')
const inviteRole = ref<'editor' | 'viewer'>('viewer')
const inviteError = ref<string | null>(null)
const isInviting = ref(false)
const invitedFeedback = ref<string | null>(null)

// ── Action state ───────────────────────────────────────────────────────────────

const confirmingRemoveUid = ref<string | null>(null)
const actionError = ref<string | null>(null)

// ── Subscriptions ──────────────────────────────────────────────────────────────

let membersUnsub: Unsubscribe | null = null
let invitesUnsub: Unsubscribe | null = null

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

function formatDate(ts: { toDate?: () => Date } | null): string {
  if (!ts || !ts.toDate) return '—'
  const d = ts.toDate()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Invite action ──────────────────────────────────────────────────────────────

async function onInvite() {
  inviteError.value = null
  const email = inviteEmail.value.trim()

  if (!email || !isValidEmailFormat(email)) {
    inviteError.value = 'Enter a valid email address'
    return
  }

  const normalized = normalizeEmail(email)

  if (members.value.some((m) => m.email?.toLowerCase() === normalized)) {
    inviteError.value = 'This person is already a member'
    return
  }

  if (pendingInvites.value.some((i) => i.email?.toLowerCase() === normalized)) {
    inviteError.value = 'An invite has already been sent to this email'
    return
  }

  const orgId = authStore.orgId
  const user = authStore.user
  if (!orgId || !user) return

  isInviting.value = true
  try {
    const batch = writeBatch(db)

    // Write invite doc in org subcollection
    const inviteRef = doc(db, 'organizations', orgId, 'invites', normalized)
    batch.set(inviteRef, {
      role: inviteRole.value,
      invitedBy: user.uid,
      invitedAt: serverTimestamp(),
      email: normalized,
      status: 'pending',
    })

    // Write lookup doc for O(1) lookup at sign-in
    const lookupRef = doc(db, 'inviteLookup', normalized)
    batch.set(lookupRef, {
      orgId,
      role: inviteRole.value,
      invitedAt: serverTimestamp(),
    })

    await batch.commit()

    invitedFeedback.value = normalized
    inviteEmail.value = ''
    inviteRole.value = 'viewer'

    // Clear success feedback after 2 seconds
    setTimeout(() => {
      invitedFeedback.value = null
    }, 2000)
  } catch (err) {
    console.error('[TeamView] invite error:', err)
    inviteError.value = 'Failed to send invite. Please try again.'
  } finally {
    isInviting.value = false
  }
}

// ── Cancel invite ──────────────────────────────────────────────────────────────

async function onCancelInvite(email: string) {
  const orgId = authStore.orgId
  if (!orgId) return

  actionError.value = null
  try {
    const batch = writeBatch(db)
    batch.delete(doc(db, 'organizations', orgId, 'invites', email))
    batch.delete(doc(db, 'inviteLookup', email))
    await batch.commit()
  } catch (err) {
    console.error('[TeamView] cancel invite error:', err)
    actionError.value = 'Failed to cancel invite. Please try again.'
  }
}

// ── Role toggle ────────────────────────────────────────────────────────────────

async function onToggleRole(member: Member) {
  const orgId = authStore.orgId
  if (!orgId) return

  actionError.value = null

  // Guard: demoting the last editor
  if (member.role === 'editor') {
    const editorCount = members.value.filter((m) => m.role === 'editor').length
    if (editorCount === 1) {
      actionError.value = 'Cannot remove the only editor. Assign another editor first.'
      return
    }
  }

  const newRole = member.role === 'editor' ? 'viewer' : 'editor'
  try {
    await updateDoc(doc(db, 'organizations', orgId, 'members', member.uid), { role: newRole })
  } catch (err) {
    console.error('[TeamView] role toggle error:', err)
    actionError.value = 'Failed to update role. Please try again.'
  }
}

// ── Remove member ──────────────────────────────────────────────────────────────

async function onConfirmRemove(uid: string) {
  const orgId = authStore.orgId
  if (!orgId) return

  actionError.value = null

  // Guard: removing the last editor
  const target = members.value.find((m) => m.uid === uid)
  if (target?.role === 'editor') {
    const editorCount = members.value.filter((m) => m.role === 'editor').length
    if (editorCount === 1) {
      actionError.value = 'Cannot remove the only editor. Assign another editor first.'
      confirmingRemoveUid.value = null
      return
    }
  }

  try {
    await deleteDoc(doc(db, 'organizations', orgId, 'members', uid))
    confirmingRemoveUid.value = null
  } catch (err) {
    console.error('[TeamView] remove member error:', err)
    actionError.value = 'Failed to remove member. Please try again.'
    confirmingRemoveUid.value = null
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  const orgId = authStore.orgId
  if (!orgId) return

  membersUnsub = onSnapshot(collection(db, 'organizations', orgId, 'members'), (snap) => {
    members.value = snap.docs.map((d) => ({
      uid: d.id,
      ...(d.data() as Omit<Member, 'uid'>),
    }))
  })

  invitesUnsub = onSnapshot(collection(db, 'organizations', orgId, 'invites'), (snap) => {
    pendingInvites.value = snap.docs.map((d) => ({
      email: d.id,
      ...(d.data() as Omit<PendingInvite, 'email'>),
    }))
  })
})

onUnmounted(() => {
  membersUnsub?.()
  invitesUnsub?.()
})
</script>
