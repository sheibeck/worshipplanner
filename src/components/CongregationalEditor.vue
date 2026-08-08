<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
      <h3 class="text-sm font-semibold text-gray-100">Congregational Reading</h3>
      <button
        type="button"
        data-testid="congregational-close-btn"
        aria-label="Close"
        @click="onClose"
        class="text-gray-400 hover:text-gray-200 transition-colors rounded-md p-1"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Reference input + fetch -->
      <div class="flex gap-2">
        <input
          v-model="referenceText"
          type="text"
          data-testid="reference-input"
          placeholder="e.g. Psalm 136:1-9"
          class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          data-testid="fetch-btn"
          :disabled="!canFetch || isFetching"
          @click="onFetchPassage"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border"
          :class="canFetch && !isFetching
            ? 'text-indigo-400 bg-gray-800 border-gray-700 hover:bg-gray-700'
            : 'text-gray-600 bg-gray-900 border-gray-800 cursor-not-allowed'"
        >
          <svg v-if="isFetching" class="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ isFetching ? 'Fetching...' : 'Fetch Passage' }}
        </button>
        <button
          v-if="authStore.settings.aiEnabled"
          type="button"
          data-testid="ai-split-btn"
          :disabled="!canAiSplit || isSplitting"
          @click="onAiSplit"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border"
          :class="canAiSplit && !isSplitting
            ? 'text-indigo-400 bg-gray-800 border-gray-700 hover:bg-gray-700'
            : 'text-gray-600 bg-gray-900 border-gray-800 cursor-not-allowed'"
        >
          <svg v-if="isSplitting" class="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ isSplitting ? 'Splitting...' : 'Split with AI' }}
        </button>
      </div>

      <!-- Fetch error -->
      <div
        v-if="fetchError"
        data-testid="fetch-error"
        class="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1"
      >
        Could not load passage. Check your connection and try again.
      </div>

      <!-- Section assignment -->
      <div v-if="draftSections.length > 0" class="space-y-3" data-testid="sections-container">
        <div
          v-for="(section, idx) in draftSections"
          :key="idx"
          class="rounded-lg border p-4"
          :class="section.speaker === 'LEADER'
            ? 'bg-gray-800/50 border-indigo-700/50'
            : 'bg-gray-800/30 border-gray-700/50'"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-500" v-if="section.verseRange">
              {{ section.verseRange }}
            </span>
            <button
              type="button"
              :data-testid="`speaker-toggle-${idx}`"
              @click="toggleSpeaker(idx)"
              class="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors"
              :class="section.speaker === 'LEADER'
                ? 'text-indigo-300 bg-indigo-900/50'
                : 'text-amber-300 bg-amber-900/50'"
            >
              {{ section.speaker === 'LEADER' ? 'Leader' : 'Congregation' }}
            </button>
          </div>
          <p
            class="text-sm leading-relaxed"
            :class="section.speaker === 'LEADER'
              ? 'text-gray-100 font-semibold'
              : 'text-gray-300 font-normal pl-4'"
          >
            {{ section.text }}
          </p>
        </div>
      </div>

      <!-- Preview panel -->
      <div v-if="draftSections.length > 0" data-testid="preview-panel" class="mt-6 rounded-lg bg-gray-900/50 border border-gray-700/30 p-4">
        <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</h4>
        <div class="space-y-2">
          <div
            v-for="(section, idx) in draftSections"
            :key="`preview-${idx}`"
            :data-testid="`preview-section-${idx}`"
          >
            <span
              class="text-xs uppercase tracking-wider mr-2"
              :class="section.speaker === 'LEADER' ? 'text-indigo-400' : 'text-amber-400'"
              :data-testid="`preview-label-${idx}`"
            >
              {{ section.speaker === 'LEADER' ? 'Leader:' : 'Congregation:' }}
            </span>
            <span
              :class="section.speaker === 'LEADER'
                ? 'text-gray-100 font-semibold text-sm'
                : 'text-gray-300 font-normal text-sm pl-2'"
            >
              {{ section.text }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 34-06: this component is a controlled prop/emit component — it persists
// NOTHING itself. Under slot-as-source-of-truth (R064, see 34-05) the parent
// (34-07's ServiceEditorView modal) owns the ScriptureSlot write; this
// component's only job is to render a draft and report every change upward
// via `update:sections` / `update:reference`. It replaced the earlier model
// where this component wrote directly to a separate `ScriptureReading`
// Firestore document via `useScriptureSlides` — the model R047 rejected.
import { ref, computed } from 'vue'
import { parseScriptureInput, formatScriptureReference } from '@/utils/scripture'
import { fetchPassageText } from '@/utils/esvApi'
import { fetchNltPassageText } from '@/utils/nltApi'
import { splitPassage } from '@/utils/scriptureSplitter'
import { splitCongregationalReading } from '@/utils/claudeApi'
import { computeBoundaries, hasSplittableBoundaries } from '@/utils/scriptureBoundaries'
import { useToasts } from '@/stores/toasts'
import { useAuthStore } from '@/stores/auth'
import type { CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

const props = defineProps<{
  reference: ScriptureRef | null
  sections: CongregationalSection[]
}>()

const emit = defineEmits<{
  'update:sections': [sections: CongregationalSection[]]
  'update:reference': [reference: ScriptureRef]
  close: []
}>()

const toasts = useToasts()
const authStore = useAuthStore()

const referenceText = ref(props.reference ? formatScriptureReference(props.reference) : '')
const isFetching = ref(false)
const fetchError = ref(false)
// Seeded ONCE, as a shallow copy, from props.sections — never re-synced from
// a later prop change. The caller (34-07) must mount this component with a
// `:key` tied to whichever slot it is editing, exactly as the previous
// currentReadingId-driven contract required (WR-04, 34-PATTERNS.md).
const draftSections = ref<CongregationalSection[]>([...props.sections])
const parsedRef = computed<ScriptureRef | null>(() => parseScriptureInput(referenceText.value))
const canFetch = computed(() => parsedRef.value !== null)
// rawText is local-only state, never persisted anywhere (not even emitted).
// Re-opening the editor on a slot that already has sections therefore starts
// with rawText empty, so canAiSplit is false until the user clicks Fetch
// Passage again. Deliberate: storing a second copy of the ESV text alongside
// the section text that already contains it would duplicate data for no
// reason, and Fetch Passage sits directly next to Split with AI.
const rawText = ref('')
// 45-04 (R092): the church's bibleVersion setting captured ONCE at the
// moment of the last successful fetch — never re-read afterward. Both the
// alternating-assignment route (below, in the same fetch) and the AI-split
// route (onAiSplit, which transforms the SAME already-fetched rawText and
// never re-fetches) stamp their produced sections from this captured value,
// not from a fresh read of authStore.settings.bibleVersion. This is what
// makes "a later setting change does not restamp already-created sections"
// true even for a split triggered after the setting changes mid-session.
const lastFetchedVersion = ref<'ESV' | 'NLT' | null>(null)

function emitSections(): void {
  emit('update:sections', draftSections.value)
}

function buildAlternatingSections(
  text: string,
  scriptureRef: ScriptureRef,
  translationSource: 'ESV' | 'NLT',
): CongregationalSection[] {
  const slides = splitPassage(text, scriptureRef)
  return slides.map((slide, idx) => ({
    speaker: (idx % 2 === 0 ? 'LEADER' : 'CONGREGATION') as 'LEADER' | 'CONGREGATION',
    text: slide.text,
    verseRange: slide.verseRange,
    translationSource,
  }))
}

async function onFetchPassage() {
  const scriptureRef = parsedRef.value
  if (!scriptureRef) return

  isFetching.value = true
  fetchError.value = false

  const query = formatQuery(scriptureRef)
  // R090/R092: captured ONCE, right before the fetch it governs — routes the
  // fetch to the correct client AND is the exact value stamped onto every
  // section this fetch (and any AI-split derived from it) produces. Never
  // re-read authStore.settings.bibleVersion after this point for this fetch.
  const version = authStore.settings.bibleVersion

  try {
    const text = version === 'NLT' ? await fetchNltPassageText(query) : await fetchPassageText(query)
    rawText.value = text
    lastFetchedVersion.value = version
    // The reference the user actually fetched is what the sections belong
    // to — emit it first so the slot's own reference fields never end up
    // recording a different passage than the sections that follow.
    emit('update:reference', scriptureRef)
    draftSections.value = buildAlternatingSections(text, scriptureRef, version)
    emitSections()
  } catch {
    fetchError.value = true
  } finally {
    isFetching.value = false
  }
}

// 34-04: the opt-in "Split with AI" affordance. Additive only — it never
// runs automatically and never merges with the manual result; it either
// replaces `draftSections.value` wholesale on success or leaves it
// completely untouched and surfaces a failure toast. `canAiSplit` reuses
// 34-01's `hasSplittableBoundaries` so a passage with no legal internal
// division never offers (or is asked to attempt) a split. Reachable only
// from this control's click handler — never from a watcher or onMounted.
const isSplitting = ref(false)
const canAiSplit = computed(
  () => rawText.value.length > 0 && hasSplittableBoundaries(computeBoundaries(rawText.value)),
)

const AI_SPLIT_FAILURE_TEXT =
  "Couldn't split this passage — your reading is unchanged. Build it by hand or try again."

async function onAiSplit() {
  if (!canAiSplit.value || isSplitting.value) return
  isSplitting.value = true
  try {
    const result = await splitCongregationalReading(rawText.value)
    if (result) {
      // R092: stamp from the version captured at the ORIGINAL fetch that
      // produced rawText — never a fresh read of authStore.settings
      // .bibleVersion, which may have changed since that fetch. Falls back
      // to 'ESV' only in the defensive case where a split somehow runs
      // without a prior fetch (canAiSplit already guards rawText.value.length
      // > 0, so this fallback should be unreachable in practice).
      const translationSource = lastFetchedVersion.value ?? 'ESV'
      draftSections.value = result.map((section) => ({ ...section, translationSource }))
      emitSections()
    } else {
      toasts.push(AI_SPLIT_FAILURE_TEXT)
    }
  } catch {
    // R064 "additive and never blocking", in code: a failed split must leave
    // the editor exactly as usable as it was a moment before —
    // draftSections.value is left completely untouched (no clearing, no
    // placeholder, no partial array, no emission) and the only externally
    // visible effect of a failure is this one toast.
    toasts.push(AI_SPLIT_FAILURE_TEXT)
  } finally {
    isSplitting.value = false
  }
}

function toggleSpeaker(idx: number) {
  const section = draftSections.value[idx]
  if (!section) return
  draftSections.value[idx] = {
    ...section,
    speaker: section.speaker === 'LEADER' ? 'CONGREGATION' : 'LEADER',
  }
  emitSections()
}

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

function onClose(): void {
  emit('close')
}
</script>
