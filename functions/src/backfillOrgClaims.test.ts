import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { backfillOrgMembershipClaims } from "./backfillOrgClaims";

// Mirrors functions/src/orgMembershipClaims.test.ts's established mocking seams.
// backfillOrgClaims.ts imports decideMembershipClaim from ./orgMembershipClaims,
// which itself calls getFirestore().collection("users")... and getAuth().getUser()
// -- so the SAME getFirestore()/getAuth() mock must satisfy both the backfill
// script's own collectionGroup('members') query and decideMembershipClaim's
// internal users/{uid} lookup and claims comparison.
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ setCustomUserClaims: vi.fn(), getUser: vi.fn() })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: vi.fn((_path: string, handler: unknown) => handler),
}));

const ORG_A = "orgA";
const ORG_B = "orgB";

interface FakeMemberDocOptions {
  uid: string;
  role?: string;
  /** null simulates a members-collection document with no parent org doc at all. */
  orgId?: string | null;
  /** When true, the org doc's own parent collection is NOT named "organizations". */
  structurallyInvalid?: boolean;
}

function fakeMemberDoc(opts: FakeMemberDocOptions) {
  const orgId = opts.orgId === undefined ? ORG_A : opts.orgId;
  return {
    id: opts.uid,
    data: () => (opts.role !== undefined ? { role: opts.role } : {}),
    ref: {
      parent: {
        // The "members" CollectionReference.
        id: "members",
        parent:
          orgId === null
            ? null
            : {
                // The org DocumentReference (organizations/{orgId}).
                id: orgId,
                parent: {
                  // The "organizations" CollectionReference.
                  id: opts.structurallyInvalid ? "not-organizations" : "organizations",
                },
              },
      },
    },
  };
}

function fakeUserDoc(exists: boolean, orgIds?: string[]) {
  return {
    get: vi.fn(async () => ({
      exists,
      data: () => (exists ? { orgIds } : undefined),
    })),
  };
}

/**
 * A fake collectionGroup('members').get() chain, plus the users/{uid} lookups
 * decideMembershipClaim performs internally against the SAME getFirestore() mock.
 */
function mockFirestore(
  memberDocs: ReturnType<typeof fakeMemberDoc>[],
  userDocsByUid: Record<string, ReturnType<typeof fakeUserDoc>>,
) {
  const collectionGroupSpy = vi.fn((name: string) => {
    if (name !== "members") throw new Error(`mockFirestore: unexpected collectionGroup "${name}"`);
    return { get: vi.fn(async () => ({ docs: memberDocs })) };
  });
  const usersCollection = {
    doc: vi.fn((uid: string) => userDocsByUid[uid] ?? fakeUserDoc(false)),
  };
  vi.mocked(getFirestore).mockReturnValue({
    collectionGroup: collectionGroupSpy,
    collection: vi.fn((name: string) => {
      if (name === "users") return usersCollection;
      throw new Error(`mockFirestore: unexpected collection "${name}"`);
    }),
  } as never);
  return { collectionGroupSpy, usersCollection };
}

/**
 * A stateful fake Auth: setCustomUserClaims writes into an in-memory map that
 * getUser reads back from, so a second backfill run against the same fake sees the
 * claim the first run wrote -- the only way to genuinely exercise idempotency
 * (D-11) across two calls rather than asserting it by construction.
 */
function statefulAuth(overrides: Record<string, () => Promise<{ customClaims?: unknown }>> = {}) {
  const claimsByUid = new Map<string, unknown>();
  const setCustomUserClaims = vi.fn(async (uid: string, claims: unknown) => {
    claimsByUid.set(uid, claims ?? undefined);
  });
  const getUser = vi.fn(async (uid: string) => {
    if (overrides[uid]) return overrides[uid]();
    return { customClaims: claimsByUid.get(uid) };
  });
  vi.mocked(getAuth).mockReturnValue({ setCustomUserClaims, getUser } as never);
  return { setCustomUserClaims, getUser, claimsByUid };
}

afterEach(() => {
  vi.mocked(getFirestore).mockReset();
  vi.mocked(getAuth).mockReset();
});

