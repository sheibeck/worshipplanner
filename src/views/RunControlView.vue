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
          <span class="text-xs text-gray-400">Audience → {{ readyAudienceLabel }}</span>
          <span class="text-xs text-gray-400">Confidence → {{ readyConfidenceLabel }}</span>
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useRouter } from 'vue-router'
import { useServiceAssembly } from '@/composables/useServiceAssembly'
import {
  openRunChannel,
  type BroadcastChannelFactory,
  type RunChannelHandle,
} from '@/utils/runChannel'
import { sortedSlotsWithIndex, firstAssembledIndexBySlot } from '@/utils/serviceSlots'
import {
  loadMapping,
  matchMapping,
  computeFingerprint,
  type MonitorMapping,
  type MonitorRole,
  type ScreenLike,
} from '@/utils/monitorConfig'
import { slotLabel, miscLabel } from '@/utils/slotTypes'
import { SERVICE_SECTION_LABELS, type ServiceSlot } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import SlideCanvas from '@/components/slides/SlideCanvas.vue'

/**
 * Testability seam (93/95-PATTERNS): the run-channel factory is injectable so
 * tests can drive the channel deterministically with an in-memory fake.
 * Production passes nothing and openRunChannel uses the native BroadcastChannel.
 */
const props = defineProps<{
  channelFactory?: BroadcastChannelFactory
}>()

// Shared service-load + read-only assembly core (95-01). Owns ?org=/:serviceId
// scoping, the localService initial-load watch, the read-only assembly, and the
// WR-02 subscribe gate — do NOT re-do any of it here, and (deliberately) it
// registers NO unsubscribeAll, so this in-app route never tears down peers.
const { serviceId, orgIdRef, localService, assembledSlideshow } = useServiceAssembly()
const router = useRouter()

// ── Single-writer channel + navigation model (R266) ──────────────────────────
const index = ref<number | null>(null)
let seq = 0
let handle: RunChannelHandle | null = null

/** The ONE place run state is written — every navigation flows through here. */
function postIndex(target: number) {
  index.value = target
  seq += 1
  handle?.postState({ index: target, blackout: false, seq })
}

/** onHello resend — MUST advance seq so runChannel's stale-drop accepts it. */
function resendCurrent() {
  if (index.value == null) return
  seq += 1
  handle?.postState({ index: index.value, blackout: false, seq })
}

const current = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value] ?? null),
)
const next = computed<AssembledSlide | null>(() =>
  index.value == null ? null : (assembledSlideshow.value[index.value + 1] ?? null),
)
const currentSlotIndex = computed<number | null>(() => current.value?.slotIndex ?? null)

const rail = computed(() => (localService.value ? sortedSlotsWithIndex(localService.value) : []))
const firstIndexBySlot = computed(() => firstAssembledIndexBySlot(assembledSlideshow.value))

/** slotIndex -> count of assembled slides, for the rail's per-item slide count. */
const slideCountBySlot = computed(() => {
  const counts = new Map<number, number>()
  for (const slide of assembledSlideshow.value) {
    counts.set(slide.slotIndex, (counts.get(slide.slotIndex) ?? 0) + 1)
  }
  return counts
})

/** A meaningful per-item title, falling back to the kind label. */
function itemTitle(slot: ServiceSlot): string {
  switch (slot.kind) {
    case 'SONG':
      return slot.songTitle?.trim() || 'Song'
    case 'HYMN':
      return slot.hymnName?.trim() || 'Hymn'
    case 'MISC':
      return miscLabel(slot)
    default:
      return slotLabel(slot)
  }
}

function countLabel(count: number): string {
  return count === 1 ? '1 slide' : `${count} slides`
}

/** Enriched rail rows: title/section/count + has-slides + active-by-slotIndex. */
const railRows = computed(() =>
  rail.value.map((item) => {
    const count = slideCountBySlot.value.get(item.index) ?? 0
    return {
      index: item.index,
      section: item.slot.section ? SERVICE_SECTION_LABELS[item.slot.section] : '',
      title: itemTitle(item.slot),
      count,
      hasSlides: firstIndexBySlot.value.has(item.index),
      isActive: item.index === currentSlotIndex.value,
    }
  }),
)

