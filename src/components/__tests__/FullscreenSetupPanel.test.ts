/**
 * Phase 98 Plan 02 (R285/R286/R287). Behavioral coverage for FullscreenSetupPanel.vue's
 * four mutually-exclusive states (checking / ready / not-ready / unsupported), the
 * per-OS origin-baked download, and the self-correcting Confirm re-check.
 *
 * `useFullscreenReadiness` (98-01) is mocked here — a shared reactive `status` ref and
 * a `recheck` spy that tests drive directly — so each state is deterministic without
 * touching `navigator.permissions` (already covered by useFullscreenReadiness.test.ts).
 * `osDetect` is likewise mocked so the OS/browser pairing is deterministic per test;
 * `downloadTextFile` is mocked so we can assert on its call args (and make it throw)
 * without touching the real DOM Blob/anchor machinery (already covered by
 * downloadTextFile.test.ts). `fullscreenPolicyFiles` is left REAL so the generated
 * `contents` genuinely bake in `window.location.origin` (proving R286/T-98-04 end to end
 * from this panel, not just from the util's own unit tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import FullscreenSetupPanel from '../FullscreenSetupPanel.vue'
import { downloadTextFile } from '@/utils/downloadTextFile'
import type { FullscreenReadiness } from '@/composables/useFullscreenReadiness'
import type { DetectedOS, DetectedBrowser } from '@/utils/osDetect'

const H = vi.hoisted(() => {
  return {
    mockStatus: { value: 'checking' as FullscreenReadiness },
    mockRecheck: vi.fn(async () => {}),
    mockOs: { value: 'windows' as DetectedOS },
    mockBrowser: { value: 'chrome' as DetectedBrowser },
  }
})

vi.mock('@/composables/useFullscreenReadiness', () => ({
  useFullscreenReadiness: () => ({ status: H.mockStatus, recheck: H.mockRecheck }),
}))

vi.mock('@/utils/osDetect', async (importActual) => {
  const actual = await importActual<typeof import('@/utils/osDetect')>()
  return {
    ...actual,
    detectOS: () => H.mockOs.value,
    detectBrowser: () => H.mockBrowser.value,
  }
})

vi.mock('@/utils/downloadTextFile', () => ({
  downloadTextFile: vi.fn(),
}))

// The mocked module above replaces the ref exports with plain mutable objects
// (`{ value }`) so status can be reassigned across tests the same way a real
// `ref` would be reassigned via `.value` — Vue's reactivity system tracks the
// object identity returned by the composable, and since the SAME object is
// returned on every call, mutating `.value` inside a test re-triggers the
// component's render, exactly like the real composable's reactive `status`.
function setStatus(value: FullscreenReadiness) {
  H.mockStatus.value = value
}

beforeEach(() => {
  H.mockStatus.value = 'checking'
  H.mockRecheck.mockReset()
  H.mockRecheck.mockImplementation(async () => {})
  H.mockOs.value = 'windows'
  H.mockBrowser.value = 'chrome'
  vi.mocked(downloadTextFile).mockReset()
})

describe('FullscreenSetupPanel — panel shell (all states)', () => {
  it('renders the constant heading and subhead inside the panel root', () => {
    setStatus('ready')
    const wrapper = mount(FullscreenSetupPanel)
    const panel = wrapper.get('[data-testid="fullscreen-setup-panel"]')
    expect(panel.text()).toContain('Automatic fullscreen')
    expect(panel.text()).toContain(
      "One-time setup so both displays go fullscreen on their own when you click Go live",
    )
  })
})

describe('FullscreenSetupPanel — checking state', () => {
  it('shows the checking status with no buttons', () => {
    setStatus('checking')
    const wrapper = mount(FullscreenSetupPanel)
    expect(wrapper.find('[data-testid="fullscreen-setup-status-checking"]').exists()).toBe(true)
    expect(wrapper.text()).toContain("Checking this computer's setup…")
    expect(wrapper.find('[data-testid="fullscreen-setup-download-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fullscreen-setup-confirm-button"]').exists()).toBe(false)
  })
})

describe('FullscreenSetupPanel — ready state', () => {
  it('shows the ready status with no download/confirm/troubleshooting elements', () => {
    setStatus('ready')
    const wrapper = mount(FullscreenSetupPanel)
    expect(wrapper.find('[data-testid="fullscreen-setup-status-ready"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('This computer is set up for automatic fullscreen.')
    expect(wrapper.find('[data-testid="fullscreen-setup-download-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fullscreen-setup-confirm-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fullscreen-setup-troubleshooting"]').exists()).toBe(false)
  })
})

describe('FullscreenSetupPanel — not-ready state', () => {
  it('shows the not-ready status, download button, instructions, caveat, and confirm button', () => {
    setStatus('not-ready')
    const wrapper = mount(FullscreenSetupPanel)
    expect(wrapper.find('[data-testid="fullscreen-setup-status-not-ready"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fullscreen-setup-download-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fullscreen-setup-instructions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fullscreen-setup-caveat"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fullscreen-setup-confirm-button"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="fullscreen-setup-confirm-button"]').text()).toBe('Confirm fullscreen support')
  })

  it('interpolates the detected browser and OS into the download button label', () => {
    setStatus('not-ready')
    H.mockOs.value = 'macos'
    H.mockBrowser.value = 'chrome'
    const wrapper = mount(FullscreenSetupPanel)
    expect(wrapper.get('[data-testid="fullscreen-setup-download-button"]').text()).toBe(
      'Download setup file for Chrome on macOS',
    )
  })

  it('shows the Windows-only admin download link only when the detected OS is windows', () => {
    setStatus('not-ready')
    H.mockOs.value = 'windows'
    const winWrapper = mount(FullscreenSetupPanel)
    expect(winWrapper.find('[data-testid="fullscreen-setup-admin-download-link"]').exists()).toBe(true)

    H.mockOs.value = 'macos'
    const macWrapper = mount(FullscreenSetupPanel)
    expect(macWrapper.find('[data-testid="fullscreen-setup-admin-download-link"]').exists()).toBe(false)
  })

  it('downloads the origin-baked, OS-correct HKCU artifact when the download button is clicked', async () => {
    setStatus('not-ready')
    H.mockOs.value = 'windows'
    const wrapper = mount(FullscreenSetupPanel)
    await wrapper.get('[data-testid="fullscreen-setup-download-button"]').trigger('click')

    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const call = vi.mocked(downloadTextFile).mock.calls[0]!
    const [filename, contents, mimeType] = call
    expect(filename).toBe('worshipplanner-enable-fullscreen-hkcu.reg')
    expect(contents).toContain(window.location.origin)
    expect(mimeType).toBe('text/plain')
  })

  it('downloads the HKLM admin artifact when the admin link is clicked', async () => {
    setStatus('not-ready')
    H.mockOs.value = 'windows'
    const wrapper = mount(FullscreenSetupPanel)
    await wrapper.get('[data-testid="fullscreen-setup-admin-download-link"]').trigger('click')

    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const call = vi.mocked(downloadTextFile).mock.calls[0]!
    const [filename, contents] = call
    expect(filename).toBe('worshipplanner-enable-fullscreen-hklm.reg')
    expect(contents).toContain(window.location.origin)
  })

  it('generates the correct filename extension for macOS and Linux downloads', async () => {
    setStatus('not-ready')
    H.mockOs.value = 'macos'
    const macWrapper = mount(FullscreenSetupPanel)
    await macWrapper.get('[data-testid="fullscreen-setup-download-button"]').trigger('click')
    expect(vi.mocked(downloadTextFile).mock.calls[0]![0]).toBe('worshipplanner-enable-fullscreen.mobileconfig')

    vi.mocked(downloadTextFile).mockReset()
    H.mockOs.value = 'linux'
    const linuxWrapper = mount(FullscreenSetupPanel)
    await linuxWrapper.get('[data-testid="fullscreen-setup-download-button"]').trigger('click')
    expect(vi.mocked(downloadTextFile).mock.calls[0]![0]).toBe('worshipplanner-enable-fullscreen.json')
  })

  it('shows a red error line under the download button when downloadTextFile throws', async () => {
    setStatus('not-ready')
    vi.mocked(downloadTextFile).mockImplementationOnce(() => {
      throw new Error('sandboxed iframe blocked the download')
    })
    const wrapper = mount(FullscreenSetupPanel)
    await wrapper.get('[data-testid="fullscreen-setup-download-button"]').trigger('click')

    const errorLine = wrapper.find('[data-testid="fullscreen-setup-download-error"]')
    expect(errorLine.exists()).toBe(true)
    expect(errorLine.classes()).toContain('text-red-400')
    expect(errorLine.text()).toContain("Couldn't start the download")
  })
})

describe('FullscreenSetupPanel — self-correcting confirm (R287)', () => {
  it('re-runs the readiness check and flips not-ready -> ready on the SAME wrapper, with no remount', async () => {
    setStatus('not-ready')
    H.mockRecheck.mockImplementation(async () => {
      H.mockStatus.value = 'ready'
    })
    const wrapper = mount(FullscreenSetupPanel)
    const panelElementBefore = wrapper.get('[data-testid="fullscreen-setup-panel"]').element

    await wrapper.get('[data-testid="fullscreen-setup-confirm-button"]').trigger('click')
    await flushPromises()

    expect(H.mockRecheck).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="fullscreen-setup-panel"]').element).toBe(panelElementBefore)
    expect(wrapper.find('[data-testid="fullscreen-setup-status-ready"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fullscreen-setup-status-not-ready"]').exists()).toBe(false)
  })

  it('does not show troubleshooting on first paint, and shows it only after a still-not-ready confirm', async () => {
    setStatus('not-ready')
    H.mockRecheck.mockImplementation(async () => {
      H.mockStatus.value = 'not-ready'
    })
    const wrapper = mount(FullscreenSetupPanel)
    expect(wrapper.find('[data-testid="fullscreen-setup-troubleshooting"]').exists()).toBe(false)

    await wrapper.get('[data-testid="fullscreen-setup-confirm-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="fullscreen-setup-troubleshooting"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Still not working?')
  })
})

describe('FullscreenSetupPanel — unsupported state', () => {
  it('shows the unsupported status and a demoted "Check again" confirm link', () => {
    setStatus('unsupported')
    const wrapper = mount(FullscreenSetupPanel)
    expect(wrapper.find('[data-testid="fullscreen-setup-status-unsupported"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Not available in this browser')
    const confirmButton = wrapper.get('[data-testid="fullscreen-setup-confirm-button"]')
    expect(confirmButton.text()).toBe('Check again')
    expect(confirmButton.classes()).not.toContain('bg-indigo-600')
  })

  it('re-runs the readiness check when "Check again" is clicked', async () => {
    setStatus('unsupported')
    const wrapper = mount(FullscreenSetupPanel)
    await wrapper.get('[data-testid="fullscreen-setup-confirm-button"]').trigger('click')
    expect(H.mockRecheck).toHaveBeenCalledTimes(1)
  })
})

describe('FullscreenSetupPanel — never calls requestFullscreen (T-98-06)', () => {
  it('never calls document.documentElement.requestFullscreen across mount, download, and confirm', async () => {
    const requestFullscreenSpy = vi.fn()
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreenSpy,
      configurable: true,
    })

    setStatus('not-ready')
    const wrapper = mount(FullscreenSetupPanel)
    await wrapper.get('[data-testid="fullscreen-setup-download-button"]').trigger('click')
    await wrapper.get('[data-testid="fullscreen-setup-confirm-button"]').trigger('click')
    await flushPromises()

    expect(requestFullscreenSpy).not.toHaveBeenCalled()
  })
})
