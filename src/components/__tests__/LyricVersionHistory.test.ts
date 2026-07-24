import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LyricVersionHistory from '../LyricVersionHistory.vue'
import type { SongLyrics } from '@/types/songLyrics'

function makeVersion(overrides: Partial<SongLyrics> & { id: string }): SongLyrics {
  return {
    songId: 'song-1',
    sections: [],
    copyright: {
      title: 'Test Song',
      authors: ['Author'],
      ccliSongNumber: '123',
      copyrightLines: [],
      ccliLicenseNumber: '',
    },
    performanceOrder: [],
    createdAt: { toMillis: () => Date.now() - 60_000 } as never,
    updatedAt: { toMillis: () => Date.now() - 60_000 } as never,
    ...overrides,
  }
}

describe('LyricVersionHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders version list with timestamps', () => {
    const versions = [
      makeVersion({ id: 'v1', createdAt: { toMillis: () => Date.now() - 30_000 } as never }),
      makeVersion({ id: 'v2', createdAt: { toMillis: () => Date.now() - 3_600_000 } as never }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    const entries = wrapper.findAll('[data-testid="version-entry"]')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.text()).toContain('Just now')
    expect(entries[1]!.text()).toContain('1h ago')
  })

  it('shows "Current" badge on the active version', () => {
    const versions = [
      makeVersion({ id: 'v1' }),
      makeVersion({ id: 'v2' }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    const badges = wrapper.findAll('[data-testid="current-badge"]')
    expect(badges).toHaveLength(1)
    expect(badges[0]!.text()).toBe('Current')
    const entries = wrapper.findAll('[data-testid="version-entry"]')
    expect(entries[0]!.find('[data-testid="current-badge"]').exists()).toBe(true)
    expect(entries[1]!.find('[data-testid="current-badge"]').exists()).toBe(false)
  })

  it('shows revert button only on non-current versions', () => {
    const versions = [
      makeVersion({ id: 'v1' }),
      makeVersion({ id: 'v2' }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    const entries = wrapper.findAll('[data-testid="version-entry"]')
    expect(entries[0]!.find('[data-testid="revert-btn"]').exists()).toBe(false)
    expect(entries[1]!.find('[data-testid="revert-btn"]').exists()).toBe(true)
  })

  it('shows confirm dialog and emits revert on accept', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const versions = [
      makeVersion({ id: 'v1' }),
      makeVersion({ id: 'v2' }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    const revertBtn = wrapper.find('[data-testid="revert-btn"]')
    await revertBtn.trigger('click')
    expect(window.confirm).toHaveBeenCalledWith(
      'Revert to this version? Your current edits will be saved as a new version first.',
    )
    expect(wrapper.emitted('revert')).toHaveLength(1)
    expect(wrapper.emitted('revert')![0]).toEqual(['v2'])
  })

  it('does not emit revert when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const versions = [
      makeVersion({ id: 'v1' }),
      makeVersion({ id: 'v2' }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    const revertBtn = wrapper.find('[data-testid="revert-btn"]')
    await revertBtn.trigger('click')
    expect(window.confirm).toHaveBeenCalled()
    expect(wrapper.emitted('revert')).toBeUndefined()
  })

  it('renders empty state when no versions', () => {
    const wrapper = mount(LyricVersionHistory, {
      props: { versions: [], currentVersionId: '' },
    })
    expect(wrapper.text()).toContain('No versions yet')
    expect(wrapper.findAll('[data-testid="version-entry"]')).toHaveLength(0)
  })

  it('formats relative time for days', () => {
    const versions = [
      makeVersion({
        id: 'v1',
        createdAt: { toMillis: () => Date.now() - 3 * 24 * 3_600_000 } as never,
      }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    expect(wrapper.text()).toContain('3d ago')
  })

  it('handles null/invalid timestamps gracefully', () => {
    const versions = [
      makeVersion({ id: 'v1', createdAt: null as never }),
    ]
    const wrapper = mount(LyricVersionHistory, {
      props: { versions, currentVersionId: 'v1' },
    })
    expect(wrapper.text()).toContain('Unknown')
  })
})
