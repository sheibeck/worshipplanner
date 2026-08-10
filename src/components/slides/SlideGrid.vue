<template>
  <div class="flex h-full min-w-0 flex-1 flex-col" data-testid="slide-grid" :style="slideTypographyStyle">
    <template v-if="selectedSlot">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-800 px-6 py-3">
        <h2 class="text-sm font-medium text-gray-100" data-testid="slide-grid-title">{{ groupTitle }}</h2>
        <span
          class="inline-flex items-center rounded border border-indigo-800 bg-indigo-950/50 px-2 py-0.5 text-[11px] text-indigo-300"
          data-testid="slide-grid-position"
        >group {{ position }} of {{ totalPlanItems }} &middot; follows plan</span>
        <span
          v-if="cards.length > 0"
          class="text-[10.5px] text-gray-500"
          data-testid="slide-grid-reading-order"
        >Plays 1 &rarr; {{ cards.length }}, left to right then down</span>

        <!-- R036: `canMutateGroup` composes the lifecycle lock with R054's
             song-group lock. Removed, never disabled (D-05); the header keeps
             its title, the "group N of M · follows plan" chip and the
             reading-order line. -->
        <button
          v-if="canMutateGroup"
          type="button"
          class="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
          data-testid="slide-grid-add-slide"
          @click="onAddSlide"
        >＋ Add slide</button>
        <!-- R054: a song group's slides are canonical, edited only from the
             Song Lyrics screen — a quiet marker rather than silence, matching
             the drawer's own read-only affordance.
             ★ NO second chip for the lifecycle lock: this one explains a
             DIFFERENT restriction that applies even to a draft service, while
             the lifecycle lock is already stated once by the sticky page banner.
             A lock chip here would be the second banner D-06 forbids. -->
        <span
          v-if="isSongGroup"
          class="ml-auto inline-flex items-center rounded border border-gray-700 bg-gray-800/50 px-2 py-0.5 text-[11px] text-gray-400"
          data-testid="slide-grid-song-readonly-badge"
        >Read-only — edit in Song Lyrics</span>
      </div>

      <!-- The grid's OWN import-modal instance (25-07 Task 3, D-15/D-16) —
           NOT the instance/handler in `ServiceEditorView.vue`, which creates
           a brand-new IMPORTED plan item. This instance's `confirmed`
           handler instead appends the deck's slides to the SELECTED group
           and never touches the plan/rail. -->
      <PptxImportModal
        ref="importModalRef"
        :open="showImportModal"
        :org-id="orgId"
        :section="importSection"
        @confirmed="onImportConfirmed"
        @cancel="showImportModal = false"
      />

      <!-- Group media panel (34-11, 34-UAT F2; owner follow-up x2) — music and
           background merged into ONE VISUAL panel, not just one structural
           wrapper. 34-11 merged the two controls under one
           `data-testid="slide-grid-group-media-panel"` element and moved the
           border/background chrome up to this wrapper via the `flush` prop,
           but the wrapper still carried `divide-y divide-gray-800` PLUS each
           control still sat in its own `px-3 py-2` child div — the divider
           line and the two separate padded blocks together still read as two
           stacked panels on screen. Per direct owner feedback on the running
           app ("get rid of the extra panel ... instead the background button
           should go in the same panel as the add music button") the divider
           and the per-control padding are removed: padding lives ONCE on the
           panel itself, `gap-3` keeps the two controls from colliding
           without drawing a seam between them. Deliberately still confined to
           wrapper/prop plumbing: no new component, no relocation out of this
           file, no restyle of either control's internals.

           Owner follow-up #3 (direct feedback on the running app, third pass
           on this same panel): "I want add music for group and add
           background for group to be next to each other, not on top of each
           other." The panel became a wrapping row (`flex-wrap`) instead of
           `flex-col`.

           Owner follow-up #4 (fourth pass, pasted DOM again): "now you have
           them in their own <div> containers. Let's use flex, and don't
           containerize each button. Move the label for 'applies to all
           slides, ...' so that it shows below the buttons." Two distinct
           corrections:

           (a) Follow-up #3's `min-w-[14rem] flex-1` on each child turned the
               two buttons into two half-width COLUMNS — a grow factor makes
               each child claim an equal share of the row whether or not its
               content needs it, which reads as a container per button. The
               children now carry no grow factor and no width floor at all,
               so each flex item sizes to its own button and the two sit
               adjacent. `min-w-0 max-w-full` is retained deliberately and is
               NOT layout-shaping: it exists only so an attached state with a
               long filename is capped at the panel width and lets the
               control's own inner `truncate` engage, instead of running off
               the right edge. Without a grow factor there is no `flex-wrap`
               crush risk, so no width floor is needed to force wrapping.

           (b) The group caption was rendered INSIDE `BackgroundControl`,
               stacked above only that control's button — which is precisely
               what pushed the two buttons out of alignment with each other.
               It moves out here via the control's `hide-caption` prop and
               renders as a `basis-full` flex item, i.e. its own full-width
               line BELOW both buttons. `groupBackgroundCaption` stays the
               single source of that copy — it is still passed to the control
               as `caption` (the prop remains part of the component's
               contract and the song-level call site still renders it), it is
               simply painted here instead.

           `items-start` is retained because either control can grow a
           filename/progress/error row once attached, and they would
           otherwise center against each other's differing heights.

           ★ 31-UI-SPEC E5 still applies at the PANEL level, not just to each
           control inside it: two controls that each correctly decline to
           render an empty box on their own would together produce an empty
           PANEL if the panel's own wrapper were left ungated — so the panel
           carries the disjunction of both controls' conditions one level up.
           Each control's own gate (`showGroupMusicControl` /
           `showGroupBackgroundControl`) now lives directly on the control
           (or, for background, on the minimal testid wrapper below) rather
           than on a padded child div — there is no padded child div left. -->
      <div
        v-if="showGroupMusicControl || showGroupBackgroundControl || showCongregationalControl"
        class="mx-6 mt-3 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-gray-800 bg-gray-900 px-3 py-2"
        data-testid="slide-grid-group-media-panel"
      >
        <!-- Group music bar (25-06, R032). Emit-only control; this component
             intercepts both events and writes the selected group's bed via
             the slideGroups store's scoped write (the sole surviving
             attach/remove surface for group-bed audio; the Service Order
             tab's equivalent control was removed in Phase 27-04). Gate moved
             directly onto the component (no wrapper needed — no testid was
             ever attached to its old child div). -->
        <SlideGroupMusicControl
          v-if="showGroupMusicControl"
          class="min-w-0 max-w-full"
          :audio-url="group?.bedAudioUrl"
          :slide-count="cards.length"
          :org-id="orgId"
          :is-editor="canWriteGroupMedia"
          flush
          @attach="onAttachGroupMusic"
          @remove="onRemoveGroupMusic"
        />

        <!-- Group background control (R055, 33-08), same "don't render an
             empty box" gate for the same recorded reason (31-UI-SPEC E5).
             Background is group MEDIA exactly like the bed audio above it,
             so it uses the SAME `canWriteGroupMedia` gate — never
             `canMutateGroup` — including that gate's deliberate song-group
             carve-out.

             This wrapper div is intentionally NOT deleted along with the
             padding: `data-testid="slide-grid-group-background"` used to
             live on the (now-removed) `px-3 py-2` child div, and existing
             assertions depend on it. `BackgroundControl`'s own root already
             carries `data-testid="background-control"`, so the testid can't
             move onto the component without a collision. This div carries
             ONLY the testid and the `v-if` gate — no padding, no border, no
             background — so it adds no visual chrome of its own. -->
        <div
          v-if="showGroupBackgroundControl"
          class="min-w-0 max-w-full"
          data-testid="slide-grid-group-background"
        >
          <BackgroundControl
            :image-url="group?.backgroundImageUrl"
            :caption="groupBackgroundCaption"
            :inherited-from="songBackgroundForInheritedDisplay"
            :is-editor="canWriteGroupMedia"
            :org-id="orgId"
            add-label="+ Add background for this group"
            remove-label="Remove group background"
            flush
            hide-caption
            @attach="onAttachGroupBackground"
            @remove="onRemoveGroupBackground"
          />
        </div>

        <!-- Congregational-reading action (owner request) — a discoverable
             button beside "+ Add background for this group" that opens the same
             editor the slide 3-dot menu's `edit-in-scripture` does. Scripture
             groups only. Label reflects whether a reading already exists. -->
        <button
          v-if="showCongregationalControl"
          type="button"
          data-testid="slide-grid-congregational-btn"
          @click="emit('edit-congregational')"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
        >
          {{ congregationalButtonLabel }}
        </button>

        <!-- The group caption, relocated out of `BackgroundControl` (owner
             follow-up #4 (b) above). `basis-full` makes it take a whole flex
             line of its own, so it sits BELOW both add-buttons rather than
             above one of them. Suppressed while `songBackgroundForInheritedDisplay`
             is set, because in that case the control renders the "inherited
             from the song" provenance line in the caption's place — showing
             both would state two different things about the same background. -->
        <p
          v-if="showGroupBackgroundControl && !songBackgroundForInheritedDisplay"
          class="basis-full text-[11px] text-gray-500"
          data-testid="slide-grid-group-background-caption"
        >{{ groupBackgroundCaption }}</p>
      </div>

      <div
        v-if="rejectionNotice"
        class="mx-6 mt-3 rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-[12px] text-red-300"
        data-testid="slide-grid-rejection-notice"
      >{{ rejectionNotice }}</div>

      <div
        v-if="mediaUploadError"
        class="mx-6 mt-3 text-[12px] text-red-400"
        data-testid="slide-grid-media-error"
      >{{ mediaUploadError }}</div>
      <div
        v-else-if="mediaUploadInProgress"
        class="mx-6 mt-3 text-[12px] text-indigo-400"
        data-testid="slide-grid-media-progress"
      >Uploading... {{ Math.round(mediaUploadProgress) }}%</div>
      <!-- UI-SPEC §5: minimal, transient reorder-failure text — same shape
           as `mediaUploadError` above. No toast, no badge, no aria-live;
           the persistent status indicator is Phase 32's (R040/R041). -->
      <div
        v-if="reorderError"
        class="mx-6 mt-3 text-[12px] text-red-400"
        data-testid="slide-grid-reorder-error"
      >{{ reorderError }}</div>

      <!-- Grid-wide dragover highlight (D-13) — applied to the WHOLE content
           area, not only the drop tile, so the target isn't a pixel hunt.
           Guarded against the constant child-element dragleave events that
           fire while moving across cards inside the container via a depth
           counter, and gated on the drag actually carrying files. -->
      <div
        class="flex-1 overflow-y-auto px-6 py-4 transition-colors"
        :class="isDragOver ? 'rounded-md border-2 border-indigo-500/50 bg-indigo-950/10' : 'border-2 border-transparent'"
        data-testid="slide-grid-drop-area"
        @dragenter="onGridDragEnter"
        @dragover="onGridDragOver"
        @dragleave="onGridDragLeave"
        @drop="onGridDrop"
      >
        <div
          v-if="cards.length > 0"
          :key="gridRenderNonce"
          ref="cardsContainerRef"
          class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
          data-testid="slide-grid-cards"
        >
          <SlideCard
            v-for="card in cards"
            :key="card.assembledSlide.slide.id"
            :assembled-slide="card.assembledSlide"
            :number="card.number"
            :selected="card.assembledSlide.slide.id === selectedSlideId"
            :reorderable="canReorder"
            :menu-items="card.menuItems"
            :menu-open="openMenuEntryId === card.assembledSlide.slide.id"
            :typography-style="slideTypographyStyle"
            @select="emit('select', $event)"
            @menu-toggle="onCardMenuToggle"
            @menu-select="onCardMenuSelect"
          />
          <!-- Always the LAST grid item (D-13) — deliberately NOT given the
               `.slide-card` class SortableJS is scoped to. Gone when locked: the
               card grid simply ends at the last real card. -->
          <SlideDropTarget
            v-if="canWriteGroupMedia"
            :audio-only="isSongGroup"
            :clickable="canMutateGroup"
            @drop="onFilesDropped"
            @browse="openImportModal"
          />
        </div>
        <template v-else>
          <!-- ★ R036 locked variant (31-UI-SPEC E2). "Add a slide, or drop a file
               below." is a dead instruction once both affordances are gone — and
               the drop tile it says "below" about is gone too. Copy swap only,
               no restyle. -->
          <div class="px-1 py-8" data-testid="slide-grid-empty-state">
            <p class="text-sm font-medium text-gray-300">
              {{ canMutateGroup ? 'No slides in this group yet' : 'No slides in this group.' }}
            </p>
            <p class="mt-1 text-xs text-gray-500">
              {{ isSongGroup
                ? 'A song\'s slides come from its lyrics — add them in Song Lyrics.'
                : serviceLocked
                  ? 'Reopen the service for editing to add slides.'
                  : 'Add a slide, or click below to import.' }}
            </p>
          </div>
          <SlideDropTarget
            v-if="canWriteGroupMedia"
            :audio-only="isSongGroup"
            :clickable="canMutateGroup"
            @drop="onFilesDropped"
            @browse="openImportModal"
          />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Presentational-plus-write-controls slide grid (Phase 25 Tasks 2/3). Renders
 * the SELECTED plan item's slides as cards, in play order, and the three-line
 * header the mockup and 25-CONTEXT.md § Specific Ideas describe verbatim.
 *
 * Every input still arrives as a prop from `SlidesTab.vue` and this component
 * still calls no `useSlideshowAssembly` composable directly — but per 25-05 it
 * DOES import the `slideGroups` Pinia store directly to issue the two writes
 * this plan adds (append-a-slide, drag-reorder), exactly as every other
 * slide-group mutation in the codebase does (never the `localService`
 * deep-watch autosave).
 *
 * Filters `assembledSlideshow` by the selected plan item's ARRAY index
 * (`slotArrayIndex`), never by `groupId` — `groupId` is only set on the
 * group-resolved emission path and is absent for the entire window before a
 * group's Firestore snapshot lands (25-RESEARCH.md Pitfall 2), even though
 * the fallback-path slides being shown are already real and correct.
 *
 * Ships no Grid/List toggle (D-09). The reconciliation confirm/review surface
 * (26-06) was removed entirely in Phase 30 (R048) — every group write is now
 * unconditional; only `replaceGroupSlides` (the concurrent-write transaction
 * merge) remains.
 *
 * 25-07 adds the drop tile (always the grid's last item, D-13), a whole-grid
 * dragover highlight, and the four accepted-kind persistence paths (PPTX and
 * image import append via the reused `PptxImportModal.vue`, video appends its
 * own slide, audio sets the group's bed) — see `dropRouting.ts` for the pure
 * classification/resolution the drop path routes every file through.
 */
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import Sortable from 'sortablejs'
import type { ServiceSlot, ServiceSection } from '@/types/service'
import { SERVICE_SECTIONS } from '@/types/service'
import type { AssembledSlide } from '@/types/slide'
import type { SlideGroup, GroupSlideEntry } from '@/types/slideGroup'
import { useSlideGroups } from '@/stores/slideGroups'
import { useImportedSlides } from '@/stores/importedSlides'
import { useAuthStore } from '@/stores/auth'
import { cssVarsFor } from '@/utils/slideTypography'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { slotLabel } from '@/utils/slotTypes'
import SlideCard from './SlideCard.vue'
import SlideGroupMusicControl from './SlideGroupMusicControl.vue'
import BackgroundControl from './BackgroundControl.vue'
import SlideDropTarget from './SlideDropTarget.vue'
import PptxImportModal from '@/components/PptxImportModal.vue'
import { resolveDrop, UNSUPPORTED_FILE_MESSAGE } from './dropRouting'
import {
  slotDisplayTitle,
  backgroundImageLabel,
  slideActionMenuItems,
  type EnsureGroupMaterializedResult,
  type MenuItem,
  type MenuItemKey,
} from './slideDisplay'

const props = withDefaults(defineProps<{
  /** The currently-selected plan item, or null when no plan item is selected. */
  selectedSlot: ServiceSlot | null
  /** The selected slot's ARRAY index within the service's raw `slots` — what `AssembledSlide.slotIndex` matches. */
  slotArrayIndex: number
  /** The selected slot's one-based position among the plan items, in plan order. */
  position: number
  /** Total number of plan items, for the header's "group N of M" line. */
  totalPlanItems: number
  assembledSlideshow: AssembledSlide[]
  selectedSlideId: string | null
  /** The group document for the selected plan item, if materialized. */
  group: SlideGroup | null
  /** Gates every write control this component renders (add-slide button, drag grip/Sortable instance, group-music add/remove). */
  isEditor: boolean
  /**
   * R036 — the service's lifecycle lock, kept DISTINCT from `isEditor` (see
   * `SlidesTab.vue`'s own prop comment for why). Composes with `isEditor` and
   * with R054's `isSongGroup` through the two computeds below rather than
   * introducing a third gating mechanism. Defaults `false` so every existing
   * fixture behaves exactly as before.
   */
  serviceLocked?: boolean
  /** Org id — needed to call the `slideGroups` store's write actions directly. */
  orgId: string
  /** Service id — required by `setGroupBedMedia`'s skeleton-create payload when the group has not materialized yet. */
  serviceId: string
  /** On-demand group materializer (25-05 Task 1) — resolved before every append so a plan item with no group yet can still receive a slide (R032). */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
}>(), { serviceLocked: false })

const emit = defineEmits<{
  select: [slideId: string]
  /**
   * A menu item was selected for the given slide id. This grid does not act
   * on the key itself — the tab one level up owns the dispatch (drawer open,
   * navigate, duplicate, delete), exactly as it already owns the `select`
   * relay (Task 3).
   */
  'menu-action': [slideId: string, key: MenuItemKey]
  /**
   * The group-level "Make this / Modify congregational reading" button was
   * clicked (a more discoverable path to the same editor the 3-dot menu's
   * `edit-in-scripture` opens). Args-free: the tab one level up already knows
   * the selected plan item's array index and routes this through the exact same
   * `navigate-to-scripture-editor` relay.
   */
  'edit-congregational': []
}>()

const slideGroupsStore = useSlideGroups()
const importedSlidesStore = useImportedSlides()
const authStore = useAuthStore()

/**
 * R093 (46-04) — this grid's ONE CSS-variable wrapper (key_links: three
 * render sites read `authStore.settings.slideTypography` via `cssVarsFor`,
 * this is the grid's). Bound on the grid's own root AND passed down to every
 * `SlideCard` (which also carries it on its own root — see that component's
 * `typographyStyle` prop comment for why): the container's binding is what
 * this plan's action text calls for; the per-card pass-through keeps a card
 * self-contained/testable in isolation without importing the store itself.
 */
const slideTypographyStyle = computed(() => ({
  ...cssVarsFor(authStore.settings.slideTypography),
  fontFamily: 'var(--slide-font-family)',
}))

// One shared upload composable for both drop-triggered media paths (video
// append, audio bed) — a single drop is handled sequentially (videos then
// audio, never concurrently), so a single instance's reactive
// progress/error/isUploading is unambiguous at any moment. Reused verbatim,
// per the UI-SPEC's "do not author new copy" instruction.
const { progress: mediaUploadProgress, error: mediaUploadError, isUploading: mediaUploadInProgress, uploadMedia, reset: resetMediaUpload } = useMediaUpload()

/**
 * The group title line, collapsed to just the kind label (e.g. "Prayer")
 * when the plan item has no title of its own beyond its kind, or
 * "{Kind} — {title}" (e.g. "Song — This Is Our God") otherwise.
 */
const groupTitle = computed(() => {
  if (!props.selectedSlot) return ''
  const kindLabel = slotLabel(props.selectedSlot)
  const display = slotDisplayTitle(props.selectedSlot)
  return display === kindLabel ? kindLabel : `${kindLabel} — ${display}`
})

/**
 * R054: a song's slides are canonical, edited only from the Song Lyrics
 * screen — this grid must offer no create/import/reorder for a song group,
 * and must route a drop to audio only. Read from the existing `selectedSlot`
 * prop; no new prop is threaded (30-03-PLAN.md key_links).
 */
const isSongGroup = computed(() => props.selectedSlot?.kind === 'SONG')

/**
 * ★ R036 — the two composed gates this component uses everywhere. Both fold the
 * lifecycle lock into the existing R054 seam rather than running beside it.
 *
 * `canMutateGroup` — create/import/reorder the group's SLIDES. Excludes song
 * groups (R054: a song's slides are canonical and edited in Song Lyrics).
 *
 * `canWriteGroupMedia` — the drop tile and the group-bed music control. These
 * stay available on a SONG group (audio-only there, which is exactly what 30-03
 * shipped: "lock the slide grid for song groups without blocking group media"),
 * so this gate deliberately omits `isSongGroup`.
 *
 * Every corresponding HANDLER re-checks the same computed. 30-VERIFICATION I-01
 * found six of seven mutation entry points here guarded by template `v-if`
 * ALONE; a lifecycle lock layered over that inherits its fragility.
 */
const canMutateGroup = computed(() => props.isEditor && !props.serviceLocked && !isSongGroup.value)
const canWriteGroupMedia = computed(() => props.isEditor && !props.serviceLocked)

/**
 * 34-11 (34-UAT F2): each control's own wrapper-visibility condition, copied
 * VERBATIM from the two sibling wrapper `v-if`s the merged group-media panel
 * (below) replaces. The media-present half is not simplified away to
 * `canWriteGroupMedia` alone — it is what keeps a locked service showing
 * what it already has (31-UI-SPEC E5), independent of write permission.
 */
const showGroupMusicControl = computed(() => Boolean(props.group?.bedAudioUrl) || canWriteGroupMedia.value)
const showGroupBackgroundControl = computed(
  () => Boolean(props.group?.backgroundImageUrl) || canWriteGroupMedia.value,
)

/**
 * Congregational-reading group action (owner request): a discoverable button
 * that sits beside "+ Add background for this group", instead of only living in
 * a slide's 3-dot menu. Scripture groups only; gated on the same edit permission
 * as the group's other content controls (`canMutateGroup` = editor + not locked;
 * scripture is never a song group, so its carve-out never applies here).
 */
const isScriptureGroup = computed(() => props.selectedSlot?.kind === 'SCRIPTURE')
const isCongregationalReading = computed(() => {
  const slot = props.selectedSlot
  if (!slot || slot.kind !== 'SCRIPTURE') return false
  return Array.isArray(slot.congregationalSections) && slot.congregationalSections.length > 0
})
const showCongregationalControl = computed(() => isScriptureGroup.value && canMutateGroup.value)
const congregationalButtonLabel = computed(() =>
  isCongregationalReading.value
    ? 'Modify congregational reading'
    : 'Make this a congregational reading',
)

/**
 * R106 (Phase 50) — per-group "Remove imported slides" bulk action. Song
 * groups can never hold imported entries (deck import is blocked there via
 * `canMutateGroup`'s existing song-group exclusion), so `hasImportedEntries`
 * needs no separate song-group check — `canMutateGroup` already covers it.
 */
const hasImportedEntries = computed(() =>
  Boolean(props.group?.slides.some((entry) => entry.sourceRef.kind === 'imported')),
)
const showRemoveImportedControl = computed(() => canMutateGroup.value && hasImportedEntries.value)

interface CardEntry {
  assembledSlide: AssembledSlide
  number: number
  /**
   * Task 3: pre-computed by `slideActionMenuItems` (the SINGLE place that
   * decides per-kind items, per-type item list `slideDisplay.ts`), never
   * re-implemented here. Empty when the card's slide id resolves to no
   * stored entry yet (the pre-materialization fallback-id window) — that
   * card renders no menu rather than one whose only action would open an
   * empty drawer.
   */
  menuItems: MenuItem[]
}

/**
 * The selected group's slides, in play order, numbered from one WITHIN this
 * group — independent of the slide's position in the whole service.
 */
const cards = computed<CardEntry[]>(() => {
  return props.assembledSlideshow
    .filter((assembled) => assembled.slotIndex === props.slotArrayIndex)
    .map((assembledSlide, i) => {
      const entry = props.group?.slides.find((e) => e.id === assembledSlide.slide.id)
      const menuItems = entry
        ? slideActionMenuItems(entry, props.selectedSlot?.kind, canMutateGroup.value)
        : []
      return { assembledSlide, number: i + 1, menuItems }
    })
})

/**
 * Task 3: the single ref that makes "exactly one menu open at a time" true
 * across the whole grid without any cross-card coordination — the cards
 * hold no menu state of their own (`menuOpen` is a prop, per 33-05).
 */
const openMenuEntryId = ref<string | null>(null)

// WR-02: reset whenever the selected plan item changes. `openMenuEntryId` is
// local, persistent state on this instance — it is NOT remounted when
// `SlidesTab.vue`'s rail selection changes plan item, only `selectedSlot`/
// `group` props change and `cards` recomputes to a different filtered list.
// Without this, returning to a previously-selected plan item whose group
// still contains a `GroupSlideEntry.id` matching the stale `openMenuEntryId`
// (stable ids, so this reliably recurs) makes that card's menu reopen with
// no click, tap, or keypress from the user.
watch(
  () => props.selectedSlot?.id,
  () => {
    openMenuEntryId.value = null
  },
)

function onCardMenuToggle(slideId: string): void {
  openMenuEntryId.value = openMenuEntryId.value === slideId ? null : slideId
}

function onCardMenuSelect(slideId: string, key: MenuItemKey): void {
  openMenuEntryId.value = null
  emit('menu-action', slideId, key)
}

// --- 25-06 Task 2: group music bar attach/remove — the bed write path ---
//
// No on-demand materialization step is needed here, unlike every
// slide-appending path above: `setGroupBedMedia` already creates a skeleton
// group document when none exists, and it does so with a merging write
// (`{ merge: true }`) specifically so a concurrently-landing
// `ensureGroupMaterialized`/`materializeGroupIfMissing` call cannot be
// clobbered (WR-01). Adding a redundant materialization call here would only
// reintroduce that race, not prevent it.
async function onAttachGroupMusic(url: string): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      bedAudioUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach group music:', err)
  }
}

// The explicit `clearAudio` flag is used rather than an undefined url —
// `stripUndefined()` would otherwise erase that intent before it reached
// Firestore, and `deleteField()` is the only way to actually remove the
// field (mirrors `ServiceEditorView.vue`'s existing `onSlotBedAudioChange`).
async function onRemoveGroupMusic(): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      clearAudio: true,
    })
  } catch (err) {
    console.error('Failed to remove group music:', err)
  }
}

