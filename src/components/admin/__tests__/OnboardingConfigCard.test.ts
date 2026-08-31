import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OnboardingConfigCard from '../OnboardingConfigCard.vue'
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
  return mount(OnboardingConfigCard)
}

describe('OnboardingConfigCard', () => {
  it('renders the checkbox reflecting live onboarding.emailsEnabled state', () => {
    const config = cloneDefaults()
    config.onboarding.emailsEnabled = true
    setStore(config, undefined)

    const wrapper = mountCard()
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('reflects false when onboarding.emailsEnabled is the default', () => {
    const wrapper = mountCard()
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })

  it('saves the toggle immediately on change and shows Saved!', async () => {
    const wrapper = mountCard()
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    expect(mockSaveField).toHaveBeenCalledWith('onboarding.emailsEnabled', true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Saved!')
  })

  it('reverts the checkbox and shows an error line when saveField rejects (save error)', async () => {
    mockSaveField.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountCard()
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Failed to save. Please try again.')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })
})
