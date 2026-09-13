<template>
  <Teleport to="body">
    <!-- Backdrop (non-dismissing, mirrors SongSlideOver — closes only via Close/X) -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 bg-black/30"></div>
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
          <div class="min-w-0">
            <p v-if="!isCreateMode" class="text-[11px] font-medium uppercase tracking-wide text-gray-500">Edit Vamp</p>
            <h2 class="truncate text-base font-semibold text-gray-100">
              {{ isCreateMode ? 'New Vamp' : `${form.name.trim() || 'Untitled vamp'} · ${form.key}` }}
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
              @click="onClose"
            >
              Close
            </button>
            <button
              type="button"
              data-testid="vamp-save-button"
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

        <!-- Body: a single flat form — no in-drawer tab bar (a vamp has one form, not
             details/lyrics/files like a Song). -->
        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          <!-- Name -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">
              Name <span class="text-red-400">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              data-testid="vamp-name-input"
              placeholder="e.g. Open Response"
              class="w-full rounded-md bg-gray-800 border text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              :class="nameError ? 'border-red-500' : 'border-gray-700'"
            />
            <p v-if="nameError" class="mt-1 text-xs text-red-400">Name is required.</p>
          </div>

          <!-- Key: a closed 12-chip picker (VAMP_KEYS), not a free-typed field —
               "one name, one key, one MP3" (140-DESIGN-NOTES). -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">Key</label>
            <div class="flex flex-wrap gap-2" data-testid="vamp-key-chips">
              <button
                v-for="k in VAMP_KEYS"
                :key="k"
                type="button"
                :data-testid="`vamp-key-chip-${k}`"
                class="px-3 py-1.5 rounded-md text-sm font-mono border transition-colors"
                :class="form.key === k
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'"
                @click="form.key = k"
              >
                {{ k }}
              </button>
            </div>
          </div>

          <!-- Tempo (optional, freeform, narrow per design) -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-1">
              Tempo <span class="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              v-model="form.tempo"
              type="text"
              data-testid="vamp-tempo-input"
              placeholder="e.g. 68 bpm"
              class="w-[132px] rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <!-- MP3: exactly one attachment slot. Narrowed mirror of
               SongFilesTab.vue's audio row/dropzone mechanics. -->
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">MP3</label>

            <p v-if="isCreateMode" class="text-xs text-gray-500" data-testid="vamp-mp3-save-first">
              Save this vamp to attach an MP3.
            </p>

            <template v-else>
              <!-- Empty: dashed drop-zone -->
              <template v-if="!liveAttachment">
                <button
                  type="button"
                  data-testid="vamp-mp3-dropzone"
                  class="w-full border-2 border-dashed rounded-lg px-6 py-8 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="dragOver ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700 bg-gray-800/40'"
                  :disabled="isUploading"
                  @click="openFilePicker"
                  @dragover.prevent="dragOver = true"
                  @dragleave.prevent="dragOver = false"
                  @drop.prevent="onDrop"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-8 w-8" :class="dragOver ? 'text-indigo-400' : 'text-gray-500'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p class="mt-2 text-sm font-medium" :class="dragOver ? 'text-indigo-400' : 'text-gray-200'">
                    Drop an MP3, or click to browse
                  </p>
                </button>
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="audio/mpeg,.mp3"
                  class="hidden"
                  data-testid="vamp-mp3-input"
                  @change="onFileInputChange"
                />
              </template>

              <!-- Present: play/pause + filename + meta + remove -->
              <div v-else class="px-3 py-3 rounded-md bg-gray-800/60 border border-gray-800">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="vamp-mp3-play"
                    :aria-label="playing ? 'Pause' : 'Play'"
                    class="p-1 rounded hover:bg-gray-700"
                    :class="playing ? 'text-indigo-400' : 'text-gray-400'"
                    @click="togglePlay"
                  >
                    <svg v-if="!playing" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                  </button>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-gray-100 truncate" :title="liveAttachment.fileName">{{ liveAttachment.fileName }}</p>
                    <p class="text-xs text-gray-500">{{ metaLine(liveAttachment) }}</p>
                  </div>
                  <button
                    type="button"
                    data-testid="vamp-mp3-remove"
                    :aria-label="`Remove ${liveAttachment.fileName}`"
                    class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 shrink-0"
                    @click="removeAttachment"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
                <audio
                  v-if="playing"
                  controls
                  :src="liveAttachment.downloadUrl"
                  class="mt-2 w-full"
                  data-testid="vamp-mp3-audio-player"
                  @error="onAudioError"
                ></audio>
                <p v-if="playing && audioErrored" class="text-xs text-red-400 mt-1" data-testid="vamp-mp3-audio-error">
                  Couldn't play this file.
                </p>
              </div>

              <!-- CR-01: upload progress/error/rejection feedback — mirrors
                   SongFilesTab.vue's uploads rows + aria-live announcement,
                   the half of useVampFileUpload's return value this drawer
                   previously never rendered. Rendered regardless of which
                   branch above is active (an upload can be in flight before
                   liveAttachment exists, or a replace while it already does). -->
              <p class="sr-only" role="status" aria-live="polite" data-testid="vamp-mp3-upload-status">
                {{ announcement }}
              </p>
              <div v-if="uploads.length > 0" class="mt-2 space-y-2" data-testid="vamp-mp3-upload-rows">
                <div
                  v-for="row in uploads"
                  :key="row.id"
                  class="px-3 py-2 rounded-md bg-gray-800/60 border border-gray-800"
                >
                  <p class="text-sm text-gray-200 truncate" :title="row.name">{{ row.name }}</p>
                  <div v-if="row.status === 'uploading'" class="mt-1 h-1.5 rounded-full bg-gray-800">
                    <div class="h-1.5 rounded-full bg-indigo-500" :style="{ width: row.progress + '%' }"></div>
                  </div>
                  <div v-else class="flex items-center gap-2 mt-1">
                    <span class="flex-1 text-xs text-red-400" data-testid="vamp-mp3-upload-error">{{ row.message }}</span>
                    <button
                      type="button"
                      :aria-label="`Dismiss ${row.name}`"
                      data-testid="vamp-mp3-upload-dismiss"
                      class="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 shrink-0"
                      @click="dismiss(row.id)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Delete vamp: single-step inline-confirm (no soft-delete/restore). -->
          <div v-if="!isCreateMode" class="pt-2 border-t border-gray-800">
            <div v-if="!showDeleteConfirm">
              <button
                type="button"
                data-testid="vamp-delete-button"
                class="text-sm text-red-400 hover:text-red-300 transition-colors"
                @click="showDeleteConfirm = true"
              >
                Delete vamp
              </button>
            </div>
            <div v-else class="rounded-lg bg-red-900/20 border border-red-800 p-4" data-testid="vamp-delete-confirm">
              <p class="text-sm text-gray-200 mb-3">
                Delete <strong class="text-white">"{{ form.name }}"</strong>? This cannot be undone.
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  data-testid="vamp-delete-cancel"
                  class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  @click="showDeleteConfirm = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="vamp-delete-confirm-button"
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
import { useVampStore } from '@/stores/vamps'
import { useVampFileUpload } from '@/composables/useVampFileUpload'
import { useAuthStore } from '@/stores/auth'
import { VAMP_KEYS } from '@/constants/keys'
import type { Vamp, VampAttachment } from '@/types/vamp'