// --- Task 2: group background control — the caller-does-the-write idiom,
// mirroring `onAttachGroupMusic`/`onRemoveGroupMusic` exactly. Background is
// group MEDIA, so writes go through `canWriteGroupMedia`, never
// `canMutateGroup` (same reasoning as the music control above). No
// on-demand materialization step is needed for the same reason the music
// handlers need none — `setGroupBackground`'s own merging skeleton-create
// already covers a plan item with no group document yet (WR-01). ---

/**
 * `applies to all {N} slides in this group, unless a slide sets its own` —
 * the Copywriting Contract's group-background caption, with the real card
 * count substituted (R055).
 */
const groupBackgroundCaption = computed(
  () => `applies to all ${cards.value.length} slides in this group, unless a slide sets its own`,
)

/**
 * Populated ONLY for a SONG group whose own background is empty while the
 * song's own is set — derived from the ALREADY-RESOLVED provenance on this
 * group's own assembled slides (`backgroundSource === 'song'`), never from a
 * new song-lyrics prop or a second cascade derivation. `undefined` for every
 * non-SONG group (no associated song, nothing to inherit from at this
 * level) and whenever the group already has its own background.
 */
const songBackgroundForInheritedDisplay = computed<{ url: string; label: string } | undefined>(() => {
  if (!isSongGroup.value) return undefined
  if (props.group?.backgroundImageUrl) return undefined
  const songSourced = cards.value.find((card) => card.assembledSlide.slide.backgroundSource === 'song')
  const url = songSourced?.assembledSlide.slide.backgroundImageUrl
  if (!url) return undefined
  return { url, label: backgroundImageLabel(url) }
})

