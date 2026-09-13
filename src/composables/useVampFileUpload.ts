import { ref, type Ref } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { Timestamp } from 'firebase/firestore'
import { storage } from '@/firebase'
import { useVampStore } from '@/stores/vamps'
import { VAMP_FILE_ALLOWED_MIME, VAMP_FILE_MAX_BYTES, vampFileStoragePath } from '@/utils/vampFiles'
import type { VampAttachment } from '@/types/vamp'

/** R435 — single-file resumable MP3 upload for a vamp's one attachment
 * slot. Narrowed mirror of useSongFileUpload.ts: one file at a time, audio
 * only, and a replace overwrites the slot rather than rejecting a duplicate
 * name (see 140-PATTERNS.md). */

export interface UploadRow {
  id: string
  name: string
  progress: number
  // No 'done' — a completed upload's row is removed immediately, mirroring
  // useSongFileUpload's convention (a lingering 100% bar was a reported bug).
  status: 'uploading' | 'error' | 'rejected'
  message?: string
}

export interface AddFileContext {
  vampId: string
  orgId: string
  createdBy: string
}

export interface UseVampFileUploadReturn {
  uploads: Ref<UploadRow[]>
  announcement: Ref<string>
  addFile: (file: File, ctx: AddFileContext) => void
  dismiss: (id: string) => void
  reset: () => void
}

/** Best-effort audio duration capture: never blocks or fails the upload. */
const DURATION_CAPTURE_TIMEOUT_MS = 300

/** UX-only client validation — storage.rules (Plan 140-02) is the server
 * authority. Requires BOTH mime and extension to agree, mirroring
 * useSongFileUpload's WR-01 fix. */
function validateVampFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  const hasAllowedExt = lowerName.endsWith('.mp3')
  const hasAllowedMime = (VAMP_FILE_ALLOWED_MIME as readonly string[]).includes(file.type)
  if (!hasAllowedMime || !hasAllowedExt) {
    return `'${file.name}' can't be uploaded — MP3 only, up to 50 MB.`
  }
  if (file.size >= VAMP_FILE_MAX_BYTES) {
    return `'${file.name}' is too large — max 50 MB.`
  }
  return null
}

/** Reads a File's audio duration via a throwaway <audio> element, racing a
 * short timeout. Resolves undefined (never rejects) on any failure —
 * missing metadata support, a malformed file, or the timeout itself. */
function captureDurationSec(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: number | undefined) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      resolve(value)
    }

    let url: string
    try {
      url = URL.createObjectURL(file)
    } catch {
      resolve(undefined)
      return
    }

    const audio = new Audio()
    const timer = setTimeout(() => finish(undefined), DURATION_CAPTURE_TIMEOUT_MS)

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timer)
      const duration = audio.duration
      finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined)
    })
    audio.addEventListener('error', () => {
      clearTimeout(timer)
      finish(undefined)
    })

    audio.src = url
  })
}

export function useVampFileUpload(): UseVampFileUploadReturn {
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

  function addFile(file: File, ctx: AddFileContext): void {
    const validationError = validateVampFile(file)
    if (validationError) {
      uploads.value.push({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
        status: 'rejected',
        message: validationError,
      })
      return
    }

    const rowId = crypto.randomUUID()
    uploads.value.push({
      id: rowId,
      name: file.name,
      progress: 0,
      status: 'uploading',
    })

    // Fresh per-upload path segment — every upload (incl. a replace) lands
    // on a new object, never colliding with storage.rules' immutable
    // `update: if false` gate (140-RESEARCH.md Pitfall 2).
    const uploadId = crypto.randomUUID()
    const path = vampFileStoragePath(ctx.orgId, ctx.vampId, uploadId, file.name)
    const fileRef = storageRef(storage, path)
    const task = uploadBytesResumable(fileRef, file, {
      customMetadata: { createdAt: new Date().toISOString() },
    })

    task.on(
      'state_changed',
      (snapshot) => {
        patchRow(rowId, {
          progress: snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0,
        })
      },
      () => {
        patchRow(rowId, {
          status: 'error',
          message: 'Upload failed. Check your connection and try again.',
        })
      },
      () => {
        getDownloadURL(task.snapshot.ref)
          .then(async (downloadUrl: string) => {
            const durationSec = await captureDurationSec(file)
            const attachment: VampAttachment = {
              storagePath: path,
              downloadUrl,
              fileName: file.name,
              mimeType: file.type || 'audio/mpeg',
              sizeBytes: file.size,
              // Never write undefined into Firestore — omit the key entirely
              // when extraction failed or was unavailable.
              ...(durationSec !== undefined ? { durationSec } : {}),
              // Timestamp.now(), not serverTimestamp() — this value is a plain
              // field on the attachment object, matching the Song attachment
              // convention (serverTimestamp() resolves to null inside arrays,
              // and this codebase keeps the two attachment shapes consistent).
              createdAt: Timestamp.now(),
              createdBy: ctx.createdBy,
            }
            await useVampStore().setAttachment(ctx.vampId, attachment)
            removeRow(rowId)
            announcement.value = `Uploaded ${file.name}.`
          })
          .catch(() => {
            patchRow(rowId, {
              status: 'error',
              message: 'Upload failed. Check your connection and try again.',
            })
          })
      },
    )
  }

  return { uploads, announcement, addFile, dismiss, reset }
}
