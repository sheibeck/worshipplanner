import { ref, watch, type Ref, type ComputedRef } from 'vue'
import type { Service, SongSlot } from '@/types/service'
import type { Song } from '@/types/song'
import { getSongSuggestions, type AiSongSuggestion } from '@/utils/claudeApi'
import { getPrimaryKey } from '@/utils/songSearch'

export interface AiDraftSong {
  songId: string
  songTitle: string
  songKey: string
  reason: string
}

/** The subset of the song store this composable reads — see `useSongStore` (src/stores/songs.ts). */
export interface AiSongSuggestionsSongStore {
  aiCandidateSongs: Song[]
  songs: Song[]
}

export interface UseAiSongSuggestionsOptions {
  localService: Ref<Service | null>
  canEditService: ComputedRef<boolean>
  hasSermonContext: ComputedRef<boolean>
  recentServiceSongIds: ComputedRef<string[]>
  songStore: AiSongSuggestionsSongStore
  onSelectSong: (index: number, song: { id: string; title: string; key: string }) => void
}

export interface UseAiSongSuggestionsReturn {
  aiDraftSongs: Ref<Map<number, AiDraftSong>>
  aiSuggestingAll: Ref<boolean>
  aiSongCache: Ref<Map<string, AiSongSuggestion[]>>
  aiPerSlotLoading: Ref<Map<number, boolean>>
  aiPerSlotResults: Ref<Map<number, AiSongSuggestion[]>>
  aiPerSlotError: Ref<Map<number, boolean>>
  suggestAllSongs: () => Promise<void>
  fetchAiForSlot: (slotIndex: number) => Promise<void>
  acceptAiSong: (index: number) => void
  rejectAiSong: (index: number) => void
}

/**
 * R358/ARCH-006 — AI song-suggestion responsibility extracted verbatim out of
 * ServiceEditorView.vue (see .planning/codebase/ARCHITECTURE.md, Component &
 * Composable Behavioral Notes (R318) -> src/composables/useAiSongSuggestions.ts).
 * Behavior-preserving move: same six refs, same four functions, same cache-clear
 * watcher — only the host reads/writes them through the returned surface now.
 */