async function onAttachGroupBackground(url: string): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBackground(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      backgroundImageUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach group background:', err)
  }
}

// The explicit `clearBackground` flag mirrors `onRemoveGroupMusic`'s own
// `clearAudio` flag — `stripUndefined()` would otherwise erase the intent
// before it reached Firestore, and `deleteField()` is the only way to
// actually remove the field.
async function onRemoveGroupBackground(): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBackground(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      clearBackground: true,
    })
  } catch (err) {
    console.error('Failed to remove group background:', err)
  }
}

// --- R106: per-group "Remove imported slides" bulk action ---
//
// The handler re-checks `canMutateGroup.value` itself rather than relying on
// the template `v-if` alone (30-VERIFICATION I-01) — every other mutation
// handler in this file does the same. Entries are sorted by their existing
// `order` before filtering, mirroring the drag-reorder handler's own
// defensive sort, so the survivors' relative PLAY order (not raw array
// insertion order) is what gets renumbered. Does NOT touch
// `group.sourceSignature` — a removal changes no source (R107 territory is
// untouched here) — and passes `group.slides` as `baseSlides` so the write
// routes through the CR-02 concurrent-write transaction merge, exactly like
// every other group-slides write in this file.
async function onRemoveImportedSlides(): Promise<void> {
  if (!canMutateGroup.value) return
  if (!props.selectedSlot || !props.group) return
  const group = props.group
  const sorted = [...group.slides].sort((a, b) => a.order - b.order)
  const remaining = sorted.filter((entry) => entry.sourceRef.kind !== 'imported')
  if (remaining.length === sorted.length) return
  if (!window.confirm('Remove all imported slides from this group? This cannot be undone.')) return
  const renumbered = remaining.map((entry, i) => ({ ...entry, order: i }))
  try {
    await slideGroupsStore.replaceGroupSlides(
      props.orgId,
      props.selectedSlot.id,
      renumbered,
      group.sourceSignature,
      group.slides,
    )
  } catch (err) {
    console.error('Failed to remove imported slides:', err)
  }
}

