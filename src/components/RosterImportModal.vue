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
      >
        <div class="w-full max-w-lg max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 class="text-base font-semibold text-gray-100">Import from Planning Center</h2>
              <p class="text-xs text-gray-400 mt-0.5">Sync volunteers directly from your PC People</p>
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
                <p class="text-sm text-gray-300">Import volunteers scoped to a worship team's positions.</p>
                <p class="text-xs text-gray-500 mt-1">
                  Pick a service type, then a team, then which positions to import — group positions
                  like Choir/Orchestra can be left unchecked. Phone numbers are never imported —
                  Planning Center does not provide them; enter phone manually per person.
                </p>
              </div>
            </div>

            <!-- Select service type state -->
            <div v-else-if="step === 'selectServiceType'" class="px-6 py-6">
              <h3 class="text-sm font-semibold text-gray-200 mb-4">Choose a service type</h3>
              <ul class="space-y-2">
                <li v-for="st in serviceTypes" :key="st.id">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-2.5 rounded-md text-sm text-gray-200 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 transition-colors"
                    @click="onSelectServiceType(st.id)"
                  >
                    {{ st.name }}
                  </button>
                </li>
              </ul>
              <p v-if="serviceTypes.length === 0" class="text-xs text-gray-500">No service types found.</p>
            </div>

            <!-- Select team state -->
            <div v-else-if="step === 'selectTeam'" class="px-6 py-6">
              <h3 class="text-sm font-semibold text-gray-200 mb-4">Choose a worship team</h3>
              <ul class="space-y-2">
                <li v-for="team in teams" :key="team.id">
                  <button
                    type="button"
                    class="w-full text-left px-4 py-2.5 rounded-md text-sm text-gray-200 bg-gray-800/60 hover:bg-gray-800 border border-gray-700 transition-colors"
                    @click="onSelectTeam(team.id)"
                  >
                    {{ team.name }}
                  </button>
                </li>
              </ul>
              <p v-if="teams.length === 0" class="text-xs text-gray-500">No teams found for this service type.</p>
            </div>

            <!-- Select positions state -->
            <div v-else-if="step === 'selectPositions'" class="px-6 py-6">
              <h3 class="text-sm font-semibold text-gray-200 mb-2">Choose positions to import</h3>
              <p class="text-xs text-gray-500 mb-4">
                Check only the individually-scheduled positions (e.g. Guitar, Sound). Leave group
                positions like Choir/Orchestra unchecked — they are excluded, not auto-detected.
              </p>
              <ul class="space-y-2">
                <li
                  v-for="position in positions"
                  :key="position.id"
                  class="flex items-center gap-3 px-4 py-2.5 rounded-md bg-gray-800/60 border border-gray-700"
                >
                  <input
                    :id="`position-${position.id}`"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
                    :checked="selectedPositionIds.has(position.id)"
                    @change="togglePosition(position.id)"
                  />
                  <label :for="`position-${position.id}`" class="flex-1 text-sm text-gray-200">
                    {{ position.name }}
                  </label>
                  <template v-if="selectedPositionIds.has(position.id)">
                    <select
                      v-if="rosterStore.rolesSorted.length > 0"
                      class="text-sm bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-gray-200"
                      :value="positionRoleMap[position.id] ?? ''"
                      @change="setPositionRole(position.id, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="" disabled>Map to Role...</option>
                      <option v-for="role in rosterStore.rolesSorted" :key="role.id" :value="role.id">
                        {{ role.name }}
                      </option>
                    </select>
                    <!-- Fail loudly instead of showing a silent empty dropdown when the
                         roster store has no roles loaded (e.g. store not yet subscribed). -->
                    <span v-else class="text-xs text-amber-400">
                      No roles available — configure roles on the Roster screen first.
                    </span>
                  </template>
                </li>
              </ul>
              <p v-if="positions.length === 0" class="text-xs text-gray-500">No positions found for this team.</p>
            </div>

            <!-- Fetching state -->
            <div v-else-if="step === 'fetching'" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Fetching from Planning Center...</p>
                <p class="text-xs text-gray-500">This may take a moment for large rosters.</p>
              </div>
            </div>

            <!-- Preview state -->
            <div v-else-if="step === 'preview'" class="px-6 py-8">
              <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-5">
                <h3 class="text-sm font-semibold text-gray-200 mb-4">Import Preview</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div class="rounded-lg bg-green-900/20 border border-green-800/50 p-4 text-center">
                    <p class="text-2xl font-bold text-green-300">{{ preview.toAdd }}</p>
                    <p class="text-xs text-green-400/80 mt-1">New volunteers to add</p>
                  </div>
                  <div class="rounded-lg bg-blue-900/20 border border-blue-800/50 p-4 text-center">
                    <p class="text-2xl font-bold text-blue-300">{{ preview.toUpdate }}</p>
                    <p class="text-xs text-blue-400/80 mt-1">Existing volunteers to update</p>
                  </div>
                </div>
                <p class="text-xs text-gray-500 mt-4 text-center">
                  {{ preview.toAdd + preview.toUpdate }} people total from Planning Center
                </p>
              </div>
            </div>

            <!-- Importing state -->
            <div v-else-if="step === 'importing'" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Importing volunteers...</p>
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
                    {{ preview.toAdd }} volunteer{{ preview.toAdd !== 1 ? 's' : '' }} added,
                    {{ preview.toUpdate }} volunteer{{ preview.toUpdate !== 1 ? 's' : '' }} updated.
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
                    <p class="text-xs text-red-400/80 mt-1">Go to Settings to check your Planning Center credentials.</p>
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
              @click="onStartSelectiveImport"
            >
              Import
            </button>

            <!-- Confirm positions button (selectPositions state) -->
            <button
              v-if="step === 'selectPositions'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canConfirmPositions()"
              @click="onConfirmPositions"
            >
              Continue
            </button>

            <!-- Retry button (error state) -->
            <button
              v-if="step === 'error'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              @click="lastRetry?.()"
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
import { useRosterStore } from '@/stores/roster'
import {
  fetchServiceTypes,
  fetchServiceTypeTeams,
  fetchTeamPositions,
  fetchPeopleForTeamPositions,
} from '@/utils/planningCenterApi'
import type { UpsertPersonInput, Person } from '@/types/roster'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

