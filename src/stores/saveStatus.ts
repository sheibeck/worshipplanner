import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AutoSaveStatus } from '@/composables/useAutoSave'
import { useToasts } from '@/stores/toasts'

export interface SaveStatusEntry {
  status: AutoSaveStatus
  savedAt?: Date
  errorText?: string
}

// WR-01 (32-REVIEW): module-level (not store-internal) so both the toast
// fallback below AND SaveStatusIndicator.vue's inline-error fallback share
// the identical string — 32-UI-SPEC § 4's "toast body always mirrors the
// inline text, word for word" contract would otherwise depend on two
// separately-maintained copies never drifting apart.
export const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."

// 34-10 (UAT F4): module-level, same reasoning as GENERIC_ERROR_TEXT above —
// a consumer that needs to know whether SaveStatusIndicator will render
// anything for a given entry asks THIS, rather than keeping a second copy
// of the indicator's branch list (idle -> nothing, everything else ->
// something) in another file where the two can silently drift apart.
export function hasVisibleSaveStatus(entry: SaveStatusEntry): boolean {
  return entry.status !== 'idle'
}

/**
 * Per-surface save-status aggregator (R040). Sits strictly ABOVE
 * useAutoSave — it does not re-implement any of useAutoSave's own timing,
 * inflight guard, flush() or cleanup() machinery; it only records what each
 * surface reports.
 *
 * Keyed by surfaceId so several autosaving surfaces can be mounted
 * simultaneously without one surface's 'saved' erasing another's 'saving'.
 * This store holds no Firestore state at all — no orgId, no subscribe, no
 * unsubscribeAll.
 *
 * WR-03 (32-REVIEW): a `mostUrgent` cross-surface rollup (deterministic
 * urgency ranking + tie-break) used to live here, fully built and tested,
 * with no production consumer anywhere in `src/` — dead code as shipped.
 * Removed rather than kept "for later," per this codebase's own "don't
 * build more than is needed" convention (32-UI-SPEC § 4's toast-stacking
 * note makes the same call). Re-add it if/when a real cross-surface
 * indicator is planned — the deleted logic is in this phase's own review
 * fix commit for reference.
 */
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
