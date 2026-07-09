<template>
  <div>
    <!-- Toolbar: search + filter chips (sketch lines 174-179) -->
    <div class="flex items-center gap-2 flex-wrap mb-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search volunteers&hellip;"
        class="flex-1 min-w-[180px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <button
        type="button"
        class="text-xs px-3 py-1.5 rounded-full border transition-colors"
        :class="activeFilter === 'all' ? FILTER_ON_CLASS : FILTER_OFF_CLASS"
        @click="activeFilter = 'all'"
      >
        All
      </button>
      <button
        type="button"
        class="text-xs px-3 py-1.5 rounded-full border transition-colors"
        :class="activeFilter === 'needsInput' ? FILTER_ON_CLASS : FILTER_OFF_CLASS"
        @click="activeFilter = 'needsInput'"
      >
        Needs input
      </button>
      <button
        type="button"
        class="text-xs px-3 py-1.5 rounded-full border transition-colors"
        :class="activeFilter === 'out' ? FILTER_ON_CLASS : FILTER_OFF_CLASS"
        @click="activeFilter = 'out'"
      >
        Out this quarter
      </button>
    </div>

    <!-- Roster table (sketch tableHead()/rowHtml()) -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Volunteer</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Roles</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Frequency</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Unavailable</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pairing</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="person in filteredPeople"
            :key="person.id"
            class="border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/40 transition-colors"
            @click="emit('select', person.id)"
          >
            <td class="px-3 py-2.5 font-medium text-gray-100 whitespace-nowrap">{{ person.name }}</td>
            <td class="px-3 py-2.5">
              <span
                v-for="roleId in person.roles"
                :key="roleId"
                class="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mr-1 mb-1 whitespace-nowrap"
                :class="roleChipClass(roleId)"
              >
                {{ roleName(roleId) }}
              </span>
            </td>
            <td class="px-3 py-2.5">
              <span class="text-xs font-semibold text-gray-300 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-0.5">
                {{ freqBadge(person) }}
              </span>
            </td>
            <td class="px-3 py-2.5 text-gray-400">{{ blackoutSummary(person) }}</td>
            <td class="px-3 py-2.5 text-purple-300 text-xs">{{ pairSummary(person) }}</td>
            <td class="px-3 py-2.5">
              <span
                class="text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                :class="statusPillClass(person)"
              >
                {{ statusLabel(person) }}
              </span>
            </td>
            <td class="px-3 py-2.5 text-gray-600 text-base">&rsaquo;</td>
          </tr>
          <tr v-if="filteredPeople.length === 0">
            <td colspan="7" class="px-3 py-6 text-center text-sm text-gray-600">No volunteers match this filter.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRosterStore } from '@/stores/roster'
import type { Quarter, Person, FrequencyTier, RoleGroup } from '@/types/roster'

const props = defineProps<{
  quarter: Quarter | null
}>()

const emit = defineEmits<{
  select: [personId: string]
}>()

const rosterStore = useRosterStore()

// ── Static class maps (never dynamically constructed — Tailwind v4 purge safety) ──
const ROLE_CHIP_CLASS: Record<RoleGroup, string> = {
  band: 'text-blue-300 bg-blue-900/40 border border-blue-700/50',
  tech: 'text-purple-300 bg-purple-900/40 border border-purple-700/50',
  vocals: 'text-pink-300 bg-pink-900/40 border border-pink-700/50',
  other: 'text-gray-300 bg-gray-800 border border-gray-700',
}

const FILTER_ON_CLASS = 'bg-gray-700 border-gray-600 text-white'
const FILTER_OFF_CLASS = 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'

const STATUS_PILL_CLASS: Record<FrequencyTier, string> = {
  regular: 'text-green-300 bg-green-900/30 border border-green-700/50',
  fillin: 'text-amber-300 bg-amber-900/30 border border-amber-700/50',
  out: 'text-red-300 bg-red-900/30 border border-red-700/50',
}

const STATUS_LABEL: Record<FrequencyTier, string> = {
  regular: 'Regular',
  fillin: 'Fill-in',
  out: 'Out this quarter',
}

// D-05: per-role tier read mirroring scheduler.ts's canonical tierOf —
// roleTiers?.[roleId] ?? frequencyTier ?? 'regular'.
function tierOf(personId: string, roleId: string): FrequencyTier {
  const pqd = props.quarter?.personQuarterData[personId]
  return pqd?.roleTiers?.[roleId] ?? pqd?.frequencyTier ?? 'regular'
}

// Aggregate a person's per-role tiers across their held roles into a single status
// for this admin table, most-restrictive-wins (out > fillin > regular) — a person
// out for ANY held role must surface as 'out' here, the primary admin audit surface
// for the per-role frequency feature (D-05). Falls back to the legacy per-person
// frequencyTier only when roleTiers is absent/empty (back-compat for pre-migration data).
function aggregateTier(person: Person): FrequencyTier {
  const pqd = props.quarter?.personQuarterData[person.id]
  if (!pqd?.roleTiers || Object.keys(pqd.roleTiers).length === 0) {
    return pqd?.frequencyTier ?? 'regular'
  }
  const tiers = person.roles.map((roleId) => tierOf(person.id, roleId))
  if (tiers.includes('out')) return 'out'
  if (tiers.includes('fillin')) return 'fillin'
  return 'regular'
}

