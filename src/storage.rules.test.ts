import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes, getBytes } from 'firebase/storage'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: {
      // Loaded so the storage.rules firestore.exists() cross-service membership lookup
      // has real rules (and real data) to resolve against.
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  })
})

afterEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.clearStorage()
})

afterAll(async () => {
  await testEnv.cleanup()
})

// Helper: seed a membership doc bypassing rules (Firestore side of the cross-service check)
async function seedMembershipDoc(orgId: string, uid: string, role: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'organizations', orgId, 'members', uid), {
      role,
      joinedAt: new Date(),
    })
  })
}

const SMALL_BYTES = new Uint8Array([1, 2, 3, 4])
// One byte over the 25MB (26214400 byte) cap in storage.rules.
const OVER_CAP_BYTES = new Uint8Array(26214401)
// ~40MB — under the media path's 50MB cap but well over the non-media 25MB cap,
// proving the media match's raised ceiling actually applies to this path.
const MEDIA_UNDER_CAP_BYTES = new Uint8Array(40 * 1024 * 1024)
// One byte over the media path's 50MB (52428800 byte) cap.
const MEDIA_OVER_CAP_BYTES = new Uint8Array(52428801)

describe('storage.rules — org membership', () => {
  it('allows an org member to write and read an object under their org path', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
    await assertSucceeds(getBytes(fileRef))
  })

  it('denies a non-member from reading an object under another org path', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    // Seed the object bypassing rules so we can test read denial in isolation.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const storage = context.storage()
      await uploadBytes(ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx'), SMALL_BYTES)
    })

    const context = testEnv.authenticatedContext('userB')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx')

    await assertFails(getBytes(fileRef))
  })

  it('denies a non-member from writing under an org path they do not belong to', async () => {
    const context = testEnv.authenticatedContext('userB')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import2/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('denies a member write that exceeds the 25MB size cap', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import3/source.pptx')

    await assertFails(uploadBytes(fileRef, OVER_CAP_BYTES))
  })
})

describe('storage.rules — media path', () => {
  it('allows an org member to upload a ~40MB media file (under the 50MB media cap)', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m1/clip.mp4')

    await assertSucceeds(uploadBytes(fileRef, MEDIA_UNDER_CAP_BYTES))
  })

  it('denies a member media upload that exceeds the 50MB media cap', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m2/clip.mp4')

    await assertFails(uploadBytes(fileRef, MEDIA_OVER_CAP_BYTES))
  })

  it('denies a non-member from writing to another org media path', async () => {
    const context = testEnv.authenticatedContext('userB')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m3/clip.mp4')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('regression: the media match does not loosen the non-media pptx-imports 25MB cap', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import4/source.pptx')

    await assertFails(uploadBytes(fileRef, OVER_CAP_BYTES))
  })
})
