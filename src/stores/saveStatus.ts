import { ref, computed } from 'vue'
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

// One place the urgency ordering lives — no consumer re-derives it in a
// template v-if chain.
const URGENCY: Record<AutoSaveStatus, number> = {
  error: 4,
  saving: 3,
  pending: 2,
  saved: 1,
  idle: 0,
}

/**
 * Per-surface save-status aggregator (R040). Sits strictly ABOVE
 * useAutoSave — it does not re-implement any of useAutoSave's own timing,
 * inflight guard, flush() or cleanup() machinery; it only records what each
 * surface reports and derives a "most urgent" rollup across all of them.
 *
 * Keyed by surfaceId so several autosaving surfaces can be mounted
 * simultaneously without one surface's 'saved' erasing another's 'saving'.
 * This store holds no Firestore state at all — no orgId, no subscribe, no
 * unsubscribeAll.
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

  const mostUrgent = computed<SaveStatusEntry | null>(() => {
    // Iterate keys sorted lexicographically before reducing, so that when
    // two surfaces report the same status the winner is the
    // lexicographically-first surface id, identically on every
    // re-evaluation. Ties resolving by insertion order would be
    // non-deterministic across remounts.
    const keys = Object.keys(entries.value).sort()
    if (keys.length === 0) return null

    let bestKey = keys[0]!
    for (const key of keys.slice(1)) {
      if (URGENCY[entries.value[key]!.status] > URGENCY[entries.value[bestKey]!.status]) {
        bestKey = key
      }
    }
    return entries.value[bestKey]!
  })

  return { entries, set, clear, entryFor, mostUrgent }
})
