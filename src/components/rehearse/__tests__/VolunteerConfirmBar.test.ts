/**
 * Phase 133 Plan 02 (R410) — VolunteerConfirmBar.vue: the volunteer-facing
 * confirmation control. Reworked at UAT (2026-09-08) from per-role "I've got it"
 * pills to a single prominent primary "Confirm service" button that confirms the
 * volunteer's WHOLE responsibility (all their roles) for the service at once.
 * Mirrors ConfigurationTab.test.ts's firebase/firestore onSnapshot-callback-
 * capture harness so the mount never touches real Firestore.
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
const TWO_ASSIGNMENTS = [
  { roleId: 'role-vocals', roleName: 'Vocals' },
  { roleId: 'role-keys', roleName: 'Keys' },
]
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

  it('renders one prominent "Confirm service" button when unconfirmed, and subscribes live', () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
    const btn = wrapper.find('[data-testid="confirm-service-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Confirm service')
    expect(wrapper.find('[data-testid="confirm-service-state"]').exists()).toBe(false)
  })

  it('clicking "Confirm service" writes setDoc with the exact confirmed payload at the right path/key', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    await wrapper.find('[data-testid="confirm-service-btn"]').trigger('click')

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [ref, payload] = mockSetDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>]
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

  it('confirms the WHOLE service — one click writes a confirmed doc for every role the volunteer holds', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: TWO_ASSIGNMENTS },
    })

    await wrapper.find('[data-testid="confirm-service-btn"]').trigger('click')

    expect(mockSetDoc).toHaveBeenCalledTimes(2)
    const paths = mockSetDoc.mock.calls.map((c) => (c as unknown as [{ path: string }])[0].path).sort()
    expect(paths).toEqual([
      `${CONFIRMATIONS_PATH}/role-keys_dana@example.com`,
      `${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`,
    ])
  })

  it('flips to a single "confirmed for this service" state (+ Undo) once every role is confirmed', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: TWO_ASSIGNMENTS },
    })

    // Only one of the two roles confirmed -> still shows the CTA (worst-of).
    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'confirmed' } },
    ])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-service-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-service-state"]').exists()).toBe(false)

    // Both roles confirmed -> confirmed state.
    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'confirmed' } },
      { id: 'role-keys_dana@example.com', data: { roleId: 'role-keys', emailLower: 'dana@example.com', status: 'confirmed' } },
    ])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-service-btn"]').exists()).toBe(false)
    const state = wrapper.find('[data-testid="confirm-service-state"]')
    expect(state.exists()).toBe(true)
    expect(state.text()).toContain("You're confirmed for this service")
    expect(wrapper.find('[data-testid="unconfirm-service-btn"]').exists()).toBe(true)
  })

  it('a needsReconfirmation role resurfaces a prominent "Reconfirm service" button', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'needsReconfirmation' } },
    ])
    await wrapper.vm.$nextTick()

    const btn = wrapper.find('[data-testid="reconfirm-service-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Reconfirm service')
    expect(wrapper.find('[data-testid="confirm-service-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="unconfirm-service-btn"]').exists()).toBe(false)
  })

  it('clicking Undo deletes the confirmation doc for every role the volunteer holds', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: TWO_ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'confirmed' } },
      { id: 'role-keys_dana@example.com', data: { roleId: 'role-keys', emailLower: 'dana@example.com', status: 'confirmed' } },
    ])
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="unconfirm-service-btn"]').trigger('click')

    expect(mockDeleteDoc).toHaveBeenCalledTimes(2)
    const paths = mockDeleteDoc.mock.calls.map((c) => (c as unknown as [{ path: string }])[0].path).sort()
    expect(paths).toEqual([
      `${CONFIRMATIONS_PATH}/role-keys_dana@example.com`,
      `${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`,
    ])
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
