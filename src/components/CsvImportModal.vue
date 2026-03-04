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
        <div class="w-full max-w-3xl max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 class="text-base font-semibold text-gray-100">Import Songs from CSV</h2>
              <p class="text-xs text-gray-400 mt-0.5">Planning Center export format supported</p>
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

            <!-- Step 1: File Selection -->
            <div v-if="step === 'select'" class="px-6 py-6">
              <!-- Drop zone -->
              <div
                class="border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer"
                :class="isDragging
                  ? 'border-indigo-500 bg-indigo-900/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="onDrop"
                @click="fileInputRef?.click()"
              >
                <div class="flex flex-col items-center gap-3">
                  <div class="p-3 rounded-full bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-200">Drop your CSV file here</p>
                    <p class="text-xs text-gray-500 mt-1">or click to browse</p>
                  </div>
                  <p class="text-xs text-gray-600">.csv files only</p>
                </div>
              </div>

              <input
                ref="fileInputRef"
                type="file"
                accept=".csv"
                class="hidden"
                @change="onFileInputChange"
              />

              <!-- Instructions -->
              <div class="mt-5 p-4 rounded-lg bg-gray-800 border border-gray-700">
                <p class="text-xs font-medium text-gray-300 mb-2">How to export from Planning Center:</p>
                <ol class="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                  <li>Go to Planning Center Music &rarr; Songs</li>
                  <li>Click the export/download button</li>
                  <li>Select "Export as CSV"</li>
                  <li>Upload the downloaded file here</li>
                </ol>
              </div>
            </div>

            <!-- Parsing progress -->
            <div v-else-if="step === 'parsing'" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Parsing CSV file...</p>
              </div>
            </div>

            <!-- Step 2: Preview -->
            <div v-else-if="step === 'preview'" class="flex flex-col">

              <!-- Detected columns info -->
              <div v-if="detectedColumns.length > 0" class="px-6 pt-4 pb-2">
                <details class="text-xs">
                  <summary class="text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
                    Detected {{ detectedColumns.length }} columns &mdash; click to expand
                  </summary>
                  <div class="mt-2 p-3 rounded-md bg-gray-800 border border-gray-700 font-mono text-gray-400 leading-relaxed break-all">
                    {{ detectedColumns.join(', ') }}
                  </div>
                </details>
              </div>

              <!-- Summary bar -->
              <div class="px-6 py-3 border-b border-gray-800 flex items-center gap-4 flex-wrap shrink-0">
                <span class="text-sm font-medium text-gray-200">
                  {{ totalCount }} song{{ totalCount !== 1 ? 's' : '' }} found
                </span>
                <span v-if="duplicateCount > 0" class="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/60 text-red-300">
                  {{ duplicateCount }} duplicate{{ duplicateCount !== 1 ? 's' : '' }} (will be skipped)
                </span>
                <span v-if="warningCount > 0" class="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700/60 text-yellow-300">
                  {{ warningCount }} warning{{ warningCount !== 1 ? 's' : '' }}
                </span>
                <span class="text-xs text-gray-400 ml-auto">
                  {{ checkedNonDuplicateCount }} selected to import
                </span>
              </div>

              <!-- Preview table -->
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-800">
                      <th class="px-4 py-2.5 text-left w-8">
                        <input
                          type="checkbox"
                          :checked="allNonDuplicatesChecked"
                          :indeterminate="someNonDuplicatesChecked"
                          class="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                          @change="toggleAllNonDuplicates"
                        />
                      </th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider">Title</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden sm:table-cell">CCLI</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden md:table-cell">Author</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden md:table-cell">Key</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(song, idx) in previewSongs"
                      :key="idx"
                      class="border-b border-gray-800/50 transition-colors"
                      :class="song.isDuplicate
                        ? 'bg-red-900/10 hover:bg-red-900/20'
                        : song._warnings.length > 0
                          ? 'bg-yellow-900/10 hover:bg-yellow-900/20'
                          : 'hover:bg-gray-800/40'"
                    >
                      <td class="px-4 py-2.5">
                        <input
                          v-if="!song.isDuplicate"
                          type="checkbox"
                          :checked="checkedRows[idx]"
                          class="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                          @change="checkedRows[idx] = !checkedRows[idx]"
                        />
                        <span v-else class="text-gray-700 text-xs">&#8212;</span>
                      </td>
                      <td class="px-4 py-2.5">
                        <span
                          class="text-gray-200"
                          :class="song.isDuplicate ? 'line-through text-gray-500' : ''"
                        >
                          {{ song.title || '(no title)' }}
                        </span>
                      </td>
                      <td class="px-4 py-2.5 text-gray-400 hidden sm:table-cell">
                        {{ song.ccliNumber || '—' }}
                      </td>
                      <td class="px-4 py-2.5 text-gray-400 hidden md:table-cell">
                        {{ song.author || '—' }}
                      </td>
                      <td class="px-4 py-2.5 text-gray-400 hidden md:table-cell">
                        {{ song.arrangements[0]?.key || '—' }}
                      </td>
                      <td class="px-4 py-2.5">
                        <span v-if="song.isDuplicate" class="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400">
                          Duplicate
                        </span>
                        <span v-else-if="song._warnings.length > 0" class="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700/50 text-yellow-400" :title="song._warnings.join(', ')">
                          Warning
                        </span>
                        <span v-else class="text-xs px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-400">
                          New
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Step 3: Importing progress -->
            <div v-else-if="step === 'importing'" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Importing {{ importTotal }} songs...</p>
                <div class="w-full max-w-xs bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    :style="{ width: importProgress + '%' }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Step 4: Done -->
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
                    {{ importedCount }} song{{ importedCount !== 1 ? 's' : '' }} added to your library
                  </p>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer actions -->
          <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-between shrink-0">
            <button
              v-if="step === 'preview'"
              type="button"
              class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              @click="resetToSelect"
            >
              &larr; Choose different file
            </button>
            <span v-else></span>

            <div class="flex items-center gap-3">
              <button
                v-if="step !== 'done' && step !== 'importing'"
                type="button"
                class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                @click="onClose"
              >
                Cancel
              </button>

              <!-- Import button -->
              <button
                v-if="step === 'preview'"
                type="button"
                class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="checkedNonDuplicateCount === 0"
                @click="onImport"
              >
                Import {{ checkedNonDuplicateCount }} Song{{ checkedNonDuplicateCount !== 1 ? 's' : '' }}
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
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Papa from 'papaparse'
import { useSongStore } from '@/stores/songs'
import { mapRowToSong, detectDuplicates } from '@/utils/csvImport'
import type { ParsedSongPreview } from '@/utils/csvImport'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

