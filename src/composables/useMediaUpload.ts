import { ref, type Ref } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'

/** Media-cap constant for the Phase 22 org media path (R014); see .planning/codebase/INTEGRATIONS.md (§ Component & Composable Integration Notes (R318) -> src/composables/useMediaUpload.ts). */
export const MEDIA_MAX_BYTES = 52428800

export interface UseMediaUploadReturn {
  /** Reactive percent-complete (0-100) of the in-flight upload. */
  progress: Ref<number>
  /** Reactive error message from validation or a failed upload. Null when no error. */
  error: Ref<string | null>
  /** True while an upload is in flight. */
  isUploading: Ref<boolean>
  /**
   * Validates and uploads a single audio/video file to
   * `orgs/{orgId}/media/{mediaId}/{sanitizedFileName}` via a resumable upload,
   * resolving to its download URL. Rejects (and sets `error`) without ever
   * writing to Firestore or touching slide/slot metadata — upload is fully
   * decoupled from autosave (mirrors `useAutoSave`'s separation), so a failed
   * upload can never lose or corrupt slide/slot data.
   */
  uploadMedia: (file: File, orgId: string) => Promise<string>
  /** Clears progress/error/isUploading back to their initial state. */
  reset: () => void
}

/** Best-effort filename sanitization for the Storage object path — strips
 * characters Cloud Storage object paths don't like, keeping the upload path
 * predictable and collision-free alongside the mediaId path segment. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// See .planning/codebase/INTEGRATIONS.md (§ Component & Composable Integration Notes (R318) -> src/composables/useMediaUpload.ts)
export function useMediaUpload(): UseMediaUploadReturn {
  const progress = ref(0)
  const error = ref<string | null>(null)
  const isUploading = ref(false)

  function reset(): void {
    progress.value = 0
    error.value = null
    isUploading.value = false
  }

  function validate(file: File): string | null {
    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')
    if (!isAudio && !isVideo) {
      return `Unsupported file type "${file.type || 'unknown'}" — only audio or video files can be attached.`
    }
    if (file.size > MEDIA_MAX_BYTES) {
      const capMb = Math.floor(MEDIA_MAX_BYTES / (1024 * 1024))
      return `File is too large (max ${capMb}MB).`
    }
    return null
  }

  function uploadMedia(file: File, orgId: string): Promise<string> {
    error.value = null

    const validationError = validate(file)
    if (validationError) {
      error.value = validationError
      return Promise.reject(new Error(validationError))
    }

    const mediaId = crypto.randomUUID()
    const path = `orgs/${orgId}/media/${mediaId}/${sanitizeFileName(file.name)}`
    const fileRef = storageRef(storage, path)
    const task = uploadBytesResumable(fileRef, file, {
      customMetadata: { createdAt: new Date().toISOString() },
    })

    isUploading.value = true
    progress.value = 0

    return new Promise<string>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          progress.value = snapshot.totalBytes > 0
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            : 0
        },
        (err) => {
          isUploading.value = false
          error.value = err instanceof Error ? err.message : 'Upload failed.'
          reject(err)
        },
        () => {
          isUploading.value = false
          getDownloadURL(task.snapshot.ref).then(resolve).catch((err) => {
            error.value = err instanceof Error ? err.message : 'Failed to resolve download URL.'
            reject(err)
          })
        },
      )
    })
  }

  return { progress, error, isUploading, uploadMedia, reset }
}
