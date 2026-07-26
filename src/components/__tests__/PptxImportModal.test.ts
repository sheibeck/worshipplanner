import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import PptxImportModal from '../PptxImportModal.vue'

// ── Mocks ────────────────────────────────────────────────────────────────────
// pptxUpload (Task 1) is mocked entirely — this suite proves the modal's step
// machine and wiring, not the Storage upload mechanics (covered by pptxUpload's
// own type-check/acceptance criteria in Task 1).

const mockGenerateImportId = vi.fn<(...args: unknown[]) => string>(() => 'import-abc')
const mockUploadPptx = vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve(''))
const mockUploadImage = vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve(''))
const mockResolveImageUrl = vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve(''))

vi.mock('@/utils/pptxUpload', () => ({
  generateImportId: (...args: unknown[]) => mockGenerateImportId(...args),
  uploadPptx: (...args: unknown[]) => mockUploadPptx(...args),
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
  resolveImageUrl: (...args: unknown[]) => mockResolveImageUrl(...args),
}))

// The onCall RPC. The modal must invoke this with { orgId, importId, storagePath }
// only — never raw file bytes.
type RawSlide =
  | { contentKind: 'text'; title?: string; body: string }
  | { contentKind: 'image'; imageUrl: string; altText?: string }
const mockParsePptxCallable = vi.fn<(...args: unknown[]) => Promise<{ data: { slides: RawSlide[] } }>>(
  () => Promise.resolve({ data: { slides: [] } }),
)
const mockHttpsCallable = vi.fn<(...args: unknown[]) => typeof mockParsePptxCallable>(() => mockParsePptxCallable)

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

// A dummy `deleteObject` import from `firebase/storage` — proves (by construction)
// that this suite's exercised code paths never reach for Storage deletion. The
// component itself never imports `firebase/storage` directly (all Storage I/O is
// routed through the mocked pptxUpload module above), so this spy staying at zero
// calls is a structural guarantee, not a probabilistic one.
const mockDeleteObject = vi.fn()
vi.mock('firebase/storage', () => ({
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}))

vi.mock('@/firebase', () => ({
  functions: {},
  storage: {},
}))

// The importedSlides store. Only `createDeck` is exercised by this component.
const mockCreateDeck = vi.fn()
vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () => ({
    createDeck: (...args: unknown[]) => mockCreateDeck(...args),
  }),
}))

// The modal renders its content via <Teleport to="body">, so the mounted
// wrapper's own DOM is just teleport start/end comments — every element query
// in this suite goes through `body()`, a DOMWrapper over document.body, per
// Vue Test Utils' documented Teleport testing pattern. Auto-unmount is
// required so each test's teleported content is cleaned out of the shared
// document.body before the next test mounts.
enableAutoUnmount(afterEach)

function body() {
  return new DOMWrapper(document.body)
}

// ── Test helpers ─────────────────────────────────────────────────────────────

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** jsdom's `HTMLInputElement.files` is read-only; this is the standard
 * workaround for simulating a user picking file(s) in a component test. */
function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    value: files,
    configurable: true,
  })
  input.dispatchEvent(new Event('change'))
}

