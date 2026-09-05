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

export type SongAttachmentKind = 'document' | 'audio' | 'link'
export type SongAttachmentLinkSource = 'youtube' | 'drive' | 'dropbox' | 'other'

/** R369: a song's uploaded file or external link. See src/utils/songFiles.ts for the
 * storage path/constants helper. Uploads carry storagePath+downloadUrl; links carry
 * linkSource+href instead. */
export interface SongAttachment {
  id: string
  kind: SongAttachmentKind
  /** Display filename (uploads) or user-entered label (links). */
  name: string
  /** Storage object path, uploads only: orgs/{orgId}/song-files/{id}/{sanitizedName}. */
  storagePath?: string
  /** Denormalized Storage download-token URL — reads never need a rules round-trip. */
  downloadUrl?: string
  mimeType?: string
  sizeBytes?: number
  /** Links only. */
  linkSource?: SongAttachmentLinkSource
  href?: string
  createdAt: Timestamp
  createdBy: string
}

export interface Song {
  id: string
  title: string
  ccliNumber: string
  author: string
  themes: string[]
  notes: string
  vwTypes: VWType[]
  arrangements: Arrangement[]
  /** Arrangement chosen as the "play key" for transitions; null falls back to arrangements[0]. */
  primaryArrangementId: string | null
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  pcSongId: string | null
  hidden: boolean
  tags: string[] // D-01 user-defined tags (e.g. "Christmas") — folded team tags + user tags (Song.teamTags removed)
  /** Themes the user removed locally; subtracted from PC theme union on re-import (D-14). */
  removedThemes: string[]
  /** R369: additive, optional — every existing song loads/saves unchanged. */
  attachments?: SongAttachment[]
}

/**
 * Input type for upsert operations.
 * Same shape as Song minus auto-managed fields (id, createdAt, updatedAt).
 */
export type UpsertSongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>
