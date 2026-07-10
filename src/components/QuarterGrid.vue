<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th
            class="sticky left-0 z-10 bg-gray-900 px-2 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
          >
            Date
          </th>
          <th
            v-for="role in sortedRoles"
            :key="role.id"
            class="px-2 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
            :class="groupHeaderBg[role.group]"
          >
            {{ role.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="date in quarter.serviceDates" :key="date">
          <tr class="border-b border-gray-800/50">
            <td
              class="sticky left-0 z-10 bg-gray-900 px-2 py-2 text-sm font-medium text-gray-100 whitespace-nowrap align-top"
            >
              {{ formatDateLabel(date) }}
            </td>
            <td v-for="role in sortedRoles" :key="role.id" class="px-2 py-2 align-top">
              <button
                type="button"
                data-role="grid-cell"
                :data-role-id="role.id"
                :data-date="date"
                class="w-full text-left rounded-md p-1 transition-colors hover:bg-gray-800/60"
                :class="cellIsUnfilled(date, role.id) ? 'border border-dashed border-gray-700' : ''"
                :aria-expanded="isExpanded(date, role.id)"
                @click="toggleCell(date, role.id)"
              >
                <div class="flex flex-wrap gap-1 items-center">
                  <span
                    v-for="personId in cellPeople(date, role.id)"
                    :key="personId"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-800 text-gray-200 border-gray-700"
                  >
                    {{ personName(personId) }}
                    <span
                      role="button"
                      aria-label="Remove"
                      class="text-gray-500 hover:text-red-400 cursor-pointer"
                      @click.stop="onClear(date, role.id, personId)"
                    >&times;</span>
                  </span>
                  <span v-if="cellPeople(date, role.id).length === 0" class="text-xs text-gray-600">&mdash;</span>
                </div>
                <div class="flex items-center gap-1 mt-1 flex-wrap">
                  <span
                    v-if="cellIsUnfilled(date, role.id)"
                    class="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400"
                  >
                    Unfilled
                  </span>
                  <span
                    v-if="cellHasConflict(date, role.id)"
                    class="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-300"
                  >
                    Pairing conflict
                  </span>
                  <span
                    v-if="cellHasGroupViolation(date, role.id)"
                    class="text-xs px-2 py-0.5 rounded-full bg-orange-900/40 border border-orange-700/50 text-orange-300"
                  >
                    Group conflict
                  </span>
                </div>
              </button>
            </td>
          </tr>

        </template>
      </tbody>
    </table>
  </div>

  <!-- Group editor slide-out (R-14) — reuses AvailabilityDrawer's exact Teleport/backdrop/panel/Transition markup -->
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
        v-if="expandedCell"
        class="fixed inset-0 z-40 bg-black/60"
        @click="closeDrawer"
      ></div>
    </Transition>

    <!-- Right slide-out panel -->
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="expandedCell"
        class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 class="text-base font-semibold text-gray-100">
            {{ expandedRoleName }} &mdash; {{ formatDateLabel(expandedCell.date) }}
          </h2>
          <button
            type="button"
            class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            @click="closeDrawer"
            aria-label="Close editor"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <!-- Current assignments: clear / swap -->
          <div v-if="expandedAssigned.length > 0" class="space-y-2 mb-4">
            <div
              v-for="personId in expandedAssigned"
              :key="personId"
              class="flex items-center gap-3 flex-wrap"
            >
              <span class="text-sm text-gray-200 min-w-[8rem]">{{ personName(personId) }}</span>
              <button
                type="button"
                class="text-xs px-2 py-1 rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                @click="onClear(expandedCell.date, expandedCell.roleId, personId)"
              >
                Clear
              </button>
              <select
                class="text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value=""
                @change="onSwapSelect($event, personId)"
              >
                <option value="">Swap with&hellip;</option>
                <option
                  v-for="candidate in expandedEligible"
                  :key="candidate.id"
                  :value="candidate.id"
                >
                  {{ candidate.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Add another person (multi-person-per-role, D-04) -->
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <select
              v-model="addSelectId"
              class="text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Add a person&hellip;</option>
              <option
                v-for="candidate in expandedEligible"
                :key="candidate.id"
                :value="candidate.id"
              >
                {{ candidate.name }}
              </option>
            </select>
            <button
              type="button"
              class="text-xs px-3 py-1.5 rounded-md text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!addSelectId"
              @click="onAdd"
            >
              Assign
            </button>
          </div>

          <!-- Gap-filling panel (D-23) -->
          <div
            v-if="expandedCell && cellIsUnfilled(expandedCell.date, expandedCell.roleId)"
            class="grid grid-cols-1 gap-4 pt-3 border-t border-gray-800"
          >
            <div>
              <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Blacked out today</p>
              <ul class="space-y-1">
                <li
                  v-for="p in expandedBlackedOut"
                  :key="p.id"
                  class="text-sm text-gray-500 line-through"
                >
                  {{ p.name }}
                </li>
                <li v-if="expandedBlackedOut.length === 0" class="text-xs text-gray-600">None</li>
              </ul>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Available, not yet assigned</p>
              <ul class="space-y-1">
                <li
                  v-for="p in expandedEligible"
                  :key="p.id"
                  class="flex items-center justify-between gap-2 text-sm px-2 py-1 rounded-md bg-green-900/30 text-green-400"
                >
                  {{ p.name }}
                  <button
                    type="button"
                    class="text-xs text-green-300 hover:text-green-200 underline"
                    @click="onQuickAssign(expandedCell.date, expandedCell.roleId, p.id)"
                  >
                    Assign
                  </button>
                </li>
                <li v-if="expandedEligible.length === 0" class="text-xs text-gray-600">None</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuartersStore } from '@/stores/quarters'
import { useRosterStore } from '@/stores/roster'
import { evaluateGroupCombo } from '@/utils/scheduler'
import type { Quarter, Role, RoleGroup, ProposeResult, Person, FrequencyTier } from '@/types/roster'

const props = defineProps<{
  quarter: Quarter
  roles: Role[]
  lastProposeResult: ProposeResult | null
}>()

const quartersStore = useQuartersStore()
const rosterStore = useRosterStore()

// ── Static class maps (never dynamically constructed — Tailwind v4 purge safety) ──
const groupHeaderBg: Record<RoleGroup, string> = {
  band: 'bg-blue-900/50',
  tech: 'bg-purple-900/50',
  vocals: 'bg-pink-900/50',
  other: 'bg-gray-800',
} as const

const GROUP_ORDER: RoleGroup[] = ['band', 'vocals', 'tech', 'other']

// ── Roles grouped Band/Tech/Other, ordered within group ────────────────────────
const sortedRoles = computed<Role[]>(() => {
  return [...props.roles].sort((a, b) => {
    const groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
    if (groupDiff !== 0) return groupDiff
    return a.order - b.order
  })
})

// ── Cell data helpers ────────────────────────────────────────────────────────────
function cellPeople(date: string, roleId: string): string[] {
  return props.quarter.calendar[date]?.[roleId] ?? []
}

function effectiveCountFor(date: string, roleId: string): number {
  const override = props.quarter.roleOverridesByDate[date]
  const overrideMatch = override?.find((r) => r.roleId === roleId)
  if (overrideMatch) return overrideMatch.count
  const role = props.roles.find((r) => r.id === roleId)
  return role?.defaultCount ?? 0
}

function isInUnfilledList(date: string, roleId: string): boolean {
  return props.lastProposeResult?.unfilled.some((u) => u.date === date && u.roleId === roleId) ?? false
}

function cellIsUnfilled(date: string, roleId: string): boolean {
  return cellPeople(date, roleId).length < effectiveCountFor(date, roleId) || isInUnfilledList(date, roleId)
}

function cellHasConflict(date: string, roleId: string): boolean {
  const conflicts = props.lastProposeResult?.pairingConflicts.filter((c) => c.date === date) ?? []
  if (conflicts.length === 0) return false
  const assigned = cellPeople(date, roleId)
  return assigned.some((id) => conflicts.some((c) => c.personId === id || c.partnerId === id))
}

// ── Group co-occurrence warning (D-11, warn-don't-block) ────────────────────────
// Map-backed lookup (not a repeated .find), consistent with cellIsUnfilled/
// cellHasConflict's O(roles) per-cell cost — no new perf class (T-15-06-03).
const roleGroupById = computed(() => {
  const m = new Map<string, RoleGroup>()
  for (const r of props.roles) m.set(r.id, r.group)
  return m
})

function roleGroupOf(roleId: string): RoleGroup {
  return roleGroupById.value.get(roleId) ?? 'other'
}

// Live-computed from props.quarter.calendar + props.roles (NOT props.lastProposeResult) —
// works for a loaded historical calendar, not only immediately after a fresh propose.
// Reuses the same exported evaluateGroupCombo helper the scheduler uses (T-15-06-02):
// one rule source, no drift between auto-propose enforcement and this advisory badge.
function cellHasGroupViolation(date: string, roleId: string): boolean {
  const peopleInCell = cellPeople(date, roleId)
  if (peopleInCell.length === 0) return false
  const calendarForDate = props.quarter.calendar[date] ?? {}
  return peopleInCell.some((personId) => {
    const roleIdsThisDate = Object.entries(calendarForDate)
      .filter(([, ids]) => ids.includes(personId))
      .map(([rId]) => rId)
    return !evaluateGroupCombo(roleIdsThisDate, roleGroupOf).ok
  })
}

function personName(id: string): string {
  return rosterStore.people.find((p) => p.id === id)?.name ?? '(unknown)'
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Blackout + candidate helpers (D-23) ─────────────────────────────────────────
function isBlackedOut(personId: string, date: string): boolean {
  return props.quarter.personQuarterData[personId]?.blackoutDates.includes(date) ?? false
}

function hasRole(person: Person, roleId: string): boolean {
  return person.roles.includes(roleId)
}

// D-04/D-05: 'out'-tier people must never be offered as a manual gap-filling candidate,
// mirroring the auto-proposal exclusion (defaults 'regular' when absent — pre-Phase-14
// data has no frequencyTier at all). Per-role (D-05): a person can be 'out' for one role
// they hold while remaining 'regular' for another — reads roleFrequency[roleId].tier,
// the single source of truth (R-05), mirroring scheduler.ts's tierOf.
function tierOf(personId: string, roleId: string): FrequencyTier {
  const pqd = props.quarter.personQuarterData[personId]
  return pqd?.roleFrequency?.[roleId]?.tier ?? 'regular'
}

// Available-unassigned for (date, roleId) = activePeople with roleId in roles,
// NOT blacked out that date, NOT already in that cell, NOT 'out'-tier for this role.
function availableUnassigned(date: string, roleId: string): Person[] {
  const assigned = new Set(cellPeople(date, roleId))
  return rosterStore.activePeople.filter(
    (p) =>
      hasRole(p, roleId) &&
      !isBlackedOut(p.id, date) &&
      !assigned.has(p.id) &&
      tierOf(p.id, roleId) !== 'out',
  )
}

// Blacked-out-today for a (date, roleId) gap = active people who could fill this role
// but are blacked out that date and not already assigned to the cell.
function blackedOutToday(date: string, roleId: string): Person[] {
  const assigned = new Set(cellPeople(date, roleId))
  return rosterStore.activePeople.filter(
    (p) => hasRole(p, roleId) && isBlackedOut(p.id, date) && !assigned.has(p.id),
  )
}

// ── Expanded cell state (click-to-edit + gap panel) ─────────────────────────────
const expandedCell = ref<{ date: string; roleId: string } | null>(null)
const addSelectId = ref('')

function isExpanded(date: string, roleId: string): boolean {
  return expandedCell.value?.date === date && expandedCell.value?.roleId === roleId
}

function toggleCell(date: string, roleId: string) {
  if (isExpanded(date, roleId)) {
    expandedCell.value = null
  } else {
    expandedCell.value = { date, roleId }
  }
  addSelectId.value = ''
}

function closeDrawer() {
  expandedCell.value = null
  addSelectId.value = ''
}

const expandedRoleName = computed<string>(() => {
  if (!expandedCell.value) return ''
  return props.roles.find((r) => r.id === expandedCell.value!.roleId)?.name ?? ''
})

const expandedAssigned = computed<string[]>(() => {
  if (!expandedCell.value) return []
  return cellPeople(expandedCell.value.date, expandedCell.value.roleId)
})

const expandedEligible = computed<Person[]>(() => {
  if (!expandedCell.value) return []
  return availableUnassigned(expandedCell.value.date, expandedCell.value.roleId)
})

const expandedBlackedOut = computed<Person[]>(() => {
  if (!expandedCell.value) return []
  return blackedOutToday(expandedCell.value.date, expandedCell.value.roleId)
})

// ── Store actions — scoped Firestore dot-path updates only (D-22, T-13-09-02) ──
function onClear(date: string, roleId: string, personId: string) {
  quartersStore.clearAssignment(props.quarter.id, date, roleId, personId)
}

function onAdd() {
  if (!expandedCell.value || !addSelectId.value) return
  quartersStore.assignPerson(props.quarter.id, expandedCell.value.date, expandedCell.value.roleId, addSelectId.value)
  addSelectId.value = ''
}

function onQuickAssign(date: string, roleId: string, personId: string) {
  quartersStore.assignPerson(props.quarter.id, date, roleId, personId)
}

function onSwapSelect(event: Event, fromPersonId: string) {
  const select = event.target as HTMLSelectElement
  const toPersonId = select.value
  if (!toPersonId || !expandedCell.value) return
  quartersStore.swapAssignment(props.quarter.id, expandedCell.value.date, expandedCell.value.roleId, fromPersonId, toPersonId)
  select.value = ''
}
</script>
