<template>
  <div class="print:hidden">
  <AppShell>
    <div class="px-6 py-4">

      <!-- Loading skeleton -->
      <div v-if="serviceStore.isLoading" class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-800 rounded w-64"></div>
        <div class="h-4 bg-gray-800 rounded w-48"></div>
        <div v-for="i in 9" :key="i" class="h-20 bg-gray-800 rounded"></div>
      </div>

      <!-- Service not found -->
      <div v-else-if="!localService" class="text-center py-16">
        <p class="text-gray-400 text-lg mb-4">Service not found</p>
        <router-link
          to="/services"
          class="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
        >
          &larr; Back to services
        </router-link>
      </div>

      <!-- Editor -->
      <template v-else>
        <!-- Back link -->
        <router-link
          to="/services"
          class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Services
        </router-link>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-100">{{ formattedDate }}</h1>
            <input
              v-if="localService.teams.includes('Special Service')"
              v-model="localService.name"
              type="text"
              placeholder="Service name (e.g. Good Friday, Easter)"
              class="mt-1 w-full max-w-sm rounded-md bg-gray-800 border border-gray-700 text-indigo-300 text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
            />
            <div class="flex items-center gap-2 mt-2">
              <!-- Status badge -->
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                :class="statusBadgeClasses[localService.status]"
              >
                {{ localService.status === 'planned' ? 'Planned' : 'Draft' }}
              </span>
              <!-- Communion badge -->
              <span
                v-if="isCommunion"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-800"
              >Communion</span>
            </div>
          </div>

          <!-- Save area -->
          <div class="flex items-center gap-3">
            <span v-if="isDirty" class="text-xs text-amber-400">Unsaved changes</span>

            <!-- Print button -->
            <button
              type="button"
              data-testid="print-btn"
              @click="onPrint"
              :disabled="!localService"
              class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>

            <!-- Copy for PC button (with inline "Copied!" feedback) -->
            <button
              type="button"
              data-testid="copy-pc-btn"
              @click="onCopyForPC"
              :disabled="!localService"
              class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <svg v-if="!pcCopied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ pcCopied ? 'Copied!' : 'Copy for PC' }}
            </button>

            <!-- Share button -->
            <button
              type="button"
              @click="onShare"
              :disabled="!localService || isSharing"
              class="print:hidden inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <svg v-if="!shareCopied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ isSharing ? 'Sharing...' : shareCopied ? 'Link Copied!' : shareError ? shareError : 'Share' }}
            </button>

            <button
              type="button"
              @click="onSave"
              :disabled="!isDirty || isSaving"
              class="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
              :class="isDirty && !isSaving
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'bg-indigo-600/40 cursor-not-allowed text-white/50'"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>

        <!-- Team configuration -->
        <div class="mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3">
          <div class="flex items-center gap-4">
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Teams</h2>
          <div class="flex flex-wrap gap-4">
            <label
              v-for="team in AVAILABLE_TEAMS"
              :key="team"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="localService.teams.includes(team)"
                @change="toggleTeam(team)"
                class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
              />
              <span class="text-sm text-gray-200">{{ team }}</span>
            </label>
          </div>
          </div>
        </div>

        <!-- Sermon Passage -->
        <div class="mb-3 rounded-lg bg-gray-900 border border-gray-800 p-3">
          <div class="flex items-center gap-4">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Sermon Passage</h2>
            <div class="flex-1">
              <ScriptureInput
                :modelValue="localService.sermonPassage"
                :sermonPassage="null"
                :showOverlapWarning="false"
                label="Sermon Passage"
                @update:modelValue="onSermonPassageChange"
              />
            </div>
          </div>
        </div>

        <!-- Dynamic Service Flow -->
        <div ref="slotContainerRef" class="space-y-1.5">
          <div
            v-for="(slot, index) in localService.slots"
            :key="slot.position + '-' + slot.kind + '-' + index"
            class="rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-start gap-2"
          >
            <!-- Drag handle -->
            <div class="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 drag-handle flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
              </svg>
            </div>

            <!-- Slot content -->
            <div class="flex-1 min-w-0">
              <!-- SONG slot -->
              <template v-if="slot.kind === 'SONG'">
                <div class="flex items-center justify-between gap-3 mb-1">
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {{ slotLabel(slot, index) }}
                    </p>
                    <span class="text-xs text-gray-600">&middot;</span>
                    <p class="text-xs text-gray-500">
                      {{ vwTypeLabels[slot.requiredVwType] }}
                    </p>
                    <!-- VW type selector buttons -->
                    <div class="flex items-center gap-1 ml-1">
                      <button
                        v-for="vt in ([1, 2, 3] as VWType[])"
                        :key="vt"
                        type="button"
                        @click="changeVwType(index, vt)"
                        class="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                        :class="slot.requiredVwType === vt
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
                      >{{ vt }}</button>
                    </div>
                  </div>
                  <SongBadge :type="slot.requiredVwType" />
                </div>

                <!-- Assigned song display -->
                <div v-if="slot.songId" class="flex items-center justify-between gap-3 rounded-md bg-gray-800 border border-gray-700 px-3 py-2">
                  <div>
                    <p class="text-sm font-medium text-gray-100">{{ slot.songTitle }}</p>
                    <p class="text-xs text-gray-500">
                      Key: {{ slot.songKey }}
                      <template v-if="getCcliNumber(slot.songId)">
                        <span class="text-gray-700 mx-1">|</span>
                        <a
                          :href="`https://songselect.ccli.com/songs/${getCcliNumber(slot.songId)}`"
                          target="_blank"
                          rel="noopener"
                          class="text-indigo-400 hover:text-indigo-300 hover:underline"
                          @click.stop
                        >CCLI {{ getCcliNumber(slot.songId) }}</a>
                      </template>
                    </p>
                  </div>
                  <button
                    type="button"
                    @click="onClearSong(index)"
                    class="text-gray-500 hover:text-gray-300 transition-colors"
                    title="Remove song"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Song picker (empty slot or change) -->
                <SongSlotPicker
                  :requiredVwType="slot.requiredVwType"
                  :serviceTeams="localService.teams"
                  :currentSongId="slot.songId"
                  :songs="songStore.songs"
                  @select="(song) => onSelectSong(index, song)"
                  @clear="onClearSong(index)"
                />
              </template>

              <!-- SCRIPTURE slot -->
              <template v-else-if="slot.kind === 'SCRIPTURE'">
                <div class="flex items-center gap-4">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Scripture Reading</p>
                  <div class="flex-1">
                    <ScriptureInput
                      :modelValue="slotToScriptureRef(slot)"
                      :sermonPassage="localService.sermonPassage"
                      :showOverlapWarning="true"
                      label="Scripture Reading"
                      @update:modelValue="(ref) => onScriptureChange(index, ref)"
                    />
                  </div>
                </div>
              </template>

              <!-- PRAYER slot -->
              <template v-else-if="slot.kind === 'PRAYER'">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prayer</p>
                <p class="text-sm text-gray-600 italic">No assignment needed</p>
              </template>

              <!-- MESSAGE slot -->
              <template v-else-if="slot.kind === 'MESSAGE'">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Message</p>
                <p class="text-sm text-gray-600 italic">No assignment needed</p>
              </template>
            </div>

            <!-- Remove button -->
            <button
              type="button"
              @click="removeSlot(index)"
              class="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
              title="Remove element"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Add Element button -->
        <div class="mt-2 relative">
          <button
            type="button"
            @click="showAddMenu = !showAddMenu"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-gray-300 bg-gray-900 hover:bg-gray-800 transition-colors border border-gray-700 border-dashed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Element
          </button>

          <!-- Click-away backdrop -->
          <div
            v-if="showAddMenu"
            class="fixed inset-0 z-10"
            @click="showAddMenu = false"
          ></div>

          <!-- Dropdown menu (opens upward) -->
          <div
            v-if="showAddMenu"
            class="absolute left-0 bottom-full mb-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden"
          >
            <button type="button" @click="addSlot('SONG', 2)" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Song</button>
            <button type="button" @click="addSlot('SCRIPTURE')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Scripture Reading</button>
            <button type="button" @click="addSlot('PRAYER')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Prayer</button>
            <button type="button" @click="addSlot('MESSAGE')" class="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 w-full text-left transition-colors">Message</button>
          </div>
        </div>

        <!-- Bottom save -->
        <div class="mt-3 flex justify-end">
          <span v-if="isDirty" class="text-xs text-amber-400 self-center mr-3">Unsaved changes</span>
          <button
            type="button"
            @click="onSave"
            :disabled="!isDirty || isSaving"
            class="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
            :class="isDirty && !isSaving
              ? 'bg-indigo-600 hover:bg-indigo-500'
              : 'bg-indigo-600/40 cursor-not-allowed text-white/50'"
          >
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </template>
    </div>
  </AppShell>
  </div>

  <!-- Print layout: hidden on screen, visible when printing -->
  <ServicePrintLayout
    v-if="localService"
    :service="localService"
    :songs="songStore.songs"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useSongStore } from '@/stores/songs'
