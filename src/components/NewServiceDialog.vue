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
        @click="onCancel"
      ></div>
    </Transition>

    <!-- Dialog -->
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
        @click.self="onCancel"
      >
        <div class="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 class="text-base font-semibold text-gray-100">New Service</h2>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              @click="onCancel"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-5">

            <!-- Date -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Service Date</label>
              <input
                v-model="form.date"
                type="date"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                @change="onDateChange"
              />
            </div>

            <!-- Service Name (shown when Special is checked) -->
            <div v-if="form.teams.includes('Special')">
              <label class="block text-xs font-medium text-gray-400 mb-1">Service Name</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="e.g. Good Friday, Easter, Christmas Eve"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder-gray-500"
              />
            </div>

            <!-- Teams -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-2">Teams</label>
              <div v-if="teamsStore.teams.length > 0" class="flex flex-wrap gap-2">
                <label
                  v-for="team in teamsStore.teams"
                  :key="team.id"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors text-sm"
                  :class="form.teams.includes(team.name)
                    ? 'bg-indigo-900/30 border-indigo-600 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'"
                >
                  <input
                    type="checkbox"
                    :value="team.name"
                    v-model="form.teams"
                    class="accent-indigo-500"
                    @change="onTeamCheckboxChange(team.name)"
                  />
                  {{ team.name }}
                </label>
              </div>
              <p v-else class="text-xs text-gray-500">No teams configured — add teams in Volunteers → Teams.</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-800">
            <button
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors"
              @click="onCancel"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              @click="onCreate"
            >
              Create Service
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { nextFreeSunday } from '@/utils/quarterDates'
import { useTeamsStore } from '@/stores/teams'
import { teamMatchesDate } from '@/utils/teamRecurrence'

const props = withDefaults(
  defineProps<{
    open: boolean
    /**
     * R038 / D-14: dates (YYYY-MM-DD) that already have a service plan, so the default
     * date can skip them. A PROP, not a store read — `ServicesView` is the only mount
     * site and already subscribes to the service list, so this one value stays a prop
     * rather than a second read of the same data. (Phase 79: the component now also
     * reads `useTeamsStore()` directly for the team checkboxes, so it is no longer
     * Pinia-free — its test file installs a Pinia instance + store mock.)
     * Defaults to empty so any other mount site keeps the plain next-Sunday behaviour.
     */
    takenDates?: readonly string[]
  }>(),
  { takenDates: () => [] },
)

const emit = defineEmits<{
  close: []
  create: [data: { date: string; name: string; teams: string[] }]
}>()

const teamsStore = useTeamsStore()

interface FormState {
  date: string
  name: string
  teams: string[]
}

function defaultForm(): FormState {
  // R038: the nearest FUTURE Sunday with no plan yet. `nextFreeSunday` carries the
  // D-13 bound and falls back to the plain next Sunday itself, so this is the single
  // date source — the old private nextSunday() (and its inline copy of the date
  // formatter) is gone deliberately; do not reintroduce a second one.
  const date = nextFreeSunday(new Date(), props.takenDates)
  // R231's hard-coded ordinal rule stays gone — every new service still starts
  // with no teams checked here. Phase 86 (R255) reintroduces a CONFIGURABLE,
  // per-team pre-check, but it runs as a separate step after the form is reset
  // (see applyRecurrenceAutoSelect + the open watcher below), never inline here.
  return { date, name: '', teams: [] }
}

// R255: team names auto-added by the current recurrence match, so the next
// recompute knows which checkboxes it owns and can safely clear/replace them.
const autoAddedTeams = ref<string[]>([])
// R255: team names the planner has manually checked or unchecked (in either
// direction) during this dialog session — once touched, auto-select must
// never add or remove them again, even if a later date matches/un-matches
// their configured pattern (CONTEXT: "fully overridable ... never clobbering
// manual check/uncheck choices").
const manuallyTouchedTeams = ref<string[]>([])

// R255: creation-only auto-select. Pre-checks every team whose configured
// recurrence pattern matches `date`, without disturbing any team the planner
// has manually toggled. Invoked once at setup (so an initially-open dialog
// auto-selects too), on dialog open (after the form reset), and from the
// Service Date's @change handler — never as a form.date watcher, so the
// recompute point stays deterministic.
function applyRecurrenceAutoSelect(date: string) {
  for (const name of autoAddedTeams.value) {
    const idx = form.value.teams.indexOf(name)
    if (idx !== -1) form.value.teams.splice(idx, 1)
  }
  autoAddedTeams.value = []
  for (const team of teamsStore.teams) {
    if (manuallyTouchedTeams.value.includes(team.name)) continue
    if (teamMatchesDate(team, date) && !form.value.teams.includes(team.name)) {
      form.value.teams.push(team.name)
      autoAddedTeams.value.push(team.name)
    }
  }
}

const form = ref<FormState>(defaultForm())
applyRecurrenceAutoSelect(form.value.date)

function onDateChange() {
  applyRecurrenceAutoSelect(form.value.date)
}

// See ADR-0067 (docs/adr/0067-teamsstore-subscribe-s-onsnapshot-is-async-so-if-the-dialog.md)
// unchecked when this fires.
watch(
  () => teamsStore.teams,
  () => {
    if (props.open) {
      applyRecurrenceAutoSelect(form.value.date)
    }
  },
)

// R255: any manual toggle (check OR uncheck) permanently promotes a team out
// of auto-management for the remainder of this dialog session, so a later
// date change can never re-add it (if unchecked) or remove it (if checked).
function onTeamCheckboxChange(name: string) {
  if (!manuallyTouchedTeams.value.includes(name)) {
    manuallyTouchedTeams.value.push(name)
  }
  const idx = autoAddedTeams.value.indexOf(name)
  if (idx !== -1) autoAddedTeams.value.splice(idx, 1)
}

// Reset form when dialog opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.value = defaultForm()
      autoAddedTeams.value = []
      manuallyTouchedTeams.value = []
      applyRecurrenceAutoSelect(form.value.date)
    }
  },
)

function onCancel() {
  emit('close')
}

function onCreate() {
  emit('create', {
    date: form.value.date,
    name: form.value.name,
    teams: form.value.teams,
  })
}
</script>
