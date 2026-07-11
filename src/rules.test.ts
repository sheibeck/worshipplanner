import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

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
