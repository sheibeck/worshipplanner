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
        v-if="personId"
        class="fixed inset-0 z-40 bg-black/60"
        @click="onClose"
      ></div>
    </Transition>

    <!-- Right drawer (Variant A, D-01) -->
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="personId"
        class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 class="text-base font-semibold text-gray-100">{{ draft.name }}</h2>
            <p class="text-xs text-gray-400 mt-0.5">{{ draft.email }}</p>
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
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          <!-- Serve frequency (per-role quarter tier, D-05/D-06) -->
          <section>
            <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Serve frequency <span class="font-normal normal-case text-gray-600">quarter tier — one control per role held</span>
            </h3>
            <div
              v-for="role in heldRoles"
              :key="role.id"
              class="mb-3 last:mb-0"
            >
              <p class="text-xs font-semibold text-gray-300 mb-1.5">{{ role.name }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in FREQ_PRESETS"
                  :key="preset.key"
                  type="button"
                  data-role="freq-preset"
                  :data-role-id="role.id"
                  :data-preset="preset.key"
                  :data-active="activeRoleTierPresetKey(role.id) === preset.key"
                  class="px-3 py-1.5 rounded-md text-xs font-medium border transition-colors"
                  :class="presetButtonClassFor(role.id, preset.key)"
                  @click="selectRoleTierPreset(role.id, preset.key)"
                >
                  {{ preset.label }}
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1.5">{{ roleFreqReadout(role.id) }}</p>
            </div>
            <p v-if="heldRoles.length === 0" class="text-xs text-gray-600 mb-2">
              No roles assigned yet — check a role below to set its per-role quarter tier.
            </p>
          </section>

          <!-- Unavailable Sundays -->
          <section class="border-t border-gray-800 pt-5">
            <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Unavailable Sundays <span class="font-normal normal-case text-gray-600">tap the Sundays they can't serve</span>
            </h3>
            <div class="flex flex-wrap gap-2 mb-3">
              <button
                v-for="n in [1, 2, 3, 4, 5]"
                :key="n"
                type="button"
                class="text-xs px-3 py-1 rounded-full border transition-colors"
                :class="ordFullySelected(n)
                  ? 'bg-amber-500 border-amber-500 text-gray-950'
                  : 'border-dashed border-gray-700 text-gray-400 hover:text-amber-300 hover:border-amber-700'"
                @click="toggleNth(n)"
              >
                {{ ordinalLabel(n) }} Sundays
              </button>
            </div>
            <div class="flex items-center gap-2 mb-3 text-xs text-gray-400 flex-wrap">
              <button
                type="button"
                class="px-2 py-1 rounded-md bg-gray-800 border border-gray-700 hover:bg-gray-700"
                @click="clearAllBlackouts"
              >
                Clear all
              </button>
            </div>
            <div class="grid grid-cols-4 gap-2">
              <template v-for="date in serviceDates" :key="date">
                <p v-if="showsMonthLabel(date)" class="col-span-4 text-xs font-bold uppercase tracking-wide text-gray-600 mt-2 mb-0.5">
                  {{ monthLabel(date) }}
                </p>
                <button
                  type="button"
                  data-role="sunday-cell"
                  :data-date="date"
                  class="rounded-md border px-2 py-2 text-xs font-semibold text-center transition-transform active:scale-95"
                  :class="isBlackedOut(date)
                    ? 'bg-red-900/30 border-red-700/60 text-red-300 line-through'
                    : 'bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'"
                  @click="toggleDate(date)"
                >
                  <span class="block text-[10px] font-normal text-gray-500">{{ ordinalDowLabel(date) }}</span>
                  {{ dayOfMonth(date) }}
                </button>
              </template>
            </div>
            <p class="text-xs text-gray-400 mt-2.5">
              Blocking <b class="text-gray-200">{{ draft.blackoutDates.length }}</b>
              Sunday{{ draft.blackoutDates.length === 1 ? '' : 's' }} &middot;
              available <b class="text-green-400">{{ serviceDates.length - draft.blackoutDates.length }}</b>
              of {{ serviceDates.length }}
            </p>
          </section>

          <!-- Must serve with -->
          <section class="border-t border-gray-800 pt-5">
            <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Must serve with <span class="font-normal normal-case text-gray-600">bidirectional — both get scheduled together</span>
            </h3>
            <div class="relative">
              <input
                v-model="pairQuery"
                type="text"
                placeholder="Type a name&hellip;"
                class="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200"
                @focus="pairMenuOpen = true"
                @blur="onPairBlur"
              />
              <div
                v-if="pairMenuOpen && pairCandidates.length > 0"
                class="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 max-h-48 overflow-auto"
              >
                <div
                  v-for="candidate in pairCandidates"
                  :key="candidate.id"
                  class="px-3 py-2 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white cursor-pointer"
                  @mousedown.prevent="addPair(candidate.id)"
                >
                  {{ candidate.name }}
                </div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 mt-2.5">
              <span
                v-for="id in draft.pairedWith"
                :key="id"
                class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-purple-900/40 border border-purple-700/50 text-purple-200"
              >
                {{ pairedPersonName(id) }}
                <button
                  type="button"
                  class="text-purple-300 hover:text-white"
                  aria-label="Remove pairing"
                  @click="removePair(id)"
                >
                  &times;
                </button>
              </span>
              <span v-if="draft.pairedWith.length === 0" class="text-xs text-gray-600">No pairings.</span>
            </div>
          </section>

          <!-- Quarter note -->
          <section class="border-t border-gray-800 pt-5">
            <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Quarter note <span class="font-normal normal-case text-gray-600">for you — never auto-scheduled</span>
            </h3>
            <textarea
              v-model="draft.note"
              rows="3"
              class="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 resize-y"
              placeholder="e.g. try again in the Fall"
            ></textarea>
          </section>

          <!-- Roles (D-09) — standing data, editable from this screen too -->
          <section class="border-t border-gray-800 pt-5">
            <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Roles <span class="font-normal normal-case text-gray-600">roles this person can fill</span>
            </h3>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <label
                v-for="role in rosterStore.roles"
                :key="role.id"
                class="inline-flex items-center gap-1.5 text-sm text-gray-300"
              >
                <input
                  type="checkbox"
                  data-role="role-checkbox"
                  :data-role-id="role.id"
                  :checked="draft.roles.includes(role.id)"
                  class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                  @change="onToggleRole(role.id)"
                />
                {{ role.name }}
              </label>
              <span v-if="rosterStore.roles.length === 0" class="text-sm text-gray-600">No roles configured yet.</span>
            </div>
          </section>

        </div>

        <!-- Footer actions -->
        <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            @click="onClose"
          >
            Close
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            @click="onSave"
          >
            Save
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useQuartersStore } from '@/stores/quarters'
import { useRosterStore } from '@/stores/roster'
import type { FrequencyTier, Role, RoleFrequencyEntry } from '@/types/roster'

