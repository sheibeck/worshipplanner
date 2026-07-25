<template>
  <div class="flex flex-col h-full">
    <!-- Header with status -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
      <h3 class="text-sm font-semibold text-gray-100">Imported Slides</h3>
      <span
        v-if="autoSaveStatus === 'pending'"
        data-testid="status-pending"
        class="inline-block w-2 h-2 rounded-full bg-yellow-400"
        title="Unsaved changes"
      ></span>
      <span
        v-else-if="autoSaveStatus === 'saving'"
        data-testid="status-saving"
        class="text-xs text-gray-400"
      >Saving...</span>
      <span
        v-else-if="autoSaveStatus === 'saved'"
        data-testid="status-saved"
        class="text-xs text-green-400"
      >Saved &#10003;</span>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-if="localSlides.length > 0" class="space-y-3" data-testid="slides-container">
        <div
          v-for="(slide, idx) in localSlides"
          :key="slide.id"
          :data-testid="`slide-card-${idx}`"
          class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-4"
        >
          <div class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
            Slide {{ idx + 1 }}
          </div>

          <!-- Image slide: resolved image + editable alt-text -->
          <template v-if="slide.contentKind === 'image'">
            <img
              :src="slide.imageUrl"
              :alt="slide.altText ?? ''"
              :data-testid="`slide-image-${idx}`"
              class="max-h-48 w-auto mx-auto rounded-md mb-2"
            />
            <input
              :value="slide.altText ?? ''"
              type="text"
              :data-testid="`slide-alttext-${idx}`"
              placeholder="Alt text (optional)"
              class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              @input="onAltTextInput(idx, ($event.target as HTMLInputElement).value)"
            />
          </template>

          <!-- Text slide: editable optional title + body -->
          <template v-else>
            <input
              :value="slide.title ?? ''"
              type="text"
              :data-testid="`slide-title-${idx}`"
              placeholder="Title (optional)"
              class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              @input="onTitleInput(idx, ($event.target as HTMLInputElement).value)"
            />
            <textarea
              :value="slide.body"
              :data-testid="`slide-body-${idx}`"
              class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
              :rows="Math.max(slide.body.split('\n').length, 2)"
              @input="onBodyInput(idx, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </template>
        </div>
      </div>
      <p v-else class="text-sm text-gray-500 italic">No slides in this deck.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAutoSave } from '@/composables/useAutoSave'
import { useImportedSlides } from '@/stores/importedSlides'
import type { TextSlide, ImageSlide } from '@/types/slide'

const props = defineProps<{
  orgId: string
  importId?: string
}>()

const store = useImportedSlides()

const localSlides = ref<(TextSlide | ImageSlide)[]>([])

async function doAutoSave() {
  if (!props.importId) return
  await store.updateDeck(props.orgId, props.importId, {
    slides: localSlides.value,
  })
}

// Note: unlike ScriptureSlideEditor, this component intentionally does NOT call
// store.subscribeDecks/unsubscribeDecks — useSlideshowAssembly already owns a
// single org-scoped importedSlides subscription for the whole ServiceEditorView
// page (feeding the Slideshow Preview). Calling unsubscribeDecks on this
// component's unmount would tear down that shared subscription and silently
// break the live preview after closing this editor panel.
const { status: autoSaveStatus, cleanup: cleanupAutoSave } = useAutoSave(
  localSlides,
  doAutoSave,
)

onMounted(async () => {
  if (props.importId) {
    const deck = await store.getDeck(props.orgId, props.importId)
    if (deck) {
      localSlides.value = deck.slides
    }
  }
})

onUnmounted(() => {
  cleanupAutoSave()
})

function onBodyInput(idx: number, value: string) {
  const slide = localSlides.value[idx]
  if (!slide || slide.contentKind !== 'text') return
  localSlides.value[idx] = { ...slide, body: value }
}

function onTitleInput(idx: number, value: string) {
  const slide = localSlides.value[idx]
  if (!slide || slide.contentKind !== 'text') return
  localSlides.value[idx] = { ...slide, title: value }
}

function onAltTextInput(idx: number, value: string) {
  const slide = localSlides.value[idx]
  if (!slide || slide.contentKind !== 'image') return
  localSlides.value[idx] = { ...slide, altText: value }
}
</script>
