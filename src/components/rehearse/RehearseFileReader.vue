<template>
  <div class="flex-1 min-w-0 flex flex-col bg-gray-950" data-testid="rehearse-reader">
    <template v-if="attachment">
      <!-- Desktop (R387): native <iframe> reader — the browser's own PDF
           viewer supplies zoom/page-nav, no custom paginator is built. -->
      <template v-if="!mobileLinkFirst">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
          <p class="text-sm font-medium text-gray-100 truncate flex-1" :title="attachment.name">
            {{ attachment.name }}
          </p>
          <button
            type="button"
            aria-label="Print"
            data-testid="rehearse-reader-print"
            class="flex items-center gap-1 p-1 rounded hover:bg-gray-700 text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
            @click="printAttachment"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4h14z" />
            </svg>
            <span class="text-sm">Print</span>
          </button>
        </div>

        <div class="flex-1 relative">
          <div
            v-if="loading && !errored"
            class="absolute inset-0 flex items-center justify-center"
            data-testid="rehearse-reader-loading"
          >
            <svg class="h-6 w-6 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            tabindex="-1"
            data-testid="rehearse-reader-iframe"
            @load="onLoad"
            @error="onError"
          ></iframe>

          <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3" data-testid="rehearse-reader-error">
            <p class="text-sm text-gray-400">Couldn't preview this file.</p>
            <button
              type="button"
              data-testid="rehearse-reader-error-download"
              class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              @click="downloadAttachment"
            >
              Download
            </button>
          </div>
        </div>
      </template>

      <!-- Mobile Screen C (R391, hard requirement) — link-first, NO iframe:
           mobile browsers frequently fail to render an embedded PDF
           reliably, so we hand off entirely to the OS PDF viewer / Save. -->
      <template v-else>
        <div class="p-4">
          <button
            type="button"
            aria-label="Back to song detail"
            data-testid="rehearse-reader-back"
            class="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
            @click="emit('back')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <p class="text-sm font-medium text-gray-100 truncate mb-4" :title="attachment.name">
            {{ attachment.name }}
          </p>
          <button
            type="button"
            data-testid="rehearse-reader-open"
            class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-md py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
            @click="openPdf"
          >
            Open PDF
          </button>
          <button
            type="button"
            data-testid="rehearse-reader-download"
            class="w-full border border-gray-700 text-gray-200 rounded-md py-3 text-sm font-medium mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
            @click="downloadAttachment"
          >
            Download
          </button>
        </div>
      </template>
    </template>

    <p
      v-else
      class="flex-1 flex items-center justify-center text-sm text-gray-500 text-center py-12"
      data-testid="rehearse-reader-empty"
    >
      Select a song's chart from the list to view it here.
    </p>
  </div>
</template>

<script setup lang="ts">
// Column 3 / mobile Screen C (R387, R391, 127-UI-SPEC.md §2/§3) — the inline
// PDF panel. Adapts SongFilePreviewModal.vue's loading/errored state machine
// (dropping the Teleport/Transition/backdrop/focus-trap dialog chrome — this
// is an always-visible inline panel, not a dismissible modal). NO pdf.js, NO
// custom paginator: the native iframe/OS viewer supplies its own page nav.
import { ref, watch } from 'vue'
import type { RehearseAttachment } from '@/utils/rehearseAccess'

const props = defineProps<{
  attachment?: RehearseAttachment
  mobileLinkFirst?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()

const loading = ref(true)
const errored = ref(false)

// Pitfall 3 (127-RESEARCH.md): reset on attachment CHANGE, not just on open
// — otherwise a stale error/loading state carries over across song
// selections. This panel has no `open` prop (always visible), so attachment
// identity alone drives the reset — same intent as SongFilePreviewModal's
// watch, adapted to this component's shape.
watch(
  () => props.attachment,
  () => {
    loading.value = true
    errored.value = false
  },
)

function onLoad(): void {
  loading.value = false
}

function onError(): void {
  loading.value = false
  errored.value = true
}

// Print (T-127-04) — NOT iframe.contentWindow.print(): Storage download URLs
// are cross-origin and that call throws. A new tab lets the browser's own
// PDF viewer supply printing, same pattern RehearseSongDetail.vue uses.
function printAttachment(): void {
  if (!props.attachment?.downloadUrl) return
  window.open(props.attachment.downloadUrl, '_blank', 'noopener,noreferrer')
}

// Mobile "Open PDF" (R391) — hands off to the phone's native PDF viewer.
function openPdf(): void {
  if (!props.attachment?.downloadUrl) return
  window.open(props.attachment.downloadUrl, '_blank', 'noopener,noreferrer')
}

// Download (R391 mobile + WR-01 desktop error fallback) — copied UNMODIFIED
// from SongFilesTab.vue (124-REVIEW FIX A: a plain <a download> on a
// cross-origin Storage URL silently ignores the `download` attribute and
// navigates the whole SPA away instead of prompting Save).
async function downloadAttachment(): Promise<void> {
  const a = props.attachment
  if (!a?.downloadUrl) return
  try {
    const res = await fetch(a.downloadUrl)
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
</script>
