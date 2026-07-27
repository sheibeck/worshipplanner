<template>
  <Teleport to="body">
    <!-- Panel only — deliberately NO backdrop/scrim `<Transition>` block.
         SongSlideOver.vue (the pattern D-01 reuses) ships one; this drawer
         must actively DROP it (26-RESEARCH.md Pitfall 7, 26-UI-SPEC.md Mockup
         Correction 7) so the grid underneath stays fully clickable — clicking
         a different slide card must swap this panel's contents in place
         (D-03), which a backdrop's close-on-click would silently break. Do
         not "restore" it for consistency with that analog. -->
    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="isOpenAndResolvable"
        ref="panelRef"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col"
        data-testid="edit-slide-drawer"
        tabindex="-1"
      >
        <!-- Header — 16px padding (md token), not SongSlideOver's 20px (no 20px in this spec). -->
        <div class="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-800 shrink-0">
          <h2 class="text-sm font-medium text-gray-100" data-testid="edit-slide-drawer-title">Edit Slide</h2>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400" data-testid="drawer-status">{{ statusText }}</span>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label="Close"
              data-testid="edit-slide-drawer-close"
              @click="onClose"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body — scrolls on its own; header stays fixed above it. 16px padding/section-gap (md token). -->
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div class="flex items-center gap-1.5" data-testid="drawer-context-line">
            <span
              class="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium"
              :class="kindBadgeClass"
              data-testid="drawer-kind-badge"
            >{{ kindLabel }}</span>
            <span class="truncate text-[13px] text-gray-300" data-testid="drawer-context-text">{{ contextText }}</span>
          </div>

          <div
            class="aspect-video rounded-md bg-gray-950 border border-gray-800 flex items-center justify-center overflow-hidden"
            data-testid="drawer-preview"
          >
            <img
              v-if="isImage"
              :src="imageSrc"
              :alt="imageAlt"
              class="h-full w-full object-contain"
              data-testid="drawer-preview-image"
            />
            <!-- Static, non-interactive glyph — real playback belongs to PresentationViewer, not this drawer. -->
            <div
              v-else-if="isVideo"
              class="text-3xl text-gray-500"
              data-testid="drawer-preview-video-glyph"
              aria-hidden="true"
            >&#9654;</div>
            <p
              v-else
              class="text-center text-[13px] leading-normal text-gray-200 px-4 whitespace-pre-line"
              data-testid="drawer-preview-text"
            >{{ previewText }}</p>
          </div>

          <!-- Task 3: label/notes fields render here, gated on isEditor. -->
          <div v-if="isEditor">
            <label class="block text-xs font-medium text-gray-400 mb-1" for="edit-slide-drawer-label">Slide Label</label>
            <input
              id="edit-slide-drawer-label"
              v-model="localLabel"
              type="text"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              data-testid="drawer-label-input"
            />
          </div>

          <!-- Phase 26-07: Slide Text — branch keyed on the STORED entry's
               `sourceRef.kind`, NEVER the resolved slide's `contentKind`
               (26-UI-SPEC.md § Slide Text, D-15). A PPTX-imported picture and
               a PPTX-imported text slide share `sourceRef.kind: 'imported'`
               despite differing `contentKind` ('image' vs 'text'), and a
               hand-written slide shares `contentKind: 'text'` with an
               imported text slide despite differing `sourceRef.kind` ('text'
               vs 'imported'). Branching on `contentKind` here would silently
               hand an imported picture a lyrics-editing route — do not
               "simplify" this to `contentKind`. Read-only for every kind
               except `text` (D-13's one exception, D-15: "the drawer IS its
               home"). Omitted entirely for `video` — see the outer `v-if`. -->
          <div v-if="sourceKind && sourceKind !== 'video'" data-testid="drawer-slide-text-section">
            <label class="block text-xs font-medium text-gray-400 mb-1">Slide Text</label>

            <template v-if="sourceKind === 'lyric'">
              <p
                class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                data-testid="drawer-slide-text-readonly"
              >{{ lyricLinesText }}</p>
              <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ SONG_TEXT_CAPTION }}</p>
              <button
                v-if="isEditor"
                type="button"
                class="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                data-testid="drawer-edit-in-song-link"
                @click="onEditInSong('lyrics')"
              >Edit in song</button>
            </template>

            <template v-else-if="sourceKind === 'copyright'">
              <div class="text-[13px] leading-normal text-gray-200 space-y-0.5" data-testid="drawer-copyright-block">
                <p data-testid="drawer-copyright-title">{{ copyrightSlide?.title }}</p>
                <p data-testid="drawer-copyright-authors">{{ copyrightSlide?.authors.join(', ') }}</p>
                <p data-testid="drawer-copyright-ccli">{{ copyrightSlide?.ccliSongNumber }}</p>
                <p data-testid="drawer-copyright-license">{{ copyrightSlide?.ccliLicenseNumber }}</p>
              </div>
              <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ SONG_TEXT_CAPTION }}</p>
              <button
                v-if="isEditor"
                type="button"
                class="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                data-testid="drawer-edit-in-song-link"
                @click="onEditInSong('details')"
              >Edit in song</button>
            </template>

            <template v-else-if="sourceKind === 'scripture'">
              <p
                class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                data-testid="drawer-slide-text-readonly"
              >{{ scripturePassageText }}</p>
              <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ SCRIPTURE_TEXT_CAPTION }}</p>
              <button
                v-if="isEditor"
                type="button"
                class="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                data-testid="drawer-edit-in-scripture-link"
                @click="onEditInScripture"
              >Edit in scripture</button>
            </template>

            <template v-else-if="sourceKind === 'imported'">
              <!-- An imported picture's words ARE its picture, already shown
                   in the preview above — no separate read-only text block, no
                   caption, and (D-15) no link: there is no canonical text
                   behind an image entry to edit. -->
              <template v-if="!isImportedImageEntry">
                <p
                  class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                  data-testid="drawer-slide-text-readonly"
                >{{ importedText }}</p>
                <p class="mt-1 text-xs text-gray-500" data-testid="drawer-slide-text-caption">{{ IMPORTED_TEXT_CAPTION }}</p>
              </template>
            </template>

            <template v-else-if="sourceKind === 'text'">
              <!-- D-13's one exception: no canonical source exists for a
                   hand-written slide, so the drawer IS its home — editable
                   right here, no caption, no link, and (D-13, closed) no
                   per-service override control of any kind. -->
              <textarea
                v-if="isEditor"
                v-model="localBody"
                rows="3"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                data-testid="drawer-slide-text-editable"
              ></textarea>
              <p
                v-else
                class="text-[13px] leading-normal text-gray-200 whitespace-pre-line"
                data-testid="drawer-slide-text-readonly"
              >{{ localBody }}</p>
            </template>
          </div>

          <div v-if="isEditor">
            <label class="block text-xs font-medium text-gray-400 mb-1" for="edit-slide-drawer-notes">Notes (operator only)</label>
            <textarea
              id="edit-slide-drawer-notes"
              v-model="localNotes"
              rows="3"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              data-testid="drawer-notes-input"
            ></textarea>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * R033's spine (Phase 26 Plan 05) — the Edit Slide drawer's shell, its
 * connection to Phase 25's `selectedSlideId` seam (resolved one layer up in
 * `SlidesTab.vue`, Task 2), and its two simplest live-apply fields (Task 3).
 * Nothing underneath this panel reflows (R033/D-01): it is a fixed-position
 * overlay with no scrim (D-03), so the grid stays fully clickable while it is
 * open. It follows the selection — it never closes itself on a selection
 * change, only on its own close control or Escape.
 *
 * Renders nothing when closed, and nothing when `entry` is null — the latter
 * covers both "nothing selected" and the pre-materialization window where a
 * selected slide's synthetic fallback id has no stored entry behind it yet
 * (26-RESEARCH.md Pitfall 1). This is a plain `v-if` guard, not a loading
 * state — the window is sub-second in practice and the caller (`SlidesTab.vue`)
 * already handles clearing a dangling selection.
 */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide, ImageSlide, CopyrightSlide, ScriptureSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { useSlideGroups } from '@/stores/slideGroups'
