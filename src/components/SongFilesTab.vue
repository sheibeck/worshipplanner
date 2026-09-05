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

    <!-- Per-file upload progress rows (R363) -->
    <div v-if="uploads.length > 0" class="space-y-2" data-testid="song-files-upload-rows">
      <div v-for="row in uploads" :key="row.id" class="px-3 py-2 rounded-md bg-gray-800/60 border border-gray-800">
        <template v-if="row.status === 'uploading' || row.status === 'done'">
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
            <span class="text-xs text-red-400">{{ row.message }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Functional attachment list — simple rows, no preview/play/download/remove (Phase 124). -->
    <div v-if="attachments.length > 0" class="space-y-2" data-testid="song-files-attachment-list">
      <template v-for="a in attachments" :key="a.id">
        <a
          v-if="a.kind === 'link'"
          :href="a.href"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 px-3 py-3 rounded-md bg-gray-800/60 border border-gray-800 hover:bg-gray-800"
          :data-testid="`song-file-row-${a.id}`"
        >
          <span class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
        <div
          v-else
          class="flex items-center gap-3 px-3 py-3 rounded-md bg-gray-800/60 border border-gray-800"
          :data-testid="`song-file-row-${a.id}`"
        >
          <svg
            v-if="a.kind === 'document'"
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-gray-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-gray-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
          <div class="min-w-0">
            <p class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</p>
            <p class="text-xs text-gray-500">{{ metaLine(a) }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSongFileUpload } from '@/composables/useSongFileUpload'
import { useSongStore } from '@/stores/songs'
import { isValidExternalLink, buildLinkAttachment } from '@/utils/songLinks'
import type { SongAttachment } from '@/types/song'

const props = defineProps<{
  songId: string
  orgId: string
  createdBy: string
  attachments: SongAttachment[]
}>()

const songStore = useSongStore()
const { uploads, addFiles } = useSongFileUpload()

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

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Meta line built only from fields this phase actually persists — type +
 * size. Pages/duration are deferred (SongAttachment carries neither field). */
function metaLine(a: SongAttachment): string {
  const typeLabel = a.kind === 'document' || a.kind === 'audio' ? TYPE_LABELS[a.kind] : ''
  const size = formatSize(a.sizeBytes)
  return [typeLabel, size].filter(Boolean).join(' · ')
}
</script>
