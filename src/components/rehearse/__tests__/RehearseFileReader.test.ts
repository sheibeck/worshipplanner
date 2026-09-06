import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RehearseFileReader from '../RehearseFileReader.vue'
import type { RehearseAttachment } from '@/utils/rehearseAccess'

function makeAttachment(overrides: Partial<RehearseAttachment> = {}): RehearseAttachment {
  return {
    id: 'a1',
    name: 'Way Maker.pdf',
    kind: 'document',
    downloadUrl: 'https://cdn.example.com/way-maker.pdf',
    ...overrides,
  }
}

describe('RehearseFileReader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the empty-state copy when no attachment is selected', () => {
    const wrapper = mount(RehearseFileReader, { props: { attachment: undefined } })
    expect(wrapper.text()).toContain("Select a song's chart from the list to view it here.")
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('desktop: mounts a single iframe with tabindex=-1 pointed at the download URL', () => {
    const attachment = makeAttachment()
    const wrapper = mount(RehearseFileReader, { props: { attachment, mobileLinkFirst: false } })

    const iframe = wrapper.get('[data-testid="rehearse-reader-iframe"]')
    expect(iframe.attributes('src')).toBe(attachment.downloadUrl)
    expect(iframe.attributes('tabindex')).toBe('-1')
    expect(wrapper.find('[data-testid="rehearse-reader-open"]').exists()).toBe(false)
  })

  it('desktop: shows a loading spinner until @load fires', async () => {
    const attachment = makeAttachment()
    const wrapper = mount(RehearseFileReader, { props: { attachment } })

    expect(wrapper.find('[data-testid="rehearse-reader-loading"]').exists()).toBe(true)
    await wrapper.get('[data-testid="rehearse-reader-iframe"]').trigger('load')
    expect(wrapper.find('[data-testid="rehearse-reader-loading"]').exists()).toBe(false)
  })

  it('desktop: @error shows the errored fallback with a Download button (not a plain <a>), hiding the iframe', async () => {
    const attachment = makeAttachment()
    const wrapper = mount(RehearseFileReader, { props: { attachment } })

    await wrapper.get('[data-testid="rehearse-reader-iframe"]').trigger('error')

    expect(wrapper.find('iframe').exists()).toBe(false)
    const errorPanel = wrapper.get('[data-testid="rehearse-reader-error"]')
    expect(errorPanel.text()).toContain("Couldn't preview this file.")
    const downloadButton = wrapper.get('[data-testid="rehearse-reader-error-download"]')
    // WR-01: this must be a <button> using the fetch->blob downloadAttachment()
    // helper, NOT a plain <a :href download> — that silently ignores the
    // `download` attribute on a cross-origin Storage URL and navigates the
    // whole SPA away instead of prompting Save.
    expect(downloadButton.element.tagName).toBe('BUTTON')
    expect(downloadButton.attributes('href')).toBeUndefined()
  })

  describe('desktop error-fallback Download (WR-01: fetch->blob->objectURL pattern, not a bare <a download>)', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(new Blob(['x'])),
        }),
      )
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      })
    })

    it('clicking the error-state Download button fetches the URL and triggers a synthetic-anchor click instead of navigating', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const attachment = makeAttachment()
      const wrapper = mount(RehearseFileReader, { props: { attachment } })
      await wrapper.get('[data-testid="rehearse-reader-iframe"]').trigger('error')

      await wrapper.get('[data-testid="rehearse-reader-error-download"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      expect(fetch).toHaveBeenCalledWith(attachment.downloadUrl)
      expect(clickSpy).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
    })
  })

  it('Pitfall 3: resets loading/errored state when the attachment prop changes, not just on open', async () => {
    const attachment1 = makeAttachment({ id: 'a1', name: 'Way Maker.pdf' })
    const attachment2 = makeAttachment({ id: 'a2', name: 'Great Are You.pdf', downloadUrl: 'https://cdn.example.com/great.pdf' })
    const wrapper = mount(RehearseFileReader, { props: { attachment: attachment1 } })

    await wrapper.get('[data-testid="rehearse-reader-iframe"]').trigger('error')
    expect(wrapper.find('[data-testid="rehearse-reader-error"]').exists()).toBe(true)

    await wrapper.setProps({ attachment: attachment2 })

    // No stale error carried over — a fresh loading state, not the old error.
    expect(wrapper.find('[data-testid="rehearse-reader-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearse-reader-loading"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="rehearse-reader-iframe"]').attributes('src')).toBe(attachment2.downloadUrl)
  })

  it('desktop: Print opens the download URL in a new tab via window.open(noopener)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const attachment = makeAttachment()
    const wrapper = mount(RehearseFileReader, { props: { attachment } })

    await wrapper.get('[data-testid="rehearse-reader-print"]').trigger('click')

    expect(openSpy).toHaveBeenCalledWith(attachment.downloadUrl, '_blank', 'noopener,noreferrer')
  })

  it('mobile-link-first (R391): renders NO iframe — an Open PDF primary button and a Download secondary button instead', () => {
    const attachment = makeAttachment()
    const wrapper = mount(RehearseFileReader, { props: { attachment, mobileLinkFirst: true } })

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearse-reader-open"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-reader-download"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-reader-back"]').exists()).toBe(true)
  })

  it('mobile: Open PDF calls window.open with noopener, and Back emits back', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const attachment = makeAttachment()
    const wrapper = mount(RehearseFileReader, { props: { attachment, mobileLinkFirst: true } })

    await wrapper.get('[data-testid="rehearse-reader-open"]').trigger('click')
    expect(openSpy).toHaveBeenCalledWith(attachment.downloadUrl, '_blank', 'noopener,noreferrer')

    await wrapper.get('[data-testid="rehearse-reader-back"]').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  describe('mobile Download (fetch->blob->objectURL pattern, copied from SongFilesTab.vue)', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(new Blob(['x'])),
        }),
      )
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      })
    })

    it('downloads via fetch->blob->objectURL->synthetic click, not a bare <a download> on the cross-origin URL', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const attachment = makeAttachment()
      const wrapper = mount(RehearseFileReader, { props: { attachment, mobileLinkFirst: true } })

      await wrapper.get('[data-testid="rehearse-reader-download"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      expect(fetch).toHaveBeenCalledWith(attachment.downloadUrl)
      expect(clickSpy).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
    })
  })
})
