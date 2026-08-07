import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

// Helper: seed a membership doc bypassing rules
async function seedMembershipDoc(orgId: string, uid: string, role: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'organizations', orgId, 'members', uid), {
      role,
      joinedAt: new Date(),
    })
  })
}

// Helper: seed any doc bypassing rules
async function seedDoc(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const parts = path.split('/')
    const ref = doc(db, parts[0]!, ...parts.slice(1))
    await setDoc(ref, data)
  })
}

describe('Unauthenticated access', () => {
  it('denies unauthenticated read on /organizations/{orgId}', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('denies unauthenticated read on /users/{uid}', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'users', 'userA')))
  })
})

describe('Org member access', () => {
  it('allows org member to read their org', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('allows org member to read members subcollection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'members', 'userA')))
  })

  it('allows org editor to read nested collections (songs)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/songs/song1', { title: 'Amazing Grace' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1')))
  })
})

describe('Cross-org isolation', () => {
  it('denies cross-org read on org doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgB')))
  })

  it('denies cross-org nested collection read', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgB', 'songs', 'song1')))
  })
})

describe('User profile isolation', () => {
  it('allows user to read own profile', async () => {
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'users', 'userA')))
  })

  it('denies user from reading another user profile', async () => {
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'users', 'userB')))
  })
})

describe('Editor vs viewer write permissions', () => {
  it('allows editor to write org doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA'), {
        name: "UserA's Church",
        updatedAt: new Date(),
      }),
    )
  })

  it('denies viewer from writing org doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA'), {
        name: "UserA's Church",
        updatedAt: new Date(),
      }),
    )
  })
})

