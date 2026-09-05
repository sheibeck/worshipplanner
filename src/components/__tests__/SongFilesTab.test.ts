import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import SongFilesTab from '../SongFilesTab.vue'
import SongFilePreviewModal from '../SongFilePreviewModal.vue'
import { useSongStore } from '@/stores/songs'
import type { SongAttachment } from '@/types/song'
import type { UploadRow } from '@/composables/useSongFileUpload'

// SongFilesTab persists link-attach via useSongStore().addSongAttachment —
// the store itself is spied at the method level, so its own
// firebase/firestore imports never execute; only @/firebase needs a stub for
// the module graph (mirrors useSongFileUpload.test.ts's convention).
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}))

const mockUploads = ref<UploadRow[]>([])
const mockAddFiles = vi.fn()
const mockReset = vi.fn()

vi.mock('@/composables/useSongFileUpload', () => ({
  useSongFileUpload: () => ({
    uploads: mockUploads,
    addFiles: mockAddFiles,
    reset: mockReset,
  }),
}))

function makeAttachment(overrides: Partial<SongAttachment> = {}): SongAttachment {
  return {
    id: 'att-1',
    kind: 'document',
    name: 'chart.pdf',
    storagePath: 'orgs/org-1/song-files/att-1/chart.pdf',
    downloadUrl: 'https://cdn.example.com/chart.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2516582, // 2.4 MB
    createdAt: {} as SongAttachment['createdAt'],
    createdBy: 'user-1',
    ...overrides,
  }
}

/** A createdAt fixture with a callable toDate() — mirrors the real Firestore
 * Timestamp shape closely enough for formatAttachmentDate()'s guard. Uses
 * local noon (not a bare date-only ISO string, which parses as UTC midnight
 * and can render as the previous day once toLocaleDateString applies a
 * negative-offset timezone) so the assertion date is stable everywhere. */
function makeTimestamp(isoDate: string): SongAttachment['createdAt'] {
  return { toDate: () => new Date(`${isoDate}T12:00:00`) } as SongAttachment['createdAt']
}

function mountTab(attachments: SongAttachment[] = []) {
  return mount(SongFilesTab, {
    props: {
      songId: 'song-1',
      orgId: 'org-1',
      createdBy: 'user-1',
      attachments,
    },
  })
}

