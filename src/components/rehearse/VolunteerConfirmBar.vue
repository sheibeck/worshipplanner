<template>
  <div
    v-if="myAssignments.length > 0"
    class="flex flex-wrap items-center gap-2 mb-3"
    data-testid="volunteer-confirm-bar"
  >
    <span class="text-xs text-gray-500">Your part:</span>
    <div
      v-for="assignment in myAssignments"
      :key="assignment.roleId"
      class="flex items-center gap-1.5"
    >
      <!-- Unconfirmed: "I've got it" is the whole control. -->
      <button
        v-if="statusFor(assignment.roleId) === 'unconfirmed'"
        type="button"
        :data-testid="`confirm-btn-${assignment.roleId}`"
        class="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-colors"
        @click="confirmRole(assignment)"
      >
        I've got it &mdash; {{ assignment.roleName }}
      </button>

      <!-- Confirmed: a chip + Undo affordance. -->
      <span
        v-else-if="statusFor(assignment.roleId) === 'confirmed'"
        :data-testid="`confirm-state-${assignment.roleId}`"
        class="inline-flex items-center gap-1.5 rounded-full border border-green-800 bg-green-900/40 px-2.5 py-1 text-xs text-green-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Confirmed &mdash; {{ assignment.roleName }}
        <button
          type="button"
          :data-testid="`undo-btn-${assignment.roleId}`"
          class="text-green-400 hover:text-green-200 underline underline-offset-2"
          @click="undoRole(assignment)"
        >
          Undo
        </button>
      </span>

      <!-- Needs reconfirmation: distinct amber treatment, confirm action still available. -->
      <span
        v-else
        :data-testid="`confirm-state-${assignment.roleId}`"
        class="inline-flex items-center gap-1.5 rounded-full border border-amber-800 bg-amber-900/40 px-2.5 py-1 text-xs text-amber-300"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Please reconfirm &mdash; {{ assignment.roleName }}
        <button
          type="button"
          :data-testid="`confirm-btn-${assignment.roleId}`"
          class="text-amber-200 hover:text-amber-100 underline underline-offset-2"
          @click="confirmRole(assignment)"
        >
          I've got it
        </button>
      </span>

      <p v-if="errors[assignment.roleId]" class="text-xs text-red-400">{{ errors[assignment.roleId] }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Volunteer-facing "I've got it" control (Phase 133, R410, D-R410) — lives in
// VolunteerServiceView's tri-tab shell, deliberately NOT nested inside
// ScheduleServiceCard's whole-card router-link (133-RESEARCH.md Open Question
// 1, resolved). One control per role the signed-in volunteer holds on this
// service; renders nothing when they hold none.
//
// T-133-08 (Spoofing, mitigate): the confirming identity is derived ONLY from
// auth.currentUser?.email, never a prop/route value — defense-in-depth on top
// of the firestore.rules re-check (133-01).
// T-133-09 (Tampering, mitigate): writes carry ONLY the 6 rule-allowlisted
// fields with status:'confirmed'; un-confirming is a delete, never a
// client-chosen 'unconfirmed' write (that value is never stored, per
// confirmations.ts's own doc comment).
import { ref, computed, watch, onScopeDispose } from 'vue'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import { confirmationKey, type ConfirmationDoc } from '@/utils/confirmations'

const props = defineProps<{
  orgId: string
  serviceId: string
  myAssignments: { roleId: string; roleName: string }[]
}>()

const myEmailLower = computed(() => auth.currentUser?.email?.toLowerCase() ?? '')

const confirmations = ref<Map<string, ConfirmationDoc>>(new Map())
const errors = ref<Record<string, string>>({})

let unsubscribe: Unsubscribe | null = null

function teardown(): void {
  unsubscribe?.()
  unsubscribe = null
}

function subscribe(): void {
  teardown()
  // No assignments -> nothing to render, so no listener either (avoids an
  // idle Firestore read for a volunteer who holds no role on this service).
  if (!props.orgId || !props.serviceId || props.myAssignments.length === 0) {
    confirmations.value = new Map()
    return
  }
  unsubscribe = onSnapshot(
    collection(db, 'organizations', props.orgId, 'services', props.serviceId, 'confirmations'),
    (snap) => {
      const next = new Map<string, ConfirmationDoc>()
      for (const d of snap.docs) {
        next.set(d.id, d.data() as ConfirmationDoc)
      }
      confirmations.value = next
    },
    (err: unknown) => {
      console.error('VolunteerConfirmBar confirmations subscription failed', err)
    },
  )
}

// Re-subscribe whenever the enclosing service changes (never expected mid-view
// in practice, but matches useVolunteerServiceDoc's own re-subscribe-on-id-
// change discipline rather than assuming a stable mount).
watch(
  () => `${props.orgId}::${props.serviceId}::${props.myAssignments.length}`,
  subscribe,
  { immediate: true },
)
onScopeDispose(teardown)

function statusFor(roleId: string): 'unconfirmed' | 'confirmed' | 'needsReconfirmation' {
  const key = confirmationKey(roleId, myEmailLower.value)
  return confirmations.value.get(key)?.status ?? 'unconfirmed'
}

async function confirmRole(assignment: { roleId: string; roleName: string }): Promise<void> {
  const email = myEmailLower.value
  errors.value = { ...errors.value, [assignment.roleId]: '' }
  if (!email) return
  const key = confirmationKey(assignment.roleId, email)
  try {
    await setDoc(
      doc(db, 'organizations', props.orgId, 'services', props.serviceId, 'confirmations', key),
      {
        roleId: assignment.roleId,
        roleName: assignment.roleName,
        emailLower: email,
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    )
  } catch (err) {
    console.error('VolunteerConfirmBar confirm write failed', err)
    errors.value = { ...errors.value, [assignment.roleId]: "Couldn't save — try again." }
  }
}

async function undoRole(assignment: { roleId: string; roleName: string }): Promise<void> {
  const email = myEmailLower.value
  errors.value = { ...errors.value, [assignment.roleId]: '' }
  if (!email) return
  const key = confirmationKey(assignment.roleId, email)
  try {
    await deleteDoc(doc(db, 'organizations', props.orgId, 'services', props.serviceId, 'confirmations', key))
  } catch (err) {
    console.error('VolunteerConfirmBar undo failed', err)
    errors.value = { ...errors.value, [assignment.roleId]: "Couldn't undo — try again." }
  }
}

defineExpose({ statusFor })
</script>
