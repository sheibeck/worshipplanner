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
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="team in availableTeams"
                  :key="team"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors text-sm"
                  :class="form.teams.includes(team)
                    ? 'bg-indigo-900/30 border-indigo-600 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'"
                >
                  <input
                    type="checkbox"
                    :value="team"
                    v-model="form.teams"
                    class="accent-indigo-500"
                  />
                  {{ team }}
                </label>
              </div>
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

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [data: { date: string; name: string; teams: string[] }]
}>()

const availableTeams = ['Choir', 'Orchestra', 'Communion', 'Special']

// Compute next Sunday
function nextSunday(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 6=Sat
  const daysUntilSunday = day === 0 ? 7 : 7 - day
  const sunday = new Date(now)
  sunday.setDate(now.getDate() + daysUntilSunday)
  const y = sunday.getFullYear()
  const m = String(sunday.getMonth() + 1).padStart(2, '0')
  const d = String(sunday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns which Sunday of the month (1-5) a date falls on, or 0 if not a Sunday */
function sundayOrdinal(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number) as [number, number, number]
  const d = new Date(year, month - 1, day)
  if (d.getDay() !== 0) return 0 // not a Sunday
  return Math.ceil(day / 7)
}

interface FormState {
  date: string
  name: string
  teams: string[]
}

function defaultForm(): FormState {
  const date = nextSunday()
  const ordinal = sundayOrdinal(date)
  let teams: string[] = []
  if (ordinal === 1) teams = ['Orchestra', 'Communion']
  else if (ordinal === 3) teams = ['Choir']
  return { date, name: '', teams }
}

const form = ref<FormState>(defaultForm())

// Reset form when dialog opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.value = defaultForm()
    }
  },
)

// Apply Sunday-based team defaults when date changes
watch(
  () => form.value.date,
  (newDate) => {
    const ordinal = sundayOrdinal(newDate)
    if (ordinal === 1) {
      form.value.teams = ['Orchestra', 'Communion']
    } else if (ordinal === 3) {
      form.value.teams = ['Choir']
    } else {
      form.value.teams = []
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
