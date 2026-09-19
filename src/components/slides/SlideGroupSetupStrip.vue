<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="slide-group-setup-strip">
    <span
      v-for="chip in chips"
      :key="chip.id"
      class="relative inline-flex"
      :ref="(el) => setWrapperRef(chip.id, el as Element | null)"
    >
      <button
        v-if="editable"
        type="button"
        class="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :class="chip.pillClass"
        aria-haspopup="dialog"
        :aria-expanded="openChip === chip.id"
        :aria-controls="popoverId(chip.id)"
        :aria-label="chip.ariaLabel"
        :data-testid="'slide-group-setup-chip-' + chip.id"
        :ref="(el) => setChipRef(chip.id, el as Element | null)"
        @click="toggle(chip.id)"
      >
        <span class="text-[11px] text-gray-500">{{ chip.label }}</span>
        <span class="truncate max-w-[10rem]" :class="chip.valueClass">{{ chip.value }}</span>
        <span class="text-[9px] text-gray-500" aria-hidden="true">▾</span>
      </button>
      <span
        v-else
        class="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] cursor-default"
        :class="chip.pillClass"
        :data-testid="'slide-group-setup-chip-' + chip.id"
      >
        <span class="text-[11px] text-gray-500">{{ chip.label }}</span>
        <span class="truncate max-w-[10rem]" :class="chip.valueClass">{{ chip.value }}</span>
      </span>

      <!-- Popover shell (142-UI-SPEC.md §2-5). Plain position:absolute, no
           portal-based mount: the panel this strip lives in sits above the
           grid's own overflow-y-auto region, so it is never clipped by a
           scroll ancestor. alignRight is computed on open, not CSS-only. -->
      <div
        v-if="openChip === chip.id && editable"
        :id="popoverId(chip.id)"
        role="dialog"
        aria-modal="false"
        :aria-label="chip.label + ' options'"
        tabindex="-1"
        :ref="(el) => setPopoverRef(el as Element | null)"
        class="absolute top-full z-20 mt-1.5 rounded-lg border border-gray-700 bg-gray-800 p-3 shadow-2xl"
        :class="[chip.id === 'audio' ? 'w-[258px]' : 'w-[232px]', alignRight ? 'right-0' : 'left-0']"
        :data-testid="'slide-group-setup-popover-' + chip.id"
      >
        <SlotVideoOutputControl
          v-if="chip.id === 'display'"
          :slot="selectedSlot"
          :editable="true"
          @change="(v) => emit('video-output-change', v)"
        />
        <BackgroundControl
          v-else-if="chip.id === 'background'"
          variant="chip-popover"
          :image-url="group?.backgroundImageUrl"
          :inherited-from="inheritedBackground"
          :recents="recentBackgrounds"
          :is-editor="true"
          :org-id="orgId"
          remove-label="Remove group background"
          flush
          @attach="(url) => emit('attach-background', url)"
          @remove="emit('remove-background')"
        />
        <!-- :is-editor="true" is deliberate — the chip's own `editable` gate is
             the single source of lockedness; the popover (and this control)
             only ever mounts for an editable chip in the first place
             (142-RESEARCH.md Open Question 2). -->
        <SlideGroupMusicControl
          v-else
          :audio-url="group?.bedAudioUrl"
          :bed-vamp-id="group?.bedVampId"
          :bed-vamp-label="group?.bedVampLabel"
          :vamps="vamps"
          :vamps-loading="vampsLoading"
          :is-editor="true"
          :org-id="orgId"
          flush
          @attach="(url) => emit('attach-music', url)"
          @remove="emit('remove-music')"
          @attach-vamp="(vamp) => emit('attach-vamp', vamp)"
          @close="close"
        />
      </div>
    </span>

    <slot name="trailing" />
    <span
      class="ml-auto ms-0 basis-full text-right text-[10.5px] text-gray-500 sm:basis-auto sm:ms-auto"
      data-testid="slide-group-setup-caption"
    >{{ scopeCaption }}</span>
  </div>
</template>

