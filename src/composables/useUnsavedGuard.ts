import { ref } from 'vue'

/**
 * Tracks a baseline snapshot of a drawer's editable form state (captured when
 * the drawer opens) and exposes a dirty-check plus a confirm-before-discard
 * guard for Cancel / backdrop / × close actions.
 *
 * Usage:
 *   const guard = useUnsavedGuard(() => ({ ...form.value }))
 *   // after seeding form state on open:
 *   guard.capture()
 *   // in the close handler:
 *   function onCancel() {
 *     if (!guard.confirmDiscard()) return
 *     emit('close')
 *   }
 */
export function useUnsavedGuard<T>(getSnapshot: () => T) {
  const baseline = ref<string>('')

  function capture() {
    baseline.value = JSON.stringify(getSnapshot())
  }

  function isDirty(): boolean {
    return JSON.stringify(getSnapshot()) !== baseline.value
  }

  function confirmDiscard(): boolean {
    if (!isDirty()) return true
    return window.confirm('You have unsaved changes. Discard them?')
  }

  return { capture, isDirty, confirmDiscard }
}