import { slotLabel, createSlot, reindexSlots } from '@/utils/slotTypes'
import { scripturesOverlap } from '@/utils/scripture'
import type { Service, SongSlot, ScriptureSlot, ScriptureRef, SlotKind } from '@/types/service'
import type { VWType } from '@/types/song'
import AppShell from '@/components/AppShell.vue'
import SongBadge from '@/components/SongBadge.vue'
import SongSlotPicker from '@/components/SongSlotPicker.vue'
import ScriptureInput from '@/components/ScriptureInput.vue'
import ServicePrintLayout from '@/components/ServicePrintLayout.vue'
import { formatForPlanningCenter } from '@/utils/planningCenterExport'
import Sortable from 'sortablejs'

const route = useRoute()
const authStore = useAuthStore()
const serviceStore = useServiceStore()
const songStore = useSongStore()

// ── Constants ─────────────────────────────────────────────────────────────────

const AVAILABLE_TEAMS = ['Choir', 'Orchestra', 'Special Service']

// Static class lookup — prevent Tailwind v4 purge
const vwTypeLabels: Record<1 | 2 | 3, string> = {
  1: 'Type 1: Call to Worship',
  2: 'Type 2: Intimate',
  3: 'Type 3: Ascription',
}

const statusBadgeClasses: Record<string, string> = {
  planned: 'bg-green-900/50 text-green-300 border-green-800',
  draft: 'bg-gray-800 text-gray-400 border-gray-700',
}

