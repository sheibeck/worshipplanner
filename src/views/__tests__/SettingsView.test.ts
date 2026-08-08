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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'
import type { ServiceTemplateEntry } from '@/types/organization'

// 44-02: ServiceTemplateEditor.vue's own panel markup lives inside a
// `<Teleport to="body">` (EditSlideDrawer.vue's structural precedent), so
// once the Services card opens it, its content is NOT inside `wrapper`'s own
// vnode tree — read it through `document.body` instead, mirroring
// EditSlideDrawer.test.ts's own `body()` helper. Auto-unmount keeps a test's
// teleported panel from leaking into the next test's `document.body`.
enableAutoUnmount(afterEach)
function body(): DOMWrapper<HTMLElement> {
  return new DOMWrapper(document.body)
}

// ── firebase/firestore mock (copied verbatim in shape from
//    src/stores/__tests__/auth.test.ts:31-49). `mockUpdateDoc`/`mockGetDoc` are
//    declared via vi.hoisted so they're initialized before the hoisted vi.mock
//    factory below runs, and stay reachable from test bodies so a later wave can
//    assert the toggle save handlers' Firestore payload shape. ──
const { mockUpdateDoc, mockGetDoc } = vi.hoisted(() => {
  return {
    // Typed with explicit params (rather than `vi.fn(() => ...)`) so
    // `mockUpdateDoc.mock.calls[N]![1]` resolves to a real tuple element
    // instead of TS inferring an empty-tuple `[]` from a zero-arg signature
    // (Wave 2 payload-shape assertions read this).
    mockUpdateDoc: vi.fn((_ref: unknown, _data: Record<string, unknown>) => Promise.resolve()),
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
// 44-02: R086 Services card summary + ServiceTemplateEditor.vue (mounted as a
// child, which also calls useAuthStore() directly) both read this field.
let mockDefaultServiceTemplate: ServiceTemplateEntry[] = []
// 45-02: R090 Bible Translation card.
let mockBibleVersion: 'ESV' | 'NLT' = 'NLT'

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
    // Setter required (Task 3 — 39-03) so onToggleVwMode's mirror-write
    // (`authStore.vwModeEnabled = newValue`) does not throw a TypeError on a
    // getter-only accessor. Modules are strict-mode ESM, so an accessor with
    // only a getter throws on assignment rather than silently no-opping.
    set vwModeEnabled(v: boolean) {
      mockVwModeEnabled = v
    },
    setPcCredentials: mockSetPcCredentials,
    // `settings` — real shape as of 39-02. Setters mirror the vwModeEnabled
    // setter above, required for the onToggleAiEnabled/onTogglePcEnabled
    // mirror-writes (`authStore.settings.aiEnabled = newValue`, etc.) not to
    // throw against a getter-only accessor.
    settings: {
      get aiEnabled() {
        return mockAiEnabled
      },
      set aiEnabled(v: boolean) {
        mockAiEnabled = v
      },
      get pcEnabled() {
        return mockPcEnabled
      },
      set pcEnabled(v: boolean) {
        mockPcEnabled = v
      },
      get vwModeEnabled() {
        return mockSettingsVwModeEnabled
      },
      set vwModeEnabled(v: boolean) {
        mockSettingsVwModeEnabled = v
      },
      // 44-02: setter required for ServiceTemplateEditor.vue's onSave mirror-write
      // (`authStore.settings.defaultServiceTemplate = payload`), mirroring every
      // other settings.* setter above.
      get defaultServiceTemplate() {
        return mockDefaultServiceTemplate
      },
      set defaultServiceTemplate(v: ServiceTemplateEntry[]) {
        mockDefaultServiceTemplate = v
      },
      // 45-02: setter required for onChangeBibleVersion's mirror-write
      // (`authStore.settings.bibleVersion = newValue`), mirroring every
      // other settings.* setter above.
      get bibleVersion() {
        return mockBibleVersion
      },
      set bibleVersion(v: 'ESV' | 'NLT') {
        mockBibleVersion = v
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
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
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

// ── Toggle checkbox indices, in DOM order (Task 2 markup order — Wave 2) ──────
// 0: Planning Center enable toggle (top of the PC Integration section)
// 1: Vertical Worship toggle
// 2: AI Features toggle (last section on the page)
const PC_CHECKBOX_INDEX = 0
const VW_CHECKBOX_INDEX = 1
const AI_CHECKBOX_INDEX = 2

function toggleCheckboxes(wrapper: ReturnType<typeof mountSettingsView>) {
  return wrapper.findAll('input[type="checkbox"]')
}

describe('SettingsView dot-path writes (R073) — Wave 2 (39-03)', () => {
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
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('writes a dot-path leaf key when the AI toggle changes', async () => {
    const wrapper = mountSettingsView()
    const checkboxes = toggleCheckboxes(wrapper)
    await checkboxes[AI_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    // Assert on the KEY SET, not merely that the expected key is present — a
    // payload of { settings: {...wholeObject} } would also contain a key
    // named differently, but a naive "has this key" check could still pass
    // against other whole-map-shaped defects. Asserting exactly one key,
    // and that it is the dotted leaf path, is what 39-RESEARCH.md Pitfall 1
    // requires this test to rule out.
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.aiEnabled', false)
    expect(payload).not.toHaveProperty('settings')
  })

  it('writes a dot-path leaf key when the PC toggle changes', async () => {
    const wrapper = mountSettingsView()
    const checkboxes = toggleCheckboxes(wrapper)
    await checkboxes[PC_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.pcEnabled', false)
    expect(payload).not.toHaveProperty('settings')
  })

  it('writes the nested leaf path when the Vertical Worship toggle changes (lazy backfill)', async () => {
    const wrapper = mountSettingsView()
    const checkboxes = toggleCheckboxes(wrapper)
    await checkboxes[VW_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.vwModeEnabled', false)
    // The flat field must never appear in the write payload again — this is
    // the regression that would strand the vwModeEnabled migration forever.
    expect(payload).not.toHaveProperty('vwModeEnabled')
  })

  it('mirrors the saved value onto the store for all three toggles', async () => {
    const wrapper = mountSettingsView()
    const checkboxes = toggleCheckboxes(wrapper)

    await checkboxes[AI_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()
    expect(mockAiEnabled).toBe(false)

    await checkboxes[PC_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()
    expect(mockPcEnabled).toBe(false)

    await checkboxes[VW_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()
    expect(mockVwModeEnabled).toBe(false)
  })

  it('reverts the checkbox and surfaces the shared failure string when the write rejects', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountSettingsView()
    const checkboxes = toggleCheckboxes(wrapper)

    await checkboxes[AI_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to save. Please try again.')
    const revertedCheckbox = toggleCheckboxes(wrapper)[AI_CHECKBOX_INDEX]!
    expect((revertedCheckbox.element as HTMLInputElement).checked).toBe(true)
    // The store must not have been mirror-written, since the Firestore write
    // itself never succeeded.
    expect(mockAiEnabled).toBe(true)
  })
})

describe('SettingsView Planning Center credential retention (R089) — Wave 2 (39-03)', () => {
  beforeEach(() => {
    mockOrgId = 'org-1'
    mockOrgName = 'Test Church'
    mockOrgSlug = 'test-church'
    mockIsEditor = true
    mockHasPcCredentials = true
    mockPcAppId = 'app-id-1'
    mockPcSecret = 'secret-1'
    mockVwModeEnabled = true
    mockAiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('never clears Planning Center credentials when the integration is turned off', async () => {
    const wrapper = mountSettingsView()
    const checkboxes = toggleCheckboxes(wrapper)

    await checkboxes[PC_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()

    // Neither onClearPcCredentials's Firestore write nor the store's
    // setPcCredentials mutator is ever reached by turning the toggle off.
    // Only the display-only v-if wrapper changes.
    expect(mockSetPcCredentials).not.toHaveBeenCalled()
    for (const call of mockUpdateDoc.mock.calls) {
      const payload = call[1] as Record<string, unknown>
      expect(payload).not.toHaveProperty('pcAppId')
      expect(payload).not.toHaveProperty('pcSecret')
    }

    // NOTE: the durable half of this guarantee — that credentials actually
    // SURVIVE a real off -> reload -> on cycle against live Firestore — is a
    // backstop human check (39-03-PLAN.md must_haves) deferred to
    // .planning/PENDING-VERIFICATION.md. jsdom cannot prove a real Firestore
    // round-trip; this test only proves the handler never issues a
    // credential-touching call.
  })

  it('hides the credentials block when the integration is off and shows it again when on', async () => {
    const wrapper = mountSettingsView()

    // Starts on: credentials display block (masked App ID/Secret) is visible.
    expect(wrapper.text()).toContain('Edit Credentials')

    const checkboxes = toggleCheckboxes(wrapper)
    await checkboxes[PC_CHECKBOX_INDEX]!.setValue(false)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Edit Credentials')
    expect(wrapper.text()).not.toContain('Clear Credentials')

    await toggleCheckboxes(wrapper)[PC_CHECKBOX_INDEX]!.setValue(true)
    await flushPromises()

    // Re-enabling shows the identical masked display again — proof that
    // authStore.hasPcCredentials (and therefore the stored credentials
    // themselves) were never touched by the off state.
    expect(wrapper.text()).toContain('Edit Credentials')
  })
})

describe('SettingsView Services card (R086) — Wave 2 (44-02)', () => {
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
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('renders the Services heading and card', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Services')
    expect(wrapper.find('[data-testid="open-template-editor"]').exists()).toBe(true)
  })

  it('shows the exact empty-template copy when no template is configured', () => {
    mockDefaultServiceTemplate = []
    const wrapper = mountSettingsView()
    expect(wrapper.get('[data-testid="template-summary"]').text()).toBe(
      'No default template set — new services start empty until you add items here.',
    )
  })

  it('shows "{N} items across {M} sections" for a configured template', () => {
    mockDefaultServiceTemplate = [
      { id: 's1', kind: 'SONG', section: 'worship' },
      { id: 's2', kind: 'SCRIPTURE', section: 'worship' },
      { id: 's3', kind: 'MESSAGE', section: 'message' },
    ]
    const wrapper = mountSettingsView()
    expect(wrapper.get('[data-testid="template-summary"]').text()).toBe('3 items across 2 sections')
  })

  it('does not count section-less entries toward the section total', () => {
    mockDefaultServiceTemplate = [
      { id: 's1', kind: 'SONG' },
      { id: 's2', kind: 'PRAYER', section: 'sending' },
    ]
    const wrapper = mountSettingsView()
    expect(wrapper.get('[data-testid="template-summary"]').text()).toBe('2 items across 1 section')
  })

  it('clicking "Edit Default Template" opens the ServiceTemplateEditor slide-out', async () => {
    const wrapper = mountSettingsView()
    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(false)

    await wrapper.get('[data-testid="open-template-editor"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(true)
  })

  it('closing the editor closes the slide-out', async () => {
    const wrapper = mountSettingsView()
    await wrapper.get('[data-testid="open-template-editor"]').trigger('click')
    await flushPromises()
    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(true)

    await body().get('[data-testid="service-template-editor-close"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="service-template-editor"]').exists()).toBe(false)
  })

  it('disables the "Edit Default Template" button for a non-editor (viewer)', () => {
    mockIsEditor = false
    const wrapper = mountSettingsView()
    expect(wrapper.get('[data-testid="open-template-editor"]').attributes('disabled')).toBeDefined()
  })
})

describe('SettingsView Bible Translation card (R090) — 45-02', () => {
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
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('renders the Bible Translation heading and both option labels', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Bible Translation')
    expect(wrapper.text()).toContain('ESV (English Standard Version)')
    expect(wrapper.text()).toContain('NLT (New Living Translation)')
  })

  it('checks the option matching the current authStore.settings.bibleVersion', () => {
    mockBibleVersion = 'NLT'
    const wrapper = mountSettingsView()
    const esv = wrapper.get('[data-testid="bible-version-esv"]').element as HTMLInputElement
    const nlt = wrapper.get('[data-testid="bible-version-nlt"]').element as HTMLInputElement
    expect(esv.checked).toBe(false)
    expect(nlt.checked).toBe(true)
  })

  it('writes a dot-path leaf key when the ESV option is selected', async () => {
    mockBibleVersion = 'NLT'
    const wrapper = mountSettingsView()
    await wrapper.get('[data-testid="bible-version-esv"]').setValue(true)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.bibleVersion', 'ESV')
    expect(payload).not.toHaveProperty('settings')
  })

  it('mirrors the saved value onto the store and shows "Saved!" feedback', async () => {
    mockBibleVersion = 'NLT'
    const wrapper = mountSettingsView()
    await wrapper.get('[data-testid="bible-version-esv"]').setValue(true)
    await flushPromises()

    expect(mockBibleVersion).toBe('ESV')
    expect(wrapper.text()).toContain('Saved!')
  })

  it('reverts the selection and surfaces the shared failure string when the write rejects', async () => {
    mockBibleVersion = 'NLT'
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="bible-version-esv"]').setValue(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to save. Please try again.')
    const esv = wrapper.get('[data-testid="bible-version-esv"]').element as HTMLInputElement
    const nlt = wrapper.get('[data-testid="bible-version-nlt"]').element as HTMLInputElement
    expect(esv.checked).toBe(false)
    expect(nlt.checked).toBe(true)
    // The store must not have been mirror-written, since the Firestore write
    // itself never succeeded.
    expect(mockBibleVersion).toBe('NLT')
  })

  it('disables both radio options for a non-editor (viewer)', () => {
    mockIsEditor = false
    const wrapper = mountSettingsView()
    expect(wrapper.get('[data-testid="bible-version-esv"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="bible-version-nlt"]').attributes('disabled')).toBeDefined()
  })

  it('a non-editor cannot trigger a save even if the DOM were manipulated (handler early-return)', async () => {
    mockIsEditor = false
    const wrapper = mountSettingsView()
    // Force-select despite disabled, exercising the handler guard directly
    // rather than relying on jsdom to block interaction with a disabled input.
    await wrapper.get('[data-testid="bible-version-esv"]').setValue(true)
    await flushPromises()

    expect(mockUpdateDoc).not.toHaveBeenCalled()
    expect(mockBibleVersion).toBe('NLT')
  })
})
