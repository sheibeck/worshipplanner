<template>
  <div
    class="flex shrink-0 items-center gap-2 border-b border-gray-800 px-4 py-3"
    data-testid="lyrics-paste-header"
  >
    <button
      type="button"
      data-testid="paste-back-btn"
      class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
      @click="onCancel"
    >&#8249; Back to sections</button>
    <h3 class="text-sm font-semibold text-gray-100">Paste lyrics</h3>
  </div>

  <div data-testid="paste-region" class="flex-1 min-h-0 flex flex-col">
    <p class="px-4 pt-3 pb-2 text-[11.5px] leading-[1.55] text-gray-500">
      Paste the whole song from SongSelect, a bulletin, anywhere. Put a section name on its own line —
      Chorus, Verse 2, Bridge, Tag — with its words underneath. Blank lines alone also split sections.
      Keep the CCLI / copyright block at the bottom — it prints small under the first and last slide.
    </p>

    <textarea
      v-model="rawText"
      data-testid="paste-textarea"
      placeholder="Paste lyrics from CCLI SongSelect..."
      class="mx-4 h-48 shrink-0 resize-none rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm leading-relaxed text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    ></textarea>

    <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
      <!-- No sections detected -->
      <p
        v-if="rawText.trim() && parsed.sections.length === 0"
        data-testid="paste-no-sections-warning"
        class="rounded-md border border-amber-800 bg-amber-950 px-4 py-2 text-sm text-amber-200"
      >No sections detected — check that you copied the full lyrics from SongSelect</p>

      <template v-else-if="rawText.trim()">
        <!-- Found-summary line -->
        <p data-testid="paste-summary-line" class="text-[11.5px] leading-relaxed text-gray-500">
          <span class="text-gray-500">We found</span>
          <span class="text-emerald-400">&#10003; {{ parsed.sections.length }} section{{ parsed.sections.length === 1 ? '' : 's' }}</span>
          <span> &middot; </span>
          <span v-if="parsed.copyright.ccliSongNumber" class="text-emerald-400">&#10003; copyright</span>
          <span v-else class="text-amber-400">&#9888; no copyright</span>
        </p>

        <!-- Section-detected chips -->
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(section, i) in parsed.sections"
            :key="section.id"
            :data-testid="`paste-section-chip-${i}`"
            class="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-800/60 bg-indigo-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300"
          >{{ i + 1 }} {{ section.label }}</span>
        </div>

        <!-- Missing-copyright warning (R065 — blocks unless overridden) -->
        <div
          v-if="!parsed.copyright.ccliSongNumber"
          data-testid="paste-copyright-warning"
          class="flex flex-col gap-2 rounded-md border border-amber-800 bg-amber-950 px-4 py-2"
        >
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 flex-none text-amber-400" aria-hidden="true">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.28 11.18c.75 1.334-.213 2.987-1.744 2.987H3.72c-1.53 0-2.493-1.653-1.744-2.987l6.28-11.18zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-semibold text-amber-200">No copyright information found</span>
          </div>
          <p class="text-sm leading-[1.5] text-amber-200/90">
            This song can't be saved without CCLI credits unless you check the box below. They're
            normally shown small under the first and last slide once added — copy the CCLI block from
            the bottom of the SongSelect page and paste it above, or check the box to save now and add
            credits later.
          </p>
          <label class="flex items-center gap-2 text-[11.5px] text-amber-300/90">
            <input
              type="checkbox"
              v-model="overrideCopyright"
              data-testid="paste-copyright-override"
              class="h-3.5 w-3.5 rounded border-amber-700 bg-amber-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            Add anyway — I'll enter credits later
          </label>
        </div>
      </template>

      <p v-else class="text-sm italic text-gray-500">Paste lyrics to see a preview</p>
    </div>

    <p v-if="pasteSaveError" data-testid="paste-save-error" class="px-4 pb-1 text-xs text-red-400">
      Couldn't save your changes. Your paste is still here — try again.
    </p>

    <div class="flex shrink-0 items-center gap-3 border-t border-gray-800 px-4 py-3">
      <span class="text-[11.5px] text-gray-500">Replaces the current {{ currentSectionCount }} section{{ currentSectionCount === 1 ? '' : 's' }} &middot; undoable from History.</span>
      <div class="ml-auto flex gap-2">
        <button
          type="button"
          data-testid="paste-cancel-btn"
          class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700"
          @click="onCancel"
        >Cancel</button>
        <button
          type="button"
          data-testid="paste-replace-btn"
          class="rounded-md px-3 py-1.5 text-sm font-semibold text-white transition-colors"
          :class="canConfirm ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-600/40 cursor-default text-white/50'"
          :disabled="!canConfirm || isSaving"
          @click="onConfirm"
        >{{ isSaving ? 'Saving...' : 'Replace lyrics' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { parseCCLIPaste } from '@/utils/ccliParser'
import { normalizeParsedSections } from '@/utils/songSectionOrder'
import { useSongLyricsStore } from '@/stores/songLyrics'

const props = defineProps<{
  songId: string
  orgId: string
  currentSectionCount: number
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const rawText = ref('')
const isSaving = ref(false)
const overrideCopyright = ref(false)
const pasteSaveError = ref(false)

const songLyricsStore = useSongLyricsStore()

const parsed = computed(() => parseCCLIPaste(rawText.value))

// R065: exactly three clauses — sections detected, AND (a CCLI number was
// parsed OR the override is checked), AND not currently saving. A fourth
// clause is the P-02 violation this component exists to prevent.
const canConfirm = computed(() =>
  parsed.value.sections.length > 0 &&
  (!!parsed.value.copyright.ccliSongNumber || overrideCopyright.value) &&
  !isSaving.value
)

async function onConfirm() {
  if (!canConfirm.value) return
  isSaving.value = true
  pasteSaveError.value = false
  try {
    const result = parsed.value
    // D006/D-02: fold repeated section markers into pool references before
    // saving, so a paste whose text names the same section twice stores one
    // canonical section referenced twice, not two copies. Single order write
    // to the lyrics document — R035/D-03 removed the Song-doc duplicate.
    const normalized = normalizeParsedSections(result)
    await songLyricsStore.saveLyrics(props.orgId, props.songId, {
      sections: normalized.sections,
      copyright: result.copyright,
      performanceOrder: normalized.performanceOrder,
    })
    emit('saved')
  } catch {
    // E4 error backstop: leave rawText intact so the user can retry without
    // re-pasting; render a visible error rather than silently swallowing it.
    pasteSaveError.value = true
  } finally {
    isSaving.value = false
  }
}

function onCancel() {
  if (rawText.value.trim()) {
    if (!window.confirm('You have unsaved changes. Discard them?')) return
  }
  emit('close')
}
</script>
