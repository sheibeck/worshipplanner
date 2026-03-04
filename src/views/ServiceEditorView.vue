<template>
  <AppShell>
    <div class="px-6 py-8">

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
          class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Services
        </router-link>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 class="text-xl font-semibold text-gray-100">{{ formattedDate }}</h1>
            <div class="flex items-center gap-2 mt-2">
              <!-- Progression badge -->
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-800">
                {{ localService.progression }}
              </span>
              <!-- Status badge -->
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                :class="statusBadgeClasses[localService.status]"
              >
                {{ localService.status === 'planned' ? 'Planned' : 'Draft' }}
              </span>
            </div>
          </div>

          <!-- Save area -->
          <div class="flex items-center gap-3">
            <span v-if="isDirty" class="text-xs text-amber-400">Unsaved changes</span>
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
        <div class="mb-6 rounded-lg bg-gray-900 border border-gray-800 p-4">
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Team Configuration</h2>
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

        <!-- Sermon Passage -->
        <div class="mb-6 rounded-lg bg-gray-900 border border-gray-800 p-4">
          <h2 class="text-sm font-semibold text-gray-200 mb-1">Sermon Passage</h2>
          <p class="text-xs text-gray-500 mb-3">Enter the pastor's teaching passage to avoid duplication in readings</p>
          <ScriptureInput
            :modelValue="localService.sermonPassage"
            :sermonPassage="null"
            :showOverlapWarning="false"
            label="Sermon Passage"
            @update:modelValue="onSermonPassageChange"
          />
        </div>

        <!-- 9-Slot Service Template -->
        <div class="space-y-3">
          <div
            v-for="slot in localService.slots"
            :key="slot.position"
            class="rounded-lg bg-gray-900 border border-gray-800 p-4"
          >
            <!-- SONG slot -->
            <template v-if="slot.kind === 'SONG'">
              <div class="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {{ SLOT_LABELS[slot.position] }}
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ vwTypeLabels[slot.requiredVwType] }}
                  </p>
                </div>
                <SongBadge :type="slot.requiredVwType" />
              </div>

              <!-- Assigned song display -->
              <div v-if="slot.songId" class="flex items-center justify-between gap-3 rounded-md bg-gray-800 border border-gray-700 px-3 py-2">
                <div>
                  <p class="text-sm font-medium text-gray-100">{{ slot.songTitle }}</p>
                  <p class="text-xs text-gray-500">Key: {{ slot.songKey }}</p>
                </div>
                <button
                  type="button"
                  @click="onClearSong(slot)"
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
                @select="(song) => onSelectSong(slot, song)"
                @clear="onClearSong(slot)"
              />
            </template>

            <!-- SCRIPTURE slot -->
            <template v-else-if="slot.kind === 'SCRIPTURE'">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Scripture Reading</p>

              <!-- Overlap warning -->
              <div
                v-if="localService.sermonPassage && slot.book && slot.chapter && slot.verseStart && slot.verseEnd && checkScriptureOverlap(slot)"
                class="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/50 rounded px-2 py-1 mb-2"
              >
                This passage overlaps with the sermon passage
              </div>

              <ScriptureInput
                :modelValue="slotToScriptureRef(slot)"
                :sermonPassage="localService.sermonPassage"
                :showOverlapWarning="true"
                label="Scripture Reading"
                @update:modelValue="(ref) => onScriptureChange(slot, ref)"
              />
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
        </div>

        <!-- Bottom save -->
        <div class="mt-6 flex justify-end">
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import { useSongStore } from '@/stores/songs'
import { SLOT_LABELS } from '@/utils/slotTypes'
import { scripturesOverlap } from '@/utils/scripture'
import type { Service, SongSlot, ScriptureSlot, ScriptureRef } from '@/types/service'
import AppShell from '@/components/AppShell.vue'
import SongBadge from '@/components/SongBadge.vue'
import SongSlotPicker from '@/components/SongSlotPicker.vue'
import ScriptureInput from '@/components/ScriptureInput.vue'

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

// ── Computed ───────────────────────────────────────────────────────────────────

const serviceId = computed(() => route.params.id as string)

const formattedDate = computed(() => {
  if (!localService.value?.date) return ''
  const [year, month, day] = localService.value.date.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
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
  // Don't unsubscribe serviceStore here — DashboardView may still be using it
})

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

// ── Song assignment ────────────────────────────────────────────────────────────

function onSelectSong(
  slot: SongSlot,
  song: { id: string; title: string; key: string },
) {
  if (!localService.value) return
  const slotIdx = localService.value.slots.findIndex(
    (s) => s.position === slot.position,
  )
  if (slotIdx >= 0) {
    localService.value.slots[slotIdx] = {
      ...localService.value.slots[slotIdx],
      songId: song.id,
      songTitle: song.title,
      songKey: song.key,
    } as SongSlot
  }
}

function onClearSong(slot: SongSlot) {
  if (!localService.value) return
  const slotIdx = localService.value.slots.findIndex(
    (s) => s.position === slot.position,
  )
  if (slotIdx >= 0) {
    localService.value.slots[slotIdx] = {
      ...localService.value.slots[slotIdx],
      songId: null,
      songTitle: null,
      songKey: null,
    } as SongSlot
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

function onScriptureChange(slot: ScriptureSlot, ref: ScriptureRef | null) {
  if (!localService.value) return
  const slotIdx = localService.value.slots.findIndex(
    (s) => s.position === slot.position,
  )
  if (slotIdx >= 0) {
    localService.value.slots[slotIdx] = {
      ...localService.value.slots[slotIdx],
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

function checkScriptureOverlap(slot: ScriptureSlot): boolean {
  const reading = slotToScriptureRef(slot)
  const sermon = localService.value?.sermonPassage ?? null
  if (!reading || !sermon) return false
  return scripturesOverlap(reading, sermon)
}

// ── Save ───────────────────────────────────────────────────────────────────────

async function onSave() {
  if (!localService.value || !isDirty.value) return
  isSaving.value = true
  try {
    const { id, createdAt, updatedAt, ...data } = localService.value

    // Find changed song slots and call assignSongToSlot for them
    // This handles the cross-store lastUsedAt write
    if (originalService.value) {
      const original = originalService.value
      for (const slot of localService.value.slots) {
        if (slot.kind === 'SONG') {
          const origSlot = original.slots.find(
            (s) => s.position === slot.position && s.kind === 'SONG',
          ) as SongSlot | undefined
          if (slot.songId && slot.songId !== origSlot?.songId) {
            // Song was assigned or changed — use assignSongToSlot for lastUsedAt write
            await serviceStore.assignSongToSlot(id, slot.position, {
              id: slot.songId,
              title: slot.songTitle!,
              key: slot.songKey!,
            })
          } else if (!slot.songId && origSlot?.songId) {
            // Song was cleared
            await serviceStore.clearSongFromSlot(id, slot.position)
          }
        }
      }
    }

    // Update all non-slot fields
    await serviceStore.updateService(id, {
      teams: data.teams,
      sermonPassage: data.sermonPassage,
      notes: data.notes,
      status: data.status,
      slots: data.slots,
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
