<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/stage/StageMarkerChip.vue)
import { computed } from 'vue'
import type { StageMarker } from '@/types/service'
import { stageMarkerIcon, stageMarkerSkinClass, stageMarkerTypeLabel } from '@/utils/stageLayout'
import StageKindIcon from '@/components/stage/StageKindIcon.vue'

const props = withDefaults(
  defineProps<{
    marker: StageMarker
    theme?: 'dark' | 'light'
    selected?: boolean
    interactive?: boolean
    print?: boolean
  }>(),
  { theme: 'dark', selected: false, interactive: false, print: false },
)

function tileClass(): string {
  if (props.print) return 'border-2 border-black bg-white text-black'
  return stageMarkerSkinClass(props.marker, props.theme, props.selected)
}

const iconName = computed(() => stageMarkerIcon(props.marker))
// The TYPE label (band role name, or fixed kind, "+ Vocal" when the player
// also sings) shown alongside the free-text label so a tile reads as both a
// name and a type.
const typeLabel = computed(() => stageMarkerTypeLabel(props.marker))

// Print uses larger, black text for legibility; on screen a slightly larger
// baseline than before for readability (a11y).
const labelClass = computed(() => (props.print ? 'text-[13px] font-semibold text-black' : props.theme === 'dark' ? 'text-[11px] font-medium text-gray-100' : 'text-[11px] font-medium text-gray-800'))
const personClass = computed(() => (props.print ? 'text-[12px] font-medium text-black' : props.theme === 'dark' ? 'text-[11px] text-indigo-300' : 'text-[11px] text-indigo-600'))
const typeClass = computed(() => (props.print ? 'text-[11px] font-semibold text-black' : props.theme === 'dark' ? 'text-[10.5px] text-gray-400' : 'text-[10.5px] text-gray-500'))
const noteClass = computed(() => (props.print ? 'text-[11px] text-black' : props.theme === 'dark' ? 'text-[10.5px] text-gray-400' : 'text-[10.5px] text-gray-500'))
</script>

<template>
  <!-- Centering is done by the caller's inline `transform: translate(-50%,-50%)`
       (StageLayoutView.markerStyle / StageLayoutEditor.chipStyle), NOT a
       Tailwind `-translate-x/y-1/2` class here. In Tailwind v4 that class emits
       the CSS `translate` property, which STACKS with the editor's inline
       `transform` translate and double-shifts the tile by half its width — so a
       marker looked ~50px further left while editing than once locked. One
       inline transform on both surfaces keeps them pixel-identical. -->
  <div
    data-testid="stage-marker"
    :data-marker-id="marker.id"
    class="absolute flex flex-col items-center gap-1"
    :class="[print ? 'w-[120px]' : 'w-[100px]', interactive ? 'cursor-grab touch-none active:cursor-grabbing' : '', selected ? 'z-30' : 'z-10']"
  >
    <div
      class="flex items-center justify-center rounded-xl border"
      :class="[print ? 'h-12 w-12' : 'h-11 w-11', tileClass(), selected ? 'ring-2 ring-indigo-400/40' : '']"
    >
      <StageKindIcon :name="iconName" :class="print ? 'h-6 w-6' : 'h-5 w-5'" />
    </div>
    <!-- Free-text label (the name), when set. -->
    <div v-if="marker.label" class="max-w-[120px] text-center leading-tight" :class="labelClass">{{ marker.label }}</div>
    <!-- Assigned person, when chosen from the service's roster. -->
    <div v-if="marker.personName" class="max-w-[120px] text-center leading-tight" :class="personClass">{{ marker.personName }}</div>
    <!-- Type (kind) — shown so a tile reads as both name and type, but hidden
         when it would just duplicate the label. -->
    <div
      v-if="typeLabel && typeLabel !== marker.label"
      class="max-w-[120px] text-center uppercase leading-tight tracking-wide"
      :class="typeClass"
    >
      {{ typeLabel }}
    </div>
    <div v-if="marker.note" class="line-clamp-2 max-w-[120px] text-center italic leading-tight" :class="noteClass">{{ marker.note }}</div>
  </div>
</template>