const props = defineProps<{
  quarterId: string | null
  personId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const quartersStore = useQuartersStore()
const rosterStore = useRosterStore()

// ── Frequency presets (sketch FREQ/FREQ_ORDER) ──────────────────────────────
type FreqPresetKey = 'weekly' | 'biweek' | 'monthly' | 'fillin' | 'out'

const FREQ_PRESETS: Array<{ key: FreqPresetKey; label: string; n: number; tier: FrequencyTier }> = [
  { key: 'weekly', label: 'Every week', n: 1, tier: 'regular' },
  { key: 'biweek', label: 'Twice a month', n: 2, tier: 'regular' },
  { key: 'monthly', label: 'Monthly', n: 4, tier: 'regular' },
  { key: 'fillin', label: 'As-needed (fill-in)', n: 0, tier: 'fillin' },
  { key: 'out', label: 'Out this quarter', n: 0, tier: 'out' },
]

// Static class maps (never dynamically constructed — Tailwind v4 purge safety).
const PRESET_ON_CLASS: Record<FreqPresetKey, string> = {
  weekly: 'bg-indigo-600 border-indigo-600 text-white',
  biweek: 'bg-indigo-600 border-indigo-600 text-white',
  monthly: 'bg-indigo-600 border-indigo-600 text-white',
  fillin: 'bg-amber-500 border-amber-500 text-gray-950',
  out: 'bg-red-600 border-red-600 text-white',
}
const PRESET_OFF_CLASS = 'bg-gray-800 border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600'

// ── Draft state — loaded from standing (rosterStore.people) + quarter-scoped
// (quartersStore.getQuarter(...).personQuarterData), reset whenever personId changes ──
const draft = reactive({
  name: '',
  email: '',
  blackoutDates: [] as string[],
  pairedWith: [] as string[],
  // Quarter-scoped, per-role serve frequency (D-04/D-05) — single source of
  // truth, one entry per currently-held role. Replaces the old standing
  // per-person cadence field plus the old quarter-scoped tier-only split.
  roleFrequency: {} as Record<string, RoleFrequencyEntry>,
  note: '',
  // Standing roles (D-09) — editable from this drawer too, written through the
  // roster store the moment a checkbox is toggled (not deferred to Save).
  roles: [] as string[],
})

const quarter = computed(() => {
  if (!props.quarterId) return null
  try {
    return quartersStore.getQuarter(props.quarterId)
  } catch {
    return null
  }
})

const serviceDates = computed<string[]>(() => quarter.value?.serviceDates ?? [])

// Held roles (D-06) — driven by draft.roles (not the live roster snapshot) so a
// role just toggled on/off in this drawer's checklist (D-09) immediately shows
// or hides its per-role frequency control, without waiting on a Firestore
// round-trip.
const heldRoles = computed<Role[]>(() => {
  return draft.roles
    .map((id) => rosterStore.roles.find((r) => r.id === id))
    .filter((r): r is Role => r !== undefined)
})

// Declared ahead of loadDraft/the immediate watcher below (which runs synchronously
// during setup) so they're initialized before first use — refs declared later in this
// file would still be in the temporal dead zone when the immediate watcher fires.
const pairQuery = ref('')
const pairMenuOpen = ref(false)

function loadDraft(personId: string) {
  const person = rosterStore.people.find((p) => p.id === personId)
  const pqd = quarter.value?.personQuarterData[personId]

  draft.name = person?.name ?? ''
  draft.email = person?.email ?? ''
  draft.blackoutDates = pqd?.blackoutDates ? [...pqd.blackoutDates] : []
  draft.pairedWith = pqd?.pairedWith ? [...pqd.pairedWith] : []
  draft.note = pqd?.note ?? ''
  draft.roles = person ? [...person.roles] : []

  // Quarter-scoped, per-role frequency (D-04/D-05) — one entry per currently
  // held role, defaulting to { tier: 'regular', n: 4 } when absent.
  draft.roleFrequency = {}
  for (const roleId of draft.roles) {
    draft.roleFrequency[roleId] = pqd?.roleFrequency?.[roleId] ?? { tier: 'regular', n: 4 }
  }

  pairQuery.value = ''
  pairMenuOpen.value = false
}

watch(
  () => props.personId,
  (id) => {
    if (id) loadDraft(id)
  },
  { immediate: true },
)

// ── Roles checklist (D-09) — STANDING data, written through the roster store
// the instant a checkbox is toggled (same rosterStore.updatePerson path
// RosterView.vue's Edit Volunteer form uses), never deferred to the drawer's
// own Save button and never routed through quartersStore (D-08 — disjoint
// schemas: Person.roles vs PersonQuarterData.roleFrequency).
function onToggleRole(roleId: string) {
  const i = draft.roles.indexOf(roleId)
  if (i >= 0) {
    draft.roles.splice(i, 1)
  } else {
    draft.roles.push(roleId)
  }
  if (props.personId) {
    void rosterStore.updatePerson(props.personId, { roles: [...draft.roles] })
  }
}

// ── Serve frequency (per-role quarter tier + cadence, D-05/D-06) ───────────
// draft.roleFrequency[roleId] carries both the tier AND the cadence n in one
// write (D-05) — no separate standing frequency field remains. The 'regular'
// tier's active preset is derived from n (weekly n=1, biweek n=2, monthly n=4).
// WR-04: a non-preset n (e.g. "3" or "1-in-6" imported via CSV — both valid,
// supported frequencyLabelToN inputs) must NOT be shown as an active preset —
// 'monthly' previously matched by fallback, misrepresenting the real cadence
// and turning a click on "Monthly" into a silent, no-op-looking overwrite.
// 'custom' is a display-only state: it never matches any rendered preset's
// key, so no preset button is ever wrongly highlighted as active for it.
function activeRoleTierPresetKey(roleId: string): FreqPresetKey | 'custom' {
  const entry = draft.roleFrequency[roleId] ?? { tier: 'regular' as FrequencyTier, n: 4 }
  if (entry.tier === 'fillin') return 'fillin'
  if (entry.tier === 'out') return 'out'
  const preset = FREQ_PRESETS.find((p) => p.tier === 'regular' && p.n === entry.n)
  return preset?.key ?? 'custom'
}

function presetButtonClassFor(roleId: string, key: FreqPresetKey): string {
  return activeRoleTierPresetKey(roleId) === key ? PRESET_ON_CLASS[key] : PRESET_OFF_CLASS
}

function selectRoleTierPreset(roleId: string, key: FreqPresetKey) {
  const preset = FREQ_PRESETS.find((p) => p.key === key)!
  draft.roleFrequency[roleId] = { tier: preset.tier, n: preset.n }
}

function roleFreqReadout(roleId: string): string {
  const entry = draft.roleFrequency[roleId] ?? { tier: 'regular' as FrequencyTier, n: 4 }
  if (entry.tier === 'out') {
    return 'Excluded from every proposal this quarter.'
  }
  const servable = serviceDates.value.length - draft.blackoutDates.length
  if (entry.tier === 'fillin') {
    return `Only scheduled to fill gaps · available on ${servable} of ${serviceDates.value.length} Sundays`
  }
  const approx = Math.min(servable, Math.ceil(serviceDates.value.length / entry.n))
  // WR-04: no preset button is shown active for a non-canonical n, so make the custom
  // cadence explicit in the readout text too, rather than relying on the reader to notice
  // the number doesn't match any highlighted preset.
  const customPrefix = activeRoleTierPresetKey(roleId) === 'custom' ? `Custom (1-in-${entry.n}) · ` : ''
  return `${customPrefix}≈ ${approx} of ${serviceDates.value.length} Sundays`
}

// ── Sundays-only calendar (never a generic date-picker — iterates serviceDates directly) ──
function isBlackedOut(date: string): boolean {
  return draft.blackoutDates.includes(date)
}

function toggleDate(date: string) {
  const i = draft.blackoutDates.indexOf(date)
  if (i >= 0) {
    draft.blackoutDates.splice(i, 1)
  } else {
    draft.blackoutDates.push(date)
  }
}

function ordinalOf(date: string): number {
  const day = Number(date.split('-')[2])
  return Math.floor((day - 1) / 7) + 1
}

function ordinalLabel(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

function ordinalDowLabel(date: string): string {
  return `${ordinalLabel(ordinalOf(date))} Sun`
}

function dayOfMonth(date: string): number {
  return Number(date.split('-')[2])
}

function monthLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function showsMonthLabel(date: string): boolean {
  const idx = serviceDates.value.indexOf(date)
  if (idx <= 0) return true
  const prev = serviceDates.value[idx - 1]!
  return monthLabel(prev) !== monthLabel(date)
}

function ordFullySelected(n: number): boolean {
  const inMonth = serviceDates.value.filter((d) => ordinalOf(d) === n)
  return inMonth.length > 0 && inMonth.every((d) => draft.blackoutDates.includes(d))
}

function toggleNth(n: number) {
  const inMonth = serviceDates.value.filter((d) => ordinalOf(d) === n)
  const allSelected = inMonth.length > 0 && inMonth.every((d) => draft.blackoutDates.includes(d))
  if (allSelected) {
    draft.blackoutDates = draft.blackoutDates.filter((d) => !inMonth.includes(d))
  } else {
    for (const d of inMonth) {
      if (!draft.blackoutDates.includes(d)) draft.blackoutDates.push(d)
    }
  }
}

function clearAllBlackouts() {
  draft.blackoutDates = []
}

// ── Must-serve-with typeahead ────────────────────────────────────────────────
const pairCandidates = computed(() => {
  const q = pairQuery.value.trim().toLowerCase()
  return rosterStore.people
    .filter((p) => p.id !== props.personId && !draft.pairedWith.includes(p.id))
    .filter((p) => q === '' || p.name.toLowerCase().includes(q))
    .slice(0, 6)
})

function addPair(id: string) {
  if (!draft.pairedWith.includes(id)) draft.pairedWith.push(id)
  pairQuery.value = ''
  pairMenuOpen.value = false
}

function removePair(id: string) {
  draft.pairedWith = draft.pairedWith.filter((x) => x !== id)
}

function onPairBlur() {
  window.setTimeout(() => {
    pairMenuOpen.value = false
  }, 150)
}

function pairedPersonName(id: string): string {
  return rosterStore.people.find((p) => p.id === id)?.name ?? id
}

// ── Save / close ─────────────────────────────────────────────────────────────
async function onSave() {
  if (!props.quarterId || !props.personId) return

  // Quarter-scoped fields go through quartersStore.setPersonAvailability ONLY —
  // roleFrequency is now the single source of truth for serve cadence (D-05),
  // no standing frequency write remains (frequency is fully quarter-scoped).
  await quartersStore.setPersonAvailability(props.quarterId, props.personId, {
    blackoutDates: draft.blackoutDates,
    pairedWith: draft.pairedWith,
    roleFrequency: draft.roleFrequency,
    note: draft.note,
  })

  emit('close')
}

function onClose() {
  emit('close')
}
</script>
