<script setup lang="ts">
/**
 * Shared draggable marker-chip row for `StageLayoutEditor.vue` (Phase 107,
 * WR-03 dedup). This block used to be copy-pasted verbatim between the
 * on-stage and off-stage zone containers — a ~40-line block (chip div,
 * accent dot, label span, edit/remove buttons with identical SVGs and
 * handlers) that could silently drift between zones on any future markup
 * change. Extracted into a single component both zones now render from a
 * `v-for`, so there is exactly ONE place to change the chip markup.
 *
 * All drag/edit/remove behavior stays owned by the parent — this component
 * only re-emits the raw pointer events plus `edit`/`remove` intents, never
 * touches `dragState` itself, so `StageLayoutEditor.vue`'s single source of
 * pointer-lifecycle truth (WR-01/WR-02 guards) is untouched by this split.
 */
import type { StageMarker } from '@/types/service'

defineProps<{
  marker: StageMarker
  accentClass: string
  chipStyle: Record<string, string>
}>()

const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  pointercancel: [event: PointerEvent]
  edit: []
  remove: []
}>()
</script>

<template>
  <div
    data-testid="stage-marker"
    :data-marker-id="marker.id"
    class="group absolute flex cursor-grab touch-none select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-200 active:cursor-grabbing"
    :style="chipStyle"
    @pointerdown="emit('pointerdown', $event)"
    @pointermove="emit('pointermove', $event)"
    @pointerup="emit('pointerup', $event)"
    @pointercancel="emit('pointercancel', $event)"
  >
    <span class="inline-block h-2 w-2 shrink-0 rounded-full border" :class="accentClass" />
    <span class="max-w-[10rem] truncate">{{ marker.label }}</span>
    <span class="ml-1 hidden items-center gap-1 group-hover:flex group-focus-within:flex">
      <button
        type="button"
        data-testid="marker-edit-button"
        aria-label="Edit marker"
        class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-gray-400 hover:text-gray-200"
        @pointerdown.stop
        @click.stop="emit('edit')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        type="button"
        data-testid="marker-remove-button"
        aria-label="Remove marker"
        class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-red-400 hover:text-red-300"
        @pointerdown.stop
        @click.stop="emit('remove')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </span>
  </div>
</template>
