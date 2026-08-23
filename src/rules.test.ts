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
    // Phase 77 (R216/T-77-04): `organizations/{orgId}`'s `allow write` was
    // narrowed to `allow update` (delete is now its own explicit DENY --
    // see the "Org deletion DENY" describe block below). A `setDoc` against
    // a doc that does not yet exist is a Firestore CREATE, not an update --
    // seed the org doc first (bypassing rules) so this exercises the update
    // path this test is actually about, mirroring real usage (the org
    // already exists, created via orgProvisioning.ts's Admin-SDK path, by
    // the time any editor writes to it).
    await seedDoc('organizations/orgA', { name: "UserA's Church", createdBy: 'userA' })
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
    await seedDoc('organizations/orgA', { name: "UserA's Church", createdBy: 'someoneElse' })
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

// Phase 68 Plan 03 (68-03, R178): claim-based isSuperAdmin() gate for
// appConfig/* and superAdmins/*. isSuperAdmin() is deliberately claim-only
// (request.auth.token.superAdmin == true, NO get()/exists()) — this repo has
// a documented production incident (CLAUDE.md, 2026-08-06) where a
// cross-document/cross-service rules lookup produced a deny-everyone outage,
// and a deny-only test suite is exactly what let that ship undetected. Both
// ALLOW (genuine super-admin token) and DENY (unauthenticated, ordinary
// user, org-editor-role-only naming-collision guard) cases are required.
describe('appConfig / superAdmins — claim-based isSuperAdmin() gate (R178)', () => {
  it('ALLOWS a genuine super-admin to write appConfig/global', async () => {
    const context = testEnv.authenticatedContext('ownerUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(setDoc(doc(db, 'appConfig', 'global'), { anything: true }))
  })

  it('ALLOWS a genuine super-admin to write superAdmins/{uid}', async () => {
    const context = testEnv.authenticatedContext('ownerUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'superAdmins', 'targetUid'), {
        email: 'target@example.com',
        grantedBy: 'ownerUid',
        grantedAt: new Date(),
      }),
    )
  })

  it('DENIES an unauthenticated caller from reading appConfig/global', async () => {
    await seedDoc('appConfig/global', { anything: true })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'appConfig', 'global')))
  })

  it('DENIES a signed-in non-admin from reading appConfig/global', async () => {
    await seedDoc('appConfig/global', { anything: true })
    const context = testEnv.authenticatedContext('userA') // no superAdmin claim
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'appConfig', 'global')))
  })

  it('DENIES an ordinary org editor (orgId/role claim, no superAdmin) from writing superAdmins/{uid} — naming-collision guard', async () => {
    const context = testEnv.authenticatedContext('editorUid', { orgId: 'orgA', role: 'editor' })
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'superAdmins', 'targetUid'), { email: 'x@example.com' }),
    )
  })

  it('DENIES an unauthenticated caller from writing superAdmins/{uid}', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'superAdmins', 'targetUid'), { email: 'x@example.com' }),
    )
  })
})

// Phase 76 (R212-R214): isOrgActive() live-reads organizations/{orgId}.active
// (default-true, backward-compatible) and is composed into isOrgMember/
// isOrgEditor, ORed with isSuperAdmin() -- a NARROW exemption that only
// waives the active check for a super-admin who ALREADY has a genuine
// membership doc (the exists() checks in both functions are untouched; a
// super-admin with no membership doc gets nothing new from this exemption --
// that is Phase 78's explicit deliverable, R225).
describe('isOrgActive — deactivation gate (R213, Phase 76)', () => {
  it('DENIES a deactivated org member from reading organizations/{orgId} itself', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { active: false, name: 'Deactivated Church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('DENIES a deactivated org editor from writing organizations/{orgId}', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { active: false, name: 'Deactivated Church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA'), { name: 'Renamed', updatedAt: new Date() }),
    )
  })

  it('DENIES a deactivated org editor from writing an isOrgEditor-gated nested collection (songs) -- proves the gate lives in the SHARED helpers, not just the org doc rule', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { active: false })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1'), { title: 'Amazing Grace' }))
  })

  it('ALLOWS a super-admin WITH a genuine membership doc to read a deactivated org', async () => {
    await seedMembershipDoc('orgA', 'adminUid', 'editor')
    await seedDoc('organizations/orgA', { active: false })
    const context = testEnv.authenticatedContext('adminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('ALLOWS a super-admin WITH a genuine membership doc to write a deactivated org', async () => {
    await seedMembershipDoc('orgA', 'adminUid', 'editor')
    await seedDoc('organizations/orgA', { active: false })
    const context = testEnv.authenticatedContext('adminUid', { superAdmin: true })
    const db = context.firestore()
    // Phase 78 (R225 composition fix): updateDoc, not setDoc -- a non-merged
    // setDoc replaces the WHOLE document, which implicitly strips the stored
    // `active: false` field (it is absent from the replacement payload),
    // tripping preservesLifecycleFields()'s diff() the moment Phase 78
    // removed the org-doc allow-update rule's `|| isSuperAdmin()` disjunct.
    // updateDoc merges, leaving `active` untouched, so this test proves what
    // it always intended to prove -- a super-admin can write a NON-lifecycle
    // field to a deactivated org (the isOrgActive() bypass) -- without
    // incidentally exercising the (correctly tightened) lifecycle guard.
    await assertSucceeds(
      updateDoc(doc(db, 'organizations', 'orgA'), { name: 'About to reactivate', updatedAt: new Date() }),
    )
  })

  it('ALLOWS (regression) an ordinary member of an org with NO active field at all (legacy)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { name: 'Legacy Church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('ALLOWS (regression) an ordinary member of an org with active:true explicit', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { active: true, name: 'Active Church' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })
})

