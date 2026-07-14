<template>
  <div class="print:hidden">
  <AppShell>
    <div class="px-6 py-8">
      <!-- Page header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-gray-800">
        <div>
          <h1 class="text-xl font-semibold text-gray-100">Schedule</h1>
          <p class="text-sm text-gray-400 mt-1">
            {{ quartersStore.isLoading ? 'Loading...' : `${quartersStore.quarters.length} quarter${quartersStore.quarters.length !== 1 ? 's' : ''}` }}
          </p>
        </div>
        <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto [&>*]:justify-center sm:[&>*]:justify-start">
          <div v-if="quartersStore.quarters.length > 0" class="flex items-center gap-2">
            <label for="quarter-select" class="text-xs font-medium text-gray-400">Quarter</label>
            <select
              id="quarter-select"
              v-model="selectedQuarterId"
              class="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option v-for="q in quartersStore.quarters" :key="q.id" :value="q.id">{{ q.label }}</option>
            </select>
          </div>
          <!-- Generator controls (moved into header to save vertical space) -->
          <button
            v-if="selectedQuarter && !hasAssignments"
            @click="onGenerateSchedule"
            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Generate Schedule
          </button>
          <button
            v-if="selectedQuarter && hasAssignments"
            @click="onFillGaps"
            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Fill Remaining Gaps
          </button>
          <button
            v-if="selectedQuarter && hasAssignments"
            @click="onRequestRegenerate"
            class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Regenerate
          </button>
          <button
            v-if="selectedQuarter && hasAssignments"
            @click="onFinalizeAndShare"
            :disabled="isFinalizing"
            class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {{ isFinalizing ? 'Finalizing...' : 'Finalize & Share' }}
          </button>
          <button
            type="button"
            @click="onOpenAddQuarter"
            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            + Add quarter
          </button>
        </div>
      </div>

      <!-- Share link banner -->
      <div
        v-if="shareUrl"
        class="rounded-lg border border-indigo-800 bg-indigo-950/40 p-4 mb-6 flex items-center gap-3 flex-wrap"
      >
        <p class="text-sm text-gray-300 flex-1 min-w-0 truncate">{{ shareUrl }}</p>
        <button
          @click="onCopyShareUrl"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shrink-0"
        >
          {{ shareCopied ? 'Copied!' : 'Copy link' }}
        </button>
      </div>
      <div v-if="shareError" class="text-sm text-red-400 mb-6">{{ shareError }}</div>

      <template v-if="selectedQuarter">
        <!-- Tab bar (mirrors ServicesView.vue) -->
        <div class="flex items-center gap-1 mb-6 border-b border-gray-800 pb-0">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
            :class="activeTab === 'volunteers'
              ? 'text-indigo-300 border-indigo-500 bg-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
            @click="activeTab = 'volunteers'"
          >
            Volunteers
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
            :class="activeTab === 'schedule'
              ? 'text-indigo-300 border-indigo-500 bg-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
            @click="activeTab = 'schedule'"
          >
            Schedule
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
            :class="activeTab === 'serviceDates'
              ? 'text-indigo-300 border-indigo-500 bg-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
            @click="activeTab = 'serviceDates'"
          >
            Service dates
          </button>
        </div>

        <!-- Volunteers tab: full-width roster table opening the per-person drawer (D-02/D-03) -->
        <div v-show="activeTab === 'volunteers'">
          <AvailabilityRosterTable :quarter="selectedQuarter" @select="openPersonId = $event" />
        </div>

        <!-- Service dates tab: service dates with inline per-date role overrides -->
        <div v-show="activeTab === 'serviceDates'">
          <div class="flex items-center gap-2 mb-3">
            <input
              v-model="newDateInput"
              type="date"
              class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              @click="onAddDate"
              class="px-3 py-2 rounded-md text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              Add date
            </button>
          </div>
          <ul class="max-h-96 overflow-y-auto divide-y divide-gray-800">
            <template v-for="date in selectedQuarter.serviceDates" :key="date">
              <li class="flex items-center justify-between py-2 text-sm text-gray-300">
                <span class="flex items-center gap-2">
                  {{ formatDateLabel(date) }}
                  <span
                    v-if="hasOverride(date)"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/40 border border-indigo-700/50 text-indigo-300"
                  >
                    custom roles
                  </span>
                </span>
                <span class="flex items-center gap-3">
                  <button
                    @click="toggleOverride(date)"
                    class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {{ overrideDate === date ? 'Close' : 'Override Roles' }}
                  </button>
                  <button
                    @click="onRemoveDate(date)"
                    aria-label="Remove date"
                    class="text-gray-500 hover:text-red-400 transition-colors px-1"
                  >
                    &times;
                  </button>
                </span>
              </li>
              <!-- Inline override editor for this row only -->
              <li v-if="overrideDate === date" class="py-3 px-3 bg-gray-950/40 rounded-md">
                <p class="text-xs text-gray-500 mb-2">
                  Role counts for {{ formatDateLabel(date) }} — overrides the default for this date only.
                </p>
                <div v-if="rosterStore.roles.length === 0" class="text-sm text-gray-600">
                  No roles configured yet — add roles from the Roster screen.
                </div>
                <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mb-3">
                  <div
                    v-for="role in rosterStore.rolesSorted"
                    :key="role.id"
                    class="flex items-center justify-between gap-2"
                  >
                    <span class="text-sm text-gray-300 truncate">{{ role.name }}</span>
                    <input
                      v-model.number="overrideDraft[role.id]"
                      type="number"
                      min="0"
                      class="w-16 shrink-0 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="onSaveOverride"
                    class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                  >
                    Save role counts
                  </button>
                  <button
                    @click="toggleOverride(date)"
                    class="px-3 py-1.5 rounded-md text-sm text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            </template>
            <li v-if="selectedQuarter.serviceDates.length === 0" class="py-3 text-sm text-gray-600 text-center">
              No service dates yet
            </li>
          </ul>

          <!-- Danger zone: permanently delete this quarter (irreversible) — removes the
               quarter, its generated schedule, and revokes any public share link. -->
          <div class="mt-10 border border-red-900/50 rounded-xl overflow-hidden">
            <div class="px-4 py-3 bg-red-950/30 border-b border-red-900/50">
              <h2 class="text-sm font-medium text-red-300">Danger Zone</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                Permanently delete <span class="font-semibold text-gray-300">{{ selectedQuarter.label }}</span> — its
                volunteer setup, the generated schedule, and any public share link. This cannot be undone.
              </p>
            </div>
            <div class="px-4 py-4">
              <button
                v-if="!deleteConfirmOpen"
                @click="deleteConfirmOpen = true"
                class="text-xs px-3 py-1.5 rounded-md border border-red-700 text-red-300 hover:bg-red-900/30 transition-colors"
              >
                Delete quarter
              </button>
              <div v-else class="space-y-3">
                <p class="text-xs text-gray-400">
                  Type <span class="font-mono font-semibold text-red-300">DELETE</span> to permanently delete
                  <span class="font-semibold text-gray-300">{{ selectedQuarter.label }}</span>.
                </p>
                <div class="flex items-center gap-2 flex-wrap">
                  <input
                    v-model="deleteConfirmText"
                    placeholder="DELETE"
                    class="rounded-md bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-600"
                  />
                  <button
                    :disabled="deleteConfirmText !== 'DELETE' || deletingQuarter"
                    @click="onDeleteQuarter"
                    class="text-xs px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {{ deletingQuarter ? 'Deleting…' : 'Delete quarter' }}
                  </button>
                  <button
                    @click="cancelDeleteQuarter"
                    :disabled="deletingQuarter"
                    class="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p v-if="deleteQuarterError" class="text-xs text-red-400">{{ deleteQuarterError }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Schedule tab -->
        <div v-show="activeTab === 'schedule'">
          <!-- Regenerate confirmation (triggered from the header controls) -->
        <div v-if="showRegenerateConfirm" class="mb-6 rounded-md bg-red-900/20 border border-red-800 p-4">
          <p class="text-sm text-red-300">
            Regenerate the full schedule? This replaces all current assignments, including any manual edits you've made. This cannot be undone.
          </p>
          <div class="flex items-center gap-3 mt-3">
            <button
              @click="onConfirmRegenerate"
              class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
            >
              Regenerate
            </button>
            <button
              @click="showRegenerateConfirm = false"
              class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Generation summary -->
        <div v-if="proposeResult" class="mb-6 rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 flex items-center gap-6 flex-wrap">
          <div>
            <p class="text-xl font-semibold text-gray-100">{{ proposeResult.unfilled.length }}</p>
            <p class="text-xs text-gray-500">unfilled</p>
          </div>
          <div>
            <p class="text-xl font-semibold text-gray-100">{{ proposeResult.pairingConflicts.length }}</p>
            <p class="text-xs text-gray-500">pairing conflicts</p>
          </div>
        </div>

        <!-- Empty state / grid host -->
        <div
          v-if="!hasAssignments"
          class="flex flex-col items-center justify-center py-20 px-6 text-center rounded-lg border border-gray-800"
        >
          <h3 class="text-base font-medium text-gray-300 mb-2">No schedule generated yet</h3>
          <p class="text-sm text-gray-500 max-w-sm mb-6">
            Add this quarter's volunteer CSV (blackout dates, roles, serve-with pairings), then generate a proposed schedule.
          </p>
          <button
            @click="onGenerateSchedule"
            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Generate Schedule
          </button>
        </div>
        <div v-else class="rounded-lg border border-gray-800 overflow-hidden">
          <QuarterGrid
            :quarter="selectedQuarter"
            :roles="rosterStore.roles"
            :lastProposeResult="proposeResult"
          />
        </div>

        </div>
      </template>

      <div v-else class="flex flex-col items-center justify-center py-20 px-6 text-center rounded-lg border border-gray-800">
        <h3 class="text-base font-medium text-gray-300 mb-2">No quarter selected</h3>
        <p class="text-sm text-gray-500 max-w-sm">Create a quarter above to get started.</p>
      </div>
    </div>

    <VolunteerCsvImportModal
      :open="csvModalOpen"
      :quarter="selectedQuarter"
      @close="csvModalOpen = false"
      @imported="onCsvImported"
    />

    <AvailabilityDrawer
      :quarter-id="selectedQuarter?.id ?? null"
      :person-id="openPersonId"
      @close="openPersonId = null"
    />

    <!-- Add-quarter modal (R-10/D-13) — secondary, separate from the quarter switcher -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="addQuarterOpen"
          class="fixed inset-0 z-40 bg-black/60"
          @click="onCloseAddQuarter"
        ></div>
      </Transition>

      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="addQuarterOpen"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="onCloseAddQuarter"
        >
          <div class="w-full max-w-sm bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
              <h2 class="text-base font-semibold text-gray-100">Add a new quarter</h2>
            </div>
            <div class="px-6 py-4 space-y-4">
              <div class="flex items-end gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-1">Year</label>
                  <input
                    v-model.number="newQuarterYear"
                    type="number"
                    class="w-24 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-1">Quarter</label>
                  <select
                    v-model.number="newQuarterNum"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option :value="1">Q1</option>
                    <option :value="2">Q2</option>
                    <option :value="3">Q3</option>
                    <option :value="4">Q4</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button
                type="button"
                @click="onCreateQuarter"
                class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                Create quarter
              </button>
              <button
                type="button"
                @click="onCloseAddQuarter"
                class="px-4 py-2 rounded-md text-sm text-gray-400 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppShell>
  </div>

  <!-- Print layout: hidden on screen, visible when printing -->
  <RosterPrintLayout
    v-if="selectedQuarter"
    :quarter="selectedQuarter"
    :roles="rosterStore.roles"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useQuartersStore } from '@/stores/quarters'