// ── Navigation ───────────────────────────────────────────────────────────────
function goBySlide(delta: number) {
  const len = assembledSlideshow.value.length
  if (len === 0) return
  const cur = index.value ?? 0
  postIndex(Math.min(Math.max(cur + delta, 0), len - 1))
}

function goByItem(delta: number) {
  const rows = rail.value
  let pos = rows.findIndex((it) => it.index === currentSlotIndex.value)
  // No active item yet: +1 finds the first navigable item, -1 is a no-op.
  while (true) {
    pos += delta
    const row = rows[pos]
    if (!row) return // walked past either end
    const t = firstIndexBySlot.value.get(row.index)
    if (t !== undefined) {
      postIndex(t)
      return
    }
    // empty slot — keep walking in the same direction
  }
}

function jumpToSlot(slotIndex: number) {
  const t = firstIndexBySlot.value.get(slotIndex)
  if (t === undefined) return // empty slot: not clickable, no-op
  postIndex(t)
}

// ── Auto-scroll the active rail row into view ────────────────────────────────
const railRef = ref<HTMLElement | null>(null)
const activeItemRef = ref<HTMLElement | null>(null)
function captureActiveRow(el: Element | ComponentPublicInstance | null, isActive: boolean) {
  if (isActive) activeItemRef.value = (el as HTMLElement | null) ?? null
}
watch(index, async () => {
  await nextTick()
  activeItemRef.value?.scrollIntoView({ block: 'nearest' })
})

// ── Keyboard (R265) ──────────────────────────────────────────────────────────
const confirmOpen = ref(false)
const cancelBtnRef = ref<HTMLButtonElement | null>(null)

function handleKeydown(e: KeyboardEvent) {
  if (confirmOpen.value) return // nav keys inert while the dialog is open
  const t = document.activeElement
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return // inert in text inputs
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
      e.preventDefault()
      goBySlide(1)
      break
    case 'ArrowLeft':
      e.preventDefault()
      goBySlide(-1)
      break
    case 'ArrowDown':
      e.preventDefault()
      goByItem(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      goByItem(-1)
      break
    case 'Escape':
      e.preventDefault()
      confirmOpen.value = true // OPEN the confirm — never immediate teardown
      break
    // 'B' is intentionally bound to nothing (reserved for a future blackout).
  }
}

// ── Output-window orchestration (R261 / R266) ────────────────────────────────
// The Go live gesture opens BOTH standalone output windows and (when the live
// monitors match a saved mapping) places each on its assigned screen. This runs
// ONLY from the run-go-live-btn click — NEVER onMounted. window.open (pop-up
// blocker) + requestFullscreen({ screen }) require a live transient activation
// traceable to a gesture task; after the Run click's router.push + the lazy
// route-chunk import() + the async auth/org beforeEach guard + the mount tick,
// Chrome/Edge no longer honor that activation on mount, so an onMounted open
// would silently open ZERO windows on a cold first Run while claiming success.
// The operator clicks Go live on the control screen to supply a FRESH, live
// activation for both window.open and requestFullscreen.
//
// HANDSHAKE (95-03): the channel is the single writer from mount and postIndex
// drives state whether or not a display is open; when Go live opens a window it
// postHellos and the control's onHello (resendCurrent) resends the current
// index — so the operator may click Go live at ANY time (even after navigating
// several slides) and the freshly-opened output syncs to the live slide.
type OutputStatus = 'idle' | 'opening' | 'placed' | 'partial' | 'fallback' | 'blocked'
const outputStatus = ref<OutputStatus>('idle')
const readyAudienceLabel = ref<string | null>(null)
const readyConfidenceLabel = ref<string | null>(null)
// WR-02: which display was refused when EXACTLY ONE of the two window.open
// calls came back null (the honest 'partial' state names the dark monitor).
const blockedRole = ref<MonitorRole | null>(null)

// Raw window handles (NOT reactive), keyed by stable window name.
const outputWindows: Record<string, Window | null> = {}

// WR-01: monotonic Go-live token + unmount flag guarding a LATE
// getScreenDetails() resolution from re-opening orphaned output windows after
// the operator has moved on (a fresh Go-live click, a confirmed exit, or an
// unmount). Mirrors MonitorSetupView's detectRequestId precedent: every new
// attempt bumps the token, and confirmExit/onUnmounted invalidate any in-flight
// resolve so its .then/.catch is a no-op — no window is ever opened after exit.
let goLiveRequestId = 0
let isUnmounted = false

