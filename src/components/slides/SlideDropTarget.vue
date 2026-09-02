<template>
  <div
    class="slide-drop-target flex min-h-[140px] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-700 p-4 text-center transition-colors"
    :class="clickable ? 'cursor-pointer hover:border-indigo-500/50' : ''"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    :aria-label="clickable ? 'Click to import, or drag files here' : undefined"
    data-testid="slide-drop-target"
    @dragover.prevent
    @drop.prevent="onDrop"
    @click="clickable ? emit('browse') : undefined"
    @keydown.enter="clickable ? emit('browse') : undefined"
    @keydown.space.prevent="clickable ? emit('browse') : undefined"
  >
    <p class="text-sm font-medium text-gray-300">
      {{ audioOnly ? 'Drop audio' : 'Drop PPTX, images, video, or audio' }}
    </p>
    <p class="mt-1 text-[11px] text-gray-500">
      <template v-if="audioOnly">
        Audio sets this group's music &middot; a song's slides are managed in Song Lyrics
      </template>
      <template v-else-if="clickable">
        Click to browse, or drop PPTX, images, video &middot; audio sets this group's music
      </template>
      <template v-else>
        PPTX, image, and video appends a slide &middot; audio sets this group's music
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
// See .planning/codebase/STACK.md (§ Component & Composable Stack Notes (R318) -> src/components/slides/SlideDropTarget.vue)
withDefaults(defineProps<{ audioOnly?: boolean; clickable?: boolean }>(), {
  audioOnly: false,
  clickable: false,
})

const emit = defineEmits<{
  drop: [files: File[]]
  browse: []
}>()

function onDrop(event: DragEvent): void {
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length > 0) emit('drop', files)
}
</script>
