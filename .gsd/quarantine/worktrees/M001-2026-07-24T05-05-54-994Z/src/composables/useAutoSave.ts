import { ref, watch, onUnmounted, type WatchSource, type Ref, type ComputedRef } from 'vue'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved'

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
  let savedFadeTimer: ReturnType<typeof setTimeout> | null = null
  let initialized = false
  let saving = false

  function clearDebounceTimer() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function clearSavedFadeTimer() {
    if (savedFadeTimer !== null) {
      clearTimeout(savedFadeTimer)
      savedFadeTimer = null
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
        status.value = 'saved'
        // Fade "Saved" indicator back to idle after 3 seconds
        clearSavedFadeTimer()
        savedFadeTimer = setTimeout(() => {
          if (status.value === 'saved') {
            status.value = 'idle'
          }
        }, 3000)
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
    clearDebounceTimer()

    // Only flush if there is something pending
    if (status.value !== 'pending') return

    // If isDirty is provided and currently false, skip
    if (isDirty && !isDirty.value) {
      status.value = 'idle'
      return
    }

    // Wait for any inflight save to complete
    if (saving) return

    saving = true
    status.value = 'saving'
    try {
      await saveFn()
      status.value = 'saved'
      clearSavedFadeTimer()
      savedFadeTimer = setTimeout(() => {
        if (status.value === 'saved') {
          status.value = 'idle'
        }
      }, 3000)
    } finally {
      saving = false
    }
  }

  /** Clear all pending timers (debounce + saved-fade). */
  function cleanup() {
    clearDebounceTimer()
    clearSavedFadeTimer()
  }

  // Auto-cleanup when the host component unmounts
  onUnmounted(cleanup)

  return { status, flush, cleanup }
}
