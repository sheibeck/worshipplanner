import { useServiceStore } from './services'
import { useSongStore } from './songs'
import { useRosterStore } from './roster'
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
 */
export function resetOrgScopedStores(): void {
  useServiceStore().unsubscribeAll()
  useSongStore().unsubscribeAll()
  useRosterStore().unsubscribeAll()
  useQuartersStore().unsubscribeAll()
  useSlideGroups().unsubscribeGroups()
  useScriptureSlides().unsubscribeReadings()
  useImportedSlides().unsubscribeDecks()
  usePptxRenders().unsubscribeAll()
  useServiceMessagesStore().unsubscribeServiceMessages()
  useSongLyricsStore().unsubscribeLyrics()
}
