import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { doc, getDoc, setDoc } from 'firebase/firestore'

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
