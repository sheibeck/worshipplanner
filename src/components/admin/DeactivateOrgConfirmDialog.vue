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
              Deactivate {{ orgName }}?
            </h2>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-3">
            <p :id="bodyId" class="text-sm text-gray-300">
              Deactivating «{{ orgName }}» will block all {{ memberCount }} member(s) of this
              church from logging in until it is reactivated. This can be reversed at any time by
              reactivating.
            </p>

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
              :disabled="confirming"
              class="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              @click="onConfirm"
            >
              {{ confirming ? 'Deactivating…' : 'Deactivate' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Quick task 260824 — reversible-lifecycle confirm dialog for deactivating a
// church. Structural shell (Teleport + backdrop/panel Transition, hand-rolled
// focus trap, focus-on-open/close, `confirming` guard on every dismissal
// path) is copied verbatim from DeleteOrgConfirmDialog.vue (Phase 77-02),
// which establishes this shell for the admin org-list dialogs.
//
// Deliberate divergence from DeleteOrgConfirmDialog.vue: NO type-to-confirm
// text input. Deleting an org is irreversible, so DeleteOrgConfirmDialog
// gates its Delete button on an exact name match as a slip-proof safeguard.
// Deactivating is reversible (a super-admin can reactivate at any time), so a
// single Confirm/Cancel pair with plain consequence copy is proportionate —
// see this quick task's PLAN.md "Considered tradeoffs".
import { nextTick, ref, useId, watch } from 'vue'

const props = defineProps<{
  open: boolean
  orgName: string
  memberCount: number
  confirming: boolean
  confirmError: string | null
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const idBase = useId()
const titleId = `deactivate-org-confirm-title-${idBase}`
const bodyId = `deactivate-org-confirm-body-${idBase}`

const dialogRootRef = ref<HTMLElement | null>(null)
const cancelButtonRef = ref<HTMLButtonElement | null>(null)
const confirmButtonRef = ref<HTMLButtonElement | null>(null)

// The element that had focus immediately before the dialog opened --
// captured on open, restored on close (mirrors DeleteOrgConfirmDialog's
// previouslyFocusedElement pattern).
const previouslyFocusedElement = ref<HTMLElement | null>(null)

// Focus-on-open: land on Cancel, never Deactivate -- a deliberate safe
// default for a destructive (if reversible) action.
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
// while the deactivate call is in flight -- mirrors DeleteOrgConfirmDialog's
// onCancel guard.
function onCancel(): void {
  if (props.confirming) return
  emit('cancel')
}

function onConfirm(): void {
  if (props.confirming) return
  emit('confirm')
}

// Hand-rolled focus trap: Escape cancels (same as the backdrop's
// @click.self); Tab/Shift+Tab cycle only between Cancel and Deactivate.
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
