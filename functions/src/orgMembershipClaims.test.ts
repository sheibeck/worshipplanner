import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  ORG_CLAIM_KEYS,
  buildOrgMembershipClaim,
  buildOrgsMapClaim,
  computeDeactivatedOrgsClaimForUid,
  computeOrgsClaimForUid,
  decideMembershipClaim,
  deactivatedOrgsMapsEqual,
  resolveOrgId,
  syncOrgMembershipClaimHandler,
} from "./orgMembershipClaims";

// Mirrors functions/src/index.test.ts's established mocking seams.
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ setCustomUserClaims: vi.fn(), getUser: vi.fn() })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: vi.fn((_path: string, handler: unknown) => handler),
}));

const UID = "u1";
const ORG_A = "orgA";
const ORG_B = "orgB";

function fakeUserDoc(exists: boolean, orgIds?: string[]) {
  return {
    get: vi.fn(async () => ({
      exists,
      data: () => (exists ? { orgIds } : undefined),
    })),
  };
}

interface FakeMemberDocOptions {
  uid: string;
  role?: string;
  orgId: string;
  /** When true, the org doc's own parent collection is NOT named "organizations". */
  structurallyInvalid?: boolean;
}

/**
 * Mirrors backfillOrgClaims.test.ts's fakeMemberDoc byte-for-byte (same
 * ref.parent.parent... structural chain resolveOrgId expects) so both test
 * files exercise the shared resolveOrgId guard identically.
 */
function fakeMemberDoc(opts: FakeMemberDocOptions) {
  return {
    id: opts.uid,
    data: () => (opts.role !== undefined ? { role: opts.role } : {}),
    ref: {
      parent: {
        // The "members" CollectionReference.
        id: "members",
        parent: {
          // The org DocumentReference (organizations/{orgId}).
          id: opts.orgId,
          parent: {
            // The "organizations" CollectionReference.
            id: opts.structurallyInvalid ? "not-organizations" : "organizations",
          },
        },
      },
    },
  };
}

/**
 * A combined getFirestore() mock: `collection("users")` for
 * decideMembershipClaim's primary-org lookup, `collectionGroup("members")`
 * for computeOrgsClaimForUid's multi-org survivors scan, and (CR-01, Phase
 * 76) `collection("organizations").doc(orgId).get()` for
 * computeDeactivatedOrgsClaimForUid's per-org active reads -- mirrors
 * backfillOrgClaims.test.ts's mockFirestore shape so both test files wire the
 * shared Firestore read surfaces identically. `memberDocs` defaults to an
 * empty array so every pre-existing call site that only cares about the
 * primary-org decision keeps working unchanged (computeOrgsClaimForUid
 * resolves to {}). `orgActiveByOrgId` defaults to {} -- every org id not
 * listed resolves to a NOT-EXISTS org doc, which computeDeactivatedOrgsClaimForUid
 * treats as active (default-true), so every pre-CR-01 test keeps its
 * original "nothing is deactivated" behaviour without being touched.
 */
function mockFirestore(
  userDoc: ReturnType<typeof fakeUserDoc>,
  memberDocs: ReturnType<typeof fakeMemberDoc>[] = [],
  orgActiveByOrgId: Record<string, boolean> = {},
) {
  const usersCollection = { doc: vi.fn(() => userDoc) };
  const organizationsCollection = {
    doc: vi.fn((orgId: string) => ({
      get: vi.fn(async () => {
        const hasEntry = Object.prototype.hasOwnProperty.call(orgActiveByOrgId, orgId);
        return {
          exists: hasEntry,
          data: () => (hasEntry ? { active: orgActiveByOrgId[orgId] } : undefined),
        };
      }),
    })),
  };
  const collectionSpy = vi.fn((name: string) => {
    if (name === "users") return usersCollection;
    if (name === "organizations") return organizationsCollection;
    throw new Error(`mockFirestore: unexpected collection "${name}"`);
  });
  const collectionGroupSpy = vi.fn((name: string) => {
    if (name !== "members") throw new Error(`mockFirestore: unexpected collectionGroup "${name}"`);
    return { get: vi.fn(async () => ({ docs: memberDocs })) };
  });
  vi.mocked(getFirestore).mockReturnValue({
    collection: collectionSpy,
    collectionGroup: collectionGroupSpy,
  } as never);
  return { usersCollection, organizationsCollection, collectionSpy, collectionGroupSpy };
}

