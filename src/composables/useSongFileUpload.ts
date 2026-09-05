import { ref, type Ref } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { Timestamp } from 'firebase/firestore'
import { storage } from '@/firebase'
import { useSongStore } from '@/stores/songs'
import { SONG_FILE_ALLOWED_MIME, SONG_FILE_MAX_BYTES, songFileStoragePath } from '@/utils/songFiles'
import type { SongAttachment, SongAttachmentKind } from '@/types/song'

/** R363 — multi-file resumable upload for song attachments, mirroring
 * useMediaUpload.ts's single-file idiom but for several files with a
 * reactive per-file row list. See
 * .planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md §Error state
 * for the exact rejection copy this implements. */

export interface UploadRow {
  id: string
  name: string
  kind: SongAttachmentKind
  progress: number
  // No 'done': a completed upload's row is removed immediately (the file now
  // shows in the Documents/Audio list, which is the confirmation) — a lingering
  // 100% bar was a reported bug. 'error'/'rejected' rows stay until dismissed.
  status: 'uploading' | 'error' | 'rejected'
  message?: string
}

export interface AddFilesContext {
  songId: string
  orgId: string
  createdBy: string
}

export interface UseSongFileUploadReturn {
  /** Reactive per-file upload rows, in the order files were added. Rows are
   * addressed by their stable `id` (never a positional index), so removing a
   * finished row can't corrupt an in-flight row's progress updates. */
  uploads: Ref<UploadRow[]>
  /** Screen-reader-only announcement, set on each successful completion (the
   * 'done' rows it used to derive from are now removed on success). */
  announcement: Ref<string>
  /**
   * Validates and uploads every file in the batch to
   * `orgs/{orgId}/song-files/{attachmentId}/{sanitizedName}` via a resumable
   * upload. A file failing client validation (wrong type / >=50MB) or that
   * duplicates a name already attached (or already uploading) gets a 'rejected'
   * row and never starts an upload — it does not block the other files in the
   * batch. Each completed upload persists a SongAttachment via the atomic
   * `songStore.addSongAttachment(songId, attachment)` (CR-01 — an arrayUnion
   * append, not a read-modify-write of the whole array, so overlapping
   * addFiles()/link-submit calls can't clobber each other) and then removes its
   * own progress row.
   */
  addFiles: (files: FileList | File[], ctx: AddFilesContext) => void
  /** Manually remove an upload row by id (used to dismiss an error/rejected message). */
  dismiss: (id: string) => void
  /** Clears the uploads list. */
  reset: () => void
}

function kindForFile(file: File): SongAttachmentKind {
  const lowerName = file.name.toLowerCase()
  if (file.type === 'audio/mpeg' || lowerName.endsWith('.mp3')) return 'audio'
  return 'document'
}

/** UX-only client validation — Phase 122's storage.rules are the server
 * authority (editor + application/pdf|audio/mpeg + <=50MB). Returns the exact
 * UI-SPEC rejection copy, or null when the file is acceptable.
 * Phase 123 code-review WR-01: both the MIME AND the extension must agree —
 * an OR check let an extension/MIME mismatch (e.g. a renamed file) pass
 * client-side only to be denied by storage.rules' strict contentType check,
 * surfacing the misleading generic "check your connection" error instead of
 * this rejection copy. */
function validateSongFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  const hasAllowedExt = lowerName.endsWith('.pdf') || lowerName.endsWith('.mp3')
  const hasAllowedMime = (SONG_FILE_ALLOWED_MIME as readonly string[]).includes(file.type)
  if (!hasAllowedMime || !hasAllowedExt) {
    return `'${file.name}' can't be uploaded — PDF and MP3 only, up to 50 MB.`
  }
  // Phase 123 code-review WR-02: storage.rules requires strict
  // `size < 52428800` — reject `>=` here too, so a file of exactly 50MB fails
  // with this copy client-side instead of passing here and being denied
  // server-side.
  if (file.size >= SONG_FILE_MAX_BYTES) {
    return `'${file.name}' is too large — max 50 MB.`
  }
  return null
}

