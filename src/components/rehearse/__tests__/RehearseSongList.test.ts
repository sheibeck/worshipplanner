import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RehearseSongList from '../RehearseSongList.vue'
import type { RehearseSong } from '@/utils/rehearseAccess'

function makeSong(overrides: Partial<RehearseSong> = {}): RehearseSong {
  return {
    id: 'song-1',
    title: 'Way Maker',
    keyOrArrangement: 'Bb',
    attachments: [],
    ...overrides,
  }
}

describe('RehearseSongList', () => {
  it('renders one real <button> row per song, plus the header count', () => {
    const songs = [makeSong({ id: 'song-1', title: 'Way Maker' }), makeSong({ id: 'song-2', title: 'Great Are You Lord' })]
    const wrapper = mount(RehearseSongList, { props: { songs } })

    const rows = wrapper.findAll('button[data-testid="rehearse-song-row"]')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('Songs in this service')
    expect(wrapper.text()).toContain('2')
    expect(rows[0]!.text()).toContain('Way Maker')
    expect(rows[1]!.text()).toContain('Great Are You Lord')
  })

  it('renders the key in font-mono, and omits the key token entirely when absent', () => {
    const songs = [
      makeSong({ id: 'song-1', keyOrArrangement: 'Bb' }),
      makeSong({ id: 'song-2', keyOrArrangement: undefined }),
    ]
    const wrapper = mount(RehearseSongList, { props: { songs } })

    const rows = wrapper.findAll('[data-testid="rehearse-song-row"]')
    expect(rows[0]!.find('[data-testid="rehearse-song-key"]').exists()).toBe(true)
    expect(rows[0]!.find('[data-testid="rehearse-song-key"]').classes()).toContain('font-mono')
    expect(rows[0]!.text()).toContain('Bb')
    expect(rows[1]!.find('[data-testid="rehearse-song-key"]').exists()).toBe(false)
  })

  it('renders PDF and MP3 counts derived from attachment kind, including a legitimate zero count', () => {
    const songs = [
      makeSong({
        id: 'song-1',
        attachments: [
          { id: 'a1', name: 'chart.pdf', kind: 'document' },
          { id: 'a2', name: 'chart2.pdf', kind: 'document' },
          { id: 'a3', name: 'track.mp3', kind: 'audio' },
        ],
      }),
      makeSong({ id: 'song-2', attachments: [] }),
    ]
    const wrapper = mount(RehearseSongList, { props: { songs } })

    const rows = wrapper.findAll('[data-testid="rehearse-song-row"]')
    expect(rows[0]!.find('[data-testid="rehearse-song-pdf-count"]').text()).toBe('2')
    expect(rows[0]!.find('[data-testid="rehearse-song-mp3-count"]').text()).toBe('1')
    expect(rows[1]!.find('[data-testid="rehearse-song-pdf-count"]').text()).toBe('0')
    expect(rows[1]!.find('[data-testid="rehearse-song-mp3-count"]').text()).toBe('0')
  })

  it('marks the row matching selectedSongId with aria-current, and emits select with the song id on click', async () => {
    const songs = [makeSong({ id: 'song-1' }), makeSong({ id: 'song-2' })]
    const wrapper = mount(RehearseSongList, { props: { songs, selectedSongId: 'song-1' } })

    const rows = wrapper.findAll('[data-testid="rehearse-song-row"]')
    expect(rows[0]!.attributes('aria-current')).toBe('true')
    expect(rows[1]!.attributes('aria-current')).toBeUndefined()

    await rows[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['song-2']])
  })

  it('shows "● Playing" only on the row whose id matches activeTrackSongId', () => {
    const songs = [makeSong({ id: 'song-1' }), makeSong({ id: 'song-2' })]
    const wrapper = mount(RehearseSongList, { props: { songs, activeTrackSongId: 'song-2' } })

    const rows = wrapper.findAll('[data-testid="rehearse-song-row"]')
    expect(rows[0]!.find('[data-testid="rehearse-song-playing"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-testid="rehearse-song-playing"]').exists()).toBe(true)
    expect(rows[1]!.text()).toContain('Playing')
  })

  it('renders the empty-list copy instead of rows, with no crash, when there are zero songs', () => {
    const wrapper = mount(RehearseSongList, { props: { songs: [] } })

    expect(wrapper.findAll('[data-testid="rehearse-song-row"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No songs in this service yet.')
  })
})
