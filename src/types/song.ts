import type { Timestamp } from 'firebase/firestore'

export type VWType = 1 | 2 | 3

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
  vwType: VWType | null
  teamTags: string[]
  arrangements: Arrangement[]
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