// T-76-10/T-76-06 (Phase 76 SECURITY follow-up): `organizations/{orgId}`'s
// `allow write` used to grant an ordinary editor unrestricted field access --
// no restriction on the 5 lifecycle fields (`active`, `deactivatedAt`,
// `deactivatedBy`, `reactivatedAt`, `reactivatedBy`), which are supposed to be
// Admin-SDK-only (written exclusively by the setOrgActive Cloud Function).
// An ordinary editor could forge any of them directly via updateDoc, bypassing
// the super-admin-gated callable, the deactivatedOrgs claim fan-out, and
// revokeRefreshTokens (T-76-10), and forge the deactivatedBy audit field
// (T-76-06). These tests prove the new `preservesLifecycleFields()` guard
// closes the hole without regressing legitimate editor writes.
describe('Org lifecycle field guard (T-76-10/T-76-06)', () => {
  it('DENIES an ordinary editor from setting active:false directly on their own org', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { name: "UserA's Church" })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { active: false }),
    )
  })

  it('DENIES an ordinary editor from forging deactivatedBy on their own org', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { name: "UserA's Church" })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { deactivatedBy: 'forged-uid' }),
    )
  })

  it('DENIES an ordinary editor from forging deactivatedAt/reactivatedAt/reactivatedBy on their own org', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { name: "UserA's Church" })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { deactivatedAt: new Date() }),
    )
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { reactivatedAt: new Date() }),
    )
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { reactivatedBy: 'forged-uid' }),
    )
  })

  it('ALLOWS the same editor to update a non-lifecycle field (name) -- no regression', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { name: "UserA's Church" })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'organizations', 'orgA'), { name: 'Renamed Church', updatedAt: new Date() }),
    )
  })

  it('DENIES a viewer from writing any field at all, lifecycle or not', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    await seedDoc('organizations/orgA', { name: "UserA's Church" })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { name: 'Renamed Church' }),
    )
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { active: false }),
    )
  })
})

// Phase 77 (R216/T-77-04): `organizations/{orgId}`'s `allow write` used to
// bundle create+update+DELETE, and `preservesLifecycleFields()` short-
// circuits to `true` on delete (`request.resource == null`) -- so an ordinary
// editor could `deleteDoc(organizations/{orgId})` directly, bypassing the
// super-admin-gated `deleteOrganization` callable and its entire cascade
// (cross-reference cleanup, Storage sweep, audit log) entirely. These two
// tests prove the `write`->`update` narrowing + explicit `allow delete: if
// false;` closes that hole for BOTH an ordinary editor AND a super-admin
// using the client SDK -- deletion is Admin-SDK-only, with NO exemption.
describe('Org deletion DENY (Phase 77, R216/T-77-04) — Admin-SDK-only', () => {
  it('DENIES an ordinary editor from deleting organizations/{orgId} directly', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA', { name: "UserA's Church", active: false })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA')))
  })

  it('DENIES a super-admin using the client SDK from deleting organizations/{orgId} -- no exemption', async () => {
    await seedDoc('organizations/orgA', { name: "UserA's Church", active: false })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA')))
  })
})