// -- R104 -- close the self-service membership hole --------------------------
//
// firestore.rules' `allow create` on organizations/{orgId}/members/{uid} used to
// read only `isSignedIn() && request.auth.uid == uid` -- no relationship to the
// target org at all. These four tests prove the two legitimate creation flows
// (org creation, invite acceptance) survive a tightened predicate while an
// uninvited self-join and a role-escalated invite acceptance are both denied.
//
// Tests B and C build a REAL writeBatch mirroring ensureUserDocument's exact
// operation order (src/stores/auth.ts:294-347) -- NOT seedDoc, which bypasses
// rules entirely and would prove nothing about the predicate under test.
describe('Members create — R104 self-service membership hole', () => {
  it('DENIES a signed-in user with no invite from self-creating a membership in an arbitrary org', async () => {
    // Test A — criterion 1. Org exists, owned by someone else; no invite seeded.
    await seedDoc('organizations/orgA', { name: "Someone Else's Church", createdBy: 'someoneElse' })
    const context = testEnv.authenticatedContext('attacker', { email: 'attacker@example.com' })
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'members', 'attacker'), {
        role: 'editor',
        joinedAt: new Date(),
      }),
    )
  })

  it('ALLOWS a user accepting a genuine outstanding invite, via a real writeBatch matching ensureUserDocument', async () => {
    // Test B — criterion 2. Real invite exists; batch deletes it in the SAME
    // operation order as auth.ts:294-315 before creating the member doc -- the
    // invite delete is what makes get() (pre-batch state) vs getAfter()
    // (post-batch state) observable.
    await seedDoc('organizations/orgA', { name: "Someone Else's Church", createdBy: 'someoneElse' })
    await seedDoc('organizations/orgA/invites/member@example.com', {
      role: 'viewer',
      status: 'pending',
      email: 'member@example.com',
    })
    await seedDoc('inviteLookup/member@example.com', { orgId: 'orgA', role: 'viewer' })

    const context = testEnv.authenticatedContext('userInvited', { email: 'member@example.com' })
    const db = context.firestore()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'inviteLookup', 'member@example.com'))
    batch.delete(doc(db, 'organizations', 'orgA', 'invites', 'member@example.com'))
    batch.set(doc(db, 'organizations', 'orgA', 'members', 'userInvited'), {
      role: 'viewer',
      joinedAt: new Date(),
      displayName: 'Invited User',
      email: 'member@example.com',
    })
    await assertSucceeds(batch.commit())
  })

  it('ALLOWS the founder of a brand-new org to create their own first membership, via a real writeBatch matching ensureUserDocument', async () => {
    // Test C — criterion 3, THE TRAP. Nothing seeded. The org doc and the
    // member doc are created in the SAME batch, matching auth.ts:322-345
    // exactly -- proving the org-creation branch's getAfter()/get() choice
    // against the emulator, not documentation.
    const context = testEnv.authenticatedContext('founder', { email: 'founder@example.com' })
    const db = context.firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'organizations', 'newOrg'), {
      name: "Founder's Church",
      createdAt: new Date(),
      createdBy: 'founder',
    })
    batch.set(doc(db, 'organizations', 'newOrg', 'members', 'founder'), {
      role: 'editor',
      joinedAt: new Date(),
      displayName: 'Founder',
      email: 'founder@example.com',
    })
    await assertSucceeds(batch.commit())
  })

  it('DENIES a user with a genuine viewer invite from escalating their role to editor on accept', async () => {
    // Test D — criterion 4. Identical seeding/batch shape to Test B; the ONLY
    // difference is the submitted role. This is a distinct failure mode from
    // Test A: Test A proves the branch is false with no invite at all, Test D
    // proves it is false when an invite exists but the submitted role does
    // not match it.
    await seedDoc('organizations/orgA', { name: "Someone Else's Church", createdBy: 'someoneElse' })
    await seedDoc('organizations/orgA/invites/member@example.com', {
      role: 'viewer',
      status: 'pending',
      email: 'member@example.com',
    })
    await seedDoc('inviteLookup/member@example.com', { orgId: 'orgA', role: 'viewer' })

    const context = testEnv.authenticatedContext('userInvited', { email: 'member@example.com' })
    const db = context.firestore()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'inviteLookup', 'member@example.com'))
    batch.delete(doc(db, 'organizations', 'orgA', 'invites', 'member@example.com'))
    batch.set(doc(db, 'organizations', 'orgA', 'members', 'userInvited'), {
      role: 'editor', // escalated — the invite only granted 'viewer'
      joinedAt: new Date(),
      displayName: 'Invited User',
      email: 'member@example.com',
    })
    await assertFails(batch.commit())
  })

  // CR-01 regression — the org-creation branch used getAfter() alone, which only proves
  // "createdBy currently equals my uid," not "this org is being created right now, by me."
  // createdBy is set once and never cleared, so ANY past founder — even one explicitly
  // removed via TeamView's "Remove member" — could re-grant themselves role: 'editor' at
  // any later time with a bare setDoc. This test seeds exactly that scenario: an org that
  // already exists, whose createdBy already equals the attempting user, with NO member doc
  // present (simulating removal having already run). Confirmed FAILING against the
  // unfixed rule before the !exists() guard was added (per Pitfall-4 discipline).
  it('DENIES a removed former founder from recreating their own editor membership', async () => {
    await seedDoc('organizations/orgA', { name: "Founder's Church", createdBy: 'founder' })
    const context = testEnv.authenticatedContext('founder', { email: 'founder@example.com' })
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'members', 'founder'), {
        role: 'editor',
        joinedAt: new Date(),
      }),
    )
  })
})

describe('Catch-all deny', () => {
  it('denies access to undefined paths', async () => {
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'randomCollection', 'randomDoc')))
  })
})

describe('orgSlugs — public read, org-editor-scoped create-once claim (WR-01)', () => {
  it('allows unauthenticated read of an orgSlugs doc', async () => {
    await seedDoc('orgSlugs/grace-church', { orgId: 'orgA' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'orgSlugs', 'grace-church')))
  })

  it('allows an editor of the target org to create an unclaimed orgSlugs doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(setDoc(doc(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))
  })

  // WR-01 regression: a signed-in user with no membership in the target orgId must NOT be
  // able to claim a slug for it (slug-squatting with an arbitrary/victim orgId).
  it('denies a signed-in user with no membership in the target org from claiming a slug for it', async () => {
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))
  })

  it('denies a member of a DIFFERENT org from claiming a slug for orgA (cross-tenant slug-squatting)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))
  })

  it('denies unauthenticated write to orgSlugs', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgSlugs', 'grace-church'), { orgId: 'orgA' }))
  })

  it('denies a second write to an already-claimed orgSlugs slug, even from an editor of the new orgId (first-writer-wins)', async () => {
    await seedDoc('orgSlugs/grace-church', { orgId: 'orgA' })
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgSlugs', 'grace-church'), { orgId: 'orgB' }))
  })
})

