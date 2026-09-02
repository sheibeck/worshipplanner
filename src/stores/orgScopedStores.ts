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
 * See .planning/codebase/STACK.md (Store & Entry-Point Stack Notes (R318) ->
 * src/stores/orgScopedStores.ts).
 *
 * STAGELAYOUTS-RESET-OBLIGATION — RESOLVED (Phase 107, R312): confirmed no separate
 * org-scoped stage-layout store exists to register here (stageLayout lives on the
 * Service document, owned by useServiceStore()). Literal token kept — Phase 104
 * verification greps for it; do not add a new useStageLayout*() teardown call.
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
