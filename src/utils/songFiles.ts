/** R369 — song-file attachment constants + Storage path helper. Mirrors
 * useMediaUpload.ts's MEDIA_MAX_BYTES/sanitizeFileName pattern, but for the
 * dedicated orgs/{orgId}/song-files/ prefix (outside media/, permanent). */

export const SONG_FILE_MAX_BYTES = 52428800

export const SONG_FILE_ALLOWED_MIME = ['application/pdf', 'audio/mpeg'] as const

/** Same sanitization rule as useMediaUpload's private sanitizeFileName —
 * kept separate (not imported) since that module is Phase 123 territory. */
function sanitizeSongFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/** orgs/{orgId}/song-files/{attachmentId}/{sanitizedName} — deliberately
 * outside media/ so it's structurally exempt from every retention sweep (R370). */
export function songFileStoragePath(orgId: string, attachmentId: string, name: string): string {
  return `orgs/${orgId}/song-files/${attachmentId}/${sanitizeSongFileName(name)}`
}
