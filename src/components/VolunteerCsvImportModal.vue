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
              <h2 class="text-base font-semibold text-gray-100">Import Volunteer CSV</h2>
              <p class="text-xs text-gray-400 mt-0.5">Name, Roles, Frequency, Blackout Dates, Serve-With</p>
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

              <div class="mt-5 p-4 rounded-lg bg-gray-800 border border-gray-700">
                <p class="text-xs font-medium text-gray-300 mb-2">Required columns:</p>
                <p class="text-xs text-gray-500">Name, Roles, Frequency, Blackout Dates, Serve-With</p>
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
              <!-- Summary bar -->
              <div class="px-6 py-3 border-b border-gray-800 flex items-center gap-3 flex-wrap shrink-0">
                <span class="text-sm font-medium text-gray-200">
                  {{ previewRows.length }} row{{ previewRows.length !== 1 ? 's' : '' }} found
                </span>
                <span v-if="matchedCount > 0" class="text-xs px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-400">
                  {{ matchedCount }} matched
                </span>
                <span v-if="unresolvedCount > 0" class="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400">
                  {{ unresolvedCount }} need resolution
                </span>
                <span v-if="blackoutWarningCount > 0" class="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/50 text-amber-300">
                  {{ blackoutWarningCount }} blackout warning{{ blackoutWarningCount !== 1 ? 's' : '' }}
                </span>
              </div>

              <!-- Preview table -->
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-800">
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider">Name</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden sm:table-cell">Roles</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider hidden md:table-cell">Frequency</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider">Status</th>
                      <th class="px-4 py-2.5 text-left font-medium text-xs text-gray-400 uppercase tracking-wider">Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, idx) in previewRows"
                      :key="idx"
                      class="border-b border-gray-800/50 transition-colors"
                      :class="row.matchStatus === 'matched' ? 'hover:bg-gray-800/40' : 'bg-red-900/10 hover:bg-red-900/20'"
                    >
                      <td class="px-4 py-2.5 text-gray-200">
                        {{ row.name || '(no name)' }}
                        <div v-if="row.blackoutWarning" class="mt-1">
                          <span class="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/50 text-amber-300">
                            Blackout date outside quarter
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-2.5 text-gray-400 hidden sm:table-cell">{{ row.rolesRaw.join(', ') || '—' }}</td>
                      <td class="px-4 py-2.5 text-gray-400 hidden md:table-cell">{{ row.frequencyTargetN }}</td>
                      <td class="px-4 py-2.5">
                        <span v-if="row.matchStatus === 'matched'" class="text-xs px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-400">
                          Matched
                        </span>
                        <span v-else-if="row.matchStatus === 'ambiguous'" class="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400">
                          Ambiguous
                        </span>
                        <span v-else class="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400">
                          Unmatched
                        </span>
                      </td>
                      <td class="px-4 py-2.5">
                        <span v-if="row.matchStatus === 'matched'" class="text-xs text-gray-500">Matched automatically</span>
                        <div v-else class="flex flex-col gap-1.5 min-w-[12rem]">
                          <label class="text-xs text-gray-500">Map to existing person</label>
                          <select
                            v-model="row.selectedPersonId"
                            @change="row.resolution = 'existing'"
                            class="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option :value="null">— Select —</option>
                            <option v-for="p in rosterStore.people" :key="p.id" :value="p.id">{{ p.name }}</option>
                          </select>
                          <button
                            type="button"
                            @click="setCreateNew(row)"
                            class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors text-left"
                          >
                            Create new person
                          </button>
                          <span v-if="row.resolution === 'create'" class="text-xs text-green-400">Will create new person</span>
                        </div>
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
                <p class="text-sm text-gray-300">Importing volunteer data...</p>
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
                  <p class="text-sm text-gray-400 mt-1">{{ previewRows.length }} volunteer{{ previewRows.length !== 1 ? 's' : '' }} applied to the quarter</p>
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
                    <p class="text-xs text-red-400/80 mt-1">Check that your CSV matches the required columns (Name, Roles, Frequency, Blackout Dates, Serve-With) and try again.</p>
                  </div>
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

              <button
                v-if="step === 'preview'"
                type="button"
                class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canCommit"
                @click="onCommit"
              >
                Commit Import
              </button>

              <button
                v-if="step === 'error'"
                type="button"
                class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                @click="resetToSelect"
              >
                Try Again
              </button>

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
import { useQuartersStore } from '@/stores/quarters'
import { useRosterStore } from '@/stores/roster'
import {
  parseVolunteerCsvRow,
  expandBlackoutCell,
  matchNameToPerson,
} from '@/utils/volunteerCsv'
import type { NameMatchStatus } from '@/utils/volunteerCsv'
import type { ResolvedCsvPerson } from '@/stores/quarters'
import type { Quarter } from '@/types/roster'

const props = defineProps<{
  open: boolean
  quarter: Quarter | null
}>()

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

const quartersStore = useQuartersStore()
const rosterStore = useRosterStore()

// ── State ──────────────────────────────────────────────────────────────────────

type Step = 'select' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'
const step = ref<Step>('select')

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

