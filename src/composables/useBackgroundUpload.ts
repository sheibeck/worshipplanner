import { ref, type Ref } from 'vue'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'

/**
 * Background-image-cap constant (R055/R057, Phase 33 Plan 03) — a
 * client-side pre-validation figure that sits well under the authoritative
 * server-side cap for this prefix. `orgs/{orgId}/backgrounds/**` does NOT
 * match `storage.rules`' dedicated `orgs/{orgId}/media/{allPaths=**}` block
 * (that block's 50MB cap is `useMediaUpload`'s, not this one's) — it falls
 * through to the generic `orgs/{orgId}/{allPaths=**}` catch-all, which caps
 * at 25MB. 10MB is well under that, so no `storage.rules` change is needed
 * or in scope for this phase (33-RESEARCH.md § Research Question 1).
 */
export const BACKGROUND_MAX_BYTES = 10485760

export interface UseBackgroundUploadReturn {
  /** Reactive percent-complete (0-100) of the in-flight upload. */
  progress: Ref<number>
  /** Reactive error message from validation or a failed upload. Null when no error. */
  error: Ref<string | null>
  /** True while an upload is in flight. */
  isUploading: Ref<boolean>
  /**
   * Validates and uploads a single image file to
   * `orgs/{orgId}/backgrounds/{backgroundId}/{sanitizedFileName}` via a
   * resumable upload, resolving to its download URL. Rejects (and sets
   * `error`) without ever writing to Firestore or touching slide/group/song
   * metadata — upload is fully decoupled from the scoped store write, so a
   * failed upload can never lose or corrupt background data (mirrors
   * `useMediaUpload`'s same separation).
   */
  uploadBackground: (file: File, orgId: string) => Promise<string>
  /** Clears progress/error/isUploading back to their initial state. */
  reset: () => void
}

/** Best-effort filename sanitization for the Storage object path — strips
 * characters Cloud Storage object paths don't like, keeping the upload path
 * predictable and collision-free alongside the backgroundId path segment.
 * No maximum length is imposed (33-03-PLAN.md's flagged, deliberate
 * assumption — display-side `truncate` is the whole mitigation for a very
 * long original filename). */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Firebase Storage upload composable for background images (R055/R057,
 * Phase 33 Plan 03). Mirrors `useMediaUpload.ts`'s resumable-upload +
 * createdAt-custom-metadata pattern, reactively, diverging on exactly three
 * points: MIME check (`image/*` only), size cap (10MB, not 50MB), and the
 * Storage path prefix (`backgrounds/`, not `media/`).
 *
 * The `backgrounds/` prefix matters beyond naming: the deployed
 * `cleanupExpiredMedia` Cloud Function's path guard
 * (`functions/src/index.ts:241`, `MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//`)
 * matches only the `media/` prefix, so an object written under
 * `backgrounds/` is structurally exempt from the 14-day sweep — a background
 * written to `media/` instead would silently vanish two weeks after being
 * set. The `backgrounds/` prefix falls into `storage.rules`' existing
 * generic `orgs/{orgId}/{allPaths=**}` catch-all (25MB cap, same
 * org-membership auth check as `media/`), so no `storage.rules` change is in
 * scope for this phase.
 *
 * Validates MIME type (`image/*`) and size (<= BACKGROUND_MAX_BYTES) BEFORE
 * any upload begins — an invalid file rejects immediately without calling
 * into Storage at all.
 */
export function useBackgroundUpload(): UseBackgroundUploadReturn {
  const progress = ref(0)
  const error = ref<string | null>(null)
  const isUploading = ref(false)

  function reset(): void {
    progress.value = 0
    error.value = null
    isUploading.value = false
  }

  function validate(file: File): string | null {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      return `Unsupported file type "${file.type || 'unknown'}" — only images can be set as a background.`
    }
    if (file.size > BACKGROUND_MAX_BYTES) {
      const capMb = Math.floor(BACKGROUND_MAX_BYTES / (1024 * 1024))
      return `File is too large (max ${capMb}MB).`
    }
    return null
  }

  function uploadBackground(file: File, orgId: string): Promise<string> {
    error.value = null

    const validationError = validate(file)
    if (validationError) {
      error.value = validationError
      return Promise.reject(new Error(validationError))
    }

    const backgroundId = crypto.randomUUID()
    const path = `orgs/${orgId}/backgrounds/${backgroundId}/${sanitizeFileName(file.name)}`
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

  return { progress, error, isUploading, uploadBackground, reset }
}
