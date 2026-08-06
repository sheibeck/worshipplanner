<template>
  <div class="space-y-2">
    <h3 class="text-sm font-medium text-gray-300">Version History</h3>
    <div v-if="versions.length === 0" class="text-xs text-gray-500 italic">
      No versions yet
    </div>
    <div class="space-y-1">
      <div
        v-for="version in versions"
        :key="version.id"
        data-testid="version-entry"
        class="flex items-center justify-between gap-2 rounded-md bg-gray-800 border border-gray-700/50 px-3 py-2"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm text-gray-400 shrink-0">
            {{ formatRelativeTime(version.createdAt) }}
          </span>
          <span
            v-if="version.id === currentVersionId"
            data-testid="current-badge"
            class="inline-flex items-center rounded-full bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 text-xs font-medium text-indigo-300 shrink-0"
          >
            Current
          </span>
        </div>
        <button
          v-if="version.id !== currentVersionId"
          type="button"
          data-testid="revert-btn"
          class="px-2.5 py-1 rounded-md text-xs font-medium text-indigo-300 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-colors shrink-0"
          @click="onRevert(version.id)"
        >
          Revert
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SongLyrics } from '@/types/songLyrics'
import type { Timestamp } from 'firebase/firestore'

const props = defineProps<{
  versions: SongLyrics[]
  currentVersionId: string
}>()

const emit = defineEmits<{
  revert: [versionId: string]
}>()

function formatRelativeTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp || typeof timestamp.toMillis !== 'function') return 'Unknown'
  const now = Date.now()
  const ms = now - timestamp.toMillis()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function onRevert(versionId: string) {
  if (confirm('Revert to this version? Your current edits will be saved as a new version first.')) {
    emit('revert', versionId)
  }
}
</script>
