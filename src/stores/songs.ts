import { ref, computed, watch } from 'vue'
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
import type { Song, UpsertSongInput, VWType } from '@/types/song'
import { songMatchesQuery } from '@/utils/songSearch'
import { useAuthStore } from '@/stores/auth'

type SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>

export const useSongStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  // Filter state
  const searchQuery = ref('')
  const filterVwType = ref<1 | 2 | 3 | 'uncategorized' | null>(null)
  const filterKey = ref('')
  // D-08: shared per-tag Show/Hide tag-filter state — independent include/exclude sets
  // D-09: include set OR-combines (show if carrying ANY included tag)
  // D-10: exclude set always wins (hide if carrying ANY excluded tag), even alongside include
  const tagFilterInclude = ref<Set<string>>(new Set())
  const tagFilterExclude = ref<Set<string>>(new Set())

  let unsubscribeFn: Unsubscribe | null = null

  const filteredSongs = computed(() => {
    return songs.value.filter((song) => {
      // Exclude hidden songs (treat undefined as false for legacy docs)
      if (song.hidden === true) return false
      const matchesSearch = songMatchesQuery(song, searchQuery.value)

      const matchesVwType =
        filterVwType.value === null ||
        (filterVwType.value === 'uncategorized'
          ? song.vwTypes.length === 0
          : song.vwTypes.includes(filterVwType.value as VWType))

      const matchesKey =
        !filterKey.value ||
        song.arrangements.some((a) => a.key === filterKey.value)

      const include = tagFilterInclude.value
      const exclude = tagFilterExclude.value
      let matchesUserTags = true
      if (exclude.size > 0) {
        const carriesExcluded =
          (song.teamTags ?? []).some((t) => exclude.has(t)) ||
          (song.themes ?? []).some((t) => exclude.has(t)) ||
          (song.tags ?? []).some((t) => exclude.has(t))
        if (carriesExcluded) matchesUserTags = false
      }
      if (matchesUserTags && include.size > 0) {
        const carriesIncluded =
          (song.teamTags ?? []).some((t) => include.has(t)) ||
          (song.themes ?? []).some((t) => include.has(t)) ||
          (song.tags ?? []).some((t) => include.has(t))
        matchesUserTags = carriesIncluded
      }

      return matchesSearch && matchesVwType && matchesKey && matchesUserTags
    })
  })

  // Distinct USER tags (song.tags only) across non-hidden songs, sorted — powers
  // type-ahead suggestions when adding tags so users don't create duplicates.
  const allUserTags = computed(() => {
    const tags = new Set<string>()
    songs.value.forEach((song) => {
      if (song.hidden === true) return
      ;(song.tags ?? []).forEach((t) => tags.add(t))
    })
    return Array.from(tags).sort()
  })

  // AI song-suggestion candidate pool. Excludes soft-deleted songs — in this app
  // a soft-delete sets hidden === true (see deleteSong), so the hidden filter IS
  // the deleted-song exclusion. Treat undefined as not-hidden for legacy docs.
  const aiCandidateSongs = computed(() =>
    songs.value.filter((song) => song.hidden !== true),
  )

  // Active (non-soft-deleted) songs, for counts shown to users (Dashboard stat,
  // Songs-page header). Mirrors aiCandidateSongs' hidden filter — undefined is
  // treated as not-hidden for legacy docs.
  const visibleSongs = computed(() =>
    songs.value.filter((song) => song.hidden !== true),
  )

  // D-11: clears only the tag filter — searchQuery/filterVwType/filterKey untouched
  function clearTagFilter() {
    tagFilterInclude.value = new Set()
    tagFilterExclude.value = new Set()
  }

  // D-12/D-13: persist ONLY the tag-filter include/exclude sets to localStorage, namespaced
  // per user+org so state never bleeds across accounts on a shared browser (T-12-03).
  function tagFilterStorageKey(): string | null {
    const auth = useAuthStore()
    const uid = auth.user?.uid
    const org = orgId.value ?? auth.orgId
    if (!uid || !org) return null // don't read/write under a shared/global key
    return `wp:tagFilter:v2:${org}:${uid}`
  }

  function persistTagFilter() {
    const key = tagFilterStorageKey()
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify({
        include: Array.from(tagFilterInclude.value),
        exclude: Array.from(tagFilterExclude.value),
      }))
    } catch { /* ignore: private mode / quota — degrade to in-memory only */ }
  }

  function hydrateTagFilter() {
    const key = tagFilterStorageKey()
    if (!key) {
      // No usable storage key (missing uid/org) — reset in-memory state so a
      // previous account's selection can't leak into this session (T-12-03).
      tagFilterInclude.value = new Set()
      tagFilterExclude.value = new Set()
      return
    }
    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        // No saved filter for this user/org — reset rather than leaving a
        // previously-active user's in-memory selection applied (T-12-03).
        tagFilterInclude.value = new Set()
        tagFilterExclude.value = new Set()
        return
      }
      const parsed = JSON.parse(raw) as { include?: string[]; exclude?: string[] }
      tagFilterInclude.value = new Set(Array.isArray(parsed.include) ? parsed.include : [])
      tagFilterExclude.value = new Set(Array.isArray(parsed.exclude) ? parsed.exclude : [])
    } catch {
      // Corrupt/unavailable — reset to defaults rather than keeping stale
      // in-memory state from a prior user/org.
      tagFilterInclude.value = new Set()
      tagFilterExclude.value = new Set()
    }
  }

  watch([tagFilterInclude, tagFilterExclude], persistTagFilter, { deep: true })

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
      songs.value = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        // Normalize legacy vwType scalar field to vwTypes array
        if (!Array.isArray(data.vwTypes)) {
          data.vwTypes = data.vwType != null ? [data.vwType] : []
        }
        // Normalize legacy docs without tags field to empty array
        if (!Array.isArray(data.tags)) {
          data.tags = []
        }
        return { id: d.id, ...data } as Song
      })
      isLoading.value = false
    })
    // Hydrate the tag filter once org+uid are resolved (mirrors how views call
    // subscribe once authStore.orgId resolves).
    hydrateTagFilter()
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
        // Update existing: preserve hidden status and user tags, merge themes, only set vwTypes when incoming is non-empty
        const {
          vwTypes: incomingVwTypes,
          hidden: _hidden,
          primaryArrangementId: incomingPrimary,
          tags: _tags,
          themes: _themes,
          ...restIncoming
        } = incoming
        const updateData: Record<string, unknown> = {
          ...restIncoming,
          hidden: existing.hidden ?? false,
          // D-02: never let import overwrite user tags — identical to hidden preservation
          tags: existing.tags ?? [],
          // D-08: union themes instead of clobbering (merge existing + incoming, no duplicates)
          themes: Array.from(new Set([...(existing.themes ?? []), ...(_themes ?? [])])),
          updatedAt: serverTimestamp(),
        }
        // Only include vwTypes if incoming array is non-empty (preserve user-set types if incoming is empty)
        if (incomingVwTypes.length > 0) {
          updateData.vwTypes = incomingVwTypes
        }
        // Preserve a user-chosen primary key when it still maps to an arrangement;
        // otherwise fall back to the import's auto-picked key.
        const existingPrimaryStillValid =
          existing.primaryArrangementId != null &&
          incoming.arrangements.some((a) => a.id === existing.primaryArrangementId)
        updateData.primaryArrangementId = existingPrimaryStillValid
          ? existing.primaryArrangementId
          : (incomingPrimary ?? null)
        await updateDoc(doc(db, 'organizations', orgId.value!, 'songs', existing.id), updateData)
      } else {
        // Create new doc
        await addDoc(collection(db, 'organizations', orgId.value!, 'songs'), {
          ...incoming,
          hidden: false,
          tags: incoming.tags ?? [],
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
    tagFilterInclude,
    tagFilterExclude,
    filteredSongs,
    allUserTags,
    aiCandidateSongs,
    visibleSongs,
    subscribe,
    unsubscribeAll,
    addSong,
    updateSong,
    deleteSong,
    restoreSong,
    importSongs,
    upsertSongs,
    clearTagFilter,
  }
})
