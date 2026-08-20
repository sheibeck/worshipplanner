import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import CleanupConfigCard from '../CleanupConfigCard.vue'
import CleanupEnableConfirmDialog from '../CleanupEnableConfirmDialog.vue'
import ConfigNumberField from '../ConfigNumberField.vue'
import { DEFAULT_APP_CONFIG, type AppConfig, type AppConfigInput } from '@/config/appConfigDefaults'

enableAutoUnmount(afterEach)

// ── @/stores/appConfig mock — a "reactive stub" exposing resolvedConfig,
//    rawDoc, and a saveField spy, per the plan's card-test harness. Getters
//    forward to module-scope state set via setStore() BEFORE each mount, so
//    no real Vue reactivity is needed (every test mounts fresh after the
//    state it wants is in place). ──
const { mockSaveField, storeState, mockPreviewFn, mockHttpsCallable } = vi.hoisted(() => {
  const mockPreviewFn = vi.fn(
    (_req: { type: string }): Promise<{
      data: { wouldDeleteCount: number; wouldDeleteBytes: number; referencesComplete?: boolean }
    }> => Promise.resolve({ data: { wouldDeleteCount: 0, wouldDeleteBytes: 0 } }),
  )
  return {
    mockSaveField: vi.fn((_path: string, _value: unknown) => Promise.resolve()),
    storeState: {
      resolvedConfig: undefined as unknown as AppConfig,
      rawDoc: undefined as AppConfigInput | undefined,
    },
    mockPreviewFn,
    mockHttpsCallable: vi.fn(() => mockPreviewFn),
  }
})

vi.mock('@/stores/appConfig', () => ({
  useAppConfigStore: () => ({
    get resolvedConfig() {
      return storeState.resolvedConfig
    },
    get rawDoc() {
      return storeState.rawDoc
    },
    saveField: mockSaveField,
  }),
}))

// Phase 71-02 (R189/R190) — httpsCallable(functions, 'previewCleanupDryRun')
// mock, controllable per-test via mockPreviewFn.mockResolvedValueOnce/
// mockRejectedValueOnce. Mirrors OwnerConsoleView.test.ts's firebase/functions
// mock shape.
vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}))

vi.mock('@/firebase', () => ({
  functions: {},
}))

function setStore(resolvedConfig: AppConfig, rawDoc?: AppConfigInput): void {
  storeState.resolvedConfig = resolvedConfig
  storeState.rawDoc = rawDoc
}

function cloneDefaults(): AppConfig {
  return JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG)) as AppConfig
}

beforeEach(() => {
  mockSaveField.mockClear()
  mockSaveField.mockResolvedValue(undefined)
  mockPreviewFn.mockClear()
  mockPreviewFn.mockResolvedValue({ data: { wouldDeleteCount: 0, wouldDeleteBytes: 0 } })
  mockHttpsCallable.mockClear()
  setStore(cloneDefaults(), undefined)
})

