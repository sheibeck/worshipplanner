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
        @click="onCancel"
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
            {{ isCreateMode ? 'New Team' : 'Edit Team' }}
          </h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
              @click="onCancel"
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
              @click="onCancel"
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
            <label class="block text-xs font-medium text-gray-400 mb-1">Name</label>
            <input
              v-model="form.name"
              type="text"
              data-testid="team-name-input"
              placeholder="Team name"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          <!-- See ADR-0083 (docs/adr/0083-renaming-orphans-the-name-keyed-reference-on-every-service-t.md) -->
          <div v-if="pendingRenameConfirm" class="rounded-md bg-amber-900/20 border border-amber-800 p-3">
            <p class="text-sm text-amber-300">
              Rename the '{{ props.team!.name }}' team to '{{ form.name.trim() }}'? Any service that already
              selected '{{ props.team!.name }}' will no longer show it as checked. This cannot be undone.
            </p>
            <div class="flex items-center gap-3 mt-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-amber-700 hover:bg-amber-600 transition-colors"
                @click="onSave"
              >
                Rename anyway
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                @click="pendingRenameConfirm = false"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Recurring schedule (absorbed from TeamRecurrenceSlideOver, R254) -->
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

          <!-- Delete button (edit mode only) -->
          <div v-if="!isCreateMode" class="pt-2 border-t border-gray-800">
            <div v-if="!showDeleteConfirm">
              <button
                type="button"
                class="text-sm text-red-400 hover:text-red-300 transition-colors"
                @click="showDeleteConfirm = true"
              >
                Delete Team
              </button>
            </div>
            <div v-else class="rounded-md bg-red-900/20 border border-red-800 p-3">
              <p class="text-sm text-red-300">
                Delete the '{{ props.team!.name }}' team? It will no longer appear as a choice for new or edited services, but any service that already selected it keeps that reference. This cannot be undone.
              </p>
              <div class="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                  :disabled="isDeleting"
                  @click="onDelete"
                >
                  {{ isDeleting ? 'Deleting...' : 'Delete Team' }}
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  @click="showDeleteConfirm = false"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTeamsStore } from '@/stores/teams'
import { useToasts } from '@/stores/toasts'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import type { Team } from '@/types/team'

const props = defineProps<{
  open: boolean
  team: Team | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const teamsStore = useTeamsStore()
const toasts = useToasts()

const ordinalOptions: Array<{ value: number; label: string }> = [
  { value: 1, label: '1st Sunday' },
  { value: 2, label: '2nd Sunday' },
  { value: 3, label: '3rd Sunday' },
  { value: 4, label: '4th Sunday' },
  { value: 5, label: '5th Sunday' },
]

interface FormState {
  name: string
}

function emptyForm(): FormState {
  return { name: '' }
}

function teamToForm(team: Team): FormState {
  return { name: team.name }
}

const form = ref<FormState>(emptyForm())
const localOrdinals = ref<number[]>([])
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)
const pendingRenameConfirm = ref(false)

// IN-01 (Phase 88 review): unsaved-changes guard, mirroring SongSlideOver.vue
// — prompts before a dirty form is discarded via Cancel/backdrop/×. Snapshot
// covers both the name field and the recurrence ordinals.
const unsavedGuard = useUnsavedGuard(() => ({ form: form.value, ordinals: localOrdinals.value }))

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.value = props.team ? teamToForm(props.team) : emptyForm()
      // See ADR-0084 (docs/adr/0084-dedupe-on-read-see-teamrecurrenceslideover-vue-a-duplicate.md)
      localOrdinals.value = Array.from(new Set(props.team?.recurrence?.ordinals ?? [])).sort((a, b) => a - b)
      showDeleteConfirm.value = false
      pendingRenameConfirm.value = false
      unsavedGuard.capture()
    }
  },
)

// A recurrence-only edit (name unchanged) must never trigger the rename
// soft-warn — reset it whenever the name is edited back to the original.
watch(
  () => form.value.name,
  (name) => {
    if (props.team && name.trim() === props.team.name) {
      pendingRenameConfirm.value = false
    }
  },
)

const isCreateMode = computed(() => props.team === null)

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

// See ADR-0085 (docs/adr/0085-teams-are-consumed-by-name-everywhere-a-service-selects-them.md)
function isDuplicateName(name: string, excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase()
  return teamsStore.teams.some((t) => t.id !== excludeId && t.name.trim().toLowerCase() === normalized)
}

async function onSave() {
  if (isSaving.value) return
  const name = form.value.name.trim()
  if (!name) return

  // See ADR-0085 (docs/adr/0085-teams-are-consumed-by-name-everywhere-a-service-selects-them.md)
  if (isDuplicateName(name, props.team?.id)) {
    toasts.push(`A team named "${name}" already exists. Choose a different name.`)
    return
  }

  // See ADR-0083 (docs/adr/0083-renaming-orphans-the-name-keyed-reference-on-every-service-t.md)
  if (!isCreateMode.value) {
    const isRename = name !== props.team!.name
    if (isRename && !pendingRenameConfirm.value) {
      pendingRenameConfirm.value = true
      return
    }
  }
  pendingRenameConfirm.value = false

  // See ADR-0084 (docs/adr/0084-dedupe-on-read-see-teamrecurrenceslideover-vue-a-duplicate.md)
  const ordinals = Array.from(new Set(localOrdinals.value)).sort((a, b) => a - b)

  isSaving.value = true
  try {
    if (isCreateMode.value) {
      const maxOrder = teamsStore.teams.reduce((max, t) => Math.max(max, t.order), -1)
      await teamsStore.addTeam({
        name,
        order: maxOrder + 1,
        ...(ordinals.length ? { recurrence: { ordinals } } : {}),
      })
    } else {
      await teamsStore.updateTeam(props.team!.id, {
        name,
        recurrence: { ordinals },
      })
    }
    emit('saved')
  } finally {
    isSaving.value = false
  }
}

function onCancel() {
  if (!unsavedGuard.confirmDiscard()) return
  emit('close')
}

async function onDelete() {
  if (!props.team) return
  isDeleting.value = true
  try {
    await teamsStore.deleteTeam(props.team.id)
    emit('deleted')
  } finally {
    isDeleting.value = false
  }
}
</script>
