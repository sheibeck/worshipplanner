<template>
  <AppShell>
    <!-- Loading (127-UI-SPEC.md §7) -->
    <div v-if="state === 'loading'" class="flex flex-col items-center gap-3 py-16 text-center" data-testid="vsv-loading">
      <svg class="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <p class="text-sm text-gray-400">Loading this service&hellip;</p>
    </div>

    <!-- Access denied (T-127-10: no signal distinguishing denied vs. not found) -->
    <div v-else-if="state === 'access-denied'" class="flex flex-col items-center gap-3 py-16 text-center" data-testid="vsv-access-denied">
      <p class="text-sm text-gray-400">You don't have access to this service, or it's no longer available.</p>
      <router-link to="/my-schedule" class="text-sm text-indigo-400 hover:text-indigo-300">‹ Back to My Schedule</router-link>
    </div>

    <!-- Load failure (retryable, distinct from access-denied) -->
    <div v-else-if="state === 'load-failure'" class="flex flex-col items-center gap-3 py-16 text-center" data-testid="vsv-load-failure">
      <p class="text-sm text-gray-400">Couldn't load this service. Check your connection and try again.</p>
      <button type="button" data-testid="vsv-retry" class="text-sm text-indigo-400 hover:text-indigo-300" @click="retry">
        Retry
      </button>
    </div>

    <!-- Populated -->
    <template v-else-if="doc">
      <div class="px-4 sm:px-6 py-4">
      <!-- Mobile-only back link — on desktop the left nav is the way back, so
           it's hidden at lg+; on mobile (sidebar behind the hamburger) it's a
           helpful shortcut. Matches ServiceEditorView.vue's back-link styling. -->
      <router-link
        to="/my-schedule"
        class="lg:hidden inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        My Schedule
      </router-link>

      <!-- Header — the app's inline page-header convention (ServiceEditorView.vue),
           not a full-bleed band. -->
      <div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-3">
        <h1 class="text-xl font-semibold text-gray-100 truncate" :title="doc.title">{{ doc.title }}</h1>
        <p class="text-sm text-gray-400 shrink-0">{{ formattedDate }}</p>
      </div>

      <!-- "I've got it" confirm strip (R410) — deliberately lives here, NOT
           inside ScheduleServiceCard's whole-card router-link (133-RESEARCH.md
           Open Question 1, resolved). Renders nothing for a volunteer with no
           assignments on this service (e.g. a legacy doc predating
           roleAssignmentsByEmailLower). -->
      <VolunteerConfirmBar
        :org-id="doc.orgId"
        :service-id="doc.serviceId"
        :my-assignments="myAssignments"
      />

      <!-- Tabs — ServiceEditorView.vue's exact tablist container + tab-button
           classes + roving-tabindex + handleTabKeydown pattern (127-UI-SPEC.md §1).
           Always 3 tabs, never reordered/hidden. -->
      <div role="tablist" class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0" @keydown="handleTabKeydown">
        <button
          id="vsv-tab-rehearse"
          ref="rehearseTabButtonRef"
          role="tab"
          type="button"
          :aria-selected="activeTab === 'rehearse'"
          aria-controls="vsv-panel-rehearse"
          :tabindex="activeTab === 'rehearse' ? 0 : -1"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'rehearse'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'rehearse'"
        >
          Rehearse
        </button>
        <button
          id="vsv-tab-order"
          ref="orderTabButtonRef"
          role="tab"
          type="button"
          :aria-selected="activeTab === 'order'"
          aria-controls="vsv-panel-order"
          :tabindex="activeTab === 'order' ? 0 : -1"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'order'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'order'"
        >
          Order of Service
        </button>
        <button
          id="vsv-tab-stage"
          ref="stageTabButtonRef"
          role="tab"
          type="button"
          :aria-selected="activeTab === 'stage'"
          aria-controls="vsv-panel-stage"
          :tabindex="activeTab === 'stage' ? 0 : -1"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'stage'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'stage'"
        >
          Stage Layout
        </button>
      </div>

      <!-- Rehearse panel (R385-R390) -->
      <div v-show="activeTab === 'rehearse'" id="vsv-panel-rehearse" role="tabpanel" aria-labelledby="vsv-tab-rehearse" data-testid="vsv-panel-rehearse">
        <!-- Desktop (>=sm): all three columns mounted simultaneously
             (127-UI-SPEC.md §2). The row gets an explicit viewport-based height
             (percentage h-full doesn't resolve through AppShell's <main>), so
             the PDF reader fills the screen and each column scrolls internally.
             Offsets account for the header/tabs above (larger at sm/md where the
             AppShell mobile top bar + the back link are also present). -->
        <div
          class="hidden sm:flex sm:h-[calc(100dvh-13rem)] lg:h-[calc(100dvh-7.5rem)] max-w-[1600px] mx-auto w-full"
          :class="{ 'sm:pb-20': activeTrack }"
          data-testid="rehearse-desktop-layout"
        >
          <RehearseSongList
            :songs="songs"
            :selected-song-id="selectedSongId"
            :active-track-song-id="activeTrackSongId"
            @select="selectSong"
          />
          <RehearseSongDetail :song="selectedSong" @play="onPlay" @open-pdf="onOpenPdf" />
          <RehearseFileReader :attachment="selectedAttachment" />
        </div>

        <!-- Mobile (<sm): drill-down stack — one screen visible at a time,
             driven by mobileScreen (R391). The PDF reader here is link-first
             (mobileLinkFirst) — no inline iframe. -->
        <div class="sm:hidden" data-testid="rehearse-mobile-layout">
          <RehearseSongList
            v-if="mobileScreen === 'list'"
            :songs="songs"
            :selected-song-id="selectedSongId"
            :active-track-song-id="activeTrackSongId"
            @select="selectSong"
          />
          <template v-else-if="mobileScreen === 'detail'">
            <button
              type="button"
              aria-label="Back to song list"
              data-testid="vsv-mobile-back-to-list"
              class="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 px-4 pt-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              @click="mobileScreen = 'list'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Songs
            </button>
            <RehearseSongDetail :song="selectedSong" @play="onPlay" @open-pdf="onOpenPdf" />
          </template>
          <RehearseFileReader
            v-else-if="mobileScreen === 'reader'"
            :attachment="selectedAttachment"
            mobile-link-first
            @back="mobileScreen = 'detail'"
          />
        </div>

        <!-- The ONE persistent player instance — rendered OUTSIDE both the
             desktop and mobile conditional chains above so it never unmounts
             across screen/layout changes (127-PATTERNS.md Pattern 3, R391). -->
        <RehearseAudioPlayerBar :track="activeTrack" fixed-bottom />
      </div>

      <!-- Order of Service panel (R392) -->
      <div v-show="activeTab === 'order'" id="vsv-panel-order" role="tabpanel" aria-labelledby="vsv-tab-order" data-testid="vsv-panel-order">
        <VolunteerOrderOfService :order-of-service="doc.orderOfService" :role-assignments="doc.roleAssignments" />
      </div>

      <!-- Stage Layout panel (R393) -->
      <div v-show="activeTab === 'stage'" id="vsv-panel-stage" role="tabpanel" aria-labelledby="vsv-tab-stage" data-testid="vsv-panel-stage">
        <VolunteerStageLayoutTab :elements="doc.stageLayout?.elements" />
      </div>
      </div>
    </template>
  </AppShell>