describe('quarterShares — public read, org-editor-scoped create/update (CR-01)', () => {
  it('allows unauthenticated read of a quarterShares doc', async () => {
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'quarterShares', 'grace-church__q3-2026')))
  })

  it('allows an editor of the owning org to create a quarterShares doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
      }),
    )
  })

  it('denies a signed-in user with no membership in the target org from creating a quarterShares doc', async () => {
    // userA has no seeded membership anywhere — isOrgEditor('orgA') must be false.
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
      }),
    )
  })

  it('denies a member of a DIFFERENT org from creating a quarterShares doc for orgA (cross-tenant)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
      }),
    )
  })

  it('allows an editor of the owning org to update (overwrite-in-place) an existing quarterShares doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
        updatedAgain: true,
      }),
    )
  })

  // CR-01 regression: this test previously asserted the overwrite SUCCEEDED for a completely
  // unaffiliated user (no membership seeded for any org) — that assertion encoded the
  // cross-tenant vulnerability itself. It is now inverted to assert the write is DENIED.
  it('denies a signed-in user with no org membership from overwriting another org\'s existing quarterShares doc', async () => {
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgSlug: 'grace-church',
        orgId: 'orgA',
        updatedAgain: true,
      }),
    )
  })

  it('denies an editor of a DIFFERENT org from overwriting orgA\'s existing quarterShares doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
        updatedAgain: true,
      }),
    )
  })

  it('denies an editor of the owning org from reassigning an existing quarterShares doc to a different orgId', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), {
        orgId: 'orgB',
        orgSlug: 'grace-church',
        updatedAgain: true,
      }),
    )
  })

  it('denies unauthenticated write to quarterShares', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'quarterShares', 'grace-church__q3-2026'), { orgId: 'orgA', orgSlug: 'grace-church' }),
    )
  })

  // Delete = revoke a public share when its quarter is deleted (deleteQuarter).
  it('allows an editor of the owning org to delete a quarterShares doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(deleteDoc(doc(db, 'quarterShares', 'grace-church__q3-2026')))
  })

  it('denies an editor of a DIFFERENT org from deleting orgA\'s quarterShares doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'quarterShares', 'grace-church__q3-2026')))
  })

  it('denies unauthenticated delete of a quarterShares doc', async () => {
    await seedDoc('quarterShares/grace-church__q3-2026', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'quarterShares', 'grace-church__q3-2026')))
  })
})

describe('serviceShares — public read, org-editor-scoped create/update', () => {
  it('allows unauthenticated read of a serviceShares doc', async () => {
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02')))
  })

  it('allows an editor of the owning org to create a serviceShares doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
      }),
    )
  })

  it('denies a signed-in user with no membership in the target org from creating a serviceShares doc', async () => {
    // userA has no seeded membership anywhere — isOrgEditor('orgA') must be false.
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
      }),
    )
  })

  it('denies a member of a DIFFERENT org from creating a serviceShares doc for orgA (cross-tenant)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
      }),
    )
  })

  it('allows an editor of the owning org to update (overwrite-in-place) an existing serviceShares doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
        updatedAgain: true,
      }),
    )
  })

  it('denies a signed-in user with no org membership from overwriting another org\'s existing serviceShares doc', async () => {
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgSlug: 'grace-church',
        orgId: 'orgA',
        updatedAgain: true,
      }),
    )
  })

  it('denies an editor of a DIFFERENT org from overwriting orgA\'s existing serviceShares doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgId: 'orgA',
        orgSlug: 'grace-church',
        updatedAgain: true,
      }),
    )
  })

  it('denies an editor of the owning org from reassigning an existing serviceShares doc to a different orgId', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), {
        orgId: 'orgB',
        orgSlug: 'grace-church',
        updatedAgain: true,
      }),
    )
  })

  it('denies unauthenticated write to serviceShares', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02'), { orgId: 'orgA', orgSlug: 'grace-church' }),
    )
  })

  // Delete = revoke a public share when its service is deleted.
  it('allows an editor of the owning org to delete a serviceShares doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(deleteDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02')))
  })

  it('denies an editor of a DIFFERENT org from deleting orgA\'s serviceShares doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02')))
  })

  it('denies unauthenticated delete of a serviceShares doc', async () => {
    await seedDoc('serviceShares/grace-church__service-2026-08-02', { orgId: 'orgA', orgSlug: 'grace-church' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'serviceShares', 'grace-church__service-2026-08-02')))
  })
})

