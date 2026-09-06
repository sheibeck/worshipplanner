<template>
  <div v-if="track" :class="containerClass" data-testid="rehearse-player">
    <!-- Row 1: play/pause + track name + (desktop only) time -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        :aria-label="playPauseLabel"
        data-testid="rehearse-player-toggle"
        class="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        @click="togglePlayPause"
      >
        <svg v-if="!playing" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
      </button>

      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-100 truncate" :title="track.name" data-testid="rehearse-player-name">
          {{ track.name }}
        </p>
      </div>

      <span class="font-mono text-xs text-gray-400 shrink-0" data-testid="rehearse-player-time">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
    </div>

    <!-- Mobile (fixedBottom): full-width seek row, then speed+loop row -->
    <template v-if="fixedBottom">
      <input
        type="range"
        min="0"
        :max="duration || 0"
        :value="currentTime"
        aria-label="Seek"
        data-testid="rehearse-player-seek"
        class="w-full accent-indigo-500"
        @input="onSeek"
      />
      <div class="flex items-center gap-2 justify-end">
        <button
          type="button"
          :aria-label="speedButtonLabel"
          data-testid="rehearse-player-speed"
          class="px-2 py-1 rounded-md bg-gray-800 text-gray-200 border border-gray-700 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          @click="cycleSpeed"
        >
          {{ speedLabel }}
        </button>
        <button
          type="button"
          :aria-pressed="loop"
          aria-label="Loop"
          data-testid="rehearse-player-loop"
          class="p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          :class="loop ? 'text-indigo-400 bg-indigo-950/40' : 'text-gray-400'"
          @click="toggleLoop"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>
    </template>

    <!-- Desktop: seek + speed + loop combined on one row -->
    <div v-else class="flex items-center gap-3">
      <input
        type="range"
        min="0"
        :max="duration || 0"
        :value="currentTime"
        aria-label="Seek"
        data-testid="rehearse-player-seek"
        class="flex-1 accent-indigo-500"
        @input="onSeek"
      />
      <button
        type="button"
        :aria-label="speedButtonLabel"
        data-testid="rehearse-player-speed"
        class="px-2 py-1 rounded-md bg-gray-800 text-gray-200 border border-gray-700 text-xs font-mono shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        @click="cycleSpeed"
      >
        {{ speedLabel }}
      </button>
      <button
        type="button"
        :aria-pressed="loop"
        aria-label="Loop"
        data-testid="rehearse-player-loop"
        class="p-1.5 rounded-md shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        :class="loop ? 'text-indigo-400 bg-indigo-950/40' : 'text-gray-400'"
        @click="toggleLoop"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </button>
    </div>

    <!-- Exactly ONE native <audio> element for the whole component's
         lifetime (R388) — a new track REPLACES the src reactively, it never
         mounts a second element. Custom transport chrome above replaces the
         browser's default controls bar (sr-only, not `controls`). -->
    <audio
      ref="audioEl"
      :src="track.downloadUrl"
      class="sr-only"
      data-testid="rehearse-player-audio"
      @error="onAudioError"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @play="onNativePlay"
      @pause="onNativePause"
      @ended="onNativePause"
    ></audio>
  </div>
</template>

<script setup lang="ts">
// The persistent bottom transport (R388, R389, 127-UI-SPEC.md §2 "Bottom
// audio player bar" / §3 "Pinned bottom player"). Native HTMLAudioElement
// only — no audio library (howler/wavesurfer). Centralizes SongFilesTab.vue's
// per-row <audio> idiom into ONE instance with custom transport chrome;
// selecting a new track replaces the current one via a reactive :src binding,
// never a second <audio> element (127-PATTERNS.md "one-track-at-a-time").
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { RehearseAttachment } from '@/utils/rehearseAccess'

const props = defineProps<{
  track?: RehearseAttachment
  /** Mobile pinned-bottom stacked layout (127-UI-SPEC.md §3) vs. the
   *  desktop inline Column-3 layout. */
  fixedBottom?: boolean
}>()

