<template>
  <div :class="flush ? '' : 'rounded-md border border-gray-800 bg-gray-900 px-3 py-2'" data-testid="slide-group-music-control">
    <!-- 142 — one audio slot (None/Track/Vamp); emit-only, SlideGrid owns the write -->
    <div class="flex flex-col gap-2">
      <div
        class="flex gap-1 rounded-md border border-gray-800 bg-gray-950 p-0.5"
        role="tablist"
        aria-label="Audio source"
        data-testid="group-music-audio-tabs"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="audioTab === 'none'"
          :disabled="!isEditor"
          class="flex-1 rounded px-2 py-1.5 text-center text-[11px] transition-colors"
          :class="audioTab === 'none' ? 'bg-indigo-950/60 text-indigo-200' : 'text-gray-400 hover:text-gray-200'"
          data-testid="group-music-audio-tab-none"
          @click="setAudioTab('none')"
        >None</button>
        <button
          type="button"
          role="tab"
          :aria-selected="audioTab === 'track'"
          :disabled="!isEditor"
          class="flex-1 rounded px-2 py-1.5 text-center text-[11px] transition-colors"
          :class="audioTab === 'track' ? 'bg-indigo-950/60 text-indigo-200' : 'text-gray-400 hover:text-gray-200'"
          data-testid="group-music-audio-tab-track"
          @click="setAudioTab('track')"
        >Track</button>
        <button
          type="button"
          role="tab"
          :aria-selected="audioTab === 'vamp'"
          :disabled="!isEditor"
          class="flex-1 rounded px-2 py-1.5 text-center text-[11px] transition-colors"
          :class="audioTab === 'vamp' ? 'bg-indigo-950/60 text-indigo-200' : 'text-gray-400 hover:text-gray-200'"
          data-testid="group-music-audio-tab-vamp"
          @click="setAudioTab('vamp')"
        >Vamp</button>
      </div>
      <p class="text-[10px] text-gray-600">one source per group</p>

      <p v-if="audioTab === 'none'" class="text-[11px] text-gray-500">Silent — the room mix carries this group.</p>

      <template v-if="audioTab === 'track'">
        <div
          v-if="audioUrl && !isVampBed"
          class="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5"
          data-testid="group-music-track-row"
        >
          <button
            type="button"
            class="text-gray-400 hover:text-indigo-300 transition-colors"
            data-testid="group-music-preview"
            aria-label="Preview group music"
            @click="togglePreview"
          >▶</button>
          <span class="min-w-0 flex-1 truncate text-[11.5px] text-gray-200" data-testid="group-music-track-filename">{{ fileName }}</span>
          <span v-if="duration" class="shrink-0 text-[10.5px] text-gray-500" data-testid="group-music-track-duration">{{ duration }}</span>
          <label
            v-if="isEditor"
            class="shrink-0 cursor-pointer text-[10.5px] font-medium text-indigo-400 hover:text-indigo-300"
            data-testid="group-music-track-replace"
          >
            Replace
            <input type="file" accept="audio/*" class="hidden" data-testid="group-music-input" @change="onFileSelected" />
          </label>
          <button
            v-if="isEditor"
            type="button"
            class="shrink-0 text-[10.5px] text-gray-500 hover:text-red-400 transition-colors"
            data-testid="group-music-track-remove"
            @click="onRemove"
          >Remove</button>
        </div>
        <label
          v-else-if="isEditor"
          class="flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-700 text-gray-500 hover:border-indigo-700 transition-colors"
        >
          <span class="text-sm">＋</span>
          <span class="text-[10.5px]">Upload a track</span>
          <input type="file" accept="audio/*" class="hidden" data-testid="group-music-input" @change="onFileSelected" />
        </label>
      </template>

      <template v-if="audioTab === 'vamp'">
        <div v-if="isEditor" class="h-[200px]">
          <VampPicker
            fill
            allow-unattached
            :vamps="vamps"
            :loading="vampsLoading"
            :selected-vamp-id="bedVampId ?? null"
            @select="onVampSelected"
            @cancel="emit('close')"
          />
        </div>
        <p v-else class="text-[11.5px] text-gray-200">♪ {{ bedVampLabel }}</p>
        <p v-if="vampStale" class="text-[10.5px] text-gray-500">(no longer in library)</p>
        <p
          v-if="isVampBed && !audioUrl"
          class="flex items-center gap-1.5 text-[10.5px] text-amber-400"
          data-testid="group-music-vamp-warning"
        >⚠ No MP3 attached yet — band plays it live.</p>
      </template>
    </div>

    <!-- Chromeless so the ONLY playback affordance is the icon-only preview
         button in the Track row above — native <audio controls> cannot carry
         a custom aria-label. Mounted whenever a URL exists (regardless of
         which tab is active) so a preview started before a tab switch keeps
         playing and can still be learned about via loadedmetadata. -->
    <AudioPlayer
      v-if="audioUrl"
      ref="playerRef"
      chromeless
      :src="audioUrl"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="isPlaying = false"
      @loadedmetadata="onLoadedMetadata"
    />

    <p v-if="isUploading" data-testid="media-upload-progress" class="mt-1 text-indigo-400">
      Uploading... {{ Math.round(progress) }}%
    </p>
    <p v-if="error" data-testid="media-upload-error" class="mt-1 text-red-400">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlideGroupMusicControl.vue)
