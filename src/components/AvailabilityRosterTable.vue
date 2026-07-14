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
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Roles &amp; Frequency</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Blackout &amp; Note</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pairing</th>
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
            <td class="px-3 py-2.5 font-medium text-gray-100 whitespace-nowrap align-top">{{ person.name }}</td>
            <td class="px-3 py-2.5 align-top">
              <div
                v-for="roleId in person.roles"
                :key="roleId"
                class="flex items-center gap-2 mb-1 last:mb-0 whitespace-nowrap"
              >
                <span
                  class="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="roleChipClass(roleId)"
                >
                  {{ roleName(roleId) }}
                </span>
                <span class="text-xs text-gray-400">{{ roleFreqLabel(person.id, roleId) }}</span>
              </div>
              <span v-if="person.roles.length === 0" class="text-gray-600 italic text-xs">no roles</span>
            </td>
            <td class="px-3 py-2.5 text-gray-400 max-w-[20rem] align-top">
              <div v-if="blackoutDatesFormatted(person).length" class="text-xs text-amber-300/90 mb-1">
                <span class="text-[10px] uppercase tracking-wide text-gray-500 mr-1">Out</span>{{ blackoutDatesFormatted(person).join(', ') }}
              </div>
              <div v-if="noteSummary(person)" class="whitespace-pre-wrap text-gray-300">{{ noteSummary(person) }}</div>
              <span
                v-if="!blackoutDatesFormatted(person).length && !noteSummary(person)"
                class="text-gray-600 italic"
              >—</span>
            </td>
            <td class="px-3 py-2.5 text-purple-300 text-xs align-top">{{ pairSummary(person) }}</td>
            <td class="px-3 py-2.5 text-gray-600 text-base align-top">&rsaquo;</td>
          </tr>
          <tr v-if="filteredPeople.length === 0">
            <td colspan="5" class="px-3 py-6 text-center text-sm text-gray-600">No volunteers match this filter.</td>
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

// D-04/D-05: per-role tier read from the single quarter-scoped source of
// truth — roleFrequency?.[roleId]?.tier, defaulting to 'regular' when the
// role has no tuned entry (or no personQuarterData entry exists at all).
function tierOf(personId: string, roleId: string): FrequencyTier {
  const pqd = props.quarter?.personQuarterData[personId]
  return pqd?.roleFrequency?.[roleId]?.tier ?? 'regular'
}

// Aggregate a person's per-role tiers across their held roles into a single status
// for this admin table, most-restrictive-wins (out > fillin > regular) — a person
// out for ANY held role must surface as 'out' here, the primary admin audit surface
// for the per-role frequency feature (D-05). Defaults to 'regular' when no
// roleFrequency map exists (greenfield — no legacy-data migration per D-04).
function aggregateTier(person: Person): FrequencyTier {
  const pqd = props.quarter?.personQuarterData[person.id]
  if (!pqd?.roleFrequency || Object.keys(pqd.roleFrequency).length === 0) {
    return 'regular'
  }
  const tiers = person.roles.map((roleId) => tierOf(person.id, roleId))
  if (tiers.includes('out')) return 'out'
  if (tiers.includes('fillin')) return 'fillin'
  return 'regular'
}

// ── Quarter-scoped data lookup, defaulted per Phase 14 convention (lazy-default
// on read — a quarter with no personQuarterData entry for this person at all) ──
function quarterDataFor(person: Person): {
  blackoutDates: string[]
  pairedWith: string[]
  tier: FrequencyTier
  note: string
} {
  const pqd = props.quarter?.personQuarterData[person.id]
  return {
    blackoutDates: pqd?.blackoutDates ?? [],
    pairedWith: pqd?.pairedWith ?? [],
    tier: aggregateTier(person),
    note: pqd?.note ?? '',
  }
}

// ── Search + filter toolbar ──────────────────────────────────────────────────
const searchQuery = ref('')
const activeFilter = ref<'all' | 'out'>('all')

const filteredPeople = computed<Person[]>(() => {
  let list = rosterStore.activePeople

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  }

  if (activeFilter.value === 'out') {
    list = list.filter((p) => quarterDataFor(p).tier === 'out')
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

// ── Per-role frequency (Roles & Frequency column) ────────────────────────────
function freqLabel(n: number): string {
  if (n <= 1) return 'Every week'
  if (n <= 2) return 'Twice a month'
  if (n <= 4) return 'Monthly'
  return `1-in-${n}`
}

// D-04/D-05: per-role cadence read from the quarter-scoped roleFrequency map,
// defaulting to N=4 when a held role has no tuned entry.
function roleFrequencyN(personId: string, roleId: string): number {
  const pqd = props.quarter?.personQuarterData[personId]
  return pqd?.roleFrequency?.[roleId]?.n ?? 4
}

// Human label for a single held role's cadence — 'out'/'fillin' tiers win over
// the numeric cadence so an out/fill-in role reads plainly next to its chip.
// Each held role is shown with its OWN frequency (a volunteer with multiple roles
// no longer collapses to one aggregate badge).
function roleFreqLabel(personId: string, roleId: string): string {
  const tier = tierOf(personId, roleId)
  if (tier === 'out') return 'Out this quarter'
  if (tier === 'fillin') return 'Fill-in'
  return freqLabel(roleFrequencyN(personId, roleId))
}

// ── Blackout dates + note (Blackout & Note column) ───────────────────────────
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Format an ISO 'YYYY-MM-DD' as e.g. 'Jul 5' WITHOUT constructing a Date (avoids
// the UTC-vs-local off-by-one that new Date('2026-07-05') introduces). Falls back
// to the raw string if it doesn't parse.
function formatShortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!month || !day || month < 1 || month > 12) return iso
  return `${MONTH_ABBR[month - 1]} ${day}`
}

// The person's actual blacked-out service dates for this quarter, chronologically
// sorted and human-formatted (not just a count).
function blackoutDatesFormatted(person: Person): string[] {
  return [...quarterDataFor(person).blackoutDates].sort().map(formatShortDate)
}

// Per-quarter, per-person free-text note (PersonQuarterData.note).
function noteSummary(person: Person): string {
  return quarterDataFor(person).note.trim()
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
