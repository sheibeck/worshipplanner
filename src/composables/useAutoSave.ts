import { ref, watch, onUnmounted, type WatchSource, type Ref, type ComputedRef } from 'vue'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface UseAutoSaveOptions {
  /** Debounce delay in milliseconds before triggering a save (default 800). */
  debounceMs?: number
}

export interface UseAutoSaveReturn {
  /** Reactive status of the auto-save lifecycle. */
  status: Ref<AutoSaveStatus>
  /** Force an immediate save, bypassing the debounce timer. */
  flush: () => Promise<void>
  /** Clear all pending timers. Call in onUnmounted or when tearing down. */
  cleanup: () => void
}

/**
 * See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useAutoSave.ts).
 *
 * @param watchSource - Reactive source to watch (deep).
 * @param saveFn      - Async function that performs the actual save.
 * @param isDirty     - Optional computed that must be true for a save to proceed.
 *                      When provided and false, saves are skipped and status
 *                      returns to 'idle'.
 * @param options     - Optional configuration (debounceMs).
 */
export function useAutoSave(
  watchSource: WatchSource,
  saveFn: () => Promise<void>,
  isDirty?: ComputedRef<boolean>,
  options?: UseAutoSaveOptions,
): UseAutoSaveReturn {
  const debounceMs = options?.debounceMs ?? 800

  const status = ref<AutoSaveStatus>('idle')

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let initialized = false
  let saving = false

  function clearDebounceTimer() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function scheduleSave() {
    debounceTimer = setTimeout(async () => {
      debounceTimer = null

      // If isDirty is provided and currently false, skip the save
      if (isDirty && !isDirty.value) {
        status.value = 'idle'
        return
      }

      // Inflight guard: a save is already running — reschedule
      if (saving) {
        scheduleSave()
        return
      }

      saving = true
      status.value = 'saving'
      try {
        await saveFn()
        // See ADR-0121 (docs/adr/0121-a-newer-mutation-may-have-already-run-its-own-watcher-while.md)
        // control-flow narrowing sees `status.value = 'saving'` a few lines
        // up and (wrongly, for a Vue ref that's shared, mutable state) keeps
        // treating `status.value` as the literal `'saving'` across the
        // `await` above, even though the mutation watcher runs concurrently
        // and can have set it to `'pending'` in the meantime.
        if ((status.value as AutoSaveStatus) !== 'pending') status.value = 'saved'
      } catch {
        if ((status.value as AutoSaveStatus) !== 'pending') status.value = 'error'
      } finally {
        saving = false
      }
    }, debounceMs)
  }

  watch(
    watchSource,
    () => {
      // Suppress the first trigger (fires when data is initially loaded)
      if (!initialized) {
        initialized = true
        return
      }

      // If isDirty is provided and currently false, don't start debounce
      if (isDirty && !isDirty.value) return

      status.value = 'pending'
      clearDebounceTimer()
      scheduleSave()
    },
    { deep: true },
  )

  /**
   * Force an immediate save, bypassing the debounce timer.
   * Only saves if there is a pending change (status is 'pending').
   */
  async function flush(): Promise<void> {
    // See ADR-0122 (docs/adr/0122-check-for-an-inflight-save-before-clearing-the-debounce-time.md)
    if (saving) return

    clearDebounceTimer()

    // Only flush if there is something pending
    if (status.value !== 'pending') return

    // If isDirty is provided and currently false, skip
    if (isDirty && !isDirty.value) {
      status.value = 'idle'
      return
    }

    saving = true
    status.value = 'saving'
    try {
      await saveFn()
      // See ADR-0121 (docs/adr/0121-a-newer-mutation-may-have-already-run-its-own-watcher-while.md)
      if ((status.value as AutoSaveStatus) !== 'pending') status.value = 'saved'
    } catch {
      if ((status.value as AutoSaveStatus) !== 'pending') status.value = 'error'
    } finally {
      saving = false
    }
  }

  /** Clear all pending timers (currently: the debounce timer). */
  function cleanup() {
    clearDebounceTimer()
  }

  // Auto-cleanup when the host component unmounts
  onUnmounted(cleanup)

  return { status, flush, cleanup }
}