<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlideGroupSetupStrip.vue)
// 142 — 7a chip row; UI state only, emit-only, SlideGrid owns every write
import { ref, computed, watch, nextTick, onUnmounted, useId } from 'vue'
import SlotVideoOutputControl from './SlotVideoOutputControl.vue'
import BackgroundControl from './BackgroundControl.vue'
import SlideGroupMusicControl from './SlideGroupMusicControl.vue'
import { bedAudioLabel, backgroundImageLabel } from './slideDisplay'
import type { ServiceSlot } from '@/types/service'
import type { SlideGroup } from '@/types/slideGroup'
import type { Vamp } from '@/types/vamp'

type ChipId = 'display' | 'background' | 'audio'
type ChipState = 'set' | 'unset' | 'vamp-no-mp3' | 'inherited'

interface Chip {
  id: ChipId
  label: string
  value: string
  state: ChipState
  pillClass: string
  valueClass: string
  ariaLabel: string
}

const props = withDefaults(defineProps<{
  selectedSlot: ServiceSlot
  group: SlideGroup | null
  editable: boolean
  slideCount: number
  orgId: string
  inheritedBackground?: { url: string; label: string }
  recentBackgrounds?: { url: string; label: string }[]
  vamps?: Vamp[]
  vampsLoading?: boolean
}>(), {
  recentBackgrounds: () => [],
  vamps: () => [],
  vampsLoading: false,
})

const emit = defineEmits<{
  'attach-music': [url: string]
  'remove-music': []
  'attach-vamp': [vamp: Vamp]
  'attach-background': [url: string]
  'remove-background': []
  'video-output-change': [videoOutput: NonNullable<ServiceSlot['videoOutput']>]
}>()

const uid = useId()
function popoverId(id: ChipId): string {
  return `${uid}-popover-${id}`
}

const VALUE_CLASS: Record<ChipState, string> = {
  set: 'text-gray-200',
  unset: 'text-gray-500',
  'vamp-no-mp3': 'text-amber-400',
  inherited: 'text-gray-300',
}

/**
 * `bedVampLabel` is stored as `{name} · {key}` (260918-nm2) — the no-MP3 chip
 * copy needs the name alone, so this strips the trailing ` · {key}` segment
 * rather than re-deriving it from the vamp library (the label may be stale
 * by design, same as everywhere else it's rendered).
 */
function vampNameFromLabel(label: string | undefined): string {
  if (!label) return 'Vamp'
  const idx = label.lastIndexOf(' · ')
  return idx >= 0 ? label.slice(0, idx) : label
}

const chips = computed<Chip[]>(() => {
  const openId = openChip.value
  const drafts: { id: ChipId; label: string; value: string; state: ChipState }[] = []

  const displayMode = props.selectedSlot.videoOutput?.mode === 'banner' ? 'Banner' : 'Full-screen'
  drafts.push({ id: 'display', label: 'Display', value: displayMode, state: 'set' })

  if (props.group?.backgroundImageUrl) {
    drafts.push({
      id: 'background',
      label: 'Background',
      value: backgroundImageLabel(props.group.backgroundImageUrl),
      state: 'set',
    })
  } else if (props.inheritedBackground) {
    drafts.push({
      id: 'background',
      label: 'Background',
      value: `${props.inheritedBackground.label} (song)`,
      state: 'inherited',
    })
  } else {
    drafts.push({ id: 'background', label: 'Background', value: 'Add', state: 'unset' })
  }

  if (props.group?.bedVampId) {
    if (props.group.bedAudioUrl) {
      drafts.push({
        id: 'audio',
        label: 'Audio',
        value: `♪ ${props.group.bedVampLabel ?? ''}`,
        state: 'set',
      })
    } else {
      drafts.push({
        id: 'audio',
        label: 'Audio',
        value: `♪ ${vampNameFromLabel(props.group.bedVampLabel)} · no MP3`,
        state: 'vamp-no-mp3',
      })
    }
  } else if (props.group?.bedAudioUrl) {
    drafts.push({ id: 'audio', label: 'Audio', value: bedAudioLabel(props.group.bedAudioUrl), state: 'set' })
  } else {
    drafts.push({ id: 'audio', label: 'Audio', value: 'Add', state: 'unset' })
  }

  return drafts.map((chip) => {
    const isOpen = openId === chip.id
    let pillClass = isOpen
      ? 'border-indigo-700 bg-indigo-950/40'
      : chip.state === 'unset'
        ? 'border-dashed border-gray-700 bg-transparent'
        : 'border-gray-700 bg-gray-800'
    if (props.editable) pillClass += ' hover:border-indigo-700'

    const ariaLabel = isOpen
      ? `${chip.label} options, expanded`
      : `${chip.label}: ${chip.value}. Opens ${chip.label} options.`

    return { ...chip, pillClass, valueClass: VALUE_CLASS[chip.state], ariaLabel }
  })
})

