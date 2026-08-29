/**
 * Phase 92 Plan 02 (R267/R268/R269). Behavioral coverage for MonitorSetupView.vue's
 * detect/assign/persist state machine.
 *
 * Unlike SettingsView.test.ts's harness, MonitorSetupView.vue imports NO store
 * (`@/stores/auth` is never referenced) — only AppShell (stubbed here to a plain
 * passthrough `<slot />`) and the pure, framework-free `@/utils/monitorConfig`
 * module, which is exercised for REAL against jsdom's localStorage rather than
 * mocked. `window.getScreenDetails` is absent from jsdom by default (the Window
 * Management API is unimplemented there), so the "unavailable" path requires no
 * setup at all; "granted"/"denied" paths install/remove a `vi.fn()` on `window`
 * per test via the helpers below.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import MonitorSetupView from '../MonitorSetupView.vue'
import {
  MONITOR_CONFIG_STORAGE_KEY,
  computeFingerprint,
  saveMapping,
  type MonitorMapping,
  type ScreenLike,
} from '@/utils/monitorConfig'

enableAutoUnmount(afterEach)

function makeScreen(overrides: Partial<ScreenLike> = {}): ScreenLike {
  return {
    label: 'Screen',
    width: 1920,
    height: 1080,
    left: 0,
    top: 0,
    isPrimary: true,
    ...overrides,
  }
}

/** Installs a resolving getScreenDetails() mock (the "granted" path). */
function installGetScreenDetails(screens: ScreenLike[]) {
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()
  const fn = vi.fn(() =>
    Promise.resolve({ screens, addEventListener, removeEventListener }),
  )
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return fn
}

/** Installs a rejecting getScreenDetails() mock (the "denied" path). */
function installDeniedGetScreenDetails() {
  const fn = vi.fn(() => Promise.reject(new Error('permission denied')))
  ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = fn
  return fn
}

function mountView() {
  return mount(MonitorSetupView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        // Phase 98: FullscreenSetupPanel owns its own readiness composable
        // (navigator.permissions.query) — stubbed here so these view tests
        // stay decoupled from that composable and assert only on presence/
        // placement, matching FullscreenSetupPanel.test.ts's own coverage of
        // its internal states.
        FullscreenSetupPanel: { template: '<div data-testid="fullscreen-setup-panel" />' },
      },
    },
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
  vi.restoreAllMocks()
})

describe('MonitorSetupView — unavailable path (State D, R269)', () => {
  it('renders the unavailable fallback copy with no Detect button when getScreenDetails is absent', async () => {
    expect('getScreenDetails' in window).toBe(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain("Your browser can't auto-detect monitors")
    expect(wrapper.find('[data-testid="detect-button"]').exists()).toBe(false)
  })
})

describe('MonitorSetupView — denied path (State C, R269)', () => {
  it('renders the denied fallback copy after a rejected getScreenDetails() call', async () => {
    installDeniedGetScreenDetails()
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("No problem — let's set this up by hand")
  })
})

describe('MonitorSetupView — granted, fresh (State B, R267)', () => {
  it('renders one card per detected screen with nothing pre-selected and Save disabled', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    installGetScreenDetails(screens)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
  })
})

describe('MonitorSetupView — synchronous permission-call contract (Pitfall 1)', () => {
  it('calls window.getScreenDetails synchronously from the Detect click handler, before any awaited microtask resolves', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const getScreenDetailsMock = installGetScreenDetails(screens)
    const wrapper = mountView()
    await flushPromises()

    expect(getScreenDetailsMock).not.toHaveBeenCalled()
    // `.trigger('click')` dispatches the DOM event synchronously before it
    // returns a promise for `nextTick()` — the assertion below runs BEFORE
    // that promise is awaited, so it proves the call fired inside the
    // synchronous portion of the click handler with no intervening `await`.
    const clickSettled = wrapper.get('[data-testid="detect-button"]').trigger('click')
    expect(getScreenDetailsMock).toHaveBeenCalledTimes(1)

    await clickSettled
    await flushPromises()
  })
})

