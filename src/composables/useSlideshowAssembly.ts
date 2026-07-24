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
import { useSongStore } from '@/stores/songs'
import { assembleSlideshow } from '@/utils/slideshowAssembler'
import { SERVICE_SECTIONS, SERVICE_SECTION_LABELS, type Service } from '@/types/service'
import type { AssembledSlide, AssembledSection } from '@/types/slide'
import type { SongLyrics } from '@/types/songLyrics'

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
}

export interface UseSlideshowAssemblyReturn {
  assembledSlideshow: ComputedRef<AssembledSlide[]>
  assembledSections: ComputedRef<AssembledSection[]>
  isLoading: Ref<boolean>
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
  const songStore = useSongStore()
  const loadLyrics = options?.lyricsLoader ?? defaultLyricsLoader

  const resolvedOrgId = computed<string | null>(() =>
    typeof orgId === 'string' ? orgId : orgId.value,
  )

  // --- scripture readings: subscribe once per org, guard against double-subscribe ---
  const subscribedOrgId = ref<string | null>(null)
  const stopOrgWatch = watch(
    resolvedOrgId,
    (id) => {
      if (id && subscribedOrgId.value !== id) {
        scriptureStore.subscribeReadings(id)
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
    })
  })

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
  }

  onUnmounted(cleanup)

  return { assembledSlideshow, assembledSections, isLoading }
}