const authStore = useAuthStore()

const SPEEDS = [1, 0.9, 0.75, 1.25] as const

const audioEl = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const speedIndex = ref(0)
const loop = ref(false)

const containerClass = computed(() => [
  'border-t border-gray-800 bg-gray-900 px-4 py-3 flex flex-col gap-2',
  props.fixedBottom ? 'fixed bottom-0 inset-x-0 z-30' : '',
])

const speedLabel = computed(() => `${SPEEDS[speedIndex.value]}×`)
const speedButtonLabel = computed(() => `Playback speed, ${speedLabel.value}. Press to change.`)
const playPauseLabel = computed(() => `${playing.value ? 'Pause' : 'Play'} ${props.track?.name ?? ''}`.trim())

/** Light per-uid+track playback-position key (Phase 125 decision) — a
 *  numeric position only, no media bytes/PII, client-local, never a
 *  cross-user boundary (T-127-07, accepted). */
function storageKey(trackId: string): string {
  const uid = authStore.user?.uid ?? 'anon'
  return `rehearse-audio-position:${uid}:${trackId}`
}

// Selecting a NEW track (R388/R389): reset the locally-tracked transport
// state so the UI doesn't show the previous track's stale time/playing
// state while the new src loads — the actual restore happens in
// onLoadedMetadata once the new track's duration is known.
watch(
  () => props.track?.id,
  () => {
    playing.value = false
    currentTime.value = 0
    duration.value = 0
  },
)

function onLoadedMetadata(): void {
  const el = audioEl.value
  const t = props.track
  if (!el || !t) return
  duration.value = el.duration
  // Whole-track speed/loop carry forward onto the newly-loaded element —
  // native properties, no library.
  el.playbackRate = SPEEDS[speedIndex.value]!
  el.loop = loop.value

  const saved = localStorage.getItem(storageKey(t.id))
  if (saved != null) {
    const pos = Number(saved)
    if (Number.isFinite(pos) && pos > 0 && pos < el.duration) {
      el.currentTime = pos
      currentTime.value = pos
    }
  }
}

function onTimeUpdate(): void {
  const el = audioEl.value
  const t = props.track
  if (!el || !t) return
  currentTime.value = el.currentTime
  try {
    localStorage.setItem(storageKey(t.id), String(el.currentTime))
  } catch {
    // localStorage unavailable (private browsing / quota) — playback still
    // works, it just isn't persisted across sessions.
  }
}

function onAudioError(): void {
  playing.value = false
}

function onNativePlay(): void {
  playing.value = true
}

function onNativePause(): void {
  playing.value = false
}

async function togglePlayPause(): Promise<void> {
  const el = audioEl.value
  if (!el) return
  if (el.paused) {
    try {
      await el.play()
      // Real browsers dispatch a native 'play' event on successful play(),
      // but test doubles for the media element do not (see AudioPlayer.vue's
      // identical precedent) — set it explicitly so the aria-label updates
      // in both environments.
      playing.value = true
    } catch (err) {
      // Autoplay-blocked/pause-interrupted rejections are expected browser
      // behavior, not a bug — leave the button in its paused state so the
      // volunteer can just press it again (ADR-0061 precedent).
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return
      throw err
    }
  } else {
    el.pause()
    playing.value = false
  }
}

function onSeek(event: Event): void {
  const el = audioEl.value
  if (!el) return
  const value = Number((event.target as HTMLInputElement).value)
  el.currentTime = value
  currentTime.value = value
}

function cycleSpeed(): void {
  speedIndex.value = (speedIndex.value + 1) % SPEEDS.length
  if (audioEl.value) audioEl.value.playbackRate = SPEEDS[speedIndex.value]!
}

function toggleLoop(): void {
  loop.value = !loop.value
  if (audioEl.value) audioEl.value.loop = loop.value
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>