describe('MonitorSetupView — persistence round-trip + matched reload (State B2, R268)', () => {
  it('persists the chosen assignments under MONITOR_CONFIG_STORAGE_KEY and a same-layout remount renders the matched summary', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)

    installGetScreenDetails(screens)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')

    await wrapper.get('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Saved for this device')

    const raw = localStorage.getItem(MONITOR_CONFIG_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!) as MonitorMapping
    const persistedSet = new Set(persisted.assignments.map((a) => `${a.fingerprint}::${a.role}`))
    expect(persistedSet).toEqual(new Set([`${fpA}::audience`, `${fpB}::confidence`]))

    wrapper.unmount()

    // Same fake screens on a fresh mount — the saved mapping must be reused
    // silently (State B2), not re-prompted.
    const secondWrapper = mountView()
    await flushPromises()
    await secondWrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    expect(secondWrapper.text()).toContain('Your displays are set up')
    expect(secondWrapper.find('[data-testid="save-button"]').exists()).toBe(false)
  })
})

describe('MonitorSetupView — layout-changed reprompt (State B3, R268)', () => {
  it('renders the amber layout-changed banner above a blank editable grid when the saved fingerprints no longer match', async () => {
    // Seed a saved mapping (via the real saveMapping) for screens that will
    // NOT match the live screens detected below.
    const staleScreens = [makeScreen({ label: 'Old Front' }), makeScreen({ label: 'Old Stage', left: 1920 })]
    saveMapping({
      assignments: [
        { fingerprint: computeFingerprint(staleScreens[0]!), role: 'audience' },
        { fingerprint: computeFingerprint(staleScreens[1]!), role: 'confidence' },
      ],
      savedAt: Date.now(),
    })

    const liveScreens = [makeScreen({ label: 'New Front' }), makeScreen({ label: 'New Stage', left: 1920 })]
    installGetScreenDetails(liveScreens)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Your monitor setup changed')

    const fpA = computeFingerprint(liveScreens[0]!)
    const fpB = computeFingerprint(liveScreens[1]!)
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
  })
})

