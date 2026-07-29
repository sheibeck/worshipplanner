<template>
  <div
    class="slide-drop-target flex min-h-[140px] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-700 p-4 text-center transition-colors"
    data-testid="slide-drop-target"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <p class="text-sm font-medium text-gray-300">
      {{ audioOnly ? 'Drop audio' : 'Drop PPTX, images, video, or audio' }}
    </p>
    <p class="mt-1 text-[11px] text-gray-500">
      <template v-if="audioOnly">
        Audio sets this group's music &middot; a song's slides are managed in Song Lyrics
      </template>
      <template v-else>
        PPTX, image, and video appends a slide &middot; audio sets this group's music
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The drop tile itself (D-13) — always the LAST item the grid renders,
 * including at zero slides (D-08), and NEVER inside SortableJS's draggable
 * set: `.slide-card` is deliberately absent from this component's root
 * class, so a tile mounted inside the cards container never shifts a
 * reorder's old/new index arithmetic by one.
 *
 * Performs no upload and no routing decision of its own — it only emits the
 * dropped file list upward. `SlideGrid.vue` routes BOTH this tile's drop and
 * the whole-grid container's drop through the exact same handler
 * (`dropRouting.ts`'s `resolveDrop`), so the two entry points can never
 * diverge.
 */
/**
 * R054: on a SONG group the tile stays mounted — group-level music is still
 * allowed — but every slide-appending route (deck, image, video) is refused
 * by `SlideGrid.onFilesDropped`. `audioOnly` makes the COPY tell the same
 * story the handler enforces; advertising "PPTX, image, and video appends a
 * slide" on a locked group reads as a bug, which is exactly how it was
 * reported during Phase 30 verification.
 */
withDefaults(defineProps<{ audioOnly?: boolean }>(), { audioOnly: false })

const emit = defineEmits<{
  drop: [files: File[]]
}>()

function onDrop(event: DragEvent): void {
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length > 0) emit('drop', files)
}
</script>
