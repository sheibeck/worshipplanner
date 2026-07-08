<template>
  <AppShell>
    <div class="px-6 py-8">
      <!-- Page header -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-semibold text-gray-100">Schedule</h1>
          <p class="text-sm text-gray-400 mt-1">
            {{ quartersStore.isLoading ? 'Loading...' : `${quartersStore.quarters.length} quarter${quartersStore.quarters.length !== 1 ? 's' : ''}` }}
          </p>
        </div>
        <button
          v-if="selectedQuarter"
          @click="csvModalOpen = true"
          class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import Volunteer CSV
        </button>
      </div>

      <!-- Quarter selector + create -->
      <div class="rounded-lg border border-gray-800 bg-gray-900 p-5 mb-6">
        <div class="flex flex-wrap items-end gap-4">
          <div v-if="quartersStore.quarters.length > 0">
            <label class="block text-xs font-medium text-gray-400 mb-1">Quarter</label>
            <select
              v-model="selectedQuarterId"
              class="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option v-for="q in quartersStore.quarters" :key="q.id" :value="q.id">{{ q.label }}</option>
            </select>
          </div>

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
            <button
              @click="onCreateQuarter"
              class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
            >
              New quarter ({{ newQuarterLabel }})
            </button>
          </div>
        </div>
      </div>

      <template v-if="selectedQuarter">
        <!-- Setup: service dates + per-date role overrides -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Service dates -->
          <div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
            <h2 class="text-sm font-semibold text-gray-200 mb-3">Service dates</h2>
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
            <ul class="max-h-72 overflow-y-auto divide-y divide-gray-800">
              <li
                v-for="date in selectedQuarter.serviceDates"
                :key="date"
                class="flex items-center justify-between py-2 text-sm text-gray-300"
              >
                {{ formatDateLabel(date) }}
                <button
                  @click="onRemoveDate(date)"
                  aria-label="Remove date"
                  class="text-gray-500 hover:text-red-400 transition-colors px-1"
                >
                  &times;
                </button>
              </li>
              <li v-if="selectedQuarter.serviceDates.length === 0" class="py-3 text-sm text-gray-600 text-center">
                No service dates yet
              </li>
            </ul>
          </div>

          <!-- Per-date role overrides -->
          <div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
            <h2 class="text-sm font-semibold text-gray-200 mb-3">Per-date role overrides</h2>
            <label class="block text-xs font-medium text-gray-400 mb-1">Date</label>
            <select
              v-model="overrideDate"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option :value="null">— Select a date —</option>
              <option v-for="date in selectedQuarter.serviceDates" :key="date" :value="date">
                {{ formatDateLabel(date) }}
              </option>
            </select>

            <template v-if="overrideDate">
              <div v-if="rosterStore.roles.length === 0" class="text-sm text-gray-600">
                No roles configured yet — add roles from the Roster screen.
              </div>
              <div v-else class="space-y-2 mb-4">
                <div
                  v-for="role in rosterStore.roles"
                  :key="role.id"
                  class="flex items-center justify-between gap-3"
                >
                  <span class="text-sm text-gray-300">{{ role.name }}</span>
                  <input
                    v-model.number="overrideDraft[role.id]"
                    type="number"
                    min="0"
                    class="w-20 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                @click="onSaveOverride"
                class="px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                Save role counts
              </button>
            </template>
          </div>
        </div>

        <!-- Generate controls -->
        <div class="rounded-lg border border-gray-800 bg-gray-900 p-5 mb-6">
          <div class="flex items-center gap-3 flex-wrap">
            <button
              v-if="!hasAssignments"
              @click="onGenerateSchedule"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              Generate Schedule
            </button>
            <template v-else>
              <button
                @click="onFillGaps"
                class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                Fill Remaining Gaps
              </button>
              <button
                @click="showRegenerateConfirm = true"
                class="px-4 py-2 rounded-md text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
              >
                Regenerate
              </button>
            </template>
          </div>

          <!-- Regenerate confirmation -->
          <div v-if="showRegenerateConfirm" class="mt-4 rounded-md bg-red-900/20 border border-red-800 p-4">
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

          <!-- Summary bar -->
          <div v-if="proposeResult" class="mt-4 flex items-center gap-6 flex-wrap">
            <div>
              <p class="text-xl font-semibold text-gray-100">{{ proposeResult.unfilled.length }}</p>
              <p class="text-xs text-gray-500">unfilled</p>
            </div>
            <div>
              <p class="text-xl font-semibold text-gray-100">{{ proposeResult.pairingConflicts.length }}</p>
              <p class="text-xs text-gray-500">pairing conflicts</p>
            </div>
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
        <div v-else class="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <!-- QuarterGrid mounts here (Plan 09) -->
          <p class="text-sm text-gray-500">Schedule grid coming soon.</p>
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
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useQuartersStore } from '@/stores/quarters'
import { useRosterStore } from '@/stores/roster'
import type { ProposeResult } from '@/types/roster'
import AppShell from '@/components/AppShell.vue'
import VolunteerCsvImportModal from '@/components/VolunteerCsvImportModal.vue'

const authStore = useAuthStore()
const quartersStore = useQuartersStore()
const rosterStore = useRosterStore()

// ── Quarter selection ────────────────────────────────────────────────────────
const selectedQuarterId = ref<string | null>(null)

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

// ── New quarter creation ─────────────────────────────────────────────────────
const newQuarterYear = ref(new Date().getFullYear())
const newQuarterNum = ref<1 | 2 | 3 | 4>(1)
const newQuarterLabel = computed(() => `Q${newQuarterNum.value} ${newQuarterYear.value}`)

async function onCreateQuarter() {
  const id = await quartersStore.createQuarter(newQuarterYear.value, newQuarterNum.value, newQuarterLabel.value)
  selectedQuarterId.value = id
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

// ── Per-date role overrides ──────────────────────────────────────────────────
const overrideDate = ref<string | null>(null)
const overrideDraft = ref<Record<string, number>>({})

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
  proposeResult.value = await quartersStore.generateProposal(selectedQuarter.value.id, 'regenerate')
}

async function onFillGaps() {
  if (!selectedQuarter.value) return
  proposeResult.value = await quartersStore.generateProposal(selectedQuarter.value.id, 'fillGaps')
}

async function onConfirmRegenerate() {
  if (!selectedQuarter.value) return
  proposeResult.value = await quartersStore.generateProposal(selectedQuarter.value.id, 'regenerate')
  showRegenerateConfirm.value = false
}

// ── CSV import modal ─────────────────────────────────────────────────────────
const csvModalOpen = ref(false)

function onCsvImported() {
  csvModalOpen.value = false
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
