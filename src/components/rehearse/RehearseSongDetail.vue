<template>
  <div class="w-full sm:w-[352px] shrink-0 sm:border-r border-gray-800 bg-gray-900 overflow-y-auto p-4">
    <template v-if="song">
      <h2 class="text-base font-semibold text-white truncate" :title="song.title">{{ song.title }}</h2>
      <p data-testid="rehearse-detail-meta" class="text-sm text-gray-400 mt-1">{{ metaLine }}</p>

      <!-- SHEET MUSIC & CHORDS — document attachments + external links (R386, R390) -->
      <div class="mt-4" data-testid="rehearse-detail-documents">
        <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">SHEET MUSIC & CHORDS</h3>
        <p v-if="documents.length === 0" class="text-xs text-gray-500 py-2">
          No sheet music attached for this song.
        </p>
        <div v-else class="space-y-2">
          <div
            v-for="a in documents"
            :key="a.id"
            class="flex items-center gap-3 px-3 py-2 rounded-md bg-gray-800/60 border border-gray-800"
          >
            <template v-if="a.kind === 'link'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              <a
                :href="a.href"
                target="_blank"
                rel="noopener noreferrer"
                :data-testid="`rehearse-detail-link-${a.id}`"
                class="min-w-0 flex-1 hover:text-indigo-300"
              >
                <p class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</p>
                <p class="text-xs text-gray-500">{{ linkSourceLabel(a) }}</p>
              </a>
            </template>
            <template v-else>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="emit('open-pdf', a)"
              >
                <p class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</p>
                <p class="text-xs text-gray-500">{{ metaFor(a) }}</p>
              </button>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  :aria-label="`Print ${a.name}`"
                  :data-testid="`rehearse-detail-print-${a.id}`"
                  class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                  @click="printAttachment(a)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4h14z" />
                  </svg>
                </button>
                <button
                  type="button"
                  :aria-label="`Download ${a.name}`"
                  :data-testid="`rehearse-detail-download-${a.id}`"
                  class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                  @click="downloadAttachment(a)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- RECORDINGS — audio attachments, Play emits (no inline <audio>; the
           bottom player owns playback, Plan 03) + Download (R386) -->
      <div class="mt-4" data-testid="rehearse-detail-audio">
        <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">RECORDINGS</h3>
        <p v-if="audio.length === 0" class="text-xs text-gray-500 py-2">
          No recordings attached for this song.
        </p>
        <div v-else class="space-y-2">
          <div
            v-for="a in audio"
            :key="a.id"
            class="flex items-center gap-3 px-3 py-2 rounded-md bg-gray-800/60 border border-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-100 truncate" :title="a.name">{{ a.name }}</p>
              <p class="text-xs text-gray-500">{{ metaFor(a) }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                :aria-label="`Play ${a.name}`"
                :data-testid="`rehearse-detail-play-${a.id}`"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                @click="emit('play', a)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
              </button>
              <button
                type="button"
                :aria-label="`Download ${a.name}`"
                :data-testid="`rehearse-detail-download-${a.id}`"
                class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                @click="downloadAttachment(a)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <p v-else class="text-sm text-gray-500 text-center py-12">
      Select a song's chart from the list to view it here.
    </p>
  </div>
</template>

<script setup lang="ts">
// Column 2 / mobile Screen B (R386, R390, 127-UI-SPEC.md §2) — song detail:
// Sheet music & chords (Print+Download) and Recordings (Play+Download).
// Pure presentational component: props in, `play`/`open-pdf` events out, no
// store reads, no Firestore, NO inline <audio> — playback is centralized in
// the Plan 03 bottom bar (127-PATTERNS.md anti-pattern note).
import { computed } from 'vue'
import type { RehearseSong, RehearseAttachment } from '@/utils/rehearseAccess'

const props = defineProps<{
  song?: RehearseSong
  /** Present only if the projection carries it — omitted from the header
   *  meta line entirely when absent, never invented (Data Dependencies). */
  ccliNumber?: string
}>()

const emit = defineEmits<{
  play: [attachment: RehearseAttachment]
  'open-pdf': [attachment: RehearseAttachment]
}>()

// Sheet Music group folds in link-kind rows (127-UI-SPEC §2 Column 2):
// a generic link's type can't be inferred, so it lands alongside documents
// rather than a third sub-group — same convention as SongFilesTab.vue.
const documents = computed(() => props.song?.attachments.filter((a) => a.kind === 'document' || a.kind === 'link') ?? [])
const audio = computed(() => props.song?.attachments.filter((a) => a.kind === 'audio') ?? [])

// TYPE_LABELS/LINK_SOURCE_LABELS — copied verbatim from SongFilesTab.vue
// (127-PATTERNS.md), so the label wording never drifts between the editor's
// Files tab and this read-only volunteer view.
const TYPE_LABELS: Record<'document' | 'audio', string> = { document: 'PDF', audio: 'MP3' }
const LINK_SOURCE_LABELS: Record<'youtube' | 'drive' | 'dropbox' | 'other', string> = {
  youtube: 'YouTube link',
  drive: 'Google Drive link',
  dropbox: 'Dropbox link',
  other: 'Link',
}

function linkSourceLabel(a: RehearseAttachment): string {
  return LINK_SOURCE_LABELS[a.linkSource ?? 'other']
}

/** Attachment meta line — graceful-omission (Pitfall 4): the projection
 *  (RehearseAttachment) carries only id/name/kind/downloadUrl/href/
 *  linkSource, no sizeBytes/createdAt, so the line is the type label alone
 *  rather than inventing a size/date the data doesn't have. */
function metaFor(a: RehearseAttachment): string {
  if (a.kind === 'document' || a.kind === 'audio') return TYPE_LABELS[a.kind]
  return ''
}

// Header meta line ('{key} · {bpm} bpm · CCLI {ccli}') — build each clause
// as a real string or null BEFORE filter(Boolean).join, mirroring
// SongFilesTab.vue's metaLine() idiom exactly (Pitfall 4: never interpolate
// a possibly-null value directly into a template literal).
const metaLine = computed(() => {
  const song = props.song
  if (!song) return ''
  const keyClause = song.keyOrArrangement || null
  const bpmClause = song.bpm != null ? `${song.bpm} bpm` : null
  const ccliClause = props.ccliNumber ? `CCLI ${props.ccliNumber}` : null
  return [keyClause, bpmClause, ccliClause].filter(Boolean).join(' · ')
})

// Print (T-127-04) — opens the Storage download URL in a NEW tab, letting
// the browser's own PDF viewer supply printing. NOT
// iframe.contentWindow.print() — Storage URLs are cross-origin and that
// call throws.
function printAttachment(a: RehearseAttachment) {
  window.open(a.downloadUrl, '_blank', 'noopener,noreferrer')
}

// Download — fetch->blob->objectURL->synthetic-click, copied UNMODIFIED
// from SongFilesTab.vue (124-REVIEW FIX A: a plain <a download> on a
// cross-origin Storage URL silently ignores the `download` attribute and
// navigates the whole SPA away instead of prompting Save). Falls back to
// window.open on fetch failure rather than ever navigating the SPA away.
async function downloadAttachment(a: RehearseAttachment) {
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
</script>