// --- R050: the one append contract every write path below routes through ---
//
// Sorts a copy of `entries` by `order`, concatenates `additions` (in the
// order given), then renumbers every element to its array index — so array
// order and `order` are the same statement afterward. This is the exact
// normalization the reorder handler's `onEnd` already performs; this helper
// makes it the component's one contract instead of a behaviour only the
// reorder path had. Closes the divergence where `entries`' array order and
// `order`-field values disagree (e.g. after a prior reorder or
// reconciliation) — the mechanism behind "a new slide lands second-to-last"
// for a group with no copyright entries (see 29-04-SUMMARY.md for the
// investigation of the second, unrelated candidate mechanism).
function appendToGroup(entries: GroupSlideEntry[], additions: GroupSlideEntry[]): GroupSlideEntry[] {
  const sorted = [...entries].sort((a, b) => a.order - b.order)
  return [...sorted, ...additions].map((entry, i) => ({ ...entry, order: i }))
}

// --- Task 2: ＋ Add slide, appended at the true end of the selected group (D-16) ---
//
// Always resolves the group through `ensureGroupMaterialized` first — even
// when `props.group` already reflects a stored document — rather than
// reading `props.group.slides` directly. That prop lags a Firestore
// snapshot round trip behind a just-issued write, so reading it here instead
// of the freshly-returned entries would risk appending to (and persisting) a
// stale list on rapid repeated clicks.
async function onAddSlide(): Promise<void> {
  if (!canMutateGroup.value) return
  if (!props.selectedSlot) return
  const slotId = props.selectedSlot.id
  try {
    const resolved = await props.ensureGroupMaterialized(slotId)
    if (!resolved) return
    const { entries, sourceSignature } = resolved
    const newEntry: GroupSlideEntry = {
      id: crypto.randomUUID(),
      order: 0, // overwritten by appendToGroup's renumber below
      // A `text` ref with no authored content resolves from the owning slot
      // (nothing at all on a SONG/SCRIPTURE/IMPORTED plan item) — 25-01's
      // widened `text` SourceRef exists so a hand-added blank slide can carry
      // its own words instead. Body stays empty (Phase 26's drawer is where
      // it's actually written); the short default title is what keeps the
      // new card from looking blank in the grid.
      sourceRef: { kind: 'text', title: 'New slide', body: '' },
    }
    // CR-02: `entries` (unsorted, as returned) is the snapshot this append
    // was computed FROM — passed through as `baseSlides` so a concurrent
    // write (a double-click's other call, or a drag-reorder landing first)
    // is detected and merged rather than silently overwritten. See
    // `replaceGroupSlides`'s doc comment. Re-sorting THIS argument would
    // defeat the merge — only the payload passed as `slides` goes through
    // `appendToGroup`.
    const nextSlides = appendToGroup(entries, [newEntry])
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, nextSlides, sourceSignature, entries)
  } catch (err) {
    console.error('Failed to add slide:', err)
  }
}

