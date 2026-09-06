import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RehearseSongDetail from '../RehearseSongDetail.vue'
import type { RehearseSong } from '@/utils/rehearseAccess'

function makeSong(overrides: Partial<RehearseSong> = {}): RehearseSong {
  return {
    id: 'song-1',
    title: 'Way Maker',
    keyOrArrangement: 'Bb',
    bpm: 72,
    attachments: [],
    ...overrides,
  }
}

describe('RehearseSongDetail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing selected state when song is undefined', () => {
    const wrapper = mount(RehearseSongDetail, { props: { song: undefined } })
    expect(wrapper.text()).toContain("Select a song's chart from the list to view it here.")
  })

  it('groups document + link attachments into Sheet music & chords, and audio into Recordings', () => {
    const song = makeSong({
      attachments: [
        { id: 'a1', name: 'chart.pdf', kind: 'document', downloadUrl: 'https://cdn.example.com/chart.pdf' },
        { id: 'a2', name: 'YouTube reference', kind: 'link', href: 'https://youtube.com/watch?v=abc', linkSource: 'youtube' },
        { id: 'a3', name: 'track.mp3', kind: 'audio', downloadUrl: 'https://cdn.example.com/track.mp3' },
      ],
    })
    const wrapper = mount(RehearseSongDetail, { props: { song } })

    expect(wrapper.text()).toContain('SHEET MUSIC & CHORDS')
    expect(wrapper.text()).toContain('RECORDINGS')
    const sheetGroup = wrapper.get('[data-testid="rehearse-detail-documents"]')
    expect(sheetGroup.text()).toContain('chart.pdf')
    expect(sheetGroup.text()).toContain('YouTube reference')
    const recordingsGroup = wrapper.get('[data-testid="rehearse-detail-audio"]')
    expect(recordingsGroup.text()).toContain('track.mp3')
  })

  it('renders a Print and a Download button on each PDF row, and a Play toggle + Download on each MP3 row', async () => {
    const song = makeSong({
      attachments: [
        { id: 'a1', name: 'chart.pdf', kind: 'document', downloadUrl: 'https://cdn.example.com/chart.pdf' },
        { id: 'a3', name: 'track.mp3', kind: 'audio', downloadUrl: 'https://cdn.example.com/track.mp3' },
      ],
    })
    const wrapper = mount(RehearseSongDetail, { props: { song } })

    expect(wrapper.find('[data-testid="rehearse-detail-print-a1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-detail-download-a1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-detail-play-a3"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rehearse-detail-download-a3"]').exists()).toBe(true)

    await wrapper.get('[data-testid="rehearse-detail-play-a3"]').trigger('click')
    expect(wrapper.emitted('play')).toEqual([[song.attachments[1]]])
  })

  it('opens Print in a new tab via window.open with noopener, never via a bare <a download>', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const song = makeSong({
      attachments: [{ id: 'a1', name: 'chart.pdf', kind: 'document', downloadUrl: 'https://cdn.example.com/chart.pdf' }],
    })
    const wrapper = mount(RehearseSongDetail, { props: { song } })

    await wrapper.get('[data-testid="rehearse-detail-print-a1"]').trigger('click')

    expect(openSpy).toHaveBeenCalledWith('https://cdn.example.com/chart.pdf', '_blank', 'noopener,noreferrer')
    expect(wrapper.find('a[download]').exists()).toBe(false)
  })

  it('renders external links as <a target=_blank rel=noopener noreferrer> with the correct source label, no Print/Download', () => {
    const song = makeSong({
      attachments: [{ id: 'a2', name: 'YouTube reference', kind: 'link', href: 'https://youtube.com/watch?v=abc', linkSource: 'youtube' }],
    })
    const wrapper = mount(RehearseSongDetail, { props: { song } })

    const link = wrapper.get('[data-testid="rehearse-detail-link-a2"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('https://youtube.com/watch?v=abc')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.text()).toContain('YouTube')
    expect(wrapper.find('[data-testid="rehearse-detail-print-a2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearse-detail-download-a2"]').exists()).toBe(false)
  })

  it('composes the header meta line gracefully, never rendering a bare "bpm" or a lone separator', () => {
    const sparse = makeSong({ keyOrArrangement: undefined, bpm: null, attachments: [] })
    const wrapper = mount(RehearseSongDetail, { props: { song: sparse } })

    const meta = wrapper.get('[data-testid="rehearse-detail-meta"]').text()
    expect(meta).not.toContain('bpm')
    expect(meta).not.toContain('·  ·')
    expect(meta).not.toContain('undefined')
    expect(meta).not.toContain('null')
  })

  it('renders the full meta line when key/bpm/ccli are all present', () => {
    const full = makeSong({ keyOrArrangement: 'Bb', bpm: 72 })
    const wrapper = mount(RehearseSongDetail, { props: { song: full, ccliNumber: '12345' } })

    const meta = wrapper.get('[data-testid="rehearse-detail-meta"]').text()
    expect(meta).toContain('Bb')
    expect(meta).toContain('72 bpm')
    expect(meta).toContain('CCLI 12345')
  })

  it('mounts no <audio> element — Play emits instead of playing inline', async () => {
    const song = makeSong({
      attachments: [{ id: 'a3', name: 'track.mp3', kind: 'audio', downloadUrl: 'https://cdn.example.com/track.mp3' }],
    })
    const wrapper = mount(RehearseSongDetail, { props: { song } })

    await wrapper.get('[data-testid="rehearse-detail-play-a3"]').trigger('click')

    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.emitted('play')).toBeTruthy()
  })

  it('renders per-group empty copy when a song has no PDFs or no recordings', () => {
    const song = makeSong({ attachments: [] })
    const wrapper = mount(RehearseSongDetail, { props: { song } })

    expect(wrapper.text()).toContain('No sheet music attached for this song.')
    expect(wrapper.text()).toContain('No recordings attached for this song.')
  })

  describe('downloadAttachment (fetch->blob->objectURL pattern, copied from SongFilesTab.vue)', () => {
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
      const song = makeSong({
        attachments: [{ id: 'a1', name: 'chart.pdf', kind: 'document', downloadUrl: 'https://cdn.example.com/chart.pdf' }],
      })
      const wrapper = mount(RehearseSongDetail, { props: { song } })

      await wrapper.get('[data-testid="rehearse-detail-download-a1"]').trigger('click')
      await Promise.resolve()
      await Promise.resolve()

      expect(fetch).toHaveBeenCalledWith('https://cdn.example.com/chart.pdf')
      expect(clickSpy).toHaveBeenCalled()
      expect(URL.createObjectURL).toHaveBeenCalled()
    })
  })
})
