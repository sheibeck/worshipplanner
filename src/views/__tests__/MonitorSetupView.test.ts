/**
 * Phase 92 Plan 02 (R267/R268/R269); reworked Phase 114 Plan 02 (R324/R325/
 * R328/R338) for the per-fingerprint role map + delta-aware match consumption.
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
import { createPinia, setActivePinia } from 'pinia'
import MonitorSetupView from '../MonitorSetupView.vue'
import { useToasts } from '@/stores/toasts'
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
      },
    },
  })
}

async function detect(wrapper: ReturnType<typeof mountView>) {
  await flushPromises()
  await wrapper.get('[data-testid="detect-button"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
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
    await detect(wrapper)

    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-none"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-none"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
  })
})

describe('MonitorSetupView — 3+ monitors, no cap at two (R324)', () => {
  it('renders three MonitorCards when three displays are detected', async () => {
    const screens = [
      makeScreen({ label: 'Front Wall' }),
      makeScreen({ label: 'Stage Monitor', left: 1920 }),
      makeScreen({ label: 'Lobby Screen', left: 3840 }),
    ]
    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    const fps = screens.map((s) => computeFingerprint(s))
    for (const fp of fps) {
      expect(wrapper.find(`[data-testid="monitor-role-${fp}-none"]`).exists()).toBe(true)
    }
  })
})

describe('MonitorSetupView — independent per-monitor role selection, incl. repeated Audience (R325)', () => {
  it('leaves both cards Audience when Audience is selected on two of three cards, and a third stays None', async () => {
    const screens = [
      makeScreen({ label: 'Front Wall' }),
      makeScreen({ label: 'Stage Monitor', left: 1920 }),
      makeScreen({ label: 'Lobby Screen', left: 3840 }),
    ]
    const [fpA, fpB, fpC] = screens.map((s) => computeFingerprint(s))
    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-audience"]`).trigger('click')

    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-audience"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpC}-none"]`).attributes('aria-checked')).toBe('true')
  })

  it('never mutates another card when a role is selected on one card', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const [fpA, fpB] = screens.map((s) => computeFingerprint(s))
    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).attributes('aria-checked')).toBe('true')

    // Changing card A's role must not clear or alter card B's role.
    await wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).trigger('click')
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-confidence"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).attributes('aria-checked')).toBe('true')
  })

  it('removes only that card\'s role when None is selected on a previously-assigned card', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const [fpA, fpB] = screens.map((s) => computeFingerprint(s))
    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-audience"]`).trigger('click')

    await wrapper.get(`[data-testid="monitor-role-${fpA}-none"]`).trigger('click')

    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-none"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-audience"]`).attributes('aria-checked')).toBe('true')
  })
})

describe('MonitorSetupView — Save gate: at least one Audience required (CONTEXT decision)', () => {
  it('disables Save with zero Audience assigned and enables it once one Audience exists', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const [fpA, fpB] = screens.map((s) => computeFingerprint(s))
    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeDefined()

    // Confidence alone is not enough.
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeDefined()

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeUndefined()
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
    await detect(wrapper)

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
    await detect(secondWrapper)

    expect(secondWrapper.text()).toContain('Your displays are set up')
    expect(secondWrapper.find('[data-testid="save-button"]').exists()).toBe(false)
  })
})

describe('MonitorSetupView — nickname save + reload round-trip (R338)', () => {
  it('persists a nickname with its assignment and shows it nickname-first on the matched summary after reload', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)

    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    await wrapper.get(`[data-testid="monitor-nickname-${fpA}"]`).setValue('Sanctuary Screen')
    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')

    await wrapper.get('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    const raw = localStorage.getItem(MONITOR_CONFIG_STORAGE_KEY)
    const persisted = JSON.parse(raw!) as MonitorMapping
    const audienceAssignment = persisted.assignments.find((a) => a.fingerprint === fpA)
    expect(audienceAssignment?.nickname).toBe('Sanctuary Screen')

    wrapper.unmount()

    const secondWrapper = mountView()
    await detect(secondWrapper)

    expect(secondWrapper.text()).toContain('Your displays are set up')
    expect(secondWrapper.text()).toContain('Sanctuary Screen')
  })
})

describe('MonitorSetupView — partial delta reprompt (State B3, R326/R328)', () => {
  it('pre-selects the two kept cards and leaves only the new display unselected, with no full-reconfigure wipe banner', async () => {
    const keptA = makeScreen({ label: 'Front Wall' })
    const keptB = makeScreen({ label: 'Stage Monitor', left: 1920 })
    const fpA = computeFingerprint(keptA)
    const fpB = computeFingerprint(keptB)

    saveMapping({
      assignments: [
        { fingerprint: fpA, role: 'audience' },
        { fingerprint: fpB, role: 'confidence' },
      ],
      savedAt: Date.now(),
    })

    const newScreen = makeScreen({ label: 'Lobby Screen', left: 3840 })
    const fpC = computeFingerprint(newScreen, [keptA, keptB, newScreen])
    const liveScreens = [keptA, keptB, newScreen]
    installGetScreenDetails(liveScreens)
    const wrapper = mountView()
    await detect(wrapper)

    // Delta notice, not the old full-reconfigure wipe banner.
    expect(wrapper.find('[data-testid="partial-delta-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('We found 1 new display')
    expect(wrapper.text()).not.toContain('Your monitor setup changed')
    expect(wrapper.text()).not.toContain('Choose two different displays')

    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpC}-none"]`).attributes('aria-checked')).toBe('true')

    // At least one Audience is already kept, so Save is enabled.
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the delta notice with no kept cards when every saved fingerprint is gone (fully different layout)', async () => {
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
    await detect(wrapper)

    expect(wrapper.find('[data-testid="partial-delta-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('We found 2 new displays')
    expect(wrapper.text()).not.toContain('Your monitor setup changed')

    const fpA = computeFingerprint(liveScreens[0]!)
    const fpB = computeFingerprint(liveScreens[1]!)
    expect(wrapper.get(`[data-testid="monitor-role-${fpA}-none"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fpB}-none"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
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
    await detect(wrapper)
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

describe('MonitorSetupView — save round-trip "not persisted" warning (Phase 104, R310)', () => {
  it('sets the monitor-save-not-persisted sticky (not the green confirmation) when localStorage silently no-ops', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)

    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled (private mode)')
    })

    await wrapper.get('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    // Ported off the inline v-if warning (removed) onto the shared sticky
    // notification store — the host itself is mounted at App.vue, not inside
    // this AppShell-stubbed test tree, so we assert store state directly.
    const notifications = useToasts()
    const sticky = notifications.toasts.find((t) => t.key === 'monitor-save-not-persisted')
    expect(sticky).toBeTruthy()
    expect(sticky?.variant).toBe('warning')
    expect(sticky?.body).toContain("We couldn't save this on your browser")
    expect(wrapper.text()).not.toContain('Saved for this device')

    setItemSpy.mockRestore()
  })

  it('clears the monitor-save-not-persisted sticky once a retry succeeds', async () => {
    const screens = [makeScreen({ label: 'Front Wall' }), makeScreen({ label: 'Stage Monitor', left: 1920 })]
    const fpA = computeFingerprint(screens[0]!)
    const fpB = computeFingerprint(screens[1]!)

    installGetScreenDetails(screens)
    const wrapper = mountView()
    await detect(wrapper)

    await wrapper.get(`[data-testid="monitor-role-${fpA}-audience"]`).trigger('click')
    await wrapper.get(`[data-testid="monitor-role-${fpB}-confidence"]`).trigger('click')

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled (private mode)')
    })
    await wrapper.get('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    const notifications = useToasts()
    expect(notifications.toasts.some((t) => t.key === 'monitor-save-not-persisted')).toBe(true)

    // Retry with storage restored — the sticky auto-clears (R310).
    setItemSpy.mockRestore()
    await wrapper.get('[data-testid="save-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Saved for this device')
    expect(notifications.toasts.some((t) => t.key === 'monitor-save-not-persisted')).toBe(false)
  })
})