function mountModal(props?: Record<string, unknown>) {
  return mount(PptxImportModal, {
    props: {
      open: true,
      orgId: 'org-1',
      section: 'message',
      ...props,
    },
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PptxImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateImportId.mockReturnValue('import-abc')
    mockHttpsCallable.mockReturnValue(mockParsePptxCallable)
  })

  it('PPTX happy path: idle -> uploading -> parsing -> preview, then confirm persists and emits', async () => {
    const uploadDeferred = createDeferred<string>()
    mockUploadPptx.mockReturnValueOnce(uploadDeferred.promise)

    const parseDeferred = createDeferred<{ data: { slides: RawSlide[] } }>()
    mockParsePptxCallable.mockReturnValueOnce(parseDeferred.promise)
    mockResolveImageUrl.mockResolvedValueOnce('https://example.com/orgs/org-1/pptx-imports/import-abc/images/0.png')
    mockCreateDeck.mockResolvedValueOnce('new-import-id')

    const wrapper = mountModal()
    expect(body().find('[data-testid="step-idle"]').exists()).toBe(true)

    const file = new File(['fake pptx bytes'], 'deck.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
    const input = body().find('[data-testid="pptx-file-input"]').element as HTMLInputElement
    setInputFiles(input, [file])
    await wrapper.vm.$nextTick()

    // uploading — uploadPptx called with the picked file, not a storage path
    expect(body().find('[data-testid="step-uploading"]').exists()).toBe(true)
    expect(mockUploadPptx).toHaveBeenCalledWith('org-1', 'import-abc', file, expect.any(Function))

    uploadDeferred.resolve('orgs/org-1/pptx-imports/import-abc/source.pptx')
    await flushPromises()

    // parsing — parsePptx invoked with ONLY the storage path (never file bytes)
    expect(body().find('[data-testid="step-parsing"]').exists()).toBe(true)
    expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'parsePptx')
    expect(mockParsePptxCallable).toHaveBeenCalledWith({
      orgId: 'org-1',
      importId: 'import-abc',
      storagePath: 'orgs/org-1/pptx-imports/import-abc/source.pptx',
    })
    const calledWith = mockParsePptxCallable.mock.calls[0]![0] as { storagePath: unknown }
    expect(typeof calledWith.storagePath).toBe('string')

    parseDeferred.resolve({
      data: {
        slides: [
          { contentKind: 'text', title: 'Welcome', body: 'Hello church' },
          {
            contentKind: 'image',
            imageUrl: 'orgs/org-1/pptx-imports/import-abc/images/0.png',
            altText: 'photo',
          },
        ],
      },
    })
    await flushPromises()

    // preview
    expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)
    expect(body().find('[data-testid="preview-slide-0"]').text()).toContain('Welcome')
    expect(body().find('[data-testid="preview-slide-0"]').text()).toContain('Hello church')
    expect(body().find('[data-testid="preview-slide-1"] img').exists()).toBe(true)
    expect(body().find('[data-testid="preview-slide-1"] img').attributes('src')).toBe(
      'https://example.com/orgs/org-1/pptx-imports/import-abc/images/0.png',
    )
    expect(mockResolveImageUrl).toHaveBeenCalledWith('orgs/org-1/pptx-imports/import-abc/images/0.png')

    // confirm
    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(mockCreateDeck).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        sourceFileName: 'deck.pptx',
        section: 'message',
        slides: expect.any(Array),
      }),
    )
    expect(wrapper.emitted('confirmed')).toBeTruthy()
    expect(wrapper.emitted('confirmed')![0]).toEqual([{ importId: 'new-import-id', section: 'message' }])
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })

  it('image-only path builds a preview and confirms without invoking parsePptx', async () => {
    mockUploadImage.mockImplementation((...args: unknown[]) => {
      const [orgId, importId, , index] = args as [string, string, File, number]
      return Promise.resolve(`orgs/${orgId}/pptx-imports/${importId}/images/${index}.png`)
    })
    mockResolveImageUrl.mockImplementation((...args: unknown[]) => {
      const [path] = args as [string]
      return Promise.resolve(`https://example.com/${path}`)
    })
    mockCreateDeck.mockResolvedValueOnce('new-image-import-id')

    const wrapper = mountModal()

    const file1 = new File(['a'], 'one.png', { type: 'image/png' })
    const file2 = new File(['b'], 'two.png', { type: 'image/png' })
    const input = body().find('[data-testid="image-file-input"]').element as HTMLInputElement
    setInputFiles(input, [file1, file2])
    await flushPromises()

    expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)
    expect(mockUploadImage).toHaveBeenCalledTimes(2)
    expect(mockUploadImage).toHaveBeenNthCalledWith(1, 'org-1', 'import-abc', file1, 0)
    expect(mockUploadImage).toHaveBeenNthCalledWith(2, 'org-1', 'import-abc', file2, 1)
    expect(body().findAll('img').length).toBe(2)

    // No PPTX parsing involved for the image-only mode.
    expect(mockHttpsCallable).not.toHaveBeenCalled()
    expect(mockParsePptxCallable).not.toHaveBeenCalled()

    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(mockCreateDeck).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ section: 'message', slides: expect.any(Array) }),
    )
    expect(wrapper.emitted('confirmed')![0]).toEqual([{ importId: 'new-image-import-id', section: 'message' }])
  })

  it('a rejected parse transitions to the error step with the friendly copy, offers retry, and never deletes the source', async () => {
    mockUploadPptx.mockResolvedValue('orgs/org-1/pptx-imports/import-abc/source.pptx')
    mockParsePptxCallable.mockRejectedValueOnce(new Error('officeparser blew up'))

    mountModal()
    const file = new File(['bad bytes'], 'deck.pptx')
    const input = body().find('[data-testid="pptx-file-input"]').element as HTMLInputElement
    setInputFiles(input, [file])
    await flushPromises()

    expect(body().find('[data-testid="step-error"]').exists()).toBe(true)
    expect(body().find('[data-testid="error-message"]').text()).toBe(
      "We couldn't read this file — try re-exporting from PowerPoint.",
    )
    expect(body().find('[data-testid="retry-btn"]').exists()).toBe(true)
    expect(mockDeleteObject).not.toHaveBeenCalled()
    expect(mockCreateDeck).not.toHaveBeenCalled()

    // Retry re-invokes the failed step (re-uploads + re-parses the same file).
    mockParsePptxCallable.mockResolvedValueOnce({ data: { slides: [] } })
    await body().find('[data-testid="retry-btn"]').trigger('click')
    await flushPromises()

    expect(mockUploadPptx).toHaveBeenCalledTimes(2)
    expect(mockParsePptxCallable).toHaveBeenCalledTimes(2)
    expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })

  it('cancel emits cancel without creating a deck', async () => {
    const wrapper = mountModal()
    await body().find('[data-testid="cancel-btn"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(mockCreateDeck).not.toHaveBeenCalled()
  })

  // ── 25-07 Task 1: additive external drop-zone entry point (D-15) ──────────
  describe('external drop-zone entry point (25-07 Task 1)', () => {
    it('importPptxFile advances into the upload step, calling the same importPptx path as the file input', async () => {
      const uploadDeferred = createDeferred<string>()
      mockUploadPptx.mockReturnValueOnce(uploadDeferred.promise)

      const wrapper = mountModal()
      const file = new File(['fake pptx bytes'], 'dropped.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
      wrapper.vm.importPptxFile(file)
      await wrapper.vm.$nextTick()

      expect(body().find('[data-testid="step-uploading"]').exists()).toBe(true)
      expect(mockUploadPptx).toHaveBeenCalledWith('org-1', 'import-abc', file, expect.any(Function))
    })

    it('importImageFiles advances into the upload step and reaches preview, calling the same importImages path', async () => {
      mockUploadImage.mockImplementation((...args: unknown[]) => {
        const [orgId, importId, , index] = args as [string, string, File, number]
        return Promise.resolve(`orgs/${orgId}/pptx-imports/${importId}/images/${index}.png`)
      })
      mockResolveImageUrl.mockImplementation((...args: unknown[]) => {
        const [path] = args as [string]
        return Promise.resolve(`https://example.com/${path}`)
      })

      const wrapper = mountModal()
      const file = new File(['a'], 'dropped.png', { type: 'image/png' })
      wrapper.vm.importImageFiles([file])
      await flushPromises()

      expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)
      expect(mockUploadImage).toHaveBeenCalledWith('org-1', 'import-abc', file, 0)
    })

    it('calling the entry point while mid-upload starts nothing and leaves the step unchanged', async () => {
      const uploadDeferred = createDeferred<string>()
      mockUploadPptx.mockReturnValueOnce(uploadDeferred.promise)

      const wrapper = mountModal()
      const file = new File(['fake pptx bytes'], 'dropped.pptx')
      wrapper.vm.importPptxFile(file)
      await wrapper.vm.$nextTick()
      expect(mockUploadPptx).toHaveBeenCalledTimes(1)
      expect(body().find('[data-testid="step-uploading"]').exists()).toBe(true)

      const secondFile = new File(['more bytes'], 'second.pptx')
      wrapper.vm.importPptxFile(secondFile)
      await wrapper.vm.$nextTick()

      // Still mid-upload from the first call; the second call started nothing.
      expect(mockUploadPptx).toHaveBeenCalledTimes(1)
      expect(body().find('[data-testid="step-uploading"]').exists()).toBe(true)
    })

    it("the modal's own file inputs still work with the entry point present", async () => {
      mockUploadPptx.mockResolvedValueOnce('orgs/org-1/pptx-imports/import-abc/source.pptx')
      mockParsePptxCallable.mockResolvedValueOnce({ data: { slides: [] } })

      mountModal()
      const file = new File(['bytes'], 'deck.pptx')
      const input = body().find('[data-testid="pptx-file-input"]').element as HTMLInputElement
      setInputFiles(input, [file])
      await flushPromises()

      expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)
    })
  })
})
