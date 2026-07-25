<template>
  <div class="rounded-md bg-gray-800/40 border border-gray-700/40 p-2 mt-2 text-xs" data-testid="slot-media-attachment">
    <div class="flex flex-wrap items-center gap-4">
      <!-- Audio attach -->
      <div class="flex items-center gap-1.5">
        <label class="text-gray-400 font-medium">Audio</label>
        <input
          type="file"
          accept="audio/*"
          data-testid="attach-audio-input"
          class="text-[11px] text-gray-400 file:mr-1 file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-0.5 file:text-gray-200 w-40"
          @change="onFileSelected($event, 'audio')"
        />
      </div>

      <!-- Video attach -->
      <div class="flex items-center gap-1.5">
        <label class="text-gray-400 font-medium">Video</label>
        <input
          type="file"
          accept="video/*"
          data-testid="attach-video-input"
          class="text-[11px] text-gray-400 file:mr-1 file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-0.5 file:text-gray-200 w-40"
          @change="onFileSelected($event, 'video')"
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

    <div v-if="videoUrl" class="mt-2">
      <VideoPlayer :src="videoUrl" />
      <button
        type="button"
        data-testid="remove-video"
        class="mt-1 text-gray-500 hover:text-red-400 transition-colors"
        @click="removeVideo"
      >
        Remove video
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Per-slot media attachment control (Phase 22, R013/R014). Uploads an
 * audio and/or video file via `useMediaUpload`, previews attached media
 * with `AudioPlayer`/`VideoPlayer`, and emits `update:audioUrl`/
 * `update:videoUrl` (v-model-compatible) so the parent (ServiceEditorView)
 * binds the resulting URL onto the slot — persistence rides the parent's
 * EXISTING localService deep-watch autosave; this component never persists
 * anything itself.
 *
 * A failed upload sets the composable's reactive `error` and intentionally
 * emits NO `update:` event, so the slot's other metadata is never at risk
 * of being overwritten by a failed attachment (T-22-04-02).
 */
import { useMediaUpload } from '@/composables/useMediaUpload'
import AudioPlayer from './AudioPlayer.vue'
import VideoPlayer from './VideoPlayer.vue'

const props = defineProps<{
  audioUrl?: string
  videoUrl?: string
  orgId: string
}>()

const emit = defineEmits<{
  'update:audioUrl': [url: string | undefined]
  'update:videoUrl': [url: string | undefined]
}>()

const { progress, error, isUploading, uploadMedia, reset } = useMediaUpload()

async function onFileSelected(event: Event, kind: 'audio' | 'video'): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  reset()
  try {
    const url = await uploadMedia(file, props.orgId)
    if (kind === 'audio') {
      emit('update:audioUrl', url)
    } else {
      emit('update:videoUrl', url)
    }
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

function removeVideo(): void {
  emit('update:videoUrl', undefined)
}
</script>