</template>

<script setup lang="ts">
// Standalone, read-only tri-tab shell replacing VolunteerServicePlaceholderView
// at /volunteer/service/:serviceId (R384, R391, 127-UI-SPEC.md). Never
// imports/renders ServiceEditorView or any editing/messaging chrome
// (T-127-09) — orgId resolution is entirely delegated to
// useVolunteerServiceDoc (T-127-02), which trusts only the volunteer's own
// mySchedule store, never a route/query value.
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useVolunteerServiceDoc } from '@/composables/useVolunteerServiceDoc'
import { auth } from '@/firebase'
import AppShell from '@/components/AppShell.vue'
import RehearseSongList from '@/components/rehearse/RehearseSongList.vue'
import RehearseSongDetail from '@/components/rehearse/RehearseSongDetail.vue'
import RehearseFileReader from '@/components/rehearse/RehearseFileReader.vue'
import RehearseAudioPlayerBar from '@/components/rehearse/RehearseAudioPlayerBar.vue'
import VolunteerOrderOfService from '@/components/rehearse/VolunteerOrderOfService.vue'
import VolunteerStageLayoutTab from '@/components/rehearse/VolunteerStageLayoutTab.vue'
import VolunteerConfirmBar from '@/components/rehearse/VolunteerConfirmBar.vue'
import type { RehearseAttachment } from '@/utils/rehearseAccess'

const route = useRoute()

