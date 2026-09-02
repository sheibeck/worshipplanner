<script setup lang="ts">
// See .planning/codebase/STACK.md (§ Component & Composable Stack Notes (R318) -> src/components/stage/StageLayoutView.vue)
import type { StageMarker } from '@/types/service'
import StageRoom from '@/components/stage/StageRoom.vue'
import StageMarkerChip from '@/components/stage/StageMarkerChip.vue'

const props = withDefaults(
  defineProps<{
    elements: StageMarker[]
    theme?: 'dark' | 'light'
    /** High-contrast black-and-white variant for the tech team's printed sheet
     *  (outline stage, larger legible black type). */
    print?: boolean
  }>(),
  { theme: 'dark', print: false },
)

function markerStyle(marker: StageMarker): Record<string, string> {
  // Centre the tile on its point via inline `transform` — the SAME single
  // mechanism the editor uses (StageMarkerChip no longer carries a Tailwind
  // translate class), so a marker sits pixel-identically here and while editing.
  return { left: `${marker.xPct}%`, top: `${marker.yPct}%`, transform: 'translate(-50%, -50%)' }
}
</script>

<template>
  <!-- On screen the fixed-width room scrolls on a narrow viewport; in print it
       must NOT show a scrollbar (owner) — everything fits, so clip instead. -->
  <div data-testid="stage-layout-view" :class="props.print ? 'overflow-hidden' : 'overflow-x-auto'">
    <StageRoom :theme="props.theme" :print="props.print">
      <StageMarkerChip
        v-for="marker in props.elements"
        :key="marker.id"
        :marker="marker"
        :theme="props.theme"
        :print="props.print"
        :style="markerStyle(marker)"
      />
      <div
        v-if="props.elements.length === 0"
        class="pointer-events-none absolute left-1/2 top-[34%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      >
        <span class="text-sm" :class="props.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">
          No stage layout
        </span>
      </div>
    </StageRoom>
  </div>
</template>
