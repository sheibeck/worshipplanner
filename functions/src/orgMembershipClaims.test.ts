import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  ORG_CLAIM_KEYS,
  buildOrgMembershipClaim,
  decideMembershipClaim,
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

function mockUsersFirestore(userDoc: ReturnType<typeof fakeUserDoc>) {
  const usersCollection = { doc: vi.fn(() => userDoc) };
  vi.mocked(getFirestore).mockReturnValue({
    collection: vi.fn((name: string) => {
      if (name === "users") return usersCollection;
      throw new Error(`mockUsersFirestore: unexpected collection "${name}"`);
    }),
  } as never);
  return { usersCollection };
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

describe("decideMembershipClaim", () => {
  it("returns skip/no-user-doc when users/{uid} does not exist", async () => {
    mockUsersFirestore(fakeUserDoc(false));
    mockAuth();

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_A, role: "editor" });

    expect(decision).toEqual({ action: "skip", reason: "no-user-doc" });
  });

  it("returns skip/no-user-doc when orgIds is empty", async () => {
    mockUsersFirestore(fakeUserDoc(true, []));
    mockAuth();

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_A, role: "editor" });

    expect(decision).toEqual({ action: "skip", reason: "no-user-doc" });
  });

  it("returns skip/not-primary-org when orgIds[0] does not match the write's orgId", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_B, role: "editor" });

    expect(decision).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("returns clear for a delete (role undefined) of the primary org", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_A, role: undefined });

    expect(decision).toEqual({ action: "clear" });
  });

  it("returns skip/not-primary-org for a delete of a NON-primary membership -- the primary claim must survive", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_B, role: undefined });

    expect(decision).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("returns set with the fresh claim when no existing claim matches", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth({ existingClaims: undefined });

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_A, role: "editor" });

    expect(decision).toEqual({ action: "set", claims: { orgId: ORG_A, role: "editor" } });
  });

  it("returns skip/already-current when the existing claim already matches on both keys", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    const decision = await decideMembershipClaim({ uid: UID, orgId: ORG_A, role: "editor" });

    expect(decision).toEqual({ action: "skip", reason: "already-current" });
  });

  it("never trusts the passed orgId as authority -- always reads users/{uid}.orgIds first", async () => {
    const { usersCollection } = mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    mockAuth();

    await decideMembershipClaim({ uid: UID, orgId: ORG_A, role: "editor" });

    expect(usersCollection.doc).toHaveBeenCalledWith(UID);
  });
});

describe("syncOrgMembershipClaimHandler", () => {
  it("create, primary org: calls setCustomUserClaims exactly once with { orgId, role }", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      before: undefined,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { orgId: ORG_A, role: "editor" });
    expect(outcome).toEqual({ action: "set" });
  });

  it("role change: writes a fresh claim carrying the new role", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      before: { role: "editor" },
      after: { role: "viewer" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { orgId: ORG_A, role: "viewer" });
    expect(outcome).toEqual({ action: "set" });
  });

  it("legacy admin: the claim written carries 'editor', never 'admin'", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      before: undefined,
      after: { role: "admin" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { orgId: ORG_A, role: "editor" });
  });

  it("delete, primary org: calls setCustomUserClaims exactly once with null as the second argument", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth();

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      before: { role: "editor" },
      after: undefined,
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, null);
    expect(outcome).toEqual({ action: "clear" });
  });

  it("non-primary org write: setCustomUserClaims is NOT called at all", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth();

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_B,
      uid: UID,
      before: undefined,
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(0);
    expect(outcome).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("non-primary org DELETE: setCustomUserClaims is NOT called -- the primary claim survives", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth();

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_B,
      uid: UID,
      before: { role: "editor" },
      after: undefined,
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(0);
    expect(outcome).toEqual({ action: "skip", reason: "not-primary-org" });
  });

  it("missing user document: no claims call, no throw", async () => {
    mockUsersFirestore(fakeUserDoc(false));
    const { setCustomUserClaims } = mockAuth();

    const outcome = await expect(
      syncOrgMembershipClaimHandler({
        orgId: ORG_A,
        uid: UID,
        before: undefined,
        after: { role: "editor" },
      }),
    ).resolves.toEqual({ action: "skip", reason: "no-user-doc" });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
    void outcome;
  });

  it("empty orgIds: no claims call, no throw", async () => {
    mockUsersFirestore(fakeUserDoc(true, []));
    const { setCustomUserClaims } = mockAuth();

    await expect(
      syncOrgMembershipClaimHandler({
        orgId: ORG_A,
        uid: UID,
        before: undefined,
        after: { role: "editor" },
      }),
    ).resolves.toEqual({ action: "skip", reason: "no-user-doc" });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("already current: no redundant setCustomUserClaims call", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: ORG_A, role: "editor" } });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      before: { role: "editor" },
      after: { role: "editor" },
    });

    expect(setCustomUserClaims).not.toHaveBeenCalled();
    expect(outcome).toEqual({ action: "skip", reason: "already-current" });
  });

  it("auth lookup failure: getUser rejecting resolves with a failure outcome, does not throw out of the handler", async () => {
    mockUsersFirestore(fakeUserDoc(true, [ORG_A]));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockAuth({
      getUserImpl: async () => {
        throw new Error("auth/user-not-found");
      },
    });

    const outcome = await syncOrgMembershipClaimHandler({
      orgId: ORG_A,
      uid: UID,
      before: undefined,
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
