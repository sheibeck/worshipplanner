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
        @click="onCancel"
      ></div>
    </Transition>

    <!-- Dialog -->
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
        @click.self="onCancel"
      >
        <div
          ref="dialogRootRef"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="bodyId"
          class="w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col"
          @keydown="onKeydown"
        >
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-800">
            <h2 :id="titleId" class="text-base font-semibold text-gray-100">
              Enable {{ typeLabel }}?
            </h2>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-3">
            <p :id="bodyId" class="text-sm text-gray-300">
              {{ bodyText }}
            </p>

            <div
              v-if="isBlocked"
              class="text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 text-sm"
            >
              ⚠ Reference detection is incomplete right now — this count may be missing backgrounds
              that are still linked to a song. Enabling is blocked until reference detection
              succeeds, so a song-linked background can never be deleted.
            </div>

            <p v-if="confirmError" class="text-red-400 text-sm mt-2">{{ confirmError }}</p>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-800">
            <button
              ref="cancelButtonRef"
              type="button"
              :disabled="confirming"
              class="border border-gray-700 hover:border-gray-600 rounded-md px-4 py-2 text-sm text-gray-300 hover:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
              @click="onCancel"
            >
              Cancel
            </button>
            <button
              v-if="isBlocked"
              type="button"
              disabled
              class="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 opacity-60 cursor-not-allowed transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              Enable
            </button>
            <button
              v-else
              ref="confirmButtonRef"
              type="button"
              :disabled="confirming"
              :class="[
                'px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-500',
                isDestructive ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500',
              ]"
              @click="onConfirm"
            >
              {{ confirming ? 'Enabling…' : 'Enable' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Phase 71-02 (R189/R190) — Confirm-to-flip modal for the Owner Console's
// Cleanup card. Structural shell (Teleport + backdrop/panel Transition) is
// copied from src/components/NewServiceDialog.vue; the hand-rolled focus
// trap is new to this codebase (no prior precedent), per 71-UI-SPEC.md.
//
// R190 hard block: when `referencesComplete === false` (only ever passed for
// the backgrounds type — the other three types never send this prop), the
// Confirm button is NOT rendered as a clickable element at all — a separate,
// permanently-disabled `<button disabled>` with NO @click handler is
// rendered in its place. There is no code path that can wire a click
// handler to that element; this is what makes the hard block structural
// rather than just visually disabled.
import { computed, nextTick, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    typeLabel: string
    wouldDeleteCount: number
    wouldDeleteBytes: number
    referencesComplete?: boolean
    confirming: boolean
    confirmError: string | null
  }>(),
  {
    referencesComplete: undefined,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const idBase = useId()
const titleId = `cleanup-confirm-title-${idBase}`
const bodyId = `cleanup-confirm-body-${idBase}`

const dialogRootRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const confirmButtonRef = ref<HTMLButtonElement | null>(null)

const isBlocked = computed(() => props.referencesComplete === false)
const isDestructive = computed(() => props.wouldDeleteCount > 0)

const wouldDeleteMb = computed(() => (props.wouldDeleteBytes / 1024 / 1024).toFixed(1))

const bodyText = computed(() => {
  if (props.wouldDeleteCount > 0) {
    return `This will permanently delete up to ${props.wouldDeleteCount} objects (${wouldDeleteMb.value} MB) on the next scheduled run. This cannot be undone.`
  }
  return 'Nothing would be deleted right now. Enabling arms the next scheduled run — newly orphaned data will be deleted automatically once it becomes eligible.'
})

// The element that had focus immediately before the dialog opened (almost
// always the row's Enable button that triggered it) -- captured on open,
// restored on close per 71-UI-SPEC.md Accessibility: "on close, focus
// returns to the row's Enable button that opened the dialog" (review WR-01).
const previouslyFocusedElement = ref<HTMLElement | null>(null)

// Focus-on-open: land on Cancel, never Confirm — a deliberate safe default
// for a dialog that can arm a permanent deletion (71-UI-SPEC.md
// Accessibility). Runs after the DOM has updated for the new `open` value.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      previouslyFocusedElement.value = document.activeElement as HTMLElement | null
      void nextTick(() => {
        cancelButtonRef.value?.focus()
      })
    } else {
      previouslyFocusedElement.value?.focus()
      previouslyFocusedElement.value = null
    }
  },
)

// Gated on `confirming` so EVERY dismissal path (backdrop click, panel
// @click.self, Escape, and the Cancel button itself) is a genuine no-op
// while the enable write is in flight -- matches 71-UI-SPEC.md's "Cancel
// also disabled during the enabling state (prevents closing mid-write)"
// requirement, which previously only the Cancel <button>'s :disabled
// attribute honored (review CR-01).
function onCancel(): void {
  if (props.confirming) return
  emit('cancel')
}

function onConfirm(): void {
  emit('confirm')
}

// Hand-rolled focus trap: Escape cancels (same as the backdrop's
// @click.self); Tab/Shift+Tab cycle only between the dialog's focusable
// buttons — Cancel-only when Confirm is hard-blocked, Cancel+Confirm
// otherwise.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
    return
  }
  if (event.key !== 'Tab') return

  const focusable = isBlocked.value
    ? [cancelButtonRef.value]
    : [cancelButtonRef.value, confirmButtonRef.value]
  const elements = focusable.filter((el): el is HTMLButtonElement => el !== null)
  if (elements.length === 0) return

  const first = elements[0]!
  const last = elements[elements.length - 1]!
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || !elements.includes(active as HTMLButtonElement)) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (active === last || !elements.includes(active as HTMLButtonElement)) {
      event.preventDefault()
      first.focus()
    }
  }
}
</script>
