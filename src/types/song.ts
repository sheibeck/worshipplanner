import type { Timestamp } from 'firebase/firestore'

export type VWType = 1 | 2 | 3

/** Human-readable labels for VW categories. Shared across editor, search, and pickers. */
export const VW_TYPE_LABELS: Record<VWType, string> = {
  1: 'Call to Worship',
  2: 'Intimate',
  3: 'Ascription',
}

export interface Arrangement {
  id: string
  name: string
  key: string
  bpm: number | null
  lengthSeconds: number | null
  chordChartUrl: string
  notes: string
  teamTags: string[]
}

export interface Song {
  id: string
  title: string
  ccliNumber: string
  author: string
  themes: string[]
  notes: string
  vwTypes: VWType[]
  teamTags: string[]
  arrangements: Arrangement[]
  /** Arrangement chosen as the "play key" for transitions; null falls back to arrangements[0]. */
  primaryArrangementId: string | null
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  pcSongId: string | null
  hidden: boolean
}

/**
 * Input type for upsert operations.
 * Same shape as Song minus auto-managed fields (id, createdAt, updatedAt).
 */
export type UpsertSongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>
