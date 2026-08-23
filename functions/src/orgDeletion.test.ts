import { afterEach, describe, expect, it, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  deleteOrganizationHandler,
  EXTRA_ORG_KEYED_COLLECTIONS,
  type DeleteOrganizationRequest,
} from "./orgDeletion";

// Mirrors orgProvisioning.test.ts's mocking seams. A DEDICATED fake, not an
// extension of orgProvisioning.test.ts's FakeFirestore class (77-01-PLAN.md
// Task 1 action): that class has no `.where()` or top-level `recursiveDelete`
// support, and forcing those in would fight its existing shape.
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: {
    arrayRemove: vi.fn((v: unknown) => ({ __arrayRemove: v })),
  },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(),
}));

const CALLER_UID = "callerUid";
const ORG_ID = "orgToDelete";
const ORG_NAME = "Grace Church";

interface DocState {
  exists: boolean;
  data?: Record<string, unknown>;
}

interface FakeDocEntry {
  id: string;
  data: Record<string, unknown>;
}

/**
 * A minimal path-addressable fake Firestore dedicated to orgDeletion.test.ts.
 *
 * `callOrder` is the SHARED call-order array every read/write spy pushes a
 * tag onto (Task 1 action: "assert via a shared call-order array pushed to
 * by each fake's spy") -- the call-order test asserts every READ tag
 * ('members', 'inviteLookup', 'orgNames', 'extra:<name>') appears before
 * 'getFiles'/'deleteFiles'/'recursiveDelete'.
 */
class FakeFirestore {
  docStates = new Map<string, DocState>();
  membersByOrgId = new Map<string, string[]>();
  /** Keyed by TOP-LEVEL collection name (inviteLookup + the 5 extra
   * collections) -- the full pre-configured doc set; `.where('orgId','==',x)`
   * filters this down at query time, so a doc belonging to a different orgId
   * is naturally left alone without any extra test wiring. */
  collectionDocs = new Map<string, FakeDocEntry[]>();
  callOrder: string[] = [];

  batchSetSpy = vi.fn();
  batchDeleteSpy = vi.fn();
  batchCommitSpy = vi.fn(async () => {
    this.callOrder.push("batchCommit");
  });
  batchSpy = vi.fn(() => ({
    set: this.batchSetSpy,
    delete: this.batchDeleteSpy,
    commit: this.batchCommitSpy,
  }));

  recursiveDeleteSpy = vi.fn(async () => {
    this.callOrder.push("recursiveDelete");
  });

  setDocState(path: string, state: DocState) {
    this.docStates.set(path, state);
  }

  setMembers(orgId: string, uids: string[]) {
    this.membersByOrgId.set(orgId, uids);
  }

  setCollectionDocs(name: string, docs: FakeDocEntry[]) {
    this.collectionDocs.set(name, docs);
  }

  private makeDocRef(path: string): {
    id: string;
    __path: string;
    get: () => Promise<{
      id: string;
      exists: boolean;
      data: () => Record<string, unknown> | undefined;
      ref: ReturnType<FakeFirestore["makeDocRef"]>;
    }>;
    collection: (name: string) => ReturnType<FakeFirestore["makeCollectionRef"]>;
  } {
    const id = path.split("/").pop() as string;
    const ref = {
      id,
      __path: path,
      get: async () => {
        if (path.startsWith("orgNames/")) {
          this.callOrder.push("orgNames");
        }
        const state = this.docStates.get(path) ?? { exists: false };
        return { id, exists: state.exists, data: () => state.data, ref };
      },
      collection: (name: string) => this.makeCollectionRef(`${path}/${name}`),
    };
    return ref;
  }

  private makeCollectionRef(path: string) {
    const membersMatch = /^organizations\/([^/]+)\/members$/.exec(path);
    return {
      doc: (id: string) => this.makeDocRef(`${path}/${id}`),
      get: async () => {
        if (membersMatch) {
          this.callOrder.push("members");
          const uids = this.membersByOrgId.get(membersMatch[1] as string) ?? [];
          return { size: uids.length, docs: uids.map((uid) => ({ id: uid })) };
        }
        throw new Error(`FakeFirestore: unexpected collection.get() for "${path}"`);
      },
      where: (field: string, op: string, value: unknown) => ({
        get: async () => {
          this.callOrder.push(path === "inviteLookup" ? "inviteLookup" : `extra:${path}`);
          if (op !== "==") throw new Error(`FakeFirestore: unsupported op "${op}"`);
          const configured = this.collectionDocs.get(path) ?? [];
          const filtered = configured.filter((d) => d.data[field] === value);
          const docs = filtered.map((d) => {
            const ref = this.makeDocRef(`${path}/${d.id}`);
            return { id: d.id, ref, data: () => d.data };
          });
          return { docs, size: docs.length };
        },
      }),
    };
  }

