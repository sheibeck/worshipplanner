import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AutoSaveStatus } from '@/composables/useAutoSave'
import { useToasts } from '@/stores/toasts'

export interface SaveStatusEntry {
  status: AutoSaveStatus
  savedAt?: Date
  errorText?: string
}

// See ADR-0157 (docs/adr/0157-module-level-not-store-internal-so-both-the-toast-fallback-b.md)
export const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."

// 34-10 (UAT F4): module-level, same reasoning as GENERIC_ERROR_TEXT above —
// a consumer that needs to know whether SaveStatusIndicator will render
// anything for a given entry asks THIS, rather than keeping a second copy
// of the indicator's branch list (idle -> nothing, everything else ->
// something) in another file where the two can silently drift apart.
export function hasVisibleSaveStatus(entry: SaveStatusEntry): boolean {
  return entry.status !== 'idle'
}

/** See ADR-0158 (docs/adr/0158-keyed-by-surfaceid-so-several-autosaving-surfaces-can-be-mou.md) */
export const useSaveStatus = defineStore('saveStatus', () => {
  const entries = ref<Record<string, SaveStatusEntry>>({})

  function set(surfaceId: string, entry: SaveStatusEntry) {
    // set() is the single place the not-error -> error edge is detected,
    // so no caller needs to know toasts exist. Read the previous entry
    // BEFORE overwriting: a toast fires only on the transition INTO
    // 'error' for this surface, never on every reactive tick while the
    // surface stays 'error' (that would spam a toast every retry of an
    // 800ms-debounced save against a still-down network).
    const previous = entries.value[surfaceId]
    if (entry.status === 'error' && previous?.status !== 'error') {
      // Resolved lazily against the active Pinia at call time, not at
      // module scope.
      useToasts().push(entry.errorText ?? GENERIC_ERROR_TEXT)
    }
    entries.value[surfaceId] = entry
  }

  function clear(surfaceId: string) {
    delete entries.value[surfaceId]
  }

  function entryFor(surfaceId: string): SaveStatusEntry {
    // Return a fresh idle object rather than a shared singleton, so a
    // consumer holding this reference cannot mutate it into the store.
    return entries.value[surfaceId] ?? { status: 'idle' }
  }

  return { entries, set, clear, entryFor }
})
