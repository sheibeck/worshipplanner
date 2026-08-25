/**
 * Owner UX follow-up (260824) -- OrgConfigDrawer.vue gained the Assign admin
 * and Enter church sections (moved in from OrganizationsTab.vue's row, which
 * is now data-only + a trailing chevron mirroring SongTable.vue). This file
 * is the drawer's first standalone test (previously only exercised via
 * OrganizationsTab.test.ts); it mirrors DeactivateOrgConfirmDialog.test.ts's
 * mount/focus conventions (`mount`, `attachTo: document.body`, the Teleport
 * stub, `setTimeout(0)` for nextTick-deferred focus assertions) since
 * OrgConfigDrawer shares the same Teleport + focus-management shell.
 *
 * The drawer is purely presentational -- every assertion here is about props
 * in / events out, never about a callable (OrganizationsTab.vue owns those).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import OrgConfigDrawer from '../OrgConfigDrawer.vue'

enableAutoUnmount(afterEach)

function makeOrg(overrides: Partial<{
  orgId: string
  name: string
  createdAt: unknown
  memberCount: number
  pendingCount: number
  active: boolean
  aiMasterEnabled: boolean
}> = {}) {
  return {
    orgId: 'org-1',
    name: 'Grace Church',
    createdAt: { toDate: () => new Date('2026-08-01T00:00:00Z') },
    memberCount: 3,
    pendingCount: 0,
    active: true,
    aiMasterEnabled: false,
    ...overrides,
  }
}

function mountDrawer(props: Partial<InstanceType<typeof OrgConfigDrawer>['$props']> = {}) {
  return mount(OrgConfigDrawer, {
    attachTo: document.body,
    props: {
      org: makeOrg(),
      aiToggling: false,
      aiError: null,
      activeToggling: false,
      activeError: null,
      activeFeedback: null,
      activeFeedbackIsWarning: false,
      assigning: false,
      assignEmail: '',
      isAssigning: false,
      assignError: null,
      assignFeedback: null,
      entering: false,
      enterDisabled: false,
      enterError: null,
      ...props,
    },
    global: {
      // Same Teleport stub used by DeactivateOrgConfirmDialog.test.ts --
      // renders the teleported content inline so VTU's find/findAll can see
      // it without needing document-level queries.
      stubs: { Teleport: { template: '<div><slot /></div>' } },
    },
  })
}

describe('OrgConfigDrawer -- shell (org null / header / close paths)', () => {
  it('renders nothing when org is null', () => {
    const wrapper = mountDrawer({ org: null })
    expect(wrapper.find('[data-testid="org-config-drawer"]').exists()).toBe(false)
  })

  it('shows the org name in the header when org is set', () => {
    const wrapper = mountDrawer({ org: makeOrg({ name: 'Hope Church' }) })
    expect(wrapper.find('[data-testid="org-config-drawer"]').text()).toContain('Hope Church')
  })

  it('emits close when the x button is clicked', async () => {
    const wrapper = mountDrawer()
    await wrapper.find('button[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on backdrop click', async () => {
    const wrapper = mountDrawer()
    await wrapper.find('.z-40').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on Escape', async () => {
    const wrapper = mountDrawer()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('focuses the panel on open and restores focus to the previously-focused element on close', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Configure Grace Church'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const wrapper = mountDrawer({ org: null })
    await wrapper.setProps({ org: makeOrg() })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.activeElement).not.toBe(trigger)
    expect(document.activeElement).toBe(wrapper.find('[data-testid="org-config-drawer"]').element)

    await wrapper.setProps({ org: null })
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })
})

describe('OrgConfigDrawer -- AI enablement checkbox', () => {
  it('reflects aiMasterEnabled: true as checked, false as unchecked', () => {
    let wrapper = mountDrawer({ org: makeOrg({ aiMasterEnabled: true }) })
    expect((wrapper.find('[data-testid="org-config-ai-checkbox"]').element as HTMLInputElement).checked).toBe(true)

    wrapper = mountDrawer({ org: makeOrg({ aiMasterEnabled: false }) })
    expect((wrapper.find('[data-testid="org-config-ai-checkbox"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('emits toggle-ai (no payload) on change', async () => {
    const wrapper = mountDrawer()
    await wrapper.find('[data-testid="org-config-ai-checkbox"]').trigger('change')
    expect(wrapper.emitted('toggle-ai')).toEqual([[]])
  })

  it('disables the checkbox while aiToggling and renders aiError', () => {
    const wrapper = mountDrawer({ aiToggling: true, aiError: 'server exploded' })
    expect(wrapper.find('[data-testid="org-config-ai-checkbox"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('server exploded')
  })
})

describe('OrgConfigDrawer -- Active button (Deactivate/Reactivate)', () => {
  it('reads Deactivate for an active org and emits request-deactivate on click', async () => {
    const wrapper = mountDrawer({ org: makeOrg({ active: true }) })
    const button = wrapper.find('[data-testid="org-config-active-button"]')
    expect(button.text()).toBe('Deactivate')
    await button.trigger('click')
    expect(wrapper.emitted('request-deactivate')).toEqual([[]])
    expect(wrapper.emitted('reactivate')).toBeUndefined()
  })

  it('reads Reactivate for a deactivated org and emits reactivate directly on click', async () => {
    const wrapper = mountDrawer({ org: makeOrg({ active: false }) })
    const button = wrapper.find('[data-testid="org-config-active-button"]')
    expect(button.text()).toBe('Reactivate')
    await button.trigger('click')
    expect(wrapper.emitted('reactivate')).toEqual([[]])
    expect(wrapper.emitted('request-deactivate')).toBeUndefined()
  })

  it('disables the button while activeToggling and renders activeError / activeFeedback', () => {
    const wrapper = mountDrawer({ activeToggling: true, activeError: 'nope', activeFeedback: 'Deactivated.' })
    expect(wrapper.find('[data-testid="org-config-active-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('nope')
    expect(wrapper.text()).toContain('Deactivated.')
  })
})

describe('OrgConfigDrawer -- Assign admin (owner UX follow-up, moved in from the row)', () => {
  it('shows a collapsed "Assign admin" trigger by default and emits start-assign on click', async () => {
    const wrapper = mountDrawer({ assigning: false })
    expect(wrapper.find('input[aria-label="Admin email"]').exists()).toBe(false)
    const button = wrapper.findAll('button').find((b) => b.text() === 'Assign admin')!
    await button.trigger('click')
    expect(wrapper.emitted('start-assign')).toEqual([[]])
  })

  it('when assigning, shows the email input reflecting assignEmail and Assign/Cancel assign buttons', () => {
    const wrapper = mountDrawer({ assigning: true, assignEmail: 'admin@example.com' })
    const input = wrapper.find('input[aria-label="Admin email"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('admin@example.com')
    expect(wrapper.findAll('button').some((b) => b.text() === 'Assign')).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Cancel assign')).toBe(true)
  })

  it('emits update:assign-email on input', async () => {
    const wrapper = mountDrawer({ assigning: true })
    const input = wrapper.find('input[aria-label="Admin email"]')
    await input.setValue('new@example.com')
    expect(wrapper.emitted('update:assign-email')).toEqual([['new@example.com']])
  })

  it('emits confirm-assign on Enter and on clicking Assign', async () => {
    const wrapper = mountDrawer({ assigning: true, assignEmail: 'admin@example.com' })
    const input = wrapper.find('input[aria-label="Admin email"]')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('confirm-assign')).toHaveLength(1)

    const assignButton = wrapper.findAll('button').find((b) => b.text() === 'Assign')!
    await assignButton.trigger('click')
    expect(wrapper.emitted('confirm-assign')).toHaveLength(2)
  })

  it('shows "Assigning..." and disables Assign while isAssigning', () => {
    const wrapper = mountDrawer({ assigning: true, isAssigning: true })
    const assignButton = wrapper.findAll('button').find((b) => b.text() === 'Assigning...')!
    expect(assignButton.attributes('disabled')).toBeDefined()
  })

  it('emits cancel-assign when Cancel assign is clicked', async () => {
    const wrapper = mountDrawer({ assigning: true })
    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel assign')!
    await cancelButton.trigger('click')
    expect(wrapper.emitted('cancel-assign')).toEqual([[]])
  })

  it('renders assignError and assignFeedback when set', () => {
    const wrapper = mountDrawer({ assignError: 'Enter a valid email address.', assignFeedback: 'Added as admin.' })
    expect(wrapper.text()).toContain('Enter a valid email address.')
    expect(wrapper.text()).toContain('Added as admin.')
  })
})

describe('OrgConfigDrawer -- Enter church (owner UX follow-up, moved in from the row)', () => {
  it('reads "Enter church" and emits enter-church on click', async () => {
    const wrapper = mountDrawer({ entering: false, enterDisabled: false })
    const button = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(button.text()).toBe('Enter church')
    await button.trigger('click')
    expect(wrapper.emitted('enter-church')).toEqual([[]])
  })

  it('reads "Entering..." and disables the button while entering', () => {
    const wrapper = mountDrawer({ entering: true, enterDisabled: true })
    const button = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(button.text()).toBe('Entering...')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('disables the button when enterDisabled is true even if this org is not the one entering (cross-org guard)', () => {
    const wrapper = mountDrawer({ entering: false, enterDisabled: true })
    const button = wrapper.find('[data-testid="org-config-enter-church-button"]')
    expect(button.text()).toBe('Enter church')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('renders enterError when set', () => {
    const wrapper = mountDrawer({ enterError: "Couldn't enter this church. Refresh and try again." })
    expect(wrapper.text()).toContain("Couldn't enter this church. Refresh and try again.")
  })
})

describe('OrgConfigDrawer -- Delete (deactivated-only)', () => {
  it('renders no Delete button for an active org', () => {
    const wrapper = mountDrawer({ org: makeOrg({ active: true }) })
    expect(wrapper.find('[data-testid="org-config-delete-button"]').exists()).toBe(false)
  })

  it('renders the Delete button for a deactivated org and emits request-delete on click', async () => {
    const wrapper = mountDrawer({ org: makeOrg({ active: false }) })
    const button = wrapper.find('[data-testid="org-config-delete-button"]')
    expect(button.exists()).toBe(true)
    await button.trigger('click')
    expect(wrapper.emitted('request-delete')).toEqual([[]])
  })
})