describe('SongFilesTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockUploads.value = []
    mockAddFiles.mockClear()
    mockReset.mockClear()
  })

  it('renders the drop zone with exact primary and helper copy', () => {
    const wrapper = mountTab()
    const dropzone = wrapper.find('[data-testid="song-files-dropzone"]')
    expect(dropzone.exists()).toBe(true)
    expect(dropzone.text()).toContain('Drop files here, or click to browse')
    expect(dropzone.text()).toContain('PDF, MP3 · up to 50 MB each · several at once')
  })

  it('renders a hidden multi-file input accepting PDF and MP3', () => {
    const wrapper = mountTab()
    const input = wrapper.find('[data-testid="song-files-input"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('file')
    expect(input.attributes('multiple')).toBeDefined()
    expect(input.attributes('accept')).toBe('.pdf,audio/mpeg')
  })

  it('clicking the drop zone triggers the hidden file input', async () => {
    const wrapper = mountTab()
    const input = wrapper.find('[data-testid="song-files-input"]').element as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    await wrapper.find('[data-testid="song-files-dropzone"]').trigger('click')
    expect(clickSpy).toHaveBeenCalled()
  })

  it('picking files via the input calls addFiles with the upload context', async () => {
    const wrapper = mountTab([makeAttachment({ id: 'existing-1' })])
    const input = wrapper.find('[data-testid="song-files-input"]')
    const file = new File(['x'], 'song.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    expect(mockAddFiles).toHaveBeenCalledTimes(1)
    const [files, ctx] = mockAddFiles.mock.calls[0]!
    expect(Array.from(files as FileList | File[])).toEqual([file])
    // CR-01: the upload context no longer carries existingAttachments — the
    // composable persists via the store's atomic addSongAttachment append,
    // not a read-modify-write of a captured snapshot.
    expect(ctx).toEqual({
      songId: 'song-1',
      orgId: 'org-1',
      createdBy: 'user-1',
    })
  })

  it('dropping files calls addFiles and clears the drag-over state', async () => {
    const wrapper = mountTab()
    const file = new File(['x'], 'track.mp3', { type: 'audio/mpeg' })
    const dropzone = wrapper.find('[data-testid="song-files-dropzone"]')

    await dropzone.trigger('dragover')
    expect(dropzone.classes().join(' ')).toContain('border-indigo-500')

    await dropzone.trigger('drop', { dataTransfer: { files: [file] } })
    expect(mockAddFiles).toHaveBeenCalledTimes(1)
    expect(dropzone.classes().join(' ')).not.toContain('border-indigo-500')
  })

  it('renders the link field with exact label, placeholder, and helper copy', () => {
    const wrapper = mountTab()
    const input = wrapper.find('[data-testid="song-files-link-input"]')
    expect(wrapper.text()).toContain('Or link instead of uploading')
    expect(input.attributes('placeholder')).toBe('Paste a YouTube, Google Drive, or Dropbox link')
    expect(wrapper.text()).toContain('Opens in a new tab when clicked — not previewed in-app.')
  })

  it('submitting an invalid link shows the exact error and persists nothing', async () => {
    const addAttachmentSpy = vi.spyOn(useSongStore(), 'addSongAttachment').mockResolvedValue(undefined)
    const wrapper = mountTab()
    const input = wrapper.find('[data-testid="song-files-link-input"]')
    await input.setValue('not-a-url')
    await input.trigger('keydown.enter')

    expect(wrapper.find('[data-testid="song-files-link-error"]').text()).toBe(
      'Enter a valid link (starting with https://).',
    )
    expect(addAttachmentSpy).not.toHaveBeenCalled()
  })

  it('submitting a valid https link appends a kind:link attachment via the atomic addSongAttachment and clears the field', async () => {
    // CR-01: submitLink() now calls the atomic arrayUnion-based
    // addSongAttachment(songId, attachment) — a single new attachment, not a
    // read-modify-write of props.attachments — so an overlapping upload
    // completion can't be clobbered by this write (or vice versa).
    const addAttachmentSpy = vi.spyOn(useSongStore(), 'addSongAttachment').mockResolvedValue(undefined)
    const existing = [makeAttachment({ id: 'existing-1' })]
    const wrapper = mountTab(existing)
    const input = wrapper.find('[data-testid="song-files-link-input"]')
    await input.setValue('https://youtu.be/abc123')
    await input.trigger('keydown.enter')

    expect(addAttachmentSpy).toHaveBeenCalledTimes(1)
    const [songId, attachment] = addAttachmentSpy.mock.calls[0]!
    expect(songId).toBe('song-1')
    expect(attachment as SongAttachment).toMatchObject({
      kind: 'link',
      href: 'https://youtu.be/abc123',
      linkSource: 'youtube',
    })

    expect((input.element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-testid="song-files-link-error"]').exists()).toBe(false)
  })

  it('renders a document row grouped under Documents with graceful metadata and a Download action', () => {
    const doc = makeAttachment({
      id: 'doc-1',
      kind: 'document',
      name: 'chart.pdf',
      sizeBytes: 2516582, // 2.4 MB
      downloadUrl: 'https://cdn.example.com/chart.pdf',
      createdAt: makeTimestamp('2026-09-05'),
    })
    const wrapper = mountTab([doc])
    const group = wrapper.find('[data-testid="song-files-group-documents"]')
    const row = group.find('[data-testid="song-file-row-doc-1"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('chart.pdf')
    expect(row.find('[data-testid="song-file-meta"]').text()).toBe('PDF · 2.4 MB · Sep 5, 2026')
    const download = row.find('[data-testid="song-file-download"]')
    expect(download.exists()).toBe(true)
    // FIX A: a <button>, not an <a href download> — see the dedicated
    // "Download action" describe block below for why (cross-origin Storage
    // URLs make the HTML download attribute a no-op).
    expect(download.element.tagName).toBe('BUTTON')
    expect(download.attributes('aria-label')).toBe('Download chart.pdf')
    expect(row.find('[data-testid="song-file-open-link"]').exists()).toBe(false)
  })

  it('renders a link row folded into Documents with an Open-in-new-tab action and no Download', () => {
    const link = makeAttachment({
      id: 'link-1',
      kind: 'link',
      name: 'Reference track',
      href: 'https://youtu.be/xyz',
      linkSource: 'youtube',
      storagePath: undefined,
      downloadUrl: undefined,
      mimeType: undefined,
      sizeBytes: undefined,
      createdAt: makeTimestamp('2026-09-05'),
    })
    const wrapper = mountTab([link])
    const group = wrapper.find('[data-testid="song-files-group-documents"]')
    const row = group.find('[data-testid="song-file-row-link-1"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Reference track')
    expect(row.find('[data-testid="song-file-meta"]').text()).toBe('YouTube link · Sep 5, 2026')
    expect(row.find('[data-testid="song-file-download"]').exists()).toBe(false)
    const openLink = row.find('[data-testid="song-file-open-link"]')
    expect(openLink.exists()).toBe(true)
    expect(openLink.attributes('href')).toBe('https://youtu.be/xyz')
    expect(openLink.attributes('target')).toBe('_blank')
    expect(openLink.attributes('rel')).toContain('noopener')
  })

  it('renders an audio row with MP3 metadata and a Download action', () => {
    const track = makeAttachment({
      id: 'track-1',
      kind: 'audio',
      name: 'demo.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 5348147, // ~5.1 MB
      storagePath: 'orgs/org-1/song-files/track-1/demo.mp3',
      downloadUrl: 'https://cdn.example.com/demo.mp3',
      createdAt: makeTimestamp('2026-09-05'),
    })
    const wrapper = mountTab([track])
    const group = wrapper.find('[data-testid="song-files-group-audio"]')
    const row = group.find('[data-testid="song-file-row-track-1"]')
    expect(row.exists()).toBe(true)
    expect(row.find('[data-testid="song-file-meta"]').text()).toBe('MP3 · 5.1 MB · Sep 5, 2026')
    const download = row.find('[data-testid="song-file-download"]')
    expect(download.exists()).toBe(true)
    expect(download.element.tagName).toBe('BUTTON')
    expect(download.attributes('aria-label')).toBe('Download demo.mp3')
  })

  it('R366: splits attachments into a Documents group (document + link) and an Audio group (audio)', () => {
    const doc = makeAttachment({ id: 'doc-1', kind: 'document' })
    const track = makeAttachment({ id: 'track-1', kind: 'audio', name: 'demo.mp3', mimeType: 'audio/mpeg' })
    const link = makeAttachment({ id: 'link-1', kind: 'link', name: 'Ref', href: 'https://youtu.be/x', linkSource: 'youtube' })
    const wrapper = mountTab([doc, track, link])

    const documentsGroup = wrapper.find('[data-testid="song-files-group-documents"]')
    expect(documentsGroup.find('[data-testid="song-file-row-doc-1"]').exists()).toBe(true)
    expect(documentsGroup.find('[data-testid="song-file-row-link-1"]').exists()).toBe(true)
    expect(documentsGroup.find('[data-testid="song-file-row-track-1"]').exists()).toBe(false)

    const audioGroup = wrapper.find('[data-testid="song-files-group-audio"]')
    expect(audioGroup.find('[data-testid="song-file-row-track-1"]').exists()).toBe(true)
    expect(audioGroup.find('[data-testid="song-file-row-doc-1"]').exists()).toBe(false)
  })

  it('R366: both groups always render, with the exact per-group empty copy when attachments is empty', () => {
    const wrapper = mountTab([])
    expect(wrapper.find('[data-testid="song-files-group-documents"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="song-files-documents-empty"]').text()).toBe('No documents attached yet.')
    expect(wrapper.find('[data-testid="song-files-group-audio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="song-files-audio-empty"]').text()).toBe('No audio files attached yet.')
  })

  it('gracefully omits the date when createdAt has no callable toDate() — no "Invalid Date", no "undefined", no dangling separator', () => {
    const doc = makeAttachment({
      id: 'doc-1',
      kind: 'document',
      sizeBytes: 2516582,
      createdAt: {} as SongAttachment['createdAt'],
    })
    const wrapper = mountTab([doc])
    const meta = wrapper.find('[data-testid="song-file-meta"]')
    expect(meta.text()).toBe('PDF · 2.4 MB')
    expect(meta.text()).not.toContain('Invalid Date')
    expect(meta.text()).not.toContain('undefined')
    expect(meta.text()).not.toContain('NaN')
  })

  it('renders an in-flight upload row with a progress bar and percent', () => {
    mockUploads.value = [
      { id: 'u1', name: 'uploading.pdf', kind: 'document', progress: 42, status: 'uploading' },
    ]
    const wrapper = mountTab()
    const rows = wrapper.find('[data-testid="song-files-upload-rows"]')
    expect(rows.text()).toContain('uploading.pdf')
    expect(rows.text()).toContain('42%')
    const fill = rows.find('.bg-indigo-500')
    expect(fill.exists()).toBe(true)
    expect((fill.element as HTMLElement).style.width).toBe('42%')
  })

  it('IN-01: announces batch-completion count via a visually-hidden aria-live region', () => {
    mockUploads.value = [
      { id: 'u1', name: 'a.pdf', kind: 'document', progress: 100, status: 'done' },
      { id: 'u2', name: 'b.pdf', kind: 'document', progress: 40, status: 'uploading' },
    ]
    const wrapper = mountTab()
    const status = wrapper.find('[data-testid="song-files-upload-status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.classes()).toContain('sr-only')
    expect(status.text()).toBe('1 of 2 files uploaded.')
  })

  it('IN-01: the aria-live region is empty before any file has completed', () => {
    mockUploads.value = [
      { id: 'u1', name: 'a.pdf', kind: 'document', progress: 10, status: 'uploading' },
    ]
    const wrapper = mountTab()
    const status = wrapper.find('[data-testid="song-files-upload-status"]')
    expect(status.text()).toBe('')
  })

  it('renders a rejected upload row with its red rejection message', () => {
    mockUploads.value = [
      {
        id: 'u2',
        name: 'cover.png',
        kind: 'document',
        progress: 0,
        status: 'rejected',
        message: "'cover.png' can't be uploaded — PDF and MP3 only, up to 50 MB.",
      },
    ]
    const wrapper = mountTab()
    const rows = wrapper.find('[data-testid="song-files-upload-rows"]')
    expect(rows.text()).toContain("'cover.png' can't be uploaded — PDF and MP3 only, up to 50 MB.")
  })

  describe('R368: per-row Remove inline-confirm', () => {
    it('clicking Remove opens the inline confirm with the exact removes-everywhere copy and the bolded filename', async () => {
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])
      const row = wrapper.find('[data-testid="song-file-row-doc-1"]')
      expect(wrapper.find('[data-testid="song-file-remove-confirm"]').exists()).toBe(false)

      await row.find('[data-testid="song-file-remove"]').trigger('click')

      const confirm = wrapper.find('[data-testid="song-file-remove-confirm"]')
      expect(confirm.exists()).toBe(true)
      expect(confirm.text()).toContain(
        'Remove "chart.pdf"? This file appears on every service that uses this song. Removing it here removes it everywhere — including past services. This can\'t be undone.',
      )
      expect(confirm.find('strong').text()).toBe('"chart.pdf"')
    })

    it('opening a second row\'s confirm collapses the first — only one open at a time', async () => {
      const docA = makeAttachment({ id: 'doc-a', kind: 'document', name: 'a.pdf' })
      const docB = makeAttachment({ id: 'doc-b', kind: 'document', name: 'b.pdf' })
      const wrapper = mountTab([docA, docB])

      await wrapper.find('[data-testid="song-file-row-doc-a"] [data-testid="song-file-remove"]').trigger('click')
      expect(wrapper.find('[data-testid="song-file-row-doc-a"] + [data-testid="song-file-remove-confirm"]').exists()).toBe(true)

      await wrapper.find('[data-testid="song-file-row-doc-b"] [data-testid="song-file-remove"]').trigger('click')
      expect(wrapper.findAll('[data-testid="song-file-remove-confirm"]')).toHaveLength(1)
      expect(wrapper.find('[data-testid="song-file-row-doc-b"] + [data-testid="song-file-remove-confirm"]').exists()).toBe(true)
    })

    it('Cancel closes the confirm without calling the store', async () => {
      const removeSpy = vi.spyOn(useSongStore(), 'removeSongAttachment').mockResolvedValue(undefined)
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])

      await wrapper.find('[data-testid="song-file-remove"]').trigger('click')
      await wrapper.find('[data-testid="song-file-remove-cancel"]').trigger('click')

      expect(wrapper.find('[data-testid="song-file-remove-confirm"]').exists()).toBe(false)
      expect(removeSpy).not.toHaveBeenCalled()
    })

    it('confirming calls removeSongAttachment(songId, attachment) exactly once', async () => {
      const removeSpy = vi.spyOn(useSongStore(), 'removeSongAttachment').mockResolvedValue(undefined)
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])

      await wrapper.find('[data-testid="song-file-remove"]').trigger('click')
      await wrapper.find('[data-testid="song-file-remove-confirm-button"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith('song-1', doc)
    })

    it('WR-03: a rejected removeSongAttachment shows an inline error and keeps the confirm card open (no silent failure)', async () => {
      const removeSpy = vi.spyOn(useSongStore(), 'removeSongAttachment').mockRejectedValue(new Error('permission-denied'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])

      await wrapper.find('[data-testid="song-file-remove"]').trigger('click')
      await wrapper.find('[data-testid="song-file-remove-confirm-button"]').trigger('click')
      await flushPromises()

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.find('[data-testid="song-file-remove-confirm"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="song-file-remove-error"]').text()).toContain("Couldn't remove")
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('a link row\'s Remove also calls removeSongAttachment', async () => {
      const removeSpy = vi.spyOn(useSongStore(), 'removeSongAttachment').mockResolvedValue(undefined)
      const link = makeAttachment({
        id: 'link-1',
        kind: 'link',
        name: 'Reference track',
        href: 'https://youtu.be/xyz',
        linkSource: 'youtube',
        storagePath: undefined,
        downloadUrl: undefined,
        mimeType: undefined,
        sizeBytes: undefined,
      })
      const wrapper = mountTab([link])

      await wrapper.find('[data-testid="song-file-remove"]').trigger('click')
      await wrapper.find('[data-testid="song-file-remove-confirm-button"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith('song-1', link)
    })
  })

  describe('R367: Preview (PDF modal) + Play (inline MP3 player)', () => {
    it('clicking Preview on a PDF row opens SongFilePreviewModal with that attachment', async () => {
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])

      const modalBefore = wrapper.findComponent(SongFilePreviewModal)
      expect(modalBefore.props('open')).toBe(false)

      await wrapper
        .find('[data-testid="song-file-row-doc-1"] [data-testid="song-file-preview"]')
        .trigger('click')

      const modal = wrapper.findComponent(SongFilePreviewModal)
      expect(modal.props('open')).toBe(true)
      expect(modal.props('attachment')).toEqual(doc)
    })

    it('closing the modal (emitting close) clears the previewed attachment', async () => {
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])

      await wrapper
        .find('[data-testid="song-file-row-doc-1"] [data-testid="song-file-preview"]')
        .trigger('click')
      expect(wrapper.findComponent(SongFilePreviewModal).props('open')).toBe(true)

      wrapper.findComponent(SongFilePreviewModal).vm.$emit('close')
      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent(SongFilePreviewModal).props('open')).toBe(false)
    })

    it('clicking Play on an MP3 row reveals a native audio player with src=downloadUrl', async () => {
      const track = makeAttachment({
        id: 'track-1',
        kind: 'audio',
        name: 'demo.mp3',
        mimeType: 'audio/mpeg',
        downloadUrl: 'https://cdn.example.com/demo.mp3',
      })
      const wrapper = mountTab([track])
      expect(wrapper.find('[data-testid="song-file-row-track-1"] audio').exists()).toBe(false)

      await wrapper
        .find('[data-testid="song-file-row-track-1"] [data-testid="song-file-play"]')
        .trigger('click')

      const audio = wrapper.find('[data-testid="song-file-row-track-1"] + audio')
      expect(audio.exists()).toBe(true)
      expect(audio.attributes('src')).toBe('https://cdn.example.com/demo.mp3')
    })

    it('starting a second Play collapses the first — only one audio element present at a time', async () => {
      const trackA = makeAttachment({ id: 'track-a', kind: 'audio', name: 'a.mp3', mimeType: 'audio/mpeg', downloadUrl: 'https://cdn.example.com/a.mp3' })
      const trackB = makeAttachment({ id: 'track-b', kind: 'audio', name: 'b.mp3', mimeType: 'audio/mpeg', downloadUrl: 'https://cdn.example.com/b.mp3' })
      const wrapper = mountTab([trackA, trackB])

      await wrapper.find('[data-testid="song-file-row-track-a"] [data-testid="song-file-play"]').trigger('click')
      expect(wrapper.findAll('audio')).toHaveLength(1)

      await wrapper.find('[data-testid="song-file-row-track-b"] [data-testid="song-file-play"]').trigger('click')
      expect(wrapper.findAll('audio')).toHaveLength(1)
      const audio = wrapper.find('[data-testid="song-file-row-track-b"] + audio')
      expect(audio.exists()).toBe(true)
    })

    it('an audio native error renders the exact fallback copy and a Download link beneath the controls', async () => {
      const track = makeAttachment({
        id: 'track-1',
        kind: 'audio',
        name: 'demo.mp3',
        mimeType: 'audio/mpeg',
        downloadUrl: 'https://cdn.example.com/demo.mp3',
      })
      const wrapper = mountTab([track])
      await wrapper.find('[data-testid="song-file-row-track-1"] [data-testid="song-file-play"]').trigger('click')

      await wrapper.find('[data-testid="song-file-audio-player"]').trigger('error')

      expect(wrapper.find('[data-testid="song-file-audio-error"]').text()).toContain("Couldn't play this file.")
      const fallback = wrapper.find('[data-testid="song-file-audio-error-download"]')
      expect(fallback.exists()).toBe(true)
      expect(fallback.element.tagName).toBe('BUTTON')
    })

    it('a link row exposes neither Preview nor Play', () => {
      const link = makeAttachment({
        id: 'link-1',
        kind: 'link',
        name: 'Reference track',
        href: 'https://youtu.be/xyz',
        linkSource: 'youtube',
        storagePath: undefined,
        downloadUrl: undefined,
        mimeType: undefined,
        sizeBytes: undefined,
      })
      const wrapper = mountTab([link])
      const row = wrapper.find('[data-testid="song-file-row-link-1"]')
      expect(row.find('[data-testid="song-file-preview"]').exists()).toBe(false)
      expect(row.find('[data-testid="song-file-play"]').exists()).toBe(false)
    })

    it('a document row exposes Preview but not Play', () => {
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf' })
      const wrapper = mountTab([doc])
      const row = wrapper.find('[data-testid="song-file-row-doc-1"]')
      expect(row.find('[data-testid="song-file-preview"]').exists()).toBe(true)
      expect(row.find('[data-testid="song-file-play"]').exists()).toBe(false)
    })

    it('an audio row exposes Play but not Preview', () => {
      const track = makeAttachment({ id: 'track-1', kind: 'audio', name: 'demo.mp3', mimeType: 'audio/mpeg' })
      const wrapper = mountTab([track])
      const row = wrapper.find('[data-testid="song-file-row-track-1"]')
      expect(row.find('[data-testid="song-file-play"]').exists()).toBe(true)
      expect(row.find('[data-testid="song-file-preview"]').exists()).toBe(false)
    })
  })

  describe('FIX A: Download uses fetch+blob, never a same-window navigation', () => {
    // Firebase Storage download URLs are cross-origin, so a plain
    // <a :href download> silently ignores `download` and, with no target,
    // navigates the whole SPA away to render/play the file inline — the
    // reported bug. downloadAttachment() fetches the bytes and clicks a
    // same-origin blob: <a download>, which the browser DOES honor.
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('clicking Download fetches the file and clicks a same-origin blob download link', async () => {
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf', downloadUrl: 'https://cdn.example.com/chart.pdf' })
      const fetchMock = vi.fn(() =>
        Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) } as Response),
      )
      vi.stubGlobal('fetch', fetchMock)
      const createObjectURLSpy = vi.fn(() => 'blob:mock-url')
      const revokeObjectURLSpy = vi.fn()
      vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy })
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      const wrapper = mountTab([doc])
      await wrapper.find('[data-testid="song-file-download"]').trigger('click')
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/chart.pdf')
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')

      clickSpy.mockRestore()
    })

    it('falls back to opening a new tab (never navigating the SPA away) when fetch fails', async () => {
      const doc = makeAttachment({ id: 'doc-1', kind: 'document', name: 'chart.pdf', downloadUrl: 'https://cdn.example.com/chart.pdf' })
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('CORS'))))
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      const wrapper = mountTab([doc])
      await wrapper.find('[data-testid="song-file-download"]').trigger('click')
      await flushPromises()

      expect(openSpy).toHaveBeenCalledWith('https://cdn.example.com/chart.pdf', '_blank', 'noopener,noreferrer')

      openSpy.mockRestore()
    })
  })
})
