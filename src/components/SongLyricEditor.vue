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
      declare vertical overflow (R035). The header above stays outside it, and
      the closing note is the last child inside it, so the header never
      scrolls away.
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

      <!-- Ordered section rows — the list IS the slide order (D-01/D-03). -->
      <div data-testid="section-rows" class="flex flex-col gap-2.5">
        <div
          v-for="row in sectionRows"
          :key="row.rowKey"
          :data-testid="`section-row-${row.rowKey}`"
          :data-repeat="row.isRepeat ? 'true' : 'false'"
          :class="rowCardClass(row)"
        >
          <div class="flex items-center gap-2 px-3 py-2.5">
            <span data-testid="row-position" class="w-5 shrink-0 text-right text-[11px] text-gray-500">{{ row.position }}</span>
            <span class="drag-handle shrink-0 cursor-grab text-gray-600 hover:text-gray-400" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
              </svg>
            </span>

            <template v-if="!row.isRepeat">
              <span :class="isExpanded(row) ? LABEL_CHIP_CLASSES.expanded : LABEL_CHIP_CLASSES.collapsed">
                {{ row.section.label.toUpperCase() }}
                <span aria-hidden="true">{{ isExpanded(row) ? '⌃' : '⌄' }}</span>
              </span>
              <span
                v-if="!isExpanded(row)"
                data-testid="row-preview"
                class="min-w-0 flex-1 truncate text-[11.5px] text-gray-400"
              >{{ previewText(row.section) }}</span>
              <span v-else class="min-w-0 flex-1"></span>
              <span data-testid="row-line-count" class="shrink-0 text-[10.5px] text-gray-500">{{ lineCountLabel(row.section) }}</span>
              <button
                type="button"
                :data-testid="`row-toggle-${row.rowKey}`"
                class="shrink-0 text-gray-500 transition-colors hover:text-gray-300"
                @click="toggleRow(row.rowKey)"
              >{{ isExpanded(row) ? '⌃' : '⌄' }}</button>
            </template>

            <template v-else>
              <span :class="LABEL_CHIP_CLASSES.repeat">
                <span aria-hidden="true">&#8635;</span>
                {{ row.section.label.toUpperCase() }}
              </span>
              <span
                data-testid="row-repeat-note"
                class="min-w-0 flex-1 truncate text-[11.5px] text-gray-400"
              >repeat &mdash; follows row {{ row.repeatOfPosition }}</span>
              <span data-testid="row-linked" class="shrink-0 text-[10.5px] text-gray-500">linked</span>
              <button
                type="button"
                :data-testid="`row-toggle-${row.rowKey}`"
                class="shrink-0 text-gray-500 transition-colors hover:text-gray-300"
                @click="toggleRow(row.rowKey)"
              >{{ isExpanded(row) ? '⌃' : '⌄' }}</button>
            </template>
          </div>

          <div v-if="isExpanded(row) && !row.isRepeat" class="px-3 pb-3">
            <textarea
              :data-testid="`row-textarea-${row.sectionId}`"
              :value="row.section.lines.join('\n')"
              class="w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm leading-relaxed text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              :rows="Math.max(row.section.lines.length, 2)"
              @input="onSectionInput(row.sectionId, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>
          <div v-else-if="isExpanded(row) && row.isRepeat" class="space-y-1.5 px-3 pb-3">
            <div
              :data-testid="`row-shared-text-${row.rowKey}`"
              class="whitespace-pre-line rounded-md border border-gray-800 bg-gray-950/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-gray-300"
            >{{ row.section.lines.join('\n') }}</div>
            <p class="text-[10.5px] text-gray-500">Editing happens on row {{ row.repeatOfPosition }}, where this section first appears.</p>
          </div>
        </div>
      </div>

      <p data-testid="closing-note" class="text-[11px] leading-relaxed text-gray-500">
        <span class="text-emerald-400">&#10003; {{ sectionRows.length }} sections</span>
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
import { reactive, ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useSongLyricsStore } from '@/stores/songLyrics'
import { useAutoSave } from '@/composables/useAutoSave'
import { buildSectionRows, normalizeLyricOrder, type SectionRow } from '@/utils/songSectionOrder'
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
const expandedRowKeys = ref<Set<string>>(new Set())

const currentLyrics = computed<SongLyrics | null>(() => songLyricsStore.currentLyrics)

// The pool + order model this editor renders/mutates through (28-01). Seeded
// from the loaded document, normalised — never the store's own objects, so
// rendering here can never mutate what other components read (T-28-13).
interface EditableLyricsState {
  sections: LyricSection[]
  performanceOrder: string[]
}

const editableState = reactive<EditableLyricsState>({ sections: [], performanceOrder: [] })