// Phase 78 (R225): isOrgMember/isOrgEditor now OR isSuperAdmin() in FRONT of
// the exists()-based membership check (not merely into the isOrgActive
// sub-clause, as the Phase 76 exemption above at lines 372-388 did) -- a
// super-admin with NO membership doc at all gets full content read/write on
// ANY org. The lifecycle-field guard (org-doc `allow update`) had its own
// `|| isSuperAdmin()` disjunct DELETED in the same commit as this widening,
// so a super-admin's client SDK still cannot write active/deactivatedAt/
// deactivatedBy/reactivatedAt/reactivatedBy directly -- see the CRITICAL
// test below. The existing super-admin-client-delete-DENY test immediately
// above (Phase 77, lines 496-501) is NOT duplicated here -- it already
// covers the org-doc delete boundary and requires no changes.
describe('Super-admin content access without a membership doc (R225, Phase 78)', () => {
  it('ALLOWS a super-admin with NO membership doc to read organizations/{orgId}', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church", createdBy: 'someoneElse' })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('ALLOWS a super-admin with NO membership doc to write a content collection (songs)', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'songs', 'song1'), { title: 'Amazing Grace' }),
    )
  })

  it('ALLOWS a super-admin with NO membership doc to enter a DEACTIVATED org (Phase 76 exemption extended)', async () => {
    await seedDoc('organizations/orgA', { name: 'Deactivated Church', active: false })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('DENIES a non-member, non-super-admin from reading organizations/{orgId} -- R225 negative case', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    // No membership doc, no superAdmin claim.
    const context = testEnv.authenticatedContext('randomUid')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('DOES NOT REGRESS an ordinary member of that same org', async () => {
    await seedMembershipDoc('orgA', 'realMemberUid', 'viewer')
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('realMemberUid')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA')))
  })

  it('CRITICAL -- DENIES a super-admin from writing a lifecycle field directly (must use setOrgActive)', async () => {
    await seedDoc('organizations/orgA', { name: "Someone Else's Church" })
    const context = testEnv.authenticatedContext('superAdminUid', { superAdmin: true })
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA'), { active: false }),
    )
  })

  // Org-doc DELETE for a super-admin using the client SDK is already covered
  // verbatim by the "Org deletion DENY" describe block immediately above
  // (src/rules.test.ts:496-501) -- cited here, not duplicated. That test
  // requires no changes for Phase 78: `allow delete: if false;` was never
  // touched by this widening.
})

describe('Catch-all deny', () => {
  it('denies access to undefined paths', async () => {
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'randomCollection', 'randomDoc')))
  })
})

// Phase 65 Plan 02 (65-02): explicit top-level deny for the aiUsage ledger
// (R163) and aiRateLimits counters (R161). Both collections are written
// ONLY by the api Cloud Function via the Admin SDK, which bypasses rules
// entirely — these client-side assertions prove a signed-in app user (even
// an org editor) can neither read nor write either collection. This block
// is committed but UNDEPLOYED (see 65-02-SUMMARY.md for the owner handover);
// the app and functions do not depend on it to operate.
describe('aiUsage / aiRateLimits — explicit deny of client read/write (R161/R163, Admin-SDK-only)', () => {
  it('denies an authenticated org editor from reading an aiUsage doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('aiUsage/entry1', {
      uid: 'userA',
      orgId: 'orgA',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      createdAt: new Date(),
    })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'aiUsage', 'entry1')))
  })

  it('denies an authenticated org editor from writing an aiUsage doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'aiUsage', 'entry2'), {
        uid: 'userA',
        orgId: 'orgA',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        createdAt: new Date(),
      }),
    )
  })

  it('denies an authenticated org editor from reading an aiRateLimits doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('aiRateLimits/userA__min__12345', { count: 3, expireAt: new Date() })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'aiRateLimits', 'userA__min__12345')))
  })

  it('denies an authenticated org editor from writing an aiRateLimits doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'aiRateLimits', 'userA__min__12345'), { count: 1, expireAt: new Date() }),
    )
  })

  it('denies unauthenticated read/write on both collections', async () => {
    await seedDoc('aiUsage/entry3', {
      uid: 'userA',
      orgId: 'orgA',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 10,
      outputTokens: 5,
      createdAt: new Date(),
    })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'aiUsage', 'entry3')))
    await assertFails(setDoc(doc(db, 'aiRateLimits', 'anon__min__1'), { count: 1 }))
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

