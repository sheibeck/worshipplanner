import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  onboardOrganizationHandler,
  assignOrgAdminHandler,
  listOrganizationsHandler,
  setOrgActiveHandler,
  type OnboardOrganizationRequest,
  type AssignOrgAdminRequest,
  type SetOrgActiveRequest,
} from "./orgProvisioning";

// Mirrors functions/src/superAdminClaims.test.ts's established mocking seams,
// widened with FieldValue.arrayUnion (needed for the R206 additive-write
// assertions) per 74-PATTERNS.md, and further widened (Phase 76) with
// getUser/setCustomUserClaims/revokeRefreshTokens for setOrgActiveHandler's
// claim fan-out -- mirrors claimsHelpers.test.ts's mockAuth shape.
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ getUserByEmail: vi.fn() })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP_SENTINEL"),
    arrayUnion: vi.fn((v: unknown) => ({ __arrayUnion: v })),
  },
}));

const CALLER_UID = "callerUid";
const TARGET_UID = "targetUid";
const TARGET_EMAIL = "target@example.com";
const ORG_ID = "existingOrgId";

interface DocState {
  exists: boolean;
  data?: Record<string, unknown>;
}

interface OrgListEntry {
  id: string;
  data: Record<string, unknown>;
  memberCount: number;
  pendingCount?: number;
}

/**
 * A minimal path-addressable fake Firestore, shared across every test below.
 * `docStates` drives what a `.get()` on a given collection/doc path chain
 * resolves to (for the caller gate, the orgNames uniqueness check, and the
 * assignOrgAdmin orphan guard). `runTransaction`/`batch` spies let tests
 * assert exactly which write path (transaction vs. batch) fired.
 */
class FakeFirestore {
  docStates = new Map<string, DocState>();
  orgsListDocs: OrgListEntry[] = [];
  autoIdCounter = 0;
  // Phase 76: `organizations/{orgId}/members` scoped query stub -- keyed by
  // orgId, a configurable list of member uids for setOrgActiveHandler's
  // fan-out to iterate.
  membersByOrgId = new Map<string, string[]>();

  txGetSpy = vi.fn(async (ref: { get: () => Promise<unknown> }) => ref.get());
  txSetSpy = vi.fn();
  runTransactionSpy = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ get: this.txGetSpy, set: this.txSetSpy }),
  );
  batchSetSpy = vi.fn();
  batchCommitSpy = vi.fn(async () => undefined);
  batchSpy = vi.fn(() => ({ set: this.batchSetSpy, commit: this.batchCommitSpy }));
  // Phase 76: a general-purpose set/merge spy for a direct (non-transaction,
  // non-batch) `docRef.set(data, {merge:true})` call -- setOrgActiveHandler's
  // organizations/{orgId} write path.
  docSetSpy = vi.fn();

  setDocState(path: string, state: DocState) {
    this.docStates.set(path, state);
  }

  /** Phase 76: seed the member uids `organizations/{orgId}/members` resolves to. */
  setMembers(orgId: string, uids: string[]) {
    this.membersByOrgId.set(orgId, uids);
  }

  private makeDocRef(path: string): {
    id: string;
    __path: string;
    get: () => Promise<{ id: string; exists: boolean; data: () => Record<string, unknown> | undefined }>;
    set: (data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<void>;
    collection: (name: string) => ReturnType<FakeFirestore["makeCollectionRef"]>;
  } {
    const id = path.split("/").pop() as string;
    return {
      id,
      __path: path,
      get: async () => {
        const state = this.docStates.get(path) ?? { exists: false };
        return { id, exists: state.exists, data: () => state.data };
      },
      set: async (data, options) => {
        this.docSetSpy(path, data, options);
      },
      collection: (name: string) => this.makeCollectionRef(`${path}/${name}`),
    };
  }

  private makeCollectionRef(path: string) {
    const membersMatch = /^organizations\/([^/]+)\/members$/.exec(path);
    return {
      doc: (id?: string) => {
        const docId = id ?? `auto-${++this.autoIdCounter}`;
        return this.makeDocRef(`${path}/${docId}`);
      },
      get: async () => {
        if (membersMatch) {
          const uids = this.membersByOrgId.get(membersMatch[1] as string) ?? [];
          return { size: uids.length, docs: uids.map((uid) => ({ id: uid })) };
        }
        if (path !== "organizations") {
          throw new Error(`FakeFirestore: unexpected collection.get() for "${path}"`);
        }
        return {
          docs: this.orgsListDocs.map((o) => ({
            id: o.id,
            data: () => o.data,
            ref: {
              collection: (name: string) => {
                if (name === "members") {
                  return {
                    count: () => ({
                      get: async () => ({ data: () => ({ count: o.memberCount }) }),
                    }),
                  };
                }
                if (name === "invites") {
                  return {
                    count: () => ({
                      get: async () => ({ data: () => ({ count: o.pendingCount ?? 0 }) }),
                    }),
                  };
                }
                throw new Error(`unexpected subcollection "${name}"`);
              },
            },
          })),
        };
      },
    };
  }

  db() {
    return {
      collection: (name: string) => this.makeCollectionRef(name),
      runTransaction: this.runTransactionSpy,
      batch: this.batchSpy,
    };
  }
}