import { KIND_BADGE_CLASSES, slotDisplayTitle, slideBodyText } from './slideDisplay'
import { useUnsavedGuard } from '@/composables/useUnsavedGuard'
import { buildSongEditLink, type SongEditTab } from '@/utils/songEditLink'

const props = defineProps<{
  open: boolean
  /** The resolved stored entry behind the selection — null means "render nothing" (see header comment). */
  entry: GroupSlideEntry | null
  group: SlideGroup | null
  planItem: ServiceSlot | null
  assembledSlide: AssembledSlide | null
  /** One-based position of the selected slide within its group. */
  position: number
  /** Total slide count of the selected slide's group. */
  total: number
  orgId: string
  serviceId: string
  /** Gates the label/notes write controls (T-26-05-02) — a viewer still reads the slide's information. */
  isEditor: boolean
}>()

const emit = defineEmits<{
  close: []
  /** Phase 26-07, D-15: a scripture slide's route away is a same-page request, not a navigation — `SlidesTab.vue` relays it to `ServiceEditorView` via 26-03's plumbing. */
  'edit-in-scripture': []
}>()

const slideGroupsStore = useSlideGroups()
const router = useRouter()

// ── Open/close, focus and Escape (Task 1) ──────────────────────────────────

const panelRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

/** Closed, or open with nothing resolvable behind the selection: render nothing. */
const isOpenAndResolvable = computed(() => props.open && props.entry !== null)

