<template>
  <div class="flex h-full flex-col">
    <!-- Header (non-scrolling) -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-4 py-3"
      data-testid="lyrics-header"
    >
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-gray-100">Sections</h3>
        <span class="text-[11px] text-gray-500">this order is the slide order</span>
        <!-- Auto-save status -->
        <span
          v-if="autoSaveStatus === 'pending'"
          data-testid="status-pending"
          class="inline-block h-2 w-2 rounded-full bg-yellow-400"
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
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
          @click="showPasteDialog = true"
        >Paste lyrics</button>
        <button
          type="button"
          data-testid="history-toggle-btn"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
          @click="showHistory = !showHistory"
        >History</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="songLyricsStore.isLoading" class="flex flex-1 items-center justify-center">
      <span class="text-sm text-gray-500">Loading lyrics...</span>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!currentLyrics"
      data-testid="empty-state"
      class="flex flex-1 flex-col items-center justify-center gap-4 p-8"
    >
      <p class="text-sm text-gray-400">No lyrics yet for this song.</p>
      <button
        type="button"
        data-testid="paste-cta-btn"
        class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        @click="showPasteDialog = true"
      >Paste Lyrics from SongSelect</button>
    </div>

    <!--
      Single scroll region — the ONLY element in this component that may
      declare vertical overflow (R035). The header above and the closing
      note at the bottom of this region stay outside/inside respectively so
      the header never scrolls away. `section-rows` is a placeholder here;
      Task 2 (28-05) fills it with the numbered, collapsible row list.
    -->
    <div
      v-else
      data-testid="lyrics-scroll-region"
      class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3"
    >
      <!-- History disclosure -->
      <div
        v-if="showHistory"
        data-testid="history-panel"
        class="space-y-3 rounded-lg border border-gray-700 bg-gray-800/40 p-3"
      >
        <div class="flex items-center justify-end">
          <button
            type="button"
            data-testid="save-version-btn"
            class="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
            @click="onSaveVersion"
          >Save Version</button>
        </div>
        <LyricVersionHistory
          :versions="songLyricsStore.lyricVersions"
          :current-version-id="currentLyrics?.id ?? ''"
          @revert="onRevertVersion"
        />
      </div>

      <!-- Ordered section rows (Task 2 / 28-05 fills this in). -->
      <div data-testid="section-rows" class="flex flex-col gap-2.5"></div>

      <p data-testid="closing-note" class="text-[11px] leading-relaxed text-gray-500">
        <span class="text-emerald-400">&#10003; {{ currentLyrics?.performanceOrder.length ?? 0 }} sections</span>
        &middot; used as the slide order for this song in every service. A repeat reuses the original words &mdash; edit once, both update.
      </p>
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
import LyricVersionHistory from './LyricVersionHistory.vue'
import type { LyricSection, SongLyrics } from '@/types/songLyrics'

const props = defineProps<{
  songId: string
  orgId: string
}>()

const songLyricsStore = useSongLyricsStore()
const showPasteDialog = ref(false)
const showHistory = ref(false)

const currentLyrics = computed<SongLyrics | null>(() => songLyricsStore.currentLyrics)

// Placeholder editable state — Task 2 (28-05) replaces this with the reactive
// pool/order state that `buildSectionRows` renders through. Kept here only so
// the autosave status indicator and useAutoSave wiring already behave
// correctly in Task 1, before there is anything to edit.
const editableSections = ref<LyricSection[]>([])

watch(currentLyrics, (val) => {
  editableSections.value = val ? val.sections.map((s) => ({ ...s, lines: [...s.lines] })) : []
}, { immediate: true })

const isDirty = computed(() => false)

async function doAutoSave() {
  // Task 2 wires this to write the reactive pool/order editable state,
  // sections and performanceOrder together in one call (T-28-12).
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
    sections: cur.sections,
    copyright: cur.copyright,
    performanceOrder: cur.performanceOrder,
  })
}

async function onRevertVersion(versionId: string) {
  await songLyricsStore.revertToVersion(props.orgId, props.songId, versionId)
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
