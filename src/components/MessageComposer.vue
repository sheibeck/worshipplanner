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
        <!-- Widened to max-w-2xl (vs PptxImportModal's max-w-lg) for the extra
             form density — recipients + type + subject + body + options
             (59-UI-SPEC #1). -->
        <div
          class="w-full max-w-2xl max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 :id="titleId" class="text-base font-semibold text-gray-100">Message the team</h2>
              <p class="text-xs text-gray-400 mt-0.5">{{ serviceDateSubline }}</p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
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

            <!-- #3 SEND TO — team chips -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Send to</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="team in teamChips"
                  :key="team.group"
                  type="button"
                  role="checkbox"
                  :aria-checked="isTeamSelected(team.group)"
                  :data-testid="`team-chip-${team.group}`"
                  :class="chipClass(isTeamSelected(team.group))"
                  :title="selection.includeEveryone ? 'Everyone is selected' : undefined"
                  @click="toggleTeam(team.group)"
                >
                  <span>{{ team.label }} · {{ team.count }}</span>
                </button>
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="selection.includeEveryone"
                  data-testid="everyone-chip"
                  :class="chipClass(selection.includeEveryone)"
                  @click="toggleEveryone"
                >
                  <span>Everyone on this service · {{ everyoneCount }}</span>
                </button>
              </div>
            </div>

            <!-- #4 Individuals panel -->
            <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-3">
              <div class="flex items-center justify-between">
                <p class="text-xs text-gray-400">Individuals</p>
                <select
                  data-testid="add-someone-select"
                  aria-label="Add someone"
                  :disabled="addablePeople.length === 0"
                  class="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  @change="onAddIndividual"
                >
                  <option value="" disabled>{{ addablePeople.length > 0 ? '＋ Add someone…' : 'No one left to add' }}</option>
                  <option v-for="person in addablePeople" :key="person.id" :value="person.id">{{ person.name }}</option>
                </select>
              </div>
              <div v-if="selection.individualPersonIds.length > 0" class="flex flex-wrap gap-2 mt-2">
                <span
                  v-for="id in selection.individualPersonIds"
                  :key="id"
                  :data-testid="`individual-pill-${id}`"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-200"
                >
                  {{ personName(id) }}
                  <button
                    type="button"
                    :data-testid="`remove-individual-${id}`"
                    class="hover:text-red-300"
                    :aria-label="`Remove ${personName(id)}`"
                    @click="removeIndividual(id)"
                  >✕</button>
                </span>
              </div>
            </div>

            <!-- #5 Unreachable helper line -->
            <p v-if="resolved.unreachableCount > 0" data-testid="unreachable-note" class="text-xs text-gray-500">
              {{ resolved.unreachableCount }} selected {{ resolved.unreachableCount === 1 ? 'person' : 'people' }}
              {{ resolved.unreachableCount === 1 ? 'has' : 'have' }} no email
            </p>

            <!-- #6 MESSAGE TYPE segmented control -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Message type</p>
              <div class="inline-flex rounded-md border border-gray-700 overflow-hidden" role="radiogroup" aria-label="Message type">
                <button
                  v-for="opt in messageTypeOptions"
                  :key="opt.value"
                  type="button"
                  role="radio"
                  :aria-checked="type === opt.value"
                  :data-testid="`type-${opt.value}`"
                  :class="[
                    'px-3 py-1.5 text-sm',
                    type === opt.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
                  ]"
                  @click="selectType(opt.value)"
                >{{ opt.label }}</button>
              </div>
            </div>

            <!-- #7 Subject -->
            <div>
              <label class="block text-xs text-gray-400 mb-1" for="composer-subject">Subject</label>
              <input
                id="composer-subject"
                data-testid="subject-input"
                type="text"
                v-model="subject"
                @input="subjectDirty = true"
                placeholder="Rehearsal moved to 8:15 this Sunday"
                class="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <!-- #8 Message body + token palette -->
            <div>
              <label class="block text-xs text-gray-400 mb-1" for="composer-body">Message</label>
              <textarea
                id="composer-body"
                ref="bodyTextareaRef"
                data-testid="body-textarea"
                v-model="body"
                @input="bodyDirty = true"
                rows="5"
                class="w-full min-h-[132px] resize-y bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              ></textarea>
              <div class="flex flex-wrap gap-2 mt-2">
                <button
                  v-for="tok in tokenChips"
                  :key="tok.token"
                  type="button"
                  :data-testid="`token-${tok.token}`"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:border-indigo-500 hover:text-indigo-300"
                  @click="insertToken(tok.token)"
                >＋ {{ tok.label }}</button>
              </div>
              <p class="text-xs text-gray-500 mt-1">Tokens fill in per person when the email sends.</p>
            </div>

            <!-- #9 Sample preview -->
            <div data-testid="sample-preview" class="rounded-lg bg-gray-800/60 border border-gray-700 p-3">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-[10px] uppercase tracking-wide bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">Sample</span>
                <span class="text-xs text-gray-400">{{ sampleCaption }}</span>
              </div>
              <p class="text-sm font-medium text-gray-200">{{ samplePreview.subject }}</p>
              <p class="text-xs text-gray-400 whitespace-pre-wrap mt-1">{{ samplePreview.body }}</p>
            </div>

            <!-- #10 Options card -->
            <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-3 space-y-3">
              <label class="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" class="accent-indigo-600" data-testid="opt-attach-link" v-model="attachServiceLink" />
                Attach the service order as a link
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" class="accent-indigo-600" data-testid="opt-send-copy" v-model="sendCopyToSelf" />
                Send me a copy
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-200">
                <input type="checkbox" class="accent-indigo-600" data-testid="opt-schedule" v-model="scheduleForLater" />
                Schedule for later
              </label>
              <div v-if="scheduleForLater" class="mt-2">
                <input
                  type="datetime-local"
                  data-testid="scheduled-for"
                  v-model="scheduledFor"
                  class="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p v-if="scheduledForInvalid" data-testid="schedule-error" class="text-xs text-red-400 mt-1">Pick a future date and time.</p>
                <p v-else class="text-xs text-gray-500 mt-1">Scheduled messages are sent by a daily job — this message won't leave until then.</p>
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-3 shrink-0">
            <div class="text-xs text-gray-400" aria-live="polite">
              <span data-testid="reaches-count">Reaches {{ reachableCount }} {{ reachableCount === 1 ? 'person' : 'people' }}</span>
              <span v-if="resolved.unreachableCount > 0" class="text-gray-500">
                · {{ resolved.unreachableCount }} {{ resolved.unreachableCount === 1 ? 'has' : 'have' }} no email
              </span>
              <p v-if="sendError" data-testid="send-error" class="text-red-400 text-sm mt-1">{{ sendError }}</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                data-testid="cancel-btn"
                class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="sending"
                @click="onCancel"
              >Cancel</button>
              <button
                type="button"
                data-testid="send-btn"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="sendDisabled"
                :title="sendTitle"
                @click="onSend"
              >
                <span
                  v-if="sending"
                  class="inline-block h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                ></span>
                {{ sendLabel }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { resolveRecipients, MESSAGING_TEAM_LABELS, type RecipientSelection } from '@/utils/messagingRecipients'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'
import type { Service, SongSlot } from '@/types/service'
import type { Quarter, Role, Person, RoleGroup } from '@/types/roster'

const props = defineProps<{
  open: boolean
  service: Service
  quarters: Quarter[]
  roles: Role[]
  people: Person[]
  orgId: string
}>()

const emit = defineEmits<{
  cancel: []
  sent: [messageId: string]
}>()

// ── Client callable wrapper (mirrors PptxImportModal.vue's parsePptx wrapper).
// The wrapper lives INSIDE the component per 59-PATTERNS.md — no orphan file.
// Its request type matches the 59-02 QueueMessageRequest contract; the client
// cannot import from functions/, so the shape is re-declared locally. Only the
// recipient SELECTOR crosses the boundary — never a resolved email list; the
// server (59-03) re-resolves recipients authoritatively (R141/R131). ──────────
type MessageType = 'oneoff' | 'reminder' | 'share-link'
interface RecipientSelector {
  teams: string[]
  individualPersonIds: string[]
  includeEveryone: boolean
}
interface MessageOptions {
  attachServiceLink: boolean
  sendCopyToSelf: boolean
}
interface QueueMessageRequest {
  orgId: string
  serviceId: string
  type: MessageType
  subject: string
  body: string
  recipientSelector: RecipientSelector
  options: MessageOptions
  scheduledFor: string | null
}

const GENERIC_ERROR = "Couldn't send this message. Please try again."
const KILL_SWITCH_ERROR = 'Messaging is turned off for your organization. Turn it on in Settings to send.'

const titleId = 'message-composer-title'

// ── Selection state ──────────────────────────────────────────────────────────
const selection = reactive<RecipientSelection>({
  teams: [],
  individualPersonIds: [],
  includeEveryone: false,
})

// ── Compose state ────────────────────────────────────────────────────────────
const type = ref<MessageType>('oneoff')
const subject = ref('')
const body = ref('')
// Dirty flags gate the type-seeding: switching type re-seeds subject/body ONLY
// when the user has not edited them, so switching after typing never silently
// destroys the draft (UI-SPEC #6).
const subjectDirty = ref(false)
const bodyDirty = ref(false)
// Set once the user touches the recipient selection (team/individual/everyone).
// Gates Reminder's auto-default to Everyone so a manual choice is never clobbered.
const recipientDirty = ref(false)

const attachServiceLink = ref(true)
const sendCopyToSelf = ref(false)
const scheduleForLater = ref(false)
const scheduledFor = ref('')

const sending = ref(false)
const sendError = ref('')

const bodyTextareaRef = ref<HTMLTextAreaElement | null>(null)

// ── Static option lists ──────────────────────────────────────────────────────
const messageTypeOptions: ReadonlyArray<{ value: MessageType; label: string }> = [
  { value: 'oneoff', label: 'One-off message' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'share-link', label: 'Share service link' },
]

const tokenChips: ReadonlyArray<{ token: string; label: string }> = [
  { token: 'service_date', label: 'Service date' },
  { token: 'service_link', label: 'Service link' },
  { token: 'their_roles', label: 'Their roles' },
  { token: 'name', label: 'Name' },
]

// Type defaults are RAW token templates — the authoritative per-recipient
// render happens server-side (R139). One-off is a blank compose.
const TYPE_DEFAULTS: Record<MessageType, { subject: string; body: string }> = {
  oneoff: { subject: '', body: '' },
  reminder: {
    subject: 'Reminder: {{service_date}}',
    body: "Hi {{name}} — a reminder you're scheduled to serve on {{service_date}}. Here's the plan: {{service_link}}",
  },
  'share-link': {
    subject: 'Service plan for {{service_date}}',
    body: '{{service_link}}',
  },
}

// ── Recipient resolution (reuse the pure Phase 58 resolver verbatim) ─────────
const resolved = computed(() => resolveRecipients(props.service, props.quarters, props.roles, props.people, { ...selection }))
const reachableCount = computed(() => resolved.value.reachable.length)

function teamReachableCount(group: RoleGroup): number {
  return resolveRecipients(props.service, props.quarters, props.roles, props.people, {
    teams: [group],
    individualPersonIds: [],
    includeEveryone: false,
  }).reachable.length
}

const teamChips = computed(() =>
  (Object.keys(MESSAGING_TEAM_LABELS) as RoleGroup[]).map((group) => ({
    group,
    label: MESSAGING_TEAM_LABELS[group],
    count: teamReachableCount(group),
  })),
)

const everyoneCount = computed(
  () =>
    resolveRecipients(props.service, props.quarters, props.roles, props.people, {
      teams: [],
      individualPersonIds: [],
      includeEveryone: true,
    }).reachable.length,
)

const addablePeople = computed(() => props.people.filter((p) => p.active && !selection.individualPersonIds.includes(p.id)))

function personName(id: string): string {
  return props.people.find((p) => p.id === id)?.name ?? id
}

function isTeamSelected(group: RoleGroup): boolean {
  return selection.includeEveryone || selection.teams.includes(group)
}

// Chip idiom from TeamTagPill.vue — selected indigo fill, unselected gray outline.
function chipClass(selected: boolean): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border'
  return selected
    ? `${base} bg-indigo-600 border-indigo-500 text-white`
    : `${base} bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600`
}

// ── Selection mutations ──────────────────────────────────────────────────────
function toggleTeam(group: RoleGroup) {
  recipientDirty.value = true
  if (selection.includeEveryone) {
    // Toggling a specific team off Everyone clears includeEveryone and keeps
    // the remaining explicit teams (UI-SPEC #3).
    selection.includeEveryone = false
    selection.teams = (Object.keys(MESSAGING_TEAM_LABELS) as RoleGroup[]).filter((g) => g !== group)
    return
  }
  const i = selection.teams.indexOf(group)
  if (i >= 0) selection.teams.splice(i, 1)
  else selection.teams.push(group)
}

function toggleEveryone() {
  recipientDirty.value = true
  selection.includeEveryone = !selection.includeEveryone
  if (selection.includeEveryone) selection.teams = []
}

function onAddIndividual(event: Event) {
  const el = event.target as HTMLSelectElement
  const id = el.value
  if (id && !selection.individualPersonIds.includes(id)) {
    selection.individualPersonIds.push(id)
    recipientDirty.value = true
  }
  el.value = ''
}

function removeIndividual(id: string) {
  recipientDirty.value = true
  const i = selection.individualPersonIds.indexOf(id)
  if (i >= 0) selection.individualPersonIds.splice(i, 1)
}

// ── Message type + token insertion ───────────────────────────────────────────
function selectType(t: MessageType) {
  type.value = t
  const d = TYPE_DEFAULTS[t]
  if (!subjectDirty.value) subject.value = d.subject
  if (!bodyDirty.value) body.value = d.body
  // Reminder defaults to Everyone on a clean recipient set (mirrors toggleEveryone);
  // a manual recipient choice (recipientDirty) is never overwritten.
  if (t === 'reminder' && !recipientDirty.value) {
    selection.includeEveryone = true
    selection.teams = []
  }
}

function insertToken(token: string) {
  const raw = `{{${token}}}`
  const el = bodyTextareaRef.value
  if (!el) {
    body.value += raw
    bodyDirty.value = true
    return
  }
  const start = el.selectionStart ?? body.value.length
  const end = el.selectionEnd ?? body.value.length
  body.value = body.value.slice(0, start) + raw + body.value.slice(end)
  bodyDirty.value = true
  const caret = start + raw.length
  nextTick(() => {
    el.focus()
    el.setSelectionRange(caret, caret)
  })
}

// ── Sample preview (labelled SAMPLE — NOT the final per-person text) ──────────
const sampleRecipient = computed(() => resolved.value.reachable[0] ?? null)

const sampleCaption = computed(() =>
  sampleRecipient.value
    ? `Rendered for ${sampleRecipient.value.name} — the actual email personalizes each person's roles.`
    : 'No recipients selected yet — rendered with placeholders.',
)

function sampleRolesFor(personId: string | null): string {
  if (!personId) return 'your roles'
  const assignments = resolveServiceRoleAssignments(props.service, props.quarters, props.roles)
  const names = assignments.filter((a) => a.effectivePersonIds.includes(personId)).map((a) => a.roleName)
  return names.length > 0 ? names.join(', ') : 'your roles'
}

const songList = computed(() =>
  props.service.slots
    .filter((s): s is SongSlot => s.kind === 'SONG')
    .map((s) => s.songTitle)
    .filter((t): t is string => !!t)
    .join(', '),
)

// split/join replaces every occurrence without relying on String.prototype.replaceAll
// (not in this project's TS lib target).
function fillToken(template: string, token: string, value: string): string {
  return template.split(`{{${token}}}`).join(value)
}

function renderSample(template: string): string {
  let out = fillToken(template, 'service_date', serviceDateLabel.value)
  out = fillToken(out, 'service_link', '[service link]')
  out = fillToken(out, 'their_roles', sampleRolesFor(sampleRecipient.value?.id ?? null))
  out = fillToken(out, 'name', sampleRecipient.value?.name ?? '[name]')
  out = fillToken(out, 'song_list', songList.value || '[song list]')
  return out
}

const samplePreview = computed(() => ({
  subject: renderSample(subject.value),
  body: renderSample(body.value),
}))

// ── Dates ────────────────────────────────────────────────────────────────────
const serviceDateLabel = computed(() => {
  const d = new Date(`${props.service.date}T00:00:00`)
  if (isNaN(d.getTime())) return props.service.date
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})
const serviceDateSubline = computed(() => serviceDateLabel.value)

// ── Send validation ──────────────────────────────────────────────────────────
const scheduledForInvalid = computed(() => {
  if (!scheduleForLater.value) return false
  if (!scheduledFor.value) return true
  const t = new Date(scheduledFor.value).getTime()
  return isNaN(t) || t <= Date.now()
})

const sendDisabled = computed(
  () =>
    sending.value ||
    reachableCount.value === 0 ||
    (subject.value.trim() === '' && body.value.trim() === '') ||
    scheduledForInvalid.value,
)

const sendTitle = computed(() =>
  reachableCount.value === 0 ? 'Select at least one team or person with an email' : undefined,
)

const sendLabel = computed(() => {
  if (sending.value) return scheduleForLater.value ? 'Scheduling…' : 'Sending…'
  return scheduleForLater.value ? 'Schedule send' : 'Send now'
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
    const queueServiceMessage = httpsCallable<QueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
    const result = await queueServiceMessage({
      orgId: props.orgId,
      serviceId: props.service.id,
      type: type.value,
      subject: subject.value,
      body: body.value,
      recipientSelector: {
        teams: [...selection.teams],
        individualPersonIds: [...selection.individualPersonIds],
        includeEveryone: selection.includeEveryone,
      },
      options: {
        attachServiceLink: attachServiceLink.value,
        sendCopyToSelf: sendCopyToSelf.value,
      },
      scheduledFor: scheduleForLater.value && scheduledFor.value ? new Date(scheduledFor.value).toISOString() : null,
    })
    emit('sent', result.data.messageId)
  } catch (err) {
    console.error('[MessageComposer] queueServiceMessage failed:', err)
    sendError.value = isKillSwitchError(err) ? KILL_SWITCH_ERROR : GENERIC_ERROR
  } finally {
    sending.value = false
  }
}

// The ✕ / backdrop / Escape / Cancel all route here; a no-op while a send is in
// flight (mirrors PptxImportModal.vue's onCancel guard).
function onCancel() {
  if (sending.value) return
  emit('cancel')
}

// ── Reset on open ────────────────────────────────────────────────────────────
function resetComposer() {
  selection.teams = []
  selection.individualPersonIds = []
  selection.includeEveryone = false
  type.value = 'oneoff'
  subject.value = TYPE_DEFAULTS.oneoff.subject
  body.value = TYPE_DEFAULTS.oneoff.body
  subjectDirty.value = false
  bodyDirty.value = false
  recipientDirty.value = false
  attachServiceLink.value = true
  sendCopyToSelf.value = false
  scheduleForLater.value = false
  scheduledFor.value = ''
  sending.value = false
  sendError.value = ''
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetComposer()
  },
)
</script>
