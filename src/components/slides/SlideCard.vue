<template>
  <div
    role="button"
    tabindex="0"
    class="slide-card relative w-full rounded-lg border bg-gray-900 p-3 text-left transition-colors"
    :class="selected ? 'border-indigo-500' : 'border-gray-800 hover:bg-gray-800/60'"
    :data-testid="`slide-card-${assembledSlide.slide.id}`"
    :data-selected="selected ? 'true' : 'false'"
    :style="typographyStyle"
    @click="emit('select', assembledSlide.slide.id)"
    @keydown.enter="emit('select', assembledSlide.slide.id)"
    @keydown.space.prevent="emit('select', assembledSlide.slide.id)"
  >
    <div
      v-if="menuItems.length > 0"
      class="absolute right-1 top-1 z-10"
    >
      <SlideActionMenu
        :entry-id="assembledSlide.slide.id"
        :items="menuItems"
        :open="menuOpen"
        @toggle="emit('menu-toggle', assembledSlide.slide.id)"
        @select="(key) => emit('menu-select', assembledSlide.slide.id, key)"
      />
    </div>

    <div
      class="relative h-[140px] overflow-hidden rounded-md"
      :class="isBlackout ? 'bg-black' : 'bg-gray-950/40'"
      data-testid="slide-card-preview"
    >
      <span
        class="absolute left-2 top-1.5 text-[10px] uppercase tracking-wide text-indigo-300"
        data-testid="slide-card-content-label"
      >{{ contentLabel }}</span>
      <span
        class="absolute right-9 top-1.5 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-md border border-indigo-800 bg-indigo-950/50 px-1 text-[11px] font-medium text-indigo-300"
        data-testid="slide-card-number"
      >{{ number }}</span>

      <div
        v-if="renderPending"
        class="flex h-full w-full flex-col items-center justify-center gap-2"
        data-testid="slide-card-render-pending"
      >
        <svg
          class="h-4 w-4 animate-spin text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span class="text-[11px] text-gray-300">Rendering&hellip;</span>
      </div>
      <div
        v-else-if="renderFailed"
        class="flex h-full w-full flex-col items-center justify-center gap-2 border border-red-900/40 bg-red-950/20 px-3 text-center"
        data-testid="slide-card-render-failed"
      >
        <svg
          class="h-4 w-4 text-red-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span class="text-[11px] text-red-300">Render failed</span>
        <span class="text-[13px] leading-normal text-red-400/80">{{ renderFailureCopy }}</span>
      </div>
      <img
        v-else-if="isImage"
        :src="imageSrc"
        :alt="imageAlt"
        class="h-full w-full object-contain"
        data-testid="slide-card-image"
      />
      <!-- Blackout (R303, Phase 105): centered, since there is no multi-line
           content to clamp — the card previews literally what will project
           (bg-black pane above + this one short caption). -->
      <p
        v-else-if="isBlackout"
        class="flex h-full w-full items-center justify-center px-2 text-center text-[13px] leading-normal text-gray-200"
        data-testid="slide-card-body"
      >{{ bodyText }}</p>
      <p
        v-else
        class="line-clamp-6 whitespace-pre-line px-2 pt-6 text-[13px] leading-normal text-gray-200"
        data-testid="slide-card-body"
      >{{ bodyText }}</p>
    </div>

    <div class="mt-2 flex items-center gap-1.5" data-testid="slide-card-footer">
      <span
        class="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium"
        :class="kindBadgeClass"
        data-testid="slide-card-kind-badge"
      >{{ assembledSlide.slotKind }}</span>
      <!--
        WR-03 (48-REVIEW): the invisible hit-area padding is asymmetric, not
        the uniform `p-3.5 -m-3.5` (44px on every side) 48-UI-SPEC.md's
        Spacing Scale exception describes. A uniform 14px expansion in every
        direction overlaps the kind-badge span to the left and the footer
        label span to the right (only `gap-1.5`/6px away) AND the preview
        `div` above (only `mt-2`/8px away) — because this handle carries
        `@click.stop` and paints on top within any overlap, those slivers
        would silently swallow clicks meant for card selection rather than
        letting them reach the card's own `@click` handler. Left/right are
        capped at 6px (exactly the `gap-1.5` to each neighbor) and top is
        capped at 8px (exactly the `mt-2` to the preview) so the enlarged hit
        area never crosses into a neighboring hit-testable box. Bottom keeps
        the full 14px — nothing sits directly below the footer row within
        this card, and `SlideGrid.vue`'s `gap-4` (16px) between grid cells
        comfortably absorbs the 2px this extends past the card's own
        `p-3` (12px) bottom padding.
        This means the handle's actual footprint (28x38px) is smaller than
        the 44x44px floor in the directions capped above — an unavoidable
        consequence of a touch target this close to other content in a
        44px-tall row. Real-thumb reachability at this reduced size remains
        the 🧪 physical-device backstop 48-UI-SPEC.md's own UI Considerations
        table already calls out for this exact affordance; it is not,
        and cannot be, proven from source/unit tests alone.
      -->
      <span
        v-if="reorderable"
        class="drag-handle flex-shrink-0 cursor-grab pl-1.5 -ml-1.5 pr-1.5 -mr-1.5 pt-2 -mt-2 pb-3.5 -mb-3.5 text-gray-600 hover:text-gray-400 active:cursor-grabbing"
        tabindex="0"
        aria-label="Reorder slide"
        :aria-describedby="labelId"
        data-testid="slide-card-drag-handle"
        @click.stop
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
        </svg>
      </span>
      <span :id="labelId" class="truncate text-[11px] text-gray-400" data-testid="slide-card-label">{{ footerLabel }}</span>
      <span
        v-if="hasAudio"
        class="ml-auto inline-flex items-center rounded bg-indigo-950/50 px-1.5 py-0.5 text-[11px] text-indigo-300"
        aria-label="Slide has audio attached"
        data-testid="slide-card-audio-chip"
      >&#9834;</span>
      <!--
        Provenance chip only — this phase deliberately does NOT composite the
        resolved background image behind the card preview above. Compositing
        a photo behind existing preview content correctly (contrast, crop,
        scrim) is presentation-rendering work that belongs to the next phase;
        this chip is this phase's entire card-level answer to "can the user
        tell a background is set," and it answers both presence and
        provenance (33-UI-SPEC.md § Phase-Specific Component Contracts §8).
      -->
      <span
        v-if="backgroundSource"
        class="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium"
        :class="backgroundSource === 'slide' ? 'bg-indigo-950/50 text-indigo-300' : 'bg-gray-800 text-gray-400 border border-gray-700'"
        data-testid="slide-card-background-chip"
      >{{ backgroundSource === 'slide' ? 'Background' : backgroundSource === 'group' ? 'From group' : 'From song' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Presentational, prop-driven slide card (Phase 25 Task 1, drag grip added
 * 25-05 Task 3). Renders one assembled slide inside `SlideGrid.vue` — text
 * body plus metadata only; real formatted-slide rendering remains deferred
 * (D-10). Holds no selection state of its own: clicking emits `select` with
 * the slide's id, and the PARENT (`SlideGrid`/`SlidesTab`) owns which card is
 * currently selected — this is the whole of the D-12 seam Phase 26's Edit
 * Slide drawer will open against.
 *
 * The drag grip (`reorderable` prop) starts a SortableJS drag scoped by
 * `SlideGrid.vue` — clicking the grip itself (`@click.stop`) never selects
 * the card, keeping click-to-select and drag cleanly separate (D-12).
 *
 * The root element is a `role="button"` div, not a native `<button>`
 * (33-UI-SPEC.md §1) — a real button cannot legally nest another interactive
 * element, and `SlideActionMenu`'s trigger must be a real `<button>` for its
 * `aria-haspopup`/`aria-expanded` to be meaningful. `@click`/`@keydown.enter`/
 * `@keydown.space` reproduce native button activation exactly; this is a
 * like-for-like semantic swap, not a downgrade.
 *
 * The card holds NO menu open-state of its own — `menuOpen` is a prop, so the
 * parent grid can enforce exactly one open menu across all cards with a
 * single ref.
 *
 * Reads no store and calls no composable.
 */
import { computed } from 'vue'
import type { AssembledSlide, ImageSlide } from '@/types/slide'
import {
  KIND_BADGE_CLASSES,
  slideContentLabel,
  slideBodyText,
  slideFooterLabel,
  renderFailureSentence,
} from './slideDisplay'
import type { MenuItem, MenuItemKey } from './slideDisplay'
import SlideActionMenu from './SlideActionMenu.vue'
import { cssVarsFor } from '@/utils/slideTypography'

const props = withDefaults(
  defineProps<{
    /** The assembled slide this card renders. */
    assembledSlide: AssembledSlide
    /** One-based slide number within the selected group (not the whole service). */
    number: number
    /** True only for the currently-selected card — the sole visual difference (accent border). */
    selected: boolean
    /** True when the parent grid can offer drag-reorder for this card (editor + a stored group document to reorder) — decided by `SlideGrid`, never by this component. */
    reorderable?: boolean
    /** Pre-computed by the parent via `slideActionMenuItems` — an empty list (the default) renders no menu at all. */
    menuItems?: MenuItem[]
    /** Parent-controlled open state for this card's menu — the card holds none of its own. */
    menuOpen?: boolean
    /**
     * CSS custom-property + font-family style for this card's own root
     * (46-04, R093) — computed once by `SlideGrid.vue` from
     * `cssVarsFor(authStore.settings.slideTypography)` and passed down
     * rather than read from the store here: this component still "reads no
     * store and calls no composable" (see the header comment above).
     * Defaults to `cssVarsFor`'s own Inter/400/md fallback so every
     * standalone mount (this component's own test suite) still carries the
     * correct default custom properties.
     */
    typographyStyle?: Record<string, string | number>
  }>(),
  {
    typographyStyle: () => ({ ...cssVarsFor(undefined), fontFamily: 'var(--slide-font-family)' }),
  },
)

const emit = defineEmits<{
  select: [slideId: string]
  'menu-toggle': [slideId: string]
  'menu-select': [slideId: string, key: MenuItemKey]
}>()

const isImage = computed(() => props.assembledSlide.slide.contentKind === 'image')
/** R303/UI-SPEC card contract: a blackout slide's preview pane goes bg-black and its body caption centers, so the card previews literally what will project. */
const isBlackout = computed(() => props.assembledSlide.slide.contentKind === 'blackout')
const imageSrc = computed(() => (props.assembledSlide.slide as ImageSlide).imageUrl)
const imageAlt = computed(() => (props.assembledSlide.slide as ImageSlide).altText ?? '')

/**
 * Phase 42 (R079/R080) render-state discriminator, read straight off the
 * assembled slide's `SlideBase.renderState` field. Its PRESENCE gates the
 * preview box's branch chain ahead of `isImage`/body-text — a slide carrying
 * `renderState` never carries drawable content (`SlideBase`'s own doc
 * comment).
 */
const renderState = computed(() => props.assembledSlide.slide.renderState)
const renderPending = computed(() => renderState.value === 'pending')
const renderFailed = computed(() => renderState.value === 'failed')
/** Routed through `renderFailureSentence` — the ONE sanctioned path from the raw `renderFailureReason` slug to the DOM (T-42-04). */
const renderFailureCopy = computed(() => renderFailureSentence(props.assembledSlide.slide.renderFailureReason))

const contentLabel = computed(() => slideContentLabel(props.assembledSlide.slide))
const bodyText = computed(() => slideBodyText(props.assembledSlide.slide))
const footerLabel = computed(() => slideFooterLabel(props.assembledSlide.slide))
const kindBadgeClass = computed(() => KIND_BADGE_CLASSES[props.assembledSlide.slotKind])
const hasAudio = computed(() => Boolean(props.assembledSlide.slide.audioUrl))
/** Read directly off the already-resolved, already-reactive assembled slide — never a locally cached copy — so the chip recomputes for free whenever `assembledSlideshow` recomputes (33-UI-SPEC.md § E4 staleness backstop). */
const backgroundSource = computed(() => props.assembledSlide.slide.backgroundSource)
const menuItems = computed(() => props.menuItems ?? [])
const menuOpen = computed(() => props.menuOpen ?? false)
/** Associates the drag handle's `aria-describedby` with this card's own footer label, so a screen reader announces which slide it moves. */
const labelId = computed(() => `slide-label-${props.assembledSlide.slide.id}`)
</script>

<style scoped>
/*
 * R093 (46-04) — reads the `--slide-font-*` custom properties `typographyStyle`
 * sets on this card's own root above. Unlayered scoped styles win over
 * Tailwind's `@layer utilities` regardless of selector specificity, so this
 * overrides the template's fixed `text-[13px]` class without touching it.
 */
[data-testid='slide-card-body'] {
  font-weight: var(--slide-font-weight);
  font-size: calc(13px * var(--slide-font-scale));
}
</style>