const scopeCaption = computed(() => {
  const n = props.slideCount
  return `applies to all ${n} slide${n === 1 ? '' : 's'} in this group, unless a slide sets its own`
})

const openChip = ref<ChipId | null>(null)
const alignRight = ref(false)
const popoverRef = ref<HTMLElement | null>(null)
const chipRefs: Partial<Record<ChipId, HTMLElement>> = {}
const wrapperRefs: Partial<Record<ChipId, HTMLElement>> = {}

function setChipRef(id: ChipId, el: Element | null): void {
  if (el) chipRefs[id] = el as HTMLElement
  else delete chipRefs[id]
}

function setWrapperRef(id: ChipId, el: Element | null): void {
  if (el) wrapperRefs[id] = el as HTMLElement
  else delete wrapperRefs[id]
}

function setPopoverRef(el: Element | null): void {
  popoverRef.value = el as HTMLElement | null
}

function toggle(id: ChipId): void {
  if (!props.editable) return
  openChip.value = openChip.value === id ? null : id
}

function close(): void {
  openChip.value = null
}

function closeAndRefocus(): void {
  const id = openChip.value
  close()
  void nextTick(() => {
    if (id) chipRefs[id]?.focus()
  })
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeAndRefocus()
}

function onPointerDown(e: PointerEvent): void {
  const id = openChip.value
  const wrapper = id ? wrapperRefs[id] : undefined
  if (wrapper && !wrapper.contains(e.target as Node)) close()
}

/**
 * Focus-on-open target (142-UI-SPEC.md Accessibility Contract): the active
 * tab for Audio, the None swatch for Background, the first tile for Display
 * — all three are the first matching element in document order, so one
 * selector covers all three popovers (mirrors SlideActionMenu.vue's
 * `panelRef.value?.querySelector(...)?.focus()` shape).
 */
function focusIntoPopover(): void {
  const el = popoverRef.value
  if (!el) return
  // The active tab must win over an earlier, merely-first, plain button —
  // a combined CSS selector list returns the first DOM match across ALL
  // alternatives, not the first-listed selector, so a non-default active
  // Audio tab (e.g. Vamp) would otherwise wrongly focus the first (None) tab.
  const activeTab = el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
  const target = activeTab ?? el.querySelector<HTMLElement>('button:not([disabled]), input:not([type="hidden"])')
  ;(target ?? el).focus()
}

watch(openChip, async (id) => {
  if (id) {
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeydown)
    alignRight.value = false
    await nextTick()
    const rect = popoverRef.value?.getBoundingClientRect()
    if (rect && rect.right > window.innerWidth) alignRight.value = true
    focusIntoPopover()
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('keydown', onKeydown)
})

// Same reset precedent as SlideGrid.vue's openMenuEntryId watcher (ADR-0115).
watch(() => props.selectedSlot.id, () => {
  openChip.value = null
})

// Force-close an already-open popover if the lock flips mid-session
// (WR-01, 142-REVIEW.md): the chip button swaps to an inert span, but
// without this the popover kept mounting with hardcoded-editable child
// controls and no feedback on click.
watch(() => props.editable, (editable) => {
  if (!editable) close()
})
</script>
