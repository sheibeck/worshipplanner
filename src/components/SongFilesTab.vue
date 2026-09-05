<template>
  <div class="space-y-5">
    <!-- Drop zone (R363) — always visible, editors only reach this screen at
         all since /songs is requiresEditor (121-UI-SPEC §3/Access Control). -->
    <button
      type="button"
      data-testid="song-files-dropzone"
      class="w-full border-2 border-dashed rounded-lg px-6 py-8 text-center transition-colors"
      :class="dragOver ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700 bg-gray-800/40'"
      @click="openFilePicker"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="mx-auto h-8 w-8"
        :class="dragOver ? 'text-indigo-400' : 'text-gray-500'"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p class="mt-2 text-sm font-medium" :class="dragOver ? 'text-indigo-400' : 'text-gray-200'">
        Drop files here, or click to browse
      </p>
      <p class="mt-1 text-xs text-gray-500">PDF, MP3 · up to 50 MB each · several at once</p>
    </button>
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept=".pdf,audio/mpeg"
      class="hidden"
      data-testid="song-files-input"
      @change="onFileInputChange"
    />

    <!-- Link field (R365) -->
    <div>
      <label class="block text-xs font-medium text-gray-400 mb-1">Or link instead of uploading</label>
      <input
        v-model="linkInput"
        type="text"
        placeholder="Paste a YouTube, Google Drive, or Dropbox link"
        data-testid="song-files-link-input"
        class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        @keydown.enter.prevent="submitLink"
      />
      <p class="text-xs text-gray-500 mt-1">Opens in a new tab when clicked — not previewed in-app.</p>
      <p v-if="linkError" class="text-xs text-red-400 mt-1" data-testid="song-files-link-error">
        Enter a valid link (starting with https://).
      </p>
    </div>

    <!-- IN-01/121-UI-SPEC §5 A11y: non-visual batch-completion announcement,
         updated as each file finishes (not per progress tick). -->
    <p class="sr-only" role="status" aria-live="polite" data-testid="song-files-upload-status">
      {{ announcement }}
    </p>

    <!-- Per-file upload progress rows (R363) -->
    <div v-if="uploads.length > 0" class="space-y-2" data-testid="song-files-upload-rows">
      <div v-for="row in uploads" :key="row.id" class="px-3 py-2 rounded-md bg-gray-800/60 border border-gray-800">
        <template v-if="row.status === 'uploading'">
          <p class="text-xs text-gray-400 truncate" :title="row.name">{{ row.name }}</p>
          <div class="mt-1 h-1.5 rounded-full bg-gray-800">
            <div class="h-1.5 rounded-full bg-indigo-500" :style="{ width: row.progress + '%' }"></div>
          </div>
          <span class="text-xs text-gray-400">{{ Math.round(row.progress) }}%</span>
        </template>
        <template v-else>
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span class="flex-1 text-xs text-red-400">{{ row.message }}</span>
            <button
              type="button"
              :aria-label="`Dismiss ${row.name}`"
              data-testid="song-file-upload-dismiss"
              class="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 shrink-0"
              @click="dismiss(row.id)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Documents / Audio grouped rows (R366) — two ALWAYS-rendered groups per
         121-UI-SPEC §6/7. Documents folds in link-kind rows by default (§4:
         a generic link's type can't be inferred, so it defaults into
         Documents rather than a third "Links" sub-group). -->
    <div class="space-y-2" data-testid="song-files-group-documents">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-gray-500">Documents</h3>
      </div>
      <p v-if="documents.length === 0" class="text-xs text-gray-500 py-2" data-testid="song-files-documents-empty">
        No documents attached yet.
      </p>
      <div v-else class="space-y-2">
        <template v-for="a in documents" :key="a.id">
          <div
            class="flex items-center gap-3 px-3 py-3 rounded-md bg-gray-800/60 border border-gray-800"
            :data-testid="`song-file-row-${a.id}`"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</p>
              <p class="text-xs text-gray-500" data-testid="song-file-meta">{{ metaLine(a) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                v-if="a.kind === 'document'"
                type="button"
                :aria-label="`Preview ${a.name}`"
                data-testid="song-file-preview"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-indigo-300"
                @click="previewAttachment = a"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                v-if="a.kind !== 'link'"
                type="button"
                :aria-label="`Download ${a.name}`"
                data-testid="song-file-download"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                @click="downloadAttachment(a)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <a
                v-else
                :href="a.href"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`Open ${a.name} in a new tab`"
                data-testid="song-file-open-link"
                class="p-1 rounded hover:bg-gray-700 text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
              <button
                type="button"
                :aria-label="`Remove ${a.name}`"
                data-testid="song-file-remove"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                @click="openConfirm(a)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
          <div
            v-if="confirmingId === a.id"
            class="mt-2 rounded-lg bg-red-900/20 border border-red-800 p-3"
            data-testid="song-file-remove-confirm"
          >
            <p class="text-sm text-gray-200 mb-2">
              Remove <strong class="text-white">"{{ a.name }}"</strong>? This can't be undone.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                data-testid="song-file-remove-cancel"
                @click="cancelRemove"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                data-testid="song-file-remove-confirm-button"
                :disabled="removingId === a.id"
                @click="confirmRemove(a)"
              >
                {{ removingId === a.id ? 'Removing…' : 'Remove' }}
              </button>
            </div>
            <p
              v-if="removeError && removeError.id === a.id"
              class="text-xs text-red-400 mt-2"
              data-testid="song-file-remove-error"
            >
              {{ removeError.message }}
            </p>
          </div>
        </template>
      </div>
    </div>

    <SongFilePreviewModal
      :open="previewAttachment !== null"
      :attachment="previewAttachment"
      @close="previewAttachment = null"
    />

    <div class="space-y-2" data-testid="song-files-group-audio">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
        </svg>
        <h3 class="text-[11px] font-medium uppercase tracking-wide text-gray-500">Audio</h3>
      </div>
      <p v-if="audio.length === 0" class="text-xs text-gray-500 py-2" data-testid="song-files-audio-empty">
        No audio files attached yet.
      </p>
      <div v-else class="space-y-2">
        <template v-for="a in audio" :key="a.id">
          <div
            class="flex items-center gap-3 px-3 py-3 rounded-md bg-gray-800/60 border border-gray-800"
            :data-testid="`song-file-row-${a.id}`"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</p>
              <p class="text-xs text-gray-500" data-testid="song-file-meta">{{ metaLine(a) }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                :aria-label="`Play ${a.name}`"
                data-testid="song-file-play"
                class="p-1 rounded hover:bg-gray-700"
                :class="playingId === a.id ? 'text-indigo-400' : 'text-gray-400'"
                @click="togglePlay(a)"
              >
                <svg v-if="playingId !== a.id" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
              </button>
              <button
                type="button"
                :aria-label="`Download ${a.name}`"
                data-testid="song-file-download"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                @click="downloadAttachment(a)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <button
                type="button"
                :aria-label="`Remove ${a.name}`"
                data-testid="song-file-remove"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                @click="openConfirm(a)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
          <audio
            v-if="playingId === a.id"
            controls
            :src="a.downloadUrl"
            class="mt-2 w-full"
            data-testid="song-file-audio-player"
            @error="onAudioError"
          ></audio>
          <p
            v-if="playingId === a.id && audioErrored"
            class="text-xs text-red-400 mt-1"
            data-testid="song-file-audio-error"
          >
            Couldn't play this file.
            <button
              type="button"
              class="underline"
              data-testid="song-file-audio-error-download"
              @click="downloadAttachment(a)"
            >Download</button>
          </p>
          <div
            v-if="confirmingId === a.id"
            class="mt-2 rounded-lg bg-red-900/20 border border-red-800 p-3"
            data-testid="song-file-remove-confirm"
          >
            <p class="text-sm text-gray-200 mb-2">
              Remove <strong class="text-white">"{{ a.name }}"</strong>? This can't be undone.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                data-testid="song-file-remove-cancel"
                @click="cancelRemove"
              >
                Cancel
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                data-testid="song-file-remove-confirm-button"
                :disabled="removingId === a.id"
                @click="confirmRemove(a)"
              >
                {{ removingId === a.id ? 'Removing…' : 'Remove' }}
              </button>
            </div>
            <p
              v-if="removeError && removeError.id === a.id"
              class="text-xs text-red-400 mt-2"
              data-testid="song-file-remove-error"
            >
              {{ removeError.message }}
            </p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSongFileUpload } from '@/composables/useSongFileUpload'
import { useSongStore } from '@/stores/songs'
import { isValidExternalLink, buildLinkAttachment } from '@/utils/songLinks'
import SongFilePreviewModal from '@/components/SongFilePreviewModal.vue'
import type { SongAttachment } from '@/types/song'

const props = defineProps<{
  songId: string
  orgId: string
  createdBy: string
  attachments: SongAttachment[]
}>()

const songStore = useSongStore()
const { uploads, announcement, addFiles, dismiss } = useSongFileUpload()

const dragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const linkInput = ref('')
const linkError = ref(false)

const uploadCtx = computed(() => ({
  songId: props.songId,
  orgId: props.orgId,
  createdBy: props.createdBy,
}))

function openFilePicker() {
  fileInputRef.value?.click()
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files) {
    addFiles(e.dataTransfer.files, uploadCtx.value)
  }
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    addFiles(input.files, uploadCtx.value)
  }
  input.value = ''
}

// R368 — per-row Remove inline-confirm, reusing the Delete-Song pattern
// (SongSlideOver.vue:299-331). Only one row's confirm card is open at a
// time — clicking a different row's trash collapses the first.
const confirmingId = ref<string | null>(null)
const removingId = ref<string | null>(null)
// 124-REVIEW WR-03: the Firestore half of removeSongAttachment now throws on
// failure (songs.ts) instead of the rejection silently reaching nowhere —
// surface it inline near the confirm card so a failed Remove doesn't look
// identical to a successful one (Remove is framed as "can't be undone").
const removeError = ref<{ id: string; message: string } | null>(null)

function openConfirm(a: SongAttachment) {
  confirmingId.value = confirmingId.value === a.id ? null : a.id
  removeError.value = null
}

function cancelRemove() {
  confirmingId.value = null
  removeError.value = null
}

async function confirmRemove(a: SongAttachment) {
  removingId.value = a.id
  removeError.value = null
  try {
    // Do NOT mutate props.attachments — the row and the Files count
    // disappear live because SongSlideOver's liveAttachments/filesCount
    // recompute off songStore.songs once this write lands via onSnapshot.
    await songStore.removeSongAttachment(props.songId, a)
    confirmingId.value = null
  } catch (err) {
    console.error('confirmRemove: removeSongAttachment failed', err)
    // Keep the confirm card open (do NOT reset confirmingId) so the error
    // has somewhere to render and the user can retry without reopening it.
    removeError.value = { id: a.id, message: "Couldn't remove this file. Try again." }
  } finally {
    removingId.value = null
  }
}

// 124-REVIEW FIX A (user-reported bug): Firebase Storage download URLs are
// cross-origin, so a plain `<a :href download>`'s `download` attribute is
// IGNORED and, with no `target`, the browser navigates the whole SPA away to
// render/play the file inline instead of prompting a Save dialog. Fetching
// the bytes and pointing `download` at a same-origin blob: URL makes the
// attribute honored. A reliable cross-origin Save dialog still depends on
// the Storage bucket's CORS config allowing this app's origin — if fetch
// fails (CORS/network), fall back to opening in a new tab rather than ever
// navigating the SPA away.
async function downloadAttachment(a: SongAttachment) {
  try {
    const res = await fetch(a.downloadUrl!)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = a.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(a.downloadUrl, '_blank', 'noopener,noreferrer')
  }
}

// R367 — Preview (PDF modal). Setting a different attachment while the
// modal is already open just swaps which one it shows (the modal resets its
// own loading/error state on the attachment change).
const previewAttachment = ref<SongAttachment | null>(null)

// R367 — Play (inline MP3 player). Only one track's <audio> is ever mounted
// at a time; toggling a different row's Play collapses the previous one.
const playingId = ref<string | null>(null)
const audioErrored = ref(false)

function togglePlay(a: SongAttachment) {
  if (playingId.value === a.id) {
    playingId.value = null
    return
  }
  playingId.value = a.id
  audioErrored.value = false
}

function onAudioError() {
  audioErrored.value = true
}

function submitLink() {
  if (!isValidExternalLink(linkInput.value)) {
    linkError.value = true
    return
  }
  linkError.value = false
  const attachment = buildLinkAttachment({ href: linkInput.value.trim(), createdBy: props.createdBy })
  // CR-01: atomic arrayUnion append (not a read-modify-write of props.attachments)
  // so this can't clobber/be clobbered by an overlapping upload completion.
  void songStore.addSongAttachment(props.songId, attachment)
  linkInput.value = ''
}

const TYPE_LABELS: Record<'document' | 'audio', string> = {
  document: 'PDF',
  audio: 'MP3',
}

/** Full label already includes the trailing " link" word (e.g. "YouTube
 * link") so metaLine() doesn't have to special-case appending it — 'other'
 * degrades to a bare "Link" rather than the awkward "Link link". */
const LINK_SOURCE_LABELS: Record<NonNullable<SongAttachment['linkSource']>, string> = {
  youtube: 'YouTube link',
  drive: 'Google Drive link',
  dropbox: 'Dropbox link',
  other: 'Link',
}

function formatSize(bytes?: number): string {
  // IN-02: `bytes == null` (not a truthiness check) so a genuine 0-byte file
  // still renders "0.0 MB" instead of being treated as unknown size — `0` is
  // falsy but is a real, known size.
  if (bytes == null) return ''
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Guarded Timestamp → short date string, mirrors TeamView.vue's formatDate
 * convention (~L265-269): return '' — never "Invalid Date" — unless
 * createdAt has a callable toDate() (guards against the `{}` fixture and a
 * still-serializing serverTimestamp() sentinel). */
function formatAttachmentDate(createdAt: SongAttachment['createdAt'] | undefined): string {
  if (!createdAt || typeof (createdAt as { toDate?: unknown }).toDate !== 'function') return ''
  return (createdAt as { toDate: () => Date })
    .toDate()
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Metadata line, graceful-omission (R366): never renders undefined/NaN/
 * "Invalid Date", and never a pages/duration field — SongAttachment carries
 * neither (SEED-003 no-new-deps; no PDF page-count library). */
function metaLine(a: SongAttachment): string {
  const date = formatAttachmentDate(a.createdAt)
  if (a.kind === 'link') {
    const source = LINK_SOURCE_LABELS[a.linkSource ?? 'other']
    return [source, date].filter(Boolean).join(' · ')
  }
  // IN-03: the 'link' branch already returned above, so `a.kind` here is
  // narrowed to 'document' | 'audio' — no ternary/defensive `: ''` branch needed.
  const typeLabel = TYPE_LABELS[a.kind]
  const size = formatSize(a.sizeBytes)
  return [typeLabel, size, date].filter(Boolean).join(' · ')
}

// R366 — Documents group folds in link-kind rows by default (121-UI-SPEC §4:
// a generic link's type can't be inferred, so it lands in Documents rather
// than a third "Links" sub-group). Audio is exclusively kind==='audio'.
const documents = computed(() =>
  props.attachments.filter((a) => a.kind === 'document' || a.kind === 'link'),
)
const audio = computed(() => props.attachments.filter((a) => a.kind === 'audio'))
</script>
