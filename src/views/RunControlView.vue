<template>
  <!-- R276 (97-09) — the redesigned operator control surface. A full-viewport
       Nocturne-dark shell (NOT AppShell), Run-scoped palette only. Two visual
       states driven by `live`: State A (pre-flight, !live) centres RunPreflightPanel
       beside the rail; State B (live) shows the program/next-up split, in-item
       filmstrip, Black/Clear output panel, displays panel and transport bar.
       RunHeader renders in BOTH states. The Phase 92-96 output-status cluster +
       recovery banner band stay INLINE here VERBATIM (same testids, same
       outputStatus/recovery conditions) so RunControlView.output.test.ts passes
       with no edits. This view is the SINGLE WRITER of wp-run-{serviceId} (R266):
       every intent routes to a useRunControl function; no child posts itself. -->
  <div class="run-root fixed inset-0 flex flex-col text-gray-100">
    <!-- 1. HEADER (both states) — carries run-service-name + run-exit-btn, the
         green-when-live status (owner fix #4), clock/elapsed, the displays dots. -->
    <RunHeader
      :serviceHeading="serviceHeading"
      :live="live"
      :positionLabel="positionLabel"
      :clock="clock"
      :elapsed="elapsed"
      :audienceOpen="audienceOpen"
      :confidenceOpen="confidenceOpen"
      @exit="openExitConfirm"
      @reopen="reopenOutput"
      @manage="openManage"
    />

    <!-- OUTPUT-STATUS CLUSTER (95-04) — INLINE + VERBATIM. Renders by outputStatus:
         opening the spinner, placed the green "Displays ready" summary + the
         closed/reopen recovery rows, blocked a compact honest indicator + retry.
         The idle Go-live button has relocated to RunPreflightPanel (State A). In
         'fallback'/'partial' the cluster is empty — the amber banners carry it. -->
    <div
      v-if="outputStatus !== 'idle'"
      class="flex-none flex items-center justify-end gap-4 border-b border-white/10 bg-black/20 px-6 py-2"
    >
      <!-- OPENING: transient spinner while getScreenDetails/window.open run. -->
      <div
        v-if="outputStatus === 'opening'"
        data-testid="run-status-opening"
        class="flex items-center gap-2 text-xs text-gray-400"
      >
        <svg
          class="h-4 w-4 animate-spin text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Opening displays…
      </div>

      <!-- PLACED: green dot ALWAYS paired with words (colorblind-safe). -->
      <div
        v-else-if="outputStatus === 'placed'"
        data-testid="run-status-placed"
        class="flex flex-col items-end gap-0.5"
      >
        <span class="inline-flex items-center gap-2 text-sm text-gray-100">
          <span class="h-2 w-2 flex-none rounded-full bg-green-400" aria-hidden="true"></span>
          Displays ready
        </span>
        <!-- AUDIENCE line (WR-02 honesty): the GREEN "ready" label is gated on
             !audienceClosed INDEPENDENT of monitorChanged — a closed window is
             NEVER rendered green. Three branches:
               1. closed & no reassign → amber closed-recovery row + reopen chip
               2. closed & reassign up → muted amber "closed" indicator, NO chip
                  (the reassign banner is the senior action — precedence)
               3. open → green ready label. -->
        <div v-if="audienceClosed && !monitorChanged" class="flex flex-col items-end gap-0.5">
          <span
            data-testid="run-output-closed-audience"
            class="inline-flex items-center gap-2 text-sm text-amber-200"
          >
            <span class="h-2 w-2 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
            Audience display closed
            <button
              type="button"
              data-testid="run-reopen-audience"
              aria-label="Reopen the audience display on its screen"
              class="min-h-11 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @click="reopenOutput('audience')"
            >
              Reopen Audience
            </button>
          </span>
          <span class="text-xs text-amber-200/80">
            You won't lose your place — reopening returns to the current slide.
          </span>
        </div>
        <span
          v-else-if="audienceClosed"
          data-testid="run-output-closed-audience-muted"
          class="inline-flex items-center gap-2 text-xs text-amber-200/80"
        >
          <span class="h-2 w-2 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
          Audience → reassign displays to reopen
        </span>
        <span v-else data-testid="run-output-ready-audience" class="text-xs text-gray-400">
          Audience → {{ readyAudienceLabel }}
        </span>
        <!-- CONFIDENCE line: mirror of the audience closed-recovery row, with
             the same WR-02 honesty gating (green ready ONLY when !confidenceClosed). -->
        <div v-if="confidenceClosed && !monitorChanged" class="flex flex-col items-end gap-0.5">
          <span
            data-testid="run-output-closed-confidence"
            class="inline-flex items-center gap-2 text-sm text-amber-200"
          >
            <span class="h-2 w-2 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
            Confidence display closed
            <button
              type="button"
              data-testid="run-reopen-confidence"
              aria-label="Reopen the confidence display on its screen"
              class="min-h-11 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @click="reopenOutput('confidence')"
            >
              Reopen Confidence
            </button>
          </span>
          <span class="text-xs text-amber-200/80">
            You won't lose your place — reopening returns to the current slide.
          </span>
        </div>
        <span
          v-else-if="confidenceClosed"
          data-testid="run-output-closed-confidence-muted"
          class="inline-flex items-center gap-2 text-xs text-amber-200/80"
        >
          <span class="h-2 w-2 flex-none rounded-full bg-amber-400" aria-hidden="true"></span>
          Confidence → reassign displays to reopen
        </span>
        <span v-else data-testid="run-output-ready-confidence" class="text-xs text-gray-400">
          Confidence → {{ readyConfidenceLabel }}
        </span>
      </div>

      <!-- BLOCKED: compact honest indicator + retry; detail in the banner below. -->
      <div
        v-else-if="outputStatus === 'blocked'"
        class="flex items-center gap-3"
      >
        <span class="inline-flex items-center gap-1.5 text-xs text-amber-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-4 w-4 flex-none text-amber-400"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd"
            />
          </svg>
          Displays blocked
        </span>
        <button
          type="button"
          data-testid="run-go-live-retry"
          aria-label="Go live — open the audience and confidence displays"
          class="min-h-11 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="openOutputs"
        >
          Go live
        </button>
      </div>
    </div>

    <!-- OUTPUT-STATUS BANNERS (95-04/96-01) — INLINE + VERBATIM. A sibling band
         between the status cluster and the main region (pushes it down, never
         overlays). Fallback and blocked are MUTUALLY EXCLUSIVE by outputStatus. -->
    <!-- REASSIGN (96-01): a monitor was unplugged/rearranged mid-service. First
         in the band (visually senior), independent of outputStatus, and while it
         shows the per-role reopen chip is suppressed (precedence). -->
    <div
      v-if="monitorChanged"
      data-testid="run-reassign-banner"
      class="flex-none m-4 flex items-start gap-3 rounded-md border border-amber-800 bg-amber-950 px-4 py-3 text-amber-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="mt-0.5 h-5 w-5 flex-none text-amber-400"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="min-w-0 flex-1">
        <p class="font-medium">Your monitor setup changed</p>
        <!-- WR-01 HONESTY: only the IN-PLACE reopen below preserves your slide. -->
        <p class="mt-1 text-sm">
          A display was unplugged or rearranged, so we can't place the {{ reassignRole }} output on its old
          screen. Your service is still live — reopen the {{ reassignRole }} display below to keep going
          without losing your place.
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="run-reassign-reopen"
            :aria-label="`Reopen and replace the ${reassignRole} display on the current screen`"
            class="min-h-11 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="reopenReassignedOutputs"
          >
            Reopen &amp; replace {{ reassignRole }}
          </button>
          <a
            href="/monitor-setup"
            target="_blank"
            rel="noopener"
            data-testid="run-reassign-setup-link"
            class="text-amber-200 underline"
          >
            Open monitor setup in a new tab
          </a>
        </div>
      </div>
    </div>

    <!-- FALLBACK: windows DID open, just un-positioned. Amber, never red. -->
    <div
      v-if="outputStatus === 'fallback'"
      data-testid="run-fallback-banner"
      class="flex-none m-4 flex items-start gap-3 rounded-md border border-amber-800 bg-amber-950 px-4 py-3 text-amber-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="mt-0.5 h-5 w-5 flex-none text-amber-400"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="min-w-0 flex-1">
        <p class="font-medium">Finish setting up your displays</p>
        <ol class="mt-2 list-decimal list-inside text-sm space-y-1">
          <li>Two windows opened — one Audience, one Confidence.</li>
          <li>Drag each window onto the correct screen.</li>
          <li>Click Enter fullscreen in each window.</li>
        </ol>
        <router-link to="/monitor-setup" class="mt-2 inline-block text-amber-200 underline">
          Open monitor setup
        </router-link>
      </div>
    </div>

    <!-- BLOCKED: ZERO windows open (pop-up blocker). Amber (recoverable), NOT
         red, and NEVER any "opened / displays ready" claim. -->
    <div
      v-if="outputStatus === 'blocked'"
      data-testid="run-blocked-banner"
      class="flex-none m-4 flex items-start gap-3 rounded-md border border-amber-800 bg-amber-950 px-4 py-3 text-amber-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="mt-0.5 h-5 w-5 flex-none text-amber-400"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="min-w-0 flex-1">
        <p class="font-medium">Your browser blocked the display windows</p>
        <p class="mt-1 text-sm">
          The pop-up blocker prevented the audience and confidence windows from opening. Allow
          pop-ups for this site, then click Go live again.
        </p>
        <button
          type="button"
          data-testid="run-blocked-retry"
          aria-label="Go live — open the audience and confidence displays"
          class="mt-3 min-h-11 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="openOutputs"
        >
          Go live
        </button>
      </div>
    </div>

    <!-- PARTIAL (WR-02): EXACTLY ONE output window opened; the other was refused. -->
    <div
      v-if="outputStatus === 'partial'"
      data-testid="run-partial-banner"
      class="flex-none m-4 flex items-start gap-3 rounded-md border border-amber-800 bg-amber-950 px-4 py-3 text-amber-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="mt-0.5 h-5 w-5 flex-none text-amber-400"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="min-w-0 flex-1">
        <p class="font-medium">Only one display opened</p>
        <p class="mt-1 text-sm">
          The
          <span class="font-semibold">{{ blockedRole }}</span>
          display was blocked by your browser and is still dark. Allow pop-ups for this site, then
          click Go live again to open it.
        </p>
        <button
          type="button"
          data-testid="run-partial-retry"
          aria-label="Go live — open the audience and confidence displays"
          class="mt-3 min-h-11 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @click="openOutputs"
        >
          Go live
        </button>
      </div>
    </div>

    <!-- 2. MAIN REGION — the order-of-service rail (both states) + State A
         (pre-flight) vs State B (live) center column by `live`. -->
    <div class="flex-1 min-h-0 flex">
      <!-- ORDER-OF-SERVICE RAIL (R262/R263) — present in BOTH states. Owns its own
           active-row auto-scroll; the active item (activeIndex = a slotIndex)
           expands to its slides from expandedSlides. Emits intent only. -->
      <RunRail
        :rows="railRows"
        :activeIndex="currentSlotIndex"
        :expandedSlides="expandedSlides"
        @jump="jumpToSlot"
        @jump-slide="postIndex"
      />

      <!-- STATE A (!live): the centered pre-flight column. run-go-live-btn now
           lives inside RunPreflightPanel (relocated from the old idle corner). -->
      <section v-if="!live" class="flex-1 min-w-0 h-full flex flex-col">
        <RunPreflightPanel
          :serviceName="serviceName"
          :slideCount="slideCount"
          :itemCount="itemCount"
          :renderedCount="renderedCount"
          :allRendered="allRendered"
          :audienceLabel="audienceLabel"
          :confidenceLabel="confidenceLabel"
          @go-live="openOutputs"
          @rehearse="rehearse"
          @change-audience="openManage"
          @change-confidence="openManage"
        />
        <p class="flex-none px-6 pb-6 text-center text-xs text-gray-500">
          Nothing is on the screens yet. Slides advance only after you go live.
        </p>
      </section>

      <!-- STATE B (live): the program/next-up preview split (RunPreviewPair), the
           in-item click-to-jump filmstrip (RunFilmstrip -> postIndex), the Output
           panel (Black/Clear -> postBlackout), and the additive Displays panel. -->
      <section v-else class="flex-1 min-w-0 h-full flex flex-col gap-6 overflow-y-auto p-6 lg:p-8">
        <RunPreviewPair :current="current" :next="next" :live="live" />

        <RunFilmstrip
          :slides="filmstripSlides"
          :indices="filmstripIndices"
          :currentIndex="index"
          @jump="postIndex"
        />

        <div class="grid gap-6 lg:grid-cols-2 items-start">
          <!-- OUTPUT PANEL (R280) — Black blanks the projector, Clear restores it;
               both route to the single-writer postBlackout. The active state is
               shown so the operator sees whether the screens are black. Logo is
               omitted (no asset). -->
          <div
            data-testid="run-output-panel"
            class="rounded-lg border border-white/10 bg-[#141624] p-4"
          >
            <h3 class="mb-3 text-sm font-semibold text-gray-100">Output</h3>
            <div class="flex items-center gap-3">
              <button
                type="button"
                data-testid="run-blackout-btn"
                :aria-pressed="blackout ? 'true' : 'false'"
                class="min-h-11 flex-1 rounded-md border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="
                  blackout
                    ? 'border-transparent bg-black text-white ring-2 ring-white/40'
                    : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                "
                @click="postBlackout(true)"
              >
                Black
              </button>
              <button
                type="button"
                data-testid="run-clear-btn"
                :aria-pressed="!blackout ? 'true' : 'false'"
                class="min-h-11 flex-1 rounded-md border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="
                  !blackout
                    ? 'border-transparent bg-[color:var(--run-accent)] text-white'
                    : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                "
                @click="postBlackout(false)"
              >
                Clear
              </button>
            </div>
          </div>

          <RunDisplaysPanel
            :audience="audience"
            :confidence="confidence"
            :live="live"
            @reopen="reopenOutput"
            @manage="openManage"
          />
        </div>
      </section>
    </div>

    <!-- 3. TRANSPORT BAR (State B) — Previous / Next route to goBySlide; the bar
         also carries the keyboard legend + service progress. -->
    <RunTransportBar
      v-if="live"
      :progress="progress"
      :positionLabel="positionLabel"
      @prev="goBySlide(-1)"
      @next="goBySlide(1)"
    />

    <!-- 4. EXIT-CONFIRM DIALOG (R265) — unchanged. -->
    <Teleport to="body">
      <div
        v-if="confirmOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      >
        <div
          data-testid="run-exit-dialog"
          class="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
        >
          <h2 class="text-base font-semibold text-gray-100 mb-2">Exit run mode?</h2>
          <p class="text-sm text-gray-400 mb-6">
            This closes the audience and confidence displays and ends the live presentation. The
            projector will go blank. You can start again anytime with Run.
          </p>
          <div class="flex justify-end gap-3">
            <button
              ref="cancelBtnRef"
              type="button"
              data-testid="run-exit-cancel"
              class="rounded-md px-4 py-2 min-h-11 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @click="cancelExit"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="run-exit-confirm"
              class="rounded-md px-4 py-2 min-h-11 text-sm font-medium text-white bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              @click="confirmExit"
            >
              Exit run mode
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { BroadcastChannelFactory } from '@/utils/runChannel'
import { useRunControl } from '@/composables/useRunControl'
import RunHeader from '@/components/run/RunHeader.vue'
import RunPreflightPanel from '@/components/run/RunPreflightPanel.vue'
import RunRail from '@/components/run/RunRail.vue'
import RunPreviewPair from '@/components/run/RunPreviewPair.vue'
import RunFilmstrip from '@/components/run/RunFilmstrip.vue'
import RunTransportBar from '@/components/run/RunTransportBar.vue'
import RunDisplaysPanel from '@/components/run/RunDisplaysPanel.vue'

/**
 * Testability seam (93/95-PATTERNS): the run-channel factory is injectable so
 * tests can drive the channel deterministically with an in-memory fake.
 * Production passes nothing and openRunChannel uses the native BroadcastChannel.
 */
const props = defineProps<{
  channelFactory?: BroadcastChannelFactory
}>()

// R276 (97-08/09): the ENTIRE Phase 92-96 control-core — the single-writer
// channel, navigation model, rail derivations, honest open state machine, WR-01
// stale guard, 96-01 recovery, exit/teardown ordering, the timers, blackout,
// rehearse, pre-flight readiness, filmstrip/rail expansion, and the document
// keyboard handler — lives in useRunControl. This view is template + this
// destructure; the composable registers its own onMounted/onUnmounted lifecycle.
const {
  // header / service
  serviceHeading,
  serviceName,
  live,
  positionLabel,
  clock,
  elapsed,
  audienceOpen,
  confidenceOpen,
  // navigation model + previews (State B)
  current,
  next,
  index,
  currentSlotIndex,
  // pre-flight readiness (R276)
  slideCount,
  itemCount,
  renderedCount,
  allRendered,
  audienceLabel,
  confidenceLabel,
  // displays panel + blackout (State B)
  audience,
  confidence,
  blackout,
  postBlackout,
  // in-item filmstrip + rail expansion (R282)
  filmstripSlides,
  filmstripIndices,
  expandedSlides,
  // transport derivations
  progress,
  // rail + navigation actions
  railRows,
  jumpToSlot,
  goBySlide,
  postIndex,
  // output state machine + recovery (inline, verbatim)
  outputStatus,
  readyAudienceLabel,
  readyConfidenceLabel,
  blockedRole,
  audienceClosed,
  confidenceClosed,
  monitorChanged,
  reassignRole,
  reopenOutput,
  reopenReassignedOutputs,
  openOutputs,
  // actions
  rehearse,
  openManage,
  openExitConfirm,
  // exit confirm
  confirmOpen,
  cancelExit,
  confirmExit,
  cancelBtnRef,
} = useRunControl({ channelFactory: props.channelFactory })
</script>

<style scoped>
/* Nocturne Run-scoped palette (97-UI-SPEC) — LOCAL custom properties on the Run
   root only; the rest of the app is NOT rethemed. The blurple #9184d9 accent is
   available to descendant markup via var(--run-accent). */
.run-root {
  --run-bg: #0f111a;
  --run-surface: #141624;
  --run-accent: #9184d9;
  --run-text: #e9e9ed;
  background: var(--run-bg);
  color: var(--run-text);
}
</style>
