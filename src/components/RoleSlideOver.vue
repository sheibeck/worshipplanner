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
            {{ isCreateMode ? 'New Role' : 'Edit Role' }}
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
              data-testid="role-name-input"
              placeholder="Role name"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">Group</label>
            <select
              v-model="form.group"
              data-testid="role-group-select"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="band">Band</option>
              <option value="tech">Tech</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">
              Default count
              <span class="text-gray-600 font-normal">(volunteers the scheduler auto-fills each service)</span>
            </label>
            <input
              v-model.number="form.defaultCount"
              type="number"
              min="1"
              data-testid="role-count-input"
              class="w-24 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div v-if="form.group === 'band'">
            <label class="flex items-center gap-1.5 text-sm text-gray-300">
              <input
                v-model="form.vocal"
                type="checkbox"
                data-testid="role-vocal-checkbox"
                class="rounded bg-gray-800 border-gray-700 text-indigo-600 focus:ring-indigo-500"
              />
              Vocal role (can sing &amp; play)
            </label>
          </div>

          <!-- Delete button (edit mode only) -->
          <div v-if="!isCreateMode" class="pt-2 border-t border-gray-800">
            <div v-if="!showDeleteConfirm">
              <button
                type="button"
                class="text-sm text-red-400 hover:text-red-300 transition-colors"
                @click="showDeleteConfirm = true"
              >
                Delete Role
              </button>
            </div>
            <div v-else class="rounded-md bg-red-900/20 border border-red-800 p-3">
              <p class="text-sm text-red-300">
                Delete the '{{ props.role!.name }}' role? Existing assignments to this role across all quarters will be cleared. This cannot be undone.
              </p>
              <div class="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                  :disabled="isDeleting"
                  @click="onDelete"
                >
                  {{ isDeleting ? 'Deleting...' : 'Delete Role' }}
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
import { useRosterStore } from '@/stores/roster'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import type { Role, RoleGroup } from '@/types/roster'

const props = defineProps<{
  open: boolean
  role: Role | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const rosterStore = useRosterStore()

interface FormState {
  name: string
  group: RoleGroup
  defaultCount: number
  vocal: boolean
}

function emptyForm(): FormState {
  return { name: '', group: 'band', defaultCount: 1, vocal: false }
}

function roleToForm(role: Role): FormState {
  return {
    name: role.name,
    group: role.group,
    defaultCount: role.defaultCount,
    vocal: role.vocal ?? false,
  }
}

const form = ref<FormState>(emptyForm())
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)

// IN-01 (Phase 88 review): unsaved-changes guard, mirroring SongSlideOver.vue
// — prompts before a dirty form is discarded via Cancel/backdrop/×.
const unsavedGuard = useUnsavedGuard(() => ({ ...form.value }))

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.value = props.role ? roleToForm(props.role) : emptyForm()
      showDeleteConfirm.value = false
      unsavedGuard.capture()
    }
  },
)

const isCreateMode = computed(() => props.role === null)

// WR-01 (Phase 88 review): the pre-Phase-88 inline "Add Role" flow guarded its
// payload with `defaultCount: newRoleCount.value || 1`. Save here is a plain
// button (not a native form submit), so the input's `min="1"` never runs HTML5
// constraint validation — clearing the field leaves `form.value.defaultCount`
// as an empty string (v-model.number's looseToNumber falls back to the raw
// string when parseFloat is NaN), which would otherwise write straight to
// Firestore and corrupt scheduler auto-fill math. Coerce to a valid positive
// number, floored to 1 when empty/NaN/less than 1.
function normalizedDefaultCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

async function onSave() {
  if (isSaving.value) return
  const name = form.value.name.trim()
  if (!name) return

  isSaving.value = true
  try {
    if (isCreateMode.value) {
      const maxOrder = rosterStore.roles.reduce((max, r) => Math.max(max, r.order), -1)
      await rosterStore.addRole({
        name,
        group: form.value.group,
        defaultCount: normalizedDefaultCount(form.value.defaultCount),
        order: maxOrder + 1,
        ...(form.value.group === 'band' && form.value.vocal ? { vocal: true } : {}),
      })
    } else {
      await rosterStore.updateRole(props.role!.id, {
        name,
        group: form.value.group,
        defaultCount: normalizedDefaultCount(form.value.defaultCount),
        vocal: form.value.group === 'band' ? form.value.vocal : false,
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
  if (!props.role) return
  isDeleting.value = true
  try {
    await rosterStore.deleteRole(props.role.id)
    emit('deleted')
  } finally {
    isDeleting.value = false
  }
}
</script>
