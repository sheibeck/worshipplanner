<template>
  <div :class="flush ? '' : 'rounded-md border border-gray-800 bg-gray-900 px-3 py-2'" data-testid="slide-group-music-control">
    <template v-if="audioUrl">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-indigo-400" aria-hidden="true">&#9834;</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-gray-100" data-testid="group-music-filename">{{ fileName }}</p>
          <p class="text-[11px] text-gray-500" data-testid="group-music-scope">plays across all {{ slideCount }} slides</p>
        </div>

        <button
          type="button"
          class="text-gray-400 hover:text-indigo-300 transition-colors"
          data-testid="group-music-preview"
          aria-label="Preview group music"
          @click="togglePreview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 4l10 6-10 6V4z" />
          </svg>
        </button>

        <button
          v-if="isEditor"
          type="button"
          class="text-gray-500 hover:text-red-400 transition-colors"
          data-testid="group-music-remove"
          aria-label="Remove group music"
          @click="onRemove"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Chromeless so the ONLY playback affordance is the icon-only button
           above, carrying the UI-SPEC's accessible name — native <audio
           controls> cannot carry a custom aria-label. -->
      <AudioPlayer
        ref="playerRef"
        chromeless
        :src="audioUrl"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @ended="isPlaying = false"
      />
    </template>

    <template v-else-if="isEditor">
      <label
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
        data-testid="group-music-add"
      >
        &#65291; Add music for this group
        <input
          type="file"
          accept="audio/*"
          class="hidden"
          data-testid="group-music-input"
          @change="onFileSelected"
        />
      </label>
    </template>

    <p v-if="isUploading" data-testid="media-upload-progress" class="mt-1 text-indigo-400">
      Uploading... {{ Math.round(progress) }}%
    </p>
    <p v-if="error" data-testid="media-upload-error" class="mt-1 text-red-400">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Group-level audio bed control (Phase 25 Task 1, R032) — scoped to the
 * SELECTED GROUP rather than a service slot, and audio-only per D-14 (group
 * music is never a slide; dropped video is a slide, that path is 25-07's).
 * This is the sole surviving attach/remove surface for group-bed audio — the
 * Service Order tab's per-slot equivalent was removed in Phase 27-04.
 *
 * Emit-only: uploads through `useMediaUpload` and emits the resulting URL via
 * `attach`, or emits `remove` for a plain, unconfirmed clear. This component
 * performs NO Firestore write itself — `SlideGrid.vue` (Task 2) intercepts
 * both events and calls the slideGroups store's scoped bed write.
 *
 * A failed upload sets the composable's reactive `error` and emits NOTHING —
 * a failed upload can never clear an existing group bed attachment
 * (T-25-06-03).
 */
import { ref, computed } from 'vue'
import { useMediaUpload } from '@/composables/useMediaUpload'
import AudioPlayer from '../AudioPlayer.vue'
import { bedAudioLabel } from './slideDisplay'

const props = withDefaults(defineProps<{
  /** The selected group's stored bed audio URL, or undefined when it has none. */
  audioUrl?: string
  /** The selected group's current slide count — feeds the "plays across all N slides" line. */
  slideCount: number
  /** Org id, passed straight through to `useMediaUpload`. */
  orgId: string
  /** Gates the add-music affordance and the remove control; a viewer can still hear what's attached. */
  isEditor: boolean
  /**
   * Owner follow-up (merged group-media panel): when true, drops this
   * control's own border/background/rounding/padding so it can render flush
   * inside a shared panel wrapper that supplies its own chrome instead.
   * Defaults false so every pre-existing call site is visually unchanged.
   */
  flush?: boolean
}>(), { flush: false })

const emit = defineEmits<{
  attach: [url: string]
  remove: []
}>()

const { progress, error, isUploading, uploadMedia, reset } = useMediaUpload()

/**
 * Derived from the stored URL rather than component state — after a reload
 * there is no File object left, only the URL. Firebase Storage download URLs
 * carry the object path encoded in them; `bedAudioLabel` (already shared with
 * the rail's own bed-music line) decodes it and takes the last path segment,
 * falling back to a generic label for an unparseable URL.
 */
const fileName = computed(() => (props.audioUrl ? bedAudioLabel(props.audioUrl) : ''))

const playerRef = ref<InstanceType<typeof AudioPlayer> | null>(null)
const isPlaying = ref(false)

async function togglePreview(): Promise<void> {
  if (!playerRef.value) return
  if (isPlaying.value) {
    playerRef.value.pause()
  } else {
    await playerRef.value.play()
  }
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  reset()
  try {
    const url = await uploadMedia(file, props.orgId)
    emit('attach', url)
  } catch {
    // uploadMedia already set the composable's reactive `error` — surfaced
    // via media-upload-error above. Deliberately do NOT emit `attach` here,
    // so a failed upload can never clear or overwrite an existing group bed.
  }
}

function onRemove(): void {
  emit('remove')
}
</script>
