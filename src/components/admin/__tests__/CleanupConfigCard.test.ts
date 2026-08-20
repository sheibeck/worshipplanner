import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CleanupConfigCard from '../CleanupConfigCard.vue'
import ConfigNumberField from '../ConfigNumberField.vue'
import { DEFAULT_APP_CONFIG, type AppConfig, type AppConfigInput } from '@/config/appConfigDefaults'

// ── @/stores/appConfig mock — a "reactive stub" exposing resolvedConfig,
//    rawDoc, and a saveField spy, per the plan's card-test harness. Getters
//    forward to module-scope state set via setStore() BEFORE each mount, so
//    no real Vue reactivity is needed (every test mounts fresh after the
//    state it wants is in place). ──
const { mockSaveField, storeState } = vi.hoisted(() => {
  return {
    mockSaveField: vi.fn((_path: string, _value: unknown) => Promise.resolve()),
    storeState: {
      resolvedConfig: undefined as unknown as AppConfig,
      rawDoc: undefined as AppConfigInput | undefined,
    },
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
  setStore(cloneDefaults(), undefined)
})

function mountCard() {
  return mount(CleanupConfigCard)
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
      "Enabling a cleanup requires a dry-run preview and a confirm step, coming in a future release.",
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
})
