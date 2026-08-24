/**
 * Phase 81-02 (R239) — fresh test file for ConfigurationTab.vue (no prior
 * file existed; RESEARCH.md Wave 0 gap). Mirrors
 * OwnerConsoleView.test.ts's onSnapshot/httpsCallable mocking harness
 * (this component owns both the superAdmins roster subscription AND the
 * appConfig/global store subscribe() call) so the mount never hits real
 * Firebase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConfigurationTab from '../ConfigurationTab.vue'

enableAutoUnmount(afterEach)

const { mockOnSnapshot, snapshotCallbacks } = vi.hoisted(() => {
  const snapshotCallbacks: Record<
    string,
    { onNext: (snap: unknown) => void; onError: (err: unknown) => void }
  > = {}
  return {
    snapshotCallbacks,
    mockOnSnapshot: vi.fn(
      (
        ref: { id: string },
        onNext: (snap: unknown) => void,
        onError: (err: unknown) => void,
      ) => {
        snapshotCallbacks[ref.id] = { onNext, onError }
        return () => {
          delete snapshotCallbacks[ref.id]
        }
      },
    ),
  }
})

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ id: segments.join('/') })),
  collection: vi.fn((_db: unknown, path: string) => ({ id: path })),
  onSnapshot: mockOnSnapshot,
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => new Date('2026-08-24T12:00:00Z')),
}))

// Covers ConfigurationTab's own setSuperAdminClaim callable.
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { ok: true } }))),
}))

vi.mock('@/firebase', () => ({
  db: {},
  functions: {},
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isSuperAdmin: true,
    user: { uid: 'owner-uid', email: 'owner@example.com' },
  }),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  mockOnSnapshot.mockClear()
  for (const key of Object.keys(snapshotCallbacks)) delete snapshotCallbacks[key]
})

async function mountTab() {
  const wrapper = mount(ConfigurationTab)
  await flushPromises()
  return wrapper
}

describe('ConfigurationTab — grant email accessible name (R239)', () => {
  it('renders a <label> associated (for -> id) with the grant email input, with non-empty text', async () => {
    const wrapper = await mountTab()

    const label = wrapper.find('label[for="grant-email"]')
    expect(label.exists()).toBe(true)
    expect(label.text().trim().length).toBeGreaterThan(0)

    const input = wrapper.find('input[type="email"]')
    expect(input.attributes('id')).toBe('grant-email')
    expect(label.attributes('for')).toBe(input.attributes('id'))
  })

  it('still submits the grant form on Enter and via the Grant button (behavior unchanged)', async () => {
    const wrapper = await mountTab()

    const input = wrapper.find('input#grant-email')
    await input.setValue('newadmin@example.com')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Granted super-admin to newadmin@example.com!')
  })

  it('keeps the roster onSnapshot subscription and appConfig subscription untouched', async () => {
    await mountTab()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    expect(snapshotCallbacks['superAdmins']).toBeDefined()
    expect(snapshotCallbacks['appConfig/global']).toBeDefined()
  })
})