import { useRosterStore } from '@/stores/roster'
import type { ProposeResult } from '@/types/roster'
import AppShell from '@/components/AppShell.vue'
import VolunteerCsvImportModal from '@/components/VolunteerCsvImportModal.vue'
import QuarterGrid from '@/components/QuarterGrid.vue'
import RosterPrintLayout from '@/components/RosterPrintLayout.vue'
import AvailabilityDrawer from '@/components/AvailabilityDrawer.vue'
import AvailabilityRosterTable from '@/components/AvailabilityRosterTable.vue'

const authStore = useAuthStore()
const quartersStore = useQuartersStore()
const rosterStore = useRosterStore()

// ── Quarter selection ────────────────────────────────────────────────────────
const selectedQuarterId = ref<string | null>(null)

// ── Availability drawer (D-02) — controlled by which person's drawer is open ──
const openPersonId = ref<string | null>(null)

// ── Tabbed layout ────────────────────────────────────────────────────────────
// Default to the schedule so it's reachable without scrolling past volunteer/date
// setup. Generating/regenerating/filling jumps back to schedule; adding a new
// quarter jumps to volunteers (set up availability first). Service dates is last.
const activeTab = ref<'volunteers' | 'schedule' | 'serviceDates'>('schedule')

const selectedQuarter = computed(() => {
  if (!selectedQuarterId.value) return null
  return quartersStore.quarters.find((q) => q.id === selectedQuarterId.value) ?? null
})