const authStore = useAuthStore()
const rosterStore = useRosterStore()

// ── State ──────────────────────────────────────────────────────────────────────

// Selective team/position import flow (D-08/D-09/D-10/D-11): service type → team →
// positions (with per-position Role mapping) → fetch scoped people → preview → confirm.
type Step =
  | 'idle'
  | 'selectServiceType'
  | 'selectTeam'
  | 'selectPositions'
  | 'fetching'
  | 'preview'
  | 'importing'
  | 'done'
  | 'error'
const step = ref<Step>('idle')
const errorMessage = ref('')

// Mapped people from PC (stored between fetch and confirm). Never carries a
// PC-sourced phone value — the selective fetch always leaves email '' (leader edits later).
const mappedPeople = ref<UpsertPersonInput[]>([])

// Preview counts
const preview = ref({ toAdd: 0, toUpdate: 0 })

// Selective import selection state — always freshly derived on modal open, never
// cached across opens (14-RESEARCH Security Domain / T-14-04-01).
const serviceTypes = ref<Array<{ id: string; name: string }>>([])
const teams = ref<Array<{ id: string; name: string }>>([])
const positions = ref<Array<{ id: string; name: string }>>([])
const selectedServiceTypeId = ref<string | null>(null)
const selectedTeamId = ref<string | null>(null)
const selectedPositionIds = ref<Set<string>>(new Set())
const positionRoleMap = ref<Record<string, string>>({})

// Re-invokes whichever step last failed, wired to the error state's Retry button.
const lastRetry = ref<(() => void) | null>(null)

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
  mappedPeople.value = []
  preview.value = { toAdd: 0, toUpdate: 0 }
  serviceTypes.value = []
  teams.value = []
  positions.value = []
  selectedServiceTypeId.value = null
  selectedTeamId.value = null
  selectedPositionIds.value = new Set()
  positionRoleMap.value = {}
  lastRetry.value = null
}

// ── Classification helper ─────────────────────────────────────────────────────

// Normalize a name for matching: trim, collapse internal whitespace, lowercase.
// Mirrors roster.ts::upsertPeople's own matching so preview counts match reality.
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function classifyPeople(mapped: UpsertPersonInput[], existing: Person[]) {
  const byPcId = new Map(existing.filter((p) => p.pcPersonId).map((p) => [p.pcPersonId!, p]))
  const byName = new Map(existing.map((p) => [normalizeName(p.name), p]))
  let toAdd = 0
  let toUpdate = 0
  for (const person of mapped) {
    const isExisting =
      (person.pcPersonId != null && byPcId.has(person.pcPersonId)) ||
      byName.has(normalizeName(person.name))
    if (isExisting) toUpdate++
    else toAdd++
  }
  return { toAdd, toUpdate }
}

