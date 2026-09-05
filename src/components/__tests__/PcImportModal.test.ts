import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import PcImportModal from '../PcImportModal.vue'
import type { UpsertSongInput } from '@/types/song'
import type { UpsertSongsSummary } from '@/stores/songs'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFetchAndMapPcSongs = vi.fn<(...args: unknown[]) => Promise<UpsertSongInput[]>>(() => Promise.resolve([]))
const mockPartitionPcSongs = vi.fn<
  (...args: unknown[]) => { newSongs: UpsertSongInput[]; existingSongs: UpsertSongInput[] }
>(() => ({ newSongs: [], existingSongs: [] }))

vi.mock('@/utils/pcSongImport', () => ({
  fetchAndMapPcSongs: (...args: unknown[]) => mockFetchAndMapPcSongs(...args),
  partitionPcSongs: (...args: unknown[]) => mockPartitionPcSongs(...args),
}))

const mockUpsertSongs = vi.fn<(...args: unknown[]) => Promise<UpsertSongsSummary>>(() =>
  Promise.resolve({ added: 0, updated: 0, failed: [] }),
)
vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: [],
    upsertSongs: (...args: unknown[]) => mockUpsertSongs(...args),
  }),
}))

let mockHasPcCredentials = true
const mockPcCredentials: { appId: string; secret: string } | null = { appId: 'app-1', secret: 'secret-1' }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get hasPcCredentials() {
      return mockHasPcCredentials
    },
    get pcCredentials() {
      return mockHasPcCredentials ? mockPcCredentials : null
    },
  }),
}))

enableAutoUnmount(afterEach)

function body() {
  return new DOMWrapper(document.body)
}

function makeUpsertInput(overrides: Partial<UpsertSongInput> = {}): UpsertSongInput {
  return {
    title: 'Song',
    ccliNumber: '',
    author: '',
    themes: [],
    notes: '',
    vwTypes: [],
    tags: [],
    removedThemes: [],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    pcSongId: null,
    hidden: false,
    ...overrides,
  }
}

function mountModal(props?: Record<string, unknown>) {
  return mount(PcImportModal, {
    props: {
      open: true,
      ...props,
    },
  })
}

