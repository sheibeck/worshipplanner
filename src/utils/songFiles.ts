/** R369 — song-file attachment constants + Storage path helper. Mirrors
 * useMediaUpload.ts's MEDIA_MAX_BYTES/sanitizeFileName pattern, but for the
 * dedicated orgs/{orgId}/song-files/ prefix (outside media/, permanent). */

export const SONG_FILE_MAX_BYTES = 52428800

export const SONG_FILE_ALLOWED_MIME = ['application/pdf', 'audio/mpeg'] as const

/** Shared canonical sanitizer for Storage object path filenames — strips
 * characters Cloud Storage object paths don't like. Phase 123 code-review
 * IN-03: this used to be duplicated privately in useMediaUpload.ts; now it's
 * the single implementation both useMediaUpload and useSongFileUpload import. */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/** orgs/{orgId}/song-files/{attachmentId}/{sanitizedName} — deliberately
 * outside media/ so it's structurally exempt from every retention sweep (R370). */
export function songFileStoragePath(orgId: string, attachmentId: string, name: string): string {
  return `orgs/${orgId}/song-files/${attachmentId}/${sanitizeFileName(name)}`
}