/** R435/R436 — Vamp slide-out editor. Narrowed mirror of SongSlideOver.vue:
 * no in-drawer tab bar (a vamp is one flat form), a closed VAMP_KEYS chip
 * picker (not the MAJOR_KEYS datalist), a single-slot MP3 attach/play/remove
 * (mirroring SongFilesTab.vue's audio row), and a single-step Delete (no
 * soft-delete/restore) — see 140-PATTERNS.md. */

const props = defineProps<{
  open: boolean
  vamp: Vamp | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const vampStore = useVampStore()
const authStore = useAuthStore()
const { addFile, uploads, announcement, dismiss, reset } = useVampFileUpload()

interface FormState {
  name: string
  key: string
  tempo: string
}

function emptyForm(): FormState {
  return { name: '', key: VAMP_KEYS[0], tempo: '' }
}

function vampToForm(vamp: Vamp): FormState {
  return { name: vamp.name, key: vamp.key, tempo: vamp.tempo ?? '' }
}

const form = ref<FormState>(emptyForm())
const nameError = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteConfirm = ref(false)

// Set once addVamp resolves for a brand-new vamp — the create->edit
// transition the drawer needs so the MP3 drop-zone becomes usable for the
// just-created vamp. Cleared whenever the drawer reopens.
const localId = ref<string | null>(null)

const effectiveId = computed(() => props.vamp?.id ?? localId.value)
const isCreateMode = computed(() => effectiveId.value === null)

// Live attachment: prefer the store's subscribed copy (so a completed
// upload shows up without reopening the drawer), falling back to the vamp
// prop for a harness with no live subscription.
const liveVamp = computed<Vamp | null>(() => {
  const id = effectiveId.value
  if (!id) return null
  return vampStore.vamps.find((v) => v.id === id) ?? props.vamp ?? null
})
const liveAttachment = computed<VampAttachment | null | undefined>(() => liveVamp.value?.attachment)

// Declared before the watch below (which runs immediately at setup and
// resets both on open) so it isn't referenced before initialization.
const playing = ref(false)
const audioErrored = ref(false)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    form.value = props.vamp ? vampToForm(props.vamp) : emptyForm()
    nameError.value = false
    showDeleteConfirm.value = false
    localId.value = null
    playing.value = false
    audioErrored.value = false
    // CR-01: a lingering upload row/error from a previously-open vamp must
    // not bleed into this one — the composable instance is scoped to this
    // component instance, not per-vamp.
    reset()
  },
  { immediate: true },
)

