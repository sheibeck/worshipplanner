import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  deleteField,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { SongLyrics } from '@/types/songLyrics'

/**
 * R351/ARCH-009 — the ONE query both callers must share: the org-scoped
 * lyrics subcollection for `songId`, newest-createdAt-first, no `limit`.
 * `subscribeLyrics` below and `useSlideshowAssembly`'s `defaultLyricsSubscriber`
 * both build their listener from this function so neither can drift from the
 * other (the drift this fixes: the composable used to add its own `limit(1)`).
 */
export function lyricsQuery(orgId: string, songId: string) {
  return query(
    collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'),
    orderBy('createdAt', 'desc'),
  )
}

export const useSongLyricsStore = defineStore('songLyrics', () => {
  const lyrics = ref<SongLyrics[]>([])
  const isLoading = ref(true)

  let unsubscribeFn: Unsubscribe | null = null

  /** The most recent lyrics doc (first in desc-ordered list) — the "active version". */
  const currentLyrics = computed<SongLyrics | null>(() =>
    lyrics.value.length > 0 ? lyrics.value[0]! : null,
  )

  /** All lyrics docs (for version history display). */
  const lyricVersions = computed<SongLyrics[]>(() => lyrics.value)

  /**
   * Subscribe to real-time updates on the lyrics subcollection for a song,
   * ordered by createdAt desc so the newest version is first.
   */
  function subscribeLyrics(orgId: string, songId: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    isLoading.value = true
    const q = lyricsQuery(orgId, songId)
    unsubscribeFn = onSnapshot(q, (snap) => {
      lyrics.value = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        // Default performanceOrder for docs missing the field
        if (!Array.isArray(data.performanceOrder)) {
          data.performanceOrder = []
        }
        return { id: d.id, songId, ...data } as SongLyrics
      })
      isLoading.value = false
    })
  }

  /** Cleanup snapshot listener. */
  function unsubscribeLyrics() {
    unsubscribeFn?.()
    unsubscribeFn = null
    lyrics.value = []
    isLoading.value = true
  }

  /**
   * Create a NEW doc in the lyrics subcollection.
   * Each call creates a new version (R004 light versioning).
   */
  async function saveLyrics(
    orgId: string,
    songId: string,
    data: Omit<SongLyrics, 'id' | 'songId' | 'createdAt' | 'updatedAt'>,
  ) {
    await addDoc(
      collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    )
  }

  /**
   * Update the current/active lyrics doc in place.
   * Used for auto-save — only creates new version on explicit "save version" action.
   */
  async function updateCurrentLyrics(
    orgId: string,
    songId: string,
    lyricsId: string,
    data: Partial<Omit<SongLyrics, 'id' | 'songId' | 'createdAt' | 'updatedAt'>>,
  ) {
    await updateDoc(
      doc(db, 'organizations', orgId, 'songs', songId, 'lyrics', lyricsId),
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
    )
  }

  /**
   * Revert to a previous version by copying that version's data into a new doc,
   * creating a new "current" that is a copy of the old version.
   */
  async function revertToVersion(orgId: string, songId: string, versionId: string) {
    const versionRef = doc(
      db,
      'organizations',
      orgId,
      'songs',
      songId,
      'lyrics',
      versionId,
    )
    const versionSnap = await getDoc(versionRef)
    if (!versionSnap.exists()) return

    const versionData = versionSnap.data() as Record<string, unknown>
    // Remove Firestore metadata fields — we want a fresh copy
    const { createdAt: _ca, updatedAt: _ua, ...rest } = versionData

    await addDoc(
      collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'),
      {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    )
  }

  /**
   * See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
   * src/stores/songLyrics.ts).
   */
  async function setSongBackground(
    orgId: string,
    songId: string,
    lyricsId: string,
    url: string | null,
  ): Promise<void> {
    await updateDoc(
      doc(db, 'organizations', orgId, 'songs', songId, 'lyrics', lyricsId),
      {
        backgroundImageUrl: url === null ? deleteField() : url,
        updatedAt: serverTimestamp(),
      },
    )
  }

  return {
    lyrics,
    isLoading,
    currentLyrics,
    lyricVersions,
    subscribeLyrics,
    unsubscribeLyrics,
    saveLyrics,
    updateCurrentLyrics,
    revertToVersion,
    setSongBackground,
  }
})
