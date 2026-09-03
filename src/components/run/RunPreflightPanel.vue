<template>
  <!-- R276 State A — the centered "Ready when you are" pre-flight column.
       PURE presentation: display cards + an HONEST readiness line (driven by
       renderState-derived props, NOT the design's CCLI) + the primary Go-live
       and secondary Rehearse actions. Holds NO channel/store logic — the parent
       (useRunControl, 97-08/09) supplies every prop and owns @go-live/@rehearse.
       The Go-live button REUSES data-testid=run-go-live-btn so the output test
       suite keeps driving go-live through the same identifier after 97-09 wires
       this in.

       114-03: the fixed Audience/Confidence pair is replaced by a `displays`
       v-for (one card per SAVED assignment — any count, any role mix), and
       go-live is gated on `canGoLive` (>=1 Audience, CONTEXT.md decision). The
       common single-Audience/single-Confidence setup keeps its original
       run-preflight-audience/-confidence testids (see cardTestidSuffix). -->
  <div
    data-testid="run-preflight"
    class="flex h-full w-full items-center justify-center px-6 py-10"
  >
    <div class="flex w-full max-w-[640px] flex-col items-stretch gap-8 text-center">
      <!-- Heading + sub -->
      <div class="flex flex-col gap-2">
        <h2 class="text-3xl font-semibold text-gray-100">Ready when you are</h2>
        <p class="text-sm leading-relaxed text-gray-400">
          Going live opens a window for every assigned display and puts slide 1 on the screens.
        </p>
      </div>

      <!-- Display cards: one per saved assignment (114-03). Each shows the SAVED
           assigned monitor's nickname-or-label (from useRunControl's `displays`,
           which reads loadMapping() and prefers the R338 nickname) + a "Not
           open" amber badge (pre-live) + a Change link. No live screen name
           here — getScreenDetails only runs inside the go-live gesture (parent). -->
      <div v-if="cards.length > 0" class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div
          v-for="card in cards"
          :key="card.id"
          :data-testid="`run-preflight-${card.testidSuffix}`"
          class="flex flex-1 min-w-[180px] flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/70 p-4 text-left"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ card.title }}</span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 px-2.5 py-1 text-xs font-medium text-amber-300"
            >
              <span class="h-1.5 w-1.5 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
              Not open
            </span>
          </div>
          <span class="truncate text-sm font-medium text-gray-100">{{ card.label }}</span>
          <span class="text-xs text-gray-500">will open on this screen</span>
          <button
            type="button"
            :data-testid="`run-preflight-${card.testidSuffix}-change`"
            class="self-start text-xs font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="emit('change', card.id)"
          >
            Change
          </button>
        </div>
      </div>

      <!-- Readiness line — HONEST (R276): green "All N rendered" only when every
           assembled slide's renderState is undefined (allRendered, computed by
           the parent from renderState in 97-08); otherwise an amber
           "R of N rendered". Never CCLI validation. -->
      <div
        data-testid="run-readiness"
        class="flex items-center justify-center gap-2 text-sm"
        :class="allRendered ? 'text-green-300' : 'text-amber-300'"
      >
        <svg
          v-if="allRendered"
          class="h-4 w-4 flex-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg
          v-else
          class="h-4 w-4 flex-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <span v-if="allRendered">All {{ slideCount }} slides rendered</span>
        <span v-else>{{ renderedCount }} of {{ slideCount }} slides rendered</span>
      </div>

      <!-- ≥1-Audience Go-live gate (CONTEXT.md decision, 114-03): mirrors the
           existing MonitorSetupView canSave-disables-Save precedent — disable
           Go-live with an inline explanation and a route to Monitor Setup,
           rather than letting a Run with zero Audience displays silently do
           nothing useful. -->
      <p v-if="!canGoLive" data-testid="run-go-live-gate-note" class="text-xs text-amber-300">
        Assign at least one Audience monitor to go live.
        <router-link to="/monitor-setup" class="underline hover:text-amber-200">Open monitor setup</router-link>
      </p>

      <!-- Actions: primary Go live (run-go-live-btn — the SAME identifier the
           output suite drives) + secondary Rehearse without screens + an Enter
           key hint. This component only EMITS; the open+place path stays in the
           parent (Phase 95 openOutputs / a rehearse() entry). -->
      <div class="flex flex-col items-center gap-3">
        <button
          type="button"
          data-testid="run-go-live-btn"
          :disabled="!canGoLive"
          :aria-label="
            canGoLive
              ? 'Go live — open every assigned display'
              : 'Go live disabled — assign an Audience monitor first'
          "
          class="inline-flex min-h-11 items-center gap-2 rounded-md bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600"
          @click="emit('go-live')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Go live
        </button>
        <span class="text-xs text-gray-500">
          Press <kbd class="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[11px] text-gray-300">Enter</kbd> to go live
        </span>
        <button
          type="button"
          data-testid="run-rehearse-btn"
          class="text-sm font-medium text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="emit('rehearse')"
        >
          Rehearse without screens
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * R276 State A — the pre-flight "Ready when you are" surface, extracted as a
 * PURE presentational child (97-05). Every value is a prop and every action is
 * an emit; the readiness derivation (allRendered/renderedCount from each
 * AssembledSlide.renderState), the monitor-label resolution, and the actual
 * open+place/rehearse orchestration all live in the parent (useRunControl /
 * RunControlView, 97-08/09). No channel, no store, no getScreenDetails here.
 *
 * 114-03: replaced the fixed audienceLabel/confidenceLabel props with a
 * `displays` v-for (any count/role mix) and added the `canGoLive` gate prop.
 */
import { computed } from 'vue'

interface DisplayItem {
  id: string
  role: 'audience' | 'confidence'
  label: string
  open: boolean
  closed: boolean
  fullscreen: boolean
}

const props = defineProps<{
  /** Service display name (header context; kept for parity with the wired view). */
  serviceName: string
  /** Total assembled slide count — the "N" in the readiness line. */
  slideCount: number
  /** Order-item count (header context: "N slides · M items"). */
  itemCount: number
  /** How many assembled slides have finished rendering (renderState undefined). */
  renderedCount: number
  /** True iff every assembled slide's renderState is undefined (honest check). */
  allRendered: boolean
  /** One entry per SAVED assignment (useRunControl's `displays`) — any count/role mix. */
  displays: DisplayItem[]
  /** >=1-Audience Go-live gate (useRunControl's `canGoLive`, CONTEXT.md decision). */
  canGoLive: boolean
}>()

const emit = defineEmits<{
  'go-live': []
  rehearse: []
  change: [id: string]
}>()

function roleTitle(role: 'audience' | 'confidence'): string {
  return role === 'audience' ? 'Audience' : 'Confidence'
}

interface Card {
  id: string
  title: string
  testidSuffix: string
  label: string
}

/**
 * The FIRST assignment of a role keeps the plain role testid/title
 * (`run-preflight-audience`, "Audience") so the common single-Audience/
 * single-Confidence setup is unchanged; a second (or later) assignment
 * sharing a role gets a numbered suffix ("Audience 2", `run-preflight-audience-2`)
 * so multiple Audience monitors never collide (114-03).
 */
const cards = computed<Card[]>(() => {
  const seen: Record<string, number> = {}
  return props.displays.map((d) => {
    const n = (seen[d.role] = (seen[d.role] ?? 0) + 1)
    return {
      id: d.id,
      title: n === 1 ? roleTitle(d.role) : `${roleTitle(d.role)} ${n}`,
      testidSuffix: n === 1 ? d.role : `${d.role}-${n}`,
      label: d.label,
    }
  })
})
</script>
