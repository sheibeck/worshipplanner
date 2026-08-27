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
        class="fixed inset-0 z-40 bg-black/30"
        @click="onClose"
      ></div>
    </Transition>

    <!-- Panel -->
    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="open"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 class="text-base font-semibold text-gray-100">
            Recurring Schedule{{ team ? ` — ${team.name}` : '' }}
          </h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
              @click="onClose"
            >
              Cancel
            </button>
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
              :disabled="isSaving"
              @click="onSave"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
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
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <p class="text-sm text-gray-300 mb-1">
              Automatically pre-select this team when a new service is created on a matching date.
            </p>
            <p class="text-xs text-gray-500">
              Select every ordinal Sunday this team serves. Leave all unselected for no recurring pattern.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2" role="group" aria-label="Recurring Sundays">
            <button
              v-for="opt in ordinalOptions"
              :key="opt.value"
              type="button"
              class="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium border transition-colors"
              :class="localOrdinals.includes(opt.value)
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750 hover:border-gray-600'"
              :aria-pressed="localOrdinals.includes(opt.value)"
              @click="toggleOrdinal(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>

          <div class="pt-2 border-t border-gray-800">
            <button
              type="button"
              class="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              :disabled="localOrdinals.length === 0"
              @click="onClear"
            >
              Clear selection
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTeamsStore } from '@/stores/teams'
import type { Team } from '@/types/team'

const props = defineProps<{
  open: boolean
  team: Team | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const teamsStore = useTeamsStore()

const ordinalOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: '1st Sunday' },
  { value: 2, label: '2nd Sunday' },
  { value: 3, label: '3rd Sunday' },
  { value: 4, label: '4th Sunday' },
  { value: 5, label: '5th Sunday' },
]

// Local editable copy — never mutates the store's team object directly.
// Seeded from props.team on open so a reopened slide-over shows the saved
// pattern (R254 round-trip); resets to empty when the team has no recurrence.
const localOrdinals = ref<number[]>([])
const isSaving = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      localOrdinals.value = [...(props.team?.recurrence?.ordinals ?? [])].sort((a, b) => a - b)
    }
  },
)

function toggleOrdinal(value: number) {
  const idx = localOrdinals.value.indexOf(value)
  if (idx >= 0) {
    localOrdinals.value.splice(idx, 1)
  } else {
    localOrdinals.value.push(value)
    localOrdinals.value.sort((a, b) => a - b)
  }
}

function onClear() {
  localOrdinals.value = []
}

async function onSave() {
  if (!props.team) return
  isSaving.value = true
  try {
    await teamsStore.updateTeam(props.team.id, {
      recurrence: { ordinals: [...localOrdinals.value].sort((a, b) => a - b) },
    })
    emit('saved')
  } finally {
    isSaving.value = false
  }
}

function onClose() {
  emit('close')
}
</script>
