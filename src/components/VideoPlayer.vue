<template>
  <div class="rounded-md bg-gray-800/60 border border-gray-700/50 p-2" data-testid="video-player">
    <video
      ref="videoEl"
      :src="src"
      :poster="poster"
      :muted="muted"
      controls
      preload="none"
      playsinline
      class="w-full rounded max-h-48"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
    />
    <button
      v-if="showPlayAffordance"
      type="button"
      data-testid="video-play-affordance"
      class="mt-2 inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
      @click="retryPlay"
    >
      Play video
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

/**
 * Reusable video playback component (R014). Sources MP4/WebM/MOV via native
 * HTML5 `<video>`; never loops (stop-at-end), no `autoplay` attribute —
 * Phase 23's presentation driver calls the exposed `play()` on slide entry.
 * On an autoplay-policy rejection, retries once muted (browsers generally
 * permit muted autoplay); if the muted retry also fails, surfaces a play
 * affordance instead of retrying forever.
 */
defineProps<{
  src: string
  poster?: string
}>()

const emit = defineEmits<{
  play: []
  pause: []
  ended: []
  error: [event: Event]
  'autoplay-blocked': []
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const muted = ref(false)
const showPlayAffordance = ref(false)

function onPlay(): void {
  emit('play')
}

function onPause(): void {
  emit('pause')
}

function onEnded(): void {
  emit('ended')
}

function onError(event: Event): void {
  emit('error', event)
}

function isNotAllowedError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotAllowedError'
}

async function play(): Promise<void> {
  const el = videoEl.value
  if (!el) return
  try {
    await el.play()
    showPlayAffordance.value = false
    // Explicit emit — test doubles for the media element don't dispatch a
    // native 'play' event the way real browsers do; see AudioPlayer for the
    // same rationale.
    emit('play')
    return
  } catch (err) {
    if (!isNotAllowedError(err)) throw err
  }

  // First rejection: retry once muted, since browsers generally permit muted
  // autoplay even when unmuted playback is blocked.
  muted.value = true
  try {
    await el.play()
    // Muted retry succeeded — plays, but degraded (silent). Signal this so
    // the driving layer (Phase 23) can show a "tap to unmute" affordance.
    emit('autoplay-blocked')
  } catch (err) {
    if (!isNotAllowedError(err)) throw err
    emit('autoplay-blocked')
    showPlayAffordance.value = true
  }
}

function pause(): void {
  videoEl.value?.pause()
}

/** User-gesture retry from the play affordance button. */
async function retryPlay(): Promise<void> {
  await play()
}

defineExpose({ play, pause })
</script>