  db() {
    return {
      collection: (name: string) => this.makeCollectionRef(name),
      batch: this.batchSpy,
      recursiveDelete: this.recursiveDeleteSpy,
    };
  }
}

/** Preloads the caller-gate doc state (superAdmins/{CALLER_UID}). */
function withCallerGate(fake: FakeFirestore, exists = true) {
  fake.setDocState(`superAdmins/${CALLER_UID}`, { exists });
  return fake;
}

/**
 * Preloads the target org doc -- deactivated + named, unless overridden.
 * `omitActive: true` seeds a doc with NO `active` key at all (pre-Phase-76
 * org shape), as distinct from an explicit `active: true` -- both read as
 * eligible-for-refusal via the handler's `?? true` default, but only
 * `omitActive` genuinely tests the "field absent" case.
 */
function withOrg(
  fake: FakeFirestore,
  overrides: { active?: boolean; name?: string; exists?: boolean; omitActive?: boolean } = {},
) {
  const { exists = true, name = ORG_NAME, active = false, omitActive = false } = overrides;
  const data: Record<string, unknown> = { name };
  if (!omitActive) data.active = active;
  fake.setDocState(`organizations/${ORG_ID}`, { exists, data: exists ? data : undefined });
  return fake;
}

function mockBucket(files: { name: string }[] = []) {
  const getFilesSpy = vi.fn(async () => {
    fakeCallOrderSink?.push("getFiles");
    return [files];
  });
  const deleteFilesSpy = vi.fn(async () => {
    fakeCallOrderSink?.push("deleteFiles");
  });
  vi.mocked(getStorage).mockReturnValue({
    bucket: () => ({ getFiles: getFilesSpy, deleteFiles: deleteFilesSpy }),
  } as never);
  return { getFilesSpy, deleteFilesSpy };
}

// mockBucket is called before the fake exists in some tests and after in
// others -- this indirection lets it push onto whichever fake's callOrder is
// currently active without threading the fake through every call site.
let fakeCallOrderSink: string[] | null = null;

function fakeRequest(overrides: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  data?: Partial<DeleteOrganizationRequest>;
}): CallableRequest<DeleteOrganizationRequest> {
  const auth = overrides.auth === undefined ? { uid: CALLER_UID, token: { superAdmin: true } } : overrides.auth;
  const defaults: DeleteOrganizationRequest = { orgId: ORG_ID, confirmName: ORG_NAME };
  return {
    auth: auth === null ? undefined : { uid: auth.uid, token: auth.token ?? {} },
    data: { ...defaults, ...overrides.data },
  } as unknown as CallableRequest<DeleteOrganizationRequest>;
}

afterEach(() => {
  vi.mocked(getFirestore).mockReset();
  vi.mocked(getStorage).mockReset();
  fakeCallOrderSink = null;
});

function setup(opts: { active?: boolean; name?: string; orgExists?: boolean; omitActive?: boolean } = {}) {
  const fake = withOrg(withCallerGate(new FakeFirestore()), {
    active: opts.active,
    name: opts.name,
    exists: opts.orgExists,
    omitActive: opts.omitActive,
  });
  fakeCallOrderSink = fake.callOrder;
  vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
  return fake;
}

// --- caller gate (T-77-01) ---------------------------------------------------