// --- 25-07: drop target + import action — four persistence paths (R032) ---
//
// The grid's OWN modal instance (mounted above), never `ServiceEditorView`'s.
// Its `section` prop is satisfied by the selected plan item's own section,
// falling back to the first `SERVICE_SECTIONS` entry — the section only sets
// the created deck's own `section` field and has NO bearing on which group
// the entries land in (Pattern 4).
const showImportModal = ref(false)
const importModalRef = ref<InstanceType<typeof PptxImportModal> | null>(null)
const importSection = computed<ServiceSection>(
  () => props.selectedSlot?.section ?? SERVICE_SECTIONS[0] ?? 'pre-service',
)

function openImportModal(): void {
  if (!canMutateGroup.value) return
  showImportModal.value = true
}

// PPTX/image drop — opens the modal (which resets to idle on open) then
// hands it the already-dropped file(s) via the 25-07 Task 1 entry point.
// Awaiting `nextTick()` between the two ensures the modal's own
// reset-on-open watcher has already run before the entry point sets its
// upload-in-progress state, so the reset can never clobber an import that
// just started.
async function importDeckFile(file: File): Promise<void> {
  if (!canMutateGroup.value) return
  showImportModal.value = true
  await nextTick()
  importModalRef.value?.importPptxFile(file)
}

