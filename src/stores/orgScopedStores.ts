import { useServiceStore } from './services'
import { useSongStore } from './songs'
import { useRosterStore } from './roster'
import { useTeamsStore } from './teams'
import { useQuartersStore } from './quarters'
import { useSlideGroups } from './slideGroups'
import { useScriptureSlides } from './scriptureSlides'
import { useImportedSlides } from './importedSlides'
import { usePptxRenders } from './pptxRenders'
import { useServiceMessagesStore } from './serviceMessages'
import { useSongLyricsStore } from './songLyrics'

/**
 * Tear down EVERY org-scoped Pinia store — unsubscribe its Firestore listener
 * and clear its cached state — in one call.
 *
 * Quick 260823-switch-church-cache: each store's `subscribe()` re-points its
 * listener to the new org but keeps the previous org's `.value` array until the
 * new snapshot's first emission arrives. Because Vue Router mounts the
 * destination view before the source view unmounts, that stale array flashes on
 * screen for a moment right after switching churches (own church -> Enter
 * Church, or the multi-church picker). Calling this at the moment `orgId`
 * changes — BEFORE any destination view mounts — guarantees no view can render
 * the prior church's data during the switch. Each teardown is null-guarded, so
 * calling it while a view is still mounted (its own onUnmounted will call the
 * same teardown again) is harmless.
 *
 * Imported dynamically from auth.ts to avoid the auth <-> store import cycle.
 *
 * STAGELAYOUTS-RESET-OBLIGATION — RESOLVED (Phase 107): the forward
 * obligation Phase 104 left here (R312) assumed Phase 107 would add a
 * `stageLayouts` org-scoped store needing its own teardown call in this
 * function. It did not. Phase 107 stores the stage layout as an additive,
 * optional field (`Service.stageLayout`) on the SERVICE document itself
 * (107-CONTEXT.md, superseding an earlier ARCHITECTURE.md draft that
 * proposed a separate `stageLayouts/{serviceId}` collection + store), owned
 * end-to-end by `useServiceStore()`, whose `unsubscribeAll()` is already
 * called above. There is NO separate org-scoped stage-layout store to
 * register here, so a church switch (via `selectOrg()`,
 * `enterOrgAsSuperAdmin()`, or `exitSuperAdminView()`, all of which call
 * this function) cannot leak a prior church's stage layout — R312 is
 * satisfied with NO code change to this function. The literal token
 * `STAGELAYOUTS-RESET-OBLIGATION` is kept here (Phase 104 verification greps
 * for it) purely as a resolved historical marker; do not add a new
 * `useStageLayout*()` teardown call — confirming none was needed is the
 * point of this resolution.
 */
export function resetOrgScopedStores(): void {
  useServiceStore().unsubscribeAll()
  useSongStore().unsubscribeAll()
  useRosterStore().unsubscribeAll()
  useTeamsStore().unsubscribeAll()
  useQuartersStore().unsubscribeAll()
  useSlideGroups().unsubscribeGroups()
  useScriptureSlides().unsubscribeReadings()
  useImportedSlides().unsubscribeDecks()
  usePptxRenders().unsubscribeAll()
  useServiceMessagesStore().unsubscribeServiceMessages()
  useSongLyricsStore().unsubscribeLyrics()
}
