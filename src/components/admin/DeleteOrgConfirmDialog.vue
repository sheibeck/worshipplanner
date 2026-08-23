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
              Delete {{ orgName }} — this cannot be undone
            </h2>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-3">
            <p :id="bodyId" class="text-sm text-gray-300">
              This will permanently delete «{{ orgName }}» — {{ memberCount }} member(s),
              {{ pendingCount }} pending invite(s), and all of its services, songs, slides, and
              files. This cannot be undone.
            </p>

            <div>
              <label :for="inputId" class="block text-xs font-medium text-gray-400 mb-1">
                Type the church name to confirm
              </label>
              <input
                :id="inputId"
                v-model="typedName"
                type="text"
                :placeholder="orgName"
                :disabled="confirming"
                class="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-500 disabled:opacity-60"
              />
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
              ref="confirmButtonRef"
              type="button"
              :disabled="isDeleteDisabled"
              class="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              @click="onConfirm"
            >
              {{ confirming ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Phase 77-02 (R220) — type-to-confirm destructive dialog for deleting a
// deactivated church. Structural shell (Teleport + backdrop/panel Transition,
// hand-rolled focus trap, focus-on-open/close) is copied verbatim from
// CleanupEnableConfirmDialog.vue, which establishes this shell (71-02). The
// isBlocked/hard-block dual-button pattern is intentionally NOT copied --
// that existed for R190's structural "never deletable" fail-safe, which does
// not apply here: typing the correct name is something the user CAN do, so a
// single `<button :disabled>` gate is sufficient for R220.
import { computed, nextTick, ref, useId, watch } from 'vue'

const props = defineProps<{
  open: boolean
  orgName: string
  memberCount: number
  pendingCount: number
  confirming: boolean
  confirmError: string | null
}>()

const emit = defineEmits<{
  confirm: [typedName: string]
  cancel: []
}>()

const idBase = useId()
const titleId = `delete-org-confirm-title-${idBase}`
const bodyId = `delete-org-confirm-body-${idBase}`
const inputId = `delete-org-confirm-input-${idBase}`

const dialogRootRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const confirmButtonRef = ref<HTMLButtonElement | null>(null)

// Internal typed-name state -- reset on every open transition (see watch
// below) so a stale value from a previous org's dialog never carries over.
const typedName = ref('')

// Exact, case-sensitive comparison (trim only, no lowercasing --
// 77-RESEARCH.md Assumption A1/Pitfall 3: "grace church" must NOT satisfy
// "Grace Church"). Structurally disabled, not just visually -- there is no
// code path that can click through this button with a non-matching value.
const isDeleteDisabled = computed(() => props.confirming || typedName.value.trim() !== props.orgName)

// The element that had focus immediately before the dialog opened --
// captured on open, restored on close (mirrors CleanupEnableConfirmDialog's
// previouslyFocusedElement pattern).
const previouslyFocusedElement = ref<HTMLElement | null>(null)

// Focus-on-open: land on Cancel, never Delete -- a deliberate safe default
// for an irreversible destructive action. Also resets the typed-name input
// on every open transition.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      typedName.value = ''
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
// while the delete call is in flight -- mirrors CleanupEnableConfirmDialog's
// onCancel guard.
function onCancel(): void {
  if (props.confirming) return
  emit('cancel')
}

function onConfirm(): void {
  if (isDeleteDisabled.value) return
  emit('confirm', typedName.value.trim())
}

// Hand-rolled focus trap: Escape cancels (same as the backdrop's
// @click.self); Tab/Shift+Tab cycle only between Cancel and Delete.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
    return
  }
  if (event.key !== 'Tab') return

  const elements = [cancelButtonRef.value, confirmButtonRef.value].filter(
    (el): el is HTMLButtonElement => el !== null,
  )
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