// Auto-select the first quarter once loaded (only if nothing selected yet).
watch(
  () => quartersStore.quarters,
  (quarters) => {
    if (!selectedQuarterId.value && quarters.length > 0) {
      selectedQuarterId.value = quarters[0]!.id
    }
  },
)

// ── Delete quarter (danger zone next to the switcher) ────────────────────────
const deleteConfirmOpen = ref(false)
const deleteConfirmText = ref('')
const deletingQuarter = ref(false)
const deleteQuarterError = ref('')

function cancelDeleteQuarter() {
  deleteConfirmOpen.value = false
  deleteConfirmText.value = ''
  deleteQuarterError.value = ''
}

async function onDeleteQuarter() {
  if (!selectedQuarter.value || deleteConfirmText.value !== 'DELETE') return
  const deletedId = selectedQuarter.value.id
  deletingQuarter.value = true
  deleteQuarterError.value = ''
  try {
    await quartersStore.deleteQuarter(deletedId)
    // Advance selection to the next remaining quarter (or clear). The snapshot
    // listener may not have pruned the local list yet, so compute from the current
    // list minus the just-deleted id; the shareUrl watch re-syncs off selectedQuarter.
    const remaining = quartersStore.quarters.filter((q) => q.id !== deletedId)
    selectedQuarterId.value = remaining.length > 0 ? remaining[0]!.id : null
    deleteConfirmOpen.value = false
    deleteConfirmText.value = ''
  } catch (err) {
    deleteQuarterError.value = err instanceof Error ? err.message : 'Failed to delete quarter.'
  } finally {
    deletingQuarter.value = false
  }
}

