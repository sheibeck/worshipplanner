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
 * STAGELAYOUTS-RESET-OBLIGATION (Phase 104, R312 forward obligation for
 * Phase 107): Phase 107 adds a `stageLayouts` org-scoped store. When it
 * lands, its `unsubscribe...()` (or equivalent teardown) call MUST be added
 * to this function. Skipping this registration means a church switch (via
 * `selectOrg()`, `enterOrgAsSuperAdmin()`, or `exitSuperAdminView()`, all of
 * which call this function) will leak the PRIOR church's stage layout into
 * the newly-selected church's UI — the exact class of stale-data bug this
 * function exists to prevent for every other store below. Search this
 * codebase for the token `STAGELAYOUTS-RESET-OBLIGATION` to find this note
 * from Phase 107 planning/verification.
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