async function importImageFilesDropped(files: File[]): Promise<void> {
  if (!canMutateGroup.value) return
  showImportModal.value = true
  await nextTick()
  importModalRef.value?.importImageFiles(files)
}

// Confirming an import appends one group entry per inner slide in the
// created deck, in deck order, at the end of the selected group — never a
// new plan item, never the slot factory/reindexer (Pattern 4, D-16).
async function onImportConfirmed(payload: { importId: string; section: ServiceSection }): Promise<void> {
  showImportModal.value = false
  if (!canMutateGroup.value) return
  if (!props.selectedSlot) return
  const slotId = props.selectedSlot.id
  try {
    const deck = await importedSlidesStore.getDeck(props.orgId, payload.importId)
    if (!deck) return
    const resolved = await props.ensureGroupMaterialized(slotId)
    if (!resolved) return
    const { entries, sourceSignature } = resolved
    const newEntries: GroupSlideEntry[] = deck.slides.map((innerSlide) => ({
      id: crypto.randomUUID(),
      order: 0, // overwritten by appendToGroup's renumber below
      sourceRef: {
        kind: 'imported',
        importId: payload.importId,
        innerSlideId: innerSlide.id,
        // R108: record the render-stable page (never `renderedPage: undefined` --
        // Firestore rejects undefined) so a multi-image deck's hand-added
        // entries can resolve without the ec217aa positional fallback.
        ...(innerSlide.sourcePage !== undefined ? { renderedPage: innerSlide.sourcePage } : {}),
      },
    }))
    // CR-02: see `onAddSlide` — `entries` (unsorted) is this append's base snapshot.
    const nextSlides = appendToGroup(entries, newEntries)
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, nextSlides, sourceSignature, entries)
  } catch (err) {
    console.error('Failed to append imported deck to group:', err)
  }
}

