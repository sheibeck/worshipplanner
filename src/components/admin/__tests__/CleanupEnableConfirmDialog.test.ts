import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import CleanupEnableConfirmDialog from '../CleanupEnableConfirmDialog.vue'

enableAutoUnmount(afterEach)

function mountDialog(props: Partial<InstanceType<typeof CleanupEnableConfirmDialog>['$props']> = {}) {
  return mount(CleanupEnableConfirmDialog, {
    attachTo: document.body,
    props: {
      open: true,
      typeLabel: 'media cleanup',
      wouldDeleteCount: 47,
      wouldDeleteBytes: 812_300_000,
      referencesComplete: undefined,
      confirming: false,
      confirmError: null,
      ...props,
    },
  })
}

describe('CleanupEnableConfirmDialog', () => {
  it('renders the title and echoes the dry-run count/bytes in the body (count > 0)', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('Enable media cleanup?')
    expect(wrapper.text()).toContain('47 objects (812.3 MB)')
    expect(wrapper.text()).toContain('This cannot be undone.')
  })

  it('uses the zero-state copy and an indigo (not red) Confirm when wouldDeleteCount is 0', () => {
    const wrapper = mountDialog({ wouldDeleteCount: 0, wouldDeleteBytes: 0 })
    expect(wrapper.text()).toContain('Nothing would be deleted right now.')
    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    expect(confirm.classes()).toContain('bg-indigo-600')
    expect(confirm.classes()).not.toContain('bg-red-600')
  })

  it('uses the destructive-red Confirm when wouldDeleteCount > 0', () => {
    const wrapper = mountDialog({ wouldDeleteCount: 47 })
    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    expect(confirm.classes()).toContain('bg-red-600')
    expect(confirm.classes()).not.toContain('bg-indigo-600')
  })

  it('hard-blocks Confirm when referencesComplete is false: disabled, no click handler fires', async () => {
    const wrapper = mountDialog({ referencesComplete: false })

    // The amber warning renders.
    expect(wrapper.text()).toContain('Reference detection is incomplete')

    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    expect(confirm.text()).toBe('Enable')
    expect(confirm.attributes('disabled')).toBeDefined()

    await confirm.trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('does not render the warning or block Confirm when referencesComplete is undefined (non-background types)', () => {
    const wrapper = mountDialog({ referencesComplete: undefined })
    expect(wrapper.text()).not.toContain('Reference detection is incomplete')
    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    expect(confirm.attributes('disabled')).toBeUndefined()
  })

  it('emits confirm when a live Confirm button is clicked', async () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    await confirm.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('emits cancel when Cancel is clicked', async () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const cancel = buttons[0]!
    expect(cancel.text()).toBe('Cancel')
    await cancel.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('moves focus to Cancel when the dialog opens', async () => {
    const wrapper = mountDialog({ open: false })
    await wrapper.setProps({ open: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const cancel = wrapper.findAll('button')[0]!.element as HTMLButtonElement
    expect(document.activeElement).toBe(cancel)
  })

  it('emits cancel (not confirm) on Escape', async () => {
    const wrapper = mountDialog()
    const dialogRoot = wrapper.find('[role="dialog"]')
    await dialogRoot.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
