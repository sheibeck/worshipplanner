import { reactive } from 'vue'
import { defineStore } from 'pinia'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import type { PptxRenderDoc } from '@/types/pptxRender'

/**
 * See .planning/codebase/STACK.md (Store & Entry-Point Stack Notes (R318) ->
 * src/stores/pptxRenders.ts).
 */
export const usePptxRenders = defineStore('pptxRenders', () => {
  const rendersByImportId = reactive(new Map<string, PptxRenderDoc>())

  // Module-private (not store state): the live listener pool and the org it was opened
  // against. Not exposed on the returned store surface — callers only ever see the
  // resulting `rendersByImportId` data and the two lifecycle actions below.
  const listeners = new Map<string, Unsubscribe>()
  let subscribedOrgId: string | null = null

  function closeListener(importId: string) {
    const unsub = listeners.get(importId)
    if (unsub) {
      unsub()
      listeners.delete(importId)
    }
    // Absence is the representation of "no render document" — removing the cached
    // entry here means a torn-down listener's last-known state can never outlive it.
    rendersByImportId.delete(importId)
  }

  /**
   * The whole of the new design. Diffs `renderImportIds` against the currently open
   * listener set and opens/closes exactly the delta — unchanged ids are left strictly
   * alone (no close-and-reopen, which would drop and re-raise a snapshot on every
   * recompute).
   */
  function syncSubscriptions(orgId: string | null, renderImportIds: string[]) {
    // No org, or an org switch: every existing listener's path is invalidated, so tear
    // all of them down. A null orgId stores nothing and stops here; a switch to a
    // different non-null org falls through to open fresh listeners for the new org below.
    if (!orgId || orgId !== subscribedOrgId) {
      for (const id of Array.from(listeners.keys())) closeListener(id)
      subscribedOrgId = orgId
      if (!orgId) return
    }

    const incoming = new Set(renderImportIds)

    // Close listeners for ids no longer referenced by the current service.
    for (const id of Array.from(listeners.keys())) {
      if (!incoming.has(id)) closeListener(id)
    }

    // Open listeners for newly-referenced ids only — ids already in `listeners` are
    // left untouched, which is what makes a repeat call with an unchanged id set a
    // no-op (the diff is by id membership, never by array identity).
    for (const id of incoming) {
      if (listeners.has(id)) continue
      const unsub = onSnapshot(doc(db, 'organizations', orgId, 'pptxRenders', id), (snap) => {
        if (snap.exists()) {
          rendersByImportId.set(id, snap.data() as PptxRenderDoc)
        } else {
          // No synthesized placeholder — absence IS the "pending"/"not written yet"
          // representation a later plan reads.
          rendersByImportId.delete(id)
        }
      })
      listeners.set(id, unsub)
    }
  }

  /** Tears down every outstanding listener and clears all cached state. Safe to call
   * twice — a second call finds an empty listener set and is a no-op, not a throw. */
  function unsubscribeAll() {
    for (const id of Array.from(listeners.keys())) closeListener(id)
    subscribedOrgId = null
  }

  return {
    rendersByImportId,
    syncSubscriptions,
    unsubscribeAll,
  }
})
