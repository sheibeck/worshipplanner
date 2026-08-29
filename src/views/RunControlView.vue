<template>
  <!-- R276 (97-09) — the redesigned operator control surface. A full-viewport
       Nocturne-dark shell (NOT AppShell), Run-scoped palette only. Two visual
       states driven by `live`: State A (pre-flight, !live) centres RunPreflightPanel
       beside the rail; State B (live) shows the program/next-up split, in-item
       filmstrip, displays panel and transport bar (blackout is a header toggle now).
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
      :rehearsing="rehearsing"
      :positionLabel="positionLabel"
      :clock="clock"
      :elapsed="elapsed"
      :audienceOpen="audienceOpen"
      :confidenceOpen="confidenceOpen"
      :blackout="blackout"
      @exit="onExitRequest"
      @reopen="reopenOutput"
      @toggle-blackout="postBlackout(!blackout)"
    />

    <!-- OUTPUT-STATUS CLUSTER REMOVED (owner fix #3). The redundant top status band
         (the spinner / "Displays ready" summary / per-role closed-recovery rows /
         compact blocked indicator) is gone. Its closed-window RECOVERY affordance
         (R274) now lives on RunDisplaysPanel in State B (owner fix #4), which carries
         each output's open / not-open / CLOSED + Reopen surface. The separate
         reassign / fallback / blocked / partial banners below are UNCHANGED. -->

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

      <!-- STATE B (live): the program/next-up preview split (RunPreviewPair) with
           the Displays panel as a right column beside/under the next-up preview
           (owner fix #4 — relocated from the bottom) and the in-item click-to-jump
           filmstrip (RunFilmstrip -> postIndex). Blackout is now a single toggle in
           the RunHeader (owner UAT — the old Black/Clear output panel was removed).
           RunDisplaysPanel now also carries the closed-window RECOVERY (R274) the
           removed top status band used to (owner fix #3). -->
      <section v-else class="flex-1 min-w-0 h-full flex flex-col gap-6 overflow-y-auto p-6 lg:p-8">
        <!-- Owner UAT 2×2 — RunPreviewPair now owns the whole preview grid: the
             LEFT column is the On-screen preview (top) over the "Slides in this
             item" filmstrip (bottom, its #under-current slot), and the RIGHT column
             is the Next-up preview (top) over the Displays panel (bottom, its
             #under-next slot). RunPreviewPair already lays the two panes out
             (On-screen lg:col-span-2 left, Next-up lg:col-span-1 right) and exposes
             a slot under each; the filmstrip keeps its own overflow-x-auto so it
             stays usable in the narrower left column. `rehearsing` makes the
             On-screen tag/ring read yellow "Rehearsing" in rehearse mode. -->
        <RunPreviewPair :current="current" :next="next" :live="live" :rehearsing="rehearsing">
          <template #under-current>
            <RunFilmstrip
              :slides="filmstripSlides"
              :indices="filmstripIndices"
              :currentIndex="index"
              @jump="postIndex"
            />
          </template>
          <template #under-next>
            <RunDisplaysPanel
              :audience="audience"
              :confidence="confidence"
              :live="live"
              :audienceClosed="audienceClosed"
              :confidenceClosed="confidenceClosed"
              :reassigning="monitorChanged"
              @reopen="reopenOutput"
              @manage="openManage"
            />
          </template>
        </RunPreviewPair>
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
  rehearsing,
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
  // output state machine + recovery (banners inline; closed-recovery on the panel)
  outputStatus,
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
  onExitRequest,
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
