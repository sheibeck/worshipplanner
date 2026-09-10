/** R435 — vamp MP3 attachment constants + Storage path helper. Mirrors
 * songFiles.ts, narrowed to a single always-audio slot per vamp. */

import { sanitizeFileName } from '@/utils/songFiles'

export const VAMP_FILE_MAX_BYTES = 52428800

export const VAMP_FILE_ALLOWED_MIME = ['audio/mpeg'] as const

/** orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{sanitizedName} — sibling of
 * song-files/, outside media/, so structurally exempt from every retention
 * sweep. The uploadId segment is mandatory: it gives every upload (including
 * an MP3 replace) a fresh path under storage.rules' immutable `update: if
 * false` gate (Plan 140-02). */
export function vampFileStoragePath(orgId: string, vampId: string, uploadId: string, name: string): string {
  return `orgs/${orgId}/vamp-files/${vampId}/${uploadId}/${sanitizeFileName(name)}`
}
