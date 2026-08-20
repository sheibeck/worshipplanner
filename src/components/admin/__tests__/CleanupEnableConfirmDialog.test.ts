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
    global: {
      // Same Teleport stub used by NewServiceDialog.test.ts — renders the
      // teleported content inline under the wrapper root so VTU's
      // find/findAll can see it without needing document-level queries.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('CleanupEnableConfirmDialog', () => {
  it('renders the title and echoes the dry-run count/bytes in the body (count > 0)', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('Enable media cleanup?')
    expect(wrapper.text()).toContain('47 objects (774.7 MB)')
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

    // Review UI-3: the disabled reason must be programmatically tied to the
    // warning paragraph, not just adjacent in visual/DOM order.
    const warningId = confirm.attributes('aria-describedby')
    expect(warningId).toBeTruthy()
    expect(wrapper.find(`#${warningId}`).text()).toContain('Reference detection is incomplete')

    await confirm.trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('uses indigo (not red) for the hard-blocked Confirm when wouldDeleteCount is 0 (review IN-01/UI-1)', () => {
    const wrapper = mountDialog({ referencesComplete: false, wouldDeleteCount: 0, wouldDeleteBytes: 0 })
    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(confirm.classes()).toContain('bg-indigo-600')
    expect(confirm.classes()).not.toContain('bg-red-600')
  })

  it('keeps the hard-blocked Confirm red when wouldDeleteCount > 0 (review IN-01/UI-1)', () => {
    const wrapper = mountDialog({ referencesComplete: false, wouldDeleteCount: 47 })
    const buttons = wrapper.findAll('button')
    const confirm = buttons[buttons.length - 1]!
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(confirm.classes()).toContain('bg-red-600')
    expect(confirm.classes()).not.toContain('bg-indigo-600')
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

  // Review CR-01: backdrop click, panel @click.self, and Escape must all be
  // no-ops while `confirming` is true -- not just the Cancel button.
  it('does NOT emit cancel on Escape while confirming (write in flight)', async () => {
    const wrapper = mountDialog({ confirming: true })
    const dialogRoot = wrapper.find('[role="dialog"]')
    await dialogRoot.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('does NOT emit cancel on backdrop click while confirming (write in flight)', async () => {
    const wrapper = mountDialog({ confirming: true })
    const backdrop = wrapper.findAll('div')[0]!
    await backdrop.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('does NOT emit cancel on panel @click.self while confirming (write in flight)', async () => {
    const wrapper = mountDialog({ confirming: true })
    // The panel wrapper carries @click.self -- find it via its distinctive
    // classes (fixed inset-0 z-50 ... panel wrapper, not the backdrop).
    const panelWrapper = wrapper.find('.z-50')
    await panelWrapper.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('restores focus to the previously-focused element when the dialog closes', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Enable'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const wrapper = mountDialog({ open: false })
    await wrapper.setProps({ open: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.activeElement).not.toBe(trigger)

    await wrapper.setProps({ open: false })
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })
})