describe('orgNames — public read, org-editor-scoped create-once claim (name uniqueness)', () => {
  it('allows unauthenticated read of an orgNames doc', async () => {
    await seedDoc('orgNames/grace church', { orgId: 'orgA' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'orgNames', 'grace church')))
  })

  it('allows an editor of the target org to create an unclaimed orgNames doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(setDoc(doc(db, 'orgNames', 'grace church'), { orgId: 'orgA' }))
  })

  it('denies a signed-in user with no membership in the target org from claiming a name for it', async () => {
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgNames', 'grace church'), { orgId: 'orgA' }))
  })

  it('denies a member of a DIFFERENT org from claiming a name for orgA (cross-tenant name-squatting)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgNames', 'grace church'), { orgId: 'orgA' }))
  })

  it('denies unauthenticated write to orgNames', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgNames', 'grace church'), { orgId: 'orgA' }))
  })

  it('denies a second write to an already-claimed orgNames key, even from an editor of the new orgId (first-writer-wins)', async () => {
    await seedDoc('orgNames/grace church', { orgId: 'orgA' })
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'orgNames', 'grace church'), { orgId: 'orgB' }))
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

describe('shareTokens — public read, editor-scoped create, editor-scoped in-place update, editor-scoped delete', () => {
  it('allows unauthenticated read of a shareTokens doc (public share link)', async () => {
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', quarterId: 'q1' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'shareTokens', 'tok-abc')))
  })

  // CREATE (4) — CR-01 (41-REVIEW): the rule used to be `isSignedIn()` alone,
  // which let any signed-in user — editor, viewer, or a member of a totally
  // different org — plant a shareTokens doc claiming an arbitrary orgId.
  // ensureShareLink's adopt-or-create path (src/stores/services.ts) trusts
  // that orgId to decide a service's permanent public link, so this gap was
  // an exploitable trust-boundary violation, not just loose input validation.
  // These four mirror the serviceShareLinks create block above and must fail
  // against the pre-fix rule.
  it('ALLOW — an editor of orgA creates a shareTokens doc for orgA', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'shareTokens', 'tok-new'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Sunday Service' },
      }),
    )
  })

  it('DENY (CR-01) — an editor of a DIFFERENT org cannot create a shareTokens doc carrying orgId orgA (cross-tenant)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'shareTokens', 'tok-new'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Hijacked' },
      }),
    )
  })

  it('DENY (CR-01) — a signed-in user with no org membership anywhere cannot create a shareTokens doc', async () => {
    const context = testEnv.authenticatedContext('userC')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'shareTokens', 'tok-new'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Hijacked' },
      }),
    )
  })

  it('DENY (CR-01) — a viewer-role member of orgA cannot create a shareTokens doc for orgA', async () => {
    await seedMembershipDoc('orgA', 'userV', 'viewer')
    const context = testEnv.authenticatedContext('userV')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'shareTokens', 'tok-new'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Hijacked' },
      }),
    )
  })

  it('DENY (CR-01) — an unauthenticated caller cannot create a shareTokens doc', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'shareTokens', 'tok-new'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Hijacked' },
      }),
    )
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

  // R077 — the in-place refresh path this phase exists to prove. Replaces the
  // prior stale assertion that `shareTokens` update stayed `if false` forever;
  // R077 deliberately reverses that invariant. Six cases: one ALLOW (ROADMAP
  // criterion 3 — the genuine allow case that must actually execute) plus five
  // DENY covering cross-org overwrite, no-membership, orgId reassignment,
  // unauthenticated, and viewer-role.
  it('ALLOW (ROADMAP criterion 3) — an editor of the owning org can refresh a shareTokens doc in place', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'shareTokens', 'tok-abc'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Refreshed Service', updatedAt: 'now' },
      }),
    )
  })

  it('DENY (T-41-04) — an editor of a DIFFERENT org cannot update orgA\'s shareTokens doc (cross-org overwrite)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'shareTokens', 'tok-abc'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Tampered' },
      }),
    )
  })

  it('DENY (T-41-04) — a signed-in user with no org membership anywhere cannot update a shareTokens doc', async () => {
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userC')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'shareTokens', 'tok-abc'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Tampered' },
      }),
    )
  })

  it('DENY (T-41-05) — an editor of the owning org cannot reassign a shareTokens doc to a different orgId', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'shareTokens', 'tok-abc'), {
        orgId: 'orgB',
        serviceId: 'service-1',
      }),
    )
  })

  it('DENY (T-41-04) — an unauthenticated caller cannot update a shareTokens doc', async () => {
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'shareTokens', 'tok-abc'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Tampered' },
      }),
    )
  })

  it('DENY (T-41-08) — a viewer-role member of the owning org cannot update a shareTokens doc', async () => {
    await seedMembershipDoc('orgA', 'userV', 'viewer')
    await seedDoc('shareTokens/tok-abc', { orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userV')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'shareTokens', 'tok-abc'), {
        orgId: 'orgA',
        serviceId: 'service-1',
        serviceSnapshot: { name: 'Tampered' },
      }),
    )
  })
})

