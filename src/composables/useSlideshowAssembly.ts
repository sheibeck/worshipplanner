/**
 * Reactive wrapper over the pure `assembleSlideshow` engine (20-02), delivering
 * R006: reorder/add/remove a service element and the assembled slideshow follows
 * with no manual re-sync.
 *
 * Builds the content maps `assembleSlideshow` needs from live Pinia
 * stores — `scriptureReadingsById` from the scriptureSlides store — and
 * maintains its own `songLyricsById` map by loading the current (newest)
 * lyrics doc for every distinct songId referenced by a SONG slot in the
 * service (the songLyrics store itself only ever subscribes to a single song
 * at a time, so it cannot be reused directly here). A song's slide order is
 * read from that lyrics document's `performanceOrder` field alone (R035/D-03)
 * — there is no second order source and no precedence chain.
 */
import { ref, reactive, computed, watch, onScopeDispose, type Ref, type ComputedRef } from 'vue'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useScriptureSlides } from '@/stores/scriptureSlides'
import { useImportedSlides } from '@/stores/importedSlides'
import { useSlideGroups } from '@/stores/slideGroups'
import { usePptxRenders } from '@/stores/pptxRenders'
import { resolveImageUrl } from '@/utils/pptxUpload'
import { renderedPagePath } from '@/utils/renderedPagePaths'
import { assembleSlideshow, type AssemblyInputs } from '@/utils/slideshowAssembler'
import { buildInitialGroup, rebuildGroup, sourceSignature, type RebuildResult } from '@/utils/slideGroupMaterializer'
import { SERVICE_SECTIONS, SERVICE_SECTION_LABELS, type Service } from '@/types/service'
import type { AssembledSlide, AssembledSection } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { SlideGroup, SlideGroupInput, GroupSlideEntry } from '@/types/slideGroup'

/** Loads the current (newest) lyrics doc for a song. Injectable for tests. */
export type LyricsLoader = (orgId: string, songId: string) => Promise<SongLyrics | null>

/**
 * Default lyrics loader — a one-shot `getDocs` query (not a live subscription;
 * the composable re-fetches only when a new distinct songId appears) against
 * organizations/{orgId}/songs/{songId}/lyrics ordered createdAt desc, limit 1.
 * Mirrors the field-defaulting behavior of `songLyrics` store's `subscribeLyrics`
 * (missing `performanceOrder` defaults to `[]`).
 */
async function defaultLyricsLoader(orgId: string, songId: string): Promise<SongLyrics | null> {
  const q = query(
    collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'),
    orderBy('createdAt', 'desc'),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]!
  const data = docSnap.data() as Record<string, unknown>
  if (!Array.isArray(data.performanceOrder)) {
    data.performanceOrder = []
  }
  return { id: docSnap.id, songId, ...data } as SongLyrics
}

// WR-02 (42-REVIEW.md): `pptxRendersStore` is a Pinia singleton, but this composable's
// `cleanup()` calls its `unsubscribeAll()`, which tears down EVERY outstanding listener
// in the store, not just the ones this particular instance opened. That is safe only
// under the "single call site" assumption documented on `pptxRenders.ts` and below — an
// assumption nothing in the store enforces. This module-level counter is a dev-mode
// tripwire for exactly that assumption: it does not change teardown behavior (still a
// full `unsubscribeAll()`, since scoping it per-instance is a real design change no plan
// here authorizes), it only makes a violation loud instead of silent.
let activeSlideshowAssemblyInstances = 0

