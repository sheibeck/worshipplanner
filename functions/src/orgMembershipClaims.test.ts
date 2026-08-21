import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  ORG_CLAIM_KEYS,
  buildOrgMembershipClaim,
  buildOrgsMapClaim,
  computeOrgsClaimForUid,
  decideMembershipClaim,
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
 * decideMembershipClaim's primary-org lookup, and `collectionGroup("members")`
 * for computeOrgsClaimForUid's multi-org survivors scan -- mirrors
 * backfillOrgClaims.test.ts's mockFirestore shape so both test files wire the
 * two Firestore read surfaces identically. `memberDocs` defaults to an empty
 * array so every pre-existing call site that only cares about the primary-org
 * decision keeps working unchanged (computeOrgsClaimForUid resolves to {}).
 */
function mockFirestore(
  userDoc: ReturnType<typeof fakeUserDoc>,
  memberDocs: ReturnType<typeof fakeMemberDoc>[] = [],
) {
  const usersCollection = { doc: vi.fn(() => userDoc) };
  const collectionSpy = vi.fn((name: string) => {
    if (name === "users") return usersCollection;
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
  return { usersCollection, collectionSpy, collectionGroupSpy };
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

  it("primary-org DELETE while the user still belongs to a second org: orgId/role cleared, orgs recomputed STILL contains the second org (highest-risk case, R208)", async () => {
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

    expect(setCustomUserClaims).toHaveBeenCalledTimes(2);
    // Call 1 (clearClaimKeys): orgId/role gone, orgs untouched by this call.
    expect(setCustomUserClaims).toHaveBeenNthCalledWith(1, UID, {
      orgs: { orgA: "editor", orgB: "viewer" },
    });
    // Call 2 (mergeAndSetCustomClaims): orgs recomputed from survivors --
    // orgB remains, orgA is gone -- and orgId/role stay absent (proves the
    // primary-clear and orgs-recompute are independent, not a blanket clear).
    expect(setCustomUserClaims).toHaveBeenNthCalledWith(2, UID, { orgs: { orgB: "viewer" } });
    expect(outcome).toEqual({ action: "clear" });
  });

  it("primary-org DELETE when the user belongs to no other org: orgId/role cleared, orgs becomes {}", async () => {
    mockFirestore(fakeUserDoc(true, [ORG_A]), []);
    const { setCustomUserClaims } = statefulAuth({ orgId: ORG_A, role: "editor", orgs: { orgA: "editor" } });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      after: undefined,
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(setCustomUserClaims).toHaveBeenNthCalledWith(2, UID, { orgs: {} });
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
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("preserves superAdmin (direction B): a primary-org delete clears orgId/role, recomputes orgs, and leaves superAdmin:true intact (SC1)", async () => {
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

    expect(setCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(setCustomUserClaims).toHaveBeenNthCalledWith(1, UID, { superAdmin: true });
    expect(setCustomUserClaims).toHaveBeenNthCalledWith(2, UID, { superAdmin: true, orgs: {} });
    expect(outcome).toEqual({ action: "clear" });
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
});