async function onSave() {
  const name = form.value.name.trim()
  if (!name) {
    nameError.value = true
    return
  }
  nameError.value = false
  const data = { name, key: form.value.key, tempo: form.value.tempo.trim() || undefined }

  isSaving.value = true
  try {
    if (isCreateMode.value) {
      const id = await vampStore.addVamp({ ...data, attachment: null })
      if (id) localId.value = id
      // No 'saved' emit here — the parent's Songs-slide-over-style wiring
      // closes the drawer on 'saved', but a new vamp must STAY OPEN so its
      // MP3 can be attached (140-03 must_haves).
    } else {
      await vampStore.updateVamp(effectiveId.value!, data)
      emit('saved')
    }
  } finally {
    isSaving.value = false
  }
}

function onClose() {
  emit('close')
}

async function onDelete() {
  const id = effectiveId.value
  if (!id) return
  isDeleting.value = true
  try {
    await vampStore.deleteVamp(id)
    emit('deleted')
  } finally {
    isDeleting.value = false
  }
}

// ── MP3 attach/play/remove ──────────────────────────────────────────────────

const fileInputRef = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

// CR-01: a vamp has exactly one MP3 slot, so any 'uploading' row belongs to
// this vamp — block a second concurrent upload from starting and racing the
// first on updateVamp (last-write-wins).
const isUploading = computed(() => uploads.value.some((r) => r.status === 'uploading'))

function openFilePicker() {
  if (isUploading.value) return
  fileInputRef.value?.click()
}

function attach(file: File) {
  const id = effectiveId.value
  if (!id) return
  addFile(file, {
    vampId: id,
    orgId: authStore.orgId ?? '',
    createdBy: authStore.user?.uid ?? '',
  })
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (isUploading.value) return
  const file = e.dataTransfer?.files?.[0]
  if (file) attach(file)
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) attach(file)
  input.value = ''
}

async function removeAttachment() {
  const id = effectiveId.value
  if (!id) return
  await vampStore.updateVamp(id, { attachment: null })
}

function togglePlay() {
  if (playing.value) {
    playing.value = false
    return
  }
  playing.value = true
  audioErrored.value = false
}

function onAudioError() {
  audioErrored.value = true
}

function formatSize(bytes?: number): string {
  if (bytes == null) return ''
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatAttachmentDate(createdAt: VampAttachment['createdAt'] | undefined): string {
  if (!createdAt || typeof (createdAt as { toDate?: unknown }).toDate !== 'function') return ''
  return (createdAt as { toDate: () => Date })
    .toDate()
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// "MP3 · {size} · {date}" — omits the audio-duration "length" (140-01
// captures durationSec best-effort; this UI does not depend on it).
function metaLine(a: VampAttachment): string {
  const size = formatSize(a.sizeBytes)
  const date = formatAttachmentDate(a.createdAt)
  return ['MP3', size, date].filter(Boolean).join(' · ')
}
</script>