describe('serviceShareLinks — org-editor-scoped, no public read', () => {
  // READ (4)
  it('ALLOW — an org editor of orgA reads an existing serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'serviceShareLinks', 'service-1')))
  })

  // T-41-09 — load-bearing. ensureShareLink's very first Firestore operation is
  // exactly this read: a get() against a serviceShareLinks doc that has never
  // been created. `resource` is null for a nonexistent document; a bare
  // `isOrgEditor(resource.data.orgId)` clause would dereference that null and
  // ERROR, and an erroring rule DENIES — so the caller would see
  // PERMISSION_DENIED instead of a clean not-found snapshot, and the entire
  // adopt-or-create flow in Plans 03/04 would be unreachable on its first call.
  // If this test fails, the fix is the rule's null-resource branch, not the test.
  it('ALLOW, load-bearing (T-41-09) — an org editor reads a serviceShareLinks doc that was NEVER seeded, and gets a clean not-found snapshot rather than PERMISSION_DENIED', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    const snap = await assertSucceeds(getDoc(doc(db, 'serviceShareLinks', 'service-999')))
    expect(snap.exists()).toBe(false)
  })

  it('DENY (T-41-06) — an unauthenticated caller cannot read an existing serviceShareLinks doc', async () => {
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'serviceShareLinks', 'service-1')))
  })

  it('DENY (T-41-06) — an editor of a DIFFERENT org cannot read orgA\'s serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'serviceShareLinks', 'service-1')))
  })

  // WR-06 (41-REVIEW): the one gap in an otherwise-thorough set for this
  // security-sensitive rule — isOrgEditor gates viewers out, and the
  // create/delete blocks for this collection already test the viewer case
  // explicitly, but the read block never did.
  it('DENY (WR-06) — a viewer-role member of the owning org cannot read an existing serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgA', 'userV', 'viewer')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userV')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'serviceShareLinks', 'service-1')))
  })

  // CREATE (4)
  it('ALLOW — an editor of orgA creates a serviceShareLinks doc for orgA', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'serviceShareLinks', 'service-2'), {
        token: 'tok-def',
        orgId: 'orgA',
        serviceId: 'service-2',
      }),
    )
  })

  it('DENY (T-41-06) — an editor of a DIFFERENT org cannot create a serviceShareLinks doc carrying orgId orgA (cross-tenant)', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShareLinks', 'service-2'), {
        token: 'tok-def',
        orgId: 'orgA',
        serviceId: 'service-2',
      }),
    )
  })

  it('DENY (T-41-08) — a viewer-role member of orgA cannot create a serviceShareLinks doc for orgA', async () => {
    await seedMembershipDoc('orgA', 'userV', 'viewer')
    const context = testEnv.authenticatedContext('userV')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShareLinks', 'service-2'), {
        token: 'tok-def',
        orgId: 'orgA',
        serviceId: 'service-2',
      }),
    )
  })

  it('DENY — an unauthenticated caller cannot create a serviceShareLinks doc', async () => {
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'serviceShareLinks', 'service-2'), {
        token: 'tok-def',
        orgId: 'orgA',
        serviceId: 'service-2',
      }),
    )
  })

  // UPDATE (3)
  it('ALLOW — an editor of orgA overwrites the seeded serviceShareLinks doc with orgId unchanged', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'serviceShareLinks', 'service-1'), {
        token: 'tok-abc-refreshed',
        orgId: 'orgA',
        serviceId: 'service-1',
      }),
    )
  })

  it('DENY (T-41-04) — an editor of a DIFFERENT org cannot overwrite orgA\'s serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'serviceShareLinks', 'service-1'), {
        token: 'tok-abc-tampered',
        orgId: 'orgA',
        serviceId: 'service-1',
      }),
    )
  })

  it('DENY (T-41-05) — an editor of orgA cannot reassign a serviceShareLinks doc to a different orgId', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'serviceShareLinks', 'service-1'), {
        token: 'tok-abc',
        orgId: 'orgB',
        serviceId: 'service-1',
      }),
    )
  })

  // DELETE (3)
  it('ALLOW — an editor of orgA deletes the seeded serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertSucceeds(deleteDoc(doc(db, 'serviceShareLinks', 'service-1')))
  })

  it('DENY — an editor of a DIFFERENT org cannot delete orgA\'s serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'serviceShareLinks', 'service-1')))
  })

  it('DENY — an unauthenticated caller cannot delete a serviceShareLinks doc', async () => {
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'serviceShareLinks', 'service-1')))
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
    // Phase 77 (R216/T-77-04): see the sibling "allows editor to write org
    // doc" test's comment above -- `write` was narrowed to `update`, so a
    // `setDoc` needs the org doc to already exist to exercise the update
    // path this test is about, not the separately-tested create path.
    await seedDoc('organizations/orgA', { name: "UserA's Church", createdBy: 'userA' })
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
    await seedDoc('organizations/orgA', { name: "UserA's Church", createdBy: 'someoneElse' })
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