/**
 * Opens ONE output window and (when a target screen is given) best-effort places
 * it there. Returns the ACTUAL window.open handle so callers gate their
 * "opened" claim on a real non-null window — a blocked pop-out (or jsdom)
 * returns null and must never be treated as opened, and must never throw.
 * PLAIN window.open (NO noopener/noreferrer): the HTML spec copies the opener's
 * sessionStorage — carrying the picked org — to the child only when the opener
 * relationship is preserved.
 */
function openWindow(url: string, name: string, screen: ScreenLike | null): Window | null {
  const features = screen
    ? `left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`
    : ''
  const win = window.open(url, name, screen ? features : '')
  outputWindows[name] = win
  if (!win) return null
  if (screen) {
    try {
      win.moveTo(screen.left, screen.top)
    } catch {
      // best-effort placement — never throw
    }
    try {
      // The non-standard `screen` fullscreen option is not in the base TS lib;
      // cast + guard. Real reliable fullscreen is each output window's OWN
      // affordance, so a rejection here is silent (never tear down).
      win.document?.documentElement?.requestFullscreen?.({
        screen,
      } as unknown as FullscreenOptions)
    } catch {
      // activation lost / embedding / unsupported — silent, best-effort
    }
  }
  return win
}

/** Resolve a role → its saved fingerprint → the live screen with that fingerprint. */
function resolveScreen(saved: MonitorMapping, role: MonitorRole, screens: ScreenLike[]): ScreenLike | null {
  const fingerprint = saved.assignments.find((a) => a.role === role)?.fingerprint
  if (!fingerprint) return null
  return screens.find((s) => computeFingerprint(s) === fingerprint) ?? null
}

function screenLabel(screen: ScreenLike | null): string {
  return screen?.label && screen.label.length > 0 ? screen.label : 'display'
}

/**
 * WR-02 — honest gate on the TWO output handles before any success claim.
 * A "placed"/"fallback" claim requires BOTH windows to have real (non-null)
 * handles, because some browsers grant only ONE window per user activation:
 *  - both null → 'blocked' (pop-ups refused, nothing opened)
 *  - one null  → 'partial' (one display is live, the other is dark) — the
 *                banner names the refused role and offers retry, NEVER green
 *  - both open → returns true so the caller may make its success claim
 * Returns true ONLY when both windows opened.
 */
function bothOpened(aWin: Window | null, cWin: Window | null): boolean {
  if (aWin && cWin) return true
  if (!aWin && !cWin) {
    outputStatus.value = 'blocked'
    return false
  }
  // Exactly one opened: name the display that was refused (the null handle).
  blockedRole.value = aWin ? 'confidence' : 'audience'
  outputStatus.value = 'partial'
  return false
}

/** MATCHED path — open + place each output on its assigned monitor. */
function openPlaced(saved: MonitorMapping, screens: ScreenLike[]) {
  const audienceScreen = resolveScreen(saved, 'audience', screens)
  const confidenceScreen = resolveScreen(saved, 'confidence', screens)
  const aWin = openWindow(audienceUrl(), 'wp-audience', audienceScreen)
  const cWin = openWindow(confidenceUrl(), 'wp-confidence', confidenceScreen)
  // Gate the success claim on BOTH real windows (WR-02): fewer than two → an
  // honest blocked/partial state, never a green "Displays ready" over a dark
  // monitor.
  if (!bothOpened(aWin, cWin)) return
  readyAudienceLabel.value = screenLabel(audienceScreen)
  readyConfidenceLabel.value = screenLabel(confidenceScreen)
  outputStatus.value = 'placed'
}

/** FALLBACK path — open both outputs un-positioned (operator drags + fullscreens). */
function openUnplaced() {
  const aWin = openWindow(audienceUrl(), 'wp-audience', null)
  const cWin = openWindow(confidenceUrl(), 'wp-confidence', null)
  // WR-02: the amber "two windows opened" fallback claim requires BOTH handles;
  // both-null is blocked, exactly-one-null is the honest partial state.
  if (!bothOpened(aWin, cWin)) return
  outputStatus.value = 'fallback'
}

