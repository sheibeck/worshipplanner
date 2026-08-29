// Phase 98 Plan 01 (R286). Blob-download-helper test, following
// 98-PATTERNS.md's recommended mocking: stub URL.createObjectURL/
// revokeObjectURL with vi.fn, stub document.createElement to return a fake
// anchor with a click spy, and assert the anchor got the filename, click
// was called once, and revokeObjectURL was called with the mock URL.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { downloadTextFile } from '@/utils/downloadTextFile'

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a Blob, sets href/download on a synthetic anchor, clicks it once, and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const fakeDoc = {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    } as unknown as Document

    downloadTextFile('worshipplanner-enable-fullscreen-hkcu.reg', 'reg contents', 'text/plain', fakeDoc)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(fakeDoc.createElement).toHaveBeenCalledWith('a')
    expect(anchor.download).toBe('worshipplanner-enable-fullscreen-hkcu.reg')
    expect(anchor.href).toBe('blob:mock-url')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('revokes the object URL even when the click throws (finally block)', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const anchor = {
      href: '',
      download: '',
      click: () => {
        throw new Error('click failed')
      },
    } as unknown as HTMLAnchorElement
    const fakeDoc = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    } as unknown as Document

    expect(() => downloadTextFile('f.json', '{}', 'application/json', fakeDoc)).toThrow('click failed')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('defaults to the global document when none is injected', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    downloadTextFile('f.json', '{}', 'application/json')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