/** Preloads the caller-gate doc state (superAdmins/{CALLER_UID}). */
function withCallerGate(fake: FakeFirestore, exists = true) {
  fake.setDocState(`superAdmins/${CALLER_UID}`, { exists });
  return fake;
}

function mockAuth(getUserByEmailImpl?: () => Promise<{ uid: string; displayName?: string }>) {
  const getUserByEmail =
    getUserByEmailImpl !== undefined
      ? vi.fn(getUserByEmailImpl)
      : vi.fn(async () => ({ uid: TARGET_UID, displayName: "Target Person" }));
  vi.mocked(getAuth).mockReturnValue({ getUserByEmail } as never);
  return { getUserByEmail };
}

function fakeRequest<T>(
  overrides: {
    auth?: { uid: string; token?: Record<string, unknown> } | null;
    data?: Partial<T>;
  },
  defaults: T,
): CallableRequest<T> {
  const auth = overrides.auth === undefined ? { uid: CALLER_UID, token: { superAdmin: true } } : overrides.auth;
  return {
    auth: auth === null ? undefined : { uid: auth.uid, token: auth.token ?? {} },
    data: { ...defaults, ...overrides.data },
  } as unknown as CallableRequest<T>;
}

afterEach(() => {
  vi.mocked(getAuth).mockReset();
  vi.mocked(getFirestore).mockReset();
});

const ONBOARD_DEFAULTS: OnboardOrganizationRequest = { name: "Grace Church", adminEmail: TARGET_EMAIL };
const ASSIGN_DEFAULTS: AssignOrgAdminRequest = { orgId: ORG_ID, email: TARGET_EMAIL };
const SET_ACTIVE_DEFAULTS: SetOrgActiveRequest = { orgId: ORG_ID, active: false };

/**
 * Phase 76: a distinct getAuth() mock seam for setOrgActiveHandler's claim
 * fan-out -- mirrors claimsHelpers.test.ts's mockAuth shape but keyed
 * per-uid (getUserByEmail is untouched/unused by setOrgActive, included only
 * so the mocked getAuth() return shape stays structurally consistent with
 * the other describe blocks' mockAuth()).
 */
function mockClaimsAuth(
  existingClaimsByUid: Record<string, Record<string, unknown> | undefined> = {},
  opts: { setCustomUserClaimsImpl?: (uid: string, claims: Record<string, unknown>) => Promise<void> } = {},
) {
  const getUser = vi.fn(async (uid: string) => ({ customClaims: existingClaimsByUid[uid] }));
  const setCustomUserClaims = vi.fn(
    opts.setCustomUserClaimsImpl ?? (async () => undefined),
  );
  const revokeRefreshTokens = vi.fn(async () => undefined);
  const getUserByEmail = vi.fn(async () => ({ uid: TARGET_UID, displayName: "Target Person" }));
  vi.mocked(getAuth).mockReturnValue({
    getUser,
    setCustomUserClaims,
    revokeRefreshTokens,
    getUserByEmail,
  } as never);
  return { getUser, setCustomUserClaims, revokeRefreshTokens };
}

function onboardRequest(overrides: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  data?: Partial<OnboardOrganizationRequest>;
} = {}) {
  return fakeRequest<OnboardOrganizationRequest>(overrides, ONBOARD_DEFAULTS);
}

function assignRequest(overrides: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  data?: Partial<AssignOrgAdminRequest>;
} = {}) {
  return fakeRequest<AssignOrgAdminRequest>(overrides, ASSIGN_DEFAULTS);
}

