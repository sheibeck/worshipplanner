import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  cleanupExpiredMediaHandler,
  MEDIA_PATH_GUARD,
  RETENTION_DAYS,
  parsePptxHandler,
} from "./index";
import { parsePptxBuffer } from "./pptxParser";
import { invokeRenderService } from "./renderInvoker";

// index.ts's module-scope initializeApp()/defineSecret() calls, and its
// getAuth/getFirestore/getStorage imports, must be neutralized so importing
// it in tests never touches a real Firebase project, Secret Manager, or
// emulator -- mirrors the mocking pattern in pptxParser.test.ts.
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP_SENTINEL") },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(),
}));
vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({ value: () => "fake-secret" })),
}));
vi.mock("./pptxParser", () => ({
  parsePptxBuffer: vi.fn(),
}));
// parsePptxHandler must never reach this seam directly (case 6, "never
// blocks on rendering"): it queues a Firestore doc for a separate trigger
// (37-04) to pick up, and never imports/calls invokeRenderService itself.
vi.mock("./renderInvoker", () => ({
  invokeRenderService: vi.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

interface FakeFile {
  name: string;
  metadata: { timeCreated: string };
  delete: ReturnType<typeof vi.fn>;
}

function fakeFile(name: string, ageDays: number): FakeFile {
  return {
    name,
    metadata: { timeCreated: daysAgoIso(ageDays) },
    delete: vi.fn(async () => undefined),
  };
}

function mockBucket(files: FakeFile[]) {
  const getFiles = vi.fn(async () => [files]);
  vi.mocked(getStorage).mockReturnValue({
    bucket: () => ({ getFiles }),
  } as never);
  return { getFiles };
}

describe("MEDIA_PATH_GUARD", () => {
  it("matches media objects under orgs/{orgId}/media/", () => {
    expect(MEDIA_PATH_GUARD.test("orgs/orgA/media/m1/old.mp4")).toBe(true);
  });

  it("does not match pptx-imports or other non-media paths", () => {
    expect(MEDIA_PATH_GUARD.test("orgs/orgA/pptx-imports/i1/deck.pptx")).toBe(false);
    expect(MEDIA_PATH_GUARD.test("some/other/path.txt")).toBe(false);
  });
});

describe("cleanupExpiredMediaHandler", () => {
  afterEach(() => {
    vi.mocked(getStorage).mockReset();
    vi.mocked(getFirestore).mockReset();
    delete process.env.MEDIA_CLEANUP_ENABLED;
    delete process.env.MEDIA_CLEANUP_DRY_RUN;
  });

  it("deletes a media file older than the retention window when explicitly enabled", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ deletedCount: 1, dryRun: false });
  });

  it("FAILS SAFE: deletes nothing when MEDIA_CLEANUP_ENABLED is unset, even for an expired file", async () => {
    // Regression guard for the 22-03 defect: the gate used to be
    // `MEDIA_CLEANUP_DRY_RUN === "true"`, so an unset env var meant LIVE
    // deletion on a daily schedule. Unset must mean dry-run.
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedCount: 1, scannedCount: 1 });
  });

  it("FAILS SAFE: a stray MEDIA_CLEANUP_DRY_RUN=false does not enable deletion", async () => {
    // The old flag is no longer read; only MEDIA_CLEANUP_ENABLED opts in.
    process.env.MEDIA_CLEANUP_DRY_RUN = "false";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it("FAILS SAFE: a non-\"true\" MEDIA_CLEANUP_ENABLED value does not enable deletion", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "1";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it("does not delete a recent media file", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const recent = fakeFile("orgs/orgA/media/m2/new.mp3", 3);
    mockBucket([recent]);

    const summary = await cleanupExpiredMediaHandler();

    expect(recent.delete).not.toHaveBeenCalled();
    expect(summary.deletedCount).toBe(0);
  });

  it("never deletes a non-media (pptx-imports) object even when old", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const oldPptx = fakeFile("orgs/orgA/pptx-imports/i1/deck.pptx", 60);
    mockBucket([oldPptx]);

    await cleanupExpiredMediaHandler();

    expect(oldPptx.delete).not.toHaveBeenCalled();
  });

  it("dry-run mode counts/logs an old media file but calls no delete, and reports deletedCount via the dry-run count", async () => {
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", 20);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedCount: 1, scannedCount: 1 });
  });

  it("makes no Firestore call -- slide metadata is structurally untouchable", async () => {
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", 20);
    mockBucket([old]);

    await cleanupExpiredMediaHandler();

    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("is idempotent by age: a second run against a bucket missing the already-deleted file performs no further deletes", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", 20);
    const recent = fakeFile("orgs/orgA/media/m2/new.mp3", 3);
    const { getFiles } = mockBucket([old, recent]);

    const firstRun = await cleanupExpiredMediaHandler();
    expect(old.delete).toHaveBeenCalledTimes(1);
    expect(firstRun.deletedCount).toBe(1);

    // Second run: simulate the deleted file no longer present in the bucket
    // listing (as a real bucket would report after a successful delete).
    getFiles.mockResolvedValueOnce([[recent]]);
    const secondRun = await cleanupExpiredMediaHandler();

    expect(recent.delete).not.toHaveBeenCalled();
    expect(secondRun.deletedCount).toBe(0);
  });
});

