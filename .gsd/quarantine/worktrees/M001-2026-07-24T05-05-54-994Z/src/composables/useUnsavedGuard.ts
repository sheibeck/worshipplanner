import { ref, computed, type ComputedRef } from 'vue'

/**
 * Tracks a baseline snapshot of a drawer's editable form state (captured when
 * the drawer opens) and exposes a reactive dirty-check plus a
 * confirm-before-discard guard for Cancel / backdrop / × close actions.
 *
 * `isDirty` is a reactive computed (true when the current form state differs
 * from the captured baseline) so it can drive Save-button styling in templates,
 * mirroring ServiceEditorView's dirty-aware Save affordance.
 *
 * Usage:
 *   const guard = useUnsavedGuard(() => ({ ...form.value }))
 *   // after seeding form state on open:
 *   guard.capture()
 *   // in the template: :disabled="!guard.isDirty.value" (or destructured)
 *   // in the close handler:
 *   function onCancel() {
 *     if (!guard.confirmDiscard()) return
 *     emit('close')
 *   }
 */
export function useUnsavedGuard<T>(getSnapshot: () => T): {
  capture: () => void
  isDirty: ComputedRef<boolean>
  confirmDiscard: () => boolean
} {
  const baseline = ref<string>('')

  function capture() {
    baseline.value = JSON.stringify(getSnapshot())
  }

  const isDirty = computed<boolean>(() => JSON.stringify(getSnapshot()) !== baseline.value)

  function confirmDiscard(): boolean {
    if (!isDirty.value) return true
    return window.confirm('You have unsaved changes. Discard them?')
  }

  return { capture, isDirty, confirmDiscard }
}