// Video drop (D-17's payoff) — appends one entry PER video, in drop order,
// carrying the video's own uploaded source and file name. NOT the group bed
// — 25-RESEARCH.md's stale recommendation must not be followed here. A
// failed upload appends nothing and leaves the group untouched: entries are
// only persisted once, in a single `replaceGroupSlides` call after every
// upload in this drop has resolved.
async function appendVideoEntries(files: File[]): Promise<void> {
  if (!canMutateGroup.value) return
  if (!props.selectedSlot || files.length === 0) return
  const slotId = props.selectedSlot.id
  try {
    const resolved = await props.ensureGroupMaterialized(slotId)
    if (!resolved) return
    // CR-02: `baseEntries` is the snapshot this whole drop's appends were
    // computed FROM (captured once, before the loop below builds up its own
    // list of new entries) — passed through to `replaceGroupSlides` as
    // `baseSlides` so a concurrent write is detected and merged rather than
    // silently overwritten.
    const baseEntries = resolved.entries
    const sourceSignature = resolved.sourceSignature
    resetMediaUpload()
    const newEntries: GroupSlideEntry[] = []
    for (const file of files) {
      const url = await uploadMedia(file, props.orgId)
      newEntries.push({
        id: crypto.randomUUID(),
        order: 0, // overwritten by appendToGroup's renumber below
        sourceRef: { kind: 'video', videoSrc: url, originalFileName: file.name },
      })
    }
    const nextSlides = appendToGroup(baseEntries, newEntries)
    await slideGroupsStore.replaceGroupSlides(props.orgId, slotId, nextSlides, sourceSignature, baseEntries)
  } catch (err) {
    console.error('Failed to append dropped video:', err)
  }
}

// Audio drop — sets the selected group's music bed (D-14/D-18) and appends
// NOTHING. Reuses 25-06's bed write path directly; no materialization step
// is needed here for the same reason `onAttachGroupMusic` needs none —
// `setGroupBedMedia`'s own merging skeleton-create already covers a plan
// item with no group document yet.
async function attachDroppedAudio(file: File): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    resetMediaUpload()
    const url = await uploadMedia(file, props.orgId)
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      bedAudioUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach dropped audio:', err)
  }
}

// Inline rejection notice — the phase's one backstop-status UI
// consideration. Cleared after a short interval; also cleared on unmount so
// no timer leaks past this component's lifetime (mirrors the autosave-timer
// gotcha already documented elsewhere in this codebase).
const rejectionNotice = ref<string | null>(null)
let rejectionTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * R054: a song group's own refusal message — `dropRouting.ts`'s
 * `UNSUPPORTED_FILE_MESSAGE` is about file TYPE (this file isn't audio/
 * image/video/deck) and would be misleading here, where the file IS a
 * supported kind but this group cannot own the resulting slide.
 */
const SONG_GROUP_UNSUPPORTED_DROP_MESSAGE =
  "This group's slides come from the song and are edited on the Song Lyrics screen."

function showRejectionNotice(message: string = UNSUPPORTED_FILE_MESSAGE): void {
  rejectionNotice.value = message
  if (rejectionTimeout) clearTimeout(rejectionTimeout)
  rejectionTimeout = setTimeout(() => {
    rejectionNotice.value = null
  }, 4000)
}

// The single dispatch point BOTH drop entry points (the tile's own `drop`
// emit and the whole-grid container's native `drop` event, below) route
// through — so they cannot diverge (25-07 Task 2 key link).
async function onFilesDropped(files: File[]): Promise<void> {
  // R036: the single dispatch point for BOTH drop entry points, so one guard
  // here closes the tile's `drop` emit and the grid container's native drop
  // together. Silent, deliberately — a locked service renders no drop tile and
  // no dragover highlight, so there is no affordance to explain a refusal for.
  if (!canWriteGroupMedia.value) return
  const resolved = resolveDrop(files)

  if (isSongGroup.value) {
    // R054: a song group still accepts group-level media (audio, the same
    // bed every other group's drop path already sets) — every other route
    // (deck, image, video) is refused with a visible notice instead of
    // silently appending a slide this locked group cannot own.
    if (resolved.deck || resolved.images.length > 0 || resolved.videos.length > 0) {
      showRejectionNotice(SONG_GROUP_UNSUPPORTED_DROP_MESSAGE)
    } else if (resolved.skipped.length > 0) {
      showRejectionNotice()
    }
    if (resolved.audio) {
      await attachDroppedAudio(resolved.audio)
    }
    return
  }

  if (resolved.skipped.length > 0) {
    showRejectionNotice()
  }

  if (resolved.deck) {
    await importDeckFile(resolved.deck)
  } else if (resolved.images.length > 0) {
    await importImageFilesDropped(resolved.images)
  }

  if (resolved.videos.length > 0) {
    await appendVideoEntries(resolved.videos)
  }

  if (resolved.audio) {
    await attachDroppedAudio(resolved.audio)
  }
}