describe("deleteOrganizationHandler: caller gate", () => {
  it("rejects an unauthenticated caller before any org read", async () => {
    const fake = setup();
    mockBucket();

    await expect(deleteOrganizationHandler(fakeRequest({ auth: null }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(fake.callOrder).toEqual([]);
  });

  it("rejects a token without superAdmin, never reads Firestore", async () => {
    const fake = withCallerGate(new FakeFirestore());
    const dbSpy = vi.fn(() => fake.db().collection("superAdmins"));
    vi.mocked(getFirestore).mockReturnValue({ collection: dbSpy } as never);
    mockBucket();

    await expect(
      deleteOrganizationHandler(fakeRequest({ auth: { uid: CALLER_UID, token: {} } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(dbSpy).not.toHaveBeenCalled();
  });

  it("rejects when superAdmins/{callerUid} does not exist, before any org read", async () => {
    const fake = withOrg(withCallerGate(new FakeFirestore(), false));
    vi.mocked(getFirestore).mockReturnValue(fake.db() as never);
    mockBucket();

    await expect(deleteOrganizationHandler(fakeRequest({}))).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(fake.callOrder).toEqual([]);
  });
});

// --- eligibility gates (R215/T-77-02/T-77-06) -------------------------------

describe("deleteOrganizationHandler: eligibility gates", () => {
  it("refuses an org whose active field is absent (default-true) with failed-precondition, before any cascade read", async () => {
    const fake = setup({ omitActive: true });
    mockBucket();

    await expect(deleteOrganizationHandler(fakeRequest({}))).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(fake.callOrder).toEqual([]);
  });

  it("refuses an org whose active field is explicitly true with failed-precondition, before any cascade read", async () => {
    const fake = setup({ active: true });
    mockBucket();

    await expect(deleteOrganizationHandler(fakeRequest({}))).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(fake.callOrder).toEqual([]);
  });

  it("refuses a confirmName that does not match the org's stored name with invalid-argument, before any delete", async () => {
    const fake = setup({ active: false });
    const { deleteFilesSpy } = mockBucket();

    await expect(
      deleteOrganizationHandler(fakeRequest({ data: { confirmName: "Wrong Name" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fake.batchCommitSpy).not.toHaveBeenCalled();
    expect(deleteFilesSpy).not.toHaveBeenCalled();
    expect(fake.recursiveDeleteSpy).not.toHaveBeenCalled();
  });

  // WR-02 (77-REVIEW.md): a legacy/foreign write path could persist `name`
  // with stray surrounding whitespace (onboardOrganizationHandler stores it
  // verbatim). The dialog's own `.trim()` on typed input makes it
  // structurally impossible to type that whitespace back in, so the SERVER
  // compare must trim both sides -- otherwise such an org could never be
  // deleted through the sanctioned UI path.
  it("accepts a confirmName that matches the stored name only after trimming stored-side whitespace", async () => {
    const fake = setup({ active: false, name: `  ${ORG_NAME}  ` });
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({ data: { confirmName: ORG_NAME } }));

    expect(result.name).toBe(`  ${ORG_NAME}  `);
    expect(fake.recursiveDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("still refuses a confirmName differing only in case after trimming -- trimming does not weaken case-sensitivity", async () => {
    const fake = setup({ active: false, name: `  ${ORG_NAME}  ` });
    mockBucket();

    await expect(
      deleteOrganizationHandler(fakeRequest({ data: { confirmName: ORG_NAME.toLowerCase() } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(fake.recursiveDeleteSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid-argument for a blank orgId or confirmName", async () => {
    setup();
    mockBucket();

    await expect(
      deleteOrganizationHandler(fakeRequest({ data: { orgId: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      deleteOrganizationHandler(fakeRequest({ data: { confirmName: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects not-found for a nonexistent org", async () => {
    setup({ orgExists: false });
    mockBucket();

    await expect(deleteOrganizationHandler(fakeRequest({}))).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

// --- call-order (T-77-03, Pattern 2 / Pitfall 1) -----------------------------

describe("deleteOrganizationHandler: cascade call order", () => {
  it("reads members, inviteLookup, orgNames, and all 5 extra collections BEFORE getFiles/deleteFiles/recursiveDelete fire", async () => {
    const fake = setup({ active: false });
    fake.setMembers(ORG_ID, ["m1"]);
    fake.setCollectionDocs("inviteLookup", [{ id: "a@example.com", data: { orgId: ORG_ID } }]);
    for (const name of EXTRA_ORG_KEYED_COLLECTIONS) {
      fake.setCollectionDocs(name, [{ id: "doc1", data: { orgId: ORG_ID } }]);
    }
    fake.setDocState(`orgNames/${ORG_NAME.toLowerCase()}`, { exists: true, data: { orgId: ORG_ID } });
    mockBucket([{ name: `orgs/${ORG_ID}/media/f.png` }]);

    await deleteOrganizationHandler(fakeRequest({}));

    const storageAndDeleteIdx = fake.callOrder.indexOf("getFiles");
    const recursiveDeleteIdx = fake.callOrder.indexOf("recursiveDelete");
    expect(storageAndDeleteIdx).toBeGreaterThan(-1);
    expect(recursiveDeleteIdx).toBeGreaterThan(storageAndDeleteIdx);

    for (const readTag of [
      "members",
      "inviteLookup",
      "orgNames",
      ...EXTRA_ORG_KEYED_COLLECTIONS.map((n) => `extra:${n}`),
    ]) {
      const idx = fake.callOrder.indexOf(readTag);
      expect(idx, `expected "${readTag}" to have been read`).toBeGreaterThan(-1);
      expect(idx).toBeLessThan(storageAndDeleteIdx);
      expect(idx).toBeLessThan(recursiveDeleteIdx);
    }
  });
});

// --- members -> users/{uid}.orgIds arrayRemove (R218, Pitfall 1) -----------

describe("deleteOrganizationHandler: member unlinking", () => {
  it("merge-sets users/{uid} with orgIds arrayRemove(orgId) for every captured member -- never an overwrite", async () => {
    const fake = setup({ active: false });
    fake.setMembers(ORG_ID, ["m1", "m2"]);
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: "users/m1" }),
      { orgIds: { __arrayRemove: ORG_ID } },
      { merge: true },
    );
    expect(fake.batchSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: "users/m2" }),
      { orgIds: { __arrayRemove: ORG_ID } },
      { merge: true },
    );
    expect(result.membersUnlinked).toBe(2);
  });

  it("an org with zero members writes nothing to users/*, returns membersUnlinked: 0", async () => {
    const fake = setup({ active: false });
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchSetSpy).not.toHaveBeenCalled();
    expect(result.membersUnlinked).toBe(0);
  });
});

// --- inviteLookup (R218) -----------------------------------------------------

describe("deleteOrganizationHandler: inviteLookup cleanup", () => {
  it("deletes every inviteLookup doc whose orgId matches; a doc belonging to a DIFFERENT orgId is left alone", async () => {
    const fake = setup({ active: false });
    fake.setCollectionDocs("inviteLookup", [
      { id: "match@example.com", data: { orgId: ORG_ID } },
      { id: "other@example.com", data: { orgId: "someOtherOrg" } },
    ]);
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchDeleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: "inviteLookup/match@example.com" }),
    );
    expect(fake.batchDeleteSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ __path: "inviteLookup/other@example.com" }),
    );
    expect(result.invitesDeleted).toBe(1);
  });
});

// --- orgNames guard (R218, Pitfall: rename collision) -----------------------

describe("deleteOrganizationHandler: orgNames guard", () => {
  it("deletes orgNames/{nameKey} ONLY when its stored orgId matches the target org", async () => {
    const fake = setup({ active: false });
    fake.setDocState("orgNames/grace church", { exists: true, data: { orgId: ORG_ID } });
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchDeleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: "orgNames/grace church" }),
    );
    expect(result.orgNameDeleted).toBe(true);
  });

  it("leaves orgNames/{nameKey} untouched and returns orgNameDeleted:false when it points at a DIFFERENT orgId", async () => {
    const fake = setup({ active: false });
    fake.setDocState("orgNames/grace church", { exists: true, data: { orgId: "someOtherOrg" } });
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchDeleteSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ __path: "orgNames/grace church" }),
    );
    expect(result.orgNameDeleted).toBe(false);
  });

  it("leaves orgNames/{nameKey} untouched and returns orgNameDeleted:false when it does not exist", async () => {
    const fake = setup({ active: false });
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchDeleteSpy).not.toHaveBeenCalled();
    expect(result.orgNameDeleted).toBe(false);
  });
});

// --- the 5 extra orgId-keyed collections (T-77-07) --------------------------

describe("deleteOrganizationHandler: extra orgId-keyed collections", () => {
  it("queries each of the 5 collections with where('orgId','==',orgId) and deletes every matching doc; other orgs' docs untouched; shareDocsDeleted sums all 5", async () => {
    const fake = setup({ active: false });
    for (const name of EXTRA_ORG_KEYED_COLLECTIONS) {
      fake.setCollectionDocs(name, [
        { id: "mine", data: { orgId: ORG_ID } },
        { id: "notMine", data: { orgId: "someOtherOrg" } },
      ]);
    }
    mockBucket();

    const result = await deleteOrganizationHandler(fakeRequest({}));

    for (const name of EXTRA_ORG_KEYED_COLLECTIONS) {
      expect(fake.batchDeleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ __path: `${name}/mine` }),
      );
      expect(fake.batchDeleteSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ __path: `${name}/notMine` }),
      );
    }
    expect(result.shareDocsDeleted).toBe(EXTRA_ORG_KEYED_COLLECTIONS.length);
  });

  it("exports EXTRA_ORG_KEYED_COLLECTIONS as exactly the 5 documented collections", () => {
    expect([...EXTRA_ORG_KEYED_COLLECTIONS].sort()).toEqual(
      ["orgSlugs", "quarterShares", "serviceShareLinks", "serviceShares", "shareTokens"].sort(),
    );
  });
});

// --- Storage (R219, Pitfall 4) -----------------------------------------------

describe("deleteOrganizationHandler: Storage cleanup", () => {
  it("calls bucket.deleteFiles with { prefix: 'orgs/${orgId}/', force: true }; storageObjectsDeleted reflects the preceding getFiles count", async () => {
    setup({ active: false });
    const { getFilesSpy, deleteFilesSpy } = mockBucket([
      { name: `orgs/${ORG_ID}/media/a.png` },
      { name: `orgs/${ORG_ID}/media/b.png` },
    ]);

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(getFilesSpy).toHaveBeenCalledWith({ prefix: `orgs/${ORG_ID}/` });
    expect(deleteFilesSpy).toHaveBeenCalledWith({ prefix: `orgs/${ORG_ID}/`, force: true });
    expect(result.storageObjectsDeleted).toBe(2);
  });
});

// --- recursiveDelete (R217) ---------------------------------------------------

describe("deleteOrganizationHandler: recursiveDelete", () => {
  it("calls getFirestore().recursiveDelete(orgRef) with the target org's own doc ref, last", async () => {
    const fake = setup({ active: false });
    mockBucket();

    await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.recursiveDeleteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __path: `organizations/${ORG_ID}` }),
    );
    expect(fake.recursiveDeleteSpy).toHaveBeenCalledTimes(1);
  });
});

// --- idempotency / resumability (R221) ---------------------------------------

describe("deleteOrganizationHandler: idempotent retry", () => {
  it("a second call against an interrupted-retry state (members/inviteLookup/extras/Storage already clean, org doc still present) completes without throwing and returns zeroed counts", async () => {
    const fake = setup({ active: false });
    // No setMembers/setCollectionDocs calls -- everything resolves empty,
    // simulating a prior run that already cleared these but never reached
    // recursiveDelete (the org doc itself still exists).
    mockBucket([]);

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(result).toEqual({
      orgId: ORG_ID,
      name: ORG_NAME,
      membersUnlinked: 0,
      invitesDeleted: 0,
      orgNameDeleted: false,
      shareDocsDeleted: 0,
      storageObjectsDeleted: 0,
    });
    expect(fake.recursiveDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("never touches another org's data on retry -- every write remains scoped to the captured orgId", async () => {
    const fake = setup({ active: false });
    fake.setMembers(ORG_ID, ["m1"]);
    fake.setCollectionDocs("inviteLookup", [
      { id: "mine@example.com", data: { orgId: ORG_ID } },
      { id: "theirs@example.com", data: { orgId: "someOtherOrg" } },
    ]);
    mockBucket();

    await deleteOrganizationHandler(fakeRequest({}));

    expect(fake.batchSetSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ __path: expect.stringContaining("someOtherOrg") }),
      expect.anything(),
      expect.anything(),
    );
    expect(fake.batchDeleteSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ __path: "inviteLookup/theirs@example.com" }),
    );
  });
});

// --- return shape (R221) ------------------------------------------------------

describe("deleteOrganizationHandler: return shape", () => {
  it("returns the exact summary shape with correct values from a populated fixture", async () => {
    const fake = setup({ active: false });
    fake.setMembers(ORG_ID, ["m1", "m2"]);
    fake.setCollectionDocs("inviteLookup", [{ id: "a@example.com", data: { orgId: ORG_ID } }]);
    fake.setDocState("orgNames/grace church", { exists: true, data: { orgId: ORG_ID } });
    for (const name of EXTRA_ORG_KEYED_COLLECTIONS) {
      fake.setCollectionDocs(name, [{ id: "doc1", data: { orgId: ORG_ID } }]);
    }
    mockBucket([{ name: `orgs/${ORG_ID}/media/a.png` }]);

    const result = await deleteOrganizationHandler(fakeRequest({}));

    expect(result).toEqual({
      orgId: ORG_ID,
      name: ORG_NAME,
      membersUnlinked: 2,
      invitesDeleted: 1,
      orgNameDeleted: true,
      shareDocsDeleted: EXTRA_ORG_KEYED_COLLECTIONS.length,
      storageObjectsDeleted: 1,
    });
  });
});
