import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'

/**
 * Client-side upload helpers for the PPTX/image import flow (Phase 21, R010/R011).
 * See .planning/codebase/CONCERNS.md (Utils Concern Notes — src/utils/pptxUpload.ts)
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
 * 25MB — the SAME ceiling `storage.rules` enforces on the generic
 * `orgs/{orgId}/{allPaths=**}` match (`request.resource.size < 26214400`).
 * ★ These two numbers must stay in lockstep — if you raise one, raise the
 * other, or an over-cap upload fails with a permission-shaped Storage error
 * indistinguishable from a real auth failure.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/pptxUpload.ts)
 */
export const PPTX_MAX_BYTES = 26214400

/**
 * Thrown when a file exceeds PPTX_MAX_BYTES — a distinct class so
 * `PptxImportModal.vue`'s catch block can branch on it.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/pptxUpload.ts)
 */
export class PptxFileTooLargeError extends Error {
  readonly fileSize: number
  readonly maxBytes: number

  constructor(message: string, fileSize: number) {
    super(message)
    this.name = 'PptxFileTooLargeError'
    this.fileSize = fileSize
    this.maxBytes = PPTX_MAX_BYTES
  }
}

/**
 * Narrows an unknown caught value to a too-large error, by NAME rather than
 * `instanceof` — an `instanceof` check would throw under a `vi.mock`
 * full-replacement factory (the exported class binding is `undefined` there).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/pptxUpload.ts)
 */
export function isPptxFileTooLarge(err: unknown): err is PptxFileTooLargeError {
  return err instanceof Error && err.name === 'PptxFileTooLargeError'
}

/**
 * Returns a human-readable reason the file cannot be uploaded, or `null` if it
 * is acceptable. Checked BEFORE any Storage call, so an oversized file never
 * starts a resumable session and never produces a permission-shaped error.
 */
export function validatePptxSize(file: File): string | null {
  if (file.size > PPTX_MAX_BYTES) {
    const capMb = Math.floor(PPTX_MAX_BYTES / (1024 * 1024))
    const fileMb = (file.size / (1024 * 1024)).toFixed(1)
    return `This file is ${fileMb}MB, over the ${capMb}MB limit. Try removing large images or splitting the deck.`
  }
  return null
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
  // Reject over-cap files here rather than letting storage.rules do it — the
  // rule's rejection is indistinguishable from an auth failure. See
  // PPTX_MAX_BYTES above.
  const sizeError = validatePptxSize(file)
  if (sizeError) return Promise.reject(new PptxFileTooLargeError(sizeError, file.size))

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
  // Same 25MB cap and same reasoning as uploadPptx: images/ lands under the
  // identical storage.rules match, so an over-cap image would fail with the
  // same permission-shaped error.
  const sizeError = validatePptxSize(file)
  if (sizeError) throw new PptxFileTooLargeError(sizeError, file.size)

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
