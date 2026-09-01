<template>
  <div class="flex flex-col gap-4">
    <!-- Fetch error notice + retry -->
    <div
      v-if="fetchError"
      data-testid="fetch-error"
      class="flex items-center justify-between gap-3 text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-3 py-2"
    >
      <span>Couldn't load the passage. Type it in below, or try again.</span>
      <button
        type="button"
        data-testid="fetch-retry"
        @click="autoFetch"
        class="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold border border-red-700 text-red-200 hover:bg-red-900/40 transition-colors"
      >
        Try again
      </button>
    </div>

    <!-- Bible API off: manual fallback (R298 deep-link). Rendered ONLY when
         the org's Bible API is disabled. The "Split with AI" button below
         stays gated ONLY on authStore.isAiEnabled -- NEVER on this gate --
         so Bible-off + AI-on still splits whatever is typed into the main
         textarea below, and Bible-off + AI-off still allows composing the
         reading by hand there. The paste-a-passage textarea (R299) was
         removed per owner direction (v2.6 Phase-103 follow-up): congregational
         readings are now composed directly in the existing bottom format
         textarea, which can be pasted into normally. -->
    <div v-if="!authStore.isBibleApiEnabled" class="space-y-2">
      <a
        v-if="props.reference"
        :href="fallbackBibleGatewayLink"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Open in BibleGateway
      </a>
    </div>

    <!-- Helper line -->
    <p class="text-xs text-gray-400 leading-relaxed">
      Separate slides with a line containing only <code class="text-gray-200">---</code>. Put the
      speaker (Leader, Congregation, or All) on its own line above each slide's text.
    </p>

    <!-- Toolbar -->
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        data-testid="insert-new-slide"
        @click="insertAtCursor('\n---\n')"
        class="rounded-md px-2.5 py-1.5 text-xs font-semibold border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors"
      >
        New Slide
      </button>
      <button
        type="button"
        data-testid="insert-leader"
        @click="insertAtCursor('Leader\n')"
        class="rounded-md px-2.5 py-1.5 text-xs font-semibold border border-gray-700 bg-gray-800 text-sky-300 hover:bg-gray-700 transition-colors"
      >
        Leader
      </button>
      <button
        type="button"
        data-testid="insert-congregation"
        @click="insertAtCursor('Congregation\n')"
        class="rounded-md px-2.5 py-1.5 text-xs font-semibold border border-gray-700 bg-gray-800 text-amber-300 hover:bg-gray-700 transition-colors"
      >
        Congregation
      </button>
      <button
        type="button"
        data-testid="insert-all"
        @click="insertAtCursor('All\n')"
        class="rounded-md px-2.5 py-1.5 text-xs font-semibold border border-gray-700 bg-gray-800 text-violet-300 hover:bg-gray-700 transition-colors"
      >
        All
      </button>
      <button
        v-if="authStore.isAiEnabled"
        type="button"
        data-testid="ai-split-btn"
        :disabled="isFetching || isSplitting || !hasPassageToSplit"
        @click="onAiSplit"
        class="rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-colors"
        :class="!isFetching && !isSplitting && hasPassageToSplit
          ? 'border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700'
          : 'border-gray-800 bg-gray-900 text-gray-600 cursor-not-allowed'"
      >
        {{ isSplitting ? 'Splitting…' : '✨ Split with AI' }}
      </button>
    </div>

    <!-- Textarea -->
    <textarea
      ref="textareaRef"
      v-model="text"
      data-testid="congregational-textarea"
      rows="14"
      :placeholder="isFetching ? 'Loading passage…' : 'Leader\nHow lonely sits the city…\n---\nCongregation\nShe weeps bitterly…'"
      class="w-full min-h-[20rem] rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
    ></textarea>

    <!-- Delete confirm -->
    <div
      v-if="showDeleteConfirm"
      data-testid="congregational-delete-confirm"
      class="rounded-md border border-red-800/50 bg-red-950/30 p-3 space-y-2"
    >
      <p class="text-sm text-gray-100">
        Delete this congregational reading? It will revert to a plain scripture reference slide.
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          data-testid="congregational-delete-confirm-yes"
          @click="onDeleteConfirm"
          class="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
          Delete
        </button>
        <button
          type="button"
          data-testid="congregational-delete-confirm-cancel"
          @click="showDeleteConfirm = false"
          class="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="flex items-center justify-between gap-3 pt-1">
      <button
        type="button"
        data-testid="congregational-delete"
        @click="showDeleteConfirm = true"
        class="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
      >
        Delete reading
      </button>
      <button
        type="button"
        data-testid="congregational-save"
        @click="onSave"
        class="rounded-md px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        Save
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Textarea-based congregational-reading editor (supersedes Phase 47's
// See ADR-0063 (docs/adr/0063-click-between-verses-divider-ux-per-direct-owner-feedback-th.md)
// R096 (AI split): the AI split is now a textarea-fill button (aiEnabled-
// gated). It fills the textarea with the split reading; nothing is committed
// until Save. A failed split leaves the textarea untouched and surfaces a
// toast.
import { ref, computed, onMounted } from 'vue'
import { fetchScriptureText } from '@/utils/scriptureApi'
import { bibleGatewayLink } from '@/utils/scripture'
import { stripVerseMarkers } from '@/utils/scriptureBoundaries'
import { splitCongregationalReading } from '@/utils/claudeApi'
import {
  parseCongregationalText,
  serializeCongregationalSections,
} from '@/utils/congregationalText'
import { useToasts } from '@/stores/toasts'
import { useAuthStore } from '@/stores/auth'
import type { CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

const props = defineProps<{
  reference: ScriptureRef | null
  sections: CongregationalSection[]
  /**
   * R128 (Phase 56): optional per-item Bible-version override. When present it
   * governs the split-time passage fetch AND the stamped `translationSource`;
   * absent => the org default (`authStore.settings.bibleVersion`), reproducing
   * today's routing and provenance exactly.
   */
  bibleVersion?: 'ESV' | 'NLT'
}>()

const emit = defineEmits<{
  'update:sections': [sections: CongregationalSection[]]
  delete: []
  close: []
}>()

const toasts = useToasts()
const authStore = useAuthStore()

const text = ref('')
const isFetching = ref(false)
const fetchError = ref(false)
// R092: captured ONCE (see file header) — never re-read after.
const capturedVersion = ref<'ESV' | 'NLT' | null>(null)
// The fetched passage with verse markers stripped — the plain-text input for
// the AI split.
const rawPassage = ref('')
const isSplitting = ref(false)
const showDeleteConfirm = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const AI_SPLIT_FAILURE_TEXT =
  "Couldn't split this passage — your reading is unchanged. Build it by hand or try again."

const hasPassageToSplit = computed(() => {
  if (rawPassage.value.trim().length > 0) return true
  return parseCongregationalText(text.value).some((s) => s.text.trim().length > 0)
})

onMounted(() => {
  if (props.sections.length > 0) {
    text.value = serializeCongregationalSections(props.sections)
    capturedVersion.value = props.sections[0]!.translationSource ?? null
    rawPassage.value = props.sections.map((s) => s.text).join(' ')
    return
  }
  void autoFetch()
})

// R298: manual-fallback deep-link, shown only when the org's Bible API is
// off. Version resolution matches autoFetch's exactly (per-item override
// wins over the org default) so the link and the fetch it stands in for
// never disagree about which translation is "the" version.
const fallbackBibleGatewayLink = computed(() => {
  if (!props.reference) return ''
  const version = props.bibleVersion ?? authStore.settings.bibleVersion
  return bibleGatewayLink(props.reference, version ?? undefined)
})

function formatQuery(scriptureRef: ScriptureRef): string {
  const base = `${scriptureRef.book} ${scriptureRef.chapter}`
  if (scriptureRef.verseStart != null && scriptureRef.verseEnd != null) {
    return `${base}:${scriptureRef.verseStart}-${scriptureRef.verseEnd}`
  }
  if (scriptureRef.verseStart != null) {
    return `${base}:${scriptureRef.verseStart}`
  }
  return base
}

async function autoFetch(): Promise<void> {
  const scriptureRef = props.reference
  if (!scriptureRef) {
    fetchError.value = true
    return
  }
  isFetching.value = true
  fetchError.value = false
  // R090/R092: captured ONCE, right before the fetch it governs.
  // R128 (Phase 56): the per-item override wins over the org default; absent
  // prop reproduces today's org-default fetch AND stamped provenance.
  const version = props.bibleVersion ?? authStore.settings.bibleVersion
  const query = formatQuery(scriptureRef)
  try {
    const result = await fetchScriptureText(query, version)
    if (result.status === 'ok') {
      const stripped = stripVerseMarkers(result.text)
      rawPassage.value = stripped
      capturedVersion.value = version ?? null
      text.value = `Leader\n${stripped}`
    } else if (result.status === 'error') {
      fetchError.value = true
    }
    // 'disabled' (Phase 102, R297): silent no-op — no fetch was attempted, no
    // fetchError shown; the textarea/rawPassage stay untouched and the
    // component remains functional for manual entry via the main textarea.
    // The BibleGateway deep-link fallback UI (R298) is attached above.
  } catch {
    // See ADR-0064 (docs/adr/0064-the-refactor-to-status-branching-dropped-the-generic-catch-l.md)
    fetchError.value = true
  } finally {
    isFetching.value = false
  }
}

function insertAtCursor(snippet: string): void {
  const el = textareaRef.value
  if (!el) {
    text.value += snippet
    return
  }
  // Insert via setRangeText rather than replacing the whole textarea value
  // through v-model. A full-value reassignment resets the caret to the end and
  // scrolls the textarea to the bottom (the reported bug) before we can restore
  // the caret; setRangeText edits in place, preserves the surrounding scroll
  // position, and (selectMode 'end') leaves the caret right after the snippet.
  el.focus()
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  if (typeof el.setRangeText === 'function') {
    el.setRangeText(snippet, start, end, 'end')
    // setRangeText does not emit an `input` event, so sync the v-model ref by hand.
    text.value = el.value
  } else {
    // Fallback for environments without setRangeText.
    text.value = text.value.slice(0, start) + snippet + text.value.slice(end)
    const caret = start + snippet.length
    el.setSelectionRange(caret, caret)
  }
}

async function onAiSplit(): Promise<void> {
  if (isFetching.value || isSplitting.value || !hasPassageToSplit.value) return
  const plainPassage =
    rawPassage.value.trim().length > 0
      ? rawPassage.value
      : parseCongregationalText(text.value)
          .map((s) => s.text)
          .join(' ')
  isSplitting.value = true
  try {
    const result = await splitCongregationalReading(plainPassage)
    if (!result) {
      toasts.push(AI_SPLIT_FAILURE_TEXT)
      return
    }
    // See ADR-0065 (docs/adr/0065-same-guard-as-onaisplit-s-stampversion-the-per-item-override.md)
    const stampVersion =
      capturedVersion.value ?? (authStore.isBibleApiEnabled ? authStore.settings.bibleVersion : null)
    const stamped: CongregationalSection[] = result.map((section) => ({
      speaker: section.speaker,
      text: section.text,
      ...(stampVersion ? { translationSource: stampVersion } : {}),
    }))
    text.value = serializeCongregationalSections(stamped)
  } catch {
    toasts.push(AI_SPLIT_FAILURE_TEXT)
  } finally {
    isSplitting.value = false
  }
}

function onSave(): void {
  // See ADR-0065 (docs/adr/0065-same-guard-as-onaisplit-s-stampversion-the-per-item-override.md)
  const version =
    capturedVersion.value ??
    props.bibleVersion ??
    (authStore.isBibleApiEnabled ? authStore.settings.bibleVersion : null)
  emit('update:sections', parseCongregationalText(text.value, version ?? undefined))
  emit('close')
}

function onDeleteConfirm(): void {
  emit('delete')
  emit('close')
}
</script>
