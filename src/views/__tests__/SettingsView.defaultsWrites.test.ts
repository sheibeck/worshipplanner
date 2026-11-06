import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

// What "Save defaults" really writes. The real SettingsView save handler runs against the real
// auth store, and every Firestore write function records the document it targets. SettingsView.test.ts
// mocks the store, so it cannot see a write. See ADR-0249 (docs/adr/0249-new-services-start-with-a-default-rehearsal.md)

enableAutoUnmount(afterEach)

const h = vi.hoisted(() => ({
  writes: [] as { fn: string; path: string; data?: unknown }[],
  record(fn: string, ref: unknown, data?: unknown) {
    h.writes.push({ fn, path: (ref as { path?: string }).path ?? '<no path>', data })
  },
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  getIdTokenResult: vi.fn(() => Promise.resolve({ claims: {} })),
  onAuthStateChanged: vi.fn((_auth: unknown, callback: (u: unknown) => void) => {
    ;(globalThis as Record<string, unknown>).__settingsAuthCallback = callback
    return () => {}
  }),
}))

vi.mock('firebase/firestore', () => {
  const ORG_DOC = {
    name: 'Test Church',
    slug: 'test-church',
    settings: {
      rehearsalDefaultWeekday: 3,
      rehearsalTimeDefaults: ['18:30'],
      reportTimeDefault: '17:45',
    },
  }
  const snapFor = (data: unknown) => ({ exists: () => data !== null, data: () => data })
  return {
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: vi.fn((ref: { path: string }) => {
      if (ref.path === 'users/test-uid') return Promise.resolve(snapFor({ orgIds: ['org-1'] }))
      if (ref.path === 'organizations/org-1') return Promise.resolve(snapFor(ORG_DOC))
      return Promise.resolve(snapFor(null))
    }),
    onSnapshot: vi.fn(() => () => {}),
    updateDoc: vi.fn((ref: unknown, data: unknown) => {
      h.record('updateDoc', ref, data)
      return Promise.resolve()
    }),
    setDoc: vi.fn((ref: unknown, data: unknown) => {
      h.record('setDoc', ref, data)
      return Promise.resolve()
    }),
    addDoc: vi.fn((ref: unknown, data: unknown) => {
      h.record('addDoc', ref, data)
      return Promise.resolve({ id: 'new-id' })
    }),
    deleteDoc: vi.fn((ref: unknown) => {
      h.record('deleteDoc', ref)
      return Promise.resolve()
    }),
    writeBatch: vi.fn(() => ({
      set: (ref: unknown, data: unknown) => h.record('batch.set', ref, data),
      update: (ref: unknown, data: unknown) => h.record('batch.update', ref, data),
      delete: (ref: unknown) => h.record('batch.delete', ref),
      commit: vi.fn(() => Promise.resolve()),
    })),
    runTransaction: vi.fn(async (_db: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        get: vi.fn(),
        set: (ref: unknown, data: unknown) => h.record('tx.set', ref, data),
        update: (ref: unknown, data: unknown) => h.record('tx.update', ref, data),
        delete: (ref: unknown) => h.record('tx.delete', ref),
      }),
    ),
    serverTimestamp: vi.fn(() => new Date()),
    arrayUnion: vi.fn((v: unknown) => ({ __arrayUnion: v })),
  }
})

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
vi.mock('@/stores/orgScopedStores', () => ({ resetOrgScopedStores: vi.fn() }))
vi.mock('@/utils/planningCenterApi', () => ({
  validatePcCredentials: vi.fn(() => Promise.resolve({ valid: true })),
}))
vi.mock('@/utils/slug', () => ({
  deriveSlug: vi.fn((s: string) => s),
  claimSlug: vi.fn((s: string) => Promise.resolve(s)),
}))
vi.mock('@/utils/slideTypography', async () => {
  const actual = await vi.importActual<typeof import('@/utils/slideTypography')>('@/utils/slideTypography')
  return { ...actual, loadFontCss: vi.fn(() => Promise.resolve()) }
})

import SettingsView from '../SettingsView.vue'
import { useAuthStore } from '@/stores/auth'

describe('Save defaults, against the real auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    h.writes.length = 0
    try {
      sessionStorage.clear()
      localStorage.clear()
    } catch {
      /* jsdom may not expose storage in every config */
    }
  })

  it('writes only the organization document and no service when the defaults are saved (AC-RHD-09)', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    const callback = (globalThis as Record<string, unknown>).__settingsAuthCallback as (u: unknown) => Promise<void>
    await callback({ uid: 'test-uid', email: 'test@example.com', displayName: 'Test User', photoURL: null })
    authStore.userRole = 'editor'
    expect(authStore.orgId).toBe('org-1')
    expect(authStore.settings.rehearsalDefaultWeekday).toBe(3)

    const wrapper = mount(SettingsView, {
      global: { plugins: [pinia], stubs: { AppShell: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    h.writes.length = 0

    const select = wrapper.get('[data-testid="rehearsal-default-day-select"]')
    ;(select.element as HTMLSelectElement).selectedIndex = 6 // Friday
    await select.trigger('change')
    await wrapper.get('[data-testid="save-rehearsal-defaults-btn"]').trigger('click')
    await flushPromises()

    // The save really happened, through the real store.
    expect(authStore.settings.rehearsalDefaultWeekday).toBe(5)
    expect(h.writes.length).toBeGreaterThan(0)
    for (const w of h.writes) {
      expect(w.path).toBe('organizations/org-1')
      expect(w.path).not.toContain('services')
    }
    const patch = h.writes[0]!.data as Record<string, unknown>
    expect(Object.keys(patch).length).toBeGreaterThan(0)
    expect(Object.keys(patch).every((k) => k.startsWith('settings.'))).toBe(true)
  })
})
