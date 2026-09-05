// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts). See also .planning/codebase/STACK.md (same section) for the R006 reactivity contract.
import { ref, reactive, computed, watch, onScopeDispose, type Ref, type ComputedRef } from 'vue'
import { onSnapshot } from 'firebase/firestore'
import { useScriptureSlides } from '@/stores/scriptureSlides'
import { useImportedSlides } from '@/stores/importedSlides'
import { useSlideGroups } from '@/stores/slideGroups'
import { usePptxRenders } from '@/stores/pptxRenders'
import { lyricsQuery } from '@/stores/songLyrics'
import { resolveImageUrl } from '@/utils/pptxUpload'
import { renderedPagePath } from '@/utils/renderedPagePaths'
import { assembleSlideshow, type AssemblyInputs } from '@/utils/slideshowAssembler'
import { buildInitialGroup, rebuildGroup, sourceSignature, type RebuildResult } from '@/utils/slideGroupMaterializer'
import { SERVICE_SECTIONS, SERVICE_SECTION_LABELS, type Service } from '@/types/service'
import type { AssembledSlide, AssembledSection } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { SlideGroup, SlideGroupInput, GroupSlideEntry } from '@/types/slideGroup'

/** Tears down a lyrics subscription opened by a {@link LyricsSubscriber}. */
export type LyricsUnsubscribe = () => void

// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "LyricsSubscriber")
export type LyricsSubscriber = (
  orgId: string,
  songId: string,
  onUpdate: (lyrics: SongLyrics | null) => void,
) => LyricsUnsubscribe

/**
 * Default lyrics subscriber — a LIVE `onSnapshot` listener (replacing the
 * pre-existing one-shot `getDocs` cache, which only re-fetched when a new
 * distinct songId appeared and so left content/structure edits stale until a
 * full remount) against organizations/{orgId}/songs/{songId}/lyrics.
 * R351/ARCH-009 — routes through the SAME `lyricsQuery()` the `songLyrics`
 * store's `subscribeLyrics` uses, so neither can drift from the other on the
 * ordering. LW-01 (119-REVIEW) — this consumer only ever reads `docs[0]`
 * (newest-wins), so it passes `limitCount: 1` to avoid the live listener
 * downloading every historical lyrics doc per song on each snapshot; the
 * `songLyrics` store's own call omits the limit since its `lyricVersions`
 * needs the full ordered set. Same `orderBy('createdAt','desc')` on both
 * calls means this `docs[0]` is byte-identical to the unbounded query's.
 * Missing `performanceOrder` defaults to `[]`, same as the store and the old
 * loader.
 */
function defaultLyricsSubscriber(
  orgId: string,
  songId: string,
  onUpdate: (lyrics: SongLyrics | null) => void,
): LyricsUnsubscribe {
  const q = lyricsQuery(orgId, songId, 1)
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      onUpdate(null)
      return
    }
    const docSnap = snap.docs[0]!
    const data = docSnap.data() as Record<string, unknown>
    if (!Array.isArray(data.performanceOrder)) {
      data.performanceOrder = []
    }
    onUpdate({ id: docSnap.id, songId, ...data } as SongLyrics)
  })
}

// See ADR-0136 (docs/adr/0136-pptxrendersstore-is-a-pinia-singleton-but-this-composable-s.md)
let activeSlideshowAssemblyInstances = 0

export interface UseSlideshowAssemblyOptions {
  /** Injectable lyrics subscriber — defaults to a real Firestore `onSnapshot` listener. */
  lyricsSubscriber?: LyricsSubscriber
  /**
   * Whether this consumer is allowed to write slide groups (materialize/
   * reconcile). Defaults to `false` — the `/services/:id` route has no
   * editor guard (Phase 17 gated viewer safety at the store/UI level, not
   * the route), so a viewer must never attempt a write Firestore's
   * `isOrgEditor(orgId)` rule would deny anyway. The single call site
   * (`ServiceEditorView.vue`) supplies `authStore.isEditor`.
   */
  canWrite?: Ref<boolean> | ComputedRef<boolean> | boolean
}

