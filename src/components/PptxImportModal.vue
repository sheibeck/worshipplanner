<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/60"
      ></div>
    </Transition>

    <!-- Modal -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="w-full max-w-lg max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            <div>
              <h2 class="text-base font-semibold text-gray-100">Import PowerPoint / Images</h2>
              <p class="text-xs text-gray-400 mt-0.5">Import a .pptx deck or drop in images directly</p>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              @click="onCancel"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto">

            <!-- Idle state: choose a mode -->
            <div v-if="step === 'idle'" class="px-6 py-8" data-testid="step-idle">
              <div class="space-y-4">
                <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-5 text-center">
                  <p class="text-sm font-medium text-gray-200 mb-2">Import a PowerPoint deck</p>
                  <p class="text-xs text-gray-500 mb-4">
                    Uploaded, parsed server-side, then previewed here before saving.
                  </p>
                  <label
                    class="inline-block px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    Choose .pptx file
                    <input
                      ref="pptxInputRef"
                      type="file"
                      accept=".pptx"
                      class="hidden"
                      data-testid="pptx-file-input"
                      @change="onPptxInputChange"
                    />
                  </label>
                </div>

                <div class="rounded-lg bg-gray-800/60 border border-gray-700 p-5 text-center">
                  <p class="text-sm font-medium text-gray-200 mb-2">Import images directly</p>
                  <p class="text-xs text-gray-500 mb-4">
                    No PowerPoint file — build a deck straight from one or more images.
                  </p>
                  <label
                    class="inline-block px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    Choose image(s)
                    <input
                      ref="imagesInputRef"
                      type="file"
                      accept="image/*"
                      multiple
                      class="hidden"
                      data-testid="image-file-input"
                      @change="onImagesInputChange"
                    />
                  </label>
                </div>
              </div>
            </div>

            <!-- Uploading state -->
            <div v-else-if="step === 'uploading'" class="px-6 py-12 text-center" data-testid="step-uploading">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Uploading...</p>
                <div class="w-full max-w-xs bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    class="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    data-testid="upload-progress"
                    :style="{ width: Math.round(uploadProgress) + '%' }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Parsing state -->
            <div v-else-if="step === 'parsing'" class="px-6 py-12 text-center" data-testid="step-parsing">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Reading your PowerPoint file...</p>
                <p class="text-xs text-gray-500">This may take a moment for large decks.</p>
              </div>
            </div>

            <!-- Preview state -->
            <div v-else-if="step === 'preview'" class="px-6 py-6" data-testid="step-preview">
              <h3 class="text-sm font-semibold text-gray-200 mb-1">Preview</h3>
              <p class="text-xs text-gray-500 mb-4">
                {{ previewSlides.length }} slide{{ previewSlides.length !== 1 ? 's' : '' }} from {{ previewSourceFileName }}
              </p>
              <ul class="space-y-3">
                <li
                  v-for="(slide, idx) in previewSlides"
                  :key="slide.id"
                  :data-testid="`preview-slide-${idx}`"
                  class="rounded-lg bg-gray-800/60 border border-gray-700 p-4"
                >
                  <template v-if="slide.contentKind === 'image'">
                    <img :src="slide.imageUrl" :alt="slide.altText ?? ''" class="max-h-40 mx-auto rounded-md" />
                  </template>
                  <template v-else>
                    <p v-if="slide.title" class="text-sm font-medium text-gray-200 mb-1">{{ slide.title }}</p>
                    <p class="text-xs text-gray-400 whitespace-pre-wrap">{{ slide.body }}</p>
                  </template>
                </li>
              </ul>
              <p v-if="previewSlides.length === 0" class="text-xs text-gray-500">No slides were found in this file.</p>
            </div>

            <!-- Confirming state -->
            <div v-else-if="step === 'confirming'" class="px-6 py-12 text-center" data-testid="step-confirming">
              <div class="flex flex-col items-center gap-4">
                <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-sm text-gray-300">Saving deck...</p>
              </div>
            </div>

            <!-- Error state -->
            <div v-else-if="step === 'error'" class="px-6 py-8" data-testid="step-error">
              <div class="rounded-lg bg-red-900/20 border border-red-800 p-4">
                <div class="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p class="text-sm font-medium text-red-300" data-testid="error-message">{{ errorMessage }}</p>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer actions -->
          <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 shrink-0">
            <button
              v-if="step !== 'uploading' && step !== 'parsing' && step !== 'confirming'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
              data-testid="cancel-btn"
              @click="onCancel"
            >
              Cancel
            </button>

            <button
              v-if="step === 'error'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              data-testid="retry-btn"
              @click="lastRetry?.()"
            >
              Retry
            </button>

            <button
              v-if="step === 'preview'"
              type="button"
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="confirm-btn"
              :disabled="previewSlides.length === 0"
              @click="onConfirm"
            >
              Confirm Import
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useImportedSlides } from '@/stores/importedSlides'
import { generateImportId, uploadPptx, uploadImage, resolveImageUrl } from '@/utils/pptxUpload'
import type { ServiceSection } from '@/types/service'
import type { TextSlide, ImageSlide } from '@/types/slide'

const props = defineProps<{
  open: boolean
  orgId: string
  section: ServiceSection
}>()