// ── Actions ───────────────────────────────────────────────────────────────────

// Start the selective service-type → team → positions flow (D-08/D-11).
async function onStartSelectiveImport() {
  const creds = authStore.pcCredentials
  if (!creds) return

  lastRetry.value = onStartSelectiveImport
  step.value = 'fetching'
  errorMessage.value = ''

  try {
    serviceTypes.value = await fetchServiceTypes(creds.appId, creds.secret)
    step.value = 'selectServiceType'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred'
    errorMessage.value = message
    step.value = 'error'
  }
}

async function onSelectServiceType(serviceTypeId: string) {
  const creds = authStore.pcCredentials
  if (!creds) return

  selectedServiceTypeId.value = serviceTypeId
  lastRetry.value = () => onSelectServiceType(serviceTypeId)
  step.value = 'fetching'
  errorMessage.value = ''

  try {
    teams.value = await fetchServiceTypeTeams(creds.appId, creds.secret, serviceTypeId)
    step.value = 'selectTeam'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred'
    errorMessage.value = message
    step.value = 'error'
  }
}

async function onSelectTeam(teamId: string) {
  const creds = authStore.pcCredentials
  if (!creds) return

  selectedTeamId.value = teamId
  selectedPositionIds.value = new Set()
  positionRoleMap.value = {}
  lastRetry.value = () => onSelectTeam(teamId)
  step.value = 'fetching'
  errorMessage.value = ''

  try {
    positions.value = await fetchTeamPositions(creds.appId, creds.secret, teamId)
    step.value = 'selectPositions'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred'
    errorMessage.value = message
    step.value = 'error'
  }
}

// Toggle a position's inclusion. Leaving a position (e.g. choir/orchestra) unchecked
// is how it is excluded from import — there is no auto-detection (D-09).
function togglePosition(positionId: string) {
  const next = new Set(selectedPositionIds.value)
  if (next.has(positionId)) {
    next.delete(positionId)
    const rest = { ...positionRoleMap.value }
    delete rest[positionId]
    positionRoleMap.value = rest
  } else {
    next.add(positionId)
  }
  selectedPositionIds.value = next
}

function setPositionRole(positionId: string, roleId: string) {
  positionRoleMap.value = { ...positionRoleMap.value, [positionId]: roleId }
}

// True when every checked position has a Role mapped — required before fetching people.
function canConfirmPositions(): boolean {
  const checked = Array.from(selectedPositionIds.value)
  if (checked.length === 0) return false
  return checked.every((id) => !!positionRoleMap.value[id])
}

// Fetch the people currently serving each checked position and build UpsertPersonInput[],
// unioning mapped Role ids for anyone serving more than one selected position.
async function onConfirmPositions() {
  const creds = authStore.pcCredentials
  const teamId = selectedTeamId.value
  if (!creds || !teamId) return
  if (!canConfirmPositions()) return

  lastRetry.value = onConfirmPositions
  step.value = 'fetching'
  errorMessage.value = ''

  try {
    const checkedPositionIds = Array.from(selectedPositionIds.value)
    const nameByPerson = new Map<string, string>()
    const roleIdsByPerson = new Map<string, Set<string>>()

    for (const positionId of checkedPositionIds) {
      const roleId = positionRoleMap.value[positionId]
      if (!roleId) continue
      const peopleForPosition = await fetchPeopleForTeamPositions(
        creds.appId,
        creds.secret,
        teamId,
        new Set([positionId]),
      )
      for (const person of peopleForPosition) {
        nameByPerson.set(person.pcPersonId, person.name)
        const roles = roleIdsByPerson.get(person.pcPersonId) ?? new Set<string>()
        roles.add(roleId)
        roleIdsByPerson.set(person.pcPersonId, roles)
      }
    }

    const mapped: UpsertPersonInput[] = Array.from(roleIdsByPerson.entries()).map(
      ([pcPersonId, roleIds]) => ({
        name: nameByPerson.get(pcPersonId) ?? '',
        email: '',
        pcPersonId,
        roles: Array.from(roleIds),
      }),
    )

    mappedPeople.value = mapped
    preview.value = classifyPeople(mapped, rosterStore.people)
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
    await rosterStore.upsertPeople(mappedPeople.value)
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
