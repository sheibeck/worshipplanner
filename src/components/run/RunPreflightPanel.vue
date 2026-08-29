<template>
  <!-- R276 State A — the centered "Ready when you are" pre-flight column.
       PURE presentation: display cards + an HONEST readiness line (driven by
       renderState-derived props, NOT the design's CCLI) + the primary Go-live
       and secondary Rehearse actions. Holds NO channel/store logic — the parent
       (useRunControl, 97-08/09) supplies every prop and owns @go-live/@rehearse.
       The Go-live button REUSES data-testid=run-go-live-btn so the output test
       suite keeps driving go-live through the same identifier after 97-09 wires
       this in. -->
  <div
    data-testid="run-preflight"
    class="flex h-full w-full items-center justify-center px-6 py-10"
  >
    <div class="flex w-full max-w-[640px] flex-col items-stretch gap-8 text-center">
      <!-- Heading + sub -->
      <div class="flex flex-col gap-2">
        <h2 class="text-3xl font-semibold text-gray-100">Ready when you are</h2>
        <p class="text-sm leading-relaxed text-gray-400">
          Going live opens the audience and confidence windows and puts slide 1 on the screens.
        </p>
      </div>

      <!-- Display cards: Audience + Confidence. Each shows the SAVED assigned
           monitor label (from loadMapping(), passed as a prop) + a "Not open"
           amber badge (pre-live) + a Change link. No live screen name here —
           getScreenDetails only runs inside the go-live gesture (parent). -->
      <div class="flex flex-col gap-3 sm:flex-row">
        <div
          data-testid="run-preflight-audience"
          class="flex flex-1 flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/70 p-4 text-left"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Audience</span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 px-2.5 py-1 text-xs font-medium text-amber-300"
            >
              <span class="h-1.5 w-1.5 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
              Not open
            </span>
          </div>
          <span class="truncate text-sm font-medium text-gray-100">{{ audienceLabel }}</span>
          <span class="text-xs text-gray-500">will open on this screen</span>
          <button
            type="button"
            data-testid="run-preflight-audience-change"
            class="self-start text-xs font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="emit('change-audience')"
          >
            Change
          </button>
        </div>

        <div
          data-testid="run-preflight-confidence"
          class="flex flex-1 flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/70 p-4 text-left"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Confidence</span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-amber-900/40 px-2.5 py-1 text-xs font-medium text-amber-300"
            >
              <span class="h-1.5 w-1.5 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
              Not open
            </span>
          </div>
          <span class="truncate text-sm font-medium text-gray-100">{{ confidenceLabel }}</span>
          <span class="text-xs text-gray-500">will open on this screen</span>
          <button
            type="button"
            data-testid="run-preflight-confidence-change"
            class="self-start text-xs font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="emit('change-confidence')"
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

      <!-- Actions: primary Go live (run-go-live-btn — the SAME identifier the
           output suite drives) + secondary Rehearse without screens + an Enter
           key hint. This component only EMITS; the open+place path stays in the
           parent (Phase 95 openOutputs / a rehearse() entry). -->
      <div class="flex flex-col items-center gap-3">
        <button
          type="button"
          data-testid="run-go-live-btn"
          aria-label="Go live — open the audience and confidence displays"
          class="inline-flex min-h-11 items-center gap-2 rounded-md bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
 * AssembledSlide.renderState), the monitor-label resolution (loadMapping()),
 * and the actual open+place/rehearse orchestration all live in the parent
 * (useRunControl / RunControlView, 97-08/09). No channel, no store, no
 * getScreenDetails here.
 */
defineProps<{
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
  /** Saved audience monitor label from loadMapping() (pre-live; no live name). */
  audienceLabel: string
  /** Saved confidence monitor label from loadMapping(). */
  confidenceLabel: string
}>()

const emit = defineEmits<{
  'go-live': []
  rehearse: []
  'change-audience': []
  'change-confidence': []
}>()
</script>
