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
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'
import type { ServiceTemplateEntry } from '@/types/organization'

// Auto-unmount keeps a test's teleported content (e.g. a child that Teleports
// to `<body>`) from leaking into the next test's `document.body`. The Services
// default-template card that used a `body()` DOMWrapper helper here was
// relocated to the Services page in 52-03 (R113); its teleport-reading coverage
// now lives in ServicesView.test.ts.
enableAutoUnmount(afterEach)

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

// 46-03: partial mock — keeps the REAL cssVarsFor/snapWeight (so the snap
// case and the Preview's computed style exercise the genuine SLIDE_FONTS
// ramp, not a stub), replacing only loadFontCss with a spy so the family-
// change on-demand-load call can be asserted without a real dynamic
// `@fontsource/*` import.
const { mockLoadFontCss } = vi.hoisted(() => ({
  mockLoadFontCss: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/utils/slideTypography', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/slideTypography')>('@/utils/slideTypography')
  return {
    ...actual,
    loadFontCss: mockLoadFontCss,
  }
})

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
// Phase 82 (R242/R243) — the super-admin master AI gate. Defaults true so
// every pre-existing (pre-Phase-82) test in this file keeps seeing the AI
// Features card; the new describe block below flips it false to prove the
// card disappears.
let mockAiMasterEnabled = true
// Phase 103 (R300) — the Bible Translation card is v-if-gated on
// authStore.isBibleApiEnabled, mirroring the AI master gate above. Defaults
// true so every pre-existing (pre-Phase-103) test in this file — including
// the R090 Bible Translation card tests — keeps seeing the card; the new
// visibility describe block below flips it false to prove the card
// disappears.
let mockBibleApiEnabled = true
let mockSettingsVwModeEnabled = true
// 44-02: R086 Services card summary + ServiceTemplateEditor.vue (mounted as a
// child, which also calls useAuthStore() directly) both read this field.
let mockDefaultServiceTemplate: ServiceTemplateEntry[] = []
// 45-02: R090 Bible Translation card.
let mockBibleVersion: 'ESV' | 'NLT' = 'NLT'
// 46-03: R093 Slide Typography card.
let mockSlideTypography: { fontFamily: string; fontWeight: number } = {
  fontFamily: 'Inter',
  fontWeight: 400,
}
// 58-04: R130/R132/R133 Messaging card. Kill-switch defaults FALSE (fail-closed,
// mirrors DEFAULT_ORG_SETTINGS.messaging.enabled — the deliberate divergence
// from aiEnabled/pcEnabled's default-true seed used elsewhere in this file).
let mockMessagingEnabled = false
let mockLockNotifyDefault = false
let mockReminderEnabled = false
let mockReminderDaysBefore = 7
let mockTimezone = 'America/Chicago'

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
    // Phase 82 (R242/R243) — read-only in the component (no mirror-write
    // path exists for the master gate from SettingsView.vue; it is written
    // only by the super-admin Owner Console callable), so no setter needed.
    get aiMasterEnabled() {
      return mockAiMasterEnabled
    },
    // Phase 103 (R300) — the Bible Translation card's v-if gate, mirroring
    // aiMasterEnabled above. Read-only here too: no mirror-write path exists
    // from SettingsView.vue.
    get isBibleApiEnabled() {
      return mockBibleApiEnabled
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
      // 46-03: setter required for saveSlideTypography's mirror-write
      // (`authStore.settings.slideTypography = newValue`), mirroring every
      // other settings.* setter above.
      get slideTypography() {
        return mockSlideTypography
      },
      set slideTypography(v: { fontFamily: string; fontWeight: number }) {
        mockSlideTypography = v
      },
      // 58-04: setters required for onToggleMessagingEnabled/onToggleLockNotifyDefault/
      // onToggleReminderEnabled/onChangeReminderDaysBefore/onSaveMessagingEmail's
      // mirror-writes (`authStore.settings.messaging.<field> = newValue`). Each call
      // to this getter returns a fresh accessor object closing over the SAME outer
      // mock* variables, so a mutation through any returned object is visible to
      // every other reader/writer — matching how a real reactive store field behaves.
      get messaging() {
        return {
          get enabled() {
            return mockMessagingEnabled
          },
          set enabled(v: boolean) {
            mockMessagingEnabled = v
          },
          get lockNotifyDefault() {
            return mockLockNotifyDefault
          },
          set lockNotifyDefault(v: boolean) {
            mockLockNotifyDefault = v
          },
          get reminderEnabled() {
            return mockReminderEnabled
          },
          set reminderEnabled(v: boolean) {
            mockReminderEnabled = v
          },
          get reminderDaysBefore() {
            return mockReminderDaysBefore
          },
          set reminderDaysBefore(v: number) {
            mockReminderDaysBefore = v
          },
        }
      },
      // 58-04: setter required for onChangeTimezone's mirror-write
      // (`authStore.settings.timezone = newValue`), mirroring every other
      // settings.* setter above.
      get timezone() {
        return mockTimezone
      },
      set timezone(v: string) {
        mockTimezone = v
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
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

// R113 (52-03): the Services default-template card was RELOCATED off Settings
// to an editor-gated cog on the Services page. Its open/gate/open-close coverage
// now lives in src/views/__tests__/ServicesView.test.ts. What remains here is a
// single negative assertion proving the card is gone from Settings — the
// relocation, not a dropped test.
describe('SettingsView — no Services template card (R113)', () => {
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('no longer renders the template-editor button or the template summary', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.find('[data-testid="open-template-editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="template-summary"]').exists()).toBe(false)
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
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

describe('SettingsView Slide Typography card (R093) — 46-03', () => {
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
    mockLoadFontCss.mockClear()
  })

  it('renders the Slide Typography heading, family/weight controls, and Preview panel — no Size control', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Slide Typography')
    expect(wrapper.find('[data-testid="slide-font-family-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slide-font-weight-select"]').exists()).toBe(true)
    // R329: the manual Size control is gone — text size is now auto-fit.
    expect(wrapper.find('[data-testid="slide-font-scale-sm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-font-scale-md"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-font-scale-lg"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slide-typography-preview-label"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Amazing grace, how sweet the sound')
  })

  it('saves family/weight as two leaf dot-paths and mirrors into the store', async () => {
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="slide-font-weight-select"]').setValue('600')
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    // Assert on the KEY SET, not merely that the expected keys are present —
    // rules out a whole-map { 'settings.slideTypography': {...} } write and
    // proves no fontScale leaf survives (R329).
    expect(Object.keys(payload)).toHaveLength(2)
    expect(payload).toHaveProperty('settings.slideTypography.fontFamily', 'Inter')
    expect(payload).toHaveProperty('settings.slideTypography.fontWeight', 600)
    expect(payload).not.toHaveProperty('settings.slideTypography.fontScale')
    expect(payload).not.toHaveProperty('settings')

    expect(mockSlideTypography).toEqual({ fontFamily: 'Inter', fontWeight: 600 })
    expect(wrapper.text()).toContain('Saved!')
  })

  it('snaps the weight to 400 when switching family to Lora while weight 300 is selected', async () => {
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 300 }
    const wrapper = mountSettingsView()

    const weightSelectBefore = wrapper.get('[data-testid="slide-font-weight-select"]')
      .element as HTMLSelectElement
    expect(weightSelectBefore.value).toBe('300')

    await wrapper.get('[data-testid="slide-font-family-select"]').setValue('Lora')
    await flushPromises()

    const weightSelectAfter = wrapper.get('[data-testid="slide-font-weight-select"]')
      .element as HTMLSelectElement
    expect(weightSelectAfter.value).toBe('400')

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(payload).toHaveProperty('settings.slideTypography.fontFamily', 'Lora')
    expect(payload).toHaveProperty('settings.slideTypography.fontWeight', 400)

    // On-demand load of the newly-selected family, at the snapped weight.
    expect(mockLoadFontCss).toHaveBeenCalledWith('Lora', 400)
  })

  // WR-03 (46-REVIEW.md): a REJECTED loadFontCss must not surface as an
  // unhandled promise rejection, and must not block the save itself — the
  // family-change handler's own save action is independent of whether the
  // on-demand preview load succeeds.
  it('does not throw or block saving when loadFontCss rejects on a family change', async () => {
    mockLoadFontCss.mockRejectedValueOnce(new Error('chunk load failed'))
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="slide-font-family-select"]').setValue('Lora')
    await flushPromises()

    expect(mockLoadFontCss).toHaveBeenCalledWith('Lora', 400)
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Saved!')
  })

  it('reverts the selection and surfaces the save-error string when the write rejects', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="slide-font-weight-select"]').setValue('600')
    await flushPromises()

    expect(wrapper.text()).toContain("Couldn't save your slide typography settings. Try again.")
    const weightSelect = wrapper.get('[data-testid="slide-font-weight-select"]')
      .element as HTMLSelectElement
    expect(weightSelect.value).toBe('400')
    expect(mockSlideTypography).toEqual({ fontFamily: 'Inter', fontWeight: 400 })
  })

  it('disables both controls and blocks saving for a non-editor (viewer)', async () => {
    mockIsEditor = false
    const wrapper = mountSettingsView()

    expect(wrapper.get('[data-testid="slide-font-family-select"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="slide-font-weight-select"]').attributes('disabled')).toBeDefined()

    // Force-select despite disabled, exercising the handler guard directly
    // rather than relying on jsdom to block interaction with a disabled input.
    await wrapper.get('[data-testid="slide-font-weight-select"]').setValue('600')
    await flushPromises()

    expect(mockUpdateDoc).not.toHaveBeenCalled()
    expect(mockSlideTypography).toEqual({ fontFamily: 'Inter', fontWeight: 400 })
  })

  it('offers weight 300 (Inter Light) when Inter is the selected family', () => {
    const wrapper = mountSettingsView()
    const options = wrapper.get('[data-testid="slide-font-weight-select"]').findAll('option')
    const values = options.map((option) => option.element.value)
    expect(values).toContain('300')
  })

  it("the live Preview reflects the current local selection's cssVarsFor output", async () => {
    const wrapper = mountSettingsView()
    const preview = wrapper.get('[data-testid="slide-typography-preview"]')
    expect((preview.element as HTMLElement).style.fontFamily).toBe('var(--slide-font-family)')
    expect((preview.element as HTMLElement).style.getPropertyValue('--slide-font-family')).toContain(
      'Inter',
    )

    await wrapper.get('[data-testid="slide-font-family-select"]').setValue('Lora')
    await flushPromises()

    const updatedPreview = wrapper.get('[data-testid="slide-typography-preview"]').element as HTMLElement
    expect(updatedPreview.style.getPropertyValue('--slide-font-family')).toContain('Lora')
  })
})

