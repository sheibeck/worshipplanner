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
  // Phase 40 (v1.5 claim migration, Deploy 2 complete 2026-08-12): membership is now the
  // claim ALONE. No members document is seeded -- a pass can only have come from
  // request.auth.token.orgId / .role. This is the single membership path (the
  // cross-service firestore.exists() fallback was removed at Deploy 2), and it is fully
  // emulator-verifiable precisely because no cross-service call is involved.
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

describe('storage.rules — multi-org claim (phase 73, R209/R211)', () => {
  // Phase 73 widens the claim to also carry a full `orgs: {[orgId]: role}` map alongside
  // the unchanged primary orgId/role. No members document is seeded in any of these cases
  // -- membership is claim-only, so a pass can only have come from the widened
  // isOrgMemberByClaim reading request.auth.token.orgs (or, for the legacy case, the
  // unchanged primary orgId/role arm).

  it('allows a multi-org user to read and write under BOTH orgs in their orgs map', async () => {
    const context = testEnv.authenticatedContext('userA', {
      orgId: 'orgA',
      role: 'editor',
      orgs: { orgA: 'editor', orgB: 'viewer' },
    })
    const storage = context.storage()

    const fileRefA = ref(storage, 'orgs/orgA/pptx-imports/multi1/source.pptx')
    await assertSucceeds(uploadBytes(fileRefA, SMALL_BYTES))
    await assertSucceeds(getBytes(fileRefA))

    const fileRefB = ref(storage, 'orgs/orgB/pptx-imports/multi2/source.pptx')
    await assertSucceeds(uploadBytes(fileRefB, SMALL_BYTES))
    await assertSucceeds(getBytes(fileRefB))
  })

  it('denies a multi-org user under an org NOT present in their orgs map (cross-org DENY)', async () => {
    // orgs carries orgA + orgB but deliberately NOT orgC -- proves the new arm cannot be
    // tricked into authorizing an org the token never listed.
    const context = testEnv.authenticatedContext('userA', {
      orgId: 'orgA',
      role: 'editor',
      orgs: { orgA: 'editor', orgB: 'viewer' },
    })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgC/pptx-imports/multi3/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('allows a legacy claim (no orgs key at all) to still access its primary org (R211)', async () => {
    // No `orgs` key at all -- this is the pre-widening / not-yet-backfilled token shape.
    // Proves the legacy arm still authorizes AND that an absent orgs key does not
    // error-deny (the null-guard from Pitfall 4 is exercised here).
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/multi4/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
  })
})

// Phase 76 (R213): deactivatedOrgs claim guard. Storage CANNOT read
// organizations/{orgId}.active live (firestore.get()/exists() is inert in
// the Storage emulator -- firebase-js-sdk#6803, CLAUDE.md's documented
// 2026-08-06 incident), so this is CLAIM-ONLY, fanned out server-side by
// setOrgActive (functions/src/orgProvisioning.ts). No membership doc is
// seeded in any case below -- Storage membership is claim-only, per this
// file's own established convention.
describe('storage.rules — deactivatedOrgs claim (R213, Phase 76)', () => {
  it('DENIES a caller whose token carries the LEGACY arm only, plus deactivatedOrgs for that org', async () => {
    const context = testEnv.authenticatedContext('userA', {
      orgId: 'orgA',
      role: 'editor',
      deactivatedOrgs: { orgA: true },
    })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/deact1/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('DENIES a caller whose token carries the MULTI-ORG arm, plus deactivatedOrgs for that org -- proves the guard wraps the WHOLE OR-expression, not either arm individually', async () => {
    const context = testEnv.authenticatedContext('userA', {
      orgs: { orgA: 'editor' },
      deactivatedOrgs: { orgA: true },
    })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/deact2/source.pptx')

    await assertFails(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('ALLOWS a super-admin with deactivatedOrgs set for the org, plus a valid membership claim for it -- the super-admin exemption', async () => {
    const context = testEnv.authenticatedContext('adminUid', {
      orgId: 'orgA',
      role: 'editor',
      deactivatedOrgs: { orgA: true },
      superAdmin: true,
    })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/deact3/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('ALLOWS (regression) a caller whose deactivatedOrgs map names a DIFFERENT org -- no false-positive block', async () => {
    const context = testEnv.authenticatedContext('userA', {
      orgId: 'orgA',
      role: 'editor',
      deactivatedOrgs: { orgB: true },
    })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/deact4/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
  })

  it('ALLOWS (regression) a caller with NO deactivatedOrgs key at all -- absent key must not error-deny', async () => {
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/pptx-imports/deact5/source.pptx')

    await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
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

describe('storage.rules — claim-only membership (Deploy 2, R075 guard)', () => {
  // No emulator interaction needed -- this is a static assertion against the rules
  // file's own text. It lives in this file because vitest.rules.config.ts already
  // includes it and it is the file it guards.
  //
  // Deploy 2 (2026-08-12) removed the cross-service Firestore-membership fallback arm.
  // Membership is now proven SOLELY by the custom auth claim (functions/DEPLOY-ORG-CLAIMS.md
  // Step 4). This test replaced the former "keeps the fallback ORed" tripwire: it is the
  // deliberate, written acknowledgment that the fallback is gone, and it now guards the
  // INVERSE invariant -- that no cross-service firestore.exists() read is ever
  // re-introduced into storage.rules. Re-adding one would be inert in the Storage emulator
  // (firebase-js-sdk#6803) and is exactly how a deny-everyone rule once shipped undetected
  // for a milestone (see CLAUDE.md). Before this removal every user was confirmed single-org
  // (backfill dry-run + mandatory pre-check) and all live tokens were soaked to carry the
  // claim; the migration is safe precisely because those gates passed.
  it('proves membership on the claim ALONE, with no Firestore fallback re-introduced', () => {
    const raw = readFileSync('storage.rules', 'utf8')
    // Strip `//` line comments FIRST, THEN collapse whitespace. The comments in
    // storage.rules deliberately discuss the now-removed fallback ("the ...
    // firestore.exists() fallback arm has been removed"), so the ABSENCE checks below must
    // run against rule CODE only -- otherwise the prose describing the fix would trip the
    // very guard that protects it.
    const codeOnly = raw
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join(' ')
      .replace(/\s+/g, ' ')

    // The claim predicate is present and reads the exact two keys plan 40-02 writes.
    expect(codeOnly).toContain('request.auth.token.orgId')
    expect(codeOnly).toContain('request.auth.token.role')

    // Phase 73: the widened multi-org arm actually reads the orgs map claim.
    expect(codeOnly).toContain('request.auth.token.orgs')

    // The cross-service Firestore fallback is GONE from the rule logic. Its inertness in
    // the Storage emulator is the whole reason this migration exists -- re-introducing any
    // of these three forms must fail this test loudly.
    expect(codeOnly).not.toContain('firestore.exists(')
    expect(codeOnly).not.toContain('isOrgMemberByFirestore')
    expect(codeOnly).not.toContain('/databases/(default)/documents/')

    // Membership resolves to the claim helper alone -- no disjunction remains.
    expect(codeOnly).toMatch(/isOrgMember\(orgId\)\s*{\s*return isOrgMemberByClaim\(orgId\);/)
  })
})
