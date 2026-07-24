<template>
  <div class="flex flex-col h-full">
    <!-- Header with status and actions -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-gray-100">Lyrics</h3>
        <!-- Auto-save status -->
        <span
          v-if="autoSaveStatus === 'pending'"
          data-testid="status-pending"
          class="inline-block w-2 h-2 rounded-full bg-yellow-400"
          title="Unsaved changes"
        ></span>
        <span
          v-else-if="autoSaveStatus === 'saving'"
          data-testid="status-saving"
          class="text-xs text-gray-400"
        >Saving...</span>
        <span
          v-else-if="autoSaveStatus === 'saved'"
          data-testid="status-saved"
          class="text-xs text-green-400"
        >Saved &#10003;</span>
      </div>
      <div v-if="currentLyrics" class="flex items-center gap-2">
        <button
          type="button"
          data-testid="paste-lyrics-btn"
          class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
          @click="showPasteDialog = true"
        >
          Paste New Lyrics
        </button>
        <button
          type="button"
          data-testid="save-version-btn"
          class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          @click="onSaveVersion"
        >
          Save Version
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="songLyricsStore.isLoading" class="flex-1 flex items-center justify-center">
      <span class="text-sm text-gray-500">Loading lyrics...</span>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!currentLyrics"
      data-testid="empty-state"
      class="flex-1 flex flex-col items-center justify-center gap-4 p-8"
    >
      <p class="text-sm text-gray-400">No lyrics yet for this song.</p>
      <button
        type="button"
        data-testid="paste-cta-btn"
        class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
        @click="showPasteDialog = true"
      >
        Paste Lyrics from SongSelect
      </button>
    </div>

    <!-- Editor -->
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Sections -->
      <div
        v-for="(section, idx) in editableSections"
        :key="section.id"
        class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-4"
      >
        <div class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
          {{ section.label }}
        </div>
        <textarea
          :data-testid="`section-textarea-${idx}`"
          :value="section.lines.join('\n')"
          class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono leading-relaxed"
          :rows="Math.max(section.lines.length, 2)"
          @input="onSectionInput(idx, ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>

      <!-- Copyright -->
      <div
        v-if="currentLyrics.copyright.ccliSongNumber"
        data-testid="copyright-display"
        class="border-t border-gray-800 pt-4 mt-4 space-y-1"
      >
        <div class="text-sm font-medium text-gray-200">{{ currentLyrics.copyright.title }}</div>
        <div class="text-xs text-gray-500">{{ currentLyrics.copyright.authors.join(', ') }}</div>
        <div
          v-for="(line, i) in currentLyrics.copyright.copyrightLines"
          :key="i"
          class="text-xs text-gray-500"
        >
          {{ line }}
        </div>
        <div class="text-xs text-gray-500">
          CCLI Song # {{ currentLyrics.copyright.ccliSongNumber }}
        </div>
        <div v-if="currentLyrics.copyright.ccliLicenseNumber" class="text-xs text-gray-500">
          CCLI License # {{ currentLyrics.copyright.ccliLicenseNumber }}
        </div>
      </div>
    </div>

    <!-- Paste dialog -->
    <LyricPasteDialog
      :open="showPasteDialog"
      :song-id="props.songId"
      :org-id="props.orgId"
      @close="showPasteDialog = false"
      @saved="onPasteSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSongLyricsStore } from '@/stores/songLyrics'
import { useAutoSave } from '@/composables/useAutoSave'
import LyricPasteDialog from './LyricPasteDialog.vue'
import type { LyricSection, SongLyrics } from '@/types/songLyrics'

const props = defineProps<{
  songId: string
  orgId: string
}>()

const songLyricsStore = useSongLyricsStore()
const showPasteDialog = ref(false)

const editableSections = ref<LyricSection[]>([])

const currentLyrics = computed<SongLyrics | null>(() => songLyricsStore.currentLyrics)

watch(currentLyrics, (val) => {
  if (val) {
    editableSections.value = val.sections.map((s) => ({
      ...s,
      lines: [...s.lines],
    }))
  } else {
    editableSections.value = []
  }
}, { immediate: true })

function onSectionInput(idx: number, value: string) {
  editableSections.value[idx]!.lines = value.split('\n')
}

const isDirty = computed(() => {
  if (!currentLyrics.value) return false
  const original = currentLyrics.value.sections
  const current = editableSections.value
  if (original.length !== current.length) return true
  for (let i = 0; i < original.length; i++) {
    if (original[i]!.lines.join('\n') !== current[i]!.lines.join('\n')) return true
  }
  return false
})

async function doAutoSave() {
  const cur = currentLyrics.value
  if (!cur?.id) return
  await songLyricsStore.updateCurrentLyrics(
    props.orgId,
    props.songId,
    cur.id,
    { sections: editableSections.value },
  )
}

const { status: autoSaveStatus, cleanup: cleanupAutoSave } = useAutoSave(
  editableSections,
  doAutoSave,
  isDirty,
)

async function onSaveVersion() {
  const cur = currentLyrics.value
  if (!cur) return
  await songLyricsStore.saveLyrics(props.orgId, props.songId, {
    sections: editableSections.value,
    copyright: cur.copyright,
    performanceOrder: cur.performanceOrder,
  })
}

function onPasteSaved() {
  showPasteDialog.value = false
}

onMounted(() => {
  songLyricsStore.subscribeLyrics(props.orgId, props.songId)
})

onUnmounted(() => {
  cleanupAutoSave()
  songLyricsStore.unsubscribeLyrics()
})
</script>
