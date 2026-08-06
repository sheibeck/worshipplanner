/**
 * Wave 0 harness (Phase 39, Plan 01). Mounts SettingsView.vue against **unmodified**
 * source and asserts only behavior that is true today — no AI section, no AI toggle,
 * and no Planning Center enable toggle exist yet (those land in 39-03).
 *
 * The auth-store mock below deliberately carries a `settings` object exposing
 * `aiEnabled` / `pcEnabled` / `vwModeEnabled` that the real `@/stores/auth` store
 * does NOT have yet — it is seeded here on purpose so Waves 2 and 3 can extend this
 * file with real assertions instead of first having to invent the mock shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'

// ── firebase/firestore mock (copied verbatim in shape from
//    src/stores/__tests__/auth.test.ts:31-49). `mockUpdateDoc`/`mockGetDoc` are
//    declared via vi.hoisted so they're initialized before the hoisted vi.mock
//    factory below runs, and stay reachable from test bodies so a later wave can
//    assert the toggle save handlers' Firestore payload shape. ──
const { mockUpdateDoc, mockGetDoc } = vi.hoisted(() => {
  return {
    mockUpdateDoc: vi.fn(() => Promise.resolve()),
    mockGetDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => false,
        data: () => null,
      }),
    ),
  }
})

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: mockGetDoc,
  onSnapshot: vi.fn(() => () => {}),
  updateDoc: mockUpdateDoc,
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-org-id' })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  serverTimestamp: vi.fn(() => new Date()),
}))

vi.mock('@/firebase', () => ({
  db: {},
}))

vi.mock('@/utils/planningCenterApi', () => ({
  validatePcCredentials: vi.fn(() => Promise.resolve({ valid: true })),
}))

vi.mock('@/utils/slug', () => ({
  deriveSlug: vi.fn((s: string) => s),
  claimSlug: vi.fn((s: string) => Promise.resolve(s)),
}))

// ── @/stores/auth mock — module-scope mutable state exposed via getters, the
//    same shape SongTable.test.ts:39 established (`get vwModeEnabled() { ... }`),
//    so a later wave can flip a toggle between assertions without rebuilding the
//    mock factory. ──
let mockOrgId: string | null = 'org-1'
let mockOrgName: string | null = 'Test Church'
let mockOrgSlug: string | null = 'test-church'
let mockIsEditor = true
let mockHasPcCredentials = false
let mockPcAppId: string | null = null
let mockPcSecret: string | null = null
let mockVwModeEnabled = true
let mockAiEnabled = true
let mockPcEnabled = true
let mockSettingsVwModeEnabled = true

const mockSetPcCredentials = vi.fn()

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get orgId() {
      return mockOrgId
    },
    get orgName() {
      return mockOrgName
    },
    get orgSlug() {
      return mockOrgSlug
    },
    get isEditor() {
      return mockIsEditor
    },
    get hasPcCredentials() {
      return mockHasPcCredentials
    },
    get pcAppId() {
      return mockPcAppId
    },
    get pcSecret() {
      return mockPcSecret
    },
    get vwModeEnabled() {
      return mockVwModeEnabled
    },
    setPcCredentials: mockSetPcCredentials,
    // Forward-compatible shape — `settings` does not exist on the real store
    // until 39-02. Seeded here so Waves 2/3 add assertions, not plumbing.
    settings: {
      get aiEnabled() {
        return mockAiEnabled
      },
      get pcEnabled() {
        return mockPcEnabled
      },
      get vwModeEnabled() {
        return mockSettingsVwModeEnabled
      },
    },
  }),
}))

function mountSettingsView() {
  return mount(SettingsView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('SettingsView (Wave 0 harness — Phase 39)', () => {
  beforeEach(() => {
    mockOrgId = 'org-1'
    mockOrgName = 'Test Church'
    mockOrgSlug = 'test-church'
    mockIsEditor = true
    mockHasPcCredentials = false
    mockPcAppId = null
    mockPcSecret = null
    mockVwModeEnabled = true
    mockAiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('renders the Planning Center Integration heading', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Planning Center Integration')
  })

  it('renders the Vertical Worship heading', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Vertical Worship')
  })
})
