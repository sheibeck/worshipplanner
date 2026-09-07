/**
 * Phase 133 Plan 02 (R410) — VolunteerConfirmBar.vue: the volunteer-facing
 * "I've got it" control. Mirrors ConfigurationTab.test.ts's firebase/firestore
 * onSnapshot-callback-capture harness so the mount never touches real
 * Firestore, and useVolunteerServiceDoc.test.ts's @/firebase stub convention.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import VolunteerConfirmBar from '../VolunteerConfirmBar.vue'

enableAutoUnmount(afterEach)

const { mockOnSnapshot, snapshotCallbacks, mockUnsubscribe, mockSetDoc, mockDeleteDoc, emailState } = vi.hoisted(
  () => {
    const snapshotCallbacks: Record<
      string,
      { onNext: (snap: unknown) => void; onError: (err: unknown) => void }
    > = {}
    const mockUnsubscribe = vi.fn()
    return {
      snapshotCallbacks,
      mockUnsubscribe,
      mockSetDoc: vi.fn(() => Promise.resolve()),
      mockDeleteDoc: vi.fn(() => Promise.resolve()),
      emailState: { current: 'dana@example.com' as string | null },
      mockOnSnapshot: vi.fn(
        (
          ref: { path: string },
          onNext: (snap: unknown) => void,
          onError: (err: unknown) => void,
        ) => {
          snapshotCallbacks[ref.path] = { onNext, onError }
          return mockUnsubscribe
        },
      ),
    }
  },
)

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
}))

vi.mock('@/firebase', () => ({
  db: {},
  get auth() {
    return { get currentUser() { return emailState.current ? { email: emailState.current } : null } }
  },
}))

function emitSnapshot(path: string, docs: { id: string; data: Record<string, unknown> }[]): void {
  snapshotCallbacks[path]!.onNext({
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  })
}

const ASSIGNMENTS = [{ roleId: 'role-vocals', roleName: 'Vocals' }]
const CONFIRMATIONS_PATH = 'organizations/org-1/services/svc-1/confirmations'

describe('VolunteerConfirmBar', () => {
  beforeEach(() => {
    mockOnSnapshot.mockClear()
    mockSetDoc.mockClear()
    mockDeleteDoc.mockClear()
    mockUnsubscribe.mockClear()
    Object.keys(snapshotCallbacks).forEach((k) => delete snapshotCallbacks[k])
    emailState.current = 'dana@example.com'
  })

  it('renders nothing and opens no listener when myAssignments is empty', () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: [] },
    })
    expect(wrapper.find('[data-testid="volunteer-confirm-bar"]').exists()).toBe(false)
    expect(mockOnSnapshot).not.toHaveBeenCalled()
  })

  it('renders one "I\'ve got it" control per unconfirmed role, and subscribes live', () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="confirm-btn-role-vocals"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-state-role-vocals"]').exists()).toBe(false)
  })

  it('clicking "I\'ve got it" writes setDoc with the exact confirmed payload at the right path/key', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    await wrapper.find('[data-testid="confirm-btn-role-vocals"]').trigger('click')

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [ref, payload] = mockSetDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe(`${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`)
    expect(payload).toEqual({
      roleId: 'role-vocals',
      roleName: 'Vocals',
      emailLower: 'dana@example.com',
      status: 'confirmed',
      confirmedAt: { __serverTimestamp: true },
      updatedAt: { __serverTimestamp: true },
    })
  })

  it('a live snapshot emitting a confirmed doc flips the control to Confirmed + shows Undo', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      {
        id: 'role-vocals_dana@example.com',
        data: {
          roleId: 'role-vocals',
          roleName: 'Vocals',
          emailLower: 'dana@example.com',
          status: 'confirmed',
        },
      },
    ])
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="confirm-btn-role-vocals"]').exists()).toBe(false)
    const state = wrapper.find('[data-testid="confirm-state-role-vocals"]')
    expect(state.exists()).toBe(true)
    expect(state.text()).toContain('Confirmed')
    expect(wrapper.find('[data-testid="undo-btn-role-vocals"]').exists()).toBe(true)
  })

  it('a live snapshot emitting needsReconfirmation renders a distinct treatment with confirm still available', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      {
        id: 'role-vocals_dana@example.com',
        data: {
          roleId: 'role-vocals',
          roleName: 'Vocals',
          emailLower: 'dana@example.com',
          status: 'needsReconfirmation',
        },
      },
    ])
    await wrapper.vm.$nextTick()

    const state = wrapper.find('[data-testid="confirm-state-role-vocals"]')
    expect(state.text()).toContain('Please reconfirm')
    expect(wrapper.find('[data-testid="confirm-btn-role-vocals"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="undo-btn-role-vocals"]').exists()).toBe(false)
  })

  it('clicking Undo calls deleteDoc on the caller\'s own confirmation path', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      {
        id: 'role-vocals_dana@example.com',
        data: {
          roleId: 'role-vocals',
          roleName: 'Vocals',
          emailLower: 'dana@example.com',
          status: 'confirmed',
        },
      },
    ])
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="undo-btn-role-vocals"]').trigger('click')

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
    const [ref] = mockDeleteDoc.mock.calls[0] as [{ path: string }]
    expect(ref.path).toBe(`${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`)
  })

  it('tears down the previous listener and re-subscribes when serviceId changes', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ serviceId: 'svc-2' })

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
  })
})
