<template>
  <!-- R261 — the standalone operator control surface. A full-viewport dark
       shell (NOT AppShell): a top bar, a main region (order-of-service rail +
       dual preview stage), and an always-visible keyboard legend. Its ONLY exit
       is the Exit affordance -> confirm dialog (R265). This view is the SINGLE
       WRITER of the wp-run-{serviceId} channel (R266): every navigation posts a
       fresh { index, blackout:false, seq } with a monotonic, view-owned seq. -->
  <div class="fixed inset-0 flex flex-col bg-gray-950 text-gray-100">
    <!-- 1. TOP BAR -->
    <header class="h-14 flex-none bg-gray-900 border-b border-gray-800 px-6 flex items-center gap-4">
      <h1 class="text-xl font-semibold text-gray-100 truncate" data-testid="run-service-name">
        {{ serviceHeading }}
      </h1>

      <!-- OUTPUT-STATUS CLUSTER (95-04) — center-right, before Exit. Renders by
           outputStatus: idle shows the Go live action, opening the spinner,
           placed the green "Displays ready" summary, blocked a compact honest
           indicator + retry. In 'fallback' the cluster is empty — the amber
           banner below carries it. -->
      <div class="ml-auto flex items-center gap-4">
        <!-- IDLE: the primary Go live action (the ONLY caller of openOutputs). -->
        <div v-if="outputStatus === 'idle'" class="flex flex-col items-end gap-0.5">
          <button
            type="button"
            data-testid="run-go-live-btn"
            aria-label="Go live — open the audience and confidence displays"
            class="min-h-11 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="openOutputs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
              <rect x="2" y="4" width="20" height="14" rx="2" ry="2" stroke-width="0" fill="none" />
            </svg>
            Go live
          </button>
          <span class="text-xs text-gray-400">Open the audience &amp; confidence displays</span>
        </div>

        <!-- OPENING: transient spinner while getScreenDetails/window.open run. -->
        <div
          v-else-if="outputStatus === 'opening'"
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

      <button
        type="button"
        data-testid="run-exit-btn"
        aria-label="Exit run mode (Esc)"
        class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-gray-300 hover:text-white hover:bg-gray-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        @click="openExitConfirm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- OUTPUT-STATUS BANNERS (95-04) — a sibling band between the top bar and
         the main region (pushes it down, never overlays). Fallback and blocked
         are MUTUALLY EXCLUSIVE by outputStatus. -->
    <!-- REASSIGN (96-01): a monitor was unplugged/rearranged mid-service. First
         in the band (visually senior), independent of outputStatus, and while it
         shows the per-role reopen chip is suppressed (precedence). Amber, never
         red — distinguishable from the closed-window row by heading + verb. -->
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
        <!-- WR-01 HONESTY: only the IN-PLACE reopen below preserves your slide.
             The banner promises place-preservation for THAT action only — it does
             NOT claim a same-tab monitor-setup round-trip keeps your place (that
             would unmount the control and desync the still-open outputs). -->
        <p class="mt-1 text-sm">
          A display was unplugged or rearranged, so we can't place the {{ reassignRole }} output on its old
          screen. Your service is still live — reopen the {{ reassignRole }} display below to keep going
          without losing your place.
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <!-- PRIMARY (place-preserving): re-resolve the affected role against the
               CURRENT live screens and reopen it IN PLACE. The control never
               unmounts; the reopened output re-syncs to the current slide via its
               hello → resendCurrent handshake. If the monitor is truly gone the
               output opens un-positioned (honest fallback) — still no lost session. -->
          <button
            type="button"
            data-testid="run-reassign-reopen"
            :aria-label="`Reopen and replace the ${reassignRole} display on the current screen`"
            class="min-h-11 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="reopenReassignedOutputs"
          >
            Reopen &amp; replace {{ reassignRole }}
          </button>
          <!-- SECONDARY: monitor setup in a NEW TAB (target=_blank) so the running
               control — its index/seq/channel + the open outputs — stays alive. A
               same-tab navigation would tear the live session down. -->
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
        <!-- The cluster already renders run-go-live-retry in the blocked state,
             so this banner uses its own primary-button testid to avoid a
             duplicate id (both render simultaneously while blocked). -->
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

    <!-- PARTIAL (WR-02): EXACTLY ONE output window opened; the other was refused
         by the browser (some grant only one window per gesture). Amber, honest —
         names the dark display and offers retry, NEVER a green "displays ready"
         claim while a monitor is black. Mutually exclusive with fallback/blocked
         by the single outputStatus ref. -->
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

    <!-- 2. MAIN REGION -->
    <div class="flex-1 min-h-0 flex">
      <!-- ORDER-OF-SERVICE RAIL (R262 / R263) -->
      <aside
        ref="railRef"
        class="w-80 flex-none h-full overflow-y-auto bg-gray-900 border-r border-gray-800"
      >
        <h2
          class="sticky top-0 z-10 bg-gray-900 text-base font-semibold text-gray-100 px-4 py-3 border-b border-gray-800"
        >
          Order of Service
        </h2>

        <!-- Empty state: a locked service with zero assembled slides anywhere. -->
        <div
          v-if="firstIndexBySlot.size === 0"
          class="px-4 py-8 text-center text-gray-400"
          data-testid="run-rail-empty"
        >
          <p class="text-sm font-semibold text-gray-300 mb-1">Nothing to present yet</p>
          <p class="text-xs text-gray-500">
            This service doesn't have any slides. Add songs or scripture in the service editor, then Run
            again.
          </p>
        </div>

        <ul v-else class="p-2 space-y-1">
          <li v-for="row in railRows" :key="row.index">
            <!-- Default (has slides) OR active "you are here" row -->
            <button
              v-if="row.hasSlides"
              type="button"
              data-testid="rail-item"
              :data-active="row.isActive"
              :ref="(el) => captureActiveRow(el, row.isActive)"
              class="w-full text-left px-3 py-2.5 min-h-11 rounded-md flex items-start gap-3 border-l-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="
                row.isActive
                  ? 'bg-indigo-600/15 border-indigo-500'
                  : 'border-transparent text-gray-300 hover:bg-gray-800/60 cursor-pointer'
              "
              @click="jumpToSlot(row.index)"
            >
              <span
                v-if="row.isActive"
                class="mt-1 h-2 w-2 flex-none rounded-full bg-indigo-400"
                aria-hidden="true"
              ></span>
              <span class="min-w-0 flex-1">
                <span v-if="row.section" class="block text-xs text-gray-500">{{ row.section }}</span>
                <span
                  class="block text-sm truncate"
                  :class="row.isActive ? 'text-gray-100 font-semibold' : 'text-gray-300'"
                >
                  {{ row.title }}
                </span>
              </span>
              <span class="flex-none text-xs text-gray-500">{{ countLabel(row.count) }}</span>
            </button>

            <!-- No assembled slides: non-interactive, dimmer, click is a no-op -->
            <div
              v-else
              data-testid="rail-item-empty"
              aria-disabled="true"
              class="w-full text-left px-3 py-2.5 min-h-11 rounded-md flex items-start gap-3 border-l-2 border-transparent text-gray-600 cursor-default"
            >
              <span class="min-w-0 flex-1">
                <span v-if="row.section" class="block text-xs text-gray-600">{{ row.section }}</span>
                <span class="block text-sm truncate">{{ row.title }}</span>
                <span class="block text-xs text-gray-600">No slides</span>
              </span>
            </div>
          </li>
        </ul>
      </aside>

      <!-- DUAL PREVIEW STAGE (R264 / R266) -->
      <section class="flex-1 min-w-0 h-full p-6 lg:p-8 flex flex-col">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <!-- CURRENT (dominant, live) -->
          <div class="lg:col-span-2">
            <div class="mb-2 flex items-center">
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-gray-100"
              >
                <span class="h-2 w-2 rounded-full bg-red-500" aria-hidden="true"></span>
                LIVE
              </span>
            </div>
            <div
              data-testid="run-current-preview"
              class="relative aspect-video rounded-lg overflow-hidden ring-2 ring-indigo-500 bg-black"
            >
              <SlideCanvas v-if="current" :slide="current" :interactive="false" />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
              >
                Loading slideshow…
              </div>
            </div>
          </div>

          <!-- NEXT (subordinate) -->
          <div class="lg:col-span-1">
            <div class="mb-2">
              <span class="text-xs font-semibold text-gray-400">Next up</span>
            </div>
            <div
              data-testid="run-next-preview"
              class="relative aspect-video rounded-lg overflow-hidden ring-1 ring-gray-800 bg-gray-900"
            >
              <SlideCanvas v-if="next" :slide="next" :interactive="false" />
              <div
                v-else
                class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
              >
                End of service
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 3. BOTTOM LEGEND STRIP -->
    <footer
      class="h-9 flex-none bg-gray-900 border-t border-gray-800 px-6 flex items-center gap-4 text-xs text-gray-500"
    >
      <span class="flex items-center gap-1.5">
        <kbd class="bg-gray-800 text-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px]">→ / Space</kbd>
        Next
      </span>
      <span class="flex items-center gap-1.5">
        <kbd class="bg-gray-800 text-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px]">←</kbd>
        Previous
      </span>
      <span class="flex items-center gap-1.5">
        <kbd class="bg-gray-800 text-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px]">↑ / ↓</kbd>
        Item
      </span>
      <span class="flex items-center gap-1.5">
        <kbd class="bg-gray-800 text-gray-300 rounded px-1.5 py-0.5 font-mono text-[11px]">Esc</kbd>
        Exit
      </span>
    </footer>

    <!-- 4. EXIT-CONFIRM DIALOG (R265) -->
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
import SlideCanvas from '@/components/slides/SlideCanvas.vue'

/**
 * Testability seam (93/95-PATTERNS): the run-channel factory is injectable so
 * tests can drive the channel deterministically with an in-memory fake.
 * Production passes nothing and openRunChannel uses the native BroadcastChannel.
 */
const props = defineProps<{
  channelFactory?: BroadcastChannelFactory
}>()

// R276 seam (97-01): the ENTIRE Phase 92-96 control-core — the single-writer
// channel, navigation model, rail derivations, honest open state machine, WR-01
// stale guard, 96-01 recovery, exit/teardown ordering, and the document keyboard
// handler — lives in useRunControl. This view is now template + this destructure;
// the composable registers its own onMounted/onUnmounted lifecycle. The unchanged
// template below binds every identifier returned here.
const {
  serviceHeading,
  current,
  next,
  railRows,
  firstIndexBySlot,
  countLabel,
  jumpToSlot,
  railRef,
  captureActiveRow,
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
  confirmOpen,
  openExitConfirm,
  cancelExit,
  confirmExit,
  cancelBtnRef,
} = useRunControl({ channelFactory: props.channelFactory })

</script>
