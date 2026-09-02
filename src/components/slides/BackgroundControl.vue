<template>
  <div :class="flush ? '' : 'rounded-md border border-gray-800 bg-gray-900 px-3 py-2'" data-testid="background-control">
    <template v-if="imageUrl">
      <div class="flex flex-wrap items-center gap-3">
        <img
          :src="imageUrl"
          class="h-8 w-8 rounded object-cover flex-none"
          alt=""
          data-testid="background-control-image"
        />
        <p class="min-w-0 flex-1 truncate text-sm text-gray-100" data-testid="background-control-filename">
          {{ fileName }}
        </p>
        <button
          v-if="isEditor"
          type="button"
          class="text-gray-500 hover:text-red-400 transition-colors"
          data-testid="background-control-remove"
          :aria-label="removeLabel"
          @click="onRemove"
        >&times;</button>
      </div>
      <p v-if="!hideCaption" class="mt-1 text-[11px] text-gray-500" data-testid="background-control-caption">{{ caption }}</p>
    </template>

    <template v-else>
      <div v-if="inheritedFrom" class="mb-1.5 flex flex-wrap items-center gap-3">
        <img
          :src="inheritedFrom.url"
          class="h-8 w-8 rounded object-cover flex-none"
          alt=""
          data-testid="background-control-image"
        />
        <span class="min-w-0 flex-1 text-[11px] text-gray-400" data-testid="background-control-inherited">
          inherited from the song &mdash; {{ inheritedFrom.label }}
        </span>
      </div>
      <p v-else-if="!hideCaption" class="mb-1.5 text-[11px] text-gray-500" data-testid="background-control-caption">{{ caption }}</p>

      <!-- Owner request: when the background is INHERITED FROM A SONG, do not
           offer "+ Add background for this group" — the background is managed at
           the song level, and a group-level override here is confusing. The
           inherited thumbnail + provenance line above still render; only the
           add/override affordance is suppressed. Own-background and
           no-inheritance cases (inheritedFrom undefined) are unaffected, as is
           the song-level call site (which never passes inheritedFrom). -->
      <label
        v-if="isEditor && !inheritedFrom"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
        data-testid="background-control-add"
      >
        {{ addLabel }}
        <input
          type="file"
          accept="image/*"
          class="hidden"
          data-testid="background-control-input"
          @change="onFileSelected"
        />
      </label>
    </template>

    <p v-if="isUploading" data-testid="background-control-upload-progress" class="mt-1 text-indigo-400">
      Uploading... {{ Math.round(progress) }}%
    </p>
    <p v-if="error" data-testid="background-control-upload-error" class="mt-1 text-red-400">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/BackgroundControl.vue)
import { computed } from 'vue'
import { useBackgroundUpload } from '@/composables/useBackgroundUpload'
import { backgroundImageLabel } from './slideDisplay'

const props = withDefaults(defineProps<{
  /** This level's own stored background URL, or undefined when it has none. */
  imageUrl?: string
  /** The level-specific caption sentence (§ Copywriting Contract). */
  caption: string
  /** The level-specific add-affordance label ("+ Add background for this group/song"). */
  addLabel: string
  /**
   * The level-specific remove-affordance `aria-label` (§ Copywriting
   * Contract declares `Remove group background` / `Remove song background`
   * as distinct strings) — optional, mirroring `addLabel`'s pattern, but
   * defaults to the pre-existing generic string so no call site that hasn't
   * been updated yet breaks.
   */
  removeLabel?: string
  /**
   * Populated ONLY by the group-level call site for a SONG group whose own
   * background is empty while the song's is set. Undefined everywhere else.
   */
  inheritedFrom?: { url: string; label: string }
  /** Gates the add and remove affordances; a viewer can still see what's set. */
  isEditor: boolean
  /** Org id, passed straight through to `useBackgroundUpload`. */
  orgId: string
  /**
   * Owner follow-up (merged group-media panel): when true, drops this
   * control's own border/background/rounding/padding so it can render flush
   * inside a shared panel wrapper that supplies its own chrome instead.
   * Defaults false so both pre-existing call sites (this group-level one AND
   * `SongLyricEditor.vue`'s song-level one, which does not pass this prop)
   * are visually unchanged.
   */
  flush?: boolean
  /** See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/BackgroundControl.vue) */
  hideCaption?: boolean
}>(), { removeLabel: 'Remove background', flush: false, hideCaption: false })

const emit = defineEmits<{
  attach: [url: string]
  remove: []
}>()

const { progress, error, isUploading, uploadBackground, reset } = useBackgroundUpload()

/**
 * Derived from the stored URL rather than component state — after a reload
 * there is no File object left, only the URL. `backgroundImageLabel`
 * (`./slideDisplay`) decodes the Firebase Storage download URL and takes the
 * last path segment, falling back to a generic label for an unparseable URL.
 */
const fileName = computed(() => (props.imageUrl ? backgroundImageLabel(props.imageUrl) : ''))

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  reset()
  try {
    const url = await uploadBackground(file, props.orgId)
    emit('attach', url)
  } catch {
    // uploadBackground already set the composable's reactive `error` —
    // surfaced via background-control-upload-error above. Deliberately do
    // NOT emit `attach` here, so a failed upload can never clear or
    // overwrite an existing background.
  }
}

function onRemove(): void {
  emit('remove')
}
</script>
