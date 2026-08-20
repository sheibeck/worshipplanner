import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  SUPER_ADMIN_CLAIM_KEYS,
  syncSuperAdminClaimHandler,
  setSuperAdminClaimHandler,
  type SetSuperAdminClaimRequest,
} from "./superAdminClaims";

// Mirrors functions/src/orgMembershipClaims.test.ts's established mocking
// seams (getAuth) and functions/src/index.test.ts's fakeRequest/CallableRequest
// pattern for onCall handlers (queueServiceMessageHandler describe block).
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    setCustomUserClaims: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    revokeRefreshTokens: vi.fn(),
  })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP_SENTINEL") },
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: vi.fn((_path: string, handler: unknown) => handler),
}));

const CALLER_UID = "callerUid";
const TARGET_UID = "targetUid";
const TARGET_EMAIL = "target@example.com";

function mockAuth(opts: {
  existingClaims?: Record<string, unknown>;
  getUserImpl?: () => Promise<{ customClaims?: Record<string, unknown> }>;
  getUserByEmailImpl?: () => Promise<{ uid: string }>;
} = {}) {
  const setCustomUserClaims = vi.fn(async () => undefined);
  const getUser =
    opts.getUserImpl !== undefined
      ? vi.fn(opts.getUserImpl)
      : vi.fn(async () => ({ customClaims: opts.existingClaims }));
  const getUserByEmail =
    opts.getUserByEmailImpl !== undefined
      ? vi.fn(opts.getUserByEmailImpl)
      : vi.fn(async () => ({ uid: TARGET_UID }));
  const revokeRefreshTokens = vi.fn(async () => undefined);
  vi.mocked(getAuth).mockReturnValue({
    setCustomUserClaims,
    getUser,
    getUserByEmail,
    revokeRefreshTokens,
  } as never);
  return { setCustomUserClaims, getUser, getUserByEmail, revokeRefreshTokens };
}

/** A fake superAdmins collection: callerDoc.exists gates the onCall's re-check #2. */
function mockFirestore(opts: { callerDocExists: boolean }) {
  const setSpy = vi.fn(async () => undefined);
  const deleteSpy = vi.fn(async () => undefined);
  const docSpy = vi.fn((uid: string) => ({
    get: vi.fn(async () => ({ exists: uid === CALLER_UID ? opts.callerDocExists : true })),
    set: setSpy,
    delete: deleteSpy,
  }));
  const superAdminsCollection = { doc: docSpy };
  vi.mocked(getFirestore).mockReturnValue({
    collection: vi.fn((name: string) => {
      if (name === "superAdmins") return superAdminsCollection;
      throw new Error(`mockFirestore: unexpected collection "${name}"`);
    }),
  } as never);
  return { setSpy, deleteSpy, docSpy };
}

afterEach(() => {
  vi.mocked(getAuth).mockReset();
  vi.mocked(getFirestore).mockReset();
});

describe("SUPER_ADMIN_CLAIM_KEYS", () => {
  it("names exactly one claim key", () => {
    expect(SUPER_ADMIN_CLAIM_KEYS).toEqual(["superAdmin"]);
  });
});

describe("syncSuperAdminClaimHandler", () => {
  it("R174: grant (granted true) calls setCustomUserClaims with { superAdmin: true } merged onto no prior claims", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    const outcome = await syncSuperAdminClaimHandler({ uid: TARGET_UID, granted: true });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(TARGET_UID, { superAdmin: true });
    expect(outcome).toEqual({ action: "set" });
  });

  it("R174: grant with existing { orgId, role } present -- the org keys survive the merge, not replaced", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: "orgA", role: "editor" },
    });

    const outcome = await syncSuperAdminClaimHandler({ uid: TARGET_UID, granted: true });

    expect(setCustomUserClaims).toHaveBeenCalledWith(TARGET_UID, {
      orgId: "orgA",
      role: "editor",
      superAdmin: true,
    });
    expect(outcome).toEqual({ action: "set" });
  });

  it("R175-B (SC1 direction B): revoke of a user with { orgId, role, superAdmin: true } preserves orgId/role and clears only superAdmin", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: "orgA", role: "editor", superAdmin: true },
    });

    const outcome = await syncSuperAdminClaimHandler({ uid: TARGET_UID, granted: false });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(TARGET_UID, { orgId: "orgA", role: "editor" });
    expect(outcome).toEqual({ action: "clear" });
  });

  it("revoke of a super-admin with no other claims clears down to null (nothing remains)", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { superAdmin: true } });

    const outcome = await syncSuperAdminClaimHandler({ uid: TARGET_UID, granted: false });

    expect(setCustomUserClaims).toHaveBeenCalledWith(TARGET_UID, null);
    expect(outcome).toEqual({ action: "clear" });
  });

  it("auth lookup failure: getUser rejecting resolves with a failure outcome, never rethrows out of the handler", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockAuth({
      getUserImpl: async () => {
        throw new Error("auth/user-not-found");
      },
    });

    const outcome = await syncSuperAdminClaimHandler({ uid: TARGET_UID, granted: true });

    expect(outcome.action).toBe("failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[superAdminClaims] syncSuperAdminClaim:",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});