const sectionRows = computed<SectionRow[]>(() =>
  buildSectionRows(editableState.sections, editableState.performanceOrder),
)

const isDirty = computed(() => {
  const cur = currentLyrics.value
  if (!cur) return false

  if (cur.performanceOrder.length !== editableState.performanceOrder.length) return true
  for (let i = 0; i < cur.performanceOrder.length; i++) {
    if (cur.performanceOrder[i] !== editableState.performanceOrder[i]) return true
  }

  if (cur.sections.length !== editableState.sections.length) return true
  for (let i = 0; i < cur.sections.length; i++) {
    const a = cur.sections[i]!
    const b = editableState.sections[i]!
    if (a.id !== b.id || a.label !== b.label) return true
    if (a.lines.length !== b.lines.length) return true
    for (let j = 0; j < a.lines.length; j++) {
      if (a.lines[j] !== b.lines[j]) return true
    }
  }

  return false
})

// T-28-12: sections and performanceOrder are written together in one call —
// a reorder can never land without its text, or the reverse.
async function doAutoSave() {
  const cur = currentLyrics.value
  if (!cur?.id) return
  await songLyricsStore.updateCurrentLyrics(
    props.orgId,
    props.songId,
    cur.id,
    { sections: editableState.sections, performanceOrder: editableState.performanceOrder },
  )
}

const { status: autoSaveStatus, cleanup: cleanupAutoSave } = useAutoSave(
  () => editableState,
  doAutoSave,
  isDirty,
)

watch(
  currentLyrics,
  async (val) => {
    if (!val) {
      editableState.sections = []
      editableState.performanceOrder = []
      return
    }

    const normalized = normalizeLyricOrder(val.sections, val.performanceOrder)
    editableState.sections = normalized.sections.map((s) => ({ ...s, lines: [...s.lines] }))
    editableState.performanceOrder = [...normalized.performanceOrder]

    // The load may have needed repair (a stale order reference, or a pooled
    // section no longer referenced). Persist that repair through the same
    // write path autosave uses — sections and order together — rather than
    // waiting on a further edit. A document already satisfying the
    // invariants reads as clean (isDirty false) and produces no write.
    await nextTick()
    if (isDirty.value) {
      await doAutoSave()
    }
  },
  { immediate: true },
)

function onSectionInput(sectionId: string, value: string) {
  const section = editableState.sections.find((s) => s.id === sectionId)
  if (section) section.lines = value.split('\n')
}

function isExpanded(row: SectionRow): boolean {
  return expandedRowKeys.value.has(row.rowKey)
}

function toggleRow(rowKey: string) {
  const next = new Set(expandedRowKeys.value)
  if (next.has(rowKey)) {
    next.delete(rowKey)
  } else {
    next.add(rowKey)
  }
  expandedRowKeys.value = next
}

function previewText(section: LyricSection): string {
  return section.lines.join(' ').trim()
}

function lineCountLabel(section: LyricSection): string {
  const count = section.lines.length
  return `${count} line${count === 1 ? '' : 's'}`
}

async function onSaveVersion() {
  const cur = currentLyrics.value
  if (!cur) return
  await songLyricsStore.saveLyrics(props.orgId, props.songId, {
    sections: editableState.sections,
    copyright: cur.copyright,
    performanceOrder: editableState.performanceOrder,
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

// Static, fully-spelled-out class maps — Tailwind v4 purges dynamically built
// class names, which has shipped as a bug twice in this codebase already.
// Mirrors the pattern SongSlideOver.vue already uses for its category
// buttons (vwTypeClasses).
const ROW_CARD_CLASSES = {
  ordinaryCollapsed: 'rounded-lg border border-gray-700/50 bg-gray-800/40',
  ordinaryExpanded: 'rounded-lg border border-indigo-800/60 bg-gray-900/70',
  repeatCollapsed: 'rounded-lg border border-gray-700/50 bg-gray-800/20 opacity-80',
  repeatExpanded: 'rounded-lg border border-gray-700/50 bg-gray-800/30 opacity-90',
} as const

const LABEL_CHIP_CLASSES = {
  collapsed: 'inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-800/60 bg-indigo-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300',
  expanded: 'inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-500/60 bg-indigo-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200',
  repeat: 'inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400',
} as const

function rowCardClass(row: SectionRow): string {
  const expanded = isExpanded(row)
  if (row.isRepeat) return expanded ? ROW_CARD_CLASSES.repeatExpanded : ROW_CARD_CLASSES.repeatCollapsed
  return expanded ? ROW_CARD_CLASSES.ordinaryExpanded : ROW_CARD_CLASSES.ordinaryCollapsed
}
</script>