describe('shareTokens — public read, signed-in create, editor-scoped delete (revoke on quarter delete)', () => {
  it('allows unauthenticated read of a shareTokens doc (public share link)', async () => {
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'shareTokens', 'tok-abc')))
  })

  it('allows an editor of the owning org to delete a shareTokens doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(deleteDoc(doc(db, 'shareTokens', 'tok-abc')))
  })

  it('denies an editor of a DIFFERENT org from deleting orgA\'s shareTokens doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'shareTokens', 'tok-abc')))
  })

  it('denies unauthenticated delete of a shareTokens doc', async () => {
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'shareTokens', 'tok-abc')))
  })

  it('denies updating a shareTokens doc (frozen snapshot — update stays false)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'shareTokens', 'tok-abc'), { orgId: 'orgA', quarterId: 'q1', tampered: true }),
    )
  })
})

describe('Editor/Viewer RBAC', () => {
  it('editor can write to songs collection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1'), {
        title: 'Amazing Grace',
        updatedAt: new Date(),
      }),
    )
  })

  it('viewer cannot write to songs collection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1'), {
        title: 'Amazing Grace',
        updatedAt: new Date(),
      }),
    )
  })

  it('viewer cannot read songs collection (songs are editor-only)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    await seedDoc('organizations/orgA/songs/song1', { title: 'Amazing Grace' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1')))
  })

  // Phase 18 lyrics subcollection (songs/{songId}/lyrics/{lyricsId}) — a DEEP path that the
  // single-segment /{collection}/{docId} catch-all does NOT cover, so it needs its own rule.
  // Regression: the rule was missing on first ship, so production/emulator denied the read and
  // crashed the Lyrics tab + slideshow auto-assembly with permission-denied. These tests fail
  // if the explicit match /lyrics/{lyricsId} rule is ever removed again.
  it('editor can read lyrics subcollection (songs/{songId}/lyrics/{lyricsId})', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/songs/song1/lyrics/v1', { slides: [], updatedAt: new Date() })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1', 'lyrics', 'v1')))
  })

  it('editor can write lyrics subcollection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1', 'lyrics', 'v1'), {
        slides: [],
        updatedAt: new Date(),
      }),
    )
  })

  it('non-member cannot read lyrics subcollection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/songs/song1/lyrics/v1', { slides: [], updatedAt: new Date() })
    // userB is a member of orgB only, never orgA
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1', 'lyrics', 'v1')))
  })

  it('viewer can read services collection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    await seedDoc('organizations/orgA/services/svc1', { date: '2026-03-07' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1')))
  })

  it('viewer cannot write to services collection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1'), {
        date: '2026-03-07',
        updatedAt: new Date(),
      }),
    )
  })

  it('editor can read invites subcollection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/invites/member@example.com', {
      role: 'viewer',
      status: 'pending',
    })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      getDoc(doc(db, 'organizations', 'orgA', 'invites', 'member@example.com')),
    )
  })

  it('viewer cannot read invites subcollection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    await seedDoc('organizations/orgA/invites/member@example.com', {
      role: 'viewer',
      status: 'pending',
    })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      getDoc(doc(db, 'organizations', 'orgA', 'invites', 'member@example.com')),
    )
  })

  it('editor can write to invites subcollection', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'invites', 'member@example.com'), {
        role: 'viewer',
        status: 'pending',
        invitedAt: new Date(),
      }),
    )
  })

  it('editor can write to org doc (update name)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA'), {
        name: 'Grace Community Church',
        updatedAt: new Date(),
      }),
    )
  })

  it('viewer cannot write to org doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA'), {
        name: 'Grace Community Church',
        updatedAt: new Date(),
      }),
    )
  })
})