// ── Local state ────────────────────────────────────────────────────────────────

const localService = ref<Service | null>(null)
const originalService = ref<Service | null>(null)
const isSaving = ref(false)
const pcCopied = ref(false)
const isSharing = ref(false)
const shareCopied = ref(false)
const shareError = ref<string | null>(null)
const showAddMenu = ref(false)

// ── Sortable ───────────────────────────────────────────────────────────────────

const slotContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

watch(slotContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'opacity-30',
      onEnd(evt) {
        if (!localService.value || evt.oldIndex == null || evt.newIndex == null) return
        if (evt.oldIndex === evt.newIndex) return
        const slots = [...localService.value.slots]
        const moved = slots.splice(evt.oldIndex, 1)[0]
        if (!moved) return
        slots.splice(evt.newIndex, 0, moved)
        localService.value.slots = reindexSlots(slots)
        // Force Vue to re-render in sync with our data
        nextTick(() => {
          // After Vue re-renders, Sortable DOM will be correct
        })
      },
    })
  }
}, { flush: 'post' })

// ── Computed ───────────────────────────────────────────────────────────────────

const serviceId = computed(() => route.params.id as string)

const parsedDate = computed(() => {
  if (!localService.value?.date) return null
  const parts = localService.value.date.split('-').map(Number)
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  return new Date(year, month - 1, day)
})