// T-42-01 / D-01 — pptxRenders is a single-segment nested collection under
// /organizations/{orgId}, so it is matched by the generic wildcard at
// firestore.rules:198-203 before any dedicated block exists. Task 1 proves
// this contested premise (functions/src/index.ts:144-148 and 42-CONTEXT.md's
// first draft both asserted the opposite) with a real emulator write, BEFORE
// any rules edit lands. See src/rules.test.ts's own git history for the
// Task 2 commit that flips this same assertion from assertSucceeds to
// assertFails once the wildcard's write-exclusion clause is added.
describe('pptxRenders — org-member read, no client write', () => {
  it('DENY (T-42-01, was PROBE pre-fix) — an org editor cannot write a pptxRenders doc via the generic wildcard', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/pptxRenders/import-1', {
      status: 'pending',
      storagePath: 'orgs/orgA/pptx-imports/import-1/source.pptx',
    })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-1'), {
        status: 'ready',
        renderedCount: 99,
      }),
    )
  })

  it('ALLOW (D-02) — a viewer-role member of orgA reads a pptxRenders doc — the grant is member-tier, not editor-tier', async () => {
    await seedMembershipDoc('orgA', 'userV', 'viewer')
    await seedDoc('organizations/orgA/pptxRenders/import-1', {
      status: 'ready',
      storagePath: 'orgs/orgA/pptx-imports/import-1/source.pptx',
      renderedCount: 5,
    })
    const context = testEnv.authenticatedContext('userV')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-1')))
  })

  it('DENY (T-42-03) — an editor of a DIFFERENT org cannot read orgA\'s pptxRenders doc', async () => {
    await seedMembershipDoc('orgB', 'userB', 'editor')
    await seedDoc('organizations/orgA/pptxRenders/import-1', {
      status: 'ready',
      storagePath: 'orgs/orgA/pptx-imports/import-1/source.pptx',
      renderedCount: 5,
    })
    const context = testEnv.authenticatedContext('userB')
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-1')))
  })

  it('DENY (T-42-03) — an unauthenticated caller cannot read orgA\'s pptxRenders doc', async () => {
    await seedDoc('organizations/orgA/pptxRenders/import-1', {
      status: 'ready',
      storagePath: 'orgs/orgA/pptx-imports/import-1/source.pptx',
      renderedCount: 5,
    })
    const context = testEnv.unauthenticatedContext()
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-1')))
  })

  it('DENY (D-02) — a viewer-role member of orgA cannot create a new pptxRenders doc', async () => {
    await seedMembershipDoc('orgA', 'userV', 'viewer')
    const context = testEnv.authenticatedContext('userV')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-2'), {
        status: 'pending',
        storagePath: 'orgs/orgA/pptx-imports/import-2/source.pptx',
      }),
    )
  })

  // WR-03 (42-REVIEW.md): the block above proved the UPDATE half of "write"
  // (T-42-01, forging a ready flip) and a VIEWER's create denial — but not an
  // EDITOR's create/delete denial, which every other collection in this file
  // covers explicitly (see `serviceShareLinks`'s CREATE/UPDATE/DELETE-each
  // structure above). The rule's `allow write` predicate
  // (firestore.rules:234-237) is one unified condition covering create/
  // update/delete, so these are expected to pass by construction — proving
  // it closes the completeness gap the reviewer flagged rather than leaving
  // it to code inspection.
  it('DENY (WR-03) — an org editor cannot create a new pptxRenders doc via the generic wildcard', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-3'), {
        status: 'pending',
        storagePath: 'orgs/orgA/pptx-imports/import-3/source.pptx',
      }),
    )
  })

  it('DENY (WR-03) — an org editor cannot delete an existing pptxRenders doc via the generic wildcard', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/pptxRenders/import-1', {
      status: 'ready',
      storagePath: 'orgs/orgA/pptx-imports/import-1/source.pptx',
      renderedCount: 5,
    })
    const context = testEnv.authenticatedContext('userA')
    const db = context.firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA', 'pptxRenders', 'import-1')))
  })
})

