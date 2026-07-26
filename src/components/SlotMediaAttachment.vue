<template>
  <div class="rounded-md bg-gray-800/40 border border-gray-700/40 p-2 mt-2 text-xs" data-testid="slot-media-attachment">
    <div class="flex flex-wrap items-center gap-4">
      <!-- Audio attach — this is the group BED control (D-18: audio-only, no
           video bed exists anymore). -->
      <div class="flex items-center gap-1.5">
        <label class="text-gray-400 font-medium">Audio</label>
        <input
          type="file"
          accept="audio/*"
          data-testid="attach-audio-input"
          class="text-[11px] text-gray-400 file:mr-1 file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-0.5 file:text-gray-200 w-40"
          @change="onFileSelected($event)"
        />
      </div>
    </div>

    <p v-if="isUploading" data-testid="media-upload-progress" class="mt-1 text-indigo-400">
      Uploading... {{ Math.round(progress) }}%
    </p>
    <p v-if="error" data-testid="media-upload-error" class="mt-1 text-red-400">
      {{ error }}
    </p>

    <div v-if="audioUrl" class="mt-2">
      <AudioPlayer :src="audioUrl" label="Attached Audio" />
      <button
        type="button"
        data-testid="remove-audio"
        class="mt-1 text-gray-500 hover:text-red-400 transition-colors"
        @click="removeAudio"
      >
        Remove audio
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Per-slot group-BED media attachment control (Phase 22, R013/R014,
 * retargeted at the group bed in 24-06). The bed is audio-only (D-18) — a
 * video slide is its own slide, added via the Slides tab drop target, not
 * attached here. Uploads an audio file via `useMediaUpload`, previews
 * attached audio with `AudioPlayer`, and emits `update:audioUrl`
 * (v-model-compatible) so the parent (ServiceEditorView) writes the
 * resulting URL onto the anchored group's bed via `setGroupBedMedia`; this
 * component never persists anything itself.
 *
 * A failed upload sets the composable's reactive `error` and intentionally
 * emits NO `update:` event, so the slot's other metadata is never at risk
 * of being overwritten by a failed attachment (T-22-04-02).
 */
import { useMediaUpload } from '@/composables/useMediaUpload'
import AudioPlayer from './AudioPlayer.vue'

const props = defineProps<{
  audioUrl?: string
  orgId: string
}>()

const emit = defineEmits<{
  'update:audioUrl': [url: string | undefined]
}>()

const { progress, error, isUploading, uploadMedia, reset } = useMediaUpload()

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  reset()
  try {
    const url = await uploadMedia(file, props.orgId)
    emit('update:audioUrl', url)
  } catch {
    // uploadMedia already set the composable's reactive `error` — surfaced
    // via media-upload-error above. Deliberately do NOT emit an update:
    // event here, so a failed upload can never clear/overwrite the slot's
    // existing media (or any other slot field).
  }
}

function removeAudio(): void {
  emit('update:audioUrl', undefined)
}
</script>