const formattedDate = computed(() => {
  if (!parsedDate.value) return ''
  return parsedDate.value.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})

const isCommunion = computed(() => {
  if (!parsedDate.value) return false
  return parsedDate.value.getDay() === 0 && parsedDate.value.getDate() <= 7
})

const isDirty = computed(() => {
  if (!localService.value || !originalService.value) return false
  return JSON.stringify(localService.value) !== JSON.stringify(originalService.value)
})

// ── Watch for service store changes ───────────────────────────────────────────

watch(
  () => serviceStore.services,
  (services) => {
    if (!localService.value) {
      // Initial load: populate from store
      const found = services.find((s) => s.id === serviceId.value)
      if (found) {
        localService.value = JSON.parse(JSON.stringify(found))
        originalService.value = JSON.parse(JSON.stringify(found))
      }
    }
  },
  { immediate: true, deep: true },
)

// ── Init ───────────────────────────────────────────────────────────────────────

async function initStores() {
  const user = authStore.user
  if (!user) return
  const userSnap = await getDoc(doc(db, 'users', user.uid))
  const orgIds: string[] = userSnap.data()?.orgIds ?? []
  if (orgIds[0]) {
    if (!serviceStore.orgId) {
      serviceStore.subscribe(orgIds[0])
    }
    if (!songStore.orgId) {
      songStore.subscribe(orgIds[0])
    }
  }
}

onMounted(async () => {
  await initStores()
})

onUnmounted(() => {
  sortableInstance?.destroy()
  sortableInstance = null
  // Don't unsubscribe serviceStore here — DashboardView may still be using it
})

// ── CCLI helper ────────────────────────────────────────────────────────────────

function getCcliNumber(songId: string): string | null {
  return songStore.songs.find((s) => s.id === songId)?.ccliNumber || null
}

// ── Team toggle ────────────────────────────────────────────────────────────────

function toggleTeam(team: string) {
  if (!localService.value) return
  const idx = localService.value.teams.indexOf(team)
  if (idx >= 0) {
    localService.value.teams.splice(idx, 1)
  } else {
    localService.value.teams.push(team)
  }
}

// ── Dynamic slot add/remove ────────────────────────────────────────────────────

function addSlot(kind: SlotKind, vwType?: VWType) {
  if (!localService.value) return
  const newSlot = createSlot(kind, vwType)
  localService.value.slots.push(newSlot)
  localService.value.slots = reindexSlots(localService.value.slots)
  showAddMenu.value = false
}

function removeSlot(index: number) {
  if (!localService.value) return
  localService.value.slots.splice(index, 1)
  localService.value.slots = reindexSlots(localService.value.slots)
}

function changeVwType(index: number, vwType: VWType) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    ;(localService.value.slots[index] as SongSlot).requiredVwType = vwType
  }
}

// ── Song assignment ────────────────────────────────────────────────────────────

function onSelectSong(
  index: number,
  song: { id: string; title: string; key: string },
) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    const updated: SongSlot = { ...slot, songId: song.id, songTitle: song.title, songKey: song.key }
    localService.value.slots[index] = updated
  }
}

function onClearSong(index: number) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SONG') {
    const updated: SongSlot = { ...slot, songId: null, songTitle: null, songKey: null }
    localService.value.slots[index] = updated
  }
}

// ── Scripture ──────────────────────────────────────────────────────────────────

function slotToScriptureRef(slot: ScriptureSlot): ScriptureRef | null {
  if (!slot.book || !slot.chapter || !slot.verseStart || !slot.verseEnd) return null
  return {
    book: slot.book,
    chapter: slot.chapter,
    verseStart: slot.verseStart,
    verseEnd: slot.verseEnd,
  }
}

