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
 * Reusable auto-save composable extracted from ServiceEditorView's pattern.
 *
 * Watches a reactive source with a deep watcher, debounces changes, and calls
 * `saveFn` after the debounce period elapses.  An inflight guard prevents
 * concurrent saves — if a save is already running when the timer fires, the
 * save is rescheduled.
 *
 * The first trigger from the watcher is suppressed (initialized guard) so that
 * the initial load of data does not trigger a save.
 *
 * Status is one of five values: 'idle' | 'pending' | 'saving' | 'saved' |
 * 'error'. A rejected `saveFn` is contained on both the debounced path and
 * `flush()` and surfaces as the 'error' status rather than an unhandled
 * rejection — it is never left stranded at 'saving'. The handling is
 * generic: it only sets the status, it does not inspect or discriminate
 * the failure. The 'saved' state is terminal — it persists until the next
 * pending transition, it does not fade back to 'idle' on its own.
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
        // CR-01: a newer mutation may have already run its own watcher while
        // this save was in flight, advancing status to 'pending' and arming
        // its own follow-up timer. Don't stomp that back to 'saved' — doing
        // so lies about an edit that hasn't actually been persisted, and
        // (worse, for callers whose "is there anything left to save" check
        // is keyed off something other than this status) can make the
        // follow-up timer believe there's nothing left to do.
        //
        // The `as AutoSaveStatus` widen is required, not decorative: TS's
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
    // CR-02: check for an inflight save BEFORE clearing the debounce timer,
    // not after. A newer mutation can have set status back to 'pending' and
    // armed its own follow-up timer while a PREVIOUS save is still in
    // flight; clearing the timer unconditionally here — as this used to —
    // destroys that follow-up timer, and then the `if (saving) return`
    // below no-ops without ever performing a save. The edit becomes
    // unreachable: no timer is armed, and this call already returned. By
    // returning here first, the already-armed timer survives to retry the
    // edit on its own schedule once the inflight save clears `saving`.
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
      // CR-01, mirrored from scheduleSave's success handler above (including
      // the `as AutoSaveStatus` widen — see that comment for why it's
      // required).
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
