/**
 * Quick task 260824 -- reversible-lifecycle confirm dialog. Mirrors
 * DeleteOrgConfirmDialog.test.ts's mount/assertion conventions (Vue Test
 * Utils `mount`, `attachTo: document.body`, the Teleport stub, and
 * `setTimeout(0)` for nextTick-deferred focus assertions), minus every
 * assertion about the type-to-confirm input DeactivateOrgConfirmDialog
 * deliberately omits (deactivation is reversible).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import DeactivateOrgConfirmDialog from '../DeactivateOrgConfirmDialog.vue'

enableAutoUnmount(afterEach)

function mountDialog(props: Partial<InstanceType<typeof DeactivateOrgConfirmDialog>['$props']> = {}) {
  return mount(DeactivateOrgConfirmDialog, {
    attachTo: document.body,
    props: {
      open: true,
      orgName: 'Grace Church',
      memberCount: 5,
      confirming: false,
      confirmError: null,
      ...props,
    },
    global: {
      // Same Teleport stub used by DeleteOrgConfirmDialog.test.ts -- renders
      // the teleported content inline under the wrapper root so VTU's
      // find/findAll can see it without needing document-level queries.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('DeactivateOrgConfirmDialog', () => {
  it('renders no dialog content when open is false', () => {
    const wrapper = mountDialog({ open: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Grace Church')
  })

  it('names the org and the action in the heading', () => {
    const wrapper = mountDialog({ orgName: 'Grace Church' })
    expect(wrapper.text()).toContain('Deactivate Grace Church?')
  })

  it('echoes the member count and the cannot-log-in-until-reactivated consequence in the body', () => {
    const wrapper = mountDialog({ orgName: 'Grace Church', memberCount: 5 })
    expect(wrapper.text()).toContain('Grace Church')
    expect(wrapper.text()).toContain('5 member(s)')
    expect(wrapper.text()).toContain('logging in')
    expect(wrapper.text()).toContain('reactivat')
  })

  it('renders no type-to-confirm text input (deactivation is reversible)', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
  })

  it('the Confirm button is enabled by default (no name-match gate)', () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const confirmButton = buttons[buttons.length - 1]!
    expect(confirmButton.text()).toBe('Deactivate')
    expect(confirmButton.attributes('disabled')).toBeUndefined()
  })

  it('emits confirm with no payload when the Confirm button is clicked', async () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const confirmButton = buttons[buttons.length - 1]!
    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([[]])
  })

  it('emits cancel when Cancel is clicked', async () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const cancel = buttons[0]!
    expect(cancel.text()).toBe('Cancel')
    await cancel.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel on backdrop click', async () => {
    const wrapper = mountDialog()
    const backdrop = wrapper.find('.z-40')
    await backdrop.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits cancel (not confirm) on Escape', async () => {
    const wrapper = mountDialog()
    const dialogRoot = wrapper.find('[role="dialog"]')
    await dialogRoot.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('does NOT emit cancel on Cancel click, backdrop click, or Escape while confirming', async () => {
    const wrapper = mountDialog({ confirming: true })

    const cancel = wrapper.findAll('button')[0]!
    await cancel.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()

    const backdrop = wrapper.find('.z-40')
    await backdrop.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()

    const dialogRoot = wrapper.find('[role="dialog"]')
    await dialogRoot.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })

  it('does NOT emit confirm when the Confirm button is clicked while confirming', async () => {
    const wrapper = mountDialog({ confirming: true })
    const buttons = wrapper.findAll('button')
    const confirmButton = buttons[buttons.length - 1]!
    expect(confirmButton.attributes('disabled')).toBeDefined()
    await confirmButton.trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('renders confirmError visibly when set', () => {
    const wrapper = mountDialog({ confirmError: 'Something went wrong.' })
    expect(wrapper.text()).toContain('Something went wrong.')
  })

  it('moves focus to Cancel (never Deactivate) when the dialog opens', async () => {
    const wrapper = mountDialog({ open: false })
    await wrapper.setProps({ open: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const cancel = wrapper.findAll('button')[0]!.element as HTMLButtonElement
    expect(cancel.textContent?.trim()).toBe('Cancel')
    expect(document.activeElement).toBe(cancel)
  })

  it('restores focus to the previously-focused element when the dialog closes', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Configure'
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
