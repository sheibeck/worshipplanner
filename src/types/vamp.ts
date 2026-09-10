import type { Timestamp } from 'firebase/firestore'

/** R435 — a vamp's single MP3 attachment. Mirrors SongAttachment's upload
 * shape, collapsed to one always-audio slot: no `id`/`kind` (a vamp has
 * exactly one file, never an array). */
export interface VampAttachment {
  storagePath: string
  downloadUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  /** Best-effort client-captured duration in seconds; absent when extraction fails. */
  durationSec?: number
  createdAt: Timestamp
  createdBy: string
}

/** A vamp = one name, one key, one optional tempo, one optional MP3. No
 * `hidden` field — delete is single-step hard delete, no soft-delete/restore. */
export interface Vamp {
  id: string
  name: string
  key: string
  tempo?: string
  attachment?: VampAttachment | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type UpsertVampInput = Omit<Vamp, 'id' | 'createdAt' | 'updatedAt'>
