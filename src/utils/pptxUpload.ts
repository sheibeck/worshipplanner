import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'

/**
 * Client-side upload helpers for the PPTX/image import flow (Phase 21, R010/R011).
 * Uploads always land under orgs/{orgId}/pptx-imports/{importId}/... so
 * storage.rules' org-membership gate governs every read/write, and every
 * uploaded object carries a createdAt custom metadata field so Phase 22's
 * future retention sweep can consume it without a follow-up migration.
 *
 * These helpers only ever write to Storage. They never delete anything —
 * deletion (even on parse failure) is explicitly out of scope per CONTEXT's
 * error-handling contract; Phase 22 owns cleanup.
 */

/** Generates a fresh client-side unique id for a single import "session",
 * matching the crypto.randomUUID() convention used elsewhere in this
 * codebase (see src/utils/csvImport.ts's per-arrangement ids). This id
 * scopes the Storage path only — it is distinct from the Firestore-assigned
 * id the importedSlides store returns from createDeck() on confirm. */
export function generateImportId(): string {
  return crypto.randomUUID()
}

/**
 * Uploads a .pptx file to orgs/{orgId}/pptx-imports/{importId}/source.pptx
 * via a resumable upload, reporting percent-complete through onProgress on
 * every state_changed snapshot. Resolves to the uploaded object's Storage
 * path (never a signed URL — parsePptx receives this path directly).
 */
export function uploadPptx(
  orgId: string,
  importId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, `orgs/${orgId}/pptx-imports/${importId}/source.pptx`)
  const task = uploadBytesResumable(storageRef, file, {
    customMetadata: { createdAt: new Date().toISOString() },
  })

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const percent = snapshot.totalBytes > 0
          ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          : 0
        onProgress(percent)
      },
      (err) => reject(err),
      () => resolve(task.snapshot.ref.fullPath),
    )
  })
}

/** Best-effort file extension for an image upload's Storage path, preferring
 * the original filename's extension and falling back to the MIME subtype. */
function inferImageExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length > 0 && fromName.length <= 5 && fromName !== file.name) {
    return fromName.toLowerCase()
  }
  const fromType = file.type.split('/').pop()
  return fromType && fromType.length > 0 ? fromType.toLowerCase() : 'bin'
}

/**
 * Uploads a single image to orgs/{orgId}/pptx-imports/{importId}/images/{index}.{ext}
 * with createdAt custom metadata. Used by the image-only import mode (no PPTX
 * parsing involved) to build ImageSlide objects entirely client-side.
 * Resolves to the uploaded object's Storage path.
 */
export async function uploadImage(
  orgId: string,
  importId: string,
  file: File,
  index: number,
): Promise<string> {
  const ext = inferImageExtension(file)
  const storageRef = ref(storage, `orgs/${orgId}/pptx-imports/${importId}/images/${index}.${ext}`)
  const result = await uploadBytes(storageRef, file, {
    customMetadata: { createdAt: new Date().toISOString() },
  })
  return result.ref.fullPath
}

/**
 * Resolves a Storage path (as returned by parsePptx for ImageSlide.imageUrl,
 * or produced directly by uploadImage) to a display URL via getDownloadURL —
 * so image display is governed by storage.rules, never a long-lived signed
 * URL minted server-side.
 */
export async function resolveImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}