describe('PcImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPcCredentials = true
    mockUpsertSongs.mockResolvedValue({ added: 0, updated: 0, failed: [] })
  })

  it('idle -> fetch -> preview -> confirm -> done: shows added/updated counts from the real upsertSongs summary', async () => {
    const newSong = makeUpsertInput({ title: 'New Song' })
    const existingSong = makeUpsertInput({ title: 'Existing Song' })
    mockFetchAndMapPcSongs.mockResolvedValueOnce([newSong, existingSong])
    mockPartitionPcSongs.mockReturnValueOnce({ newSongs: [newSong], existingSongs: [existingSong] })
    mockUpsertSongs.mockResolvedValueOnce({ added: 1, updated: 0, failed: [] })

    mountModal()
    expect(body().find('[data-testid="step-idle"]').exists()).toBe(true)

    await body().find('[data-testid="import-btn"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="step-preview"]').exists()).toBe(true)

    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    // newOnly defaults true — only the new song is submitted to upsertSongs.
    expect(mockUpsertSongs).toHaveBeenCalledWith([newSong])
    expect(body().find('[data-testid="step-done"]').exists()).toBe(true)
    expect(body().find('[data-testid="done-summary"]').text()).toContain('1 song added')
    expect(body().find('[data-testid="done-failed"]').exists()).toBe(false)
  })

  // R350/ARCH-014: one bad write no longer silently stops the rest — the
  // modal must surface the failed count/titles instead of masking them.
  it('surfaces per-song failures returned by upsertSongs on the done step, without routing to the error step', async () => {
    const songA = makeUpsertInput({ title: 'Song A' })
    const songB = makeUpsertInput({ title: 'Song B' })
    mockFetchAndMapPcSongs.mockResolvedValueOnce([songA, songB])
    mockPartitionPcSongs.mockReturnValueOnce({ newSongs: [songA, songB], existingSongs: [] })
    mockUpsertSongs.mockResolvedValueOnce({
      added: 1,
      updated: 0,
      failed: [{ title: 'Song B', error: 'commit failed' }],
    })

    mountModal()
    await body().find('[data-testid="import-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="step-done"]').exists()).toBe(true)
    expect(body().find('[data-testid="step-error"]').exists()).toBe(false)
    expect(body().find('[data-testid="done-summary"]').text()).toContain('1 song failed')
    expect(body().find('[data-testid="done-failed"]').text()).toContain('Song B')
  })

  it('newOnly (default): existing songs are never submitted to upsertSongs, and the done summary reports them as skipped', async () => {
    const newSong = makeUpsertInput({ title: 'New Song' })
    const existingSong = makeUpsertInput({ title: 'Existing Song' })
    mockFetchAndMapPcSongs.mockResolvedValueOnce([newSong, existingSong])
    mockPartitionPcSongs.mockReturnValueOnce({ newSongs: [newSong], existingSongs: [existingSong] })
    mockUpsertSongs.mockResolvedValueOnce({ added: 1, updated: 0, failed: [] })

    mountModal()
    await body().find('[data-testid="import-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(mockUpsertSongs).toHaveBeenCalledWith([newSong])
    expect(body().find('[data-testid="done-summary"]').text()).toContain('1 song skipped')
  })

  it('unchecking "new songs only" submits both new and existing songs, and reports the real updated count', async () => {
    const newSong = makeUpsertInput({ title: 'New Song' })
    const existingSong = makeUpsertInput({ title: 'Existing Song' })
    mockFetchAndMapPcSongs.mockResolvedValueOnce([newSong, existingSong])
    mockPartitionPcSongs.mockReturnValueOnce({ newSongs: [newSong], existingSongs: [existingSong] })
    mockUpsertSongs.mockResolvedValueOnce({ added: 1, updated: 1, failed: [] })

    const wrapper = mountModal()
    const checkbox = body().find('#pc-import-new-only').element as HTMLInputElement
    checkbox.checked = false
    await body().find('#pc-import-new-only').trigger('change')

    await body().find('[data-testid="import-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(mockUpsertSongs).toHaveBeenCalledWith([newSong, existingSong])
    expect(body().find('[data-testid="done-summary"]').text()).toContain('1 song updated')

    await body().find('[data-testid="done-btn"]').trigger('click')
    // R350/ARCH-014: the emitted count reflects the real summary (added + updated), not the preview.
    expect(wrapper.emitted('imported')![0]).toEqual([2])
  })

  it('a thrown (non-recoverable) upsertSongs failure still routes to the error step', async () => {
    const newSong = makeUpsertInput({ title: 'New Song' })
    mockFetchAndMapPcSongs.mockResolvedValueOnce([newSong])
    mockPartitionPcSongs.mockReturnValueOnce({ newSongs: [newSong], existingSongs: [] })
    mockUpsertSongs.mockRejectedValueOnce(new Error('total failure'))

    mountModal()
    await body().find('[data-testid="import-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="confirm-btn"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="step-error"]').exists()).toBe(true)
    expect(body().find('[data-testid="error-message"]').text()).toBe('total failure')
  })

  it('a fetch failure routes to the error step and offers retry', async () => {
    mockFetchAndMapPcSongs.mockRejectedValueOnce(new Error('PC API unreachable'))

    mountModal()
    await body().find('[data-testid="import-btn"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="step-error"]').exists()).toBe(true)
    expect(body().find('[data-testid="error-message"]').text()).toBe('PC API unreachable')
    expect(body().find('[data-testid="retry-btn"]').exists()).toBe(true)
  })

  it('cancel emits close without importing anything', async () => {
    const wrapper = mountModal()
    await body().find('[data-testid="cancel-btn"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(mockUpsertSongs).not.toHaveBeenCalled()
  })
})
