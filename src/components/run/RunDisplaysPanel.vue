<script setup lang="ts">
/**
 * RunDisplaysPanel — the State-B Displays panel (R276), now relocated to the right
 * column beside/under the next-up preview (owner fix #4) and carrying the
 * closed-window RECOVERY (R274) that the removed top status band used to surface
 * (owner fix #3).
 *
 * Each real output (Audience / Confidence) renders ONE of four honest states,
 * colorblind-safe (dot + word):
 *   - open        GREEN — live AND the output is open (card.open, already gated on
 *                 !closed by the parent's audienceOpen/confidenceOpen computed).
 *   - closed      AMBER "… display closed" + a Reopen button (run-display-reopen-{role})
 *                 + a "won't lose your place" reassurance — the R274 one-click reopen.
 *   - closed-muted AMBER muted "Reassign displays to reopen", NO reopen button —
 *                 shown when a monitor unplug (reassigning) is up: the reassign
 *                 banner is the senior action, so the per-role chip is SUPPRESSED
 *                 (precedence, 96-UI-SPEC §B). A closed window is NEVER rendered green.
 *   - not-open    AMBER "Not open" — pre-real-live (e.g. rehearse) or otherwise not open.
 *
 * Stage stays a DISABLED "Off" placeholder only (no 3rd-output build — out of scope).
 *
 * Pure props-in/emits-out: no store, channel, getScreenDetails, or monitorConfig
 * side-effect. The parent supplies each card's open/label, the live flag, the
 * per-output closed latches, and the reassigning flag, and maps @reopen(role) /
 * @manage back onto its own reopen/manage handlers. The closed-detection poll +
 * position-preserved reopen BEHAVIOR (useRunControl) is unchanged — only the SURFACE
 * moved here from the deleted header band.
 */
import { computed } from 'vue'

type Role = 'audience' | 'confidence'
type CardState = 'open' | 'closed' | 'closed-muted' | 'not-open'

interface OutputCard {
  open: boolean
  label: string
}

const props = defineProps<{
  audience: OutputCard
  confidence: OutputCard
  live: boolean
  audienceClosed: boolean
  confidenceClosed: boolean
  reassigning: boolean
}>()

const emit = defineEmits<{
  reopen: [role: Role]
  manage: []
}>()

function cardState(card: OutputCard, closed: boolean): CardState {
  // A monitor unplug (reassigning) takes precedence over the per-role reopen chip:
  // a closed output falls to the muted "reassign" indicator, never a reopen button.
  if (closed && props.reassigning) return 'closed-muted'
  if (closed) return 'closed'
  // GREEN only once truly live AND the output is open (owner fix #4 honesty).
  if (props.live && card.open) return 'open'
  return 'not-open'
}

interface Row {
  role: Role
  title: string
  card: OutputCard
  state: CardState
}

const rows = computed<Row[]>(() => [
  { role: 'audience', title: 'Audience', card: props.audience, state: cardState(props.audience, props.audienceClosed) },
  {
    role: 'confidence',
    title: 'Confidence',
    card: props.confidence,
    state: cardState(props.confidence, props.confidenceClosed),
  },
])
</script>

<template>
  <section
    data-testid="run-displays-panel"
    class="rounded-lg bg-[#141624] border border-white/10 p-4 text-gray-100"
  >
    <header class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-100">Displays</h3>
      <button
        type="button"
        data-testid="run-displays-manage"
        class="min-h-9 rounded-md px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @click="emit('manage')"
      >
        Manage
      </button>
    </header>

    <div class="space-y-2">
      <!-- AUDIENCE / CONFIDENCE cards -->
      <div
        v-for="row in rows"
        :key="row.role"
        :data-testid="`run-display-${row.role}`"
        class="flex items-start gap-3 rounded-md bg-white/5 border border-white/10 px-3 py-2.5"
      >
        <span
          class="mt-1 h-2.5 w-2.5 flex-none rounded-full"
          :class="row.state === 'open' ? 'bg-green-400' : 'bg-amber-400'"
          aria-hidden="true"
        ></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-100">{{ row.title }}</p>

          <!-- CLOSED (recovery): amber "… display closed" + a reassurance note. -->
          <template v-if="row.state === 'closed'">
            <p :data-testid="`run-display-closed-${row.role}`" class="text-xs text-amber-200">
              {{ row.title }} display closed
            </p>
            <p class="text-xs text-amber-200/80">
              You won't lose your place — reopening returns to the current slide.
            </p>
          </template>

          <!-- CLOSED but a reassign is up: muted indicator, NO reopen chip (precedence). -->
          <p
            v-else-if="row.state === 'closed-muted'"
            :data-testid="`run-display-closed-${row.role}-muted`"
            class="text-xs text-amber-200/80"
          >
            Reassign displays to reopen
          </p>

          <!-- OPEN (green): the assigned display label. -->
          <p
            v-else-if="row.state === 'open'"
            :data-testid="`run-display-ready-${row.role}`"
            class="text-xs text-gray-400 truncate"
          >
            {{ row.card.label }}
          </p>

          <!-- NOT OPEN: honest amber, never an alarming red. -->
          <p v-else class="text-xs text-gray-400">Not open</p>
        </div>

        <!-- The R274 one-click reopen — shown ONLY for a genuinely closed output that
             is not superseded by a reassign (which owns recovery via its banner). -->
        <button
          v-if="row.state === 'closed'"
          type="button"
          :data-testid="`run-display-reopen-${row.role}`"
          :aria-label="`Reopen the ${row.role} display on its screen`"
          class="min-h-9 flex-none rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="emit('reopen', row.role)"
        >
          Reopen
        </button>
      </div>

    </div>
  </section>
</template>