// Quick-fix 2026-08-11: deleting a service-plan item was blocked in production by a
// "Null value error" in the slideGroups delete rule (ServiceEditorView.vue:2791 →
// deleteGroup → PERMISSION_DENIED). Two null-safety fixes:
//   1. A present-but-null `serviceId` on the group doc must be treated as an orphan
//      (deletable). Without the guard the rule evaluated parentGone(null) → svcPath(null)
//      → the group was wedged undeletable.
//   2. isOrgEditor is now exists()-guarded (an unguarded get().data.role errors — treated
//      as deny — when the caller has no member doc or no role field).
describe('slideGroups delete null-safety (2026-08-11 quick fix)', () => {
  const GROUP = 'organizations/orgA/slideGroups/slot-1'

  it('allows an editor to delete a group whose serviceId is present-but-null (wedged orphan)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc(GROUP, { slotId: 'slot-1', serviceId: null, slides: [] })
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertSucceeds(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('allows an editor to delete a legacy group with no serviceId key (regression anchor)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc(GROUP, { slotId: 'slot-1', slides: [] })
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertSucceeds(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('allows an editor to delete a group whose valid serviceId points to a DRAFT service', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/services/service-1', { status: 'draft' })
    await seedDoc(GROUP, { slotId: 'slot-1', serviceId: 'service-1', slides: [] })
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertSucceeds(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('allows an editor to delete a group whose parent service is GONE (orphan)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc(GROUP, { slotId: 'slot-1', serviceId: 'service-deleted', slides: [] })
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertSucceeds(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('still DENIES deleting a group whose valid serviceId points to a PLANNED (locked) service', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('organizations/orgA/services/service-1', { status: 'planned' })
    await seedDoc(GROUP, { slotId: 'slot-1', serviceId: 'service-1', slides: [] })
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('DENIES (cleanly, not error) a signed-in non-member deleting a null-serviceId group', async () => {
    await seedDoc(GROUP, { slotId: 'slot-1', serviceId: null, slides: [] })
    const db = testEnv.authenticatedContext('stranger').firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('DENIES a member whose doc has no role field (isOrgEditor role-absent) deleting a group', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'organizations', 'orgA', 'members', 'userA'), { joinedAt: new Date() })
    })
    await seedDoc(GROUP, { slotId: 'slot-1', serviceId: null, slides: [] })
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  // 2026-08-12 THIRD recurrence. The two prior fixes only guarded the group
  // DOCUMENT's field shapes (present-but-null / absent serviceId, and
  // isOrgEditor's role deref). None guarded the document NOT EXISTING. A slot
  // whose slideGroup was never materialized (a slot that never carried slides)
  // is deleted by confirmSlotDelete → deleteGroup → deleteDoc against a
  // non-existent doc, so `resource == null`. The rule's first OR operand
  // `resource.data.keys().hasAll(['serviceId'])` then dereferences null.data →
  // "Null value error" → the rule errors → DENY. The client's deleteGroup
  // relies on "deleteDoc on a missing doc is a no-op", which is only true when
  // the RULE allows it — so confirmSlotDelete's catch aborted and the slot
  // stayed. Same failure signature as the load-bearing serviceShareLinks
  // `resource == null` guard (T-41-09) elsewhere in this file.
  it('allows an editor to delete a NEVER-MATERIALIZED group (resource == null) — 2026-08-12 recurrence', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    // Deliberately NO seedDoc for the group — the document does not exist.
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertSucceeds(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })

  it('the resource == null delete grant stays ORG-SCOPED — a non-member cannot delete a non-existent group', async () => {
    // No membership seeded for userA under orgA. The resource == null branch must
    // remain behind isOrgEditor(orgId), so a non-editor is still denied (cleanly).
    const db = testEnv.authenticatedContext('userA').firestore()
    await assertFails(deleteDoc(doc(db, 'organizations', 'orgA', 'slideGroups', 'slot-1')))
  })
})

// Phase 58 (R130/R132) — messages/recipients/lockSnapshots are new nested
// collections under services/{docId}. Every test targets the FULL nested
// path (organizations/{orgId}/services/{serviceId}/messages/{id}, etc.) —
// never a sibling organizations/{orgId}/messages/{id} path — so a
// misplaced (sibling) rule block would be caught (58-RESEARCH.md Pitfall 3).
// No client code writes these collections this phase; the rules are
// exercised solely by these tests' own seeded writes. Only the Admin SDK
// (Phase 59+) writes messages status/recipients — this suite proves that
// no client, editor or not, can forge those writes.
describe('services/{id}/messages nested collection (R130)', () => {
  it('ALLOW — an org editor creates a messages doc under their org service', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    const db = testEnv.authenticatedContext('editorA').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1'), {
        type: 'oneoff',
        status: 'queued',
      }),
    )
  })

  it('ALLOW — an org member reads a messages doc', async () => {
    await seedMembershipDoc('orgA', 'memberA', 'member')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1', { type: 'oneoff', status: 'queued' })
    const db = testEnv.authenticatedContext('memberA').firestore()
    await assertSucceeds(
      getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1')),
    )
  })

  it('ALLOW — a viewer-role member also reads a messages doc (read is member-tier, not editor-tier)', async () => {
    await seedMembershipDoc('orgA', 'viewerA', 'viewer')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1', { type: 'oneoff', status: 'queued' })
    const db = testEnv.authenticatedContext('viewerA').firestore()
    await assertSucceeds(
      getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1')),
    )
  })

  it('DENY — a viewer cannot create a messages doc', async () => {
    await seedMembershipDoc('orgA', 'viewerA', 'viewer')
    const db = testEnv.authenticatedContext('viewerA').firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1'), {
        type: 'oneoff',
        status: 'queued',
      }),
    )
  })

  it('DENY — an org editor cannot update a messages doc (status transitions are Admin-SDK-only)', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1', { type: 'oneoff', status: 'queued' })
    const db = testEnv.authenticatedContext('editorA').firestore()
    await assertFails(
      updateDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1'), {
        status: 'sent',
      }),
    )
  })

  it('DENY — an org editor cannot delete a messages doc (Admin-SDK-only)', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1', { type: 'oneoff', status: 'queued' })
    const db = testEnv.authenticatedContext('editorA').firestore()
    await assertFails(
      deleteDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1')),
    )
  })
})

