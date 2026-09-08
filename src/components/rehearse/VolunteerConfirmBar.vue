<template>
  <div
    v-if="myAssignments.length > 0"
    class="inline-flex flex-col items-stretch gap-1"
    data-testid="volunteer-confirm-bar"
  >
    <div class="inline-flex items-center gap-1.5">
      <!-- Confirm — filled green when this is the current state, outline
           otherwise. Clicking the active state undoes it (back to unconfirmed). -->
      <button
        type="button"
        data-testid="confirm-service-btn"
        :aria-pressed="aggregateStatus === 'confirmed'"
        :disabled="saving"
        class="inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors disabled:opacity-60"
        :class="aggregateStatus === 'confirmed'
          ? 'bg-green-600 border-green-600 text-white hover:bg-green-500'
          : 'border-green-700 text-green-300 hover:bg-green-900/30'"
        @click="onConfirm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        {{ aggregateStatus === 'confirmed' ? 'Confirmed' : 'Confirm' }}
      </button>

      <!-- Decline — filled red when declined, outline otherwise. -->
      <button
        type="button"
        data-testid="decline-service-btn"
        :aria-pressed="aggregateStatus === 'declined'"
        :disabled="saving"
        class="inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors disabled:opacity-60"
        :class="aggregateStatus === 'declined'
          ? 'bg-red-600 border-red-600 text-white hover:bg-red-500'
          : 'border-red-800 text-red-300 hover:bg-red-900/30'"
        @click="onDecline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {{ aggregateStatus === 'declined' ? 'Declined' : 'Decline' }}
      </button>
    </div>

    <!-- A relock changed the plan since a prior response — nudge to re-answer. -->
    <p
      v-if="aggregateStatus === 'needsReconfirmation'"
      data-testid="confirm-service-reconfirm-hint"
      class="text-xs text-amber-400"
    >
      Something changed — please reconfirm or decline.
    </p>

    <p v-if="error" class="text-xs text-red-400" data-testid="confirm-service-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
// Volunteer-facing Confirm / Decline control (Phase 133 R410; reworked
// 260908-nq5). Two compact buttons that set the volunteer's response for their
// WHOLE responsibility on this service at once. Lives on My Schedule, to the
// LEFT of each card's Rehearse button (ScheduleServiceCard's #actions slot) —
// the card is no longer a whole-surface link, so real buttons are safe here.
// Renders nothing when the signed-in volunteer holds no role on this service.
//
// Data model (per-(roleId,emailLower) confirmation docs) is unchanged except the
// new 'declined' status (260908-nq5): "Confirm" writes a confirmed doc for every
// role the volunteer holds; "Decline" writes a declined doc for each; clicking
// the button that is already the current state undoes it (delete → implicit
// unconfirmed). The aggregate button state is worst-of the volunteer's roles.
//
// T-133-08 (Spoofing, mitigate): the acting identity is derived ONLY from
// auth.currentUser?.email, never a prop/route value — defense-in-depth on top of
// the firestore.rules re-check (133-01).
// T-133-09 (Tampering, mitigate): writes carry ONLY the rule-allowlisted fields
// with status in {'confirmed','declined'}; clearing is a delete, never a
// client-chosen 'unconfirmed'/'needsReconfirmation' write (the volunteer arm of
// the rule forbids both).
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
import { confirmationKey, type ConfirmationDoc, type ConfirmationStatus } from '@/utils/confirmations'

const props = defineProps<{
  orgId: string
  serviceId: string
  myAssignments: { roleId: string; roleName: string }[]
}>()

type AggregateStatus = ConfirmationStatus | 'unconfirmed'

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
  // No assignments -> nothing to render, so no listener either.
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

function statusFor(roleId: string): AggregateStatus {
  const key = confirmationKey(roleId, myEmailLower.value)
  return confirmations.value.get(key)?.status ?? 'unconfirmed'
}

// Worst-of across the volunteer's roles: any first-time-unconfirmed role =>
// 'unconfirmed'; else any needs-reconfirmation role => 'needsReconfirmation';
// else any declined role => 'declined'; else all confirmed. Whole-service
// actions keep the roles uniform, so a mixed state only arises from an editor
// relock — which correctly resurfaces the prompt.
const aggregateStatus = computed<AggregateStatus>(() => {
  const statuses = props.myAssignments.map((a) => statusFor(a.roleId))
  if (statuses.length === 0) return 'confirmed'
  if (statuses.some((s) => s === 'unconfirmed')) return 'unconfirmed'
  if (statuses.some((s) => s === 'needsReconfirmation')) return 'needsReconfirmation'
  if (statuses.some((s) => s === 'declined')) return 'declined'
  return 'confirmed'
})

/** Writes one confirmation doc per role with the given status (260908-nq5). */
async function writeAll(status: 'confirmed' | 'declined'): Promise<void> {
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
            status,
            confirmedAt: status === 'confirmed' ? serverTimestamp() : null,
            updatedAt: serverTimestamp(),
          },
        )
      }),
    )
  } catch (err) {
    console.error('VolunteerConfirmBar write failed', err)
    error.value = "Couldn't save — try again."
  } finally {
    saving.value = false
  }
}

/** Deletes every role's doc — back to the implicit 'unconfirmed' default. */
async function clearAll(): Promise<void> {
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
    console.error('VolunteerConfirmBar clear failed', err)
    error.value = "Couldn't save — try again."
  } finally {
    saving.value = false
  }
}

// Clicking the button that is already the current state undoes it; otherwise it
// sets that state.
function onConfirm(): void {
  if (aggregateStatus.value === 'confirmed') void clearAll()
  else void writeAll('confirmed')
}
function onDecline(): void {
  if (aggregateStatus.value === 'declined') void clearAll()
  else void writeAll('declined')
}

defineExpose({ statusFor, aggregateStatus })
</script>