// 58-04 (R130/R132): the global kill-switch + org-level automatic-email defaults
// sub-block, mirroring the AI Features/PC/Bible cards' save triad exactly.
describe('SettingsView Messaging card — kill-switch + automatic email defaults (R130/R132) — 58-04', () => {
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('renders the Messaging heading with the kill-switch unchecked for a fresh org', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Messaging')
    const toggle = wrapper.get('[data-testid="messaging-enabled-toggle"]').element as HTMLInputElement
    expect(toggle.checked).toBe(false)
  })

  it('does not render the automatic email defaults sub-block while the kill-switch is off', () => {
    const wrapper = mountSettingsView()
    expect(wrapper.find('[data-testid="messaging-lock-notify-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="messaging-reminder-enabled-toggle"]').exists()).toBe(false)
  })

  it('writes the dot-path leaf and mirrors the store when the kill-switch is turned on', async () => {
    const wrapper = mountSettingsView()
    await wrapper.get('[data-testid="messaging-enabled-toggle"]').setValue(true)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.messaging.enabled', true)
    expect(payload).not.toHaveProperty('settings')
    expect(mockMessagingEnabled).toBe(true)
    expect(wrapper.text()).toContain('Saved!')
  })

  it('reverts the kill-switch and shows the shared failure string when the write rejects', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-enabled-toggle"]').setValue(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to save. Please try again.')
    const toggle = wrapper.get('[data-testid="messaging-enabled-toggle"]').element as HTMLInputElement
    expect(toggle.checked).toBe(false)
    expect(mockMessagingEnabled).toBe(false)
  })

  it('reveals the automatic email defaults sub-block once the kill-switch is on', async () => {
    mockMessagingEnabled = true
    const wrapper = mountSettingsView()

    expect(wrapper.find('[data-testid="messaging-lock-notify-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="messaging-reminder-enabled-toggle"]').exists()).toBe(true)
    // From name / Reply-to fields removed (owner UAT 2026-08-17).
    expect(wrapper.find('[data-testid="messaging-from-name-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="messaging-reply-to-input"]').exists()).toBe(false)
  })

  it('writes the dot-path leaf and mirrors the store when lock-notify default is toggled', async () => {
    mockMessagingEnabled = true
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-lock-notify-toggle"]').setValue(true)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.messaging.lockNotifyDefault', true)
    expect(mockLockNotifyDefault).toBe(true)
  })

  it('writes the dot-path leaf and mirrors the store when reminder-enabled default is toggled', async () => {
    mockMessagingEnabled = true
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-reminder-enabled-toggle"]').setValue(true)
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.messaging.reminderEnabled', true)
    expect(mockReminderEnabled).toBe(true)
  })

  it('reveals the reminder days-before select only once reminder-enabled is checked', async () => {
    mockMessagingEnabled = true
    const wrapper = mountSettingsView()

    expect(wrapper.find('[data-testid="messaging-reminder-days-select"]').exists()).toBe(false)

    await wrapper.get('[data-testid="messaging-reminder-enabled-toggle"]').setValue(true)
    await flushPromises()

    expect(wrapper.find('[data-testid="messaging-reminder-days-select"]').exists()).toBe(true)
  })

  it('persists reminderDaysBefore as a NUMBER, not the select string, when changed', async () => {
    mockMessagingEnabled = true
    mockReminderEnabled = true
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-reminder-days-select"]').setValue('14')
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.messaging.reminderDaysBefore', 14)
    expect(typeof payload['settings.messaging.reminderDaysBefore']).toBe('number')
    expect(mockReminderDaysBefore).toBe(14)
    expect(typeof mockReminderDaysBefore).toBe('number')
  })

  it('reverts reminderDaysBefore to its prior numeric value when the write rejects', async () => {
    mockMessagingEnabled = true
    mockReminderEnabled = true
    mockReminderDaysBefore = 7
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-reminder-days-select"]').setValue('14')
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to save. Please try again.')
    const select = wrapper.get('[data-testid="messaging-reminder-days-select"]')
      .element as HTMLSelectElement
    expect(select.value).toBe('7')
    expect(mockReminderDaysBefore).toBe(7)
  })

  it('disables the kill-switch and blocks saving for a non-editor (viewer)', async () => {
    mockIsEditor = false
    const wrapper = mountSettingsView()

    expect(wrapper.get('[data-testid="messaging-enabled-toggle"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="messaging-enabled-toggle"]').setValue(true)
    await flushPromises()

    expect(mockUpdateDoc).not.toHaveBeenCalled()
    expect(mockMessagingEnabled).toBe(false)
  })
})