export interface UseSlideshowAssemblyOptions {
  /** Injectable lyrics loader — defaults to a real Firestore `getDocs` query. */
  lyricsLoader?: LyricsLoader
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
  /**
   * On-demand group materializer (25-05 Task 1): resolves to `{ entries,
   * sourceSignature }` for `slotId`'s group, creating it first if it does not
   * exist yet — including when the derived input has ZERO slides, unlike the
   * automatic `materializeCandidates` watcher below (that skip implements
   * Phase 24 D-02's "groups are always populated" rule for AUTOMATIC
   * materialization; this function only ever runs because a user just asked
   * to put something into this plan item, R032). Resolves `undefined` when it
   * cannot act (no service, no org, no such slot, the caller cannot write, or
   * the slot's delete is in flight). Every write path in 25-05/25-06/25-07
   * (add slide, drag-reorder, import, drop) resolves the group through this
   * first rather than calling the store directly.
   */
  ensureGroupMaterialized: (slotId: string) => Promise<EnsureGroupMaterializedResult | undefined>
  /**
   * ME-04 (R045 membership). Marks `slotId` as having a delete in flight and
   * returns the release; call it in a `finally`.
   *
   * `confirmSlotDelete` awaits the group cascade BEFORE splicing the slot, so
   * that a failed delete never leaves the slot removed locally while its group
   * lingers. But Firestore applies a delete to its LOCAL cache and raises
   * `onSnapshot` immediately, whereas `deleteDoc` resolves only on server ack.
   * For the length of that ack the slot is still in `service.slots` with no
   * group — exactly the shape `materializationCandidates` treats as
   * "materialize me" — so the watcher re-created the document the cascade had
   * just deleted, and the slot was then spliced out with no second cascade,
   * orphaning the group document indefinitely.
   *
   * A held slot is skipped by BOTH the automatic candidate watcher and
   * `ensureGroupMaterialized`.
   */
  suppressMaterialization: (slotId: string) => () => void
  /**
   * HI-01. Resolves once no group write issued by this composable is still in
   * flight. Both apply loops run fire-and-forget from `{ immediate: true }`
   * watchers, so without this there is no way for a caller to know a write is
   * outstanding — and `onMarkAsPlanned` flipped the service's status straight
   * through that window, leaving the write to be denied on arrival by the new
   * `/slideGroups` rule while the user saw a normal transition.
   *
   * Never rejects: individual failures are already contained and logged at the
   * point of the write. This is a barrier, not an error channel.
   */
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
  const loadLyrics = options?.lyricsLoader ?? defaultLyricsLoader

  // WR-02: see the module-level counter's doc comment above.
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
      // 2. `imported` ENTRIES living inside ANY slot's slide group. A PPTX deck's
      //    rendered slides can be added straight into a non-IMPORTED slot's group
      //    (e.g. a Prayer or Scripture group), where the render linkage lives on the
      //    entry's deck (`sourceRef.importId` → `ImportedDeck.id` → `renderImportId`),
      //    NOT on an IMPORTED slot and NOT on the group's own `renderImportId` (which
      //    stays null for a non-imported slot). Without collecting these, the render
      //    doc is never subscribed, its `ready` status is never seen, and every such
      //    entry hangs on the "Rendering" spinner permanently even after the render
      //    has completed — a real production defect (a deck imported into a Prayer
      //    group's slides). Same identifier hop as the IMPORTED-slot branch above.
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

  // --- Phase 42 (R079/R080): resolve and cache rendered-page download URLs ---
  //
  // Keyed `${renderImportId}:${renderedCount}` — the count is load-bearing TWICE
  // (42-RESEARCH.md Pitfall 4 / T-42-07): it invalidates the cache the instant a
  // re-render changes the page count, AND it makes serving a previous render's
  // URL array structurally impossible, since a differently-counted re-render can
  // never collide with the old key.
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
          // WR-01 (42-REVIEW.md): only the CURRENT count's entry is ever read again
          // (`renderedImageUrlsByImportId` above looks up exactly one key per id), so
          // every other `(id, count)` pair for this SAME id is now unreachable — evict
          // it rather than let it stay resident forever across re-renders/retries
          // within one composable instance's lifetime.
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

  // --- per-song current lyrics: songLyrics store is single-song, so gather here ---
  const songLyricsById = reactive(new Map<string, SongLyrics>())
  const isLoading = ref(false)

  const distinctSongIds = computed<string[]>(() => {
    const svc = service.value
    if (!svc) return []
    const ids = new Set<string>()
    for (const slot of svc.slots) {
      if (slot.kind === 'SONG' && slot.songId) ids.add(slot.songId)
    }
    return Array.from(ids)
  })

  async function loadMissingLyrics(ids: string[], org: string | null) {
    if (!org) return
    // T-20-03-DoS mitigation: only fetch songIds NOT already in songLyricsById.
    const missing = ids.filter((id) => !songLyricsById.has(id))
    if (missing.length === 0) return

    isLoading.value = true
    try {
      await Promise.all(
        missing.map(async (songId) => {
          const lyrics = await loadLyrics(org, songId)
          if (lyrics) songLyricsById.set(songId, lyrics)
        }),
      )
    } finally {
      isLoading.value = false
    }
  }

