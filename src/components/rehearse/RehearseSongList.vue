<template>
  <div class="w-full sm:w-[300px] shrink-0 sm:border-r border-gray-800 bg-gray-950 overflow-y-auto">
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
      <span class="text-sm text-gray-400">Songs in this service</span>
      <span class="text-sm text-gray-500">{{ songs.length }}</span>
    </div>

    <p v-if="songs.length === 0" class="text-sm text-gray-500 py-8 text-center" data-testid="rehearse-song-list-empty">
      No songs in this service yet.
    </p>

    <button
      v-for="song in songs"
      :key="song.id"
      type="button"
      data-testid="rehearse-song-row"
      :aria-current="song.id === selectedSongId ? 'true' : undefined"
      class="w-full text-left px-4 py-3 border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
      :class="
        song.id === selectedSongId
          ? 'bg-indigo-950/30 border-l-2 border-indigo-500 pl-[14px]'
          : ''
      "
      @click="emit('select', song.id)"
    >
      <div class="flex items-center justify-between gap-2">
        <span
          class="text-base font-semibold truncate"
          :class="song.id === selectedSongId ? 'text-white' : 'text-gray-100'"
          :title="song.title"
        >
          {{ song.title }}
        </span>
        <span
          v-if="song.keyOrArrangement"
          data-testid="rehearse-song-key"
          class="font-mono text-xs text-gray-400 shrink-0"
        >
          {{ song.keyOrArrangement }}
        </span>
      </div>
      <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
        <span class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span data-testid="rehearse-song-pdf-count">{{ documentCount(song) }}</span>
        </span>
        <span class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
          <span data-testid="rehearse-song-mp3-count">{{ audioCount(song) }}</span>
        </span>
      </div>
      <div v-if="song.id === activeTrackSongId" data-testid="rehearse-song-playing" class="text-indigo-400 text-xs mt-1">
        &#9679; Playing
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
// Column 1 / mobile Screen A (R385, 127-UI-SPEC.md §2) — the selectable song
// list. Pure presentational component: props in, `select` event out, no
// store reads, no Firestore.
import type { RehearseSong } from '@/utils/rehearseAccess'

defineProps<{
  songs: RehearseSong[]
  selectedSongId?: string
  activeTrackSongId?: string
}>()

const emit = defineEmits<{
  select: [songId: string]
}>()

function documentCount(song: RehearseSong): number {
  return song.attachments.filter((a) => a.kind === 'document').length
}

function audioCount(song: RehearseSong): number {
  return song.attachments.filter((a) => a.kind === 'audio').length
}
</script>
