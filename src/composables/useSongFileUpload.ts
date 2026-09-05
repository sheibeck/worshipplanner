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
  status: 'uploading' | 'done' | 'error' | 'rejected'
  message?: string
}

export interface AddFilesContext {
  songId: string
  orgId: string
  createdBy: string
  existingAttachments: SongAttachment[]
}

export interface UseSongFileUploadReturn {
  /** Reactive per-file upload rows, in the order files were added. */
  uploads: Ref<UploadRow[]>
  /**
   * Validates and uploads every file in the batch to
   * `orgs/{orgId}/song-files/{attachmentId}/{sanitizedName}` via a resumable
   * upload. A file failing client validation (wrong type / >50MB) gets a
   * 'rejected' row and never starts an upload — it does not block the other
   * files in the batch. Each completed upload persists a SongAttachment via
   * `songStore.updateSong(songId, { attachments })`.
   */
  addFiles: (files: FileList | File[], ctx: AddFilesContext) => void
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
 * UI-SPEC rejection copy, or null when the file is acceptable. */
function validateSongFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  const hasAllowedExt = lowerName.endsWith('.pdf') || lowerName.endsWith('.mp3')
  const hasAllowedMime = (SONG_FILE_ALLOWED_MIME as readonly string[]).includes(file.type)
  if (!hasAllowedMime && !hasAllowedExt) {
    return `'${file.name}' can't be uploaded — PDF and MP3 only, up to 50 MB.`
  }
  if (file.size > SONG_FILE_MAX_BYTES) {
    return `'${file.name}' is too large — max 50 MB.`
  }
  return null
}

export function useSongFileUpload(): UseSongFileUploadReturn {
  const uploads = ref<UploadRow[]>([])

  function reset(): void {
    uploads.value = []
  }

  function addFiles(files: FileList | File[], ctx: AddFilesContext): void {
    const fileArray = Array.from(files)
    // Batch-local accumulator: every completion writes existingAttachments +
    // everything completed so far in THIS batch, so the final persisted array
    // is complete regardless of which file finishes first (Firestore is
    // last-write-wins).
    const completed: SongAttachment[] = []

    for (const file of fileArray) {
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

      const attachmentId = crypto.randomUUID()
      const kind = kindForFile(file)
      uploads.value.push({
        id: attachmentId,
        name: file.name,
        kind,
        progress: 0,
        status: 'uploading',
      })
      const rowIndex = uploads.value.length - 1

      const path = songFileStoragePath(ctx.orgId, attachmentId, file.name)
      const fileRef = storageRef(storage, path)
      const task = uploadBytesResumable(fileRef, file, {
        customMetadata: { createdAt: new Date().toISOString() },
      })

      task.on(
        'state_changed',
        (snapshot) => {
          const current = uploads.value[rowIndex]
          if (!current) return
          uploads.value[rowIndex] = {
            ...current,
            progress: snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0,
          }
        },
        () => {
          const current = uploads.value[rowIndex]
          if (!current) return
          uploads.value[rowIndex] = {
            ...current,
            status: 'error',
            message: 'Upload failed. Check your connection and try again.',
          }
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
                createdAt: Timestamp.now(),
                createdBy: ctx.createdBy,
              }
              completed.push(attachment)
              await useSongStore().updateSong(ctx.songId, {
                attachments: [...ctx.existingAttachments, ...completed],
              })
              const current = uploads.value[rowIndex]
              if (!current) return
              uploads.value[rowIndex] = { ...current, status: 'done', progress: 100 }
            })
            .catch(() => {
              const current = uploads.value[rowIndex]
              if (!current) return
              uploads.value[rowIndex] = {
                ...current,
                status: 'error',
                message: 'Upload failed. Check your connection and try again.',
              }
            })
        },
      )
    }
  }

  return { uploads, addFiles, reset }
}