const songStore = useSongStore()

// ── State ──────────────────────────────────────────────────────────────────────

type Step = 'select' | 'parsing' | 'preview' | 'importing' | 'done'
const step = ref<Step>('select')

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const detectedColumns = ref<string[]>([])
const previewSongs = ref<ParsedSongPreview[]>([])
const checkedRows = ref<boolean[]>([])

const importTotal = ref(0)
const importProgress = ref(0)
const importedCount = ref(0)

// ── Reset on open ──────────────────────────────────────────────────────────────

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetToSelect()
  },
)

function resetToSelect() {
  step.value = 'select'
  isDragging.value = false
  detectedColumns.value = []
  previewSongs.value = []
  checkedRows.value = []
  importTotal.value = 0
  importProgress.value = 0
  importedCount.value = 0
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// ── Computed preview stats ─────────────────────────────────────────────────────

const totalCount = computed(() => previewSongs.value.length)
const duplicateCount = computed(() => previewSongs.value.filter((s) => s.isDuplicate).length)
const warningCount = computed(() => previewSongs.value.filter((s) => !s.isDuplicate && s._warnings.length > 0).length)

const checkedNonDuplicateCount = computed(() =>
  previewSongs.value.reduce((count, song, idx) => {
    if (!song.isDuplicate && checkedRows.value[idx]) return count + 1
    return count
  }, 0),
)

const allNonDuplicatesChecked = computed(() => {
  const nonDups = previewSongs.value.filter((s) => !s.isDuplicate)
  if (nonDups.length === 0) return false
  return nonDups.every((_, i) => {
    const actualIdx = previewSongs.value.indexOf(nonDups[i])
    return checkedRows.value[actualIdx]
  })
})

const someNonDuplicatesChecked = computed(() => {
  if (allNonDuplicatesChecked.value) return false
  return previewSongs.value.some((song, idx) => !song.isDuplicate && checkedRows.value[idx])
})

function toggleAllNonDuplicates(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  checkedRows.value = previewSongs.value.map((song) => (song.isDuplicate ? false : checked))
}

// ── File handling ──────────────────────────────────────────────────────────────

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) processFile(file)
}

function onFileInputChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}

function processFile(file: File) {
  step.value = 'parsing'

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      detectedColumns.value = results.meta.fields ?? []
      console.log('[CsvImportModal] detected columns:', detectedColumns.value)

      // Map rows to ParsedSongPreview
      const mapped = results.data.map((row) => mapRowToSong(row))

      // Detect duplicates against existing songs in the store
      const withDuplicates = detectDuplicates(mapped, songStore.songs)

      previewSongs.value = withDuplicates

      // Default: all non-duplicate rows checked
      checkedRows.value = withDuplicates.map((s) => !s.isDuplicate)

      step.value = 'preview'
    },
    error(err) {
      console.error('[CsvImportModal] PapaParse error:', err)
      step.value = 'select'
    },
  })
}

// ── Import ─────────────────────────────────────────────────────────────────────

async function onImport() {
  // Collect songs to import: non-duplicate AND checked by user
  const toImport = previewSongs.value.filter((song, idx) => !song.isDuplicate && checkedRows.value[idx])

  if (toImport.length === 0) return

  importTotal.value = toImport.length
  importProgress.value = 0
  step.value = 'importing'

  // Strip ParsedSongPreview-specific fields to get SongInput shape
  const songInputs = toImport.map(({ isDuplicate: _d, _warnings: _w, ...song }) => song)

  // importSongs handles batch chunking internally (499 ops per batch)
  // For progress indication, we call in batches ourselves
  const CHUNK = 100
  let imported = 0
  for (let i = 0; i < songInputs.length; i += CHUNK) {
    const chunk = songInputs.slice(i, i + CHUNK)
    await songStore.importSongs(chunk)
    imported += chunk.length
    importProgress.value = Math.round((imported / importTotal.value) * 100)
  }

  importedCount.value = imported
  step.value = 'done'
}

// ── Close ──────────────────────────────────────────────────────────────────────

function onClose() {
  if (step.value === 'importing') return // prevent close while importing
  emit('close')
}

function onDoneClose() {
  emit('imported', importedCount.value)
  emit('close')
}
</script>
