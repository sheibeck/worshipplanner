import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBackgroundUpload, BACKGROUND_MAX_BYTES } from '@/composables/useBackgroundUpload'

const mockUploadBytesResumable = vi.fn()
const mockGetDownloadURL = vi.fn()
const mockRef = vi.fn((..._args: unknown[]) => ({ fullPath: _args[1] as string }))

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}))

// useBackgroundUpload never imports firebase/firestore — it only touches
// Storage. A failed upload must never leave a Firestore write behind, and
// this composable structurally cannot make one: it has no Firestore import
// to call through, so there is nothing to mock or assert on here (mirrors
// useMediaUpload.test.ts's same compile-time guarantee).
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

describe('useBackgroundUpload', () => {
  beforeEach(() => {
    mockUploadBytesResumable.mockReset()
    mockGetDownloadURL.mockReset()
    mockRef.mockClear()
  })

  it('starts with idle reactive state', () => {
    const { progress, error, isUploading } = useBackgroundUpload()
    expect(progress.value).toBe(0)
    expect(error.value).toBeNull()
    expect(isUploading.value).toBe(false)
  })

  it('a valid image file resolves to the mocked download URL and uploads under orgs/<orgId>/backgrounds/<uuid>/<sanitized-filename>', async () => {
    const task = makeTask('orgs/org1/backgrounds/xyz/sunset.jpg')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/sunset.jpg')

    const { uploadBackground, progress, error, isUploading } = useBackgroundUpload()
    const file = makeFile('sunset.jpg', 'image/jpeg', 1024)

    const promise = uploadBackground(file, 'org1')
    expect(isUploading.value).toBe(true)

    task._triggerProgress(50, 100)
    expect(progress.value).toBe(50)

    task._triggerComplete()
    const url = await promise

    expect(url).toBe('https://cdn.example.com/sunset.jpg')
    expect(error.value).toBeNull()
    expect(isUploading.value).toBe(false)

    const calledPath = mockRef.mock.calls[0]?.[1] as string
    expect(calledPath).toMatch(
      /^orgs\/org1\/backgrounds\/[0-9a-f-]+\/sunset\.jpg$/,
    )
  })

  it('sanitizes disallowed characters in the filename within the object path', async () => {
    const task = makeTask('orgs/org1/backgrounds/xyz/weird.jpg')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/weird.jpg')

    const { uploadBackground } = useBackgroundUpload()
    const file = makeFile('my photo (final)!.jpg', 'image/jpeg', 1024)

    const promise = uploadBackground(file, 'org1')
    task._triggerComplete()
    await promise

    const calledPath = mockRef.mock.calls[0]?.[1] as string
    expect(calledPath).toMatch(/^orgs\/org1\/backgrounds\/[0-9a-f-]+\/my_photo__final__\.jpg$/)
  })

  it('does not truncate or reject a very long filename', async () => {
    const task = makeTask('orgs/org1/backgrounds/xyz/long.jpg')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/long.jpg')

    const { uploadBackground } = useBackgroundUpload()
    const longName = `${'a'.repeat(300)}.jpg`
    const file = makeFile(longName, 'image/jpeg', 1024)

    const promise = uploadBackground(file, 'org1')
    task._triggerComplete()
    await expect(promise).resolves.toBe('https://cdn.example.com/long.jpg')

    const calledPath = mockRef.mock.calls[0]?.[1] as string
    expect(calledPath).toContain(longName)
  })

  it('rejects a non-image MIME type with the exact copy, sets error, and never calls uploadBytesResumable', async () => {
    const { uploadBackground, error } = useBackgroundUpload()
    const file = makeFile('doc.txt', 'text/plain', 1024)

    await expect(uploadBackground(file, 'org1')).rejects.toThrow(
      'Unsupported file type "text/plain" — only images can be set as a background.',
    )

    expect(error.value).toBe('Unsupported file type "text/plain" — only images can be set as a background.')
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('rejects a file with an empty MIME type, substituting "unknown"', async () => {
    const { uploadBackground, error } = useBackgroundUpload()
    const file = makeFile('mystery', '', 1024)

    await expect(uploadBackground(file, 'org1')).rejects.toThrow(/only images can be set as a background/)
    expect(error.value).toBe('Unsupported file type "unknown" — only images can be set as a background.')
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('rejects a file exceeding BACKGROUND_MAX_BYTES with the exact copy, sets error, and never calls uploadBytesResumable', async () => {
    const { uploadBackground, error } = useBackgroundUpload()
    const file = makeFile('big.png', 'image/png', BACKGROUND_MAX_BYTES + 1)

    await expect(uploadBackground(file, 'org1')).rejects.toThrow('File is too large (max 10MB).')

    expect(error.value).toBe('File is too large (max 10MB).')
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('sets error and rejects when the upload task itself errors, leaving isUploading false', async () => {
    const task = makeTask('orgs/org1/backgrounds/xyz/clip.jpg')
    mockUploadBytesResumable.mockReturnValue(task)

    const { uploadBackground, error, isUploading } = useBackgroundUpload()
    const file = makeFile('clip.jpg', 'image/jpeg', 1024)

    const promise = uploadBackground(file, 'org1')
    task._triggerError(new Error('network error'))

    await expect(promise).rejects.toThrow('network error')
    expect(error.value).toBe('network error')
    expect(isUploading.value).toBe(false)
  })

  it('reset() clears progress/error/isUploading back to initial state', async () => {
    const { uploadBackground, progress, error, isUploading, reset } = useBackgroundUpload()
    const file = makeFile('doc.txt', 'text/plain', 1024)
    await expect(uploadBackground(file, 'org1')).rejects.toThrow()
    expect(error.value).not.toBeNull()

    reset()

    expect(progress.value).toBe(0)
    expect(error.value).toBeNull()
    expect(isUploading.value).toBe(false)
  })
})