// -- R036/R037 -- the service draft lock (Phase 31) --------------------------
//
// A service is editable only while its STORED status is draft. Two writes to a
// NON-draft service stay legal: the Planning Center export (D-09) and delete
// (D-15). Reopen (-> draft) is the only status-reverting write and may touch
// nothing but `status` and `updatedAt`.
//
// *** These tests are the ONLY enforcement evidence for the rules layer.
// `src/rules.test.ts` is excluded from the default vitest run
// (`vite.config.ts`), so `npx vitest run` proves nothing here -- this file runs
// only via `npm run test:rules`, which starts its own emulator.
describe('Service draft lock (R036/R037)', () => {
  const SVC = 'organizations/orgA/services/svc1'

  async function seedService(status: string | null, extra: Record<string, unknown> = {}) {
    const base: Record<string, unknown> = {
      name: 'Sunday Service',
      date: '2026-08-02',
      slots: [],
      notes: '',
      updatedAt: new Date(),
      ...extra,
    }
    if (status !== null) base.status = status
    await seedDoc(SVC, base)
  }

  async function editorDb() {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    return testEnv.authenticatedContext('userA').firestore()
  }

  type TestDb = ReturnType<ReturnType<typeof testEnv.authenticatedContext>['firestore']>

  function svcRef(db: TestDb) {
    return doc(db, 'organizations', 'orgA', 'services', 'svc1')
  }

  describe('ordinary editing', () => {
    it('a draft service accepts a full field save', async () => {
      await seedService('draft')
      const db = await editorDb()
      await assertSucceeds(updateDoc(svcRef(db), { notes: 'edited', updatedAt: new Date() }))
    })

    it('draft -> planned is allowed', async () => {
      await seedService('draft')
      const db = await editorDb()
      await assertSucceeds(updateDoc(svcRef(db), { status: 'planned', updatedAt: new Date() }))
    })

    it('a PLANNED service rejects an ordinary field edit', async () => {
      await seedService('planned')
      const db = await editorDb()
      await assertFails(updateDoc(svcRef(db), { notes: 'sneaky', updatedAt: new Date() }))
    })

    it('an EXPORTED service rejects an ordinary field edit', async () => {
      await seedService('exported')
      const db = await editorDb()
      await assertFails(updateDoc(svcRef(db), { notes: 'sneaky', updatedAt: new Date() }))
    })

    it('a legacy document with NO status field is treated as draft and stays editable', async () => {
      await seedService(null)
      const db = await editorDb()
      await assertSucceeds(updateDoc(svcRef(db), { notes: 'still editable', updatedAt: new Date() }))
    })
  })

  describe('reopen (R037)', () => {
    it('exported -> draft touching only status and updatedAt is allowed', async () => {
      await seedService('exported', { pcExportedAt: new Date(), pcPlanId: 'plan-1' })
      const db = await editorDb()
      await assertSucceeds(updateDoc(svcRef(db), { status: 'draft', updatedAt: new Date() }))
    })

    it('planned -> draft is allowed', async () => {
      await seedService('planned')
      const db = await editorDb()
      await assertSucceeds(updateDoc(svcRef(db), { status: 'draft', updatedAt: new Date() }))
    })

    // *** hasOnly() is what stops "reopen" being used to smuggle an edit
    // through alongside the status change.
    it('a reopen payload that ALSO edits another field is REJECTED', async () => {
      await seedService('planned')
      const db = await editorDb()
      await assertFails(
        updateDoc(svcRef(db), { status: 'draft', notes: 'smuggled', updatedAt: new Date() }),
      )
    })
  })

  describe('Planning Center export (D-09/D-11)', () => {
    it('planned -> exported carrying export evidence is allowed', async () => {
      await seedService('planned')
      const db = await editorDb()
      await assertSucceeds(
        updateDoc(svcRef(db), {
          status: 'exported',
          pcExportedAt: new Date(),
          pcPlanId: 'plan-1',
          updatedAt: new Date(),
        }),
      )
    })

    // *** THE case reasoning gets wrong. affectedKeys() reports only keys whose
    // VALUE changed, so a re-export to the SAME plan writes an unchanged
    // pcPlanId that never appears in the diff. A rule requiring
    // hasAll(['pcPlanId']) denies this -- the exact flow D-11 preserves
    // pcPlanId to enable.
    it('re-export to the SAME pcPlanId is allowed (D-11)', async () => {
      await seedService('planned', { pcPlanId: 'plan-1' })
      const db = await editorDb()
      await assertSucceeds(
        updateDoc(svcRef(db), {
          status: 'exported',
          pcExportedAt: new Date(),
          pcPlanId: 'plan-1',
          updatedAt: new Date(),
        }),
      )
    })

    it('an export write with no pcPlanId is rejected', async () => {
      await seedService('planned')
      const db = await editorDb()
      await assertFails(
        updateDoc(svcRef(db), {
          status: 'exported',
          pcExportedAt: new Date(),
          updatedAt: new Date(),
        }),
      )
    })
  })

  describe('create and delete', () => {
    it('create with status draft is allowed; create with status exported is rejected', async () => {
      const db = await editorDb()
      await assertSucceeds(
        setDoc(doc(db, 'organizations', 'orgA', 'services', 'new1'), {
          name: 'New', date: '2026-08-09', status: 'draft', slots: [], updatedAt: new Date(),
        }),
      )
      await assertFails(
        setDoc(doc(db, 'organizations', 'orgA', 'services', 'new2'), {
          name: 'New', date: '2026-08-09', status: 'exported', slots: [], updatedAt: new Date(),
        }),
      )
    })

    // D-15 -- delete stays available at any status; the UI warns instead.
    it('deleting a LOCKED service is allowed', async () => {
      await seedService('exported', { pcPlanId: 'plan-1' })
      const db = await editorDb()
      await assertSucceeds(deleteDoc(svcRef(db)))
    })
  })

  describe('the Roles tab is covered for free', () => {
    // A scoped dot-path write surfaces in affectedKeys() as the TOP-LEVEL key
    // `roleAssignmentOverrides`, which is in neither carve-out's hasOnly list --
    // so the Roles tab is denied on a locked service with no Roles-specific rule.
    it('a roleAssignmentOverrides dot-path write is REJECTED on a planned service', async () => {
      await seedService('planned', { roleAssignmentOverrides: {} })
      const db = await editorDb()
      await assertFails(
        updateDoc(svcRef(db), {
          'roleAssignmentOverrides.role-vox': ['person-1'],
          updatedAt: new Date(),
        }),
      )
    })

    it('the same write is ALLOWED on a draft service', async () => {
      await seedService('draft', { roleAssignmentOverrides: {} })
      const db = await editorDb()
      await assertSucceeds(
        updateDoc(svcRef(db), {
          'roleAssignmentOverrides.role-vox': ['person-1'],
          updatedAt: new Date(),
        }),
      )
    })
  })

  describe('viewers', () => {
    it('a viewer can read but cannot write, at any status', async () => {
      await seedService('draft')
      await seedMembershipDoc('orgA', 'userV', 'viewer')
      const db = testEnv.authenticatedContext('userV').firestore()
      await assertSucceeds(getDoc(svcRef(db)))
      await assertFails(updateDoc(svcRef(db), { notes: 'nope', updatedAt: new Date() }))
    })
  })

  // *** The regression test for the bypass this phase exists to close. Before
  // the `collection != 'services'` exclusion, the org-level catch-all wildcard
  // ALSO matched /services and granted write -- so a locked service stayed
  // editable even with `allow write: if false` in the /services block.
  describe('catch-all wildcard no longer backstops /services', () => {
    it('a write to a locked service is not rescued by the org-level wildcard', async () => {
      await seedService('exported')
      const db = await editorDb()
      await assertFails(
        updateDoc(svcRef(db), { name: 'renamed via wildcard', updatedAt: new Date() }),
      )
    })
  })
})