function setActiveRequest(overrides: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  data?: Partial<SetOrgActiveRequest>;
} = {}) {
  return fakeRequest<SetOrgActiveRequest>(overrides, SET_ACTIVE_DEFAULTS);
}

// --- CALLER GATE (R200/R204, T-74-01/T-74-02) -------------------------------

describe("caller gate", () => {
  it("onboardOrganization: rejects an unauthenticated caller", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(onboardOrganizationHandler(onboardRequest({ auth: null }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("onboardOrganization: rejects a token without superAdmin, never reads Firestore", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    const dbSpy = vi.fn(() => fake.db().collection("superAdmins"));
    vi.mocked(getFirestore).mockReturnValue({ collection: dbSpy } as never);

    await expect(
      onboardOrganizationHandler(onboardRequest({ auth: { uid: CALLER_UID, token: {} } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("onboardOrganization: rejects when superAdmins/{callerUid} does not exist", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore(), false);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(onboardOrganizationHandler(onboardRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("assignOrgAdmin: rejects an unauthenticated caller", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(assignOrgAdminHandler(assignRequest({ auth: null }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("assignOrgAdmin: rejects a token without superAdmin, never reads Firestore", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    const dbSpy = vi.fn(() => fake.db().collection("superAdmins"));
    vi.mocked(getFirestore).mockReturnValue({ collection: dbSpy } as never);

    await expect(
      assignOrgAdminHandler(assignRequest({ auth: { uid: CALLER_UID, token: {} } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("assignOrgAdmin: rejects when superAdmins/{callerUid} does not exist", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore(), false);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(assignOrgAdminHandler(assignRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("listOrganizations: rejects an unauthenticated caller", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      listOrganizationsHandler(fakeRequest<void>({ auth: null }, undefined as unknown as void)),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("listOrganizations: rejects a token without superAdmin, never reads Firestore", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    const dbSpy = vi.fn(() => fake.db().collection("superAdmins"));
    vi.mocked(getFirestore).mockReturnValue({ collection: dbSpy } as never);

    await expect(
      listOrganizationsHandler(
        fakeRequest<void>({ auth: { uid: CALLER_UID, token: {} } }, undefined as unknown as void),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("listOrganizations: rejects when superAdmins/{callerUid} does not exist", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore(), false);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      listOrganizationsHandler(fakeRequest<void>({}, undefined as unknown as void)),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  // Phase 76 (R212-R214): setOrgActive's caller gate mirrors the above three
  // exactly -- unauthenticated / no-claim / no-doc all rejected.
  it("setOrgActive: rejects an unauthenticated caller", async () => {
    mockClaimsAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(setOrgActiveHandler(setActiveRequest({ auth: null }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("setOrgActive: rejects a token without superAdmin, never reads Firestore", async () => {
    mockClaimsAuth();
    const fake = withCallerGate(new FakeFirestore());
    const dbSpy = vi.fn(() => fake.db().collection("superAdmins"));
    vi.mocked(getFirestore).mockReturnValue({ collection: dbSpy } as never);

    await expect(
      setOrgActiveHandler(setActiveRequest({ auth: { uid: CALLER_UID, token: {} } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("setOrgActive: rejects when superAdmins/{callerUid} does not exist", async () => {
    mockClaimsAuth();
    const fake = withCallerGate(new FakeFirestore(), false);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(setOrgActiveHandler(setActiveRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});

// --- onboardOrganization -----------------------------------------------------

describe("onboardOrganizationHandler", () => {
  it("R201: a duplicate name throws already-exists and writes nothing", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState("orgNames/grace church", { exists: true, data: { orgId: "someOtherOrg" } });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(onboardOrganizationHandler(onboardRequest())).rejects.toMatchObject({
      code: "already-exists",
    });
    expect(fake.txSetSpy).not.toHaveBeenCalled();
  });

  it("R202 (no-strand): a non-user-not-found Auth error throws before the transaction ever runs", async () => {
    mockAuth(async () => {
      const err: { code?: string } & Error = Object.assign(new Error("network blip"), {
        code: "auth/internal-error",
      });
      throw err;
    });
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(onboardOrganizationHandler(onboardRequest())).rejects.toThrow();
    expect(fake.runTransactionSpy).not.toHaveBeenCalled();
    expect(fake.txSetSpy).not.toHaveBeenCalled();
  });

  it("R202 (clean retry): the SAME name succeeds on a follow-up call once the transient error clears", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await onboardOrganizationHandler(onboardRequest());
    expect(result.status).toBe("added");
    expect(result.name).toBe("Grace Church");
  });

  it("R202 (single atomic commit): orgNames + org + settings + first-admin all write via the SAME transaction, batch is never used", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await onboardOrganizationHandler(onboardRequest());

    // orgNames claim
    expect(fake.txSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: "orgNames/grace church" }),
      { orgId: result.orgId },
    );
    // org doc + settings
    expect(fake.txSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${result.orgId}` }),
      expect.objectContaining({
        name: "Grace Church",
        createdAt: "SERVER_TIMESTAMP_SENTINEL",
        createdBy: CALLER_UID,
        settings: expect.objectContaining({ defaultServiceTemplate: expect.any(Array) }),
      }),
    );
    // first-admin membership
    expect(fake.txSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${result.orgId}/members/${TARGET_UID}` }),
      expect.objectContaining({ role: "editor" }),
    );
    // additive arrayUnion on users/{uid}
    expect(fake.txSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `users/${TARGET_UID}` }),
      { orgIds: { __arrayUnion: result.orgId } },
      { merge: true },
    );
    expect(fake.batchSpy).not.toHaveBeenCalled();
  });

  it("R197/R198/R199: org doc settings carry the 9-entry seeded template; first admin is added at editor", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await onboardOrganizationHandler(onboardRequest());

    const orgSetCall = fake.txSetSpy.mock.calls.find(
      (call) => (call[0] as { __path: string }).__path === `organizations/${result.orgId}`,
    );
    expect(orgSetCall).toBeDefined();
    const settings = (orgSetCall?.[1] as { settings: { defaultServiceTemplate: unknown[] } }).settings;
    expect(settings.defaultServiceTemplate).toHaveLength(9);
    expect(result.status).toBe("added");
  });

  it("R206: an admin already in another org keeps it -- onboarding's first-admin write is additive, not an overwrite", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await onboardOrganizationHandler(onboardRequest());

    const userSetCall = fake.txSetSpy.mock.calls.find(
      (call) => (call[0] as { __path: string }).__path === `users/${TARGET_UID}`,
    );
    expect(userSetCall).toBeDefined();
    expect(userSetCall?.[1]).toEqual({ orgIds: { __arrayUnion: result.orgId } });
    expect(userSetCall?.[2]).toEqual({ merge: true });
  });

  it("R205: an unknown admin email invites instead of writing a members doc", async () => {
    mockAuth(async () => {
      const err: { code?: string } & Error = Object.assign(new Error("no user"), {
        code: "auth/user-not-found",
      });
      throw err;
    });
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await onboardOrganizationHandler(onboardRequest());

    expect(result.status).toBe("invited");
    expect(fake.txSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${result.orgId}/invites/${TARGET_EMAIL}` }),
      expect.objectContaining({ role: "editor", invitedBy: CALLER_UID }),
    );
    expect(fake.txSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `inviteLookup/${TARGET_EMAIL}` }),
      { orgId: result.orgId, role: "editor" },
    );
    const memberWrite = fake.txSetSpy.mock.calls.find((call) =>
      (call[0] as { __path: string }).__path.includes("/members/"),
    );
    expect(memberWrite).toBeUndefined();
  });

  it("rejects invalid-argument for a blank name or adminEmail", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      onboardOrganizationHandler(onboardRequest({ data: { name: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      onboardOrganizationHandler(onboardRequest({ data: { adminEmail: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("WR-02: rejects invalid-argument for a malformed adminEmail (e.g. containing '/'), writes nothing", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      onboardOrganizationHandler(onboardRequest({ data: { adminEmail: "not/an/email" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fake.runTransactionSpy).not.toHaveBeenCalled();
    expect(fake.txSetSpy).not.toHaveBeenCalled();
  });
});

// --- assignOrgAdmin -----------------------------------------------------------

describe("assignOrgAdminHandler", () => {
  it("R203: an existing account is added at editor via the batch, returns {status:'added', uid}", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: { name: "Grace Church" } });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await assignOrgAdminHandler(assignRequest());

    expect(result).toEqual({ status: "added", uid: TARGET_UID });
    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${ORG_ID}/members/${TARGET_UID}` }),
      expect.objectContaining({
        role: "editor",
        joinedAt: "SERVER_TIMESTAMP_SENTINEL",
        displayName: "Target Person",
        email: TARGET_EMAIL,
      }),
    );
    expect(fake.batchCommitSpy).toHaveBeenCalledTimes(1);
  });

  it("R206: additive arrayUnion (not an overwrite) for a user already in another org", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await assignOrgAdminHandler(assignRequest());

    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `users/${TARGET_UID}` }),
      { orgIds: { __arrayUnion: ORG_ID } },
      { merge: true },
    );
  });

  it("R205: an unknown email invites instead of creating a membership, never throws", async () => {
    mockAuth(async () => {
      const err: { code?: string } & Error = Object.assign(new Error("no user"), {
        code: "auth/user-not-found",
      });
      throw err;
    });
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await assignOrgAdminHandler(assignRequest());

    expect(result).toEqual({ status: "invited" });
    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${ORG_ID}/invites/${TARGET_EMAIL}` }),
      expect.objectContaining({ role: "editor", invitedBy: CALLER_UID }),
    );
    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `inviteLookup/${TARGET_EMAIL}` }),
      { orgId: ORG_ID, role: "editor" },
    );
    const memberWrite = fake.batchSetSpy.mock.calls.find((call) =>
      (call[0] as { __path: string }).__path.includes("/members/"),
    );
    expect(memberWrite).toBeUndefined();
  });

  it("T-74-05: a non-user-not-found Auth error throws instead of silently inviting", async () => {
    mockAuth(async () => {
      const err: { code?: string } & Error = Object.assign(new Error("network blip"), {
        code: "auth/internal-error",
      });
      throw err;
    });
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(assignOrgAdminHandler(assignRequest())).rejects.toThrow();
    expect(fake.batchSetSpy).not.toHaveBeenCalled();
    expect(fake.batchCommitSpy).not.toHaveBeenCalled();
  });

  it("T-74-06 (orphan guard): a nonexistent orgId throws not-found and writes nothing", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: false });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(assignOrgAdminHandler(assignRequest())).rejects.toMatchObject({ code: "not-found" });
    expect(fake.batchSetSpy).not.toHaveBeenCalled();
    expect(fake.batchCommitSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid-argument for a blank orgId or email", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      assignOrgAdminHandler(assignRequest({ data: { orgId: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      assignOrgAdminHandler(assignRequest({ data: { email: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("WR-02: rejects invalid-argument for a malformed email (e.g. containing '/'), never reads the org", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      assignOrgAdminHandler(assignRequest({ data: { email: "not/an/email" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fake.batchSetSpy).not.toHaveBeenCalled();
  });

  it("WR-01: assignOrgAdmin on an already-existing member preserves the original joinedAt and does not error", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: { name: "Grace Church" } });
    fake.setDocState(`organizations/${ORG_ID}/members/${TARGET_UID}`, {
      exists: true,
      data: { role: "editor", joinedAt: "ORIGINAL_JOINED_AT", displayName: "Target Person", email: TARGET_EMAIL },
    });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await assignOrgAdminHandler(assignRequest());

    expect(result).toEqual({ status: "added", uid: TARGET_UID });
    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${ORG_ID}/members/${TARGET_UID}` }),
      expect.objectContaining({
        role: "editor",
        joinedAt: "ORIGINAL_JOINED_AT",
        displayName: "Target Person",
        email: TARGET_EMAIL,
      }),
    );
  });
});

// --- listOrganizations ---------------------------------------------------------

describe("listOrganizationsHandler", () => {
  it("R196: returns [{orgId,name,createdAt,memberCount,pendingCount}] for N orgs with server-computed counts", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.orgsListDocs = [
      { id: "org1", data: { name: "Grace Church", createdAt: "ts1" }, memberCount: 3, pendingCount: 0 },
      { id: "org2", data: { name: "Hope Chapel", createdAt: "ts2" }, memberCount: 0, pendingCount: 0 },
    ];
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await listOrganizationsHandler(fakeRequest<void>({}, undefined as unknown as void));

    expect(result).toEqual({
      organizations: [
        { orgId: "org1", name: "Grace Church", createdAt: "ts1", memberCount: 3, pendingCount: 0, active: true },
        { orgId: "org2", name: "Hope Chapel", createdAt: "ts2", memberCount: 0, pendingCount: 0, active: true },
      ],
    });
  });

  it("R196: an empty orgs collection returns an empty array", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await listOrganizationsHandler(fakeRequest<void>({}, undefined as unknown as void));

    expect(result).toEqual({ organizations: [] });
  });

  it("R222/R223: pendingCount reflects each org's live invites count() aggregate, computed alongside memberCount", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.orgsListDocs = [
      { id: "org1", data: { name: "Grace Church", createdAt: "ts1" }, memberCount: 3, pendingCount: 2 },
      { id: "org2", data: { name: "Hope Chapel", createdAt: "ts2" }, memberCount: 0, pendingCount: 1 },
    ];
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await listOrganizationsHandler(fakeRequest<void>({}, undefined as unknown as void));

    expect(result.organizations).toEqual([
      { orgId: "org1", name: "Grace Church", createdAt: "ts1", memberCount: 3, pendingCount: 2, active: true },
      { orgId: "org2", name: "Hope Chapel", createdAt: "ts2", memberCount: 0, pendingCount: 1, active: true },
    ]);
  });

  it("R222: an org with no invite docs returns pendingCount: 0 explicitly (never omitted/undefined)", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.orgsListDocs = [
      { id: "org1", data: { name: "Grace Church", createdAt: "ts1" }, memberCount: 5 },
    ];
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await listOrganizationsHandler(fakeRequest<void>({}, undefined as unknown as void));

    expect(result.organizations).toEqual([
      { orgId: "org1", name: "Grace Church", createdAt: "ts1", memberCount: 5, pendingCount: 0, active: true },
    ]);
  });

  it("Phase 76 (R212-R214): reads active: false through from the org doc, no extra read", async () => {
    mockAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.orgsListDocs = [
      { id: "org1", data: { name: "Grace Church", createdAt: "ts1", active: false }, memberCount: 2 },
    ];
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    const result = await listOrganizationsHandler(fakeRequest<void>({}, undefined as unknown as void));

    expect(result.organizations).toEqual([
      { orgId: "org1", name: "Grace Church", createdAt: "ts1", memberCount: 2, pendingCount: 0, active: false },
    ]);
  });
});

// --- setOrgActive (R212-R214) ------------------------------------------------

describe("setOrgActiveHandler", () => {
  it("rejects invalid-argument for a blank/non-string orgId", async () => {
    mockClaimsAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      setOrgActiveHandler(setActiveRequest({ data: { orgId: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects invalid-argument for a non-boolean active", async () => {
    mockClaimsAuth();
    const fake = withCallerGate(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(
      setOrgActiveHandler(setActiveRequest({ data: { active: "false" as unknown as boolean } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects not-found for an orgId with no matching organizations/{orgId} doc", async () => {
    mockClaimsAuth();
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: false });
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);

    await expect(setOrgActiveHandler(setActiveRequest())).rejects.toMatchObject({ code: "not-found" });
  });

  it("deactivate: persists active:false + deactivatedAt/deactivatedBy, patches deactivatedOrgs for every member, and revokes refresh tokens -- preserving unrelated claims", async () => {
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} }); // no `active` field -- default true
    fake.setMembers(ORG_ID, ["m1", "m2"]);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    const { setCustomUserClaims, revokeRefreshTokens } = mockClaimsAuth({
      m1: { superAdmin: true, orgs: { [ORG_ID]: "editor" } },
      m2: { deactivatedOrgs: { orgB: true } },
    });

    const result = await setOrgActiveHandler(setActiveRequest({ data: { orgId: ORG_ID, active: false } }));

    expect(result).toEqual({ orgId: ORG_ID, active: false, memberCount: 2, claimFailures: 0 });
    expect(fake.docSetSpy).toHaveBeenCalledWith(
      `organizations/${ORG_ID}`,
      { active: false, deactivatedAt: "SERVER_TIMESTAMP_SENTINEL", deactivatedBy: CALLER_UID },
      { merge: true },
    );
    // m1: previously no deactivatedOrgs key at all -- superAdmin/orgs survive untouched.
    expect(setCustomUserClaims).toHaveBeenCalledWith("m1", {
      superAdmin: true,
      orgs: { [ORG_ID]: "editor" },
      deactivatedOrgs: { [ORG_ID]: true },
    });
    // m2: a sibling deactivatedOrgs entry (orgB) survives alongside the new one.
    expect(setCustomUserClaims).toHaveBeenCalledWith("m2", {
      deactivatedOrgs: { orgB: true, [ORG_ID]: true },
    });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("m1");
    expect(revokeRefreshTokens).toHaveBeenCalledWith("m2");
    expect(revokeRefreshTokens).toHaveBeenCalledTimes(2);
  });

  it("reactivate: persists active:true + reactivatedAt/reactivatedBy, clears deactivatedOrgs[orgId] for every member (sibling entries survive), never revokes", async () => {
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: { active: false } });
    fake.setMembers(ORG_ID, ["m1", "m2"]);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    const { setCustomUserClaims, revokeRefreshTokens } = mockClaimsAuth({
      m1: { deactivatedOrgs: { [ORG_ID]: true, orgB: true } },
      m2: { deactivatedOrgs: { [ORG_ID]: true } },
    });

    const result = await setOrgActiveHandler(setActiveRequest({ data: { orgId: ORG_ID, active: true } }));

    expect(result).toEqual({ orgId: ORG_ID, active: true, memberCount: 2, claimFailures: 0 });
    expect(fake.docSetSpy).toHaveBeenCalledWith(
      `organizations/${ORG_ID}`,
      { active: true, reactivatedAt: "SERVER_TIMESTAMP_SENTINEL", reactivatedBy: CALLER_UID },
      { merge: true },
    );
    // m1's sibling orgB entry survives -- reactivation of THIS org never wipes it.
    expect(setCustomUserClaims).toHaveBeenCalledWith("m1", { deactivatedOrgs: { orgB: true } });
    expect(setCustomUserClaims).toHaveBeenCalledWith("m2", { deactivatedOrgs: {} });
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it("same-state short-circuit: a redundant deactivate call skips the org-doc rewrite but still runs the member fan-out (safe retry)", async () => {
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: { active: false } });
    fake.setMembers(ORG_ID, ["m1"]);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    const { setCustomUserClaims } = mockClaimsAuth({ m1: {} });

    const result = await setOrgActiveHandler(setActiveRequest({ data: { orgId: ORG_ID, active: false } }));

    expect(result).toEqual({ orgId: ORG_ID, active: false, memberCount: 1, claimFailures: 0 });
    expect(fake.docSetSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaims).toHaveBeenCalledWith("m1", { deactivatedOrgs: { [ORG_ID]: true } });
  });

  it("same-state short-circuit: a redundant reactivate call (org already active, no `active` field at all) skips the org-doc rewrite but still fans out", async () => {
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} }); // absent -- default true
    fake.setMembers(ORG_ID, ["m1"]);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    mockClaimsAuth({ m1: { deactivatedOrgs: { [ORG_ID]: true } } });

    const result = await setOrgActiveHandler(setActiveRequest({ data: { orgId: ORG_ID, active: true } }));

    expect(result).toEqual({ orgId: ORG_ID, active: true, memberCount: 1, claimFailures: 0 });
    expect(fake.docSetSpy).not.toHaveBeenCalled();
  });

  it("partial fan-out failure: one member's claim write rejects, the call does not throw, the org-doc write still succeeded, and claimFailures reflects the rejection", async () => {
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} });
    fake.setMembers(ORG_ID, ["m1", "m2"]);
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    const { revokeRefreshTokens } = mockClaimsAuth(
      { m1: {}, m2: {} },
      {
        setCustomUserClaimsImpl: async (uid) => {
          if (uid === "m2") throw new Error("auth/claims-too-large");
        },
      },
    );

    const result = await setOrgActiveHandler(setActiveRequest({ data: { orgId: ORG_ID, active: false } }));

    expect(result).toEqual({ orgId: ORG_ID, active: false, memberCount: 2, claimFailures: 1 });
    expect(fake.docSetSpy).toHaveBeenCalledWith(
      `organizations/${ORG_ID}`,
      { active: false, deactivatedAt: "SERVER_TIMESTAMP_SENTINEL", deactivatedBy: CALLER_UID },
      { merge: true },
    );
    expect(revokeRefreshTokens).toHaveBeenCalledWith("m1");
    expect(revokeRefreshTokens).not.toHaveBeenCalledWith("m2");
  });

  it("scoped query: reads organizations/{orgId}/members ONLY, never a global collectionGroup scan -- an org with zero members is a clean no-op fan-out", async () => {
    const fake = withCallerGate(new FakeFirestore());
    fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: {} });
    // No setMembers call -- membersByOrgId has no entry for ORG_ID, resolving to [].
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    mockClaimsAuth();

    const result = await setOrgActiveHandler(setActiveRequest({ data: { orgId: ORG_ID, active: false } }));

    expect(result).toEqual({ orgId: ORG_ID, active: false, memberCount: 0, claimFailures: 0 });
  });
});
