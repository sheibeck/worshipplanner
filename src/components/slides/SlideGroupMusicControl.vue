<template>
  <div :class="flush ? '' : 'rounded-md border border-gray-800 bg-gray-900 px-3 py-2'" data-testid="slide-group-music-control">
    <!-- 260918-nm2 — group-level vamp bed; emit-only, SlideGrid owns the write -->
    <template v-if="audioUrl">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-indigo-400" aria-hidden="true">&#9834;</span>
        <div class="min-w-0 flex-1">
          <template v-if="isVampBed">
            <p class="truncate text-sm text-gray-100" data-testid="group-music-vamp-label" :title="bedVampLabel">Vamp: {{ bedVampLabel }}</p>
            <span v-if="vampStale" class="text-[11px] text-gray-500" data-testid="group-music-vamp-stale">(no longer in library)</span>
          </template>
          <p v-else class="truncate text-sm text-gray-100" data-testid="group-music-filename">{{ fileName }}</p>
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

        <template v-if="isVampBed">
          <button
            v-if="isEditor"
            type="button"
            class="text-xs font-medium text-indigo-400 hover:text-indigo-300 shrink-0"
            data-testid="group-music-vamp-change"
            @click="openVampPicker"
          >Change</button>
          <button
            v-if="isEditor"
            type="button"
            class="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0"
            data-testid="group-music-vamp-clear"
            @click="onRemove"
          >Clear</button>
        </template>
        <template v-else>
          <button
            v-if="isEditor"
            type="button"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
            data-testid="group-music-choose-vamp"
            @click="openVampPicker"
          >+ Add a vamp for this group</button>
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
        </template>
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
      <div class="flex flex-wrap items-center gap-3">
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
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
          data-testid="group-music-choose-vamp"
          @click="openVampPicker"
        >+ Add a vamp for this group</button>
      </div>
    </template>

    <VampPickerSlideOver
      :open="vampPickerOpen && isEditor"
      :vamps="vamps"
      :loading="vampsLoading"
      :selected-vamp-id="bedVampId ?? null"
      @select="onVampSelected"
      @close="closeVampPicker"
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
import { ref, computed } from 'vue'
import { useMediaUpload } from '@/composables/useMediaUpload'
import AudioPlayer from '../AudioPlayer.vue'
import VampPickerSlideOver from '../VampPickerSlideOver.vue'
import type { Vamp } from '@/types/vamp'
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

// 260918-nm2 — group-level vamp bed: emit-only, mirrors EditSlideDrawer's per-slide precedent.
// 260918-pms — picker now opens in VampPickerSlideOver, not inline.
const vampPickerOpen = ref(false)
const isVampBed = computed(() => !!props.audioUrl && !!props.bedVampId)
const vampStale = computed(
  () => isVampBed.value && !props.vampsLoading && !props.vamps.some((v) => v.id === props.bedVampId),
)

function openVampPicker(): void {
  if (!props.isEditor) return
  vampPickerOpen.value = true
}

function closeVampPicker(): void {
  vampPickerOpen.value = false
}

function onVampSelected(vamp: Vamp): void {
  emit('attach-vamp', vamp)
  closeVampPicker()
}
</script>