export function useSongFileUpload(): UseSongFileUploadReturn {
  const uploads = ref<UploadRow[]>([])
  const announcement = ref('')

  function patchRow(id: string, patch: Partial<UploadRow>): void {
    const i = uploads.value.findIndex((r) => r.id === id)
    if (i === -1) return
    uploads.value[i] = { ...uploads.value[i]!, ...patch }
  }

  function removeRow(id: string): void {
    uploads.value = uploads.value.filter((r) => r.id !== id)
  }

  function dismiss(id: string): void {
    removeRow(id)
  }

  function reset(): void {
    uploads.value = []
    announcement.value = ''
  }

  function addFiles(files: FileList | File[], ctx: AddFilesContext): void {
    const fileArray = Array.from(files)

    // Duplicate guard: a name already attached to this song (uploaded kinds) or
    // already uploading must not be added again as a separate file. Denying with
    // a clear per-file message is friendlier than a silent duplicate or a
    // mid-batch overwrite prompt — to replace a file, remove it then re-upload.
    const song = useSongStore().songs.find((s) => s.id === ctx.songId)
    const takenNames = new Set<string>([
      ...(song?.attachments ?? [])
        .filter((a) => a.kind !== 'link')
        .map((a) => a.name.toLowerCase()),
      ...uploads.value
        .filter((u) => u.status === 'uploading')
        .map((u) => u.name.toLowerCase()),
    ])

    for (const file of fileArray) {
      const lowerName = file.name.toLowerCase()

      if (takenNames.has(lowerName)) {
        uploads.value.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: kindForFile(file),
          progress: 0,
          status: 'rejected',
          message: `'${file.name}' is already attached — remove it first to replace.`,
        })
        continue
      }

      const validationError = validateSongFile(file)
      if (validationError) {
        uploads.value.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind: kindForFile(file),
          progress: 0,
          status: 'rejected',
          message: validationError,
        })
        continue
      }

      // Claim the name so a second identical file in the same batch is rejected.
      takenNames.add(lowerName)

      const attachmentId = crypto.randomUUID()
      const kind = kindForFile(file)
      uploads.value.push({
        id: attachmentId,
        name: file.name,
        kind,
        progress: 0,
        status: 'uploading',
      })

      const path = songFileStoragePath(ctx.orgId, attachmentId, file.name)
      const fileRef = storageRef(storage, path)
      const task = uploadBytesResumable(fileRef, file, {
        customMetadata: { createdAt: new Date().toISOString() },
      })

      task.on(
        'state_changed',
        (snapshot) => {
          patchRow(attachmentId, {
            progress: snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0,
          })
        },
        () => {
          patchRow(attachmentId, {
            status: 'error',
            message: 'Upload failed. Check your connection and try again.',
          })
        },
        () => {
          getDownloadURL(task.snapshot.ref)
            .then(async (downloadUrl: string) => {
              const attachment: SongAttachment = {
                id: attachmentId,
                kind,
                name: file.name,
                storagePath: path,
                downloadUrl,
                mimeType: file.type || (kind === 'document' ? 'application/pdf' : 'audio/mpeg'),
                sizeBytes: file.size,
                // Timestamp.now(), not serverTimestamp() — this value lives
                // inside the attachments ARRAY, and serverTimestamp() resolves
                // to null inside arrays.
                createdAt: Timestamp.now(),
                createdBy: ctx.createdBy,
              }
              // CR-01: arrayUnion append — see addSongAttachment doc comment.
              await useSongStore().addSongAttachment(ctx.songId, attachment)
              // Auto-clear the finished row — the file now appears in the list.
              removeRow(attachmentId)
              announcement.value = `Uploaded ${file.name}.`
            })
            .catch(() => {
              patchRow(attachmentId, {
                status: 'error',
                message: 'Upload failed. Check your connection and try again.',
              })
            })
        },
      )
    }
  }

  return { uploads, announcement, addFiles, dismiss, reset }
}