function mockAuth(opts: {
  existingClaims?: Record<string, unknown>;
  getUserImpl?: () => Promise<{ customClaims?: Record<string, unknown> }>;
} = {}) {
  const setCustomUserClaims = vi.fn(async () => undefined);
  const getUser =
    opts.getUserImpl !== undefined
      ? vi.fn(opts.getUserImpl)
      : vi.fn(async () => ({ customClaims: opts.existingClaims }));
  vi.mocked(getAuth).mockReturnValue({ setCustomUserClaims, getUser } as never);
  return { setCustomUserClaims, getUser };
}

/**
 * A STATEFUL Auth fake: setCustomUserClaims writes into an in-memory slot
 * that getUser reads back from, so a SECOND write inside the same handler
 * invocation (the clear branch's clearClaimKeys -> mergeAndSetCustomClaims
 * pair) sees the first write's effect -- exactly like the real Admin SDK,
 * where every getUser() call reads live current state. Mirrors
 * backfillOrgClaims.test.ts's statefulAuth. Required to genuinely prove the
 * primary-clear-keeps-surviving-orgs and superAdmin-preservation-on-delete
 * cases rather than asserting them by construction against a mock that
 * silently ignores its own prior writes.
 */
function statefulAuth(initialClaims?: Record<string, unknown>) {
  let claims = initialClaims;
  const setCustomUserClaims = vi.fn(async (_uid: string, patch: Record<string, unknown> | null) => {
    claims = patch ?? undefined;
  });
  const getUser = vi.fn(async () => ({ customClaims: claims }));
  vi.mocked(getAuth).mockReturnValue({ setCustomUserClaims, getUser } as never);
  return { setCustomUserClaims, getUser };
}

afterEach(() => {
  vi.mocked(getFirestore).mockReset();
  vi.mocked(getAuth).mockReset();
});

describe("buildOrgMembershipClaim", () => {
  it("returns the exact { orgId, role } shape and nothing else", () => {
    expect(buildOrgMembershipClaim(ORG_A, "editor")).toEqual({ orgId: ORG_A, role: "editor" });
    expect(Object.keys(buildOrgMembershipClaim(ORG_A, "editor"))).toEqual(["orgId", "role"]);
  });

  it("normalises a legacy 'admin' role to 'editor'", () => {
    expect(buildOrgMembershipClaim(ORG_A, "admin")).toEqual({ orgId: ORG_A, role: "editor" });
  });

  it("ORG_CLAIM_KEYS names exactly the two claim keys", () => {
    expect(ORG_CLAIM_KEYS).toEqual(["orgId", "role"]);
  });
});

describe("buildOrgsMapClaim", () => {
  it("folds multiple memberships into an { [orgId]: role } map", () => {
    expect(
      buildOrgsMapClaim([
        { orgId: "orgA", role: "editor" },
        { orgId: "orgB", role: "viewer" },
      ]),
    ).toEqual({ orgA: "editor", orgB: "viewer" });
  });

  it("normalises a legacy 'admin' role to 'editor', same rule as buildOrgMembershipClaim", () => {
    expect(buildOrgsMapClaim([{ orgId: ORG_A, role: "admin" }])).toEqual({ orgA: "editor" });
  });

  it("skips any membership whose role is undefined -- a live members doc with no role field never enters the map", () => {
    expect(
      buildOrgsMapClaim([
        { orgId: ORG_A, role: "editor" },
        { orgId: ORG_B, role: undefined },
      ]),
    ).toEqual({ orgA: "editor" });
  });

  it("returns {} for an empty membership list -- a user with no surviving memberships yields an empty map, not null", () => {
    expect(buildOrgsMapClaim([])).toEqual({});
  });
});