// URLs computed at open time so they read the CURRENT serviceId/org.
function audienceUrl(): string {
  return `/present/audience/${serviceId.value}?org=${orgIdRef.value ?? ''}`
}
function confidenceUrl(): string {
  return `/present/confidence/${serviceId.value}?org=${orgIdRef.value ?? ''}`
}

/**
 * The Go-live gesture entry — bound to the run-go-live-btn click, run
 * SYNCHRONOUSLY. getScreenDetails() is the FIRST statement after the plain
 * feature-detect (the only line before it is a synchronous ref set), with NO
 * await/store/router before it, so its .then runs while the click's transient
 * activation is still live and window.open + requestFullscreen({ screen })
 * inside openPlaced act within the sanctioned one-gesture window (Pitfall 1/5).
 * Mirrors MonitorSetupView.onDetectClick.
 */
function openOutputs() {
  // WR-01: claim a fresh token for THIS gesture. A second Go-live click, a
  // confirmed exit, or an unmount bumps goLiveRequestId, so an earlier in-flight
  // getScreenDetails() resolve becomes stale and is dropped below.
  const requestId = ++goLiveRequestId
  outputStatus.value = 'opening'
  if (!('getScreenDetails' in window)) {
    openUnplaced()
    return
  }
  ;(window as unknown as { getScreenDetails: () => Promise<{ screens: ScreenLike[] }> })
    .getScreenDetails()
    .then((details) => {
      // Stale (a newer attempt superseded us) or the view has torn down — do
      // NOT open windows that would be orphaned (Pitfall 6 / WR-01).
      if (isUnmounted || requestId !== goLiveRequestId) return
      const saved = loadMapping()
      if (!saved) {
        openUnplaced()
        return
      }
      const result = matchMapping(saved, details.screens)
      if (result.status !== 'matched') {
        openUnplaced()
        return
      }
      openPlaced(saved, details.screens)
    })
    .catch(() => {
      if (isUnmounted || requestId !== goLiveRequestId) return
      openUnplaced()
    })
}

/** Guarded teardown of every opened output window — called first on exit. */
function closeOutputs() {
  for (const name of Object.keys(outputWindows)) {
    try {
      outputWindows[name]?.close()
    } catch {
      // a closed/cross-origin window .close() can throw — never propagate
    }
  }
}

// ── Exit confirm ─────────────────────────────────────────────────────────────
function openExitConfirm() {
  confirmOpen.value = true
}
function cancelExit() {
  confirmOpen.value = false
}
function confirmExit() {
  // WR-01: invalidate any in-flight Go-live resolve so a late getScreenDetails()
  // cannot re-open orphaned output windows after the operator has exited.
  goLiveRequestId += 1
  // Blank the projector FIRST — close the output windows before the channel
  // close + router.push, so ending run mode tears down the real displays (R266).
  closeOutputs()
  handle?.close()
  router.push({ name: 'service-editor', params: { id: serviceId.value } })
}
watch(confirmOpen, async (open) => {
  if (!open) return
  await nextTick()
  cancelBtnRef.value?.focus()
})

const serviceHeading = computed(() => {
  const svc = localService.value
  if (!svc) return ''
  return svc.date ? `${svc.name} · ${svc.date}` : svc.name
})

// ── Channel lifecycle + initial go-live ──────────────────────────────────────
onMounted(() => {
  handle = openRunChannel(serviceId.value, props.channelFactory)
  handle.onHello(resendCurrent)
  document.addEventListener('keydown', handleKeydown)
  if (index.value == null && assembledSlideshow.value.length > 0) postIndex(0)
})

// Assembly may arrive AFTER mount — go live on slide 0 once slides exist and the
// channel is open (guarded so there is never a double slide-0 post).
watch(assembledSlideshow, (slides) => {
  if (index.value == null && slides.length > 0) postIndex(0)
})

onUnmounted(() => {
  // WR-01: mark torn down so a late getScreenDetails() resolve short-circuits
  // instead of opening windows into a dead component.
  isUnmounted = true
  handle?.close()
  document.removeEventListener('keydown', handleKeydown)
})
</script>