// ── New quarter creation (Add-quarter modal, R-10/D-13) ─────────────────────
// Default the modal to the NEXT quarter after the one we're currently in — even
// if the current quarter hasn't been created yet, we look forward, since you
// schedule the upcoming quarter, not the one already underway.
function nextQuarterFromToday(): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const now = new Date()
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1 // 1..4
  if (currentQuarter === 4) {
    return { year: now.getFullYear() + 1, quarter: 1 }
  }
  return { year: now.getFullYear(), quarter: (currentQuarter + 1) as 1 | 2 | 3 | 4 }
}

const addQuarterOpen = ref(false)
const newQuarterYear = ref(nextQuarterFromToday().year)
const newQuarterNum = ref<1 | 2 | 3 | 4>(nextQuarterFromToday().quarter)
const newQuarterLabel = computed(() => `Q${newQuarterNum.value} ${newQuarterYear.value}`)

function onOpenAddQuarter() {
  // Recompute on open so the default stays correct across a long-lived session.
  const { year, quarter } = nextQuarterFromToday()
  newQuarterYear.value = year
  newQuarterNum.value = quarter
  addQuarterOpen.value = true
}

async function onCreateQuarter() {
  const id = await quartersStore.createQuarter(newQuarterYear.value, newQuarterNum.value, newQuarterLabel.value)
  selectedQuarterId.value = id
  addQuarterOpen.value = false
  // A brand-new quarter needs volunteer availability set up first.
  activeTab.value = 'volunteers'
}

function onCloseAddQuarter() {
  addQuarterOpen.value = false
}

// ── Service dates ────────────────────────────────────────────────────────────
const newDateInput = ref('')

async function onAddDate() {
  if (!newDateInput.value || !selectedQuarter.value) return
  await quartersStore.addServiceDate(selectedQuarter.value.id, newDateInput.value)
  newDateInput.value = ''
}

