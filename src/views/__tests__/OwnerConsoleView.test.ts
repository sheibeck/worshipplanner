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

// ── vue-router mock (Phase 72) — mirrors QuarterShareView.test.ts's harness:
//    a mutable `mockRouteQuery` object and a spy-able `router.replace` that
//    writes its `query` argument back into `mockRouteQuery` so click → URL →
//    pane round-trips are observable. `/owner-console` has no route params,
//    so unlike QuarterShareView's mock, `params` is omitted here. ──
const mockRouterReplace = vi.fn((to: { query?: Record<string, unknown> }) => {
  if (to?.query) Object.assign(mockRouteQuery, to.query)
  return Promise.resolve()
})
let mockRouteQuery: Record<string, unknown> = {}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    query: mockRouteQuery,
  })),
  useRouter: vi.fn(() => ({
    replace: mockRouterReplace,
  })),
}))

/**
 * Walks an element's ancestor chain checking for an inline `display: none`
 * (how `v-show` toggles visibility) — VTU's own `isVisible()` does not
 * reliably reflect an ancestor's inline style in this jsdom environment
 * (ServiceEditorView.test.ts precedent). Do NOT use `wrapper.text()` to
 * distinguish panes either — v-show leaves the hidden pane's text in the DOM.
 */
function isVShowHidden(wrapper: { element: Element }): boolean {
  let el: HTMLElement | null = wrapper.element as HTMLElement
  while (el) {
    if (el.style?.display === 'none') return true
    el = el.parentElement
  }
  return false
}

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
  mockRouteQuery = {}
  mockRouterReplace.mockClear()
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

describe('OwnerConsoleView — tabs (Phase 72)', () => {
  it('defaults to the Configuration tab with no query, rendering both tab buttons (R193)', async () => {
    const wrapper = await mountView()

    const configPanel = wrapper.get('[data-testid="configuration-panel"]')
    const orgsPanel = wrapper.get('[data-testid="organizations-panel"]')
    expect(isVShowHidden(configPanel)).toBe(false)
    expect(isVShowHidden(orgsPanel)).toBe(true)

    const buttons = wrapper.findAll('button').map((b) => b.text())
    expect(buttons).toContain('Configuration')
    expect(buttons).toContain('Organizations')
  })

  it('deep-links directly to the Organizations pane when ?tab=organizations is set before mount (R195)', async () => {
    mockRouteQuery = { tab: 'organizations' }
    const wrapper = await mountView()

    const configPanel = wrapper.get('[data-testid="configuration-panel"]')
    const orgsPanel = wrapper.get('[data-testid="organizations-panel"]')
    expect(isVShowHidden(orgsPanel)).toBe(false)
    expect(isVShowHidden(configPanel)).toBe(true)
  })

  it('normalizes an unrecognized tab query value to Configuration', async () => {
    mockRouteQuery = { tab: 'not-a-tab' }
    const wrapper = await mountView()

    const configPanel = wrapper.get('[data-testid="configuration-panel"]')
    expect(isVShowHidden(configPanel)).toBe(false)
  })

  it('clicking the Organizations tab switches panes and calls router.replace once (not push) with tab: organizations (R195)', async () => {
    const wrapper = await mountView()

    const orgsButton = wrapper.findAll('button').find((b) => b.text() === 'Organizations')!
    await orgsButton.trigger('click')

    const orgsPanel = wrapper.get('[data-testid="organizations-panel"]')
    const configPanel = wrapper.get('[data-testid="configuration-panel"]')
    expect(isVShowHidden(orgsPanel)).toBe(false)
    expect(isVShowHidden(configPanel)).toBe(true)

    expect(mockRouterReplace).toHaveBeenCalledTimes(1)
    const call = mockRouterReplace.mock.calls[0]![0] as { query: Record<string, unknown> }
    expect(call.query.tab).toBe('organizations')
  })

  it('does not call router.replace again when clicking the already-active tab', async () => {
    const wrapper = await mountView()

    const configButton = wrapper.findAll('button').find((b) => b.text() === 'Configuration')!
    await configButton.trigger('click')

    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('does not re-subscribe when switching tabs and back (v-show invariant)', async () => {
    const wrapper = await mountView()
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

    const orgsButton = wrapper.findAll('button').find((b) => b.text() === 'Organizations')!
    await orgsButton.trigger('click')
    const configButton = wrapper.findAll('button').find((b) => b.text() === 'Configuration')!
    await configButton.trigger('click')

    // Still 2 — ConfigurationTab stays mounted under v-show (never torn down
    // and remounted by a tab switch), so its onMounted subscriptions
    // (superAdmins onSnapshot + appConfigStore.subscribe) never re-fire.
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
  })
})