// --- Whole-grid dragover highlight (D-13) ---
//
// A depth counter, not a boolean, guards against the constant child-element
// dragleave events that fire while the pointer moves across cards inside the
// container — a naive leave handler flickers the highlight off and on.
// Gated on the drag actually carrying files: `dataTransfer.types` (not
// `.files`, which is empty until drop fires) is the only file-presence
// signal available during dragenter/dragover.
const isDragOver = ref(false)
let dragDepth = 0

function dragCarriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onGridDragEnter(event: DragEvent): void {
  // No highlight on a locked service — the drop it advertises cannot happen.
  if (!canWriteGroupMedia.value) return
  if (!dragCarriesFiles(event)) return
  event.preventDefault()
  dragDepth += 1
  isDragOver.value = true
}

function onGridDragOver(event: DragEvent): void {
  if (!dragCarriesFiles(event)) return
  // Must preventDefault on dragover too — a drop event only fires on an
  // element whose dragover handler prevented default.
  event.preventDefault()
}

function onGridDragLeave(event: DragEvent): void {
  if (!dragCarriesFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragOver.value = false
}

function onGridDrop(event: DragEvent): void {
  event.preventDefault()
  dragDepth = 0
  isDragOver.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length > 0) void onFilesDropped(files)
}

// --- Task 3: drag-reorder within the selected group (D-11) ---
//
// Reuses the exact SortableJS pattern already established in
// `ServiceEditorView.vue`'s slot list: `handle`/`draggable` scoping and
// splice-and-reindex. Renders from state alone (Phase 29 removed the D-16
// single-step DOM revert) — `SlideCard` is keyed on a stable entry id, so
// the card list re-renders correctly from props once a write lands. The
// instance exists only while there is a stored group to write to AND the
// caller can write — a group with no stored document has no `slides` array
// to reorder, and would reject at the store.
const cardsContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

// ★ R036 composes into the EXISTING seam rather than beside it, so the watcher
// below — which already keys on `canReorder` — destroys the Sortable instance
// when the service locks and creates a fresh one when it reopens. Hiding the
// grips without that pairing would leave a reopened service undraggable until a
// page reload, a new defect introduced by the fix.
const canReorder = computed(() => canMutateGroup.value && props.group !== null)

// T-29-13 / UI-SPEC §5: a rejected reorder write is no longer silent. The
// DOM revert this component used to lean on is gone (CONTEXT.md's explicit
// D-16 removal) — the card list re-renders from `props.assembledSlideshow`,
// so a rejection changes no prop and nothing re-renders on its own.
// `gridRenderNonce` forces a rebuild of the keyed card list from props on
// rejection, which is what puts the dragged card back where the data says
// it belongs.
const reorderError = ref<string | null>(null)
const gridRenderNonce = ref(0)

function destroySortable(): void {
  sortableInstance?.destroy()
  sortableInstance = null
}

watch(
  [cardsContainerRef, canReorder],
  ([el, allowed]) => {
    if (el && allowed && !sortableInstance) {
      sortableInstance = Sortable.create(el, {
        handle: '.drag-handle',
        draggable: '.slide-card',
        animation: 150,
        ghostClass: 'opacity-30',
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        async onEnd(evt) {
          // R036: second lock over the instance itself. It is destroyed when
          // `canReorder` goes false, so this only catches a drag already in
          // flight when the service locks mid-gesture.
          if (!canReorder.value) return
          // Draggable-scoped indices only (T-29-11) — `oldIndex`/`newIndex`
          // count every element child of the container, including 25-07's
          // drop tile (a non-`.slide-card` sibling, always last today). Only
          // `oldDraggableIndex`/`newDraggableIndex` respect the `draggable:
          // '.slide-card'` selector. The tile happens to sit last, which
          // makes the un-prefixed pair latent rather than live here — fixed
          // anyway for symmetry with `ServiceEditorView.vue` and to guard the
          // one divergence case (dragging past the tile's own DOM position).
          if (evt.oldDraggableIndex == null || evt.newDraggableIndex == null) return
          if (evt.oldDraggableIndex === evt.newDraggableIndex) return

          // Read the current group and slot id from PROPS at call time —
          // never from values captured when the instance was created — since
          // the same container instance serves whichever group is selected.
          const currentGroup = props.group
          const currentSlot = props.selectedSlot
          if (!currentGroup || !currentSlot) return

          reorderError.value = null

          const sorted = [...currentGroup.slides].sort((a, b) => a.order - b.order)
          const moved = sorted.splice(evt.oldDraggableIndex, 1)[0]
          if (!moved) return
          sorted.splice(evt.newDraggableIndex, 0, moved)
          const reordered = sorted.map((entry, i) => ({ ...entry, order: i }))

          try {
            // CR-02: `currentGroup.slides` (read from props above, same as
            // `sorted`/`reordered` were derived from) is this write's base
            // snapshot — passed through so a concurrent append that lands
            // between this read and this write is detected and merged rather
            // than silently overwritten by the reorder's full-array replace.
            await slideGroupsStore.replaceGroupSlides(
              props.orgId,
              currentSlot.id,
              reordered,
              currentGroup.sourceSignature,
              currentGroup.slides,
            )
          } catch (err) {
            // T-29-13: surface the failure inline and force the card list to
            // rebuild from props (via `gridRenderNonce`) — the DOM revert this
            // used to lean on is gone, and `props.assembledSlideshow` changes
            // no prop on a rejected write, so nothing re-renders on its own.
            // `destroySortable()` releases the instance bound to the
            // container element the `:key` bump is about to discard; the
            // watcher below creates a fresh instance on the replacement
            // container once it lands, so a rejected reorder can never leave
            // real drag-and-drop silently unresponsive for the rest of the
            // session.
            reorderError.value = "Couldn't save this change — reverted. Try again."
            destroySortable()
            gridRenderNonce.value += 1
            console.error('[SlideGrid] reorder save failed:', err)
          }
        },
      })
    } else if ((!el || !allowed) && sortableInstance) {
      destroySortable()
    }
  },
  { flush: 'post' },
)

onUnmounted(() => {
  destroySortable()
  if (rejectionTimeout) clearTimeout(rejectionTimeout)
})
</script>