describe('services/{id}/messages/{id}/recipients nested collection (R130) — Admin-SDK-only', () => {
  it('ALLOW — an org member reads a recipients subdoc', async () => {
    await seedMembershipDoc('orgA', 'memberA', 'member')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1/recipients/r1', {
      status: 'pending',
      email: 'volunteer@example.com',
    })
    const db = testEnv.authenticatedContext('memberA').firestore()
    await assertSucceeds(
      getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1', 'recipients', 'r1')),
    )
  })

  it('DENY — an org editor cannot create a recipients subdoc (Admin-SDK-only)', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    const db = testEnv.authenticatedContext('editorA').firestore()
    await assertFails(
      setDoc(
        doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1', 'recipients', 'r1'),
        { status: 'pending', email: 'volunteer@example.com' },
      ),
    )
  })

  it('DENY — an org editor cannot update an existing recipients subdoc (forging a "sent" status)', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1/recipients/r1', {
      status: 'pending',
      email: 'volunteer@example.com',
    })
    const db = testEnv.authenticatedContext('editorA').firestore()
    await assertFails(
      updateDoc(
        doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1', 'recipients', 'r1'),
        { status: 'sent' },
      ),
    )
  })
})

describe('services/{id}/lockSnapshots nested collection (R132)', () => {
  it('ALLOW — an org editor writes a lockSnapshots doc', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    const db = testEnv.authenticatedContext('editorA').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'lockSnapshots', 'snap1'), {
        capturedAt: new Date(),
      }),
    )
  })

  it('ALLOW — an org member reads a lockSnapshots doc', async () => {
    await seedMembershipDoc('orgA', 'memberA', 'member')
    await seedDoc('organizations/orgA/services/svc1/lockSnapshots/snap1', { capturedAt: new Date() })
    const db = testEnv.authenticatedContext('memberA').firestore()
    await assertSucceeds(
      getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'lockSnapshots', 'snap1')),
    )
  })

  it('DENY — a viewer cannot write a lockSnapshots doc', async () => {
    await seedMembershipDoc('orgA', 'viewerA', 'viewer')
    const db = testEnv.authenticatedContext('viewerA').firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'lockSnapshots', 'snap1'), {
        capturedAt: new Date(),
      }),
    )
  })

  it('DENY — a member of a DIFFERENT org cannot read orgA\'s lockSnapshots doc', async () => {
    await seedMembershipDoc('orgB', 'memberB', 'member')
    await seedDoc('organizations/orgA/services/svc1/lockSnapshots/snap1', { capturedAt: new Date() })
    const db = testEnv.authenticatedContext('memberB').firestore()
    await assertFails(
      getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'lockSnapshots', 'snap1')),
    )
  })

  it('DENY — an editor of a DIFFERENT org cannot write orgA\'s lockSnapshots doc', async () => {
    await seedMembershipDoc('orgB', 'editorB', 'editor')
    const db = testEnv.authenticatedContext('editorB').firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'lockSnapshots', 'snap1'), {
        capturedAt: new Date(),
      }),
    )
  })
})
