import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import SongFilePreviewModal from '../SongFilePreviewModal.vue'
import type { SongAttachment } from '@/types/song'

enableAutoUnmount(afterEach)

function makeAttachment(overrides: Partial<SongAttachment> = {}): SongAttachment {
  return {
    id: 'att-1',
    kind: 'document',
    name: 'chart.pdf',
    storagePath: 'orgs/org-1/song-files/att-1/chart.pdf',
    downloadUrl: 'https://cdn.example.com/chart.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2516582,
    createdAt: {} as SongAttachment['createdAt'],
    createdBy: 'user-1',
    ...overrides,
  }
}

function mountModal(open: boolean, attachment: SongAttachment | null) {
  return mount(SongFilePreviewModal, {
    props: { open, attachment },
    attachTo: document.body,
    global: {
      // Same Teleport stub used by CleanupEnableConfirmDialog.test.ts — renders
      // the teleported content inline under the wrapper root so VTU's
      // find/findAll can see it without needing document-level queries.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('SongFilePreviewModal', () => {
  it('renders nothing when open is false', () => {
    const wrapper = mountModal(false, makeAttachment())
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a dialog with an iframe whose src is the attachment downloadUrl when open with an attachment', () => {
    const attachment = makeAttachment({ downloadUrl: 'https://cdn.example.com/chart.pdf' })
    const wrapper = mountModal(true, attachment)
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('true')
    const iframe = wrapper.find('[data-testid="song-file-preview-iframe"]')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe('https://cdn.example.com/chart.pdf')
    wrapper.unmount()
  })

  it('shows the filename and a Download control targeting downloadUrl in the header', () => {
    const attachment = makeAttachment({ name: 'chart.pdf', downloadUrl: 'https://cdn.example.com/chart.pdf' })
    const wrapper = mountModal(true, attachment)
    expect(wrapper.text()).toContain('chart.pdf')
    const download = wrapper.find('[data-testid="song-file-preview-download"]')
    expect(download.attributes('href')).toBe('https://cdn.example.com/chart.pdf')
    expect(download.attributes('aria-label')).toBe('Download chart.pdf')
    wrapper.unmount()
  })

  it('shows a loading spinner before the iframe load event and hides it after', async () => {
    const wrapper = mountModal(true, makeAttachment())
    expect(wrapper.find('[data-testid="song-file-preview-loading"]').exists()).toBe(true)

    await wrapper.find('[data-testid="song-file-preview-iframe"]').trigger('load')

    expect(wrapper.find('[data-testid="song-file-preview-loading"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('an iframe error swaps it for the exact error copy and a Download fallback', async () => {
    const wrapper = mountModal(true, makeAttachment({ downloadUrl: 'https://cdn.example.com/chart.pdf' }))

    await wrapper.find('[data-testid="song-file-preview-iframe"]').trigger('error')

    expect(wrapper.find('[data-testid="song-file-preview-iframe"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="song-file-preview-error-text"]').text()).toBe("Couldn't preview this file.")
    const fallbackDownload = wrapper.find('[data-testid="song-file-preview-error-download"]')
    expect(fallbackDownload.exists()).toBe(true)
    expect(fallbackDownload.attributes('href')).toBe('https://cdn.example.com/chart.pdf')
    wrapper.unmount()
  })

  it('the Close button emits close', async () => {
    const wrapper = mountModal(true, makeAttachment())
    await wrapper.find('[data-testid="song-file-preview-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('backdrop click-self emits close', async () => {
    const wrapper = mountModal(true, makeAttachment())
    const backdropWrappers = wrapper.findAll('.fixed.inset-0')
    // The dialog-wrapper div (z-50) has @click.self bound; trigger click directly on it.
    const dialogWrapper = backdropWrappers.find((w) => w.classes().includes('z-50'))
    expect(dialogWrapper).toBeTruthy()
    await dialogWrapper!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('pressing Escape on the dialog root emits close', async () => {
    const wrapper = mountModal(true, makeAttachment())
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('non-Escape keydowns on the dialog root do not emit close', async () => {
    const wrapper = mountModal(true, makeAttachment())
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  describe('WR-02: Tab/Shift+Tab focus trap', () => {
    it('Tab from the last focusable element (Close) wraps focus to the first (header Download)', async () => {
      const wrapper = mountModal(true, makeAttachment())
      const download = wrapper.find('[data-testid="song-file-preview-download"]').element as HTMLElement
      const close = wrapper.find('[data-testid="song-file-preview-close"]').element as HTMLElement

      close.focus()
      expect(document.activeElement).toBe(close)

      await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab' })

      expect(document.activeElement).toBe(download)
      wrapper.unmount()
    })

    it('Shift+Tab from the first focusable element (header Download) wraps focus to the last (Close)', async () => {
      const wrapper = mountModal(true, makeAttachment())
      const download = wrapper.find('[data-testid="song-file-preview-download"]').element as HTMLElement
      const close = wrapper.find('[data-testid="song-file-preview-close"]').element as HTMLElement

      download.focus()
      expect(document.activeElement).toBe(download)

      await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true })

      expect(document.activeElement).toBe(close)
      wrapper.unmount()
    })

    it('focus lands on the Close button when the modal transitions to open', async () => {
      const wrapper = mountModal(false, makeAttachment())
      await wrapper.setProps({ open: true })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      const close = wrapper.find('[data-testid="song-file-preview-close"]').element as HTMLElement
      expect(document.activeElement).toBe(close)
      wrapper.unmount()
    })
  })
})
