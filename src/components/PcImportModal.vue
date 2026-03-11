<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/60"
        @click="onClose"
      ></div>
    </Transition>

    <!-- Modal -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="onClose"
      >
        <div class="w-full max-w-lg max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 class="text-base font-semibold text-gray-100">Import from Planning Center</h2>
              <p class="text-xs text-gray-400 mt-0.5">Sync songs directly from your PC Music library</p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              @click="onClose"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto">

            <!-- Idle state -->
            <div v-if="step === 'idle'" class="px-6 py-8">
              <!-- No credentials banner -->
              <div
                v-if="!authStore.hasPcCredentials"
                class="rounded-lg bg-red-900/20 border border-red-800 p-4 mb-6"
              >
                <div class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-red-300">PC credentials not configured</p>
                    <p class="text-xs text-red-400/80 mt-1">Go to Settings to add your App ID and Secret.</p>
                  </div>
                </div>
              </div>

              <!-- Ready state -->
              <div v-else class="text-center py-4">
                <div class="p-4 rounded-full bg-indigo-900/30 border border-indigo-800/50 inline-flex mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p class="text-sm text-gray-300">Ready to sync songs from Planning Center.</p>
                <p class="text-xs text-gray-500 mt-1">Existing songs will be updated. New songs will be added.</p>
              </div>
            </div>

            <!-- Fetching state -->
            <div v-else-if="step === 'fetching'" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Fetching songs from Planning Center...</p>
                <p class="text-xs text-gray-500">This may take a moment for large libraries.</p>
              </div>
            </div>

            <!-- Preview state -->
            <div v-else-if="step === 'preview'" class="px-6 py-8">
              <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-5">
                <h3 class="text-sm font-semibold text-gray-200 mb-4">Import Preview</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div class="rounded-lg bg-green-900/20 border border-green-800/50 p-4 text-center">
                    <p class="text-2xl font-bold text-green-300">{{ preview.toAdd }}</p>
                    <p class="text-xs text-green-400/80 mt-1">New songs to add</p>
                  </div>
                  <div class="rounded-lg bg-blue-900/20 border border-blue-800/50 p-4 text-center">
                    <p class="text-2xl font-bold text-blue-300">{{ preview.toUpdate }}</p>
                    <p class="text-xs text-blue-400/80 mt-1">Existing songs to update</p>
                  </div>
                </div>
                <p class="text-xs text-gray-500 mt-4 text-center">
                  {{ preview.toAdd + preview.toUpdate }} songs total from Planning Center
                </p>
              </div>
            </div>

            <!-- Importing state -->
            <div v-else-if="step === 'importing'" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Importing songs...</p>
              </div>
            </div>

            <!-- Done state -->
            <div v-else-if="step === 'done'" class="px-6 py-10 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="p-3 rounded-full bg-green-900/30 border border-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p class="text-base font-semibold text-gray-100">Import complete!</p>
                  <p class="text-sm text-gray-400 mt-1">
                    {{ preview.toAdd }} song{{ preview.toAdd !== 1 ? 's' : '' }} added,
                    {{ preview.toUpdate }} song{{ preview.toUpdate !== 1 ? 's' : '' }} updated.
                  </p>
                </div>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="step === 'error'" class="px-6 py-8">
              <div class="rounded-lg bg-red-900/20 border border-red-800 p-4">
                <div class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-red-300">Import failed</p>
                    <p class="text-xs text-red-400/80 mt-1">{{ errorMessage }}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer actions -->
          <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 shrink-0">
            <!-- Cancel button (visible when not importing or done) -->
            <button
              v-if="step !== 'done' && step !== 'importing'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
              @click="onClose"
            >
              Cancel
            </button>

            <!-- Import button (idle state) -->
            <button
              v-if="step === 'idle'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!authStore.hasPcCredentials"
              @click="onStartFetch"
            >
              Import
            </button>

            <!-- Retry button (error state) -->
            <button
              v-if="step === 'error'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              @click="onStartFetch"
            >
              Retry
            </button>

            <!-- Confirm button (preview state) -->
            <button
              v-if="step === 'preview'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              @click="onConfirmImport"
            >
              Confirm Import
            </button>

            <!-- Done button -->
            <button
              v-if="step === 'done'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              @click="onDoneClose"
            >
              Done
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import { fetchAndMapPcSongs } from '@/utils/pcSongImport'
import type { UpsertSongInput } from '@/types/song'
import type { Song } from '@/types/song'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

const authStore = useAuthStore()
const songStore = useSongStore()

// ── State ──────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'fetching' | 'preview' | 'importing' | 'done' | 'error'
const step = ref<Step>('idle')
const errorMessage = ref('')

// Mapped songs from PC (stored between fetch and confirm)
const mappedSongs = ref<UpsertSongInput[]>([])

// Preview counts
const preview = ref({ toAdd: 0, toUpdate: 0 })

// ── Reset on open ──────────────────────────────────────────────────────────────

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetToIdle()
  },
)

function resetToIdle() {
  step.value = 'idle'
  errorMessage.value = ''
  mappedSongs.value = []
  preview.value = { toAdd: 0, toUpdate: 0 }
}

// ── Classification helper ─────────────────────────────────────────────────────

function classifySongs(mapped: UpsertSongInput[], existing: Song[]) {
  const byPcId = new Map(existing.filter((s) => s.pcSongId).map((s) => [s.pcSongId!, s]))
  const byCcli = new Map(existing.filter((s) => s.ccliNumber).map((s) => [s.ccliNumber, s]))
  const byTitle = new Map(existing.map((s) => [s.title.toLowerCase(), s]))
  let toAdd = 0
  let toUpdate = 0
  for (const song of mapped) {
    const isExisting =
      (song.pcSongId && byPcId.has(song.pcSongId)) ||
      (song.ccliNumber && byCcli.has(song.ccliNumber)) ||
      byTitle.has(song.title.toLowerCase())
    if (isExisting) toUpdate++
    else toAdd++
  }
  return { toAdd, toUpdate }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function onStartFetch() {
  const creds = authStore.pcCredentials
  if (!creds) return

  step.value = 'fetching'
  errorMessage.value = ''

  try {
    const songs = await fetchAndMapPcSongs(creds.appId, creds.secret)
    mappedSongs.value = songs
    preview.value = classifySongs(songs, songStore.songs)
    step.value = 'preview'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred'
    errorMessage.value = message
    step.value = 'error'
  }
}

async function onConfirmImport() {
  step.value = 'importing'
  try {
    await songStore.upsertSongs(mappedSongs.value)
    step.value = 'done'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred'
    errorMessage.value = message
    step.value = 'error'
  }
}

// ── Close ──────────────────────────────────────────────────────────────────────

function onClose() {
  if (step.value === 'fetching' || step.value === 'importing') return
  emit('close')
}

function onDoneClose() {
  emit('imported', preview.value.toAdd + preview.value.toUpdate)
  emit('close')
}
</script>
