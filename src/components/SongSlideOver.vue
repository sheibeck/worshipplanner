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
            {{ isCreateMode ? 'New Song' : 'Edit Song' }}
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
              class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
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

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          <!-- Title -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">
              Title <span class="text-red-400">*</span>
            </label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Song title"
              class="w-full rounded-md bg-gray-800 border text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              :class="titleError ? 'border-red-500' : 'border-gray-700'"
            />
            <p v-if="titleError" class="mt-1 text-xs text-red-400">Title is required.</p>
          </div>

          <!-- CCLI Number + Author row -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">CCLI Number</label>
              <input
                v-model="form.ccliNumber"
                type="text"
                placeholder="e.g. 7047788"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Author</label>
              <input
                v-model="form.author"
                type="text"
                placeholder="e.g. Hillsong"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <!-- VW Type -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">VW Category</label>
            <div class="flex gap-2">
              <button
                v-for="t in ([1, 2, 3] as const)"
                :key="t"
                type="button"
                class="flex-1 py-2 rounded-md text-sm font-semibold border transition-colors"
                :class="vwTypeClasses(t)"
                @click="toggleVwType(t)"
              >
                {{ vwTypeLabels[t] }}
              </button>
            </div>
          </div>

          <!-- Themes -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">
              Themes <span class="text-gray-600 font-normal">(comma-separated)</span>
            </label>
            <input
              v-model="themesInput"
              type="text"
              placeholder="e.g. worship, praise, Easter"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">Notes</label>
            <textarea
              v-model="form.notes"
              rows="3"
              placeholder="Song notes..."
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            ></textarea>
          </div>

          <!-- Song-level Tags -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">Tags</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in songLevelTags"
                :key="tag"
                type="button"
                class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                :class="form.teamTags.includes(tag)
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'"
                @click="toggleSongTag(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>

          <!-- Delete button (edit mode only) -->
          <div v-if="!isCreateMode" class="pt-2 border-t border-gray-800">
            <div v-if="!showDeleteConfirm">
              <button
                type="button"
                class="text-sm text-red-400 hover:text-red-300 transition-colors"
                @click="showDeleteConfirm = true"
              >
                Delete Song
              </button>
            </div>
            <div v-else class="rounded-lg bg-red-900/20 border border-red-800 p-4">
              <p class="text-sm text-gray-200 mb-3">
                Are you sure you want to delete <strong class="text-white">"{{ form.title }}"</strong>?
                This cannot be undone.
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  @click="showDeleteConfirm = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                  :disabled="isDeleting"
                  @click="onDelete"
                >
                  {{ isDeleting ? 'Deleting...' : 'Delete' }}
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
import { useSongStore } from '@/stores/songs'
import type { Song, Arrangement, VWType } from '@/types/song'

const props = defineProps<{
  open: boolean
  song: Song | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const songStore = useSongStore()

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  title: string
  ccliNumber: string
  author: string
  vwType: VWType | null
  themes: string[]
  notes: string
  teamTags: string[]
  arrangements: Arrangement[]
}

function emptyForm(): FormState {
  return {
    title: '',
    ccliNumber: '',
    author: '',
    vwType: null,
    themes: [],
    notes: '',
    teamTags: [],
    arrangements: [],
  }
}

function songToForm(song: Song): FormState {
  return {
    title: song.title,
    ccliNumber: song.ccliNumber,
    author: song.author,
    vwType: song.vwType,
    themes: [...song.themes],
    notes: song.notes,
    teamTags: [...song.teamTags],
    arrangements: song.arrangements.map((a) => ({
      ...a,
      teamTags: [...a.teamTags],
    })),
  }
}

const form = ref<FormState>(emptyForm())
const themesInput = ref('')
const titleError = ref(false)
const showDeleteConfirm = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)

