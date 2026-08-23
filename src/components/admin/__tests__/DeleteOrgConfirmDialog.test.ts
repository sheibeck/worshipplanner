/**
 * Phase 77-02 (R220) -- type-to-confirm destructive dialog. Mirrors
 * CleanupEnableConfirmDialog.test.ts's mount/assertion conventions (Vue Test
 * Utils `mount`, `attachTo: document.body`, the Teleport stub, and
 * `setTimeout(0)` for nextTick-deferred focus assertions).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import DeleteOrgConfirmDialog from '../DeleteOrgConfirmDialog.vue'

enableAutoUnmount(afterEach)

function mountDialog(props: Partial<InstanceType<typeof DeleteOrgConfirmDialog>['$props']> = {}) {
  return mount(DeleteOrgConfirmDialog, {
    attachTo: document.body,
    props: {
      open: true,
      orgName: 'Grace Church',
      memberCount: 5,
      pendingCount: 2,
      confirming: false,
      confirmError: null,
      ...props,
    },
    global: {
      // Same Teleport stub used by CleanupEnableConfirmDialog.test.ts --
      // renders the teleported content inline under the wrapper root so
      // VTU's find/findAll can see it without needing document-level
      // queries.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('DeleteOrgConfirmDialog', () => {
  it('renders no dialog content when open is false', () => {
    const wrapper = mountDialog({ open: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Grace Church')
  })

  it('echoes the org name and member/pending counts in the destruction copy', () => {
    const wrapper = mountDialog({ orgName: 'Grace Church', memberCount: 5, pendingCount: 2 })
    expect(wrapper.text()).toContain('Grace Church')
    expect(wrapper.text()).toContain('5 member(s)')
    expect(wrapper.text()).toContain('2 pending invite(s)')
    expect(wrapper.text()).toContain('This cannot be undone')
  })

  it('labels the action clearly irreversible in the heading', () => {
    const wrapper = mountDialog({ orgName: 'Grace Church' })
    expect(wrapper.text()).toContain('Delete Grace Church — this cannot be undone')
  })

  it('disables the Delete button while the text input is empty', () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons[buttons.length - 1]!
    expect(deleteButton.text()).toBe('Delete')
    expect(deleteButton.attributes('disabled')).toBeDefined()
  })

  it('keeps the Delete button disabled when the typed value does not exactly match orgName', async () => {
    const wrapper = mountDialog({ orgName: 'Grace Church' })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('grace church')
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons[buttons.length - 1]!
    expect(deleteButton.attributes('disabled')).toBeDefined()
  })

  // 77 WR-02 (client mirror): a stored org name with stray surrounding
  // whitespace must still be confirmable — both sides are trimmed, mirroring
  // the server-side compare in orgDeletion.ts. Otherwise the button could
  // never enable for a value the server would accept.
  it('enables Delete when the trimmed typed value matches a padded orgName', async () => {
    const wrapper = mountDialog({ orgName: '  Grace Church  ' })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('Grace Church')
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons[buttons.length - 1]!
    expect(deleteButton.attributes('disabled')).toBeUndefined()
  })

  it('enables the Delete button when the typed value exactly matches orgName (trimmed)', async () => {
    const wrapper = mountDialog({ orgName: 'Grace Church' })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('  Grace Church  ')
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons[buttons.length - 1]!
    expect(deleteButton.attributes('disabled')).toBeUndefined()
  })

  it('emits confirm with the typed name when the enabled Delete button is clicked', async () => {
    const wrapper = mountDialog({ orgName: 'Grace Church' })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('Grace Church')
    const buttons = wrapper.findAll('button')
    const deleteButton = buttons[buttons.length - 1]!
    await deleteButton.trigger('click')
    expect(wrapper.emitted('confirm')).toEqual([['Grace Church']])
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
    // Selected via its distinctive class (same convention as
    // CleanupEnableConfirmDialog.test.ts's panel-wrapper `.z-50` lookup) --
    // more robust than a positional findAll('div')[0] index.
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

  it('renders confirmError visibly when set', () => {
    const wrapper = mountDialog({ confirmError: 'Deactivate the church first.' })
    expect(wrapper.text()).toContain('Deactivate the church first.')
  })

  it('moves focus to Cancel (never Delete) when the dialog opens', async () => {
    const wrapper = mountDialog({ open: false })
    await wrapper.setProps({ open: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const cancel = wrapper.findAll('button')[0]!.element as HTMLButtonElement
    expect(cancel.textContent?.trim()).toBe('Cancel')
    expect(document.activeElement).toBe(cancel)
  })

  it('restores focus to the previously-focused element when the dialog closes', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Delete'
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

  it('resets the typed-name input to empty when reopened (no stale value from a previous org)', async () => {
    const wrapper = mountDialog({ open: true, orgName: 'Grace Church' })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('Grace Church')
    expect((input.element as HTMLInputElement).value).toBe('Grace Church')

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true, orgName: 'Hope Church' })

    const reopenedInput = wrapper.find('input[type="text"]')
    expect((reopenedInput.element as HTMLInputElement).value).toBe('')
  })
})
