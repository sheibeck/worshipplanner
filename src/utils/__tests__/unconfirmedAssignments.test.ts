// Phase 135 Plan 02 (R417) — pure diff tests for unconfirmedAssignments. Mirrors
// the confirmations.test.ts convention: no Firestore/Pinia, pure function only.

import { describe, it, expect } from 'vitest'
import { unconfirmedAssignments } from '@/utils/unconfirmedAssignments'
import { confirmationKey, type ConfirmationStatus } from '@/utils/confirmations'

describe('unconfirmedAssignments', () => {
  it('includes a pair with no entry in the statuses map (implicit unconfirmed)', () => {
    const roleAssignmentsByEmailLower = {
      'alice@example.com': [{ roleId: 'role-1', roleName: 'Vocals' }],
    }
    const statuses = new Map<string, ConfirmationStatus>()

    const result = unconfirmedAssignments(roleAssignmentsByEmailLower, statuses)

    expect(result).toEqual([{ emailLower: 'alice@example.com', roleId: 'role-1', roleName: 'Vocals', status: 'unconfirmed' }])
  })

  it('includes a pair whose status is needsReconfirmation', () => {
    const roleAssignmentsByEmailLower = {
      'alice@example.com': [{ roleId: 'role-1', roleName: 'Vocals' }],
    }
    const statuses = new Map<string, ConfirmationStatus>([
      [confirmationKey('role-1', 'alice@example.com'), 'needsReconfirmation'],
    ])

    const result = unconfirmedAssignments(roleAssignmentsByEmailLower, statuses)

    expect(result).toEqual([{ emailLower: 'alice@example.com', roleId: 'role-1', roleName: 'Vocals', status: 'needsReconfirmation' }])
  })

  it('includes a pair whose status is declined (260908-nq5)', () => {
    const roleAssignmentsByEmailLower = {
      'alice@example.com': [{ roleId: 'role-1', roleName: 'Vocals' }],
    }
    const statuses = new Map<string, ConfirmationStatus>([
      [confirmationKey('role-1', 'alice@example.com'), 'declined'],
    ])

    const result = unconfirmedAssignments(roleAssignmentsByEmailLower, statuses)

    expect(result).toEqual([{ emailLower: 'alice@example.com', roleId: 'role-1', roleName: 'Vocals', status: 'declined' }])
  })

  it('excludes a pair whose status is confirmed', () => {
    const roleAssignmentsByEmailLower = {
      'alice@example.com': [{ roleId: 'role-1', roleName: 'Vocals' }],
    }
    const statuses = new Map<string, ConfirmationStatus>([
      [confirmationKey('role-1', 'alice@example.com'), 'confirmed'],
    ])

    const result = unconfirmedAssignments(roleAssignmentsByEmailLower, statuses)

    expect(result).toEqual([])
  })

  it('returns [] when roleAssignmentsByEmailLower is undefined', () => {
    const statuses = new Map<string, ConfirmationStatus>()

    expect(unconfirmedAssignments(undefined, statuses)).toEqual([])
  })

  it('returns [] when roleAssignmentsByEmailLower is empty', () => {
    const statuses = new Map<string, ConfirmationStatus>()

    expect(unconfirmedAssignments({}, statuses)).toEqual([])
  })

  it('emits one row per (email, role) pair for multiple roles under one email', () => {
    const roleAssignmentsByEmailLower = {
      'alice@example.com': [
        { roleId: 'role-1', roleName: 'Vocals' },
        { roleId: 'role-2', roleName: 'Guitar' },
      ],
    }
    const statuses = new Map<string, ConfirmationStatus>([
      [confirmationKey('role-1', 'alice@example.com'), 'confirmed'],
    ])

    const result = unconfirmedAssignments(roleAssignmentsByEmailLower, statuses)

    expect(result).toEqual([{ emailLower: 'alice@example.com', roleId: 'role-2', roleName: 'Guitar', status: 'unconfirmed' }])
  })

  it('preserves input iteration order across multiple emails and roles', () => {
    const roleAssignmentsByEmailLower = {
      'bob@example.com': [{ roleId: 'role-3', roleName: 'Drums' }],
      'alice@example.com': [
        { roleId: 'role-1', roleName: 'Vocals' },
        { roleId: 'role-2', roleName: 'Guitar' },
      ],
    }
    const statuses = new Map<string, ConfirmationStatus>()

    const result = unconfirmedAssignments(roleAssignmentsByEmailLower, statuses)

    expect(result).toEqual([
      { emailLower: 'bob@example.com', roleId: 'role-3', roleName: 'Drums', status: 'unconfirmed' },
      { emailLower: 'alice@example.com', roleId: 'role-1', roleName: 'Vocals', status: 'unconfirmed' },
      { emailLower: 'alice@example.com', roleId: 'role-2', roleName: 'Guitar', status: 'unconfirmed' },
    ])
  })
})