async function onRemoveDate(date: string) {
  if (!selectedQuarter.value) return
  await quartersStore.removeServiceDate(selectedQuarter.value.id, date)
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Per-date role overrides (inline, per service-date row) ───────────────────
// overrideDate is the date whose inline editor is currently expanded (null = none).
const overrideDate = ref<string | null>(null)
const overrideDraft = ref<Record<string, number>>({})

function toggleOverride(date: string) {
  overrideDate.value = overrideDate.value === date ? null : date
}

function hasOverride(date: string): boolean {
  const o = selectedQuarter.value?.roleOverridesByDate[date]
  return !!o && o.length > 0
}

watch(overrideDate, (date) => {
  if (!date || !selectedQuarter.value) {
    overrideDraft.value = {}
    return
  }
  const existing = selectedQuarter.value.roleOverridesByDate[date]
  const draft: Record<string, number> = {}
  for (const role of rosterStore.roles) {
    const match = existing?.find((r) => r.roleId === role.id)
    draft[role.id] = match ? match.count : role.defaultCount
  }
  overrideDraft.value = draft
})

async function onSaveOverride() {
  if (!overrideDate.value || !selectedQuarter.value) return
  const config = rosterStore.roles.map((role) => ({
    roleId: role.id,
    count: overrideDraft.value[role.id] ?? role.defaultCount,
  }))
  await quartersStore.setRoleOverrideForDate(selectedQuarter.value.id, overrideDate.value, config)
  overrideDate.value = null
}

// ── Generate / regenerate / fill gaps ───────────────────────────────────────
const proposeResult = ref<ProposeResult | null>(null)
const showRegenerateConfirm = ref(false)

const hasAssignments = computed(() => {
  if (!selectedQuarter.value) return false
  return Object.values(selectedQuarter.value.calendar).some((roleMap) =>
    Object.values(roleMap).some((ids) => ids.length > 0),
  )
})

async function onGenerateSchedule() {
  if (!selectedQuarter.value) return
  activeTab.value = 'schedule'
  proposeResult.value = await quartersStore.generateProposal(selectedQuarter.value.id, 'regenerate')
}

async function onFillGaps() {
  if (!selectedQuarter.value) return
  activeTab.value = 'schedule'
  proposeResult.value = await quartersStore.generateProposal(selectedQuarter.value.id, 'fillGaps')
}

// Opening the regenerate confirmation lives on the Schedule tab, so surface it.
function onRequestRegenerate() {
  activeTab.value = 'schedule'
  showRegenerateConfirm.value = true
}

async function onConfirmRegenerate() {
  if (!selectedQuarter.value) return
  activeTab.value = 'schedule'
  proposeResult.value = await quartersStore.generateProposal(selectedQuarter.value.id, 'regenerate')
  showRegenerateConfirm.value = false
}

// ── CSV import modal ─────────────────────────────────────────────────────────
const csvModalOpen = ref(false)

function onCsvImported() {
  csvModalOpen.value = false
}

// ── Finalize & Share (D-24) ─────────────────────────────────────────────────
const isFinalizing = ref(false)
const shareUrl = ref<string | null>(null)
const shareCopied = ref(false)
const shareError = ref<string | null>(null)

// Prefer the memorable, slug-based public URL (/{slug}/quarterN-YYYY) that
// finalizeAndShare also writes (R-02/D-18). Fall back to the opaque token URL
// only when the org has no configured slug yet.
function buildShareUrl(
  quarter: { quarter: number; year: number },
  token: string | null,
): string | null {
  const slug = authStore.orgSlug
  if (slug) {
    return `${window.location.origin}/${slug}/quarter${quarter.quarter}-${quarter.year}`
  }
  return token ? `${window.location.origin}/quarter-share/${token}` : null
}

// Reflect an already-finalized quarter's share link when switching quarters.
watch(
  selectedQuarter,
  (quarter) => {
    shareUrl.value = quarter?.shareToken ? buildShareUrl(quarter, quarter.shareToken) : null
    shareCopied.value = false
    shareError.value = null
  },
  { immediate: true },
)

async function onFinalizeAndShare() {
  if (!selectedQuarter.value) return
  isFinalizing.value = true
  shareError.value = null
  try {
    const token = await quartersStore.finalizeAndShare(selectedQuarter.value.id)
    shareUrl.value = buildShareUrl(selectedQuarter.value, token)
  } catch (err) {
    console.error('Finalize & Share failed:', err)
    shareError.value = 'Failed to finalize and share'
    setTimeout(() => {
      shareError.value = null
    }, 3000)
  } finally {
    isFinalizing.value = false
  }
}

async function onCopyShareUrl() {
  if (!shareUrl.value) return
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(shareUrl.value)
  }
  shareCopied.value = true
  setTimeout(() => {
    shareCopied.value = false
  }, 2000)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
function initStores() {
  const orgId = authStore.orgId
  if (!orgId) return
  quartersStore.subscribe(orgId)
  rosterStore.subscribe(orgId)
}

onMounted(() => {
  initStores()
})

onUnmounted(() => {
  quartersStore.unsubscribeAll()
  rosterStore.unsubscribeAll()
})
</script>
