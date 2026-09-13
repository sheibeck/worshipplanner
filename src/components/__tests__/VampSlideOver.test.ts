import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VampSlideOver from '../VampSlideOver.vue'
import type { Vamp } from '@/types/vamp'
import { VAMP_KEYS } from '@/constants/keys'

// Mirrors SongTable.test.ts's convention: mock the store modules directly
// with singleton objects rather than a real Pinia + firebase mock stack.
const mockAddVamp = vi.fn(() => Promise.resolve('new-vamp-id'))
const mockUpdateVamp = vi.fn(() => Promise.resolve())
const mockDeleteVamp = vi.fn(() => Promise.resolve())
let mockVamps: Vamp[] = []
const mockVampStore = {
  get vamps() {
    return mockVamps
  },
  addVamp: mockAddVamp,
  updateVamp: mockUpdateVamp,
  deleteVamp: mockDeleteVamp,
}
vi.mock('@/stores/vamps', () => ({ useVampStore: () => mockVampStore }))

const mockAddFile = vi.fn()
vi.mock('@/composables/useVampFileUpload', () => ({
  useVampFileUpload: () => ({
    uploads: { value: [] },
    announcement: { value: '' },
    addFile: mockAddFile,
    dismiss: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ orgId: 'org-1', user: { uid: 'user-1' } }),
}))

function makeVamp(overrides: Partial<Vamp> = {}): Vamp {
  return {
    id: 'vamp-1',
    name: 'Open Response',
    key: 'G',
    tempo: '68 bpm',
    attachment: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  }
}

function mountSlideOver(vamp: Vamp | null = makeVamp()) {
  mockVamps = vamp ? [vamp] : []
  return mount(VampSlideOver, {
    props: { open: true, vamp },
    global: {
      // Render Teleport's default slot in place — content actually teleported
      // to document.body isn't reachable via wrapper.find/findAll (mirrors
      // SongSlideOver.test.ts's convention).
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('VampSlideOver', () => {
  beforeEach(() => {
    mockAddVamp.mockClear()
    mockUpdateVamp.mockClear()
    mockDeleteVamp.mockClear()
    mockAddFile.mockClear()
    mockVamps = []
  })

  it('renders exactly the 12 VAMP_KEYS chips, and clicking one marks it selected', async () => {
    const wrapper = mountSlideOver(makeVamp({ key: 'G' }))
    const chips = VAMP_KEYS.map((k) => wrapper.find(`[data-testid="vamp-key-chip-${k}"]`))
    expect(chips.every((c) => c.exists())).toBe(true)
    expect(chips).toHaveLength(12)

    const gChip = wrapper.get('[data-testid="vamp-key-chip-G"]')
    expect(gChip.classes().join(' ')).toContain('bg-indigo-600')

    const dChip = wrapper.get('[data-testid="vamp-key-chip-D"]')
    await dChip.trigger('click')
    expect(dChip.classes().join(' ')).toContain('bg-indigo-600')
    expect(gChip.classes().join(' ')).not.toContain('bg-indigo-600')
  })

  it('renders the dashed drop-zone when there is no attachment, and the fileName + a play control when there is one', () => {
    const emptyWrapper = mountSlideOver(makeVamp({ attachment: null }))
    expect(emptyWrapper.find('[data-testid="vamp-mp3-dropzone"]').exists()).toBe(true)
    expect(emptyWrapper.find('[data-testid="vamp-mp3-play"]').exists()).toBe(false)

    const withAttachmentWrapper = mountSlideOver(
      makeVamp({
        attachment: {
          storagePath: 'orgs/org-1/vamp-files/vamp-1/u1/track.mp3',
          downloadUrl: 'https://example.com/track.mp3',
          fileName: 'track.mp3',
          mimeType: 'audio/mpeg',
          sizeBytes: 100,
          createdAt: {} as never,
          createdBy: 'user-1',
        },
      }),
    )
    expect(withAttachmentWrapper.find('[data-testid="vamp-mp3-dropzone"]').exists()).toBe(false)
    expect(withAttachmentWrapper.text()).toContain('track.mp3')
    expect(withAttachmentWrapper.find('[data-testid="vamp-mp3-play"]').exists()).toBe(true)
  })

  it('Save on a new vamp calls addVamp and keeps the drawer open (does not emit close or saved)', async () => {
    const wrapper = mountSlideOver(null)
    await wrapper.get('[data-testid="vamp-name-input"]').setValue('New Vamp')
    await wrapper.get('[data-testid="vamp-save-button"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(mockAddVamp).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('close')).toBeFalsy()
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  it('the Delete-vamp button reveals a confirm card, and confirming calls deleteVamp then emits deleted', async () => {
    const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
    await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
    expect(wrapper.find('[data-testid="vamp-delete-confirm"]').exists()).toBe(true)
    expect(mockDeleteVamp).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="vamp-delete-confirm-button"]').trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(mockDeleteVamp).toHaveBeenCalledWith('vamp-9')
    expect(wrapper.emitted('deleted')).toBeTruthy()
  })
})
