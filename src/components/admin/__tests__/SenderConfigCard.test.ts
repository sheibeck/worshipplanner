import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SenderConfigCard from '../SenderConfigCard.vue'
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
  return mount(SenderConfigCard)
}

// Template order: fromName, fromAddress.
describe('SenderConfigCard', () => {
  it('renders exactly two inputs and no secret/credential field anywhere (no secret)', () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    expect(textFields).toHaveLength(2)
    expect(wrapper.findAll('input')).toHaveLength(2)

    const lowerText = wrapper.text().toLowerCase()
    expect(lowerText).not.toContain('resend_api_key')
    expect(lowerText).not.toContain('secret')
    expect(lowerText).not.toContain('api key')
  })

  it('blocks Save when fromAddress fails the email-shape check (sender)', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const fromAddressField = textFields[1]!
    await fromAddressField.find('input').setValue('not-an-email')
    expect(wrapper.text()).toContain('Enter a valid email address.')
    expect(fromAddressField.find('button').attributes('disabled')).toBeDefined()
    expect(mockSaveField).not.toHaveBeenCalled()
  })

  it('saves the trimmed fromAddress on a valid save (sender)', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const fromAddressField = textFields[1]!
    await fromAddressField.find('input').setValue('  owner@example.com  ')
    await fromAddressField.find('button').trigger('click')
    expect(mockSaveField).toHaveBeenCalledWith('sender.fromAddress', 'owner@example.com')
  })

  it('shows the amber Resend-verified-domain warning for a .web.app address without disabling Save (unverifiable host)', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const fromAddressField = textFields[1]!
    await fromAddressField.find('input').setValue('noreply@myapp.web.app')
    expect(wrapper.text()).toContain("This domain can't be verified in Resend")
    expect(fromAddressField.find('button').attributes('disabled')).toBeUndefined()
  })

  it('shows the amber warning for a .firebaseapp.com address too (unverifiable host)', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const fromAddressField = textFields[1]!
    await fromAddressField.find('input').setValue('noreply@myapp.firebaseapp.com')
    expect(wrapper.text()).toContain("This domain can't be verified in Resend")
  })

  it('shows no warning for a custom-domain address (unverifiable host)', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const fromAddressField = textFields[1]!
    await fromAddressField.find('input').setValue('noreply@ourchurch.org')
    expect(wrapper.text()).not.toContain("This domain can't be verified in Resend")
  })

  it('saves fromName optionally, capped at 100 chars', async () => {
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    const fromNameField = textFields[0]!
    await fromNameField.find('input').setValue('Our Church')
    await fromNameField.find('button').trigger('click')
    expect(mockSaveField).toHaveBeenCalledWith('sender.fromName', 'Our Church')
  })

  it('shows the (default) badge only for fields absent from the raw doc (default badge)', () => {
    setStore(cloneDefaults(), { sender: { fromName: 'Our Church' } })
    const wrapper = mountCard()
    const textFields = wrapper.findAllComponents(ConfigTextField)
    expect(textFields[0]!.text()).not.toContain('(default)') // fromName explicitly set
    expect(textFields[1]!.text()).toContain('(default)') // fromAddress untouched
  })
})