function onScriptureChange(index: number, ref: ScriptureRef | null) {
  if (!localService.value) return
  const slot = localService.value.slots[index]
  if (!slot) return
  if (slot.kind === 'SCRIPTURE') {
    localService.value.slots[index] = {
      ...slot,
      book: ref?.book ?? null,
      chapter: ref?.chapter ?? null,
      verseStart: ref?.verseStart ?? null,
      verseEnd: ref?.verseEnd ?? null,
    } as ScriptureSlot
  }
}

function onSermonPassageChange(ref: ScriptureRef | null) {
  if (!localService.value) return
  localService.value.sermonPassage = ref
}

// Keep for use in ScriptureInput overlap detection (via the component itself)
function checkScriptureOverlap(slot: ScriptureSlot): boolean {
  const reading = slotToScriptureRef(slot)
  const sermon = localService.value?.sermonPassage ?? null
  if (!reading || !sermon) return false
  return scripturesOverlap(reading, sermon)
}

// Suppress unused warning — this function is available for future template use
void checkScriptureOverlap

// ── Print & Copy for PC ────────────────────────────────────────────────────────

function onPrint() {
  window.print()
}

async function onCopyForPC() {
  if (!localService.value) return
  const text = formatForPlanningCenter(localService.value, songStore.songs)
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
  }
  pcCopied.value = true
  setTimeout(() => {
    pcCopied.value = false
  }, 2000)
}

async function onShare() {
  if (!localService.value || !serviceStore.orgId) return
  isSharing.value = true
  try {
    const token = await serviceStore.createShareToken(localService.value, serviceStore.orgId)
    const url = `${window.location.origin}/share/${token}`
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    setTimeout(() => {
      shareCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Share failed:', err)
    shareError.value = 'Failed to create share link'
    setTimeout(() => {
      shareError.value = null
    }, 3000)
  } finally {
    isSharing.value = false
  }
}

// ── Save ───────────────────────────────────────────────────────────────────────

async function onSave() {
  if (!localService.value || !isDirty.value) return
  isSaving.value = true
  try {
    const { id, createdAt, updatedAt, ...data } = localService.value

    // Compare song IDs globally to update lastUsedAt for newly assigned songs
    if (originalService.value) {
      const original = originalService.value
      const newSongIds = new Set(
        localService.value.slots
          .filter((s) => s.kind === 'SONG' && (s as SongSlot).songId)
          .map((s) => (s as SongSlot).songId!),
      )
      const oldSongIds = new Set(
        original.slots
          .filter((s) => s.kind === 'SONG' && (s as SongSlot).songId)
          .map((s) => (s as SongSlot).songId!),
      )

      // Update lastUsedAt for newly added songs
      for (const songId of newSongIds) {
        if (!oldSongIds.has(songId)) {
          const songSlot = localService.value.slots.find(
            (s) => s.kind === 'SONG' && (s as SongSlot).songId === songId,
          ) as SongSlot
          await serviceStore.assignSongToSlot(id, localService.value.slots.indexOf(songSlot), {
            id: songId,
            title: songSlot.songTitle!,
            key: songSlot.songKey!,
          })
        }
      }
    }

    // Persist the full slot array (reindexed) and other fields
    await serviceStore.updateService(id, {
      name: data.name,
      teams: data.teams,
      sermonPassage: data.sermonPassage,
      notes: data.notes,
      status: data.status,
      slots: reindexSlots(data.slots),
    })

    // Sync local state with store
    const updated = serviceStore.services.find((s) => s.id === id)
    if (updated) {
      localService.value = JSON.parse(JSON.stringify(updated))
      originalService.value = JSON.parse(JSON.stringify(updated))
    } else {
      originalService.value = JSON.parse(JSON.stringify(localService.value))
    }
  } finally {
    isSaving.value = false
  }
}
</script>
