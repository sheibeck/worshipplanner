/**
 * Reactive wrapper over the pure `assembleSlideshow` engine (20-02), delivering
 * R006: reorder/add/remove a service element and the assembled slideshow follows
 * with no manual re-sync.
 *
 * Builds the three content maps `assembleSlideshow` needs from live Pinia
 * stores — `scriptureReadingsById` from the scriptureSlides store,
 * `performanceOrderById` from the songs store — and maintains its own
 * `songLyricsById` map by loading the current (newest) lyrics doc for every
 * distinct songId referenced by a SONG slot in the service (the songLyrics
 * store itself only ever subscribes to a single song at a time, so it cannot
 * be reused directly here).
 */
import { ref, reactive, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useScriptureSlides } from '@/stores/scriptureSlides'
import { useImportedSlides } from '@/stores/importedSlides'
import { useSongStore } from '@/stores/songs'
import { useSlideGroups } from '@/stores/slideGroups'
import { assembleSlideshow, type AssemblyInputs } from '@/utils/slideshowAssembler'
import { buildInitialGroup } from '@/utils/slideGroupMaterializer'
import { SERVICE_SECTIONS, SERVICE_SECTION_LABELS, type Service } from '@/types/service'
import type { AssembledSlide, AssembledSection } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'
import type { SlideGroup, SlideGroupInput } from '@/types/slideGroup'

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

export interface UseSlideshowAssemblyReturn {
  assembledSlideshow: ComputedRef<AssembledSlide[]>
  assembledSections: ComputedRef<AssembledSection[]>
  isLoading: Ref<boolean>
  /** Re-exposed from the `slideGroups` store so consumers (24-06's delete warning) don't subscribe a second time. */
  groupsBySlotId: ComputedRef<Map<string, SlideGroup>>
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
  const songStore = useSongStore()
  // The store's own subscription (subscribeGroups) is wired in 24-05; until
  // then groupsBySlotId is legitimately empty and assembleSlideshow's
  // fallback path produces today's output, so the app is coherent at every
  // commit between here and 24-05/24-06.
  const slideGroupsStore = useSlideGroups()
  const loadLyrics = options?.lyricsLoader ?? defaultLyricsLoader

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

  // --- performanceOrder: canonical order lives on the Song doc ---
  const performanceOrderById = computed(() => {
    const map = new Map<string, string[]>()
    for (const song of songStore.songs) {
      map.set(song.id, song.performanceOrder ?? [])
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
      performanceOrderById: performanceOrderById.value,
      scriptureReadingsById: scriptureReadingsById.value,
      importedDecksById: importedDecksById.value,
      groupsBySlotId: slideGroupsStore.groupsBySlotId,
    })
  })

  // Re-exposed as its own computed (not the raw unwrapped store value) so
  // consumers see a live-updating ComputedRef rather than a one-time snapshot
  // of the Map captured at setup time.
  const groupsBySlotId = computed<Map<string, SlideGroup>>(() => slideGroupsStore.groupsBySlotId)

  // --- Task 2: lazy materialization (D-05 migration), zero writes on reorder ---
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

  const materializationCandidates = computed<MaterializationCandidate[]>(() => {
    const svc = service.value
    const orgId = resolvedOrgId.value
    if (!svc || !orgId || !canWrite.value) return []

    const inputs: AssemblyInputs = {
      songLyricsById,
      performanceOrderById: performanceOrderById.value,
      scriptureReadingsById: scriptureReadingsById.value,
      importedDecksById: importedDecksById.value,
      groupsBySlotId: slideGroupsStore.groupsBySlotId,
    }

    const candidates: MaterializationCandidate[] = []
    for (const slot of svc.slots) {
      // Keyed STRICTLY on slot.id (D-01) — never array index or
      // `slot.position`, both of which `reindexSlots` rewrites on every
      // drag. A slot with an existing group is never a candidate here.
      if (slideGroupsStore.groupsBySlotId.has(slot.id)) continue

      const input = buildInitialGroup(slot, svc.id, inputs)
      // A source resolving to zero slides (a SONG slot with no song
      // assigned, or lyrics not yet loaded) materializes NO group — D-02's
      // "groups are always populated" is satisfied by not creating a
      // document at all, not by creating an empty one. The slot's
      // deprecated Phase-22 media stays readable on the slot in this
      // window and is picked up the moment the source resolves.
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

  async function materializeCandidates(candidates: MaterializationCandidate[]) {
    for (const candidate of candidates) {
      if (materializingSlotIds.has(candidate.slotId)) continue
      materializingSlotIds.add(candidate.slotId)
      try {
        await slideGroupsStore.materializeGroupIfMissing(candidate.orgId, candidate.input)
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
  }

  onUnmounted(cleanup)

  return {
    assembledSlideshow,
    assembledSections,
    isLoading,
    groupsBySlotId,
  }
}