function onClose(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  isOpenAndResolvable,
  async (isOpen) => {
    if (isOpen) {
      // Remember what held focus before the panel opened — restored on close
      // rather than re-querying the grid for "the card that was selected"
      // afterward, since a selection change while the panel is open must not
      // disturb this bookkeeping (D-03: the panel follows the selection).
      previouslyFocused = (document.activeElement as HTMLElement | null) ?? null
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      panelRef.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ── Context line and preview ────────────────────────────────────────────────

const kindLabel = computed(() => props.assembledSlide?.slotKind ?? '')
const kindBadgeClass = computed(() =>
  props.assembledSlide ? KIND_BADGE_CLASSES[props.assembledSlide.slotKind] : '',
)
const contextText = computed(() => {
  const title = props.planItem ? slotDisplayTitle(props.planItem) : ''
  return `${title} · slide ${props.position} of ${props.total}`
})

const isImage = computed(() => props.assembledSlide?.slide.contentKind === 'image')
const isVideo = computed(() => props.assembledSlide?.slide.contentKind === 'video')
const imageSrc = computed(() => (props.assembledSlide?.slide as ImageSlide | undefined)?.imageUrl ?? '')
const imageAlt = computed(() => (props.assembledSlide?.slide as ImageSlide | undefined)?.altText ?? '')
const previewText = computed(() =>
  props.assembledSlide && !isImage.value && !isVideo.value ? slideBodyText(props.assembledSlide.slide) : '',
)

// ── Phase 26-07 Task 1: Slide Text, keyed on the STORED entry's sourceRef.kind ──
// (see the template comment above the section for why this must never branch
// on the resolved slide's contentKind instead).

/** The one decision key for the whole Slide Text section (D-15). `null` when nothing is selected. */
const sourceKind = computed(() => props.entry?.sourceRef.kind ?? null)

/** `lyric`-kind entries resolve to a `LyricSlide` (has `sectionId`) — `slideBodyText` already narrows that shape and produces exactly what's needed (its joined lines), so this reuses it rather than re-deriving. */
const lyricLinesText = computed(() =>
  sourceKind.value === 'lyric' && props.assembledSlide ? slideBodyText(props.assembledSlide.slide) : '',
)

/** `copyright`-kind entries resolve to a `CopyrightSlide` — rendered from its own fields directly (title/authors/CCLI#/license#), since `slideBodyText`'s copyright branch returns only the title and isn't enough here. */
const copyrightSlide = computed(() =>
  sourceKind.value === 'copyright' ? (props.assembledSlide?.slide as CopyrightSlide | undefined) : undefined,
)

/** `scripture`-kind entries: the UI-SPEC calls for the passage text alone, not `slideBodyText`'s reference-prefixed form (the reference is already shown in the context line above). */
const scripturePassageText = computed(() => {
  if (sourceKind.value !== 'scripture' || !props.assembledSlide) return ''
  return (props.assembledSlide.slide as ScriptureSlide).text
})

/** `imported`-kind entries whose resolved content is a picture render no separate words block (see template comment) — this is the ONE place content kind legitimately narrows behavior WITHIN an already-source-keyed branch, not a substitute for the source-kind key itself. */
const isImportedImageEntry = computed(
  () => sourceKind.value === 'imported' && props.assembledSlide?.slide.contentKind === 'image',
)

/** `imported`-kind entries whose resolved content is text — `slideBodyText`'s `text` branch (`slide.body`) is exactly the imported text, so this reuses it too. */
const importedText = computed(() => {
  if (sourceKind.value !== 'imported' || isImportedImageEntry.value || !props.assembledSlide) return ''
  return slideBodyText(props.assembledSlide.slide)
})

// Helper captions, verbatim from 26-UI-SPEC.md § Slide Text (Mockup Correction
// 8 removed the mockup's cut clause implying a per-service override — do not
// reintroduce that clause here).
const SONG_TEXT_CAPTION = "From the song's Lyrics tab — editing there updates every service using this song."
const SCRIPTURE_TEXT_CAPTION = 'Pulled from the passage reference — editing the reference updates this slide.'
const IMPORTED_TEXT_CAPTION = 'From the imported file — re-import to change it.'

// ── Task 3: label/notes/body fields, applied live through a fresh-base write ──

type FieldName = 'label' | 'notes' | 'body'
type FieldStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 1800

const localLabel = ref('')
const localNotes = ref('')
/** Only meaningful when `sourceKind === 'text'` (D-13's one editable exception) — stays '' and unwritten-to for every other kind. */
const localBody = ref('')
const status = ref<FieldStatus>('idle')

/**
 * D-16's unsaved-edit guard, scoped over exactly the fields this drawer
 * debounce-writes (26-UI-SPEC.md § Slide Text, last paragraph). Captured
 * fresh whenever the edited entry changes and after every successful write
 * (see `captureGuardBaseline`), so `isDirty` reads true precisely while a
 * typed edit hasn't landed yet — never invents new confirm copy, reuses this
 * composable's existing wording verbatim.
 */
const unsavedGuard = useUnsavedGuard(() => ({
  label: localLabel.value,
  notes: localNotes.value,
  body: localBody.value,
}))

function captureGuardBaseline(): void {
  unsavedGuard.capture()
}

const statusText = computed(() => {
  switch (status.value) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Failed to save. Please try again.'
    default:
      return ''
  }
})

const debounceTimers: Record<FieldName, ReturnType<typeof setTimeout> | null> = { label: null, notes: null, body: null }
const pendingWrite: Record<FieldName, { entryId: string; value: string } | null> = { label: null, notes: null, body: null }
let savedFadeTimer: ReturnType<typeof setTimeout> | null = null
/** True while local fields are being set programmatically (open/entry-switch resync) — suppresses the write-scheduling watchers below. */
let syncing = false

function clearFieldTimer(field: FieldName): void {
  const timer = debounceTimers[field]
  if (timer !== null) {
    clearTimeout(timer)
    debounceTimers[field] = null
  }
}

function scheduleSavedFade(): void {
  if (savedFadeTimer !== null) clearTimeout(savedFadeTimer)
  savedFadeTimer = setTimeout(() => {
    if (status.value === 'saved') status.value = 'idle'
  }, SAVED_FLASH_MS)
}

/**
 * The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2). Reads
 * `props.group.slides` FRESH at the moment this function actually runs — never
 * a copy captured when the drawer opened or when the debounce timer was
 * scheduled. A stale base would silently discard any change that landed
 * elsewhere during a long-open session; this is the exact data-loss class
 * 25-REVIEW CR-02 already had to fix once, and every later write this drawer
 * adds must route through this same helper for that reason. `entryId` is
 * captured separately, at schedule time — it names WHICH entry to update even
 * if the drawer's selection has since moved on to a different slide (see
 * `flushField`, called when the edited entry changes).
 */
async function writeField(field: FieldName, entryId: string, value: string): Promise<void> {
  if (!props.group) return
  status.value = 'saving'
  try {
    const base = props.group.slides
    const next = base.map((e) => {
      if (e.id !== entryId) return e
      if (field === 'body') {
        // Phase 26-07 Task 2: the value lives on the entry's SOURCE
        // REFERENCE (the `text`-kind's widened `body`, D-17), not a sibling
        // top-level key like `label`/`notes` — replace only `body` on that
        // NESTED object so every other member survives the write intact
        // (notably the short default `title` a hand-added slide is created
        // with, SlideGrid.vue's `onAddSlide`). Guards on `sourceRef.kind`
        // itself (only a `text`-kind entry ever schedules a body write) so
        // this never re-mints an unrelated source ref shape.
        return e.sourceRef.kind === 'text' ? { ...e, sourceRef: { ...e.sourceRef, body: value } } : e
      }
      return { ...e, [field]: value }
    })
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
    status.value = 'saved'
    scheduleSavedFade()
    // D-16: a fresh baseline after every successful write, so the unsaved
    // guard reads dirty ONLY while an edit is typed but not yet persisted.
    captureGuardBaseline()
  } catch (err) {
    console.error(`Failed to save slide ${field}:`, err)
    status.value = 'error'
  }
}

function scheduleWrite(field: FieldName, entryId: string, value: string): void {
  clearFieldTimer(field)
  pendingWrite[field] = { entryId, value }
  debounceTimers[field] = setTimeout(() => {
    debounceTimers[field] = null
    void commitWrite(field)
  }, DEBOUNCE_MS)
}

async function commitWrite(field: FieldName): Promise<void> {
  const pending = pendingWrite[field]
  if (!pending) return
  pendingWrite[field] = null
  await writeField(field, pending.entryId, pending.value)
}

/** Flushes a field's pending write immediately, bypassing its debounce timer — used when leaving the edited entry and on unmount, so a change in flight is never silently dropped. */
async function flushField(field: FieldName): Promise<void> {
  clearFieldTimer(field)
  await commitWrite(field)
}

async function flushAll(): Promise<void> {
  await Promise.all([flushField('label'), flushField('notes'), flushField('body')])
}

/**
 * D-16: cancels every field's pending debounced write WITHOUT committing it —
 * the opposite of `flushAll`. Used when the user accepts the unsaved-edit
 * confirmation before following a route away: without this, the confirmation
 * would be a lie (the discarded edit would still land moments later, either
 * from its own debounce timer or from this component's unmount-time
 * best-effort flush). Never called on decline — a declined confirmation
 * leaves the pending write in place so it still lands normally.
 */
function cancelPendingWrites(): void {
  for (const field of ['label', 'notes', 'body'] as const) {
    clearFieldTimer(field)
    pendingWrite[field] = null
  }
}

function resetLocalFields(entry: GroupSlideEntry | null): void {
  syncing = true
  localLabel.value = entry?.label ?? ''
  localNotes.value = entry?.notes ?? ''
  localBody.value = entry?.sourceRef.kind === 'text' ? (entry.sourceRef.body ?? '') : ''
  void nextTick().then(() => {
    syncing = false
  })
  captureGuardBaseline()
}

watch(
  () => props.entry,
  async (entry, oldEntry) => {
    if (oldEntry && entry?.id !== oldEntry.id) {
      // Leaving the entry being edited — flush whatever is pending for IT
      // (captured entryId, not whatever is newly selected) before this
      // component's local fields move on to the new entry's values.
      await flushAll()
    }

    if (!oldEntry || entry?.id !== oldEntry.id) {
      resetLocalFields(entry ?? null)
      return
    }

    // Same entry, but its persisted value changed (a round trip from this
    // drawer's own write, or a concurrent edit) — re-sync only the field with
    // no write of its own still pending, so an in-flight edit is never
    // clobbered by a stale round trip.
    if (!pendingWrite.label && entry && entry.label !== oldEntry.label) {
      syncing = true
      localLabel.value = entry.label ?? ''
      void nextTick().then(() => {
        syncing = false
      })
    }
    if (!pendingWrite.notes && entry && entry.notes !== oldEntry.notes) {
      syncing = true
      localNotes.value = entry.notes ?? ''
      void nextTick().then(() => {
        syncing = false
      })
    }
    if (
      !pendingWrite.body &&
      entry &&
      entry.sourceRef.kind === 'text' &&
      oldEntry.sourceRef.kind === 'text' &&
      entry.sourceRef.body !== oldEntry.sourceRef.body
    ) {
      syncing = true
      localBody.value = entry.sourceRef.body ?? ''
      void nextTick().then(() => {
        syncing = false
      })
    }
    // Same entry, no local write in flight for anything that changed above —
    // re-capture so a concurrent OTHER agent's edit landing doesn't get
    // spuriously reported as "our" unsaved change.
    captureGuardBaseline()
  },
  { immediate: true },
)

watch(localLabel, (value) => {
  if (syncing || !props.entry) return
  scheduleWrite('label', props.entry.id, value)
})

watch(localNotes, (value) => {
  if (syncing || !props.entry) return
  scheduleWrite('notes', props.entry.id, value)
})

watch(localBody, (value) => {
  if (syncing || !props.entry || props.entry.sourceRef.kind !== 'text') return
  scheduleWrite('body', props.entry.id, value)
})

// ── Phase 26-07 Task 3: the two routes away, each guarded against losing
// unsaved work (D-14/D-15/D-16) ──────────────────────────────────────────────

/**
 * "Edit in song" (D-15): a real navigation via 26-02's link contract, landing
 * on the tab that actually owns the field being shown — Lyrics for a
 * lyric-section slide, Details for a copyright slide (a deliberate
 * refinement of D-14, not a plain reuse of one fixed tab). Guarded by
 * `confirmDiscard()`; on accept, cancels the pending write BEFORE navigating
 * so the confirmation is truthful (see `cancelPendingWrites`'s own comment).
 * On decline, does nothing — the pending write stays scheduled and still
 * lands normally.
 */
function onEditInSong(tab: SongEditTab): void {
  const ref = props.entry?.sourceRef
  if (!ref || (ref.kind !== 'lyric' && ref.kind !== 'copyright')) return
  if (!unsavedGuard.confirmDiscard()) return
  cancelPendingWrites()
  void router.push(buildSongEditLink(ref.songId, tab))
}

/**
 * "Edit in scripture" (D-15): NOT a navigation — the scripture editor's
 * expansion state is page-local to `ServiceEditorView`, unreachable from this
 * subtree directly (26-03's plumbing). Emits a request `SlidesTab.vue` relays
 * via its own `requestEditInScripture()`. Same guard, same cancel-before-emit
 * discipline as `onEditInSong`.
 */
function onEditInScripture(): void {
  if (props.entry?.sourceRef.kind !== 'scripture') return
  if (!unsavedGuard.confirmDiscard()) return
  cancelPendingWrites()
  emit('edit-in-scripture')
}

onUnmounted(() => {
  if (savedFadeTimer !== null) clearTimeout(savedFadeTimer)
  // Best-effort flush on unmount — a leaving user's in-flight edit is still
  // written rather than dropped (fire-and-forget: nothing can await this
  // component's own teardown).
  void flushAll()
})
</script>