export function useAiSongSuggestions(
  options: UseAiSongSuggestionsOptions,
): UseAiSongSuggestionsReturn {
  const { localService, canEditService, hasSermonContext, recentServiceSongIds, songStore, onSelectSong } = options

  // ── AI state ───────────────────────────────────────────────────────────────

  // Keyed by slot index — AI-drafted songs awaiting accept/reject
  const aiDraftSongs = ref<Map<number, AiDraftSong>>(new Map())
  // Loading state for "Suggest All" bulk flow
  const aiSuggestingAll = ref(false)
  // Session cache keyed by sermon context + slot VW type (JSON.stringify)
  const aiSongCache = ref(new Map<string, AiSongSuggestion[]>())
  // Per-slot loading state for individual dropdown AI picks
  const aiPerSlotLoading = ref(new Map<number, boolean>())
  // Per-slot AI results for dropdown display
  const aiPerSlotResults = ref(new Map<number, AiSongSuggestion[]>())
  // Per-slot error state for dropdown display
  const aiPerSlotError = ref(new Map<number, boolean>())

  // ── AI sermon context watcher — clear caches on context change ─────────────

  watch(
    () => [localService.value?.sermonTopic, localService.value?.sermonPassage],
    () => {
      aiSongCache.value.clear()
      aiPerSlotResults.value.clear()
      aiPerSlotError.value.clear()
      aiPerSlotLoading.value.clear()
    },
    { deep: true },
  )

  // ── AI cache key ─────────────────────────────────────────────────────────────

  function aiCacheKey(slotVwType: number): string {
    return JSON.stringify({
      topic: localService.value?.sermonTopic ?? '',
      passage: localService.value?.sermonPassage ?? null,
      slotVwType,
    })
  }

  // ── Suggest All Songs ────────────────────────────────────────────────────────

  async function suggestAllSongs() {
    if (!canEditService.value) return
    if (!localService.value || !hasSermonContext.value) return
    aiSuggestingAll.value = true

    try {
      const sermonTopic = localService.value.sermonTopic ?? null
      const sermonPassage = localService.value.sermonPassage ?? null
      // D-18: exclude hidden (soft-deleted) songs from the AI base pool.
      const librarySource = songStore.aiCandidateSongs
      const songLibrary = librarySource.map((s) => ({
        id: s.id,
        title: s.title,
        ccliNumber: s.ccliNumber,
        vwTypes: s.vwTypes,
        themes: s.themes,
        lastUsedAt: s.lastUsedAt,
      }))
      const recentIds = recentServiceSongIds.value

      // Accumulate accepted IDs across the batch so each call is aware of previous picks
      const batchAcceptedIds: string[] = []

      for (let i = 0; i < localService.value.slots.length; i++) {
        const slot = localService.value.slots[i]
        if (!slot || slot.kind !== 'SONG') continue
        const songSlot = slot as SongSlot

        // Collect already-selected song IDs from non-empty slots
        const alreadySelectedIds: string[] = []
        for (const s of localService.value.slots) {
          if (s.kind === 'SONG') {
            const id = (s as SongSlot).songId
            if (id) alreadySelectedIds.push(id)
          }
        }
        // Include batch picks so far
        for (const id of batchAcceptedIds) {
          if (!alreadySelectedIds.includes(id)) alreadySelectedIds.push(id)
        }

        const result = await getSongSuggestions({
          sermonTopic,
          sermonPassage,
          slotVwType: songSlot.requiredVwType,
          alreadySelectedSongIds: alreadySelectedIds,
          songLibrary,
          recentServiceSongIds: recentIds,
        })

        if (!result || result.length === 0) continue

        // Filter out songs already selected or drafted for other slots
        const suggestion = result.find((s) => !alreadySelectedIds.includes(s.songId) && !batchAcceptedIds.includes(s.songId))
        if (!suggestion) continue

        const song = songStore.songs.find((s) => s.id === suggestion.songId)
        if (!song) continue

        const key = getPrimaryKey(song)
        const newMap = new Map(aiDraftSongs.value)
        newMap.set(i, {
          songId: song.id,
          songTitle: song.title,
          songKey: key,
          reason: suggestion.reason,
        })
        aiDraftSongs.value = newMap

        // Track this ID for subsequent calls in the batch
        batchAcceptedIds.push(song.id)
      }
    } finally {
      aiSuggestingAll.value = false
    }
  }

  // ── Fetch AI suggestions for a single slot (called by SongSlotPicker emit) ──

  async function fetchAiForSlot(slotIndex: number) {
    if (!canEditService.value) return
    if (!localService.value) return
    const slot = localService.value.slots[slotIndex]
    if (!slot || slot.kind !== 'SONG') return
    const songSlot = slot as SongSlot

    const cacheKey = aiCacheKey(songSlot.requiredVwType)

    // Check cache first
    if (aiSongCache.value.has(cacheKey)) {
      const cached = aiSongCache.value.get(cacheKey)!
      const newResults = new Map(aiPerSlotResults.value)
      newResults.set(slotIndex, cached)
      aiPerSlotResults.value = newResults
      return
    }

    // Set loading, clear any previous error
    const newLoading = new Map(aiPerSlotLoading.value)
    newLoading.set(slotIndex, true)
    aiPerSlotLoading.value = newLoading

    const newErrors = new Map(aiPerSlotError.value)
    newErrors.delete(slotIndex)
    aiPerSlotError.value = newErrors

    try {
      const alreadySelectedIds: string[] = []
      for (const s of localService.value.slots) {
        if (s.kind === 'SONG') {
          const id = (s as SongSlot).songId
          if (id) alreadySelectedIds.push(id)
        }
      }

      // D-18: exclude hidden (soft-deleted) songs from the AI base pool.
      const librarySource = songStore.aiCandidateSongs
      const result = await getSongSuggestions({
        sermonTopic: localService.value.sermonTopic ?? null,
        sermonPassage: localService.value.sermonPassage ?? null,
        slotVwType: songSlot.requiredVwType,
        alreadySelectedSongIds: alreadySelectedIds,
        songLibrary: librarySource.map((s) => ({
          id: s.id,
          title: s.title,
          ccliNumber: s.ccliNumber,
          vwTypes: s.vwTypes,
          themes: s.themes,
          lastUsedAt: s.lastUsedAt,
        })),
        recentServiceSongIds: recentServiceSongIds.value,
      })

      if (result) {
        // Cache and store results
        const newCache = new Map(aiSongCache.value)
        newCache.set(cacheKey, result)
        aiSongCache.value = newCache

        const newResultsMap = new Map(aiPerSlotResults.value)
        newResultsMap.set(slotIndex, result)
        aiPerSlotResults.value = newResultsMap
      } else {
        // null result means error/no suggestions
        const errMap = new Map(aiPerSlotError.value)
        errMap.set(slotIndex, true)
        aiPerSlotError.value = errMap
      }
    } catch {
      const errMap = new Map(aiPerSlotError.value)
      errMap.set(slotIndex, true)
      aiPerSlotError.value = errMap
    } finally {
      const loadingMap = new Map(aiPerSlotLoading.value)
      loadingMap.delete(slotIndex)
      aiPerSlotLoading.value = loadingMap
    }
  }

  // ── Accept / Reject AI draft songs ───────────────────────────────────────────

  function acceptAiSong(index: number) {
    if (!canEditService.value) return
    const draft = aiDraftSongs.value.get(index)
    if (!draft) return
    onSelectSong(index, { id: draft.songId, title: draft.songTitle, key: draft.songKey })
    const newMap = new Map(aiDraftSongs.value)
    newMap.delete(index)
    aiDraftSongs.value = newMap
  }

  function rejectAiSong(index: number) {
    if (!canEditService.value) return
    const newMap = new Map(aiDraftSongs.value)
    newMap.delete(index)
    aiDraftSongs.value = newMap
  }

  return {
    aiDraftSongs,
    aiSuggestingAll,
    aiSongCache,
    aiPerSlotLoading,
    aiPerSlotResults,
    aiPerSlotError,
    suggestAllSongs,
    fetchAiForSlot,
    acceptAiSong,
    rejectAiSong,
  }
}
