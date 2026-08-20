/**
 * Phase 70-02 — fresh test file for OwnerConsoleView.vue (no prior file
 * existed; RESEARCH.md Pitfall 5). Reuses SettingsView.test.ts's standard
 * mount/flushPromises/enableAutoUnmount harness and vi.hoisted
 * firebase/firestore mock shape, but makes onSnapshot capture its callbacks
 * KEYED BY TARGET so this file can drive both the roster (collection
 * 'superAdmins') and the appConfig (doc 'appConfig/global') subscriptions
 * independently. The auth-store mock ADDS isSuperAdmin + user.uid/user.email
 * (SettingsView's mock lacks these).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OwnerConsoleView from '../OwnerConsoleView.vue'
import { DEFAULT_APP_CONFIG } from '@/config/appConfigDefaults'

enableAutoUnmount(afterEach)

// ── firebase/firestore mock — onSnapshot callbacks captured keyed by the
//    mocked ref's `id` (doc()/collection() below both synthesize an id from
//    the path segments), so this file can drive the roster snapshot and the
//    appConfig snapshot independently without a component mount per target. ──
const { mockSetDoc, mockOnSnapshot, mockServerTimestamp, snapshotCallbacks } = vi.hoisted(() => {
  const snapshotCallbacks: Record<
    string,
    { onNext: (snap: unknown) => void; onError: (err: unknown) => void }
  > = {}
  return {
    snapshotCallbacks,
    mockSetDoc: vi.fn((_ref: unknown, _data: Record<string, unknown>, _opts?: unknown) =>
      Promise.resolve(),
    ),
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
    mockServerTimestamp: vi.fn(() => new Date('2026-08-20T12:00:00Z')),
  }
})

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ id: segments.join('/') })),
  collection: vi.fn((_db: unknown, path: string) => ({ id: path })),
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  serverTimestamp: mockServerTimestamp,
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { ok: true } }))),
}))

vi.mock('@/firebase', () => ({
  db: {},
  functions: {},
}))

// ── @/stores/auth mock — trimmed shape ADDING isSuperAdmin + user.uid/email
//    (RESEARCH Pitfall 5: SettingsView.test.ts's mock lacks these; this
//    file's roster code reads authStore.user?.uid and the appConfig store's
//    saveField reads authStore.user?.email). ──
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isSuperAdmin: true,
    user: { uid: 'owner-uid', email: 'owner@example.com' },
  }),
}))

function driveSnapshot(targetId: string, snap: unknown): void {
  snapshotCallbacks[targetId]?.onNext(snap)
}

function makeAppConfigSnap(exists: boolean, data?: Record<string, unknown>) {
  return { exists: () => exists, data: () => data }
}

function makeRosterSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockSetDoc.mockClear()
  mockOnSnapshot.mockClear()
  for (const key of Object.keys(snapshotCallbacks)) delete snapshotCallbacks[key]
})

function mountViewSync() {
  return mount(OwnerConsoleView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
      },
    },
  })
}

async function mountView() {
  const wrapper = mountViewSync()
  await flushPromises()
  return wrapper
}

describe('OwnerConsoleView — Platform configuration (Phase 70)', () => {
  it('subscribes to both the roster and appConfig/global on mount, and unsubscribes on unmount', async () => {
    const wrapper = await mountView()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    expect(snapshotCallbacks['superAdmins']).toBeDefined()
    expect(snapshotCallbacks['appConfig/global']).toBeDefined()

    wrapper.unmount()
    expect(snapshotCallbacks['superAdmins']).toBeUndefined()
    expect(snapshotCallbacks['appConfig/global']).toBeUndefined()
  })

  it('renders the four config cards and the deploy-time note, and the Phase 68 placeholder text is gone', async () => {
    const wrapper = await mountView()
    driveSnapshot('appConfig/global', makeAppConfigSnap(false))
    await flushPromises()

    expect(wrapper.text()).toContain('Cleanup')
    expect(wrapper.text()).toContain('AI Proxy')
    expect(wrapper.text()).toContain('Messaging')
    expect(wrapper.text()).toContain('Sender')
    expect(wrapper.text()).toContain('Deploy-time settings (requires redeploy)')
    expect(wrapper.text()).not.toContain('Config-editor panels will appear here in a future release.')
  })

  it('shows the DEFAULT_APP_CONFIG value with a (default) badge when the doc is missing (effective value)', async () => {
    const wrapper = await mountView()
    driveSnapshot('appConfig/global', makeAppConfigSnap(false))
    await flushPromises()

    const mediaDaysInput = wrapper.findAll('input[type="number"]')[0]
    expect((mediaDaysInput!.element as HTMLInputElement).valueAsNumber).toBe(
      DEFAULT_APP_CONFIG.retention.mediaDays,
    )
    expect(wrapper.text()).toContain('(default)')
  })

  it('shows the merged value without a badge when the doc is present (effective value)', async () => {
    const wrapper = await mountView()
    driveSnapshot(
      'appConfig/global',
      makeAppConfigSnap(true, {
        retention: { mediaDays: 45 },
        updatedBy: 'owner@example.com',
        updatedAt: new Date('2026-08-20T15:45:00-04:00'),
      }),
    )
    await flushPromises()

    const mediaDaysInput = wrapper.findAll('input[type="number"]')[0]
    expect((mediaDaysInput!.element as HTMLInputElement).valueAsNumber).toBe(45)
  })

  it('renders the single global provenance line when updatedBy/updatedAt are present (provenance)', async () => {
    const wrapper = await mountView()
    driveSnapshot(
      'appConfig/global',
      makeAppConfigSnap(true, {
        updatedBy: 'owner@example.com',
        updatedAt: new Date('2026-08-20T15:45:00-04:00'),
      }),
    )
    await flushPromises()

    expect(wrapper.text()).toContain('Last changed by owner@example.com at')
  })

  it('renders no provenance line when updatedBy/updatedAt are absent (provenance)', async () => {
    const wrapper = await mountView()
    driveSnapshot('appConfig/global', makeAppConfigSnap(false))
    await flushPromises()

    expect(wrapper.text()).not.toContain('Last changed by')
  })

  it('still renders the roster card and its subscription unaffected', async () => {
    const wrapper = await mountView()
    driveSnapshot('appConfig/global', makeAppConfigSnap(false))
    driveSnapshot(
      'superAdmins',
      makeRosterSnap([{ id: 'owner-uid', data: { email: 'owner@example.com', grantedAt: null } }]),
    )
    await flushPromises()

    expect(wrapper.text()).toContain('Super-admins')
    expect(wrapper.text()).toContain('owner@example.com')
    expect(wrapper.text()).toContain('You') // current user row never shows Revoke
  })
})
