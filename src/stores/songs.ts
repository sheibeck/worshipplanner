import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Song, UpsertSongInput } from '@/types/song'

type SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>

export const useSongStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  // Filter state
  const searchQuery = ref('')
  const filterVwType = ref<1 | 2 | 3 | 'uncategorized' | null>(null)
  const filterKey = ref('')
  const filterTag = ref('')

  let unsubscribeFn: Unsubscribe | null = null

  const filteredSongs = computed(() => {
    return songs.value.filter((song) => {
      // Exclude hidden songs (treat undefined as false for legacy docs)
      if (song.hidden === true) return false
      const matchesSearch =
        !searchQuery.value ||
        song.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        song.ccliNumber.includes(searchQuery.value)

      const matchesVwType =
        filterVwType.value === null ||
        (filterVwType.value === 'uncategorized'
          ? song.vwType === null
          : song.vwType === filterVwType.value)

      const matchesKey =
        !filterKey.value ||
        song.arrangements.some((a) => a.key === filterKey.value)

      const matchesTag =
        !filterTag.value || song.teamTags.includes(filterTag.value)

      return matchesSearch && matchesVwType && matchesKey && matchesTag
    })
  })

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    orgId.value = orgIdValue
    const q = query(
      collection(db, 'organizations', orgIdValue, 'songs'),
      orderBy('title'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      songs.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Song)
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribeFn?.()
    unsubscribeFn = null
    orgId.value = null
    songs.value = []
    isLoading.value = true
  }

  async function addSong(data: SongInput) {
    if (!orgId.value) return
    await addDoc(collection(db, 'organizations', orgId.value, 'songs'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateSong(id: string, data: Partial<SongInput>) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteSong(id: string) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), {
      hidden: true,
      updatedAt: serverTimestamp(),
    })
  }

  async function restoreSong(id: string) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), {
      hidden: false,
      updatedAt: serverTimestamp(),
    })
  }

  async function upsertSongs(songsData: UpsertSongInput[]) {
    if (!orgId.value) return

    // Build lookup maps for O(1) matching
    const byPcSongId = new Map<string, Song>()
    const byCcliNumber = new Map<string, Song>()
    const byTitle = new Map<string, Song>()

    for (const song of songs.value) {
      if (song.pcSongId) byPcSongId.set(song.pcSongId, song)
      if (song.ccliNumber) byCcliNumber.set(song.ccliNumber, song)
      byTitle.set(song.title.toLowerCase(), song)
    }

    for (const incoming of songsData) {
      // Find existing match: pcSongId → ccliNumber → title (case-insensitive)
      let existing: Song | undefined
      if (incoming.pcSongId) {
        existing = byPcSongId.get(incoming.pcSongId)
      }
      if (!existing && incoming.ccliNumber) {
        existing = byCcliNumber.get(incoming.ccliNumber)
      }
      if (!existing) {
        existing = byTitle.get(incoming.title.toLowerCase())
      }

      if (existing) {
        // Update existing: preserve hidden status, only set vwType when incoming is non-null
        const { vwType: incomingVwType, ...restIncoming } = incoming
        const updateData: Record<string, unknown> = {
          ...restIncoming,
          hidden: existing.hidden,
          updatedAt: serverTimestamp(),
        }
        // Only include vwType if incoming value is non-null
        if (incomingVwType !== null) {
          updateData.vwType = incomingVwType
        }
        await updateDoc(doc(db, 'organizations', orgId.value!, 'songs', existing.id), updateData)
      } else {
        // Create new doc
        await addDoc(collection(db, 'organizations', orgId.value!, 'songs'), {
          ...incoming,
          hidden: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    }
  }

  async function importSongs(songsData: SongInput[]) {
    if (!orgId.value) return
    const CHUNK = 499
    for (let i = 0; i < songsData.length; i += CHUNK) {
      const batch = writeBatch(db)
      songsData.slice(i, i + CHUNK).forEach((song) => {
        const ref = doc(collection(db, 'organizations', orgId.value!, 'songs'))
        batch.set(ref, {
          ...song,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
      await batch.commit()
    }
  }

  return {
    songs,
    isLoading,
    orgId,
    searchQuery,
    filterVwType,
    filterKey,
    filterTag,
    filteredSongs,
    subscribe,
    unsubscribeAll,
    addSong,
    updateSong,
    deleteSong,
    restoreSong,
    importSongs,
    upsertSongs,
  }
})
