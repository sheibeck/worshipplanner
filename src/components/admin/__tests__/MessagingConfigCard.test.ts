import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MessagingConfigCard from '../MessagingConfigCard.vue'
import ConfigNumberField from '../ConfigNumberField.vue'
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
  return mount(MessagingConfigCard)
}

describe('MessagingConfigCard', () => {
  it('renders the cron toggle reflecting live state and the two number fields', () => {
    const config = cloneDefaults()
    config.messaging.scheduledCronEnabled = true
    setStore(config, undefined)

    const wrapper = mountCard()
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    expect(checkbox.attributes('disabled')).toBeUndefined()
    expect(wrapper.findAllComponents(ConfigNumberField)).toHaveLength(2)
  })

  it('saves the cron toggle immediately on change and shows Saved!', async () => {
    const wrapper = mountCard()
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    expect(mockSaveField).toHaveBeenCalledWith('messaging.scheduledCronEnabled', true)
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

  it('shows the upper-bound error and blocks Save for maxRecipients over its max (validation)', async () => {
    const wrapper = mountCard()
    const fields = wrapper.findAllComponents(ConfigNumberField)
    const maxRecipientsField = fields[0]!
    await maxRecipientsField.find('input').setValue(9999)
    expect(maxRecipientsField.text()).toContain('Must be 5000 or less.')
    expect(maxRecipientsField.find('button').attributes('disabled')).toBeDefined()
  })

  it('calls saveField with the dot-path key on a valid changed number save (save)', async () => {
    const wrapper = mountCard()
    const fields = wrapper.findAllComponents(ConfigNumberField)
    const orgDailyEmailQuotaField = fields[1]!
    await orgDailyEmailQuotaField.find('input').setValue(2000)
    await orgDailyEmailQuotaField.find('button').trigger('click')
    expect(mockSaveField).toHaveBeenCalledWith('messaging.orgDailyEmailQuota', 2000)
  })

  it('shows the (default) badge only for fields absent from the raw doc (default badge)', () => {
    setStore(cloneDefaults(), { messaging: { maxRecipients: 500 } })
    const wrapper = mountCard()
    const fields = wrapper.findAllComponents(ConfigNumberField)
    expect(fields[0]!.text()).not.toContain('(default)') // maxRecipients explicitly set
    expect(fields[1]!.text()).toContain('(default)') // orgDailyEmailQuota untouched
  })
})