const emit = defineEmits<{
  cancel: []
  confirmed: [payload: { importId: string; section: ServiceSection }]
}>()

const importedSlidesStore = useImportedSlides()

// The friendly copy shown for any upload/parse failure (CONTEXT error-handling contract).
// Never varies by failure cause — the client cannot distinguish a corrupt file from a
// transient network error, and both are equally unactionable to the end user.
const FRIENDLY_ERROR = "We couldn't read this file — try re-exporting from PowerPoint."

// ── State ──────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'uploading' | 'parsing' | 'preview' | 'confirming' | 'error'
const step = ref<Step>('idle')
const errorMessage = ref('')

const uploadProgress = ref(0)
const previewSlides = ref<(TextSlide | ImageSlide)[]>([])
const previewSourceFileName = ref('')

const pptxInputRef = ref<HTMLInputElement | null>(null)
const imagesInputRef = ref<HTMLInputElement | null>(null)

// Re-invokes whichever step last failed, wired to the error state's Retry button.
const lastRetry = ref<(() => void) | null>(null)

// ── Reset on open ──────────────────────────────────────────────────────────────

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetToIdle()
  },
)

function resetToIdle() {
  step.value = 'idle'
  errorMessage.value = ''
  uploadProgress.value = 0
  previewSlides.value = []
  previewSourceFileName.value = ''
  lastRetry.value = null
  if (pptxInputRef.value) pptxInputRef.value.value = ''
  if (imagesInputRef.value) imagesInputRef.value.value = ''
}

// ── PPTX mode ──────────────────────────────────────────────────────────────────

function onPptxInputChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) importPptx(file)
}

async function importPptx(file: File) {
  lastRetry.value = () => importPptx(file)
  errorMessage.value = ''
  uploadProgress.value = 0
  step.value = 'uploading'

  try {
    const importId = generateImportId()
    const storagePath = await uploadPptx(props.orgId, importId, file, (pct) => {
      uploadProgress.value = pct
    })

    step.value = 'parsing'

    const parsePptx = httpsCallable<
      { orgId: string; importId: string; storagePath: string },
      { slides: Array<
        | { contentKind: 'text'; title?: string; body: string }
        | { contentKind: 'image'; imageUrl: string; altText?: string }
      > }
    >(functions, 'parsePptx')

    const result = await parsePptx({ orgId: props.orgId, importId, storagePath })

    const mapped: (TextSlide | ImageSlide)[] = []
    let position = 0
    for (const rawSlide of result.data.slides) {
      if (rawSlide.contentKind === 'image') {
        const imageUrl = await resolveImageUrl(rawSlide.imageUrl)
        mapped.push({
          id: crypto.randomUUID(),
          position,
          contentKind: 'image',
          imageUrl,
          // Firestore rejects `undefined` field values, so only include altText when present.
          ...(rawSlide.altText !== undefined && { altText: rawSlide.altText }),
        })
      } else {
        mapped.push({
          id: crypto.randomUUID(),
          position,
          contentKind: 'text',
          // Firestore rejects `undefined` field values, so only include title when present.
          ...(rawSlide.title !== undefined && { title: rawSlide.title }),
          body: rawSlide.body,
        })
      }
      position += 1
    }

    previewSlides.value = mapped
    previewSourceFileName.value = file.name
    step.value = 'preview'
  } catch (err) {
    console.error('[PptxImportModal] PPTX import failed:', err)
    errorMessage.value = FRIENDLY_ERROR
    step.value = 'error'
  }
}

// ── Image-only mode ────────────────────────────────────────────────────────────

function onImagesInputChange(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (files.length > 0) importImages(files)
}

async function importImages(files: File[]) {
  lastRetry.value = () => importImages(files)
  errorMessage.value = ''
  uploadProgress.value = 0
  step.value = 'uploading'

  try {
    const importId = generateImportId()
    const mapped: ImageSlide[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const path = await uploadImage(props.orgId, importId, file, i)
      const imageUrl = await resolveImageUrl(path)
      mapped.push({
        id: crypto.randomUUID(),
        position: i,
        contentKind: 'image',
        imageUrl,
      })
      uploadProgress.value = ((i + 1) / files.length) * 100
    }

    previewSlides.value = mapped
    previewSourceFileName.value = files.length === 1 ? files[0]!.name : `${files.length} images`
    step.value = 'preview'
  } catch (err) {
    console.error('[PptxImportModal] Image import failed:', err)
    errorMessage.value = FRIENDLY_ERROR
    step.value = 'error'
  }
}

// ── Confirm / Cancel ───────────────────────────────────────────────────────────

async function onConfirm() {
  lastRetry.value = onConfirm
  step.value = 'confirming'
  try {
    const importId = await importedSlidesStore.createDeck(props.orgId, {
      sourceFileName: previewSourceFileName.value,
      section: props.section,
      slides: previewSlides.value,
    })
    emit('confirmed', { importId, section: props.section })
  } catch (err) {
    console.error('[PptxImportModal] Saving deck failed:', err)
    errorMessage.value = FRIENDLY_ERROR
    step.value = 'error'
  }
}

function onCancel() {
  if (step.value === 'uploading' || step.value === 'parsing' || step.value === 'confirming') return
  emit('cancel')
}
</script>
