import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSongFileUpload } from '@/composables/useSongFileUpload'
import { useSongStore } from '@/stores/songs'
import { SONG_FILE_MAX_BYTES } from '@/utils/songFiles'
import type { SongAttachment } from '@/types/song'

const mockUploadBytesResumable = vi.fn()
const mockGetDownloadURL = vi.fn()
const mockRef = vi.fn((..._args: unknown[]) => ({ fullPath: _args[1] as string }))

vi.mock('firebase/storage', () => ({
  ref: (...args: unknown[]) => mockRef(...args),
  uploadBytesResumable: (...args: unknown[]) => mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}))

// useSongFileUpload persists via useSongStore().updateSong — the store is
// mocked at the method level (vi.spyOn), so its own firebase/firestore
// imports never execute; only @/firebase needs a stub for the module graph.
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}))

/** A fake resumable-upload task exposing the same `.on(event, next, error, complete)`
 * + `.snapshot.ref` shape as Firebase's real UploadTask, mirroring useMediaUpload.test.ts. */
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

describe('useSongFileUpload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUploadBytesResumable.mockReset()
    mockGetDownloadURL.mockReset()
    mockRef.mockClear()
  })

  it('addFiles with two valid files creates two uploading rows with correct kind', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const { uploads, addFiles } = useSongFileUpload()
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)
    const mp3File = makeFile('track.mp3', 'audio/mpeg', 2048)

    addFiles([pdfFile, mp3File], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: [],
    })

    expect(uploads.value).toHaveLength(2)
    expect(uploads.value[0]).toMatchObject({ name: 'song.pdf', kind: 'document', status: 'uploading', progress: 0 })
    expect(uploads.value[1]).toMatchObject({ name: 'track.mp3', kind: 'audio', status: 'uploading', progress: 0 })
  })

  it('state_changed updates each row\'s progress independently, and completion marks it done', async () => {
    const pdfTask = makeTask('orgs/org1/song-files/id1/song.pdf')
    const mp3Task = makeTask('orgs/org1/song-files/id2/track.mp3')
    mockUploadBytesResumable
      .mockReturnValueOnce(pdfTask)
      .mockReturnValueOnce(mp3Task)
    mockGetDownloadURL
      .mockResolvedValueOnce('https://cdn.example.com/song.pdf')
      .mockResolvedValueOnce('https://cdn.example.com/track.mp3')
    const updateSongSpy = vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const { uploads, addFiles } = useSongFileUpload()
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)
    const mp3File = makeFile('track.mp3', 'audio/mpeg', 2048)

    addFiles([pdfFile, mp3File], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: [],
    })

    pdfTask._triggerProgress(50, 100)
    expect(uploads.value[0].progress).toBe(50)
    expect(uploads.value[1].progress).toBe(0)

    pdfTask._triggerComplete()
    await flushPromises()

    expect(uploads.value[0].status).toBe('done')
    expect(uploads.value[1].status).toBe('uploading')

    mp3Task._triggerProgress(100, 100)
    expect(uploads.value[1].progress).toBe(100)

    mp3Task._triggerComplete()
    await flushPromises()

    expect(uploads.value[1].status).toBe('done')

    // Both attachments must be present in the final persisted array regardless
    // of finish order (last write carries the running batch accumulator).
    const lastCall = updateSongSpy.mock.calls[updateSongSpy.mock.calls.length - 1]
    expect(lastCall[0]).toBe('song1')
    const attachments = (lastCall[1] as { attachments: SongAttachment[] }).attachments
    expect(attachments).toHaveLength(2)
    const names = attachments.map((a) => a.name).sort()
    expect(names).toEqual(['song.pdf', 'track.mp3'])

    const pdfAttachment = attachments.find((a) => a.name === 'song.pdf')!
    expect(pdfAttachment.kind).toBe('document')
    expect(pdfAttachment.storagePath).toContain('orgs/org1/song-files/')
    expect(pdfAttachment.downloadUrl).toBe('https://cdn.example.com/song.pdf')
    expect(pdfAttachment.mimeType).toBe('application/pdf')
    expect(pdfAttachment.sizeBytes).toBe(1024)
    expect(pdfAttachment.createdBy).toBe('user1')
    expect(pdfAttachment.createdAt).toBeDefined()

    const mp3Attachment = attachments.find((a) => a.name === 'track.mp3')!
    expect(mp3Attachment.kind).toBe('audio')
    expect(mp3Attachment.mimeType).toBe('audio/mpeg')
  })

  it('preserves existingAttachments on every completion write', async () => {
    const task = makeTask('orgs/org1/song-files/id1/song.pdf')
    mockUploadBytesResumable.mockReturnValue(task)
    mockGetDownloadURL.mockResolvedValue('https://cdn.example.com/song.pdf')
    const updateSongSpy = vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const existing: SongAttachment[] = [{
      id: 'existing-1',
      kind: 'link',
      name: 'Old link',
      href: 'https://youtu.be/x',
      linkSource: 'youtube',
      createdAt: {} as SongAttachment['createdAt'],
      createdBy: 'user1',
    }]

    const { addFiles } = useSongFileUpload()
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)

    addFiles([pdfFile], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: existing,
    })

    task._triggerComplete()
    await flushPromises()

    const lastCall = updateSongSpy.mock.calls[updateSongSpy.mock.calls.length - 1]
    const attachments = (lastCall[1] as { attachments: SongAttachment[] }).attachments
    expect(attachments).toHaveLength(2)
    expect(attachments[0]).toBe(existing[0])
  })

  it('rejects a wrong-type file with the exact UI-SPEC copy and starts no upload, while a valid file in the same batch still uploads', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const { uploads, addFiles } = useSongFileUpload()
    const pngFile = makeFile('cover.png', 'image/png', 1024)
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)

    addFiles([pngFile, pdfFile], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: [],
    })

    expect(uploads.value).toHaveLength(2)
    const rejectedRow = uploads.value.find((u) => u.name === 'cover.png')!
    expect(rejectedRow.status).toBe('rejected')
    expect(rejectedRow.message).toBe("'cover.png' can't be uploaded — PDF and MP3 only, up to 50 MB.")

    const uploadingRow = uploads.value.find((u) => u.name === 'song.pdf')!
    expect(uploadingRow.status).toBe('uploading')

    // Exactly one upload started (for the valid pdf) — the rejected png never
    // reached uploadBytesResumable.
    expect(mockUploadBytesResumable).toHaveBeenCalledTimes(1)
  })

  it('rejects a >50MB file with the exact UI-SPEC copy and starts no upload', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const { uploads, addFiles } = useSongFileUpload()
    const bigFile = makeFile('huge.mp3', 'audio/mpeg', SONG_FILE_MAX_BYTES + 1)

    addFiles([bigFile], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: [],
    })

    expect(uploads.value).toHaveLength(1)
    expect(uploads.value[0].status).toBe('rejected')
    expect(uploads.value[0].message).toBe("'huge.mp3' is too large — max 50 MB.")
    expect(mockUploadBytesResumable).not.toHaveBeenCalled()
  })

  it('sets an error row and message when the upload task itself errors', async () => {
    const task = makeTask('orgs/org1/song-files/id1/song.pdf')
    mockUploadBytesResumable.mockReturnValue(task)
    vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const { uploads, addFiles } = useSongFileUpload()
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)

    addFiles([pdfFile], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: [],
    })

    task._triggerError(new Error('network error'))
    await flushPromises()

    expect(uploads.value[0].status).toBe('error')
    expect(uploads.value[0].message).toBe('Upload failed. Check your connection and try again.')
  })

  it('reset() empties the uploads list', () => {
    mockUploadBytesResumable.mockReturnValue(makeTask('unused'))
    vi.spyOn(useSongStore(), 'updateSong').mockResolvedValue(undefined)

    const { uploads, addFiles, reset } = useSongFileUpload()
    const pdfFile = makeFile('song.pdf', 'application/pdf', 1024)

    addFiles([pdfFile], {
      songId: 'song1',
      orgId: 'org1',
      createdBy: 'user1',
      existingAttachments: [],
    })
    expect(uploads.value).toHaveLength(1)

    reset()
    expect(uploads.value).toHaveLength(0)
  })
})
