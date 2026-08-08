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
      </div>

      <!-- Fetch error -->
      <div
        v-if="fetchError"
        data-testid="fetch-error"
        class="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1"
      >
        Could not load passage. Check your connection and try again.
      </div>

      <!-- Seed row: three equally-weighted starting points (R096). Shown
           only once a passage has been fetched this session — before that,
           the empty state (reference input + Fetch Passage) IS the whole
           surface (UI-SPEC "empty" row). -->
      <div v-if="isBoundaryMode" class="space-y-2">
        <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Choose a starting point</h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="authStore.settings.aiEnabled"
            type="button"
            data-testid="ai-split-btn"
            :disabled="!canAiSplit || isSplitting"
            @click="onSeedClick('ai')"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold border transition-colors"
            :class="canAiSplit && !isSplitting
              ? 'text-gray-200 bg-gray-800 border-gray-700 hover:bg-gray-700'
              : 'text-gray-600 bg-gray-900 border-gray-800 cursor-not-allowed'"
          >
            <svg v-if="isSplitting" class="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ isSplitting ? 'Splitting...' : '✨ Split with AI' }}
          </button>
          <button
            type="button"
            data-testid="seed-alternate-btn"
            @click="onSeedClick('alternate')"
            class="rounded-md px-3 py-2 text-xs font-semibold border text-gray-200 bg-gray-800 border-gray-700 hover:bg-gray-700 transition-colors"
          >
            Alternate Leader/Congregation
          </button>
          <button
            type="button"
            data-testid="seed-blank-btn"
            @click="onSeedClick('blank')"
            class="rounded-md px-3 py-2 text-xs font-semibold border text-gray-200 bg-gray-800 border-gray-700 hover:bg-gray-700 transition-colors"
          >
            Start Blank
          </button>
        </div>

        <!-- Re-seed confirm: only shown once the draft has been hand-edited
             (hasManuallyEdited). The first seed on a fresh/unedited draft
             applies immediately with no confirm — there is nothing to lose. -->
        <div
          v-if="pendingSeed"
          data-testid="reseed-confirm"
          class="rounded-md border border-red-800/50 bg-red-950/30 p-3 space-y-2"
        >
          <p class="text-sm font-semibold text-gray-100">Replace your dividers?</p>
          <p class="text-xs text-gray-400">
            Choosing a new starting point replaces your current dividers and labels. This can't be undone.
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              data-testid="reseed-confirm-replace"
              @click="confirmReseed"
              class="rounded-md px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              data-testid="reseed-confirm-cancel"
              @click="cancelReseed"
              class="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Section assignment: boundary-indexed draft (after a fetch). Gap-+
           affordances sit at every legal boundary (computeBoundaries) that
           is not already a divider; a remove control sits at every existing
           divider between two segments. -->
      <div v-if="isBoundaryMode && draft.length > 0" data-testid="sections-container">
        <template v-for="(section, idx) in draft" :key="idx">
          <button
            v-for="gap in interiorGaps(section)"
            :key="`gap-${gap}`"
            type="button"
            :data-testid="`divider-insert-${gap}`"
            aria-label="Insert divider here"
            @click="insertDivider(gap)"
            class="group relative flex w-full items-center justify-center h-4 min-h-11 md:min-h-4"
          >
            <span class="w-full border-t border-dashed border-gray-700"></span>
            <span
              class="absolute rounded-full h-6 w-6 flex items-center justify-center bg-gray-800 border border-gray-600 text-gray-300 opacity-40 md:opacity-0 md:group-hover:opacity-100 md:group-focus:opacity-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-opacity"
            >
              +
            </span>
          </button>

          <div
            class="rounded-lg border-y border-r border-gray-700/50 bg-gray-800/40 border-l-4 p-4"
            :class="segmentBorderClass(section.speaker)"
          >
            <div class="flex items-center justify-between mb-2 gap-2">
              <span class="text-xs text-gray-500" v-if="congregationalSections[idx]?.verseRange">
                {{ congregationalSections[idx]?.verseRange }}
              </span>
              <div :data-testid="`speaker-chip-${idx}`" class="inline-flex rounded-md border border-gray-700 bg-gray-900 p-0.5">
                <button
                  type="button"
                  :data-testid="`speaker-chip-${idx}-leader`"
                  aria-label="Leader"
                  @click="setSpeaker(idx, 'LEADER')"
                  class="h-10 px-2.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors"
                  :class="section.speaker === 'LEADER' ? 'text-sky-300 bg-sky-900/50' : 'text-gray-500 hover:text-gray-300'"
                >
                  Leader
                </button>
                <button
                  type="button"
                  :data-testid="`speaker-chip-${idx}-congregation`"
                  aria-label="Congregation"
                  @click="setSpeaker(idx, 'CONGREGATION')"
                  class="h-10 px-2.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors"
                  :class="section.speaker === 'CONGREGATION' ? 'text-amber-300 bg-amber-900/50' : 'text-gray-500 hover:text-gray-300'"
                >
                  Congregation
                </button>
                <button
                  type="button"
                  :data-testid="`speaker-chip-${idx}-all`"
                  aria-label="All"
                  @click="setSpeaker(idx, 'ALL')"
                  class="h-10 px-2.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors"
                  :class="section.speaker === 'ALL' ? 'text-violet-300 bg-violet-900/50' : 'text-gray-500 hover:text-gray-300'"
                >
                  All
                </button>
              </div>
            </div>
            <p class="text-sm text-gray-100 leading-relaxed">{{ congregationalSections[idx]?.text }}</p>
          </div>

          <button
            v-if="idx < draft.length - 1"
            type="button"
            :data-testid="`divider-remove-${section.endBoundary}`"
            aria-label="Remove divider"
            @click="removeDivider(section.endBoundary)"
            class="group relative flex w-full items-center justify-center h-4 min-h-11 md:min-h-4"
          >
            <span class="w-full border-t border-gray-600"></span>
            <span
              class="absolute rounded-full h-6 w-6 flex items-center justify-center bg-gray-800 border border-gray-600 text-gray-300 opacity-40 md:opacity-0 md:group-hover:opacity-100 md:group-focus:opacity-100 hover:bg-red-900/40 hover:text-red-300 transition-opacity"
            >
              &minus;
            </span>
          </button>
        </template>
      </div>

      <!-- Section assignment: legacy mounted sections. rawText is fetch-only
           (never persisted, see below) — reopening the editor on a slot that
           already has sections starts with no boundaries to divide against,
           same limitation as before this phase. The 3-way chip still works
           (pure relabeling, no dependency on boundaries). -->
      <div v-else-if="!isBoundaryMode && mountedSections.length > 0" class="space-y-3" data-testid="sections-container">
        <div
          v-for="(section, idx) in mountedSections"
          :key="idx"
          class="rounded-lg border-y border-r border-gray-700/50 bg-gray-800/40 border-l-4 p-4"
          :class="segmentBorderClass(section.speaker)"
        >
          <div class="flex items-center justify-between mb-2 gap-2">
            <span class="text-xs text-gray-500" v-if="section.verseRange">{{ section.verseRange }}</span>
            <div :data-testid="`speaker-chip-${idx}`" class="inline-flex rounded-md border border-gray-700 bg-gray-900 p-0.5">
              <button
                type="button"
                :data-testid="`speaker-chip-${idx}-leader`"
                aria-label="Leader"
                @click="setSpeaker(idx, 'LEADER')"
                class="h-10 px-2.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors"
                :class="section.speaker === 'LEADER' ? 'text-sky-300 bg-sky-900/50' : 'text-gray-500 hover:text-gray-300'"
              >
                Leader
              </button>
              <button
                type="button"
                :data-testid="`speaker-chip-${idx}-congregation`"
                aria-label="Congregation"
                @click="setSpeaker(idx, 'CONGREGATION')"
                class="h-10 px-2.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors"
                :class="section.speaker === 'CONGREGATION' ? 'text-amber-300 bg-amber-900/50' : 'text-gray-500 hover:text-gray-300'"
              >
                Congregation
              </button>
              <button
                type="button"
                :data-testid="`speaker-chip-${idx}-all`"
                aria-label="All"
                @click="setSpeaker(idx, 'ALL')"
                class="h-10 px-2.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors"
                :class="section.speaker === 'ALL' ? 'text-violet-300 bg-violet-900/50' : 'text-gray-500 hover:text-gray-300'"
              >
                All
              </button>
            </div>
          </div>
          <p class="text-sm text-gray-100 leading-relaxed">{{ section.text }}</p>
        </div>
      </div>

      <!-- Preview panel -->
      <div v-if="displaySegments.length > 0" data-testid="preview-panel" class="mt-6 rounded-lg bg-gray-900/50 border border-gray-700/30 p-4">
        <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</h4>
        <div class="space-y-2">
          <div
            v-for="(section, idx) in displaySegments"
            :key="`preview-${idx}`"
            :data-testid="`preview-section-${idx}`"
          >
            <span
              class="text-xs uppercase tracking-wider mr-2"
              :class="previewLabelClass(section.speaker)"
              :data-testid="`preview-label-${idx}`"
            >
              {{ previewLabel(section.speaker) }}
            </span>
            <span class="text-gray-100 font-normal text-sm">{{ section.text }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 34-06 / 47-02: this component is a controlled prop/emit component — it
// persists NOTHING itself. Under slot-as-source-of-truth (R064, see 34-05)
// the parent (34-07's ServiceEditorView modal) owns the ScriptureSlot write;
// this component's only job is to render a draft and report every change
// upward via `update:sections` / `update:reference`.
//
// 47-02 (R095/R096) reworked the internal model from a flat
// `CongregationalSection[]` draft into a boundary-indexed one: `draft` is an
// array of `{ speaker, startBoundary, endBoundary }` indexing into `boundaries
// = computeBoundaries(rawText)`, computed exactly ONCE per fetch (RESEARCH
// Pitfall 1). `CongregationalSection[]` — what actually gets emitted — is a
// pure, derived projection of `draft` via `sliceAtBoundaries` +
// `stripVerseMarkers` + `verseRangeForSlice` (the codebase's existing
// "encoding backstop", reused verbatim, never reimplemented).
//
// Fetch no longer auto-commits a split (R096): it renders one undivided
// Leader block, and the user picks one of three equal seeds (AI / Alternate
// / Blank) or hand-divides directly. All three seeds resolve to the SAME
// boundary-indexed shape via `alignSegmentsToBoundaries` below, so an
// AI-seeded segment is exactly as re-divisible as an Alternate/Blank one.
import { ref, computed } from 'vue'
import { parseScriptureInput, formatScriptureReference } from '@/utils/scripture'
import { fetchPassageText } from '@/utils/esvApi'
import { fetchNltPassageText } from '@/utils/nltApi'
import { splitPassage, splitPerVerse } from '@/utils/scriptureSplitter'
import { splitCongregationalReading } from '@/utils/claudeApi'
import {
  computeBoundaries,
  hasSplittableBoundaries,
  sliceAtBoundaries,
  stripVerseMarkers,
  verseRangeForSlice,
} from '@/utils/scriptureBoundaries'
import { useToasts } from '@/stores/toasts'
import { useAuthStore } from '@/stores/auth'
import type { CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

type DraftSpeaker = 'LEADER' | 'CONGREGATION' | 'ALL'
type SeedKind = 'ai' | 'alternate' | 'blank'

interface DraftSection {
  speaker: DraftSpeaker
  startBoundary: number
  endBoundary: number
}

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
// a later prop change (34-06/WR-04 discipline). Rendered only until the
// first fetch of THIS session; a fetch fully replaces the editing surface
// with the boundary-indexed `draft` below, same as the pre-47-02 component.
const mountedSections = ref<CongregationalSection[]>([...props.sections])

// rawText/boundaries are local-only state, never persisted anywhere (not
// even emitted). Re-opening the editor on a slot that already has sections
// therefore starts with rawText empty, so `isBoundaryMode`/`canAiSplit` stay
// false until Fetch Passage runs again.
const rawText = ref('')
const boundaries = ref<number[]>([])
const fetchedRef = ref<ScriptureRef | null>(null)
// 45-04 (R092): the church's bibleVersion setting captured ONCE at the
// moment of the last successful fetch — never re-read afterward. Every seed
// and every subsequent divider/chip edit stamps from this captured value,
// not from a fresh read of authStore.settings.bibleVersion.
const lastFetchedVersion = ref<'ESV' | 'NLT' | null>(null)

const draft = ref<DraftSection[]>([])
// Set true on any divider insert/remove or chip change; reset to false
// immediately after a seed is freshly applied (or after a fresh fetch).
// Gates the re-seed confirm: the first seed pick on an unedited draft
// applies immediately, since there is nothing to lose yet.
const hasManuallyEdited = ref(false)
const pendingSeed = ref<SeedKind | null>(null)

const parsedRef = computed<ScriptureRef | null>(() => parseScriptureInput(referenceText.value))
const canFetch = computed(() => parsedRef.value !== null)
// True once a passage has been fetched this session — independent of
// whether that passage has any internal boundary at all (RESEARCH Pitfall
// 3: a single-verse fetch must still render as one undivided block).
const isBoundaryMode = computed(() => rawText.value.length > 0)

// Scoped ONLY to the AI seed button's enabled state — never used to gate the
// divider UI's existence (Pitfall 3).
const canAiSplit = computed(
  () => rawText.value.length > 0 && hasSplittableBoundaries(boundaries.value),
)

const AI_SPLIT_FAILURE_TEXT =
  "Couldn't split this passage — your reading is unchanged. Build it by hand or try again."

// The single derived, display/emit-time projection of the boundary-indexed
// draft (RESEARCH Pattern 1). Recomputed reactively from `draft` /
// `boundaries` / `rawText` — never the other way around.
const congregationalSections = computed<CongregationalSection[]>(() => {
  return draft.value.map(({ speaker, startBoundary, endBoundary }) => {
    const slice = sliceAtBoundaries(rawText.value, boundaries.value, startBoundary, endBoundary)
    const section: CongregationalSection = {
      speaker,
      text: stripVerseMarkers(slice),
      verseRange: verseRangeForSlice(slice),
    }
    if (lastFetchedVersion.value) section.translationSource = lastFetchedVersion.value
    return section
  })
})

// Unifies the two render surfaces (boundary-indexed draft vs. legacy
// mounted-sections) for the read-only preview panel, which is otherwise
// identical either way.
const displaySegments = computed<CongregationalSection[]>(() =>
  isBoundaryMode.value ? congregationalSections.value : mountedSections.value,
)

function emitSections(): void {
  emit(
    'update:sections',
    isBoundaryMode.value ? congregationalSections.value : mountedSections.value,
  )
}

/**
 * RESEARCH Pitfall 2's fix. Walks `boundaries` forward from `cursor`,
 * growing the candidate end index until the resulting slice — sliced and
 * stripped by the SAME `sliceAtBoundaries` + `stripVerseMarkers` pipeline
 * every other path in this file uses — is byte-identical to `segment.text`.
 * Every seed's text (AI, Alternate, Blank) is produced by that identical
 * pipeline (Blank via `splitPerVerse`, Alternate via `splitPassage`, AI via
 * the already-validated `splitCongregationalReading` reply), so an exact
 * match always exists; this loop is a search for WHERE it is, never a
 * repair for when it isn't. This is what lets every seed — including the AI
 * seed — produce a boundary-indexed draft that stays re-divisible.
 */
function alignSegmentsToBoundaries(
  segments: { speaker: DraftSpeaker; text: string }[],
): DraftSection[] {
  const maxIndex = boundaries.value.length - 1
  const result: DraftSection[] = []
  let cursor = 0
  for (const segment of segments) {
    let end = cursor + 1
    while (end < maxIndex) {
      const candidate = stripVerseMarkers(
        sliceAtBoundaries(rawText.value, boundaries.value, cursor, end),
      )
      if (candidate === segment.text) break
      end++
    }
    result.push({ speaker: segment.speaker, startBoundary: cursor, endBoundary: end })
    cursor = end
  }
  return result
}

function buildAlternateSegments(): { speaker: DraftSpeaker; text: string }[] {
  if (!fetchedRef.value) return []
  return splitPassage(rawText.value, fetchedRef.value).map((slide, idx) => ({
    speaker: (idx % 2 === 0 ? 'LEADER' : 'CONGREGATION') as DraftSpeaker,
    text: slide.text,
  }))
}

function buildBlankSegments(): { speaker: DraftSpeaker; text: string }[] {
  return splitPerVerse(rawText.value).map((verse) => ({
    speaker: 'LEADER' as DraftSpeaker,
    text: verse.text,
  }))
}

function applyAlternateSeed(): void {
  draft.value = alignSegmentsToBoundaries(buildAlternateSegments())
  hasManuallyEdited.value = false
  emitSections()
}

function applyBlankSeed(): void {
  draft.value = alignSegmentsToBoundaries(buildBlankSegments())
  hasManuallyEdited.value = false
  emitSections()
}

async function applyAiSeed(): Promise<void> {
  if (!canAiSplit.value || isSplitting.value) return
  isSplitting.value = true
  try {
    const result = await splitCongregationalReading(rawText.value)
    if (result) {
      draft.value = alignSegmentsToBoundaries(
        result.map((section) => ({ speaker: section.speaker, text: section.text })),
      )
      hasManuallyEdited.value = false
      emitSections()
    } else {
      // R064 "additive and never blocking": a failed split leaves the
      // editor exactly as usable as it was a moment before — the draft is
      // left completely untouched (no clearing, no partial array, no
      // emission) and the only externally visible effect is this toast.
      toasts.push(AI_SPLIT_FAILURE_TEXT)
    }
  } catch {
    toasts.push(AI_SPLIT_FAILURE_TEXT)
  } finally {
    isSplitting.value = false
  }
}

async function performSeed(kind: SeedKind): Promise<void> {
  if (kind === 'alternate') applyAlternateSeed()
  else if (kind === 'blank') applyBlankSeed()
  else await applyAiSeed()
}

function onSeedClick(kind: SeedKind): void {
  if (kind === 'ai' && (!canAiSplit.value || isSplitting.value)) return
  if (hasManuallyEdited.value) {
    pendingSeed.value = kind
    return
  }
  void performSeed(kind)
}

function confirmReseed(): void {
  const kind = pendingSeed.value
  pendingSeed.value = null
  if (kind) void performSeed(kind)
}

function cancelReseed(): void {
  pendingSeed.value = null
}

/** Every boundary index strictly between a segment's own start and end —
 * legal gap-+ insert points that are not already a divider. */
function interiorGaps(section: DraftSection): number[] {
  const gaps: number[] = []
  for (let b = section.startBoundary + 1; b < section.endBoundary; b++) gaps.push(b)
  return gaps
}

function insertDivider(boundaryIndex: number): void {
  const idx = draft.value.findIndex(
    (seg) => seg.startBoundary < boundaryIndex && boundaryIndex < seg.endBoundary,
  )
  if (idx === -1) return
  const seg = draft.value[idx]!
  const next = [...draft.value]
  next.splice(
    idx,
    1,
    { speaker: seg.speaker, startBoundary: seg.startBoundary, endBoundary: boundaryIndex },
    { speaker: seg.speaker, startBoundary: boundaryIndex, endBoundary: seg.endBoundary },
  )
  draft.value = next
  hasManuallyEdited.value = true
  emitSections()
}

function removeDivider(boundaryIndex: number): void {
  const idx = draft.value.findIndex((seg) => seg.endBoundary === boundaryIndex)
  if (idx === -1 || idx === draft.value.length - 1) return
  const a = draft.value[idx]!
  const b = draft.value[idx + 1]!
  if (b.startBoundary !== boundaryIndex) return
  const next = [...draft.value]
  next.splice(idx, 2, {
    speaker: a.speaker,
    startBoundary: a.startBoundary,
    endBoundary: b.endBoundary,
  })
  draft.value = next
  hasManuallyEdited.value = true
  emitSections()
}

function setSpeaker(idx: number, speaker: DraftSpeaker): void {
  if (isBoundaryMode.value) {
    const seg = draft.value[idx]
    if (!seg) return
    const next = [...draft.value]
    next[idx] = { ...seg, speaker }
    draft.value = next
  } else {
    const section = mountedSections.value[idx]
    if (!section) return
    const next = [...mountedSections.value]
    next[idx] = { ...section, speaker }
    mountedSections.value = next
  }
  hasManuallyEdited.value = true
  emitSections()
}

const isSplitting = ref(false)

async function onFetchPassage() {
  const scriptureRef = parsedRef.value
  if (!scriptureRef) return

  isFetching.value = true
  fetchError.value = false

  const query = formatQuery(scriptureRef)
  // R090/R092: captured ONCE, right before the fetch it governs.
  const version = authStore.settings.bibleVersion

  try {
    const text = version === 'NLT' ? await fetchNltPassageText(query) : await fetchPassageText(query)
    rawText.value = text
    boundaries.value = computeBoundaries(text)
    lastFetchedVersion.value = version
    fetchedRef.value = scriptureRef
    // The reference the user actually fetched is what the sections belong
    // to — emit it first so the slot's own reference fields never end up
    // recording a different passage than the sections that follow.
    emit('update:reference', scriptureRef)
    // R096: fetch renders the passage as ONE undivided Leader block — it no
    // longer auto-commits any split. The user picks a seed next.
    draft.value = [{ speaker: 'LEADER', startBoundary: 0, endBoundary: boundaries.value.length - 1 }]
    hasManuallyEdited.value = false
    pendingSeed.value = null
    emitSections()
  } catch {
    fetchError.value = true
  } finally {
    isFetching.value = false
  }
}

function segmentBorderClass(speaker: DraftSpeaker): string {
  if (speaker === 'LEADER') return 'border-l-sky-600/70'
  if (speaker === 'CONGREGATION') return 'border-l-amber-600/70'
  return 'border-l-violet-600/70'
}

function previewLabel(speaker: DraftSpeaker): string {
  if (speaker === 'LEADER') return 'Leader:'
  if (speaker === 'CONGREGATION') return 'Congregation:'
  return 'All:'
}

function previewLabelClass(speaker: DraftSpeaker): string {
  if (speaker === 'LEADER') return 'text-sky-300'
  if (speaker === 'CONGREGATION') return 'text-amber-300'
  return 'text-violet-300'
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