/**
 * Result of an on-demand materialization (25-05 Task 1): the group's current
 * slide entries plus its stored source signature. Returned by value rather
 * than left for the caller to re-derive from `groupsBySlotId`, because the
 * store's write does not update that map until the Firestore snapshot round
 * trip lands — a caller that re-read the map immediately after calling
 * `ensureGroupMaterialized` would see an empty (or stale) list and append to
 * it, destroying the entries this call just wrote.
 */
export interface EnsureGroupMaterializedResult {
  entries: GroupSlideEntry[]
  sourceSignature?: string
}

export interface UseSlideshowAssemblyReturn {
  assembledSlideshow: ComputedRef<AssembledSlide[]>
  assembledSections: ComputedRef<AssembledSection[]>
  isLoading: Ref<boolean>
  /** Re-exposed from the `slideGroups` store so consumers (24-06's delete warning) don't subscribe a second time. */
  groupsBySlotId: ComputedRef<Map<string, SlideGroup>>
  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "ensureGroupMaterialized")
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "suppressMaterialization")
  suppressMaterialization: (slotId: string) => () => void
  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "drainGroupWrites")
  drainGroupWrites: () => Promise<void>
}

/**
 * @param service - The service to assemble a slideshow for.
 * @param orgId - Organization id (reactive or a plain string) scoping the
 *   scripture-readings subscription and the per-song lyrics lookups.
 * @param options - Optional lyrics-loader injection point for tests.
 */
