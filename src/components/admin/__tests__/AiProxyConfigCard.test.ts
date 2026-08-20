import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AiProxyConfigCard from '../AiProxyConfigCard.vue'
import ConfigNumberField from '../ConfigNumberField.vue'
import ConfigTextField from '../ConfigTextField.vue'
import { DEFAULT_APP_CONFIG, type AppConfig, type AppConfigInput } from '@/config/appConfigDefaults'

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
  return mount(AiProxyConfigCard)
}

// Template order: rateLimitPerMin, rateLimitPerDay, allowedModels (text), maxTokensCeiling.
describe('AiProxyConfigCard', () => {
  it('renders the number fields with their bounds and the allowedModels text field', () => {
    const wrapper = mountCard()
    const numberFields = wrapper.findAllComponents(ConfigNumberField)
    expect(numberFields).toHaveLength(3)
    expect(wrapper.text()).toContain('Requests per minute')
    expect(wrapper.text()).toContain('Requests per day')
    expect(wrapper.text()).toContain('Max tokens per request')
    const textFields = wrapper.findAllComponents(ConfigTextField)
    expect(textFields).toHaveLength(1)
    expect((textFields[0]!.find('input').element as HTMLInputElement).value).toBe(
      'claude-haiku-4-5-20251001',
    )
  })

  it('shows the upper-bound error and blocks Save over max (validation)', async () => {
    const wrapper = mountCard()
    const numberFields = wrapper.findAllComponents(ConfigNumberField)
    const rateLimitPerMinField = numberFields[0]!
    await rateLimitPerMinField.find('input').setValue(5000)
    expect(rateLimitPerMinField.text()).toContain('Must be 1000 or less.')
    expect(rateLimitPerMinField.find('button').attributes('disabled')).toBeDefined()
  })

  it('blocks Save with the exact cross-field message when rateLimitPerDay drops below rateLimitPerMin (cross-field)', async () => {
    const wrapper = mountCard()
    const numberFields = wrapper.findAllComponents(ConfigNumberField)
    const rateLimitPerDayField = numberFields[1]!
    // Default rateLimitPerMin is 20 (DEFAULT_APP_CONFIG) — 10 violates the rule
    // even though 10 individually passes rateLimitPerDay's own min(1)/max(100000).
    await rateLimitPerDayField.find('input').setValue(10)
    expect(rateLimitPerDayField.text()).toContain(
      'Daily limit must be at least the per-minute limit.',
    )
    expect(rateLimitPerDayField.find('button').attributes('disabled')).toBeDefined()
    expect(mockSaveField).not.toHaveBeenCalledWith('aiProxy.rateLimitPerDay', 10)
  })

  it('allows a valid rateLimitPerDay save at or above rateLimitPerMin', async () => {
    const wrapper = mountCard()
    const numberFields = wrapper.findAllComponents(ConfigNumberField)
    const rateLimitPerDayField = numberFields[1]!
    await rateLimitPerDayField.find('input').setValue(1000)
    expect(rateLimitPerDayField.text()).not.toContain(
      'Daily limit must be at least the per-minute limit.',
    )
    await rateLimitPerDayField.find('button').trigger('click')
    expect(mockSaveField).toHaveBeenCalledWith('aiProxy.rateLimitPerDay', 1000)
  })

  it('saves allowedModels as a cleaned non-empty string[], never the raw string (allowed models)', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const allowedModelsField = textFields[0]!
    await allowedModelsField.find('input').setValue('claude-a, claude-b ,, claude-c ,')
    await allowedModelsField.find('button').trigger('click')
    expect(mockSaveField).toHaveBeenCalledWith('aiProxy.allowedModels', [
      'claude-a',
      'claude-b',
      'claude-c',
    ])
  })

  it('rejects an all-empty allowedModels save without calling saveField', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const allowedModelsField = textFields[0]!
    await allowedModelsField.find('input').setValue(' , , ')
    await allowedModelsField.find('button').trigger('click')
    expect(mockSaveField).not.toHaveBeenCalledWith(
      'aiProxy.allowedModels',
      expect.anything(),
    )
    expect(wrapper.text()).toContain('Enter at least one model.')
  })

  it('shows the (default) badge only for fields absent from the raw doc (default badge)', () => {
    setStore(cloneDefaults(), { aiProxy: { rateLimitPerMin: 50 } })
    const wrapper = mountCard()
    const numberFields = wrapper.findAllComponents(ConfigNumberField)
    expect(numberFields[0]!.text()).not.toContain('(default)') // rateLimitPerMin explicitly set
    expect(numberFields[1]!.text()).toContain('(default)') // rateLimitPerDay untouched
  })
})
