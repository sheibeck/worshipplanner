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
        v-if="open && attachment"
        class="fixed inset-0 z-40 bg-black/60"
        @click="onClose"
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
        v-if="open && attachment"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="onClose"
      >
        <div
          ref="dialogRootRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          class="w-full max-w-3xl h-[85vh] bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col"
          data-testid="song-file-preview-modal"
          @keydown="onKeydown"
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-gray-800 flex items-center">
            <p :id="titleId" class="text-sm font-medium text-gray-100 truncate flex-1" :title="attachment.name">
              {{ attachment.name }}
            </p>
            <div class="flex items-center gap-1 shrink-0">
              <a
                :href="attachment.downloadUrl"
                download
                :aria-label="`Download ${attachment.name}`"
                data-testid="song-file-preview-download"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </a>
              <button
                ref="closeButtonRef"
                type="button"
                aria-label="Close preview"
                data-testid="song-file-preview-close"
                class="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
                @click="onClose"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 relative">
            <div
              v-if="loading && !errored"
              class="absolute inset-0 flex items-center justify-center"
              data-testid="song-file-preview-loading"
            >
              <svg
                class="h-6 w-6 animate-spin text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>

            <iframe
              v-if="!errored"
              :src="attachment.downloadUrl"
              class="w-full h-full border-0"
              data-testid="song-file-preview-iframe"
              @load="onLoad"
              @error="onError"
            ></iframe>

            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3" data-testid="song-file-preview-error">
              <p class="text-sm text-gray-400" data-testid="song-file-preview-error-text">Couldn't preview this file.</p>
              <a
                :href="attachment.downloadUrl"
                download
                class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                data-testid="song-file-preview-error-download"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// See src/components/admin/CleanupEnableConfirmDialog.vue — this reuses that dialog shell
// (backdrop, role="dialog" aria-modal, DOM-scoped @keydown) for a transient PDF viewer. Unlike
// SongSlideOver's deliberately non-dismissing editing panel, this overlay DOES dismiss on
// Escape/backdrop/Close — the Escape handler is bound on the dialog root element (not window),
// so it can never bubble up and close the editing slideout underneath (T-124-06).
import { nextTick, ref, useId, watch } from 'vue'
import type { SongAttachment } from '@/types/song'

const props = defineProps<{
  open: boolean
  attachment: SongAttachment | null
}>()

const emit = defineEmits<{
  close: []
}>()

const titleId = `song-file-preview-title-${useId()}`

const dialogRootRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

const loading = ref(true)
const errored = ref(false)

const previouslyFocusedElement = ref<HTMLElement | null>(null)

// Reset the iframe's load/error state whenever the modal opens or the target
// attachment changes (e.g. Preview clicked on a different row while open).
watch(
  [() => props.open, () => props.attachment],
  ([isOpen]) => {
    if (isOpen) {
      loading.value = true
      errored.value = false
    }
  },
)

// Focus-on-open lands on Close (mirrors CleanupEnableConfirmDialog's Cancel-first
// default); focus is restored to whatever had it before the modal opened.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      previouslyFocusedElement.value = document.activeElement as HTMLElement | null
      void nextTick(() => {
        closeButtonRef.value?.focus()
      })
    } else {
      previouslyFocusedElement.value?.focus()
      previouslyFocusedElement.value = null
    }
  },
)

function onClose(): void {
  emit('close')
}

function onLoad(): void {
  loading.value = false
}

function onError(): void {
  loading.value = false
  errored.value = true
}

// DOM-scoped Escape handler (bound on the dialog root via @keydown in the
// template) — never a window/document listener, so it cannot bubble to or
// affect SongSlideOver's non-dismissing editing slideout (T-124-06).
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onClose()
  }
}
</script>