describe("parsePptxHandler", () => {
  const ORG_ID = "org1";
  const IMPORT_ID = "import1";
  const STORAGE_PATH = `orgs/${ORG_ID}/pptx-imports/${IMPORT_ID}/source.pptx`;
  const UID = "user1";

  interface FakeDbOptions {
    memberExists?: boolean;
    setSpy?: ReturnType<typeof vi.fn>;
  }

  /**
   * A minimal fake Firestore builder supporting exactly the two chains
   * parsePptxHandler / pptxRenderDocRef use:
   *   organizations/{orgId}/members/{uid}       -> .get()
   *   organizations/{orgId}/pptxRenders/{importId} -> .set()
   */
  function fakeDb(opts: FakeDbOptions = {}) {
    const memberDoc = {
      get: vi.fn(async () => ({ exists: opts.memberExists ?? true })),
    };
    const pptxRendersDoc = { set: opts.setSpy ?? vi.fn(async () => undefined) };

    const orgDoc = {
      collection: vi.fn((name: string) => {
        if (name === "members") return { doc: vi.fn(() => memberDoc) };
        if (name === "pptxRenders") return { doc: vi.fn(() => pptxRendersDoc) };
        throw new Error(`fakeDb: unexpected subcollection "${name}"`);
      }),
    };

    return {
      collection: vi.fn((name: string) => {
        if (name === "organizations") return { doc: vi.fn(() => orgDoc) };
        throw new Error(`fakeDb: unexpected collection "${name}"`);
      }),
      __memberDoc: memberDoc,
      __pptxRendersDoc: pptxRendersDoc,
    };
  }

  function fakeRequest(
    overrides: {
      auth?: { uid: string } | null;
      data?: { orgId?: string; importId?: string; storagePath?: string };
    } = {},
  ): CallableRequest<{ orgId?: string; importId?: string; storagePath?: string }> {
    const auth = overrides.auth === undefined ? { uid: UID } : overrides.auth;
    return {
      auth: auth ?? undefined,
      data: overrides.data ?? {
        orgId: ORG_ID,
        importId: IMPORT_ID,
        storagePath: STORAGE_PATH,
      },
    } as unknown as CallableRequest<{ orgId?: string; importId?: string; storagePath?: string }>;
  }

  function mockBucketForDownload() {
    const download = vi.fn(async () => [Buffer.from("fake-pptx-bytes")]);
    const file = vi.fn(() => ({ download }));
    vi.mocked(getStorage).mockReturnValue({
      bucket: () => ({ file }),
    } as never);
    return { file, download };
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
    vi.mocked(getStorage).mockReset();
    vi.mocked(parsePptxBuffer).mockReset();
    vi.mocked(invokeRenderService).mockReset();
  });

  it("case 1: return shape is unchanged -- resolves to exactly { slides } with parsePptxBuffer's array", async () => {
    const slides = [{ type: "text", text: "Hello" }];
    vi.mocked(parsePptxBuffer).mockResolvedValue(slides as never);
    const db = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);
    mockBucketForDownload();

    const result = await parsePptxHandler(fakeRequest());

    expect(result).toEqual({ slides });
    expect(Object.keys(result)).toEqual(["slides"]);
  });

  it("case 2: writes exactly one pptxRenders queue doc with status pending and the storagePath", async () => {
    vi.mocked(parsePptxBuffer).mockResolvedValue([] as never);
    const setSpy = vi.fn(async () => undefined);
    const db = fakeDb({ setSpy });
    vi.mocked(getFirestore).mockReturnValue(db as never);
    mockBucketForDownload();

    await parsePptxHandler(fakeRequest());

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", storagePath: STORAGE_PATH }),
    );
  });

  it("case 3: a queue-write failure does not fail the parse -- still resolves { slides }, throws nothing", async () => {
    const slides = [{ type: "text", text: "Still works" }];
    vi.mocked(parsePptxBuffer).mockResolvedValue(slides as never);
    const setSpy = vi.fn(async () => {
      throw new Error("Firestore write failed");
    });
    const db = fakeDb({ setSpy });
    vi.mocked(getFirestore).mockReturnValue(db as never);
    mockBucketForDownload();

    const result = await parsePptxHandler(fakeRequest());

    expect(result).toEqual({ slides });
  });

  it("case 4: on a parse failure, throws invalid-argument and never writes a render doc", async () => {
    vi.mocked(parsePptxBuffer).mockRejectedValue(new Error("corrupt file"));
    const setSpy = vi.fn(async () => undefined);
    const db = fakeDb({ setSpy });
    vi.mocked(getFirestore).mockReturnValue(db as never);
    mockBucketForDownload();

    await expect(parsePptxHandler(fakeRequest())).rejects.toMatchObject({
      code: "invalid-argument",
    });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("case 5a: throws unauthenticated when request.auth is missing", async () => {
    await expect(
      parsePptxHandler(fakeRequest({ auth: null })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("case 5b: throws permission-denied for a storagePath outside this org's prefix, and never reads Storage", async () => {
    const { file } = mockBucketForDownload();

    await expect(
      parsePptxHandler(
        fakeRequest({
          data: {
            orgId: ORG_ID,
            importId: IMPORT_ID,
            storagePath: `orgs/other-org/pptx-imports/${IMPORT_ID}/source.pptx`,
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(file).not.toHaveBeenCalled();
  });

  it("case 5c: throws permission-denied for a non-member uid", async () => {
    const db = fakeDb({ memberExists: false });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(parsePptxHandler(fakeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("case 6a: never calls invokeRenderService -- rendering is queued, not invoked, from this onCall path", async () => {
    vi.mocked(parsePptxBuffer).mockResolvedValue([] as never);
    const db = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);
    mockBucketForDownload();

    await parsePptxHandler(fakeRequest());

    expect(invokeRenderService).not.toHaveBeenCalled();
  });

  it("case 6b: source inspection -- parsePptxHandler's body contains no invokeRenderService reference", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export async function parsePptxHandler(");
    const onCallStart = source.indexOf("export const parsePptx = onCall(");
    expect(start).toBeGreaterThan(-1);
    expect(onCallStart).toBeGreaterThan(start);
    const handlerBody = source.slice(start, onCallStart);
    expect(handlerBody).not.toMatch(/invokeRenderService/);
  });
});
