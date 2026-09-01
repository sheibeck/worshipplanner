<script setup lang="ts">
/**
 * Shared READ-ONLY stage-plot renderer (R313/R314/R315, Phase 107).
 *
 * Pure presentational component — props only, NO Pinia store import and NO
 * Firebase import — so it is safe to mount on the public, unauthenticated
 * ShareView (Plan 03) as well as the locked-service editor view (Plan 02)
 * and the print layout. This is the ONE component all three surfaces reuse;
 * do not fork a second read-only rendering path.
 *
 * Positions are rendered directly from the given `xPct`/`yPct` percentages
 * as `left`/`top` inline style — never computed from a measured container
 * rect — so placement is resize-stable and reload-exact (R314) by
 * construction: a viewport resize recomputes pixel position via CSS alone,
 * with no JS recalculation step.
 *
 * Marker labels are bound via Vue text interpolation ONLY. A label
 * containing markup (e.g. an angle-bracketed string) always renders as
 * literal text, never parsed as DOM (T-107-03 XSS mitigation).
 */
import { computed } from 'vue'
import type { StageMarker } from '@/types/service'
import { markerKindAccentClass } from '@/utils/stageLayout'

const props = withDefaults(
  defineProps<{
    elements: StageMarker[]
    theme?: 'dark' | 'light'
  }>(),
  {
    theme: 'dark',
  },
)

const onstageMarkers = computed(() => props.elements.filter((marker) => marker.zone === 'onstage'))
const offstageMarkers = computed(() => props.elements.filter((marker) => marker.zone === 'offstage'))

function markerStyle(marker: StageMarker): Record<string, string> {
  return { left: `${marker.xPct}%`, top: `${marker.yPct}%` }
}

function accentClass(marker: StageMarker): string {
  return markerKindAccentClass(marker.kind, props.theme)
}
</script>

<template>
  <div
    data-testid="stage-layout-view"
    :class="['grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]', theme === 'dark' ? 'bg-gray-950' : 'bg-white']"
  >
    <div>
      <h3
        :class="[
          'mb-2 text-xs font-semibold uppercase tracking-wide',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
        ]"
      >
        ON STAGE
      </h3>
      <div
        data-testid="stage-zone-onstage"
        :class="[
          'relative aspect-video w-full overflow-hidden rounded-lg',
          theme === 'dark' ? 'border border-gray-800 bg-gray-900' : 'border border-gray-200 bg-gray-50',
        ]"
      >
        <div
          v-for="marker in onstageMarkers"
          :key="marker.id"
          data-testid="stage-marker"
          class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm"
          :class="theme === 'dark' ? 'border border-gray-700 bg-gray-800 text-gray-200' : 'border border-gray-300 bg-white text-gray-800'"
          :style="markerStyle(marker)"
        >
          <span class="inline-block h-2 w-2 shrink-0 rounded-full border" :class="accentClass(marker)" />
          <span class="truncate">{{ marker.label }}</span>
        </div>
      </div>
    </div>

    <div>
      <h3
        :class="[
          'mb-2 text-xs font-semibold uppercase tracking-wide',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
        ]"
      >
        OFF STAGE (SIDE)
      </h3>
      <div
        data-testid="stage-zone-offstage"
        :class="[
          'relative aspect-video w-full overflow-hidden rounded-lg',
          theme === 'dark' ? 'border border-dashed border-gray-700 bg-gray-950' : 'border border-dashed border-gray-300 bg-gray-50',
        ]"
      >
        <div
          v-for="marker in offstageMarkers"
          :key="marker.id"
          data-testid="stage-marker"
          class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm"
          :class="theme === 'dark' ? 'border border-gray-700 bg-gray-800 text-gray-200' : 'border border-gray-300 bg-white text-gray-800'"
          :style="markerStyle(marker)"
        >
          <span class="inline-block h-2 w-2 shrink-0 rounded-full border" :class="accentClass(marker)" />
          <span class="truncate">{{ marker.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
