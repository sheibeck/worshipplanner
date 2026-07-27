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
import type { ServiceSlot } from '@/types/service'
import type { AssembledSlide, ImageSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { useSlideGroups } from '@/stores/slideGroups'
import { KIND_BADGE_CLASSES, slotDisplayTitle, slideBodyText } from './slideDisplay'

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

const emit = defineEmits<{ close: [] }>()

const slideGroupsStore = useSlideGroups()

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

// ── Task 3: label/notes fields, applied live through a fresh-base write ────

type FieldName = 'label' | 'notes'
type FieldStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const SAVED_FLASH_MS = 1800

const localLabel = ref('')
const localNotes = ref('')
const status = ref<FieldStatus>('idle')

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

const debounceTimers: Record<FieldName, ReturnType<typeof setTimeout> | null> = { label: null, notes: null }
const pendingWrite: Record<FieldName, { entryId: string; value: string } | null> = { label: null, notes: null }
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
    const next = base.map((e) => (e.id === entryId ? { ...e, [field]: value } : e))
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
    status.value = 'saved'
    scheduleSavedFade()
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
  await Promise.all([flushField('label'), flushField('notes')])
}

function resetLocalFields(entry: GroupSlideEntry | null): void {
  syncing = true
  localLabel.value = entry?.label ?? ''
  localNotes.value = entry?.notes ?? ''
  void nextTick().then(() => {
    syncing = false
  })
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

onUnmounted(() => {
  if (savedFadeTimer !== null) clearTimeout(savedFadeTimer)
  // Best-effort flush on unmount — a leaving user's in-flight edit is still
  // written rather than dropped (fire-and-forget: nothing can await this
  // component's own teardown).
  void flushAll()
})
</script>
