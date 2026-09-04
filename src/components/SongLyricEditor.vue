<template>
  <div class="flex h-full flex-col">
    <template v-if="!pasteMode">
    <!-- Header (non-scrolling) -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-4 py-3"
      data-testid="lyrics-header"
    >
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-gray-100">Sections</h3>
        <span class="text-[11px] text-gray-500">this order is the slide order</span>
        <SaveStatusIndicator :surface-id="surfaceId ?? ''" />
      </div>
      <div v-if="currentLyrics" class="flex items-center gap-2">
        <button
          type="button"
          data-testid="paste-lyrics-btn"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
          @click="pasteMode = true"
        >Paste lyrics</button>
        <button
          type="button"
          data-testid="history-toggle-btn"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
          @click="showHistory = !showHistory"
        >History</button>
      </div>
    </div>

    <!-- Song background (R057) — the least specific tier of the slide/group/
         song cascade; this is the LEAST specific level, so there is nothing
         below it for the control to display as inherited (no such prop is
         ever passed here). A sibling of the header and the branches below,
         nested in neither. -->
    <div v-if="currentLyrics" data-testid="song-background-row" class="px-4 pt-3">
      <BackgroundControl
        :image-url="currentLyrics.backgroundImageUrl"
        :caption="currentLyrics.backgroundImageUrl ? 'Applies wherever this song appears — services can override it.' : 'Applies to every service using this song, unless a group or slide overrides it.'"
        add-label="+ Add background for this song"
        remove-label="Remove song background"
        :is-editor="isEditor"
        :org-id="orgId"
        @attach="onAttachSongBackground"
        @remove="onRemoveSongBackground"
      />
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
        @click="pasteMode = true"
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

      <!-- Ordered section rows — the list IS the slide order (D-01/D-03).
           Always draggable by handle, no mode to enter first (D-01). -->
      <div ref="rowsContainerRef" data-testid="section-rows" class="flex flex-col gap-2.5">
        <div
          v-for="row in sectionRows"
          :key="row.rowKey"
          :data-testid="`section-row-${row.rowKey}`"
          :data-repeat="row.isRepeat ? 'true' : 'false'"
          :class="[rowCardClass(row), 'section-row']"
        >
          <!-- The whole header row toggles expand/collapse (owner UAT — the far-right
               chevron was too small a target). Interactive children (drag handle,
               Duplicate/Remove, the chevron button) `.stop` so they don't also
               toggle; the expanded editor below is a separate block, unaffected. -->
          <div
            class="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
            @click="toggleRow(row.stableKey)"
          >
            <span data-testid="row-position" class="w-5 shrink-0 text-right text-[11px] text-gray-500">{{ row.position }}</span>
            <span class="drag-handle shrink-0 cursor-grab text-gray-600 hover:text-gray-400" aria-hidden="true" @click.stop>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
              </svg>
            </span>

            <template v-if="!row.isRepeat">
              <span :class="isExpanded(row) ? LABEL_CHIP_CLASSES.expanded : LABEL_CHIP_CLASSES.collapsed">
                {{ row.displayLabel.toUpperCase() }}
                <span aria-hidden="true">{{ isExpanded(row) ? '⌃' : '⌄' }}</span>
              </span>
              <!-- R302/blackout (105-UI-SPEC.md Visual Contract): a blackout
                   row swaps the lyric-preview span for a small solid-black
                   swatch + muted caption, and the line-count span for
                   'no text' — same slot, same classes, so a blackout row
                   never reads as broken/empty (PITFALLS). -->
              <template v-if="!isExpanded(row) && isBlackout(row)">
                <span
                  data-testid="row-preview"
                  class="min-w-0 flex-1 flex items-center gap-1.5 truncate text-[11.5px] text-gray-400"
                >
                  <span class="inline-block h-3 w-3 shrink-0 rounded-sm bg-black border border-gray-700" aria-hidden="true"></span>
                  Solid black &mdash; no text or image
                </span>
              </template>
              <span
                v-else-if="!isExpanded(row)"
                data-testid="row-preview"
                class="min-w-0 flex-1 truncate text-[11.5px] text-gray-400"
              >{{ previewText(row.section) }}</span>
              <span v-else class="min-w-0 flex-1"></span>
              <span
                data-testid="row-line-count"
                class="shrink-0 text-[10.5px] text-gray-500"
              >{{ isBlackout(row) ? 'no text' : lineCountLabel(row.section) }}</span>
              <template v-if="isExpanded(row)">
                <button
                  type="button"
                  :data-testid="`row-duplicate-${row.rowKey}`"
                  class="shrink-0 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
                  @click.stop="onDuplicate(row)"
                >Duplicate</button>
                <button
                  type="button"
                  :data-testid="`row-remove-${row.rowKey}`"
                  class="shrink-0 rounded-md border border-red-900/60 bg-gray-800 px-2 py-1 text-[11px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/40"
                  @click.stop="requestRemove(row)"
                >Remove</button>
              </template>
              <button
                type="button"
                :data-testid="`row-toggle-${row.rowKey}`"
                class="shrink-0 text-gray-500 transition-colors hover:text-gray-300"
                @click.stop="toggleRow(row.stableKey)"
              >{{ isExpanded(row) ? '⌃' : '⌄' }}</button>
            </template>

            <template v-else>
              <span :class="LABEL_CHIP_CLASSES.repeat">
                <span aria-hidden="true">&#8635;</span>
                {{ row.displayLabel.toUpperCase() }}
              </span>
              <span
                data-testid="row-repeat-note"
                class="min-w-0 flex-1 truncate text-[11.5px] text-gray-400"
              >repeat &mdash; follows row {{ row.repeatOfPosition }}</span>
              <span data-testid="row-linked" class="shrink-0 text-[10.5px] text-gray-500">linked</span>
              <template v-if="isExpanded(row)">
                <button
                  type="button"
                  :data-testid="`row-duplicate-${row.rowKey}`"
                  class="shrink-0 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
                  @click.stop="onDuplicate(row)"
                >Duplicate</button>
                <button
                  type="button"
                  :data-testid="`row-remove-${row.rowKey}`"
                  class="shrink-0 rounded-md border border-red-900/60 bg-gray-800 px-2 py-1 text-[11px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/40"
                  @click.stop="requestRemove(row)"
                >Remove</button>
              </template>
              <button
                type="button"
                :data-testid="`row-toggle-${row.rowKey}`"
                class="shrink-0 text-gray-500 transition-colors hover:text-gray-300"
                @click.stop="toggleRow(row.stableKey)"
              >{{ isExpanded(row) ? '⌃' : '⌄' }}</button>
            </template>
          </div>

          <!-- R302/blackout: a black slide has no lines to split, so the
               expanded body is a single calm placeholder panel instead of
               the textarea+split block — no textarea, no slide-split UI. -->
          <div
            v-if="isExpanded(row) && !row.isRepeat && isBlackout(row)"
            class="px-3 pb-3"
          >
            <div
              :data-testid="`row-blackout-placeholder-${row.sectionId}`"
              class="rounded-md border border-gray-800 bg-black px-3 py-6 flex items-center justify-center"
            >
              <p class="text-[12px] text-gray-500">This slide renders solid black &mdash; no text, background, or label.</p>
            </div>
          </div>
          <div v-else-if="isExpanded(row) && !row.isRepeat" class="px-3 pb-3">
            <textarea
              :data-testid="`row-textarea-${row.sectionId}`"
              :value="row.section.lines.join('\n')"
              class="w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm leading-relaxed text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              :rows="Math.max(row.section.lines.length, 2)"
              @input="onSectionInput(row.sectionId, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>

            <!-- R117: manual slide-split. The section's `lines` stay the single
                 canonical text (edited above); a click between two lines toggles
                 the LINE index in `section.slideBreaks` (additive metadata), so
                 `sliceSectionIntoSlides` resolves the split live at assembly. A
                 section with no breaks is one slide, unchanged. Mirrors the
                 congregational click-between-lines divider — song-local, not a
                 shared component. -->
            <div
              v-if="row.section.lines.length > 1"
              :data-testid="`row-split-${row.sectionId}`"
              class="mt-2 rounded-md border border-gray-800 bg-gray-950/40 px-2 py-1.5"
            >
              <p class="px-1 pb-1 text-[10px] uppercase tracking-wider text-gray-600">Slide splits &mdash; click between lines to start a new slide</p>
              <template v-for="(line, li) in row.section.lines" :key="li">
                <div class="px-1 py-0.5 font-mono text-[12px] leading-relaxed text-gray-300">{{ line || ' ' }}</div>
                <button
                  v-if="li < row.section.lines.length - 1"
                  type="button"
                  :data-testid="`row-split-divider-${row.sectionId}-${li + 1}`"
                  :data-active="isSlideBreak(row.section, li + 1) ? 'true' : 'false'"
                  :aria-pressed="isSlideBreak(row.section, li + 1) ? 'true' : 'false'"
                  class="group flex w-full items-center gap-2 py-0.5"
                  @click="toggleSlideBreak(row.sectionId, li + 1)"
                >
                  <span :class="isSlideBreak(row.section, li + 1) ? SPLIT_DIVIDER_CLASSES.active : SPLIT_DIVIDER_CLASSES.inactive"></span>
                  <span :class="isSlideBreak(row.section, li + 1) ? SPLIT_LABEL_CLASSES.active : SPLIT_LABEL_CLASSES.inactive">{{ isSlideBreak(row.section, li + 1) ? 'slide break' : 'split here' }}</span>
                  <span :class="isSlideBreak(row.section, li + 1) ? SPLIT_DIVIDER_CLASSES.active : SPLIT_DIVIDER_CLASSES.inactive"></span>
                </button>
              </template>
            </div>
          </div>
          <div
            v-else-if="isExpanded(row) && row.isRepeat && isBlackout(row)"
            class="px-3 pb-3"
          >
            <div
              :data-testid="`row-blackout-placeholder-${row.sectionId}`"
              class="rounded-md border border-gray-800 bg-black px-3 py-6 flex items-center justify-center"
            >
              <p class="text-[12px] text-gray-500">This slide renders solid black &mdash; no text, background, or label.</p>
            </div>
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

      <!-- Add-section row: dashed border, appends a new, empty, uniquely-labelled
           section ready to type into. Not part of `section-rows` (and carries no
           `.section-row` class) so it stays outside both the row-count contract
           and the drag library's `draggable` scope, matching the established
           precedent of excluding non-row elements from Sortable (section headers
           in ServiceEditorView.vue's slot list). -->
      <div
        data-testid="add-section-row"
        class="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-700 px-3 py-2.5"
      >
        <span class="text-[11.5px] font-medium text-gray-400">&#65291; Add section</span>
        <button
          v-for="kind in ADD_SECTION_KINDS"
          :key="kind"
          type="button"
          :data-testid="`add-section-chip-${kind}`"
          class="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-indigo-600 hover:text-indigo-300"
          @click="onAddSection(kind)"
        >{{ kind }}</button>
        <!-- R302: a 7th chip, styled identically to the six ADD_SECTION_KINDS
             chips above (no accent color) — inserts a first-class blackout
             row via the SAME onAddSection path, minting kind:'blackout'
             (songSectionOrder.ts::addSection('BLACKOUT')). Creates NO new
             service section — it is a LyricSection row in the single-list
             order like any other kind. -->
        <button
          type="button"
          data-testid="add-section-chip-blackout"
          class="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-indigo-600 hover:text-indigo-300"
          @click="onAddSection('BLACKOUT')"
        >Black Slide</button>
      </div>

      <p data-testid="closing-note" class="text-[11px] leading-relaxed text-gray-500">
        <span class="text-emerald-400">&#10003; {{ sectionRows.length }} sections</span>
        &middot; used as the slide order for this song in every service. A repeat reuses the original words &mdash; edit once, both update.
      </p>

      <!-- Copyright — restored read-only (28-06); R336 adds inline manual
           editing over the same block (Edit/Add credits toggle -> form ->
           saveLyrics, sections/order untouched). Lives inside the single
           scroll region so R035's one-scroll-surface property still holds. -->
      <div class="mt-4 border-t border-gray-800 pt-4">
        <div
          v-if="hasCredits && !editingCredits"
          data-testid="copyright-display"
          class="space-y-1"
        >
          <div class="text-sm font-medium text-gray-200">{{ currentLyrics.copyright.title }}</div>
          <div class="text-xs text-gray-500">{{ currentLyrics.copyright.authors.join(', ') }}</div>
          <div
            v-for="(line, i) in currentLyrics.copyright.copyrightLines"
            :key="i"
            class="text-xs text-gray-500"
          >{{ line }}</div>
          <div v-if="currentLyrics.copyright.ccliSongNumber" class="text-xs text-gray-500">CCLI Song # {{ currentLyrics.copyright.ccliSongNumber }}</div>
          <div v-if="currentLyrics.copyright.ccliLicenseNumber" class="text-xs text-gray-500">
            CCLI License # {{ currentLyrics.copyright.ccliLicenseNumber }}
          </div>
        </div>

        <button
          v-if="!editingCredits"
          type="button"
          data-testid="copyright-edit-toggle"
          class="mt-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
          @click="openCreditsEdit"
        >{{ hasCredits ? 'Edit credits' : 'Add credits' }}</button>

        <!-- R336: all 5 CopyrightInfo fields; authors/copyrightLines edited
             one entry per line, joined/split on save. -->
        <div v-else data-testid="copyright-edit-form" class="mt-2 space-y-2">
          <div>
            <label class="block text-[11px] text-gray-500">Title</label>
            <input
              data-testid="copyright-edit-title"
              v-model="creditsForm.title"
              type="text"
              class="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-[11px] text-gray-500">Authors (one per line)</label>
            <textarea
              data-testid="copyright-edit-authors"
              v-model="creditsForm.authorsText"
              rows="2"
              class="mt-1 w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            ></textarea>
          </div>
          <div>
            <label class="block text-[11px] text-gray-500">CCLI Song #</label>
            <input
              data-testid="copyright-edit-ccli-song"
              v-model="creditsForm.ccliSongNumber"
              type="text"
              class="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-[11px] text-gray-500">Copyright lines (one per line)</label>
            <textarea
              data-testid="copyright-edit-copyright-lines"
              v-model="creditsForm.copyrightLinesText"
              rows="2"
              class="mt-1 w-full resize-none rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            ></textarea>
          </div>
          <div>
            <label class="block text-[11px] text-gray-500">CCLI License #</label>
            <input
              data-testid="copyright-edit-license"
              v-model="creditsForm.ccliLicenseNumber"
              type="text"
              class="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <button
              type="button"
              data-testid="copyright-edit-cancel"
              class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
              @click="cancelCreditsEdit"
            >Cancel</button>
            <button
              type="button"
              data-testid="copyright-edit-save"
              class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
              @click="saveCreditsEdit"
            >Save</button>
          </div>
        </div>
      </div>
    </div>
    </template>

    <!-- Inline paste region (R066) — swaps in place of the Sections view
         above rather than stacking a second surface over it. Mount/unmount
         via v-if/v-else IS the reset mechanism for the region's own internal
         state (E6) — v-show would keep it alive across closes. -->
    <LyricPasteRegion
      v-else
      :song-id="props.songId"
      :org-id="props.orgId"
      :current-section-count="sectionRows.length"
      @close="pasteMode = false"
      @saved="onPasteSaved"
    />

    <!-- Delete-section confirm (owner UAT) — an accidental click on a row's
         Remove no longer drops the verse outright; it opens this small confirm
         first. Mirrors the app's inline Teleport confirm-dialog idiom
         (RunControlView.vue's exit confirm): Cancel is focused, Delete is the
         red destructive action, and only Delete runs the existing `onRemove`
         logic. A single dialog serves every row — `pendingRemove` holds the row
         awaiting confirmation, so the confirm control's testid tracks that row's
         key. -->
    <Teleport to="body">
      <div
        v-if="pendingRemove"
        data-testid="row-remove-dialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      >
        <div class="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
          <h2 class="mb-2 text-base font-semibold text-gray-100">Delete this section?</h2>
          <p class="mb-6 text-sm text-gray-400">This can't be undone.</p>
          <div class="flex justify-end gap-3">
            <button
              ref="removeCancelBtnRef"
              type="button"
              data-testid="row-remove-cancel"
              class="rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @click="cancelRemove"
            >Cancel</button>
            <button
              type="button"
              :data-testid="`row-remove-confirm-${pendingRemove.rowKey}`"
              class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              @click="confirmRemove"
            >Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import Sortable from 'sortablejs'
import { useSongLyricsStore } from '@/stores/songLyrics'
import { useAuthStore } from '@/stores/auth'
import { useAutoSave } from '@/composables/useAutoSave'
import { useSaveStatus } from '@/stores/saveStatus'
import SaveStatusIndicator from './SaveStatusIndicator.vue'
import BackgroundControl from './slides/BackgroundControl.vue'
import {
  buildSectionRows,
  normalizeLyricOrder,
  moveRow,
  duplicateRow,
  removeRow,
  addSection,
  ADD_SECTION_KINDS,
  type SectionRow,
} from '@/utils/songSectionOrder'
import LyricPasteRegion from './LyricPasteRegion.vue'
import LyricVersionHistory from './LyricVersionHistory.vue'
import type { CopyrightInfo, LyricSection, SongLyrics } from '@/types/songLyrics'

const props = defineProps<{
  songId: string
  orgId: string
}>()

const songLyricsStore = useSongLyricsStore()
const authStore = useAuthStore()
const saveStatus = useSaveStatus()
const pasteMode = ref(false)
const showHistory = ref(false)
const expandedRowKeys = ref<Set<string>>(new Set())

const currentLyrics = computed<SongLyrics | null>(() => songLyricsStore.currentLyrics)

// R057: gated on the auth store's isEditor rather than a new prop — this
// editor has no editor gate today (SongSlideOver.vue doesn't add one
// either), but the Firestore rule on the lyrics subcollection already
// requires an org editor, so a viewer's write would fail with a permission
// error rather than a visible refusal. Gating only this NEW control is a
// strict improvement; retrofitting the gate onto the rest of the editor is
// a pre-existing gap, deliberately out of scope here.
const isEditor = computed(() => authStore.isEditor)

async function onAttachSongBackground(url: string): Promise<void> {
  const cur = currentLyrics.value
  if (!cur?.id) return
  await songLyricsStore.setSongBackground(props.orgId, props.songId, cur.id, url)
}

async function onRemoveSongBackground(): Promise<void> {
  const cur = currentLyrics.value
  if (!cur?.id) return
  await songLyricsStore.setSongBackground(props.orgId, props.songId, cur.id, null)
}

// 32-06: same capture-once shape as CongregationalEditor.vue/
// ScriptureSlideEditor.vue, for consistency across all three editors.
// props.songId is non-null from mount here (the parent panel only renders
// while open, behind a click-blocking backdrop — see SongSlideOver.vue), so
// this resolves immediately; captured via the same watch idiom anyway so a
// future change to that guarantee fails safe rather than silently.
const surfaceId = ref<string | null>(null)
watch(
  () => props.songId,
  (id) => {
    if (id && !surfaceId.value) {
      surfaceId.value = `song-lyrics:${id}`
    }
  },
  { immediate: true },
)

// The pool + order model this editor renders/mutates through (28-01). Seeded
// from the loaded document, normalised — never the store's own objects, so
// rendering here can never mutate what other components read (T-28-13).
interface EditableLyricsState {
  sections: LyricSection[]
  performanceOrder: string[]
}

const editableState = reactive<EditableLyricsState>({ sections: [], performanceOrder: [] })

// See ADR-0079 (docs/adr/0079-a-stable-identity-per-performanceorder-slot-not-per-section.md)
// own autosave round-tripping back through the Firestore subscription).
const orderSlotIds = ref<string[]>([])
let slotIdCounter = 0
function mintSlotId(): string {
  slotIdCounter += 1
  return `slot-${slotIdCounter}`
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const sectionRows = computed<SectionRow[]>(() =>
  buildSectionRows(editableState.sections, editableState.performanceOrder, orderSlotIds.value),
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
    // See ADR-0080 (docs/adr/0080-compare-kind-too-today-the-only-way-a-section-s-kind-is-set.md)
    if (a.id !== b.id || a.label !== b.label || (a.kind ?? 'lyric') !== (b.kind ?? 'lyric')) return true
    if (a.lines.length !== b.lines.length) return true
    for (let j = 0; j < a.lines.length; j++) {
      if (a.lines[j] !== b.lines[j]) return true
    }
    // R117: slideBreaks are part of the persisted section, so a divider-only
    // click (no text change) must register as dirty or the autosave skips it.
    const aBreaks = a.slideBreaks ?? []
    const bBreaks = b.slideBreaks ?? []
    if (aBreaks.length !== bBreaks.length) return true
    for (let j = 0; j < aBreaks.length; j++) {
      if (aBreaks[j] !== bBreaks[j]) return true
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

// Reports status into the shared store; skips entirely while surfaceId is
// unresolved. Same reasoning as CongregationalEditor.vue/ScriptureSlideEditor.vue.
watch(
  () => autoSaveStatus.value,
  (status) => {
    if (!surfaceId.value) return
    if (status === 'saved') {
      saveStatus.set(surfaceId.value, { status: 'saved', savedAt: new Date() })
      return
    }
    if (status === 'error') {
      saveStatus.set(surfaceId.value, {
        status: 'error',
        errorText: "Couldn't save your changes — they're still here. Try again.",
      })
      return
    }
    saveStatus.set(surfaceId.value, { status })
  },
)

watch(
  currentLyrics,
  async (val) => {
    if (!val) {
      editableState.sections = []
      editableState.performanceOrder = []
      orderSlotIds.value = []
      return
    }

    const normalized = normalizeLyricOrder(val.sections, val.performanceOrder)

    // See ADR-0079 (docs/adr/0079-a-stable-identity-per-performanceorder-slot-not-per-section.md)
    const orderChanged = !arraysEqual(normalized.performanceOrder, editableState.performanceOrder)

    editableState.sections = normalized.sections.map((s) => ({ ...s, lines: [...s.lines] }))
    editableState.performanceOrder = [...normalized.performanceOrder]

    if (orderChanged) {
      orderSlotIds.value = normalized.performanceOrder.map(() => mintSlotId())
    }

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

// See ADR-0080 (docs/adr/0080-compare-kind-too-today-the-only-way-a-section-s-kind-is-set.md)
function onSectionInput(sectionId: string, value: string) {
  const section = editableState.sections.find((s) => s.id === sectionId)
  if (!section) return
  const lines = value.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  section.lines = lines
  pruneSlideBreaks(section)
}

// See ADR-0081 (docs/adr/0081-r117-the-write-source-complement-to-slicesectionintoslides-s.md)
function pruneSlideBreaks(section: LyricSection) {
  if (!section.slideBreaks) return
  const n = section.lines.length
  const pruned = section.slideBreaks.filter((k) => Number.isInteger(k) && k >= 1 && k < n)
  if (pruned.length === 0) {
    delete section.slideBreaks
  } else if (pruned.length !== section.slideBreaks.length) {
    section.slideBreaks = pruned
  }
}

function isSlideBreak(section: LyricSection, k: number): boolean {
  return (section.slideBreaks ?? []).includes(k)
}

// R117: toggle the LINE index `k` (a break before `lines[k]`) in the section's
// `slideBreaks`, kept sorted and de-duped. Writing through `editableState` lets
// the existing single-write autosave (`doAutoSave`) persist it alongside
// `performanceOrder`. Removing the last break deletes the field so an unsplit
// section persists nothing new (BWC).
function toggleSlideBreak(sectionId: string, k: number) {
  const section = editableState.sections.find((s) => s.id === sectionId)
  if (!section) return
  const current = section.slideBreaks ?? []
  if (current.includes(k)) {
    const next = current.filter((b) => b !== k)
    if (next.length === 0) {
      delete section.slideBreaks
    } else {
      section.slideBreaks = next
    }
    return
  }
  section.slideBreaks = [...new Set([...current, k])].sort((a, b) => a - b)
}

/**
 * Finds the index in `performanceOrder` that produced `row` — the `row.occurrenceIndex`-th
 * occurrence of `row.sectionId`. Rows are keyed by (sectionId, occurrenceIndex), not a
 * stable order index, since `buildSectionRows` re-derives them every render.
 */
function orderIndexForRow(row: SectionRow): number {
  let seen = 0
  for (let i = 0; i < editableState.performanceOrder.length; i++) {
    if (editableState.performanceOrder[i] === row.sectionId) {
      if (seen === row.occurrenceIndex) return i
      seen++
    }
  }
  return -1
}

function expandRowKey(stableKey: string) {
  const next = new Set(expandedRowKeys.value)
  next.add(stableKey)
  expandedRowKeys.value = next
}

// See ADR-0079 (docs/adr/0079-a-stable-identity-per-performanceorder-slot-not-per-section.md)

function onDuplicate(row: SectionRow) {
  const index = orderIndexForRow(row)
  if (index === -1) return
  const wasExpanded = isExpanded(row)
  editableState.performanceOrder = duplicateRow(editableState.performanceOrder, index)

  // The duplicate is a NEW physical row (D-02: same words, but its own
  // reference into the order) — mint it a fresh slot id rather than
  // reusing `row`'s, so it can be independently reordered/removed without
  // dragging `row`'s expand state along with it.
  const nextSlotIds = [...orderSlotIds.value]
  nextSlotIds.splice(index + 1, 0, mintSlotId())
  orderSlotIds.value = nextSlotIds

  if (wasExpanded) {
    // The duplicate lands immediately after `row`, so it is the next
    // occurrence of the same section id. Look it up via buildSectionRows
    // rather than hand-assembling a rowKey, since the `#`-joined format is
    // an internal convention of songSectionOrder.ts.
    const newRows = buildSectionRows(editableState.sections, editableState.performanceOrder, orderSlotIds.value)
    const newRow = newRows.find(
      (r) => r.sectionId === row.sectionId && r.occurrenceIndex === row.occurrenceIndex + 1,
    )
    if (newRow) expandRowKey(newRow.stableKey)
  }
}

// Owner UAT: Remove no longer deletes on the first click. It opens a confirm
// dialog holding the row awaiting deletion; only `confirmRemove` runs the
// actual `onRemove` deletion below, so an accidental click can't drop a verse.
// A single `pendingRemove` serves every row — the dialog's confirm control is
// keyed by `pendingRemove.rowKey`.
const pendingRemove = ref<SectionRow | null>(null)
const removeCancelBtnRef = ref<HTMLButtonElement | null>(null)

function requestRemove(row: SectionRow) {
  pendingRemove.value = row
}

function cancelRemove() {
  pendingRemove.value = null
}

function confirmRemove() {
  const row = pendingRemove.value
  if (!row) return
  onRemove(row)
  pendingRemove.value = null
}

// Focus Cancel when the confirm opens — the safe default (RunControlView.vue's
// exit confirm does the same), so a stray Enter cancels rather than deletes.
watch(pendingRemove, async (row) => {
  if (!row) return
  await nextTick()
  removeCancelBtnRef.value?.focus()
})

function onRemove(row: SectionRow) {
  const index = orderIndexForRow(row)
  if (index === -1) return
  const result = removeRow(editableState.sections, editableState.performanceOrder, index)
  editableState.sections = result.sections
  editableState.performanceOrder = result.performanceOrder

  const nextSlotIds = [...orderSlotIds.value]
  nextSlotIds.splice(index, 1)
  orderSlotIds.value = nextSlotIds
}

function onAddSection(kind: string) {
  const result = addSection(editableState.sections, editableState.performanceOrder, kind)
  editableState.sections = result.sections
  editableState.performanceOrder = result.performanceOrder
  orderSlotIds.value = [...orderSlotIds.value, mintSlotId()]
  const newRows = buildSectionRows(editableState.sections, editableState.performanceOrder, orderSlotIds.value)
  const newRow = newRows.find((r) => r.sectionId === result.newSectionId)
  if (newRow) expandRowKey(newRow.stableKey)
}

// See .planning/codebase/STACK.md (§ Component & Composable Stack Notes (R318) -> src/components/SongLyricEditor.vue)
const rowsContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

watch(
  rowsContainerRef,
  (el) => {
    if (el && !sortableInstance) {
      sortableInstance = Sortable.create(el, {
        handle: '.drag-handle',
        draggable: '.section-row',
        animation: 150,
        ghostClass: 'opacity-30',
        onEnd(evt) {
          if (evt.oldIndex == null || evt.newIndex == null) return
          if (evt.oldIndex === evt.newIndex) return
          // T-28-19: revert SortableJS's own DOM move so Vue's reactive
          // render remains the single source of truth — the established
          // codebase remedy for the snap-back defect.
          const parent = evt.item.parentNode
          if (parent) {
            const ref = parent.children[evt.oldIndex]
            parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? (ref?.nextSibling ?? null) : (ref ?? null))
          }
          editableState.performanceOrder = moveRow(editableState.performanceOrder, evt.oldIndex, evt.newIndex)
          // See ADR-0079 (docs/adr/0079-a-stable-identity-per-performanceorder-slot-not-per-section.md)
          orderSlotIds.value = moveRow(orderSlotIds.value, evt.oldIndex, evt.newIndex)
        },
      })
    }
  },
  { flush: 'post' },
)

function destroySortable() {
  sortableInstance?.destroy()
  sortableInstance = null
}

function isExpanded(row: SectionRow): boolean {
  // See ADR-0079 (docs/adr/0079-a-stable-identity-per-performanceorder-slot-not-per-section.md)
  return expandedRowKeys.value.has(row.stableKey)
}

function toggleRow(stableKey: string) {
  const next = new Set(expandedRowKeys.value)
  if (next.has(stableKey)) {
    next.delete(stableKey)
  } else {
    next.add(stableKey)
  }
  expandedRowKeys.value = next
}

// R302 (105-UI-SPEC.md): the ONE predicate every blackout-row template
// branch above reads — a row is a blackout row iff its resolved section
// carries kind:'blackout' (minted by addSection('BLACKOUT')).
function isBlackout(row: SectionRow): boolean {
  return row.section.kind === 'blackout'
}

function previewText(section: LyricSection): string {
  return section.lines.join(' ').trim()
}

function lineCountLabel(section: LyricSection): string {
  const count = section.lines.length
  return `${count} line${count === 1 ? '' : 's'}`
}

// R336: inline manual editing over the copyright block. hasCredits is
// deliberately wider than the old ccliSongNumber-only gate so a manual entry
// of e.g. only copyrightLines still shows the read-only display.
const editingCredits = ref(false)
const hasCredits = computed(() => {
  const c = currentLyrics.value?.copyright
  if (!c) return false
  return !!(c.title || c.authors.length || c.ccliSongNumber || c.copyrightLines.length || c.ccliLicenseNumber)
})

const creditsForm = reactive({
  title: '',
  authorsText: '',
  ccliSongNumber: '',
  copyrightLinesText: '',
  ccliLicenseNumber: '',
})

function openCreditsEdit() {
  const c = currentLyrics.value?.copyright
  creditsForm.title = c?.title ?? ''
  creditsForm.authorsText = (c?.authors ?? []).join('\n')
  creditsForm.ccliSongNumber = c?.ccliSongNumber ?? ''
  creditsForm.copyrightLinesText = (c?.copyrightLines ?? []).join('\n')
  creditsForm.ccliLicenseNumber = c?.ccliLicenseNumber ?? ''
  editingCredits.value = true
}

function cancelCreditsEdit() {
  editingCredits.value = false
}

function parseCreditLines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
}

// Mirrors onSaveVersion's saveLyrics shape below — sections/performanceOrder
// pass through unchanged, so a credits save never re-parses the lyrics.
async function saveCreditsEdit() {
  const cur = currentLyrics.value
  if (!cur) return
  const edited: CopyrightInfo = {
    title: creditsForm.title.trim(),
    authors: parseCreditLines(creditsForm.authorsText),
    ccliSongNumber: creditsForm.ccliSongNumber.trim(),
    copyrightLines: parseCreditLines(creditsForm.copyrightLinesText),
    ccliLicenseNumber: creditsForm.ccliLicenseNumber.trim(),
  }
  await songLyricsStore.saveLyrics(props.orgId, props.songId, {
    sections: editableState.sections,
    copyright: edited,
    performanceOrder: editableState.performanceOrder,
  })
  editingCredits.value = false
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
  pasteMode.value = false
}

onMounted(() => {
  songLyricsStore.subscribeLyrics(props.orgId, props.songId)
})

onUnmounted(() => {
  cleanupAutoSave()
  if (surfaceId.value) saveStatus.clear(surfaceId.value)
  destroySortable()
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

// R117 split-divider styling — static, fully-spelled-out class maps (Tailwind
// v4 purges dynamically built names — see ROW_CARD_CLASSES rationale above).
const SPLIT_DIVIDER_CLASSES = {
  active: 'h-px flex-1 bg-indigo-500/70',
  inactive: 'h-px flex-1 bg-gray-800 group-hover:bg-indigo-700/50',
} as const

const SPLIT_LABEL_CLASSES = {
  active: 'shrink-0 rounded-full border border-indigo-500/60 bg-indigo-900/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-200',
  inactive: 'shrink-0 rounded-full border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-gray-500 opacity-70 transition-opacity group-hover:opacity-100',
} as const

function rowCardClass(row: SectionRow): string {
  const expanded = isExpanded(row)
  if (row.isRepeat) return expanded ? ROW_CARD_CLASSES.repeatExpanded : ROW_CARD_CLASSES.repeatCollapsed
  return expanded ? ROW_CARD_CLASSES.ordinaryExpanded : ROW_CARD_CLASSES.ordinaryCollapsed
}
</script>