describe('MonitorSetupView — same-monitor validation blocks Save', () => {
  // NOTE: `onSelectRole`'s own cross-card exclusivity guard (parent view —
  // see 92-01-SUMMARY.md's "key-decisions") makes it IMPOSSIBLE to drive
  // audienceFingerprint === confidenceFingerprint through two card clicks —
  // selecting a role on a card always clears the other role if it currently
  // points at that same fingerprint. The one reachable path to this state is
  // `resolveGrantedBranch()`'s matched-branch pre-fill, which copies a saved
  // mapping's fingerprints directly WITHOUT that guard. Seeding a corrupted
  // single-fingerprint mapping and reassigning from the matched summary
  // reaches the same `sameMonitorSelected`/`canSave` guard this test proves.
  it('disables Save and shows the inline validation copy when a saved mapping pre-fills both roles to the same monitor', async () => {
    const screen = makeScreen({ label: 'Only Display' })
    const fp = computeFingerprint(screen)
    saveMapping({
      assignments: [
        { fingerprint: fp, role: 'audience' },
        { fingerprint: fp, role: 'confidence' },
      ],
      savedAt: Date.now(),
    })

    installGetScreenDetails([screen])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Your displays are set up')
    const reassignButton = wrapper.findAll('button').find((b) => b.text() === 'Reassign roles')
    expect(reassignButton).toBeTruthy()
    await reassignButton!.trigger('click')

    const saveButton = wrapper.get('[data-testid="save-button"]')
    expect(saveButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Choose two different displays for Audience and Confidence.')
  })
})

describe('MonitorSetupView — WR-03: a stale detection resolution must not override the manual fallback choice', () => {
  it('ignores a getScreenDetails() resolution that arrives after "Set up manually instead" was clicked', async () => {
    let resolveDetails!: (value: { screens: ScreenLike[]; addEventListener: () => void; removeEventListener: () => void }) => void
    const pending = new Promise<{ screens: ScreenLike[]; addEventListener: () => void; removeEventListener: () => void }>((resolve) => {
      resolveDetails = resolve
    })
    ;(window as unknown as { getScreenDetails: unknown }).getScreenDetails = vi.fn(() => pending)

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Detecting...')

    // Operator gives up waiting on the still-pending prompt and chooses the
    // manual fallback instead.
    const manualButton = wrapper.findAll('button').find((b) => b.text() === 'Set up manually instead')
    expect(manualButton).toBeTruthy()
    await manualButton!.trigger('click')
    expect(wrapper.text()).toContain("No problem — let's set this up by hand")
    // IN-manual-copy: honest copy for a voluntary opt-out, not denial copy.
    expect(wrapper.text()).toContain('You chose to set up your displays manually')
    expect(wrapper.text()).not.toContain('blocked automatic detection')

    // The stale detection now resolves.
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    resolveDetails({ screens, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    await flushPromises()

    // The operator's explicit manual choice must survive the late resolution.
    expect(wrapper.text()).toContain("No problem — let's set this up by hand")
    expect(wrapper.text()).not.toContain('Your displays are set up')
  })
})

describe('MonitorSetupView — WR-02: a same-layout re-detect must not discard unsaved role edits', () => {
  it('keeps in-progress "Reassign roles" selections (and shows the kept notice) when Re-detect finds the same screens', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)

    // Seed a saved mapping that MATCHES the live screens, so detection lands
    // on the "Your displays are set up" B2 summary.
    saveMapping({
      assignments: [
        { fingerprint: fpA, role: 'audience' },
        { fingerprint: fpB, role: 'confidence' },
      ],
      savedAt: Date.now(),
    })

    installGetScreenDetails(screens)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Your displays are set up')

    // Expand into the editable grid and make an unsaved change: put Confidence
    // on the monitor that was saved as Audience.
    const reassignButton = wrapper.findAll('button').find((b) => b.text() === 'Reassign roles')
    await reassignButton!.trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).trigger('click')
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).attributes('aria-checked')).toBe('true')

    // Re-detect finds the SAME physical screens — the unsaved edit must survive.
    const redetectButton = wrapper.findAll('button').find((b) => b.text() === 'Re-detect')
    expect(redetectButton).toBeTruthy()
    await redetectButton!.trigger('click')
    await flushPromises()

    // The edit is preserved (not reset to the saved Audience-on-fpA mapping),
    // the view did NOT collapse back to the read-only summary, and the
    // non-blocking "we kept your choices" notice is shown.
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.text()).not.toContain('Your displays are set up')
    expect(wrapper.find('[data-testid="refresh-kept-notice"]').exists()).toBe(true)
  })
})

describe('MonitorSetupView — save round-trip "not persisted" warning', () => {
  it('shows the non-blocking amber not-persisted warning (not the green confirmation) when localStorage silently no-ops', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)

    installGetScreenDetails(screens)
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="detect-button"]').trigger('click')
    await flushPromises()

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled (private mode)')
    })

    await wrapper.get('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("We couldn't save this on your browser")
    expect(wrapper.text()).not.toContain('Saved for this device')

    setItemSpy.mockRestore()
  })
})

describe('MonitorSetupView — FullscreenSetupPanel is mounted additively, outside the phase chain (Phase 98)', () => {
  it('renders the panel in the default/prompt phase, before any detection has run', async () => {
    // getScreenDetails present but not yet clicked, and jsdom has no
    // navigator.permissions by default, so the view settles in 'prompt'
    // (the same setup the "synchronous permission-call contract" test above
    // relies on) rather than auto-advancing to 'unavailable' or 'granted'.
    installGetScreenDetails([makeScreen({ label: 'Front Wall' })])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Set up your displays')
    expect(wrapper.find('[data-testid="fullscreen-setup-panel"]').exists()).toBe(true)
  })

  it('renders the panel in the unavailable phase too, proving it sits outside the mutually-exclusive phase v-if/else chain', async () => {
    expect('getScreenDetails' in window).toBe(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain("Your browser can't auto-detect monitors")
    expect(wrapper.find('[data-testid="fullscreen-setup-panel"]').exists()).toBe(true)
  })

  it('renders exactly one FullscreenSetupPanel', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('[data-testid="fullscreen-setup-panel"]')).toHaveLength(1)
  })
})
