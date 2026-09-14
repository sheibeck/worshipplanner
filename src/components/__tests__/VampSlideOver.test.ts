import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import VampSlideOver from '../VampSlideOver.vue'
import type { Vamp } from '@/types/vamp'
import type { UploadRow } from '@/composables/useVampFileUpload'
import { VAMP_KEYS } from '@/constants/keys'

// Mirrors SongTable.test.ts's convention: mock the store modules directly
// with singleton objects rather than a real Pinia + firebase mock stack.
const mockAddVamp = vi.fn(() => Promise.resolve('new-vamp-id'))
const mockUpdateVamp = vi.fn(() => Promise.resolve())
const mockDeleteVamp = vi.fn(() => Promise.resolve())
const mockCountAssignments = vi.fn(() => Promise.resolve({ assignedAnywhere: false, upcomingServiceCount: 0 }))
let mockVamps: Vamp[] = []
const mockVampStore = {
  get vamps() {
    return mockVamps
  },
  addVamp: mockAddVamp,
  updateVamp: mockUpdateVamp,
  deleteVamp: mockDeleteVamp,
  countAssignments: mockCountAssignments,
}
vi.mock('@/stores/vamps', () => ({ useVampStore: () => mockVampStore }))

// CR-01: real refs (not plain { value: [] } objects) so <script setup>'s
// template auto-unref actually reflects mutations — a plain object here
// previously made `uploads.length`/`v-for="row in uploads"` silently
// evaluate against an unref'd non-array and never render anything, which is
// how the missing upload-feedback UI shipped without a failing test.
const mockUploads = ref<UploadRow[]>([])
const mockAnnouncement = ref('')
const mockAddFile = vi.fn()
const mockDismiss = vi.fn()
const mockReset = vi.fn()
vi.mock('@/composables/useVampFileUpload', () => ({
  useVampFileUpload: () => ({
    uploads: mockUploads,
    announcement: mockAnnouncement,
    addFile: mockAddFile,
    dismiss: mockDismiss,
    reset: mockReset,
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
    mockCountAssignments.mockClear()
    mockCountAssignments.mockImplementation(() => Promise.resolve({ assignedAnywhere: false, upcomingServiceCount: 0 }))
    mockAddFile.mockClear()
    mockDismiss.mockClear()
    mockReset.mockClear()
    mockUploads.value = []
    mockAnnouncement.value = ''
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

  describe('VampSlideOver — R440 delete warning', () => {
    it('calls countAssignments exactly once per confirm open, with the vamp id', async () => {
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()
      expect(mockCountAssignments).toHaveBeenCalledTimes(1)
      expect(mockCountAssignments).toHaveBeenCalledWith('vamp-9')

      await wrapper.get('[data-testid="vamp-delete-cancel"]').trigger('click')
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()
      expect(mockCountAssignments).toHaveBeenCalledTimes(2)
    })

    it('shows the plural warning for upcomingServiceCount 3 above the unchanged confirm body', async () => {
      mockCountAssignments.mockImplementation(() => Promise.resolve({ assignedAnywhere: true, upcomingServiceCount: 3 }))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9', name: 'Open Response' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="vamp-delete-warning"]').text()).toBe(
        'Assigned in 3 upcoming services — those slides keep their audio.',
      )
      expect(wrapper.text()).toContain('Delete "Open Response"? This cannot be undone.')
    })

    it('shows the singular warning for upcomingServiceCount 1', async () => {
      mockCountAssignments.mockImplementation(() => Promise.resolve({ assignedAnywhere: true, upcomingServiceCount: 1 }))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="vamp-delete-warning"]').text()).toBe(
        'Assigned in 1 upcoming service — those slides keep their audio.',
      )
    })

    it('renders no warning line when assignedAnywhere is true but upcomingServiceCount is 0, or nothing is assigned', async () => {
      mockCountAssignments.mockImplementation(() => Promise.resolve({ assignedAnywhere: true, upcomingServiceCount: 0 }))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="vamp-delete-warning"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="vamp-delete-warning-generic"]').exists()).toBe(false)

      mockCountAssignments.mockImplementation(() => Promise.resolve({ assignedAnywhere: false, upcomingServiceCount: 0 }))
      const wrapper2 = mountSlideOver(makeVamp({ id: 'vamp-10' }))
      await wrapper2.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()
      expect(wrapper2.find('[data-testid="vamp-delete-warning"]').exists()).toBe(false)
      expect(wrapper2.find('[data-testid="vamp-delete-warning-generic"]').exists()).toBe(false)
    })

    it('shows the generic warning when countAssignments resolves null', async () => {
      mockCountAssignments.mockImplementation(() => Promise.resolve(null as never))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="vamp-delete-warning-generic"]').text()).toBe('May be assigned to slides.')
      expect(wrapper.find('[data-testid="vamp-delete-warning"]').exists()).toBe(false)
    })

    it('shows the generic warning when countAssignments rejects', async () => {
      mockCountAssignments.mockRejectedValueOnce(new Error('denied'))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="vamp-delete-warning-generic"]').text()).toBe('May be assigned to slides.')
    })

    it('never blocks Delete while the scan is still pending', async () => {
      mockCountAssignments.mockReturnValueOnce(new Promise(() => {}))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')

      const deleteButton = wrapper.get('[data-testid="vamp-delete-confirm-button"]')
      expect(deleteButton.attributes('disabled')).toBeUndefined()
      await deleteButton.trigger('click')
      await flushPromises()

      expect(mockDeleteVamp).toHaveBeenCalledWith('vamp-9')
      expect(wrapper.emitted('deleted')).toBeTruthy()
    })

    it('still calls deleteVamp and emits deleted after a scan failure', async () => {
      mockCountAssignments.mockRejectedValueOnce(new Error('denied'))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()

      await wrapper.get('[data-testid="vamp-delete-confirm-button"]').trigger('click')
      await flushPromises()

      expect(mockDeleteVamp).toHaveBeenCalledWith('vamp-9')
      expect(wrapper.emitted('deleted')).toBeTruthy()
    })

    it('resets affectedServiceCount and scanFailed when the drawer is reopened for a different vamp', async () => {
      mockCountAssignments.mockImplementation(() => Promise.resolve({ assignedAnywhere: true, upcomingServiceCount: 2 }))
      const wrapper = mountSlideOver(makeVamp({ id: 'vamp-9' }))
      await wrapper.get('[data-testid="vamp-delete-button"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="vamp-delete-warning"]').exists()).toBe(true)

      // Close then reopen (open: false -> true) — must reset stale warning state.
      await wrapper.setProps({ open: false })
      await wrapper.setProps({ open: true, vamp: makeVamp({ id: 'vamp-10' }) })

      expect(wrapper.find('[data-testid="vamp-delete-confirm"]').exists()).toBe(false)
    })
  })

  // CR-01: a rejected/failed upload must surface visibly — previously
  // `useVampFileUpload`'s uploads/announcement were destructured-away and
  // never rendered, so this state was invisible to the user.
  it('renders a visible error row and the aria-live announcement for a rejected upload', () => {
    mockUploads.value = [
      { id: 'row-1', name: 'huge.mp3', progress: 0, status: 'rejected', message: "'huge.mp3' is too large — max 50 MB." },
    ]
    const wrapper = mountSlideOver(makeVamp())

    expect(wrapper.find('[data-testid="vamp-mp3-upload-rows"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="vamp-mp3-upload-error"]').text()).toBe(
      "'huge.mp3' is too large — max 50 MB.",
    )
  })

  it('dismissing a failed upload row calls dismiss with its id', async () => {
    mockUploads.value = [
      { id: 'row-1', name: 'huge.mp3', progress: 0, status: 'rejected', message: 'too large' },
    ]
    const wrapper = mountSlideOver(makeVamp())

    await wrapper.get('[data-testid="vamp-mp3-upload-dismiss"]').trigger('click')
    expect(mockDismiss).toHaveBeenCalledWith('row-1')
  })

  // CR-01: an in-flight upload disables the drop-zone so a second click
  // can't start a concurrent upload that races the first on updateVamp.
  it('disables the drop-zone while an upload for this vamp is in progress', () => {
    mockUploads.value = [{ id: 'row-1', name: 'track.mp3', progress: 40, status: 'uploading' }]
    const wrapper = mountSlideOver(makeVamp({ attachment: null }))

    const dropzone = wrapper.get('[data-testid="vamp-mp3-dropzone"]')
    expect(dropzone.attributes('disabled')).toBeDefined()
  })
})