interface PreviewRow {
  name: string
  rolesRaw: string[]
  frequencyTargetN: number
  serveWithRaw: string[]
  matchStatus: NameMatchStatus
  resolution: 'existing' | 'create' | null
  selectedPersonId: string | null
  blackoutDates: string[]
  blackoutWarning: boolean
}

const previewRows = ref<PreviewRow[]>([])

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
  previewRows.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// ── Computed preview stats ─────────────────────────────────────────────────────

const matchedCount = computed(() => previewRows.value.filter((r) => r.matchStatus === 'matched').length)
const unresolvedCount = computed(
  () => previewRows.value.filter((r) => r.matchStatus !== 'matched' && r.resolution === null).length,
)
const blackoutWarningCount = computed(() => previewRows.value.filter((r) => r.blackoutWarning).length)

const canCommit = computed(() => {
  if (previewRows.value.length === 0) return false
  return previewRows.value.every((row) => {
    if (row.matchStatus === 'matched') return true
    if (row.resolution === 'create') return true
    if (row.resolution === 'existing') return row.selectedPersonId !== null
    return false
  })
})

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

// Detects blackout cell entries (single dates or ranges) that don't overlap the
// quarter's serviceDates at all — surfaced as a per-row warning (D-17), distinct
// from expandBlackoutCell's own silent drop of out-of-quarter dates.
function hasOutOfQuarterBlackout(cell: string, serviceDates: string[]): boolean {
  const parts = cell
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
  for (const part of parts) {
    if (part.includes('..')) {
      const [start, end] = part.split('..').map((s) => s.trim())
      if (!start || !end) continue
      const hasAny = serviceDates.some((d) => d >= start && d <= end)
      if (!hasAny) return true
    } else if (!serviceDates.includes(part)) {
      return true
    }
  }
  return false
}

function processFile(file: File) {
  if (!props.quarter) return
  const quarter = props.quarter
  step.value = 'parsing'

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      try {
        const rows = results.data.map((row) => parseVolunteerCsvRow(row))
        previewRows.value = rows.map((row) => {
          const match = matchNameToPerson(row.name, rosterStore.people)
          const blackoutDates = expandBlackoutCell(row.blackoutCellRaw, quarter.serviceDates)
          const blackoutWarning = row.blackoutCellRaw !== '' && hasOutOfQuarterBlackout(row.blackoutCellRaw, quarter.serviceDates)
          return {
            name: row.name,
            rolesRaw: row.rolesRaw,
            frequencyTargetN: row.frequencyTargetN,
            serveWithRaw: row.serveWithRaw,
            matchStatus: match.status,
            resolution: match.status === 'matched' ? 'existing' : null,
            selectedPersonId: match.status === 'matched' ? match.personId : null,
            blackoutDates,
            blackoutWarning,
          }
        })
        step.value = 'preview'
      } catch {
        step.value = 'error'
      }
    },
    error() {
      step.value = 'error'
    },
  })
}

function setCreateNew(row: PreviewRow) {
  row.resolution = 'create'
  row.selectedPersonId = null
}

// ── Commit ─────────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

function mapRoleNamesToIds(names: string[]): string[] {
  return names
    .map((n) => rosterStore.roles.find((r) => r.name.toLowerCase() === n.trim().toLowerCase()))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((r) => r.id)
}

async function onCommit() {
  if (!props.quarter || !canCommit.value) return
  step.value = 'importing'

  try {
    // Seed the name→id map with the current roster; newly-created rows are
    // added as they're committed so serve-with can reference other rows in
    // this same CSV batch (D-16/D-19).
    const nameToId = new Map<string, string>()
    for (const p of rosterStore.people) {
      nameToId.set(normalizeName(p.name), p.id)
    }

    const resolved: ResolvedCsvPerson[] = []

    for (const row of previewRows.value) {
      let personId: string
      let standing: ResolvedCsvPerson['standing']

      if (row.matchStatus !== 'matched' && row.resolution === 'create') {
        const roleIds = mapRoleNamesToIds(row.rolesRaw)
        personId = await rosterStore.addPerson({
          name: row.name,
          email: '',
          roles: roleIds,
          frequencyTargetN: row.frequencyTargetN,
        })
        nameToId.set(normalizeName(row.name), personId)
        standing = {}
      } else {
        personId = row.selectedPersonId!
        standing = {
          roles: mapRoleNamesToIds(row.rolesRaw),
          frequencyTargetN: row.frequencyTargetN,
        }
      }

      resolved.push({
        personId,
        standing,
        blackoutDates: row.blackoutDates,
        pairedWith: [],
      })
    }

    // Second pass: resolve serve-with names now that newly-created rows are
    // in nameToId too.
    previewRows.value.forEach((row, idx) => {
      resolved[idx]!.pairedWith = row.serveWithRaw
        .map((n) => nameToId.get(normalizeName(n)))
        .filter((id): id is string => id !== undefined)
    })

    await quartersStore.applyCsvToQuarter(props.quarter.id, resolved)
    step.value = 'done'
  } catch {
    step.value = 'error'
  }
}

// ── Close ──────────────────────────────────────────────────────────────────────

function onClose() {
  if (step.value === 'importing') return
  emit('close')
}

function onDoneClose() {
  emit('imported', previewRows.value.length)
  emit('close')
}
</script>