// 58-04 (R133): the always-visible organization-timezone select, independent of
// the messaging kill-switch state.
describe('SettingsView organization timezone select (R133) — 58-04', () => {
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('renders the timezone select regardless of the kill-switch state (always visible)', () => {
    mockMessagingEnabled = false
    const wrapper = mountSettingsView()
    expect(wrapper.find('[data-testid="messaging-timezone-select"]').exists()).toBe(true)
  })

  it("reflects authStore.settings.timezone as the select's current value", () => {
    mockTimezone = 'America/Denver'
    const wrapper = mountSettingsView()
    const select = wrapper.get('[data-testid="messaging-timezone-select"]').element as HTMLSelectElement
    expect(select.value).toBe('America/Denver')
  })

  it('writes the dot-path leaf and mirrors the store when the timezone changes', async () => {
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-timezone-select"]').setValue('America/Los_Angeles')
    await flushPromises()

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0]![1] as Record<string, unknown>
    expect(Object.keys(payload)).toHaveLength(1)
    expect(payload).toHaveProperty('settings.timezone', 'America/Los_Angeles')
    expect(payload).not.toHaveProperty('settings')
    expect(mockTimezone).toBe('America/Los_Angeles')
    expect(wrapper.text()).toContain('Saved!')
  })

  it('reverts the select to the prior value and shows the shared failure string when the write rejects', async () => {
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountSettingsView()

    await wrapper.get('[data-testid="messaging-timezone-select"]').setValue('America/Los_Angeles')
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to save. Please try again.')
    const select = wrapper.get('[data-testid="messaging-timezone-select"]').element as HTMLSelectElement
    expect(select.value).toBe('America/Chicago')
    expect(mockTimezone).toBe('America/Chicago')
  })
})

