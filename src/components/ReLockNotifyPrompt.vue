<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/60"
        data-testid="backdrop"
        @click="onCancel"
      ></div>
    </Transition>

    <!-- Modal -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @keydown.esc="onCancel"
      >
        <div
          class="w-full max-w-lg max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="sublineId"
        >
          <!-- #2 Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 :id="titleId" class="text-base font-semibold text-gray-100">Notify about these changes?</h2>
              <p :id="sublineId" class="flex items-center gap-1.5 text-xs text-amber-300 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                     class="h-3.5 w-3.5 flex-none text-amber-400" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                </svg>
                This service is already locked — choose who to tell about your edits.
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors shrink-0"
              data-testid="close-btn"
              @click="onCancel"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            <!-- #3/#4 Change-diff list -->
            <div>
              <p class="text-xs text-gray-500 mb-1" data-testid="change-count">
                {{ entries.length }} {{ entries.length === 1 ? 'change' : 'changes' }} since the last lock
              </p>
              <ul role="list" class="divide-y divide-gray-800">
                <li v-for="(entry, i) in entries" :key="i">
                  <label
                    class="flex items-start gap-2 py-2 cursor-pointer"
                    :data-testid="`change-row-${i}`"
                  >
                    <input
                      type="checkbox"
                      v-model="checked[i]"
                      :data-testid="`change-check-${i}`"
                      class="h-4 w-4 mt-0.5 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start gap-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-800 text-gray-300 border-gray-700 shrink-0">{{ entry.type }}</span>
                        <span class="text-sm text-gray-200">{{ entry.description }}</span>
                      </div>
                      <div v-if="entry.affectedTeams.length > 0" class="flex flex-wrap gap-1 mt-1">
                        <span
                          v-for="group in entry.affectedTeams"
                          :key="group"
                          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-800 text-gray-300 border-gray-700"
                        >{{ teamLabel(group) }}</span>
                      </div>
                    </div>
                  </label>
                </li>
              </ul>
            </div>

            <!-- #5 Recipient choice -->
            <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-3 space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Notify</p>
              <div class="inline-flex rounded-md border border-gray-700 overflow-hidden" role="radiogroup" aria-label="Who to notify">
                <button
                  type="button"
                  role="radio"
                  :aria-checked="choice === 'affected'"
                  data-testid="notify-affected"
                  :class="[
                    'px-3 py-1.5 text-sm',
                    choice === 'affected' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
                  ]"
                  @click="choice = 'affected'"
                >Affected teams</button>
                <button
                  type="button"
                  role="radio"
                  :aria-checked="choice === 'everyone'"
                  data-testid="notify-everyone"
                  :class="[
                    'px-3 py-1.5 text-sm border-l border-gray-700',
                    choice === 'everyone' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
                  ]"
                  @click="choice = 'everyone'"
                >Everyone on this service</button>
              </div>
              <p class="text-xs text-gray-500" data-testid="affected-descriptor">
                <template v-if="choice === 'everyone'">Everyone assigned to this service.</template>
                <template v-else-if="affectedUnion.length > 0">{{ affectedUnion.map(teamLabel).join(', ') }}</template>
                <template v-else>No teams selected — check a change or notify everyone.</template>
              </p>

              <!-- #6 Live Reaches-N -->
              <p class="text-xs text-gray-400" aria-live="polite" data-testid="reaches-count">
                Reaches {{ reachableCount }} {{ reachableCount === 1 ? 'person' : 'people' }}
                <span v-if="resolved.unreachableCount > 0" class="text-gray-500">
                  · {{ resolved.unreachableCount }} {{ resolved.unreachableCount === 1 ? 'has' : 'have' }} no email
                </span>
              </p>
            </div>

          </div>

          <!-- #7 Footer -->
          <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-3 shrink-0">
            <div class="text-xs text-gray-400" aria-live="polite">
              <span data-testid="reaches-count-footer">Reaches {{ reachableCount }} {{ reachableCount === 1 ? 'person' : 'people' }}</span>
              <span v-if="resolved.unreachableCount > 0" class="text-gray-500">
                · {{ resolved.unreachableCount }} {{ resolved.unreachableCount === 1 ? 'has' : 'have' }} no email
              </span>
              <p v-if="sendError" data-testid="send-error" class="text-red-400 text-sm mt-1">{{ sendError }}</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                data-testid="lock-quietly-btn"
                class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                @click="onCancel"
              >Lock quietly</button>
              <button
                type="button"
                data-testid="send-btn"
                class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="sendDisabled"
                :title="sendTitle"
                @click="onSend"
              >{{ sendLabel }}</button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { resolveRecipients, MESSAGING_TEAM_LABELS, type RecipientSelection } from '@/utils/messagingRecipients'
import type { ChangeEntry } from '@/utils/serviceLockDiff'
import type { Service } from '@/types/service'
import type { Quarter, Role, Person, RoleGroup } from '@/types/roster'

const props = defineProps<{
  open: boolean
  service: Service
  quarters: Quarter[]
  roles: Role[]
  people: Person[]
  orgId: string
  entries: ChangeEntry[]
}>()

const emit = defineEmits<{
  cancel: []
  sent: []
}>()

