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
  // Phase 40 (v1.5 claim migration): these tests prove the CLAIM arm of the dual-read
  // in isolation. No members document is seeded -- a pass can only have come from
  // request.auth.token.orgId / .role, not from firestore.exists(). The
  // Firestore-fallback arm's allow case is NOT behaviourally provable in the Storage
  // emulator (firebase-js-sdk#6803: firestore.exists() is inert there even for a
  // document proven to exist by an admin read) -- it is proven instead by the source
  // assertion in the "dual-read structure" describe block below, plus the owner's
  // post-deploy-1 confirmation recorded in functions/DEPLOY-ORG-CLAIMS.md.
  it('allows an org member to write and read an object under their org path', async () => {
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
    await assertSucceeds(getBytes(fileRef))
  })

  it('allows an org member whose claim carries the viewer role', async () => {
    // Pins the rule's actual contract: role must be non-null, not a specific value.
    // A later tightening to editor-only cannot land silently.
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'viewer' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1b/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('denies a non-member from reading an object under another org path', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    // Seed the object bypassing rules so we can test read denial in isolation.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const storage = context.storage()
      await uploadBytes(ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx'), SMALL_BYTES)
    })

    // userB carries a VALID but mismatched claim (orgB, not orgA) -- proves the claim
    // arm rejects a real claim for the wrong org, not merely a claim-less token.
    const context = testEnv.authenticatedContext('userB', { orgId: 'orgB', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx')

    await assertFails(getBytes(fileRef))
  })

  it('denies a non-member from writing under an org path they do not belong to', async () => {
    // userB carries a VALID but mismatched claim (orgB, not orgA) -- proves the claim
    // arm rejects a real claim for the wrong org, not merely a claim-less token.
    const context = testEnv.authenticatedContext('userB', { orgId: 'orgB', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import2/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('denies a member write that exceeds the 25MB size cap', async () => {
    // Valid claim, no members doc -- membership is satisfied via the claim arm, so
    // the size conjunct is the SOLE reason for denial (not vacuous against a
    // deny-everyone rule).
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import3/source.pptx')

    await assertFails(uploadBytes(fileRef, OVER_CAP_BYTES))
  })

  it('denies a caller whose claim names a different organization', async () => {
    // No members document anywhere -- both arms must independently deny.
    const context = testEnv.authenticatedContext('userC', { orgId: 'orgB', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import5/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('denies a caller whose claim carries an orgId but no role', async () => {
    // Pins the non-null-role conjunct so it cannot be dropped silently: a claim with
    // a matching orgId but no role key must still be denied.
    const context = testEnv.authenticatedContext('userD', { orgId: 'orgA' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import6/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })
})

describe('storage.rules — media path', () => {
  // Phase 40: claim-arm proof, no members document seeded -- see the comment above
  // the org-membership describe block's allow-cases for why.
  it('allows an org member to upload a ~40MB media file (under the 50MB media cap)', async () => {
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m1/clip.mp4')

    await assertSucceeds(uploadBytes(fileRef, MEDIA_UNDER_CAP_BYTES))
  })

  it('denies a member media upload that exceeds the 50MB media cap', async () => {
    // Valid claim, no members doc -- membership is satisfied via the claim arm, so
    // the size conjunct is the SOLE reason for denial.
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m2/clip.mp4')

    await assertFails(uploadBytes(fileRef, MEDIA_OVER_CAP_BYTES))
  })

  it('denies a non-member from writing to another org media path', async () => {
    // userB carries a VALID but mismatched claim (orgB, not orgA).
    const context = testEnv.authenticatedContext('userB', { orgId: 'orgB', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m3/clip.mp4')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('regression: the media match does not loosen the non-media pptx-imports 25MB cap', async () => {
    // Valid claim, no members doc -- membership is satisfied via the claim arm, so
    // the size conjunct is the SOLE reason for denial.
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import4/source.pptx')

    await assertFails(uploadBytes(fileRef, OVER_CAP_BYTES))
  })

  it('denies a caller with neither a claim nor a membership document on the media path', async () => {
    // Both arms independently deny: bare authenticatedContext (no claim options)
    // and no members document seeded anywhere.
    const context = testEnv.authenticatedContext('userC')
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/media/m4/clip.mp4')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })
})

describe('storage.rules — dual-read structure (R075 lockout guard)', () => {
  // No emulator interaction needed -- this is a static assertion against the rules
  // file's own text. It lives in this file because vitest.rules.config.ts already
  // includes it and it is the file it guards.
  //
  // Automated guard against Pitfall 1 (40-RESEARCH.md): an AND instead of an OR, or a
  // deleted Firestore-fallback predicate, locks out every member whose token predates
  // the claim rollout. This test fails on either mistake.
  //
  // The Firestore-fallback arm's ALLOW behaviour cannot be proven in the Storage
  // emulator (firebase-js-sdk#6803) -- see the comment on the org-membership
  // describe block's allow-cases. This test proves the arm's continued STRUCTURAL
  // presence instead, which is the honest substitute.
  it('keeps the Firestore-membership fallback ORed, never ANDed, into the membership check', () => {
    const raw = readFileSync('storage.rules', 'utf8')
    // Collapse whitespace so formatting differences (line breaks, indentation) can't
    // defeat the substring/regex checks below.
    const normalized = raw.replace(/\s+/g, ' ')

    // The production-proven fallback predicate was not deleted.
    expect(normalized).toContain('firestore.exists(')

    // The claim predicate is present and reads the exact two keys plan 40-02 writes.
    expect(normalized).toContain('request.auth.token.orgId')
    expect(normalized).toContain('request.auth.token.role')

    // The two membership predicates must be combined disjunctively: the claim
    // predicate (helper-function form `isOrgMemberByClaim(...)`, or an inlined claim
    // expression) must be followed by `||` before the Firestore predicate
    // (helper-function form `isOrgMemberByFirestore(...)`, or an inlined
    // `firestore.exists(...)` expression). Written to accept either form per Task 1's
    // documented fallback (inlining if the emulator rejects helper functions).
    const claimFragment =
      /(isOrgMemberByClaim\([^)]*\)|request\.auth\.token\.orgId == orgId[^|]*)/.source
    const firestoreFragment =
      /(isOrgMemberByFirestore\([^)]*\)|firestore\.exists\([^)]*\))/.source
    const orJoinedRegex = new RegExp(`${claimFragment}\\s*\\|\\|\\s*${firestoreFragment}`)
    expect(normalized).toMatch(orJoinedRegex)

    // The conjunctive form of those same two predicates must NOT appear. Build the
    // forbidden string at runtime (not as one literal) so a hand-written literal
    // in this test can't accidentally drift out of sync with what it's guarding.
    const claimCall = 'isOrgMemberByClaim(orgId)'
    const firestoreCall = 'isOrgMemberByFirestore(orgId)'
    const andSeparator = ['&', '&'].join('')
    const forbiddenConjunction = [claimCall, andSeparator, firestoreCall].join(' ')
    expect(normalized).not.toContain(forbiddenConjunction)
  })
})