// Keep themesInput in sync with form.themes when panel opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      if (props.song) {
        form.value = songToForm(props.song)
      } else {
        form.value = emptyForm()
      }
      themesInput.value = form.value.themes.join(', ')
      titleError.value = false
      showDeleteConfirm.value = false
    }
  },
)

const isCreateMode = computed(() => props.song === null)

// ── Available tags ─────────────────────────────────────────────────────────────

// Predefined song-level tags + any tags found in the store
const PREDEFINED_TAGS = ['Choir', 'Orchestra', 'Hymn']

const availableTags = computed(() => {
  const tags = new Set<string>(PREDEFINED_TAGS)
  songStore.songs.forEach((s) => {
    s.teamTags.forEach((t) => tags.add(t))
    s.arrangements.forEach((a) => a.teamTags.forEach((t) => tags.add(t)))
  })
  return Array.from(tags).sort()
})

// Song-level tags = predefined + any tags already on this song or in the store
const songLevelTags = computed(() => availableTags.value)

// ── VW Type ────────────────────────────────────────────────────────────────────

const vwTypeLabels: Record<1 | 2 | 3, string> = {
  1: '1 - Call to Worship',
  2: '2 - Intimate',
  3: '3 - Ascription',
}

// Static classes to prevent Tailwind purge
const vwTypeSelected: Record<1 | 2 | 3, string> = {
  1: 'bg-blue-700 border-blue-500 text-white',
  2: 'bg-purple-700 border-purple-500 text-white',
  3: 'bg-amber-700 border-amber-500 text-white',
}

const vwTypeUnselected: Record<1 | 2 | 3, string> = {
  1: 'bg-gray-800 border-gray-700 text-blue-400 hover:bg-blue-900/30 hover:border-blue-700',
  2: 'bg-gray-800 border-gray-700 text-purple-400 hover:bg-purple-900/30 hover:border-purple-700',
  3: 'bg-gray-800 border-gray-700 text-amber-400 hover:bg-amber-900/30 hover:border-amber-700',
}

function vwTypeClasses(type: 1 | 2 | 3): string {
  return form.value.vwType === type ? vwTypeSelected[type] : vwTypeUnselected[type]
}

function toggleVwType(type: VWType) {
  form.value.vwType = form.value.vwType === type ? null : type
}

// ── Song-level team tags ───────────────────────────────────────────────────────

function toggleSongTag(tag: string) {
  const idx = form.value.teamTags.indexOf(tag)
  if (idx >= 0) {
    form.value.teamTags.splice(idx, 1)
  } else {
    form.value.teamTags.push(tag)
  }
}

// ── Save / Cancel / Delete ────────────────────────────────────────────────────

async function onSave() {
  const title = form.value.title.trim()
  if (!title) {
    titleError.value = true
    return
  }
  titleError.value = false

  // Parse themes from comma-separated input
  const themes = themesInput.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  // Song-level teamTags = union of arrangement teamTags + explicitly toggled song tags
  const arrTags = new Set<string>()
  form.value.arrangements.forEach((a) => a.teamTags.forEach((t) => arrTags.add(t)))
  const allTags = Array.from(new Set([...form.value.teamTags, ...arrTags]))

  const data = {
    title,
    ccliNumber: form.value.ccliNumber.trim(),
    author: form.value.author.trim(),
    vwType: form.value.vwType,
    themes,
    notes: form.value.notes.trim(),
    teamTags: allTags,
    arrangements: form.value.arrangements,
    lastUsedAt: props.song?.lastUsedAt ?? null,
  }

  isSaving.value = true
  try {
    if (isCreateMode.value) {
      await songStore.addSong(data)
    } else {
      await songStore.updateSong(props.song!.id, data)
    }
    emit('saved')
  } finally {
    isSaving.value = false
  }
}

function onCancel() {
  emit('close')
}

async function onDelete() {
  if (!props.song) return
  isDeleting.value = true
  try {
    await songStore.deleteSong(props.song.id)
    emit('deleted')
  } finally {
    isDeleting.value = false
  }
}
</script>