// ── Client callable wrapper (mirrors MessageComposer.vue). The client cannot
// import from functions/, so the QueueMessageRequest shape is re-declared
// locally, extended with the changeDiff audit field (62-01). Only the recipient
// SELECTOR + the change diff cross the boundary — never a resolved email list;
// the server (59-03) re-resolves recipients authoritatively. ─────────────────
interface RecipientSelector {
  teams: string[]
  individualPersonIds: string[]
  includeEveryone: boolean
}
interface MessageOptions {
  attachServiceLink: boolean
  sendCopyToSelf: boolean
}
interface RelockQueueMessageRequest {
  orgId: string
  serviceId: string
  type: 'relock-notification'
  subject: string
  body: string
  recipientSelector: RecipientSelector
  options: MessageOptions
  scheduledFor: string | null
  changeDiff: ChangeEntry[]
}

const SEND_ERROR = 'Couldn’t send the notice. The service is still locked — try again or Lock quietly.'
const KILL_SWITCH_ERROR = 'Messaging is turned off for your organization — Lock quietly to finish.'

const titleId = 'relock-notify-title'
const sublineId = 'relock-notify-subline'

// ── State ────────────────────────────────────────────────────────────────────
// Per-row checked flags, keyed by entry index; every row starts checked.
const checked = ref<boolean[]>(props.entries.map(() => true))
const choice = ref<'affected' | 'everyone'>('affected')
const sending = ref(false)
const sendError = ref('')

function teamLabel(group: RoleGroup): string {
  return MESSAGING_TEAM_LABELS[group]
}

// ── Derived selection + recipient math ───────────────────────────────────────
const checkedEntries = computed(() => props.entries.filter((_, i) => checked.value[i]))

// Distinct union of affectedTeams across the CHECKED entries, first-seen order.
const affectedUnion = computed<RoleGroup[]>(() => {
  const seen = new Set<RoleGroup>()
  const out: RoleGroup[] = []
  for (const entry of checkedEntries.value) {
    for (const group of entry.affectedTeams) {
      if (!seen.has(group)) {
        seen.add(group)
        out.push(group)
      }
    }
  }
  return out
})

const selection = computed<RecipientSelection>(() =>
  choice.value === 'everyone'
    ? { teams: [], individualPersonIds: [], includeEveryone: true }
    : { teams: affectedUnion.value, individualPersonIds: [], includeEveryone: false },
)

const resolved = computed(() =>
  resolveRecipients(props.service, props.quarters, props.roles, props.people, {
    teams: [...selection.value.teams],
    individualPersonIds: [],
    includeEveryone: selection.value.includeEveryone,
  }),
)
const reachableCount = computed(() => resolved.value.reachable.length)

// ── Send validation ──────────────────────────────────────────────────────────
const sendDisabled = computed(() => sending.value || checkedEntries.value.length === 0 || reachableCount.value === 0)

const sendTitle = computed<string | undefined>(() => {
  if (checkedEntries.value.length === 0) return 'Select at least one change to notify about.'
  if (reachableCount.value === 0) return 'No selected team has anyone with an email — Lock quietly, or notify everyone.'
  return undefined
})

const sendLabel = computed(() => (sending.value ? 'Sending…' : 'Send notice'))

// ── Auto-generated notice content (from the CHECKED entries) ─────────────────
const subject = computed(() => {
  const n = checkedEntries.value.length
  return `Service updated: ${n} ${n === 1 ? 'change' : 'changes'} since the last lock`
})
const bodyText = computed(() => {
  const lines = checkedEntries.value.map((e) => `- ${e.description}`)
  return ['Here’s what changed since the last lock:', '', ...lines].join('\n')
})

function isKillSwitchError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? ''
  return typeof code === 'string' && (code.includes('failed-precondition') || code.includes('permission-denied'))
}

async function onSend() {
  if (sendDisabled.value) return
  sending.value = true
  sendError.value = ''
  try {
    const queueServiceMessage = httpsCallable<RelockQueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
    await queueServiceMessage({
      orgId: props.orgId,
      serviceId: props.service.id,
      type: 'relock-notification',
      subject: subject.value,
      body: bodyText.value,
      recipientSelector: {
        teams: [...selection.value.teams],
        individualPersonIds: [],
        includeEveryone: selection.value.includeEveryone,
      },
      options: {
        attachServiceLink: true,
        sendCopyToSelf: false,
      },
      scheduledFor: null,
      changeDiff: checkedEntries.value,
    })
    // No success toast — the failure-only ToastHost would misrender a success
    // string; the parent closes on `sent` and the history panel is the record.
    emit('sent')
  } catch (err) {
    console.error('[ReLockNotifyPrompt] queueServiceMessage failed:', err)
    sendError.value = isKillSwitchError(err) ? KILL_SWITCH_ERROR : SEND_ERROR
  } finally {
    sending.value = false
  }
}

// ✕ / backdrop / Escape / Lock quietly all route here — dismiss = quiet-lock
// semantics: no send, emit `cancel`; a no-op while a send is in flight.
function onCancel() {
  if (sending.value) return
  emit('cancel')
}

// ── Reset on open ────────────────────────────────────────────────────────────
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      checked.value = props.entries.map(() => true)
      choice.value = 'affected'
      sending.value = false
      sendError.value = ''
    }
  },
)

// Keep the checked-flags array in step if the entries prop changes while open.
watch(
  () => props.entries,
  (next) => {
    checked.value = next.map(() => true)
  },
)
</script>