describe("backfillOrgMembershipClaims", () => {
  it("apply mode: two members in their primary org, neither claimed -- processed 2, skipped 0, failed empty, setCustomUserClaims called twice", async () => {
    const u1 = fakeMemberDoc({ uid: "u1", role: "editor", orgId: ORG_A });
    const u2 = fakeMemberDoc({ uid: "u2", role: "viewer", orgId: ORG_A });
    mockFirestore([u1, u2], {
      u1: fakeUserDoc(true, [ORG_A]),
      u2: fakeUserDoc(true, [ORG_A]),
    });
    const { setCustomUserClaims } = statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary).toEqual({ processed: 2, skipped: 0, failed: [] });
    expect(setCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(setCustomUserClaims).toHaveBeenCalledWith("u1", { orgId: ORG_A, role: "editor" });
    expect(setCustomUserClaims).toHaveBeenCalledWith("u2", { orgId: ORG_A, role: "viewer" });
  });

  it("immediate second run: processed 0, skipped 2, failed empty, setCustomUserClaims not called at all -- idempotency by skip-if-already-matching", async () => {
    const u1 = fakeMemberDoc({ uid: "u1", role: "editor", orgId: ORG_A });
    const u2 = fakeMemberDoc({ uid: "u2", role: "viewer", orgId: ORG_A });
    mockFirestore([u1, u2], {
      u1: fakeUserDoc(true, [ORG_A]),
      u2: fakeUserDoc(true, [ORG_A]),
    });
    const { setCustomUserClaims } = statefulAuth();

    const firstRun = await backfillOrgMembershipClaims({ apply: true });
    expect(firstRun).toEqual({ processed: 2, skipped: 0, failed: [] });
    setCustomUserClaims.mockClear();

    // Re-mock Firestore for the second run (a fresh collectionGroup().get() call),
    // but reuse the SAME statefulAuth so the claims written by the first run are
    // visible to the second run's getUser() calls.
    mockFirestore([u1, u2], {
      u1: fakeUserDoc(true, [ORG_A]),
      u2: fakeUserDoc(true, [ORG_A]),
    });

    const secondRun = await backfillOrgMembershipClaims({ apply: true });

    expect(secondRun).toEqual({ processed: 0, skipped: 2, failed: [] });
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("dry run (the default): same processed/skipped classification, but setCustomUserClaims is never called", async () => {
    const u1 = fakeMemberDoc({ uid: "u1", role: "editor", orgId: ORG_A });
    mockFirestore([u1], { u1: fakeUserDoc(true, [ORG_A]) });
    const { setCustomUserClaims } = statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: false });

    expect(summary).toEqual({ processed: 1, skipped: 0, failed: [] });
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("pending invite: an org whose only pending invite has no members/{uid} document is never visited -- absent from all three counts, no error", async () => {
    // The pending invite has no members doc at all, so it is structurally absent
    // from the collectionGroup('members') result set -- only the two real members
    // ever appear here. This test proves the run's counts total exactly the real
    // membership docs supplied, with no phantom third entry for the invite.
    const u1 = fakeMemberDoc({ uid: "u1", role: "editor", orgId: ORG_A });
    const u2 = fakeMemberDoc({ uid: "u2", role: "viewer", orgId: ORG_A });
    mockFirestore([u1, u2], {
      u1: fakeUserDoc(true, [ORG_A]),
      u2: fakeUserDoc(true, [ORG_A]),
    });
    statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: false });

    expect(summary.processed + summary.skipped + summary.failed.length).toBe(2);
  });

  it("missing user document: a members doc whose users/{uid} does not exist is skipped, not failed, and does not throw", async () => {
    const u1 = fakeMemberDoc({ uid: "ghost", role: "editor", orgId: ORG_A });
    mockFirestore([u1], { ghost: fakeUserDoc(false) });
    statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary).toEqual({ processed: 0, skipped: 1, failed: [] });
  });

  it("non-primary org: a members doc for an org that is not the user's orgIds[0] is counted as skipped", async () => {
    const u1 = fakeMemberDoc({ uid: "u1", role: "editor", orgId: ORG_B });
    mockFirestore([u1], { u1: fakeUserDoc(true, [ORG_A]) }); // primary org is ORG_A, doc is under ORG_B
    const { setCustomUserClaims } = statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary).toEqual({ processed: 0, skipped: 1, failed: [] });
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("per-uid failure: when the auth lookup rejects for one uid, that uid appears in failed with its orgId and error, and the remaining accounts are still processed", async () => {
    const bad = fakeMemberDoc({ uid: "bad", role: "editor", orgId: ORG_A });
    const good = fakeMemberDoc({ uid: "good", role: "editor", orgId: ORG_A });
    mockFirestore([bad, good], {
      bad: fakeUserDoc(true, [ORG_A]),
      good: fakeUserDoc(true, [ORG_A]),
    });
    statefulAuth({
      bad: async () => {
        throw new Error("auth/user-not-found");
      },
    });

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary.failed).toEqual([
      { uid: "bad", orgId: ORG_A, error: expect.stringContaining("auth/user-not-found") },
    ]);
    expect(summary.processed).toBe(1);
    expect(summary.skipped).toBe(0);
  });

  it("structural guard: a members document that is not a child of an organizations/{orgId} document is skipped without being acted on", async () => {
    const invalid = fakeMemberDoc({ uid: "u1", role: "editor", structurallyInvalid: true });
    const { usersCollection } = mockFirestore([invalid], {});
    const { setCustomUserClaims } = statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary).toEqual({ processed: 0, skipped: 0, failed: [] });
    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(usersCollection.doc).not.toHaveBeenCalled();
  });

  it("structural guard: a members document with no parent org document at all is skipped without being acted on", async () => {
    const rootless = fakeMemberDoc({ uid: "u1", role: "editor", orgId: null });
    const { usersCollection } = mockFirestore([rootless], {});
    statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary).toEqual({ processed: 0, skipped: 0, failed: [] });
    expect(usersCollection.doc).not.toHaveBeenCalled();
  });

  it("returns the summary shape { processed, skipped, failed } where failed is an array of { uid, orgId, error }", async () => {
    const bad = fakeMemberDoc({ uid: "bad", role: "editor", orgId: ORG_A });
    mockFirestore([bad], { bad: fakeUserDoc(true, [ORG_A]) });
    statefulAuth({
      bad: async () => {
        throw new Error("boom");
      },
    });

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(Object.keys(summary).sort()).toEqual(["failed", "processed", "skipped"]);
    expect(summary.failed[0]).toEqual({ uid: "bad", orgId: ORG_A, error: expect.any(String) });
  });

  it("a live members document whose role is undefined (defensive 'clear' path) is counted as skipped, not acted on", async () => {
    // decideMembershipClaim only returns 'clear' when role is undefined, which in
    // the trigger's case means a delete. A live members document read via
    // collectionGroup always exists and (in this codebase) always carries a role,
    // so this path is not reachable in practice -- this test proves the defensive
    // handling doesn't throw or write a claim if it were ever hit.
    const noRole = fakeMemberDoc({ uid: "u1", orgId: ORG_A });
    mockFirestore([noRole], { u1: fakeUserDoc(true, [ORG_A]) });
    const { setCustomUserClaims } = statefulAuth();

    const summary = await backfillOrgMembershipClaims({ apply: true });

    expect(summary).toEqual({ processed: 0, skipped: 1, failed: [] });
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });
});