// Phase 82 (R242/R243) — the AI Features card is v-if-gated on the
// super-admin master gate (authStore.aiMasterEnabled), distinct from the
// church's own settings.aiEnabled toggle inside the card.
describe('SettingsView AI Features card visibility (Phase 82, R242/R243)', () => {
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('AI: is not rendered in the DOM at all when the master gate is off', () => {
    mockAiMasterEnabled = false
    const wrapper = mountSettingsView()
    expect(wrapper.text()).not.toContain('AI Features')
    expect(wrapper.text()).not.toContain('Enable AI features')
  })

  it('AI: renders normally when the master gate is on', () => {
    mockAiMasterEnabled = true
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('AI Features')
    expect(wrapper.text()).toContain('Enable AI features')
  })
})

// Phase 103 (R300) — the Bible Translation card is v-if-gated on
// authStore.isBibleApiEnabled, mirroring the AI Features card's
// authStore.aiMasterEnabled gate above. When an org's Bible API is off there
// is no API-backed version list to configure, so the card is hidden — never
// deleted (the stored bibleVersion field and its save logic are untouched).
describe('SettingsView Bible Translation card visibility (R300)', () => {
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
    mockAiMasterEnabled = true
    mockBibleApiEnabled = true
    mockPcEnabled = true
    mockSettingsVwModeEnabled = true
    mockDefaultServiceTemplate = []
    mockBibleVersion = 'NLT'
    mockSlideTypography = { fontFamily: 'Inter', fontWeight: 400 }
    mockMessagingEnabled = false
    mockLockNotifyDefault = false
    mockReminderEnabled = false
    mockReminderDaysBefore = 7
    mockTimezone = 'America/Chicago'
    mockUpdateDoc.mockClear()
    mockGetDoc.mockClear()
    mockSetPcCredentials.mockClear()
  })

  it('Bible: is not rendered in the DOM at all when the org Bible API is off', () => {
    mockBibleApiEnabled = false
    const wrapper = mountSettingsView()
    expect(wrapper.text()).not.toContain('Bible Translation')
    expect(wrapper.text()).not.toContain('ESV (English Standard Version)')
    expect(wrapper.text()).not.toContain('NLT (New Living Translation)')
  })

  it('Bible: renders normally when the org Bible API is on', () => {
    mockBibleApiEnabled = true
    const wrapper = mountSettingsView()
    expect(wrapper.text()).toContain('Bible Translation')
    expect(wrapper.text()).toContain('ESV (English Standard Version)')
    expect(wrapper.text()).toContain('NLT (New Living Translation)')
  })
})