import { ref, computed, watch } from 'vue'
import { useMediaUpload } from '@/composables/useMediaUpload'
import AudioPlayer from '../AudioPlayer.vue'
import VampPicker from '../VampPicker.vue'
import type { Vamp } from '@/types/vamp'
import { bedAudioLabel } from './slideDisplay'

type AudioTab = 'none' | 'track' | 'vamp'

const props = withDefaults(defineProps<{
  /** The selected group's stored bed audio URL, or undefined when it has none. */
  audioUrl?: string
  /** Org id, passed straight through to `useMediaUpload`. */
  orgId: string
  /** Gates the tabs and the Track row's Replace/Remove; a viewer can still hear what's attached. */
  isEditor: boolean
  /**
   * Owner follow-up (merged group-media panel): when true, drops this
   * control's own border/background/rounding/padding so it can render flush
   * inside a shared panel wrapper that supplies its own chrome instead.
   * Defaults false so every pre-existing call site is visually unchanged.
   */
  flush?: boolean
  /** 260918-nm2 — the group's denormalized bed vamp id, or undefined for an uploaded/no bed. */
  bedVampId?: string
  /** 260918-nm2 — the group's denormalized bed vamp label (`{name} · {key}`). */
  bedVampLabel?: string
  /** 260918-nm2 — the org's vamp library, passed through to the inline VampPicker. */
  vamps?: Vamp[]
  /** 260918-nm2 — whether the vamp library is still loading (gates the stale hint). */
  vampsLoading?: boolean
}>(), { flush: false, vamps: () => [], vampsLoading: false })

const emit = defineEmits<{
  attach: [url: string]
  remove: []
  'attach-vamp': [vamp: Vamp]
  close: []
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

// 142 — presence of the id alone (not audioUrl) makes a no-MP3 vamp a vamp bed.
const isVampBed = computed(() => !!props.bedVampId)
const vampStale = computed(
  () => isVampBed.value && !props.vampsLoading && !props.vamps.some((v) => v.id === props.bedVampId),
)

const duration = ref<string | null>(null)

function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function onLoadedMetadata(seconds: number): void {
  duration.value = formatDuration(seconds)
}

// 142 — the tab is derived from the data (vamp wins whenever bedVampId is
// set, with or without a URL), so a no-MP3 vamp always renders as Vamp +
// the amber warning, never the empty "none" state. `selectedTab` is a
// transient override for a click before anything writes; it resets to the
// derivation whenever the underlying data changes.
const derivedTab = computed<AudioTab>(() => (props.bedVampId ? 'vamp' : props.audioUrl ? 'track' : 'none'))
const selectedTab = ref<AudioTab | null>(null)
const audioTab = computed(() => selectedTab.value ?? derivedTab.value)

watch([() => props.audioUrl, () => props.bedVampId], () => {
  selectedTab.value = null
  duration.value = null
})

function setAudioTab(id: AudioTab): void {
  if (!props.isEditor) return
  selectedTab.value = id
  if (id === 'none' && (props.audioUrl || props.bedVampId)) emit('remove')
}

function onVampSelected(vamp: Vamp): void {
  emit('attach-vamp', vamp)
}
</script>
