import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMediaUpload, MEDIA_MAX_BYTES } from '@/composables/useMediaUpload'

const mockUploadBytesResumable = vi.fn()
const mockGetDownloadURL = vi.fn()
const mockRef = vi.fn((..._args: unknown[]) => ({ fullPath: _args[1] as string }))

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}))

// useMediaUpload never imports firebase/firestore — it only touches Storage.
// A failed upload must never leave a Firestore write behind, and this
// composable structurally cannot make one: it has no Firestore import to call
// through, so there is nothing to mock or assert on here (a compile-time
// guarantee, not a probabilistic one — mirrors PptxImportModal.test.ts's
// `mockDeleteObject` stays-at-zero pattern for the same kind of claim).
vi.mock('@/firebase', () => ({
  storage: {},
}))

/** A fake resumable-upload task exposing the same `.on(event, next, error, complete)`
 * + `.snapshot.ref` shape as Firebase's real UploadTask, with trigger helpers a
 * test can call to simulate progress/error/completion. */
function makeTask(finalPath: string) {
  let onNext: ((snapshot: { bytesTransferred: number; totalBytes: number }) => void) | undefined
  let onError: ((err: unknown) => void) | undefined
  let onComplete: (() => void) | undefined

  return {
    on: (
      _event: string,
      next: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
      error: (err: unknown) => void,
      complete: () => void,
    ) => {
      onNext = next
      onError = error
      onComplete = complete
    },
    snapshot: { ref: { fullPath: finalPath } },
    _triggerProgress: (bytesTransferred: number, totalBytes: number) => onNext?.({ bytesTransferred, totalBytes }),
    _triggerError: (err: unknown) => onError?.(err),
    _triggerComplete: () => onComplete?.(),
  }
}

function makeFile(name: string, type: string, size: number): File {
  const file = new File([''], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('useMediaUpload', () => {
  beforeEach(() => {
    mockUploadBytesResumable.mockReset()
    mockGetDownloadURL.mockReset()
    mockRef.mockClear()
  })

  it('starts with idle reactive state', () => {
    const { progress, error, isUploading } = useMediaUpload()
    expect(progress.value).toBe(0)
    expect(error.value).toBeNull()
    expect(isUploading.value).toBe(false)
  })

  it('a valid audio file resolves to the mocked download URL and uploads under orgs/<orgId>/media/', async () => {
    const task = makeTask('orgs/org1/media/xyz/song.mp3')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/song.mp3')

    const { uploadMedia, progress, error, isUploading } = useMediaUpload()
    const file = makeFile('song.mp3', 'audio/mpeg', 1024)

    const promise = uploadMedia(file, 'org1')
    expect(isUploading.value).toBe(true)

    task._triggerProgress(50, 100)
    expect(progress.value).toBe(50)

    task._triggerComplete()
    const url = await promise

    expect(url).toBe('https://cdn.example.com/song.mp3')
    expect(error.value).toBeNull()
    expect(isUploading.value).toBe(false)

    const calledPath = mockRef.mock.calls[0]?.[1] as string
    expect(calledPath).toMatch(/^orgs\/org1\/media\//)
  })

  it('a valid video file also uploads successfully', async () => {
    const task = makeTask('orgs/org1/media/xyz/clip.mp4')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/clip.mp4')

    const { uploadMedia } = useMediaUpload()
    const file = makeFile('clip.mp4', 'video/mp4', 2048)

    const promise = uploadMedia(file, 'org1')
    task._triggerComplete()

    await expect(promise).resolves.toBe('https://cdn.example.com/clip.mp4')
  })

  it('rejects a non audio/video MIME type, sets error, and never calls uploadBytesResumable', async () => {
    const { uploadMedia, error } = useMediaUpload()
    const file = makeFile('doc.pdf', 'application/pdf', 1024)

    await expect(uploadMedia(file, 'org1')).rejects.toThrow(/Unsupported file type/)

    expect(error.value).toMatch(/Unsupported file type/)
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('rejects a file exceeding MEDIA_MAX_BYTES, sets error, and never calls uploadBytesResumable', async () => {
    const { uploadMedia, error } = useMediaUpload()
    const file = makeFile('clip.mp4', 'video/mp4', MEDIA_MAX_BYTES + 1)

    await expect(uploadMedia(file, 'org1')).rejects.toThrow(/too large/)

    expect(error.value).toMatch(/too large/)
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('sets error and rejects when the upload task itself errors, leaving isUploading false', async () => {
    const task = makeTask('orgs/org1/media/xyz/clip.mp4')
    mockUploadBytesResumable.mockReturnValue(task)

    const { uploadMedia, error, isUploading } = useMediaUpload()
    const file = makeFile('clip.mp4', 'video/mp4', 1024)

    const promise = uploadMedia(file, 'org1')
    task._triggerError(new Error('network error'))

    await expect(promise).rejects.toThrow('network error')
    expect(error.value).toBe('network error')
    expect(isUploading.value).toBe(false)
  })

  it('reset() clears progress/error/isUploading back to initial state', async () => {
    const { uploadMedia, progress, error, isUploading, reset } = useMediaUpload()
    const file = makeFile('doc.pdf', 'application/pdf', 1024)
    await expect(uploadMedia(file, 'org1')).rejects.toThrow()
    expect(error.value).not.toBeNull()

    reset()

    expect(progress.value).toBe(0)
    expect(error.value).toBeNull()
    expect(isUploading.value).toBe(false)
  })
})