export function useSlideshowAssembly(
  service: Ref<Service | null> | ComputedRef<Service | null>,
  orgId: Ref<string | null> | string,
  options?: UseSlideshowAssemblyOptions,
): UseSlideshowAssemblyReturn {
  const scriptureStore = useScriptureSlides()
  const importedStore = useImportedSlides()
  const slideGroupsStore = useSlideGroups()
  const pptxRendersStore = usePptxRenders()
  const subscribeLyrics = options?.lyricsSubscriber ?? defaultLyricsSubscriber

  // See ADR-0137 (docs/adr/0137-activeslideshowassemblyinstances-still-includes-this-instanc.md)
  activeSlideshowAssemblyInstances += 1

  const canWrite = computed<boolean>(() => {
    const cw = options?.canWrite
    if (cw === undefined) return false
    return typeof cw === 'boolean' ? cw : cw.value
  })

  const resolvedOrgId = computed<string | null>(() =>
    typeof orgId === 'string' ? orgId : orgId.value,
  )

  // --- scripture readings / imported decks / slide groups: subscribe once per org, guard against double-subscribe ---
  const subscribedOrgId = ref<string | null>(null)
  const stopOrgWatch = watch(
    resolvedOrgId,
    (id) => {
      if (id && subscribedOrgId.value !== id) {
        scriptureStore.subscribeReadings(id)
        importedStore.subscribeDecks(id)
        slideGroupsStore.subscribeGroups(id)
        subscribedOrgId.value = id
      }
    },
    { immediate: true },
  )

  const scriptureReadingsById = computed(() => {
    const map = new Map<string, (typeof scriptureStore.readings)[number]>()
    for (const reading of scriptureStore.readings) {
      map.set(reading.id, reading)
    }
    return map
  })

  const importedDecksById = computed(() => {
    const map = new Map<string, (typeof importedStore.decks)[number]>()
    for (const deck of importedStore.decks) {
      map.set(deck.id, deck)
    }
    return map
  })

  // --- Phase 42 (R079/R080): render-status subscription, driven by the service's IMPORTED slots ---
  //
  // `distinctRenderImportIds` is fully SYNCHRONOUS (mirrors `distinctSongIds` below) — it
  // decides WHAT to subscribe and nothing else. Two identifier hops, both load-bearing: a
  // slot's `importId` is the deck's Firestore doc id (`ImportedDeck.id`), used to look the
  // deck up in `importedDecksById`; the value actually collected is that deck's Storage-side
  // `renderImportId` (`ImportedDeck.renderImportId`), which is what `pptxRendersStore` and
  // `renderedPagePath` are keyed by. Conflating the two would subscribe (or resolve URLs
  // against) the wrong document.
  const distinctRenderImportIds = computed<string[]>(() => {
    const svc = service.value
    if (!svc) return []
    const ids = new Set<string>()
    for (const slot of svc.slots) {
      // 1. A dedicated IMPORTED slot — the deck attached at the slot level.
      if (slot.kind === 'IMPORTED' && slot.importId) {
        const deck = importedDecksById.value.get(slot.importId)
        if (deck?.renderImportId) ids.add(deck.renderImportId)
      }
      // 2. See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "distinctRenderImportIds's imported-entry collection"). Same identifier hop as the IMPORTED-slot branch above.
      const group = slideGroupsStore.groupsBySlotId.get(slot.id)
      if (group) {
        for (const entry of group.slides) {
          if (entry.sourceRef.kind !== 'imported') continue
          const deck = importedDecksById.value.get(entry.sourceRef.importId)
          if (deck?.renderImportId) ids.add(deck.renderImportId)
        }
      }
    }
    return Array.from(ids)
  })

  // Deliberately NOT folded into the `stopOrgWatch` org watch above: that watch subscribes
  // once per org (guarded by `subscribedOrgId`) and is inert on a repeat call with the same
  // org, whereas this watch must re-run every time the id SET changes within the same org
  // (a deck added/removed from the service). Merging them would either drop the org guard
  // (re-subscribing scripture/imported/groups on every deck change) or lose render-id
  // reactivity (no re-sync when a deck is added/removed without an org change) — do not
  // "tidy" these into one watch.
  const stopRenderSubscriptionWatch = watch(
    [distinctRenderImportIds, resolvedOrgId],
    ([ids, org]) => {
      pptxRendersStore.syncSubscriptions(org, ids)
    },
    { immediate: true },
  )

  // See ADR-0138 (docs/adr/0138-phase-42-r079-r080-resolve-and-cache-rendered-page-download.md)
  const renderedUrlCache = reactive(new Map<string, string[]>())

  function renderedUrlCacheKey(renderImportId: string, renderedCount: number): string {
    return `${renderImportId}:${renderedCount}`
  }

  // Fully SYNCHRONOUS (same split as `distinctSongIds`/`distinctRenderImportIds`
  // above) — a string signal encoding each currently-referenced id's status and
  // renderedCount, so the watch below re-fires exactly when a document transitions
  // (pending → ready, or a re-render's count changes) rather than only when the id
  // SET changes. This is what gives criterion 4 its LIVE reactivity: the id set
  // alone does not change across a pending → ready transition, only this signal does.
  const renderReadySignal = computed<string>(() =>
    distinctRenderImportIds.value
      .map((id) => {
        const render = pptxRendersStore.rendersByImportId.get(id)
        return `${id}:${render?.status ?? ''}:${render?.renderedCount ?? ''}`
      })
      .join('|'),
  )

  async function loadMissingRenderedUrls(org: string | null, ids: string[]) {
    if (!org) return

    const toLoad: { id: string; count: number }[] = []
    for (const id of ids) {
      const render = pptxRendersStore.rendersByImportId.get(id)
      if (!render || render.status !== 'ready') continue
      const count = render.renderedCount
      if (count === undefined || count < 1) continue
      if (renderedUrlCache.has(renderedUrlCacheKey(id, count))) continue
      toLoad.push({ id, count })
    }
    if (toLoad.length === 0) return

    await Promise.all(
      toLoad.map(async ({ id, count }) => {
        try {
          const urls = await Promise.all(
            Array.from({ length: count }, (_, i) => resolveImageUrl(renderedPagePath(org, id, i + 1))),
          )
          const freshKey = renderedUrlCacheKey(id, count)
          // See ADR-0139 (docs/adr/0139-only-the-current-count-s-entry-is-ever-read-again.md)
          for (const key of renderedUrlCache.keys()) {
            if (key !== freshKey && key.startsWith(`${id}:`)) renderedUrlCache.delete(key)
          }
          renderedUrlCache.set(freshKey, urls)
        } catch (err) {
          // Same containment posture as `materializeCandidates`/`applyRebuildOutcomes`
          // (HI-01): one unreadable page must not abort resolution for other decks in
          // the same batch. Logged, not thrown — a failed resolution simply leaves the
          // cache miss, so `renderedImageUrlsByImportId` continues to omit this deck.
          console.error('[useSlideshowAssembly] rendered-page URL resolution failed:', err)
        }
      }),
    )
  }

  const stopRenderedUrlsWatch = watch(
    [distinctRenderImportIds, renderReadySignal, resolvedOrgId],
    ([ids, , org]) => {
      void loadMissingRenderedUrls(org, ids)
    },
    { immediate: true },
  )

  // Walks the LIVE render documents (not the id list) so a `pending → ready`
  // transition is reflected the moment the store's `onSnapshot` updates
  // `rendersByImportId`. Emits an entry ONLY when the cache holds the array for
  // THAT document's CURRENT `renderedCount` — never a stale array left over from a
  // previous render's count — which is what makes a stale array unreachable
  // rather than merely unlikely (T-42-07).
  const renderedImageUrlsByImportId = computed<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>()
    for (const [id, render] of pptxRendersStore.rendersByImportId) {
      if (render.status !== 'ready') continue
      const count = render.renderedCount
      if (count === undefined || count < 1) continue
      const urls = renderedUrlCache.get(renderedUrlCacheKey(id, count))
      if (urls) map.set(id, urls)
    }
    return map
  })

  // --- per-song current lyrics: songLyrics store is single-song, so gather
  // here via a LIVE `onSnapshot` subscription per distinct songId (Part 1).
  // A lyric edit — reworded text OR a verse added/removed/reordered — pushes
  // into `songLyricsById` reactively, so the assembler re-renders with no
  // remount and regardless of `canWrite`. Teardown lives in `cleanup()`.
  const songLyricsById = reactive(new Map<string, SongLyrics>())
  const isLoading = ref(false)
  // Open lyrics subscriptions keyed by songId, plus the org they were opened
  // under (an org change tears them all down — they query the old org's
  // subcollection — and re-opens under the new org).
  const lyricsSubscriptions = new Map<string, LyricsUnsubscribe>()
  let lyricsSubscriptionOrgId: string | null = null

  const distinctSongIds = computed<string[]>(() => {
    const svc = service.value
    if (!svc) return []
    const ids = new Set<string>()
    for (const slot of svc.slots) {
      if (slot.kind === 'SONG' && slot.songId) ids.add(slot.songId)
    }
    return Array.from(ids)
  })

  function syncLyricsSubscriptions(ids: string[], org: string | null) {
    // An org change invalidates every open subscription. Tear them all down
    // (and drop their cached lyrics) before re-subscribing under the new org.
    if (org !== lyricsSubscriptionOrgId) {
      for (const [songId, unsub] of lyricsSubscriptions) {
        unsub()
        songLyricsById.delete(songId)
      }
      lyricsSubscriptions.clear()
      lyricsSubscriptionOrgId = org
    }
    if (!org) return

    const desired = new Set(ids)
    // Drop subscriptions (and cached lyrics) for songs no longer referenced by
    // any slot — the live analogue of the old cache's implicit staleness, but
    // bounded: at most one listener per distinct song currently in the service.
    for (const [songId, unsub] of lyricsSubscriptions) {
      if (desired.has(songId)) continue
      unsub()
      lyricsSubscriptions.delete(songId)
      songLyricsById.delete(songId)
    }
    // Open a live subscription for each newly-referenced song. T-20-03-DoS
    // mitigation preserved: a songId already subscribed is never re-subscribed.
    for (const songId of desired) {
      if (lyricsSubscriptions.has(songId)) continue
      isLoading.value = true
      const unsub = subscribeLyrics(org, songId, (lyrics) => {
        if (lyrics) {
          songLyricsById.set(songId, lyrics)
        } else {
          songLyricsById.delete(songId)
        }
        isLoading.value = false
      })
      lyricsSubscriptions.set(songId, unsub)
    }
  }

  const stopLyricsWatch = watch(
    [distinctSongIds, resolvedOrgId],
    ([ids, org]) => {
      syncLyricsSubscriptions(ids, org)
    },
    { immediate: true },
  )

  // --- Part 2: live structure for a stale SONG group, in-memory only ---
  // True when a SONG slot's persisted group no longer matches the verse structure its current lyrics
  // would produce; compares against `performanceOrder` exactly as the assembler's no-group fallback does.
  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "assemblyGroupsBySlotId")
  function songGroupIsStale(group: SlideGroup, slot: Service['slots'][number]): boolean {
    if (slot.kind !== 'SONG' || !slot.songId) return false
    const lyrics = songLyricsById.get(slot.songId)
    if (!lyrics) return false
    const freshOrder = lyrics.performanceOrder.filter((sectionId) =>
      lyrics.sections.some((section) => section.id === sectionId),
    )
    const storedOrder = [...group.slides]
      .sort((a, b) => a.order - b.order)
      .flatMap((entry) => (entry.sourceRef.kind === 'lyric' ? [entry.sourceRef.sectionId] : []))
    if (freshOrder.length !== storedOrder.length) return true
    return freshOrder.some((sectionId, index) => sectionId !== storedOrder[index])
  }

  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "assemblyGroupsBySlotId")
  const assemblyGroupsBySlotId = computed<Map<string, SlideGroup>>(() => {
    const stored = slideGroupsStore.groupsBySlotId
    if (canWrite.value) return stored
    const svc = service.value
    if (!svc) return stored
    let overridden: Map<string, SlideGroup> | null = null
    for (const slot of svc.slots) {
      if (slot.kind !== 'SONG') continue
      const group = stored.get(slot.id)
      if (!group) continue
      if (!songGroupIsStale(group, slot)) continue
      if (!overridden) overridden = new Map(stored)
      overridden.delete(slot.id)
    }
    return overridden ?? stored
  })

  const assembledSlideshow = computed<AssembledSlide[]>(() => {
    const svc = service.value
    if (!svc) return []
    return assembleSlideshow(svc, {
      songLyricsById,
      scriptureReadingsById: scriptureReadingsById.value,
      importedDecksById: importedDecksById.value,
      groupsBySlotId: assemblyGroupsBySlotId.value,
      pptxRendersByImportId: pptxRendersStore.rendersByImportId,
      renderedImageUrlsByImportId: renderedImageUrlsByImportId.value,
    })
  })

  // Re-exposed as its own computed (not the raw unwrapped store value) so
  // consumers see a live-updating ComputedRef rather than a one-time snapshot
  // of the Map captured at setup time.
  const groupsBySlotId = computed<Map<string, SlideGroup>>(() => slideGroupsStore.groupsBySlotId)

  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "materializationCandidates")
  interface MaterializationCandidate {
    slotId: string
    orgId: string
    input: SlideGroupInput
  }

  // ME-04: slots whose group cascade-delete is in flight. `reactive` (not a
  // plain Set) so the candidate computed below re-evaluates when a slot is
  // held or released. See `suppressMaterialization`'s doc comment on the
  // return type for why the window exists at all.
  const deletingSlotIds = reactive(new Set<string>())

  function suppressMaterialization(slotId: string): () => void {
    deletingSlotIds.add(slotId)
    return () => {
      deletingSlotIds.delete(slotId)
    }
  }

  const materializationCandidates = computed<MaterializationCandidate[]>(() => {
    const svc = service.value
    const orgId = resolvedOrgId.value
    if (!svc || !orgId || !canWrite.value) return []

    const inputs: AssemblyInputs = {
      songLyricsById,
      scriptureReadingsById: scriptureReadingsById.value,
      importedDecksById: importedDecksById.value,
      groupsBySlotId: slideGroupsStore.groupsBySlotId,
      pptxRendersByImportId: pptxRendersStore.rendersByImportId,
      renderedImageUrlsByImportId: renderedImageUrlsByImportId.value,
    }

    const candidates: MaterializationCandidate[] = []
    for (const slot of svc.slots) {
      // Keyed STRICTLY on slot.id (D-01) — never array index or
      // `slot.position`, both of which `reindexSlots` rewrites on every
      // drag. A slot with an existing group is never a candidate here.
      if (slideGroupsStore.groupsBySlotId.has(slot.id)) continue
      // ME-04: never re-create the document a cascade delete is mid-flight on.
      if (deletingSlotIds.has(slot.id)) continue

      const input = buildInitialGroup(slot, svc.id, inputs)
      // A source resolving to zero slides (a SONG slot with no song
      // assigned, or lyrics not yet loaded) materializes NO group — D-02's
      // "groups are always populated" is satisfied by not creating a
      // document at all, not by creating an empty one.
      if (input.slides.length === 0) continue

      candidates.push({ slotId: slot.id, orgId, input })
    }
    return candidates
  })

  // Belt-and-braces re-entrancy guard on top of the store's deterministic
  // doc id + getDoc guard (RESEARCH.md Pattern 1): prevents this watcher
  // firing again mid-flight from issuing a second write for the same slot
  // before the onSnapshot round-trip lands and removes it from
  // `materializationCandidates`.
  const materializingSlotIds = new Set<string>()

  // HI-01. Tracks fire-and-forget group writes from `{ immediate: true }` watchers so a caller can
  // await them (drainGroupWrites) before flipping service status past an in-flight write.
  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "drainGroupWrites")
  const inFlightGroupWrites = new Set<Promise<unknown>>()

  function trackGroupWrite<T>(promise: Promise<T>): Promise<T> {
    inFlightGroupWrites.add(promise)
    // `.finally` on a COPY: the tracked promise must not become the caller's,
    // or a rejection here would be reported twice.
    void promise.finally(() => inFlightGroupWrites.delete(promise)).catch(() => {})
    return promise
  }

  async function drainGroupWrites(): Promise<void> {
    // Loop rather than a single `Promise.allSettled`: draining one batch can
    // let a watcher issue the next one, and the caller wants quiescence.
    while (inFlightGroupWrites.size > 0) {
      await Promise.allSettled([...inFlightGroupWrites])
    }
  }

  async function materializeCandidates(candidates: MaterializationCandidate[]) {
    for (const candidate of candidates) {
      if (materializingSlotIds.has(candidate.slotId)) continue
      materializingSlotIds.add(candidate.slotId)
      try {
        await trackGroupWrite(
          slideGroupsStore.materializeGroupIfMissing(candidate.orgId, candidate.input),
        )
      } catch (err) {
        // HI-01: contain it. Without this `catch` the rejection escapes the
        // fire-and-forget `void` call above as an unhandled
        // `permission-denied`, AND aborts this loop — so every LATER candidate
        // in the same batch is silently skipped, not just the denied one.
        // The slot stays a candidate, so a legitimate retry (after a reopen)
        // still happens on the next recompute.
        console.error('[useSlideshowAssembly] group materialization write failed:', err)
      } finally {
        materializingSlotIds.delete(candidate.slotId)
      }
    }
  }

  const stopMaterializeWatch = watch(
    materializationCandidates,
    (candidates) => {
      void materializeCandidates(candidates)
    },
    { immediate: true },
  )

  // See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/composables/useSlideshowAssembly.ts, "ensureGroupMaterialized")
  const ensureInFlight = new Map<string, Promise<EnsureGroupMaterializedResult | undefined>>()

  async function ensureGroupMaterialized(slotId: string): Promise<EnsureGroupMaterializedResult | undefined> {
    const svc = service.value
    const orgId = resolvedOrgId.value
    if (!svc || !orgId || !canWrite.value) return undefined
    // ME-04: same hold the automatic watcher respects.
    if (deletingSlotIds.has(slotId)) return undefined
    const slot = svc.slots.find((s) => s.id === slotId)
    if (!slot) return undefined

    const existing = slideGroupsStore.groupsBySlotId.get(slotId)
    if (existing) {
      return { entries: existing.slides, sourceSignature: existing.sourceSignature }
    }

    const inFlight = ensureInFlight.get(slotId)
    if (inFlight) return inFlight

    const promise = (async (): Promise<EnsureGroupMaterializedResult | undefined> => {
      materializingSlotIds.add(slotId)
      try {
        const inputs: AssemblyInputs = {
          songLyricsById,
          scriptureReadingsById: scriptureReadingsById.value,
          importedDecksById: importedDecksById.value,
          groupsBySlotId: slideGroupsStore.groupsBySlotId,
          pptxRendersByImportId: pptxRendersStore.rendersByImportId,
          renderedImageUrlsByImportId: renderedImageUrlsByImportId.value,
        }
        // Deliberately does NOT skip a zero-slide derivation the way
        // `materializationCandidates` does above — see this function's own
        // doc comment on `UseSlideshowAssemblyReturn.ensureGroupMaterialized`.
        const input = buildInitialGroup(slot, svc.id, inputs)
        await slideGroupsStore.materializeGroupIfMissing(orgId, input)
        return { entries: input.slides, sourceSignature: input.sourceSignature }
      } finally {
        materializingSlotIds.delete(slotId)
        ensureInFlight.delete(slotId)
      }
    })()
    ensureInFlight.set(slotId, promise)
    return promise
  }

  // --- Phase 30 (R046): one unconditional rebuild-and-write loop, no confirm state ---
  //
  // Same synchronous-decision / async-effect split as materialization above,
  // for the same reason (async watch bodies only track pre-await reads). The
  // only decision left is "write, or don't bother" (`result.changed`) — there
  // is no pending/confirm state to surface anymore.
  interface RebuildOutcome {
    slotId: string
    orgId: string
    group: SlideGroup
    result: RebuildResult
    /** See ADR-0140 (docs/adr/0140-this-is-the-one-branch-that-empties-a-congregational-group-s.md) */
    freshSignature?: string | null
  }

  const rebuildOutcomes = computed<RebuildOutcome[]>(() => {
    const svc = service.value
    const orgId = resolvedOrgId.value
    if (!svc || !orgId || !canWrite.value) return []

    const inputs: AssemblyInputs = {
      songLyricsById,
      scriptureReadingsById: scriptureReadingsById.value,
      importedDecksById: importedDecksById.value,
      groupsBySlotId: slideGroupsStore.groupsBySlotId,
      pptxRendersByImportId: pptxRendersStore.rendersByImportId,
      renderedImageUrlsByImportId: renderedImageUrlsByImportId.value,
    }

    const outcomes: RebuildOutcome[] = []
    for (const slot of svc.slots) {
      const group = slideGroupsStore.groupsBySlotId.get(slot.id)
      if (!group) continue
      const result = rebuildGroup(group, slot, inputs)
      if (!result.changed) continue
      outcomes.push({
        slotId: slot.id,
        orgId,
        group,
        result,
        freshSignature: result.sourceSignature !== undefined ? result.sourceSignature : sourceSignature(slot, inputs),
      })
    }
    return outcomes
  })

  // Applied-outcome guard: since a mocked/just-written store doesn't
  // necessarily produce a NEW `SlideGroup` object on every recompute, this
  // tracks the exact stored group object reference already rebuilt for a
  // slot, so a repeated watcher tick against the SAME unrebuilt stored state
  // never re-issues `replaceGroupSlides` a second time. Only a genuine new
  // stored group (a fresh onSnapshot after the write lands) clears it.
  const appliedGroupRefForSlot = new Map<string, SlideGroup>()

  async function applyRebuildOutcomes(outcomes: RebuildOutcome[]) {
    for (const outcome of outcomes) {
      if (appliedGroupRefForSlot.get(outcome.slotId) === outcome.group) continue
      appliedGroupRefForSlot.set(outcome.slotId, outcome.group)

      // See ADR-0141 (docs/adr/0141-outcome-group-slides-is-the-snapshot-this-rebuild-was-comput.md)
      try {
        await trackGroupWrite(
          slideGroupsStore.replaceGroupSlides(
            outcome.orgId,
            outcome.slotId,
            outcome.result.slides,
            outcome.freshSignature,
            outcome.group.slides,
          ),
        )
      } catch (err) {
        // HI-01, same containment as `materializeCandidates`. Release the
        // applied-outcome guard as well: it was set BEFORE the write on the
        // assumption the write lands, and leaving it set would suppress every
        // future rebuild for this slot against this stored group — so a group
        // denied while the service was locked would stay stale even after a
        // reopen, until an unrelated remote snapshot happened to mint a new
        // group object.
        appliedGroupRefForSlot.delete(outcome.slotId)
        console.error('[useSlideshowAssembly] group rebuild write failed:', err)
      }
    }
  }

  const stopRebuildWatch = watch(
    rebuildOutcomes,
    (outcomes) => {
      void applyRebuildOutcomes(outcomes)
    },
    { immediate: true },
  )

  const assembledSections = computed<AssembledSection[]>(() => {
    const slides = assembledSlideshow.value
    const groups: AssembledSection[] = []

    for (const section of SERVICE_SECTIONS) {
      const sectionSlides = slides.filter((s) => s.section === section)
      if (sectionSlides.length > 0) {
        groups.push({ section, label: SERVICE_SECTION_LABELS[section], slides: sectionSlides })
      }
    }

    // Legacy (section-less) slides — grouped trailing, after every named section.
    const legacySlides = slides.filter((s) => s.section === undefined)
    if (legacySlides.length > 0) {
      groups.push({ section: undefined, label: 'Ungrouped', slides: legacySlides })
    }

    return groups
  })

  function cleanup() {
    stopOrgWatch()
    stopLyricsWatch()
    stopMaterializeWatch()
    stopRebuildWatch()
    stopRenderSubscriptionWatch()
    stopRenderedUrlsWatch()

    // Part 1: tear down every live per-song lyrics `onSnapshot` listener this
    // instance opened (the watches above no longer fire, but the Firestore
    // listeners they created are independent and must be closed explicitly).
    for (const unsub of lyricsSubscriptions.values()) unsub()
    lyricsSubscriptions.clear()

    // See ADR-0137 (docs/adr/0137-activeslideshowassemblyinstances-still-includes-this-instanc.md)
    if (import.meta.env.DEV && activeSlideshowAssemblyInstances > 1) {
      console.warn(
        '[useSlideshowAssembly] cleanup() is tearing down ALL pptxRenders listeners ' +
          `(pptxRendersStore.unsubscribeAll() is store-wide, not per-instance) while ` +
          `${activeSlideshowAssemblyInstances} instances of this composable are active. ` +
          'A second concurrent consumer will have its render-status listeners silently ' +
          'killed by this unmount. See WR-02, 42-REVIEW.md.',
      )
    }
    activeSlideshowAssemblyInstances = Math.max(0, activeSlideshowAssemblyInstances - 1)

    pptxRendersStore.unsubscribeAll()
  }

  // `onScopeDispose` rather than `onUnmounted`: it fires on ANY active effect
  // scope's disposal — a real component's unmount (Vue runs `setup()` inside the
  // component's own detached scope, so this is byte-identical to `onUnmounted`
  // there) as well as an explicitly-created `effectScope().stop()`, which is how
  // this composable is exercised outside a mounted component (this file's own
  // test suite). `onUnmounted` alone only registers against a live component
  // instance and is a silent no-op otherwise, which would make the render
  // listeners' teardown (T-42-06) untestable without a full component mount.
  onScopeDispose(cleanup)

  return {
    assembledSlideshow,
    assembledSections,
    isLoading,
    groupsBySlotId,
    ensureGroupMaterialized,
    suppressMaterialization,
    drainGroupWrites,
  }
}
