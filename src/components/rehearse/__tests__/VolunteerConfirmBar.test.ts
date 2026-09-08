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

  it('renders Confirm and Decline buttons when unconfirmed, and subscribes live', () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
    const confirm = wrapper.find('[data-testid="confirm-service-btn"]')
    const decline = wrapper.find('[data-testid="decline-service-btn"]')
    expect(confirm.exists()).toBe(true)
    expect(decline.exists()).toBe(true)
    expect(confirm.text()).toContain('Confirm')
    expect(decline.text()).toContain('Decline')
    // Neither is the active/pressed state while unconfirmed.
    expect(confirm.attributes('aria-pressed')).toBe('false')
    expect(decline.attributes('aria-pressed')).toBe('false')
  })

  it('clicking Confirm writes setDoc with the exact confirmed payload at the right path/key', async () => {
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

  it('clicking Decline writes a declined payload (confirmedAt null) for every role the volunteer holds', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: TWO_ASSIGNMENTS },
    })

    await wrapper.find('[data-testid="decline-service-btn"]').trigger('click')

    expect(mockSetDoc).toHaveBeenCalledTimes(2)
    const calls = mockSetDoc.mock.calls as unknown as [{ path: string }, Record<string, unknown>][]
    expect(calls.map((c) => c[0].path).sort()).toEqual([
      `${CONFIRMATIONS_PATH}/role-keys_dana@example.com`,
      `${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`,
    ])
    for (const [, payload] of calls) {
      expect(payload.status).toBe('declined')
      expect(payload.confirmedAt).toBeNull()
    }
  })

  it('confirms the WHOLE service — one Confirm click writes a confirmed doc for every role', async () => {
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

  it('once every role is confirmed, Confirm reads "Confirmed" and is the pressed state; clicking it again undoes (deletes) every role', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: TWO_ASSIGNMENTS },
    })

    // Only one of two confirmed -> worst-of keeps it unconfirmed (not pressed).
    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'confirmed' } },
    ])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-service-btn"]').attributes('aria-pressed')).toBe('false')

    // Both confirmed -> Confirm is pressed and labelled "Confirmed".
    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'confirmed' } },
      { id: 'role-keys_dana@example.com', data: { roleId: 'role-keys', emailLower: 'dana@example.com', status: 'confirmed' } },
    ])
    await wrapper.vm.$nextTick()
    const confirm = wrapper.find('[data-testid="confirm-service-btn"]')
    expect(confirm.attributes('aria-pressed')).toBe('true')
    expect(confirm.text()).toContain('Confirmed')

    // Clicking the already-active Confirm undoes it (delete every role's doc).
    await confirm.trigger('click')
    expect(mockDeleteDoc).toHaveBeenCalledTimes(2)
    const paths = mockDeleteDoc.mock.calls.map((c) => (c as unknown as [{ path: string }])[0].path).sort()
    expect(paths).toEqual([
      `${CONFIRMATIONS_PATH}/role-keys_dana@example.com`,
      `${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`,
    ])
  })

  it('declined: Decline reads "Declined" and is the pressed state; clicking it again undoes (deletes)', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'declined' } },
    ])
    await wrapper.vm.$nextTick()

    const decline = wrapper.find('[data-testid="decline-service-btn"]')
    expect(decline.attributes('aria-pressed')).toBe('true')
    expect(decline.text()).toContain('Declined')

    await decline.trigger('click')
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
    expect((mockDeleteDoc.mock.calls[0] as unknown as [{ path: string }])[0].path).toBe(
      `${CONFIRMATIONS_PATH}/role-vocals_dana@example.com`,
    )
  })

  it('a needsReconfirmation role shows the reconfirm hint and leaves neither button pressed', async () => {
    const wrapper = mount(VolunteerConfirmBar, {
      props: { orgId: 'org-1', serviceId: 'svc-1', myAssignments: ASSIGNMENTS },
    })

    emitSnapshot(CONFIRMATIONS_PATH, [
      { id: 'role-vocals_dana@example.com', data: { roleId: 'role-vocals', emailLower: 'dana@example.com', status: 'needsReconfirmation' } },
    ])
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="confirm-service-reconfirm-hint"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-service-btn"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-testid="decline-service-btn"]').attributes('aria-pressed')).toBe('false')
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