describe("resolveOrgId", () => {
  it("returns the org id for a well-formed organizations/{orgId}/members/{uid} doc", () => {
    expect(resolveOrgId(fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A }) as never)).toBe(ORG_A);
  });

  it("returns undefined when the parent collection is not named 'organizations'", () => {
    expect(
      resolveOrgId(
        fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A, structurallyInvalid: true }) as never,
      ),
    ).toBeUndefined();
  });
});

describe("computeOrgsClaimForUid", () => {
  it("filters a collectionGroup('members') scan to only the target uid's orgs -- a second uid's docs are excluded", async () => {
    const targetA = fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A });
    const targetB = fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_B });
    const otherUser = fakeMemberDoc({ uid: "other-uid", role: "editor", orgId: ORG_A });
    mockFirestore(fakeUserDoc(true, [ORG_A]), [targetA, targetB, otherUser]);

    const orgs = await computeOrgsClaimForUid(UID);

    expect(orgs).toEqual({ orgA: "editor", orgB: "viewer" });
  });

  it("delete-staleness: a survivors snapshot that no longer contains the removed org's member doc does not carry that org", async () => {
    // Simulates the post-delete state: only orgB's member doc survives.
    const survivorB = fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_B });
    mockFirestore(fakeUserDoc(true, [ORG_A]), [survivorB]);

    const orgs = await computeOrgsClaimForUid(UID);

    expect(orgs).toEqual({ orgB: "viewer" });
    expect(orgs.orgA).toBeUndefined();
  });

  it("NEVER reads users/{uid}.orgIds -- the users collection is never queried by the orgs scan", async () => {
    const memberDoc = fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A });
    const { collectionSpy } = mockFirestore(fakeUserDoc(true, [ORG_A]), [memberDoc]);

    await computeOrgsClaimForUid(UID);

    expect(collectionSpy).not.toHaveBeenCalled();
  });

  it("returns {} when no member doc matches the uid", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), []);

    expect(await computeOrgsClaimForUid(UID)).toEqual({});
  });
});

describe("decideMembershipClaim", () => {
  it("returns skip/no-user-doc when users/{uid} does not exist", async () => {
    mockFirestore(fakeUserDoc(false));
    mockAuth();

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_A,
      documentExists: true,
      role: "editor",
    });

    expect(decision).toEqual({ action: "skip", reason: "no-user-doc" });
  });

  it("returns skip/no-user-doc when orgIds is empty", async () => {
    mockFirestore(fakeUserDoc(true, []));
    mockAuth();

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_A,
      documentExists: true,
      role: "editor",
    });

    expect(decision).toEqual({ action: "skip", reason: "no-user-doc" });
  });

  it("returns skip/not-primary-org when orgIds[0] does not match the write's orgId", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_B,
      documentExists: true,
      role: "editor",
    });

    expect(decision).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("returns clear for a delete (documentExists false) of the primary org", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_A,
      documentExists: false,
      role: undefined,
    });

    expect(decision).toEqual({ action: "clear" });
  });

  it("returns skip/not-primary-org for a delete of a NON-primary membership -- the primary claim must survive", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_B,
      documentExists: false,
      role: undefined,
    });

    expect(decision).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("returns skip/missing-role when the document exists but has no role field -- ambiguous input must NOT clear a valid claim (WR-01)", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_A,
      documentExists: true,
      role: undefined,
    });

    expect(decision).toEqual({ action: "skip", reason: "missing-role" });
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("returns set with the fresh claim when no existing claim matches", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth({ existingClaims: undefined });

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_A,
      documentExists: true,
      role: "editor",
    });

    expect(decision).toEqual({ action: "set", claims: { orgId: ORG_A, role: "editor" } });
  });

  it("returns skip/already-current when the existing claim already matches on both keys", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    const decision = await decideMembershipClaim({
      uid: UID,
      orgId: ORG_A,
      documentExists: true,
      role: "editor",
    });

    expect(decision).toEqual({ action: "skip", reason: "already-current" });
  });

  it("never trusts the passed orgId as authority -- always reads users/{uid}.orgIds first", async () => {
    const { usersCollection } = mockFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    await decideMembershipClaim({ uid: UID, orgId: ORG_A, documentExists: true, role: "editor" });

    expect(usersCollection.doc).toHaveBeenCalledWith(UID);
  });
});