describe("setSuperAdminClaimHandler", () => {
  function fakeRequest(
    overrides: {
      auth?: { uid: string; token?: Record<string, unknown> } | null;
      data?: Partial<SetSuperAdminClaimRequest>;
    } = {},
  ): CallableRequest<SetSuperAdminClaimRequest> {
    const auth =
      overrides.auth === undefined
        ? { uid: CALLER_UID, token: { superAdmin: true } }
        : overrides.auth;
    return {
      auth: auth === null ? undefined : { uid: auth.uid, token: auth.token ?? {} },
      data: { targetEmail: TARGET_EMAIL, grant: true, ...overrides.data },
    } as unknown as CallableRequest<SetSuperAdminClaimRequest>;
  }

  it("throws unauthenticated when request.auth is missing", async () => {
    mockAuth();
    mockFirestore({ callerDocExists: true });

    await expect(setSuperAdminClaimHandler(fakeRequest({ auth: null }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("R179: rejects a caller whose token lacks superAdmin -- permission-denied, never reads Firestore", async () => {
    mockAuth();
    const { docSpy } = mockFirestore({ callerDocExists: true });

    await expect(
      setSuperAdminClaimHandler(fakeRequest({ auth: { uid: CALLER_UID, token: {} } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(docSpy).not.toHaveBeenCalled();
  });

  it("rejects when the token claims superAdmin but superAdmins/{callerUid} does not exist (defense-in-depth re-check #2)", async () => {
    mockAuth();
    mockFirestore({ callerDocExists: false });

    await expect(setSuperAdminClaimHandler(fakeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("throws invalid-argument when targetEmail is missing", async () => {
    mockAuth();
    mockFirestore({ callerDocExists: true });

    await expect(
      setSuperAdminClaimHandler(fakeRequest({ data: { targetEmail: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws not-found when getUserByEmail cannot resolve the target", async () => {
    mockAuth({
      getUserByEmailImpl: async () => {
        throw new Error("auth/user-not-found");
      },
    });
    mockFirestore({ callerDocExists: true });

    await expect(setSuperAdminClaimHandler(fakeRequest())).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("R179 grant path: writes superAdmins/{targetUid} with email, grantedBy, grantedAt -- and resolves the target by email, never a client-supplied uid", async () => {
    mockAuth();
    const { setSpy, deleteSpy, docSpy } = mockFirestore({ callerDocExists: true });

    const result = await setSuperAdminClaimHandler(fakeRequest({ data: { grant: true } }));

    expect(docSpy).toHaveBeenCalledWith(TARGET_UID);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({
      email: TARGET_EMAIL,
      grantedBy: CALLER_UID,
      grantedAt: "SERVER_TIMESTAMP_SENTINEL",
    });
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("R179 revoke path: deletes superAdmins/{targetUid} AND calls revokeRefreshTokens(targetUid)", async () => {
    const { revokeRefreshTokens } = mockAuth();
    const { setSpy, deleteSpy } = mockFirestore({ callerDocExists: true });

    const result = await setSuperAdminClaimHandler(fakeRequest({ data: { grant: false } }));

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(revokeRefreshTokens).toHaveBeenCalledTimes(1);
    expect(revokeRefreshTokens).toHaveBeenCalledWith(TARGET_UID);
    expect(setSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