function mountCard() {
  return mount(CleanupConfigCard, {
    global: {
      // Same Teleport stub used by NewServiceDialog.test.ts / the dialog's
      // own test — renders the confirm dialog's teleported content inline so
      // VTU's find/findAll (and findComponent) can see it.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

function rowButtons(wrapper: ReturnType<typeof mountCard>, type: string) {
  return wrapper.find(`[data-testid="cleanup-row-${type}"]`).findAll('button')
}

function dialogOf(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.findComponent(CleanupEnableConfirmDialog)
}

describe('CleanupConfigCard', () => {
  it('renders the four cleanup toggles as disabled checkboxes reflecting live state', () => {
    const config = cloneDefaults()
    config.cleanup.mediaEnabled = true
    config.cleanup.pptxRenderEnabled = false
    config.cleanup.backgroundEnabled = true
    config.cleanup.pptxSourceEnabled = false
    setStore(config, undefined)

    const wrapper = mountCard()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(4)
    checkboxes.forEach((cb) => expect(cb.attributes('disabled')).toBeDefined())

    expect((checkboxes[0]!.element as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1]!.element as HTMLInputElement).checked).toBe(false)
    expect((checkboxes[2]!.element as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[3]!.element as HTMLInputElement).checked).toBe(false)

    expect(wrapper.text()).toContain(
      'Enabling requires a dry-run preview showing exactly what would be deleted, and an explicit confirm. Disabling is immediate — turning a cleanup off is always safe.',
    )
  })

  it('never calls saveField when a read-only cleanup toggle is clicked (cleanup read-only)', async () => {
    const wrapper = mountCard()
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    for (const cb of checkboxes) {
      await cb.trigger('click')
      await cb.trigger('change')
    }
    expect(mockSaveField).not.toHaveBeenCalled()
  })

  it('shows the upper-bound error and blocks Save for retention.mediaDays over its max (validation)', async () => {
    const wrapper = mountCard()
    const fields = wrapper.findAllComponents(ConfigNumberField)
    const mediaDaysField = fields[0]!
    await mediaDaysField.find('input').setValue(9999)
    expect(mediaDaysField.text()).toContain('Must be 365 or less.')
    expect(mediaDaysField.find('button').attributes('disabled')).toBeDefined()
    expect(mockSaveField).not.toHaveBeenCalled()
  })

  it('calls saveField with the dot-path key on a valid changed save (save)', async () => {
    const wrapper = mountCard()
    const fields = wrapper.findAllComponents(ConfigNumberField)
    const mediaDaysField = fields[0]!
    await mediaDaysField.find('input').setValue(45)
    await mediaDaysField.find('button').trigger('click')
    expect(mockSaveField).toHaveBeenCalledWith('retention.mediaDays', 45)
  })

  it('shows the (default) badge only for fields absent from the raw doc (default badge)', () => {
    const withoutDoc = mountCard()
    const fieldsA = withoutDoc.findAllComponents(ConfigNumberField)
    expect(fieldsA[0]!.text()).toContain('(default)')

    setStore(cloneDefaults(), { retention: { mediaDays: 45 } })
    const withDoc = mountCard()
    const fieldsB = withDoc.findAllComponents(ConfigNumberField)
    expect(fieldsB[0]!.text()).not.toContain('(default)')
    // Sibling field not present in the raw doc still shows the badge.
    expect(fieldsB[1]!.text()).toContain('(default)')
  })

  it('shows the badge cleared even when the explicitly-saved value equals the default (30)', () => {
    // Presence-driven, not value-equality driven (R186 precise semantics).
    setStore(cloneDefaults(), { retention: { mediaDays: 30 } })
    const wrapper = mountCard()
    const fields = wrapper.findAllComponents(ConfigNumberField)
    expect(fields[0]!.text()).not.toContain('(default)')
  })

  // ── Phase 71-02 (R189/R190) — Enable/preview/confirm/Disable flow ────────

  it('Enable -> preview -> dialog echoes count -> Confirm -> saveField(cleanup.mediaEnabled, true); dialog closes', async () => {
    mockPreviewFn.mockResolvedValueOnce({
      data: { wouldDeleteCount: 47, wouldDeleteBytes: 812_300_000 },
    })
    const wrapper = mountCard()

    const enableButton = rowButtons(wrapper, 'media').find((b) => b.text().includes('Enable'))!
    await enableButton.trigger('click')
    await flushPromises()

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'previewCleanupDryRun')
    expect(mockPreviewFn).toHaveBeenCalledWith({ type: 'media' })

    let dialog = dialogOf(wrapper)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.text()).toContain('Enable media cleanup?')
    expect(dialog.text()).toContain('47 objects')

    const confirmButtons = dialog.findAll('button')
    const confirmButton = confirmButtons[confirmButtons.length - 1]!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockSaveField).toHaveBeenCalledWith('cleanup.mediaEnabled', true)
    dialog = dialogOf(wrapper)
    expect(dialog.props('open')).toBe(false)
  })

  it('Cancel closes the dialog and writes nothing', async () => {
    mockPreviewFn.mockResolvedValueOnce({
      data: { wouldDeleteCount: 12, wouldDeleteBytes: 1_000_000 },
    })
    const wrapper = mountCard()

    const enableButton = rowButtons(wrapper, 'media').find((b) => b.text().includes('Enable'))!
    await enableButton.trigger('click')
    await flushPromises()

    const dialog = dialogOf(wrapper)
    const buttons = dialog.findAll('button')
    const cancelButton = buttons[0]!
    expect(cancelButton.text()).toBe('Cancel')
    await cancelButton.trigger('click')
    await flushPromises()

    expect(mockSaveField).not.toHaveBeenCalled()
    expect(dialogOf(wrapper).props('open')).toBe(false)
  })

  it('Disable writes false immediately with NO preview call', async () => {
    const config = cloneDefaults()
    config.cleanup.mediaEnabled = true
    setStore(config, undefined)
    const wrapper = mountCard()

    const disableButton = rowButtons(wrapper, 'media').find((b) => b.text().includes('Disable'))!
    await disableButton.trigger('click')
    await flushPromises()

    expect(mockHttpsCallable).not.toHaveBeenCalled()
    expect(mockPreviewFn).not.toHaveBeenCalled()
    expect(mockSaveField).toHaveBeenCalledWith('cleanup.mediaEnabled', false)
  })

  it('zero-count preview still opens the dialog and allows Confirm (arms the cron)', async () => {
    mockPreviewFn.mockResolvedValueOnce({ data: { wouldDeleteCount: 0, wouldDeleteBytes: 0 } })
    const wrapper = mountCard()

    const enableButton = rowButtons(wrapper, 'backgrounds').find((b) => b.text().includes('Enable'))!
    await enableButton.trigger('click')
    await flushPromises()

    const dialog = dialogOf(wrapper)
    expect(dialog.props('open')).toBe(true)
    expect(dialog.text()).toContain('Nothing would be deleted right now.')

    const buttons = dialog.findAll('button')
    const confirmButton = buttons[buttons.length - 1]!
    expect(confirmButton.attributes('disabled')).toBeUndefined()
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockSaveField).toHaveBeenCalledWith('cleanup.backgroundEnabled', true)
  })

  it('surfaces a preview error inline and flips no flag', async () => {
    mockPreviewFn.mockRejectedValueOnce(new Error('network down'))
    const wrapper = mountCard()

    const enableButton = rowButtons(wrapper, 'media').find((b) => b.text().includes('Enable'))!
    await enableButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("Couldn't check what would be deleted. Please try again.")
    expect(mockSaveField).not.toHaveBeenCalled()
    expect(dialogOf(wrapper).props('open')).toBe(false)
  })

  it('surfaces a write error inline in the dialog, keeps it open, and flips no flag', async () => {
    mockPreviewFn.mockResolvedValueOnce({
      data: { wouldDeleteCount: 3, wouldDeleteBytes: 500_000 },
    })
    mockSaveField.mockRejectedValueOnce(new Error('permission-denied'))
    const wrapper = mountCard()

    const enableButton = rowButtons(wrapper, 'media').find((b) => b.text().includes('Enable'))!
    await enableButton.trigger('click')
    await flushPromises()

    const dialog = dialogOf(wrapper)
    const buttons = dialog.findAll('button')
    const confirmButton = buttons[buttons.length - 1]!
    await confirmButton.trigger('click')
    await flushPromises()

    expect(dialogOf(wrapper).props('open')).toBe(true)
    expect(dialogOf(wrapper).text()).toContain('Failed to enable. Please try again.')
    // The write was attempted, but the flag is never flipped locally — the
    // resolved config only ever changes via the store's own Firestore
    // subscription, never optimistically.
    expect(mockSaveField).toHaveBeenCalledWith('cleanup.mediaEnabled', true)
  })

  it('passes referencesComplete through to the dialog only for the backgrounds type', async () => {
    mockPreviewFn.mockResolvedValueOnce({
      data: { wouldDeleteCount: 5, wouldDeleteBytes: 100, referencesComplete: false },
    })
    const wrapper = mountCard()

    const enableButton = rowButtons(wrapper, 'backgrounds').find((b) => b.text().includes('Enable'))!
    await enableButton.trigger('click')
    await flushPromises()

    const dialog = dialogOf(wrapper)
    expect(dialog.props('referencesComplete')).toBe(false)
    expect(dialog.text()).toContain('Reference detection is incomplete')
    const buttons = dialog.findAll('button')
    const confirmButton = buttons[buttons.length - 1]!
    expect(confirmButton.attributes('disabled')).toBeDefined()

    await confirmButton.trigger('click')
    await flushPromises()
    expect(mockSaveField).not.toHaveBeenCalled()
  })
})
