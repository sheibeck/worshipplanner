import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useVampFileUpload } from '@/composables/useVampFileUpload'
import { useVampStore } from '@/stores/vamps'
import { VAMP_FILE_MAX_BYTES } from '@/utils/vampFiles'
import type { VampAttachment } from '@/types/vamp'

const mockUploadBytesResumable = vi.fn()
const mockGetDownloadURL = vi.fn()
const mockRef = vi.fn((..._args: unknown[]) => ({ fullPath: _args[1] as string }))

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}))

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}))

/** A fake resumable-upload task exposing the same `.on(event, next, error, complete)`
 * + `.snapshot.ref` shape as Firebase's real UploadTask. */
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

describe('useVampFileUpload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUploadBytesResumable.mockReset()
    mockGetDownloadURL.mockReset()
    mockRef.mockClear()
  })

  it('addFile with a valid MP3 creates one uploading row', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { uploads, addFile } = useVampFileUpload()
    const mp3File = makeFile('track.mp3', 'audio/mpeg', 2048)

    addFile(mp3File, { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })

    expect(uploads.value).toHaveLength(1)
    expect(uploads.value[0]).toMatchObject({ name: 'track.mp3', status: 'uploading', progress: 0 })
  })

  it('uploads to a fresh per-upload path and persists via updateVamp on completion', async () => {
    const task = makeTask('unused')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/track.mp3')
    const updateVampSpy = vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { uploads, announcement, addFile } = useVampFileUpload()
    const mp3File = makeFile('track.mp3', 'audio/mpeg', 2048)

    addFile(mp3File, { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    expect(uploads.value).toHaveLength(1)

    task._triggerProgress(50, 100)
    expect(uploads.value[0]!.progress).toBe(50)

    task._triggerComplete()
    // Duration capture races a short internal timeout (jsdom's <audio> never
    // fires loadedmetadata) before persisting — wait past it with a real timer.
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()

    expect(uploads.value).toHaveLength(0)
    expect(announcement.value).toContain('track.mp3')

    expect(updateVampSpy).toHaveBeenCalledOnce()
    const [vampId, payload] = updateVampSpy.mock.calls[0]!
    expect(vampId).toBe('vamp1')
    const attachment = (payload as { attachment: VampAttachment }).attachment
    expect(attachment.storagePath).toMatch(/^orgs\/org1\/vamp-files\/vamp1\/[^/]+\/track\.mp3$/)
    expect(attachment.downloadUrl).toBe('https://cdn.example.com/track.mp3')
    expect(attachment.fileName).toBe('track.mp3')
    expect(attachment.mimeType).toBe('audio/mpeg')
    expect(attachment.sizeBytes).toBe(2048)
    expect(attachment.createdBy).toBe('user1')
    expect(attachment.createdAt).toBeDefined()
  })

  it('two uploads for the same vamp use different uploadId path segments (replace-safety)', async () => {
    const firstTask = makeTask('unused')
    const secondTask = makeTask('unused')
    mockUploadBytesResumable
      .mockReturnValueOnce(firstTask)
      .mockReturnValueOnce(secondTask)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/track.mp3')
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { addFile } = useVampFileUpload()
    addFile(makeFile('track.mp3', 'audio/mpeg', 2048), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    firstTask._triggerComplete()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()

    addFile(makeFile('track.mp3', 'audio/mpeg', 4096), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    secondTask._triggerComplete()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()

    const firstPath = mockRef.mock.calls[0]![1] as string
    const secondPath = mockRef.mock.calls[1]![1] as string
    expect(firstPath).not.toBe(secondPath)
  })

  it('rejects a non-mp3 file with a rejected row and starts no upload', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { uploads, addFile } = useVampFileUpload()
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)

    addFile(pdfFile, { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })

    expect(uploads.value).toHaveLength(1)
    expect(uploads.value[0]!.status).toBe('rejected')
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('an editor\'s real MP3 is not blocked by an earlier rejected file', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { addFile } = useVampFileUpload()
    addFile(makeFile('cover.png', 'image/png', 1024), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    addFile(makeFile('track.mp3', 'audio/mpeg', 2048), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })

    expect(mockUploadBytesResumable).toHaveBeenCalledTimes(1)
  })

  it('rejects a file >= VAMP_FILE_MAX_BYTES with no upload started', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { uploads, addFile } = useVampFileUpload()
    const bigFile = makeFile('huge.mp3', 'audio/mpeg', VAMP_FILE_MAX_BYTES)

    addFile(bigFile, { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })

    expect(uploads.value).toHaveLength(1)
    expect(uploads.value[0]!.status).toBe('rejected')
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('sets an error row when the upload task itself errors', async () => {
    const task = makeTask('unused')
    mockUploadBytesResumable.mockReturnValue(task)
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { uploads, addFile } = useVampFileUpload()
    addFile(makeFile('track.mp3', 'audio/mpeg', 2048), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })

    task._triggerError(new Error('network error'))
    await flushPromises()

    expect(uploads.value[0]!.status).toBe('error')
  })

  it('reset() empties the uploads list', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { uploads, addFile, reset } = useVampFileUpload()
    addFile(makeFile('track.mp3', 'audio/mpeg', 2048), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    expect(uploads.value).toHaveLength(1)

    reset()
    expect(uploads.value).toHaveLength(0)
  })

  it('dismiss(id) removes a rejected row', () => {
    const { uploads, addFile, dismiss } = useVampFileUpload()
    addFile(makeFile('cover.png', 'image/png', 1024), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    expect(uploads.value).toHaveLength(1)

    dismiss(uploads.value[0]!.id)
    expect(uploads.value).toHaveLength(0)
  })

  it('duration extraction failure does not block the upload from completing and persisting', async () => {
    // jsdom's <audio> element never fires loadedmetadata — the composable
    // must tolerate that (best-effort, non-blocking) and persist with no
    // durationSec rather than hanging or rejecting the upload.
    const task = makeTask('unused')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/track.mp3')
    const updateVampSpy = vi.spyOn(useVampStore(), 'updateVamp').mockResolvedValue(undefined)

    const { addFile } = useVampFileUpload()
    addFile(makeFile('track.mp3', 'audio/mpeg', 2048), { vampId: 'vamp1', orgId: 'org1', createdBy: 'user1' })
    task._triggerComplete()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await flushPromises()

    expect(updateVampSpy).toHaveBeenCalledOnce()
    const [, payload] = updateVampSpy.mock.calls[0]!
    const attachment = (payload as { attachment: VampAttachment }).attachment
    expect(attachment.storagePath).toBeDefined()
    expect('durationSec' in attachment ? attachment.durationSec : undefined).toBeUndefined()
  })
})
