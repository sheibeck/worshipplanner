<template>
  <div
    v-if="myAssignments.length > 0"
    class="mb-4"
    data-testid="volunteer-confirm-bar"
  >
    <!-- Unconfirmed (first-time) OR needs-reconfirmation: one prominent primary CTA
         confirming the WHOLE service (all the volunteer's roles) at once. -->
    <button
      v-if="aggregateStatus === 'unconfirmed' || aggregateStatus === 'needsReconfirmation'"
      type="button"
      :data-testid="aggregateStatus === 'needsReconfirmation' ? 'reconfirm-service-btn' : 'confirm-service-btn'"
      :disabled="saving"
      class="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-md px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
      :class="aggregateStatus === 'needsReconfirmation'
        ? 'bg-amber-600 hover:bg-amber-500'
        : 'bg-indigo-600 hover:bg-indigo-500'"
      @click="confirmAll"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {{ aggregateStatus === 'needsReconfirmation' ? 'Reconfirm service' : 'Confirm service' }}
    </button>

    <!-- Confirmed: a clear confirmed state + an unobtrusive undo. -->
    <div
      v-else
      data-testid="confirm-service-state"
      class="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-md border border-green-800 bg-green-900/40 px-5 py-3 text-base font-semibold text-green-300"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      You're confirmed for this service
      <button
        type="button"
        data-testid="unconfirm-service-btn"
        :disabled="saving"
        class="ml-1 text-sm font-medium text-green-400 hover:text-green-200 underline underline-offset-2 disabled:opacity-60"
        @click="unconfirmAll"
      >
        Undo
      </button>
    </div>

    <!-- Subtext: which role(s) this covers, so "Confirm service" is unambiguous. -->
    <p class="mt-1.5 text-xs text-gray-500">
      {{ aggregateStatus === 'needsReconfirmation'
        ? 'Something changed since you last confirmed — please reconfirm.'
        : `You're serving as ${roleNamesLabel}.` }}
    </p>

    <p v-if="error" class="mt-1 text-xs text-red-400" data-testid="confirm-service-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
// Volunteer-facing "Confirm service" control (Phase 133, R410; reworked at UAT
// 2026-09-08 from per-role "I've got it" pills to a single prominent primary
// CTA that confirms the volunteer's WHOLE responsibility for the service at
// once — owner wanted a more obvious, primary-colored call to action). Lives in
// VolunteerServiceView above the tri-tab shell, deliberately NOT nested inside
// ScheduleServiceCard's whole-card router-link (133-RESEARCH.md Open Question 1,
// resolved). Renders nothing when the signed-in volunteer holds no role here.
//
// Data model is unchanged (per-(roleId,emailLower) confirmation docs) — this
// control just batches: "Confirm service" writes a confirmed doc for every role
// the volunteer holds; "Undo" deletes them all. The aggregate button state is
// worst-of the volunteer's roles, so a single reassigned role (flipped to
// needsReconfirmation by 133-04's relock reconcile) resurfaces the CTA.
//
// T-133-08 (Spoofing, mitigate): the confirming identity is derived ONLY from
// auth.currentUser?.email, never a prop/route value — defense-in-depth on top
// of the firestore.rules re-check (133-01).
// T-133-09 (Tampering, mitigate): writes carry ONLY the rule-allowlisted fields
// with status:'confirmed'; un-confirming is a delete, never a client-chosen
// 'unconfirmed' write (that value is never stored, per confirmations.ts).
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
const error = ref('')
const saving = ref(false)

let unsubscribe: Unsubscribe | null = null

function teardown(): void {
  unsubscribe?.()
  unsubscribe = null
}

function subscribe(): void {
  teardown()
  // No assignments -> nothing to render, so no listener either (avoids an idle
  // Firestore read for a volunteer who holds no role on this service).
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

// Re-subscribe whenever the enclosing service (or the volunteer's role set) changes.
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

// Worst-of across the volunteer's roles: any first-time-unconfirmed role => the
// service is 'unconfirmed'; else any needs-reconfirmation role => 'needsReconfirmation';
// else all confirmed.
const aggregateStatus = computed<'unconfirmed' | 'confirmed' | 'needsReconfirmation'>(() => {
  const statuses = props.myAssignments.map((a) => statusFor(a.roleId))
  if (statuses.length === 0) return 'confirmed'
  if (statuses.some((s) => s === 'unconfirmed')) return 'unconfirmed'
  if (statuses.some((s) => s === 'needsReconfirmation')) return 'needsReconfirmation'
  return 'confirmed'
})

const roleNamesLabel = computed(() => {
  const names = props.myAssignments.map((a) => a.roleName)
  if (names.length <= 1) return names[0] ?? 'a volunteer'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
})

async function confirmAll(): Promise<void> {
  const email = myEmailLower.value
  error.value = ''
  if (!email || saving.value) return
  saving.value = true
  try {
    await Promise.all(
      props.myAssignments.map((assignment) => {
        const key = confirmationKey(assignment.roleId, email)
        return setDoc(
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
      }),
    )
  } catch (err) {
    console.error('VolunteerConfirmBar confirm write failed', err)
    error.value = "Couldn't save — try again."
  } finally {
    saving.value = false
  }
}

async function unconfirmAll(): Promise<void> {
  const email = myEmailLower.value
  error.value = ''
  if (!email || saving.value) return
  saving.value = true
  try {
    await Promise.all(
      props.myAssignments.map((assignment) => {
        const key = confirmationKey(assignment.roleId, email)
        return deleteDoc(doc(db, 'organizations', props.orgId, 'services', props.serviceId, 'confirmations', key))
      }),
    )
  } catch (err) {
    console.error('VolunteerConfirmBar undo failed', err)
    error.value = "Couldn't undo — try again."
  } finally {
    saving.value = false
  }
}

defineExpose({ statusFor, aggregateStatus })
</script>