describe("syncOrgMembershipClaimHandler", () => {
  it("create, primary org: single write carries { orgId, role, orgs }, setCustomUserClaims called once", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor" },
      deactivatedOrgs: {},
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("role change: writes a fresh claim carrying the new role in both orgId/role and orgs", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "viewer" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "viewer",
      orgs: { orgA: "viewer" },
      deactivatedOrgs: {},
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("legacy admin: the claim written carries 'editor', never 'admin', in both orgId/role and orgs", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "admin", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "admin" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor" },
      deactivatedOrgs: {},
    });
  });

  it("non-primary org JOIN: orgs gains orgB AND keeps orgA, primary orgId/role are unchanged", async () => {
    // Primary stays orgA -- this write is to orgB, a second org the user just joined.
    mockFirestore(fakeUserDoc(true, [ORG_A]), [
      fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A }),
      fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_B }),
    ]);
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor" } },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_B,
      uid: UID,
      after: { role: "viewer" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor", orgB: "viewer" },
      deactivatedOrgs: {},
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("non-primary org write, orgs already reflects it: no redundant setCustomUserClaims call", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [
      fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A }),
      fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_B }),
    ]);
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor", orgB: "viewer" } },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_B,
      uid: UID,
      after: { role: "viewer" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(0);
    expect(outcome).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("non-primary org DELETE, orgs unaffected: setCustomUserClaims is NOT called -- the primary claim survives", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor" } },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_B,
      uid: UID,
      after: undefined,
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(0);
    expect(outcome).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("missing user document: no claims call, no throw, orgs scan never runs (fully-conservative skip)", async () => {
    const { collectionGroupSpy } = mockFirestore(fakeUserDoc(false));
    const { setCustomUserClaims } = mockAuth();

    const outcome = await expect(
      syncOrgMembershipClaimHandler({
        orgId: ORG_A,
        uid: UID,
        after: { role: "editor" },
      }),
    ).resolves.toEqual({ action: "skip", reason: "no-user-doc" });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(collectionGroupSpy).not.toHaveBeenCalled();
    void outcome;
  });

  it("empty orgIds: no claims call, no throw", async () => {
    mockFirestore(fakeUserDoc(true, []));
    const { setCustomUserClaims } = mockAuth();

    await expect(
      syncOrgMembershipClaimHandler({
        orgId: ORG_A,
        uid: UID,
        after: { role: "editor" },
      }),
    ).resolves.toEqual({ action: "skip", reason: "no-user-doc" });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("already current AND orgs unchanged: no redundant setCustomUserClaims call (idempotency)", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor" } },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(outcome).toEqual({ action: "skip", reason: "already-current" });
  });

  it("malformed create/update (document exists, no role field): does NOT clear a still-valid claim -- previously-ambiguous case (WR-01)", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    // `after` exists (this is a create/update, not a delete) but has no `role`
    // key -- e.g. a manual Firestore Console edit. Before WR-01 this was
    // indistinguishable from a delete and would have wiped a valid claim via
    // setCustomUserClaims(uid, null).
    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: {},
    });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(outcome).toEqual({ action: "skip", reason: "missing-role" });
  });

  it("primary-org DELETE while the user still belongs to a second org: SINGLE atomic write clears orgId/role and sets orgs to the survivors (highest-risk case, R208, WR-01)", async () => {
    // Org A's member doc is gone (deleted); org B survives.
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_B })]);
    const { setCustomUserClaims } = statefulAuth({
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor", orgB: "viewer" },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: undefined,
    });

    // WR-01: the clear branch is now ONE atomic setCustomUserClaims call --
    // never a window where a minted token could see cleared primary keys but
    // a still-stale orgs map. orgId/role are gone, orgB remains, orgA is gone
    // (proves the primary-clear and orgs-recompute are independent, not a
    // blanket clear, while happening in a single write).
    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { orgs: { orgB: "viewer" }, deactivatedOrgs: {} });
    expect(outcome).toEqual({ action: "clear" });
  });

  it("primary-org DELETE when the user belongs to no other org: SINGLE atomic write clears orgId/role and orgs becomes {} (WR-01)", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), []);
    const { setCustomUserClaims } = statefulAuth({ orgId: ORG_A, role: "editor", orgs: { orgA: "editor" } });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: undefined,
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { orgs: {}, deactivatedOrgs: {} });
    expect(outcome).toEqual({ action: "clear" });
  });

  it("preserves superAdmin (direction A): a widened create/update on an account with superAdmin:true leaves it intact", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({ existingClaims: { superAdmin: true } });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      superAdmin: true,
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor" },
      deactivatedOrgs: {},
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("preserves superAdmin (direction B): a primary-org delete issues exactly ONE atomic write that clears orgId/role, recomputes orgs, and leaves superAdmin:true intact (SC1, WR-01)", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), []);
    const { setCustomUserClaims } = statefulAuth({
      orgId: ORG_A,
      role: "editor",
      superAdmin: true,
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: undefined,
    });

    // WR-01: exactly ONE claim write for the delete path -- no orgId/role, no
    // stale org left in `orgs`, superAdmin still intact.
    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { superAdmin: true, orgs: {}, deactivatedOrgs: {} });
    const [, writtenClaims] = setCustomUserClaims.mock.calls[0]!;
    expect(writtenClaims).not.toHaveProperty("orgId");
    expect(writtenClaims).not.toHaveProperty("role");
    expect(outcome).toEqual({ action: "clear" });
  });

  it("claims-too-large: setCustomUserClaims throwing auth/claims-too-large logs a distinguishable message (WR-02)", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const claimsTooLargeError = Object.assign(new Error("Custom claims exceed max size"), {
      code: "auth/claims-too-large",
    });
    const setCustomUserClaims = vi.fn(async () => {
      throw claimsTooLargeError;
    });
    const getUser = vi.fn(async () => ({ customClaims: undefined }));
    vi.mocked(getAuth).mockReturnValue({ setCustomUserClaims, getUser } as never);

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(outcome.action).toBe("failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`CLAIM SIZE LIMIT EXCEEDED for uid=${UID}`),
      claimsTooLargeError,
    );
    // Never the generic message for this distinct failure mode.
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      "[orgMembershipClaims] syncOrgMembershipClaim:",
      expect.anything(),
    );
    consoleErrorSpy.mockRestore();
  });

  it("auth lookup failure: getUser rejecting resolves with a failure outcome, does not throw out of the handler", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockAuth({
      getUserImpl: async () => {
        throw new Error("auth/user-not-found");
      },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(outcome.action).toBe("failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[orgMembershipClaims] syncOrgMembershipClaim:",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  // --- CR-01 (76-REVIEW.md): the trigger self-heal ---------------------------
  // A member who joins an ALREADY-deactivated org after setOrgActive's
  // one-time fan-out ran (pending-invite acceptance, or assignOrgAdminHandler)
  // still fires THIS trigger -- it must independently compute deactivatedOrgs
  // from the org's live active state, not rely on setOrgActive running again.

  it("CR-01: a brand-new member of an ALREADY-deactivated org gets deactivatedOrgs[orgId] set on the SAME write that grants their primary claim", async () => {
    mockFirestore(
      fakeUserDoc(true, [ORG_A]),
      [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })],
      { [ORG_A]: false },
    );
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor" },
      deactivatedOrgs: { orgA: true },
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("CR-01: a member joining a SECOND, deactivated org (non-primary write) gets deactivatedOrgs[orgB] set, orgA's active status is unaffected", async () => {
    mockFirestore(
      fakeUserDoc(true, [ORG_A]),
      [
        fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A }),
        fakeMemberDoc({ uid: UID, role: "viewer", orgId: ORG_B }),
      ],
      { [ORG_B]: false },
    );
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor" }, deactivatedOrgs: {} },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_B,
      uid: UID,
      after: { role: "viewer" },
    });

    // Skip branch: the write merges onto the EXISTING claims via
    // mergeAndSetCustomClaims -- orgId/role survive untouched (this write
    // never decided to clear or reset them), only orgs/deactivatedOrgs change.
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor", orgB: "viewer" },
      deactivatedOrgs: { orgB: true },
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("CR-01: an org whose doc has no `active` field at all (pre-Phase-76) never gets a deactivatedOrgs entry", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })]);
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    await syncOrgMembershipClaimHandler({ orgId: ORG_A, uid: UID, after: { role: "editor" } });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor" },
      deactivatedOrgs: {},
    });
  });

  // --- WR-03 (76-REVIEW.md): reactivate-fan-out / rejoin symmetry -------------
  // Same self-heal closes the reactivate-side gap: a member removed then
  // re-added mid-deactivation, or an org reactivated after a member rejoined,
  // recomputes fresh from the org's CURRENT active state on every write.

  it("WR-03: a member re-added to an org that has since been REACTIVATED gets NO deactivatedOrgs entry, even though a stale claim from before still carried one", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })], {
      [ORG_A]: true,
    });
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor" }, deactivatedOrgs: { orgA: true } },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    // Primary orgId/role are already current (and survive the merge
    // untouched), but deactivatedOrgs changed (stale {orgA:true} -> fresh
    // {}), so this is NOT a no-op skip.
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: ORG_A,
      role: "editor",
      orgs: { orgA: "editor" },
      deactivatedOrgs: {},
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("idempotency: a re-fired write with orgs AND deactivatedOrgs both already current issues no redundant setCustomUserClaims call", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [fakeMemberDoc({ uid: UID, role: "editor", orgId: ORG_A })], {
      [ORG_A]: false,
    });
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: ORG_A, role: "editor", orgs: { orgA: "editor" }, deactivatedOrgs: { orgA: true } },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(outcome).toEqual({ action: "skip", reason: "already-current" });
  });
});

describe("computeDeactivatedOrgsClaimForUid", () => {
  it("returns { [orgId]: true } only for orgs whose doc explicitly reads active: false", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [], { [ORG_A]: false, [ORG_B]: true });

    expect(await computeDeactivatedOrgsClaimForUid([ORG_A, ORG_B])).toEqual({ orgA: true });
  });

  it("treats a MISSING org doc as active -- no entry, mirrors isOrgActive()'s default-true", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [], {});

    expect(await computeDeactivatedOrgsClaimForUid([ORG_A])).toEqual({});
  });

  it("returns {} for an empty orgIds list", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), [], {});

    expect(await computeDeactivatedOrgsClaimForUid([])).toEqual({});
  });
});

describe("deactivatedOrgsMapsEqual", () => {
  it("treats undefined as equivalent to {}", () => {
    expect(deactivatedOrgsMapsEqual(undefined, {})).toBe(true);
  });

  it("returns false when a key's presence differs", () => {
    expect(deactivatedOrgsMapsEqual({}, { orgA: true })).toBe(false);
  });

  it("returns true for an identical single-entry map", () => {
    expect(deactivatedOrgsMapsEqual({ orgA: true }, { orgA: true })).toBe(true);
  });
});