// -- R036 -- the slide-group lock (Phase 31, wave 2) -------------------------
//
// A slideGroups doc's id IS the slot id, so its parent service is reachable
// only through the `serviceId` FIELD. The rule therefore does an exists()+get()
// on the parent (2 extra billed reads per write) and requires the parent to be
// draft.
//
// `allow delete` is deliberately MORE permissive than `allow update`: an orphan
// whose parent service was deleted, or a legacy doc carrying no serviceId at
// all, must stay deletable or it is wedged in the database forever.
describe('Slide group lock (R036)', () => {
  const GRP = 'organizations/orgA/slideGroups/slot-1'

  async function seedParent(status: string) {
    await seedDoc('organizations/orgA/services/svc1', {
      name: 'Sunday Service',
      date: '2026-08-02',
      status,
      slots: [],
      updatedAt: new Date(),
    })
  }

  async function seedGroup(extra: Record<string, unknown> = {}) {
    await seedDoc(GRP, {
      serviceId: 'svc1',
      slotId: 'slot-1',
      slides: [],
      updatedAt: new Date(),
      ...extra,
    })
  }

  async function editorDb() {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    return testEnv.authenticatedContext('userA').firestore()
  }

  function grpRef(db: ReturnType<ReturnType<typeof testEnv.authenticatedContext>['firestore']>) {
    return doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')
  }

  describe('update follows the parent service status', () => {
    it('a slide write is ALLOWED when the parent is draft', async () => {
      await seedParent('draft')
      await seedGroup()
      const db = await editorDb()
      await assertSucceeds(
        updateDoc(grpRef(db), { serviceId: 'svc1', slides: [{ id: 'e1' }], updatedAt: new Date() }),
      )
    })

    it('a slide write is REJECTED when the parent is planned', async () => {
      await seedParent('planned')
      await seedGroup()
      const db = await editorDb()
      await assertFails(
        updateDoc(grpRef(db), { serviceId: 'svc1', slides: [{ id: 'e1' }], updatedAt: new Date() }),
      )
    })

    it('a slide write is REJECTED when the parent is exported', async () => {
      await seedParent('exported')
      await seedGroup()
      const db = await editorDb()
      await assertFails(
        updateDoc(grpRef(db), { serviceId: 'svc1', slides: [{ id: 'e1' }], updatedAt: new Date() }),
      )
    })
  })

  describe('create (materialization)', () => {
    it('materializing a group is ALLOWED when the parent is draft', async () => {
      await seedParent('draft')
      const db = await editorDb()
      await assertSucceeds(
        setDoc(grpRef(db), { serviceId: 'svc1', slotId: 'slot-1', slides: [], updatedAt: new Date() }),
      )
    })

    it('materializing a group is REJECTED when the parent is locked', async () => {
      await seedParent('planned')
      const db = await editorDb()
      await assertFails(
        setDoc(grpRef(db), { serviceId: 'svc1', slotId: 'slot-1', slides: [], updatedAt: new Date() }),
      )
    })

    it('a create with no serviceId is REJECTED', async () => {
      await seedParent('draft')
      const db = await editorDb()
      await assertFails(
        setDoc(grpRef(db), { slotId: 'slot-1', slides: [], updatedAt: new Date() }),
      )
    })
  })

  describe('serviceId is immutable', () => {
    // Without this, a group could be re-parented from a draft service onto a
    // locked one and then edited through the seam.
    it('re-parenting a group to a different serviceId is REJECTED', async () => {
      await seedParent('draft')
      await seedDoc('organizations/orgA/services/svc2', {
        name: 'Other', date: '2026-08-09', status: 'draft', slots: [], updatedAt: new Date(),
      })
      await seedGroup()
      const db = await editorDb()
      await assertFails(
        updateDoc(grpRef(db), { serviceId: 'svc2', updatedAt: new Date() }),
      )
    })
  })

  describe('delete is more permissive than update, on purpose', () => {
    it('cascade delete is ALLOWED when the parent is draft', async () => {
      await seedParent('draft')
      await seedGroup()
      const db = await editorDb()
      await assertSucceeds(deleteDoc(grpRef(db)))
    })

    it('cascade delete is REJECTED when the parent is locked', async () => {
      await seedParent('planned')
      await seedGroup()
      const db = await editorDb()
      await assertFails(deleteDoc(grpRef(db)))
    })

    // *** Without the parentGone() branch an orphan is BOTH unwritable and
    // undeletable -- wedged in the database with no cleanup path. An earlier
    // iteration of this rule had exactly that defect.
    it('an ORPHAN group (parent service deleted) is still DELETABLE', async () => {
      await seedGroup() // no parent service seeded at all
      const db = await editorDb()
      await assertSucceeds(deleteDoc(grpRef(db)))
    })

    it('a legacy group carrying no serviceId is still DELETABLE', async () => {
      await seedDoc(GRP, { slotId: 'slot-1', slides: [], updatedAt: new Date() })
      const db = await editorDb()
      await assertSucceeds(deleteDoc(grpRef(db)))
    })
  })

  describe('the catch-all wildcard no longer backstops /slideGroups', () => {
    // The wildcard was the ONLY rule granting write here before this wave, which
    // is why its exclusion and the block above had to land in one commit.
    it('a write against a locked parent is not rescued by the org-level wildcard', async () => {
      await seedParent('exported')
      await seedGroup()
      const db = await editorDb()
      await assertFails(
        updateDoc(grpRef(db), { serviceId: 'svc1', slides: [{ id: 'sneaky' }], updatedAt: new Date() }),
      )
    })
  })

  describe('viewers', () => {
    it('a viewer can read a group but cannot write one', async () => {
      await seedParent('draft')
      await seedGroup()
      await seedMembershipDoc('orgA', 'userV', 'viewer')
      const db = testEnv.authenticatedContext('userV').firestore()
      await assertSucceeds(getDoc(grpRef(db)))
      await assertFails(updateDoc(grpRef(db), { serviceId: 'svc1', updatedAt: new Date() }))
    })
  })
})
