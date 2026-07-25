<template>
  <div
    :class="chromeless ? '' : 'rounded-md bg-gray-800/60 border border-gray-700/50 p-2'"
    data-testid="audio-player"
  >
    <p v-if="label" class="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
      {{ label }}
    </p>
    <audio
      ref="audioEl"
      :src="src"
      :controls="!chromeless"
      preload="none"
      class="w-full"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
      @error="onError"
    />
    <button
      v-if="showPlayAffordance && !chromeless"
      type="button"
      data-testid="audio-play-affordance"
      class="mt-2 inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
      @click="retryPlay"
    >
      Play audio
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

/**
 * Reusable audio playback component (R013). Never loops (stop-at-end), no
 * `autoplay` attribute — Phase 23's presentation driver calls the exposed
 * `play()` on slide entry. Gracefully surfaces a play affordance when the
 * browser's autoplay policy rejects an unattended play() call.
 */
defineProps<{
  src: string
  label?: string
  chromeless?: boolean
}>()

const emit = defineEmits<{
  play: []
  pause: []
  ended: []
  error: [event: Event]
  'autoplay-blocked': []
}>()

const audioEl = ref<HTMLAudioElement | null>(null)
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

async function play(): Promise<void> {
  const el = audioEl.value
  if (!el) return
  try {
    await el.play()
    showPlayAffordance.value = false
    // Explicit emit (in addition to the native @play listener) — real browsers
    // dispatch a native 'play' event on successful play(), but test doubles for
    // the media element do not, so the imperative caller (Phase 23) always gets
    // a `play` signal the moment play() resolves.
    emit('play')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      emit('autoplay-blocked')
      showPlayAffordance.value = true
      return
    }
    // A pause()-interrupted play() rejects with AbortError, not
    // NotAllowedError (HTML media spec) — this is an expected, silent
    // outcome (see WR-01): the presentation driver calls pauseCurrentMedia()
    // at the start of every navigation, which can legitimately race a
    // still-pending play() on this exact element. Never surface it as an
    // unhandled rejection.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return
    }
    throw err
  }
}

function pause(): void {
  audioEl.value?.pause()
}

/** User-gesture retry from the play affordance button. */
async function retryPlay(): Promise<void> {
  await play()
}

defineExpose({ play, pause })
</script>
