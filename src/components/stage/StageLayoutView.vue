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

// WR-03 dedup: the on-stage and off-stage zone blocks used to be two
// verbatim-duplicated `<div>` trees below (same structure, only the
// heading text/testid/dashed-border class/marker list differed) — a
// future markup change had to be applied twice or the zones would drift.
// A single `v-for` over this descriptor array now renders both from one
// template block.
const zones = computed(() => [
  { key: 'onstage' as const, label: 'ON STAGE', dashed: false, markers: onstageMarkers.value },
  { key: 'offstage' as const, label: 'OFF STAGE (SIDE)', dashed: true, markers: offstageMarkers.value },
])

function zoneContainerClass(dashed: boolean): string {
  const base = 'relative aspect-video w-full overflow-hidden rounded-lg'
  if (props.theme === 'light') {
    return dashed ? `${base} border border-dashed border-gray-300 bg-gray-50` : `${base} border border-gray-200 bg-gray-50`
  }
  return dashed ? `${base} border border-dashed border-gray-700 bg-gray-950` : `${base} border border-gray-800 bg-gray-900`
}

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
    <div v-for="zone in zones" :key="zone.key">
      <h3
        :class="[
          'mb-2 text-xs font-semibold uppercase tracking-wide',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
        ]"
      >
        {{ zone.label }}
      </h3>
      <div :data-testid="`stage-zone-${zone.key}`" :class="zoneContainerClass(zone.dashed)">
        <div
          v-for="marker in zone.markers"
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