  const stopLyricsWatch = watch(
    [distinctSongIds, resolvedOrgId],
    ([ids, org]) => {
      void loadMissingLyrics(ids, org)
    },
    { immediate: true },
  )

  const assembledSlideshow = computed<AssembledSlide[]>(() => {
    const svc = service.value
    if (!svc) return []
    return assembleSlideshow(svc, {
      songLyricsById,
      scriptureReadingsById: scriptureReadingsById.value,
      importedDecksById: importedDecksById.value,
      groupsBySlotId: slideGroupsStore.groupsBySlotId,
      pptxRendersByImportId: pptxRendersStore.rendersByImportId,
      renderedImageUrlsByImportId: renderedImageUrlsByImportId.value,
    })
  })

  // Re-exposed as its own computed (not the raw unwrapped store value) so
  // consumers see a live-updating ComputedRef rather than a one-time snapshot
  // of the Map captured at setup time.
  const groupsBySlotId = computed<Map<string, SlideGroup>>(() => slideGroupsStore.groupsBySlotId)

  // --- Task 2: lazy materialization, zero writes on reorder ---
  //
  // `materializationCandidates` is a fully SYNCHRONOUS computed that decides
  // WHAT needs materializing. This matters: an async function body passed to
  // `watch`/`watchEffect` only tracks reactive reads made before its first
  // `await` — reads made after resuming from an await happen outside the
  // effect's tracking window, silently dropping dependencies. Keeping the
  // decision synchronous (mirroring `distinctSongIds`'s shape) and only
  // performing the actual (async) writes in the watch callback avoids that
  // pitfall entirely.
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

  // HI-01. Both apply loops below are invoked fire-and-forget (`void …`) from
  // `{ immediate: true }` watchers, so nothing awaits them and nothing can
  // observe when their writes settle. Two consequences this set addresses:
  //
  //  - `onMarkAsPlanned` used to flip the service's status straight through the
  //    window where a group write was still in flight, so the write arrived at
  //    a service that had just become locked and was denied by the new
  //    `/slideGroups` rule. `drainGroupWrites` gives the view something to await
  //    before the status write.
  //  - a caller that wants to know the batch has quiesced (tests included) had
  //    no handle on it at all.
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

  // --- 25-05 Task 1: on-demand materialization for an explicit user write ---
  //
  // Concurrent calls for the SAME slot are deduped through `ensureInFlight` so
  // at most one create is issued and every caller resolves the same result.
  // Also participates in the shared `materializingSlotIds` guard so the
  // automatic watcher above cannot fire a second create for a slot this
  // function is already materializing — belt and braces on top of the
  // store's deterministic doc id, which already makes the worst case of the
  // reverse race (the automatic watcher already in flight when this function
  // is called) a harmless overwrite rather than two divergent documents.
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
    /**
     * Precomputed here (synchronously, inside the tracked computed) rather
     * than re-derived in the async apply step.
     *
     * 38-REVIEW CR-01: `undefined` means "no opinion, leave the stored
     * signature alone"; `null` means "explicitly clear it." `result.sourceSignature`
     * (set only by `rebuildScriptureGroup`'s CLEARED REFERENCE branch) takes
     * precedence over the ordinary recomputed `sourceSignature(slot, inputs)`
     * when present, because that branch's freshly-computed signature is
     * `undefined` for the wrong reason (no reference to sign, not "no
     * opinion") and would otherwise leave a stale value stored via
     * `stripUndefined`.
     */
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

      // CR-02: `outcome.group.slides` is the snapshot this rebuild was
      // computed FROM — passed through as `baseSlides` so a concurrent
      // SlideGrid.vue write (add-slide/import/video-append/reorder) that
      // lands between this computation and this write is detected and merged
      // rather than silently overwritten. See `replaceGroupSlides`'s doc
      // comment in `src/stores/slideGroups.ts`. This matters MORE now than
      // pre-Phase-30, since every rebuild outcome writes unconditionally —
      // there is no confirm step left to catch a lost concurrent edit.
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

    // WR-02: `activeSlideshowAssemblyInstances` still includes THIS instance at this
    // point (it decrements below), so > 1 here means at least one other instance is
    // still live — the single-call-site assumption `unsubscribeAll()`'s teardown-of-
    // EVERY-listener behavior relies on is violated. Warn loudly rather than let this
    // instance's unmount silently kill another instance's still-open render listeners.
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