// serviceId is the ONLY thing this view reads from the route — orgId is
// resolved entirely inside the composable from the volunteer's own
// mySchedule store (T-127-02, never a route/query param).
//
// WR-02 (127-REVIEW): a plain string captured once here would go stale when
// Vue Router reuses this component instance across two /volunteer/service/:id
// URLs (e.g. back/forward between two rehearse links) — serviceId must stay a
// computed so useVolunteerServiceDoc's internal watch re-loads on change.
const serviceId = computed(() => route.params.serviceId as string)
const { state, doc, retry } = useVolunteerServiceDoc(serviceId)

// ── Service header ──────────────────────────────────────────────────────────
// Local-midnight ymd parse (mirrors ScheduleServiceCard.vue's own convention
// — never a date library).
const formattedDate = computed(() => {
  if (!doc.value) return ''
  const [y, m, d] = doc.value.serviceDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

// R410: the signed-in volunteer's own roles on this service, for
// VolunteerConfirmBar. `roleAssignmentsByEmailLower` is optional (absent on
// legacy docs predating Phase 133) — an absent field or unmatched email
// safely yields [], and the bar renders nothing (no crash).
const myAssignments = computed(() => {
  const emailLower = auth.currentUser?.email?.toLowerCase() ?? ''
  return doc.value?.roleAssignmentsByEmailLower?.[emailLower] ?? []
})

// ── Tabs (reused pattern: ServiceEditorView.vue's handleTabKeydown) ────────
type VsvTabId = 'rehearse' | 'order' | 'stage'
const activeTab = ref<VsvTabId>('rehearse')
const visibleTabOrder: VsvTabId[] = ['rehearse', 'order', 'stage']

const rehearseTabButtonRef = ref<HTMLButtonElement | null>(null)
const orderTabButtonRef = ref<HTMLButtonElement | null>(null)
const stageTabButtonRef = ref<HTMLButtonElement | null>(null)

function tabButtonRef(tab: VsvTabId) {
  switch (tab) {
    case 'rehearse':
      return rehearseTabButtonRef
    case 'order':
      return orderTabButtonRef
    case 'stage':
      return stageTabButtonRef
  }
}

function focusAndActivateTab(tab: VsvTabId): void {
  activeTab.value = tab
  tabButtonRef(tab).value?.focus()
}

function handleTabKeydown(event: KeyboardEvent): void {
  const tabs = visibleTabOrder
  const currentIndex = tabs.indexOf(activeTab.value)
  if (currentIndex === -1) return
  let nextIndex: number | null = null
  switch (event.key) {
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % tabs.length
      break
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = tabs.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  focusAndActivateTab(tabs[nextIndex]!)
}

// ── Rehearse tab state (song selection, reader, single shared active track) ─
const selectedSongId = ref<string | undefined>(undefined)
const selectedAttachment = ref<RehearseAttachment | undefined>(undefined)
const activeTrack = ref<RehearseAttachment | undefined>(undefined)
const mobileScreen = ref<'list' | 'detail' | 'reader'>('list')

// WR-02 (127-REVIEW): serviceId changing means a full context switch to a
// different service — reset per-service selection state so it can't carry
// over and reference the previous service's songs/tab.
watch(serviceId, () => {
  selectedSongId.value = undefined
  selectedAttachment.value = undefined
  activeTrack.value = undefined
  mobileScreen.value = 'list'
  activeTab.value = 'rehearse'
})

const songs = computed(() => doc.value?.songs ?? [])
const selectedSong = computed(() => songs.value.find((s) => s.id === selectedSongId.value))

// First song is the deterministic default selection (127-UI-SPEC.md §2) —
// only set once, and only if the volunteer hasn't already picked one.
watch(
  doc,
  (newDoc) => {
    if (newDoc && newDoc.songs.length > 0 && !selectedSongId.value) {
      selectedSongId.value = newDoc.songs[0]!.id
    }
  },
  { immediate: true },
)

// Feeds RehearseSongList's "● Playing" indicator (127-UI-SPEC.md §2 Column 1).
const activeTrackSongId = computed(() => {
  const track = activeTrack.value
  if (!track) return undefined
  return songs.value.find((s) => s.attachments.some((a) => a.id === track.id))?.id
})

function selectSong(songId: string): void {
  selectedSongId.value = songId
  selectedAttachment.value = undefined
  mobileScreen.value = 'detail'
}

function onPlay(attachment: RehearseAttachment): void {
  activeTrack.value = attachment
}

function onOpenPdf(attachment: RehearseAttachment): void {
  selectedAttachment.value = attachment
  mobileScreen.value = 'reader'
}
</script>