// D-05: distinguish a person out for EVERY held role (genuinely unavailable all
// quarter) from one out for only SOME roles. The status pill uses the most-restrictive
// aggregate (aggregateTier) so anyone out for any role surfaces in the "Out this quarter"
// filter, but the Frequency and Unavailable columns describe overall availability — they
// must render the fully-out treatment ONLY when the person is out for ALL held roles,
// else a partially-out volunteer is falsely shown as unavailable (WR-01).
function allRolesOut(person: Person): boolean {
  const pqd = props.quarter?.personQuarterData[person.id]
  if (!pqd?.roleTiers || Object.keys(pqd.roleTiers).length === 0) {
    return (pqd?.frequencyTier ?? 'regular') === 'out'
  }
  if (person.roles.length === 0) return false
  return person.roles.every((roleId) => tierOf(person.id, roleId) === 'out')
}

// ── Quarter-scoped data lookup, defaulted per Phase 14 convention (lazy-default
// on read — pre-migration Phase 13 data has no frequencyTier/note at all) ──
function quarterDataFor(person: Person): {
  blackoutDates: string[]
  pairedWith: string[]
  frequencyTier: FrequencyTier
  note: string
} {
  const pqd = props.quarter?.personQuarterData[person.id]
  return {
    blackoutDates: pqd?.blackoutDates ?? [],
    pairedWith: pqd?.pairedWith ?? [],
    frequencyTier: aggregateTier(person),
    note: pqd?.note ?? '',
  }
}

const serviceDates = computed<string[]>(() => props.quarter?.serviceDates ?? [])

// ── Search + filter toolbar ──────────────────────────────────────────────────
const searchQuery = ref('')
const activeFilter = ref<'all' | 'needsInput' | 'out'>('all')

const filteredPeople = computed<Person[]>(() => {
  let list = rosterStore.activePeople

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  }

  if (activeFilter.value === 'needsInput') {
    list = list.filter((p) => !props.quarter?.personQuarterData[p.id])
  } else if (activeFilter.value === 'out') {
    list = list.filter((p) => quarterDataFor(p).frequencyTier === 'out')
  }

  return list
})

// ── Role chips ────────────────────────────────────────────────────────────────
function roleName(roleId: string): string {
  return rosterStore.roles.find((r) => r.id === roleId)?.name ?? roleId
}

function roleChipClass(roleId: string): string {
  const group = rosterStore.roles.find((r) => r.id === roleId)?.group ?? 'other'
  return ROLE_CHIP_CLASS[group]
}

// ── Frequency badge (sketch freqBadge()) ─────────────────────────────────────
function freqLabel(n: number): string {
  if (n <= 1) return 'Every week'
  if (n <= 2) return 'Twice a month'
  if (n <= 4) return 'Monthly'
  return `1-in-${n}`
}

function freqBadge(person: Person): string {
  const pqd = quarterDataFor(person)
  if (allRolesOut(person)) return '—'
  if (pqd.frequencyTier === 'fillin') return 'fill-in'
  const total = serviceDates.value.length
  if (total === 0) return freqLabel(person.frequencyTargetN)
  const servable = total - pqd.blackoutDates.length
  const approx = Math.min(servable, Math.ceil(total / Math.max(1, person.frequencyTargetN)))
  return `${freqLabel(person.frequencyTargetN)} · ≈${approx}`
}

// ── Status pill ───────────────────────────────────────────────────────────────
function statusLabel(person: Person): string {
  return STATUS_LABEL[quarterDataFor(person).frequencyTier]
}

function statusPillClass(person: Person): string {
  return STATUS_PILL_CLASS[quarterDataFor(person).frequencyTier]
}

// ── Blackout summary (sketch blackoutSummary()) — detects a dominant Nth-Sunday
// pattern across the quarter's serviceDates, else falls back to a raw date count ──
function ordinalOf(date: string): number {
  const day = Number(date.split('-')[2])
  return Math.floor((day - 1) / 7) + 1
}

function ordinalLabel(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

function blackoutSummary(person: Person): string {
  const pqd = quarterDataFor(person)
  if (allRolesOut(person)) return '— out all quarter —'

  const blackout = pqd.blackoutDates
  if (blackout.length === 0) return 'fully available'

  const dates = serviceDates.value
  const countByOrdinal: Record<number, number> = {}
  for (const d of dates) {
    const o = ordinalOf(d)
    countByOrdinal[o] = (countByOrdinal[o] ?? 0) + 1
  }
  const blockedByOrdinal: Record<number, number> = {}
  for (const d of blackout) {
    const o = ordinalOf(d)
    blockedByOrdinal[o] = (blockedByOrdinal[o] ?? 0) + 1
  }

  const parts: string[] = []
  const claimed = new Set<string>()
  for (const key of Object.keys(blockedByOrdinal)) {
    const o = Number(key)
    if (blockedByOrdinal[o] === countByOrdinal[o] && (countByOrdinal[o] ?? 0) > 1) {
      parts.push(`${ordinalLabel(o)} Sundays`)
      for (const d of blackout) {
        if (ordinalOf(d) === o) claimed.add(d)
      }
    }
  }

  const extras = blackout.filter((d) => !claimed.has(d))
  if (extras.length > 0) {
    parts.push(`${extras.length} date${extras.length > 1 ? 's' : ''}`)
  }
  if (parts.length === 0) {
    parts.push(`${blackout.length} date${blackout.length > 1 ? 's' : ''}`)
  }
  return parts.join(' + ')
}

// ── Pairing summary (sketch pairChipsHtml()/firstName()) ─────────────────────
function firstName(id: string): string {
  const name = rosterStore.people.find((p) => p.id === id)?.name
  return name ? name.split(' ')[0]! : id
}

function pairSummary(person: Person): string {
  const pairedWith = quarterDataFor(person).pairedWith
  if (pairedWith.length === 0) return ''
  return '↔ ' + pairedWith.map((id) => firstName(id)).join(', ')
}
</script>
