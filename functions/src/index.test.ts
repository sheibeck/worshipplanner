import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  buildUpstreamUrl,
  cleanupExpiredMediaHandler,
  cleanupOrphanRendersHandler,
  createQueuedMessage,
  MEDIA_PATH_GUARD,
  ORPHAN_RENDER_STALE_HOURS,
  PROXY_TARGETS,
  redactUrl,
  RENDERED_OBJECT_GUARD,
  RETENTION_DAYS,
  SECRET_INJECTED,
  parsePptxHandler,
  requestPptxRenderHandler,
} from "./index";
import { parsePptxBuffer } from "./pptxParser";
import { invokeRenderService } from "./renderInvoker";

// A per-test variable the mocked defineString's value() reads, so each
// requestPptxRenderHandler test case can set/clear PPTX_RENDER_SERVICE_URL
// independently without needing to re-import the module.
let fakeRenderServiceUrl = "";

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
  defineString: vi.fn(() => ({ value: () => fakeRenderServiceUrl })),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: vi.fn((_path: string, handler: unknown) => handler),
  // ./orgMembershipClaims (imported transitively via ./index) also calls
  // onDocumentWritten at module scope -- this suite doesn't exercise that
  // trigger's behavior (see orgMembershipClaims.test.ts), it just needs the
  // module-scope call itself neutralized so importing ./index doesn't throw.
  onDocumentWritten: vi.fn((_path: string, handler: unknown) => handler),
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

  it("R062: does not match the new rendered/ path shape -- this structural exemption is why cleanupExpiredMedia needs zero changes", () => {
    expect(MEDIA_PATH_GUARD.test("orgs/orgA/pptx-imports/i1/rendered/page-0001.png")).toBe(false);
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

  it("R062: never deletes a rendered/ page even 60 days old and MEDIA_CLEANUP_ENABLED=true -- the guard rejects it before the age check is even reached", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const oldRenderedPage = fakeFile(
      "orgs/orgA/pptx-imports/i1/rendered/page-0001.png",
      60,
    );
    mockBucket([oldRenderedPage]);

    const summary = await cleanupExpiredMediaHandler();

    expect(oldRenderedPage.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
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

describe("requestPptxRenderHandler", () => {
  const ORG_ID = "org1";
  const IMPORT_ID = "import1";
  const STORAGE_PATH = `orgs/${ORG_ID}/pptx-imports/${IMPORT_ID}/source.pptx`;
  const RENDERED_PREFIX = `orgs/${ORG_ID}/pptx-imports/${IMPORT_ID}/rendered/`;
  const SERVICE_URL = "https://pptx-render-xyz.run.app";

  interface FakeRenderDocOptions {
    exists?: boolean;
    storagePath?: string | null;
  }

  function fakeRenderDoc(opts: FakeRenderDocOptions = {}) {
    const exists = opts.exists ?? true;
    const storagePath = opts.storagePath === undefined ? STORAGE_PATH : opts.storagePath;
    const get = vi.fn(async () => ({
      exists,
      data: () => (exists ? { status: "pending", storagePath } : undefined),
    }));
    const set = vi.fn(async (_payload?: unknown, _opts?: unknown) => undefined);
    return { get, set };
  }

  /**
   * A minimal fake Firestore builder supporting exactly the chain
   * pptxRenderDocRef uses: organizations/{orgId}/pptxRenders/{importId}.
   * Returns the orgDoc.collection spy too, so a test can assert no
   * subcollection other than "pptxRenders" was ever touched.
   */
  function mockRenderDb(pptxRendersDoc: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> }) {
    const orgCollectionSpy = vi.fn((name: string) => {
      if (name === "pptxRenders") return { doc: vi.fn(() => pptxRendersDoc) };
      throw new Error(`mockRenderDb: unexpected subcollection "${name}"`);
    });
    const orgDoc = { collection: orgCollectionSpy };
    const db = {
      collection: vi.fn((name: string) => {
        if (name === "organizations") return { doc: vi.fn(() => orgDoc) };
        throw new Error(`mockRenderDb: unexpected collection "${name}"`);
      }),
    };
    vi.mocked(getFirestore).mockReturnValue(db as never);
    return { db, orgCollectionSpy };
  }

  function mockRenderBucket(objectNames: string[]) {
    const files = objectNames.map((name) => ({ name: RENDERED_PREFIX + name }));
    const getFiles = vi.fn(async () => [files]);
    vi.mocked(getStorage).mockReturnValue({
      bucket: () => ({ getFiles }),
    } as never);
    return { getFiles };
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
    vi.mocked(getStorage).mockReset();
    vi.mocked(invokeRenderService).mockReset();
    fakeRenderServiceUrl = "";
  });

  it("case 1: ready when reported, actual and contiguity all agree", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 6 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    mockRenderBucket([
      "page-0001.png",
      "page-0002.png",
      "page-0003.png",
      "page-0004.png",
      "page-0005.png",
      "page-0006.png",
    ]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome).toEqual({ status: "ready", renderedCount: 6 });
    expect(docSpy.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready", renderedCount: 6 }),
      { merge: true },
    );
  });

  it("case 2: ★ failed when the counts disagree -- never ready", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 5 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    mockRenderBucket(["page-0001.png", "page-0002.png", "page-0003.png"]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome.status).not.toBe("ready");
    expect(outcome).toEqual({
      status: "failed",
      renderedCount: 3,
      failureReason: "incomplete-render",
    });
  });

  it("case 3: ★ failed on a zero-page render (empty deck)", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 0 });
    const docSpy = fakeRenderDoc();
    const { orgCollectionSpy } = mockRenderDb(docSpy);
    mockRenderBucket([]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome).toEqual({ status: "failed", renderedCount: 0, failureReason: "incomplete-render" });
    // storagePath was never cleared -- the merge write omits it entirely, and
    // the only subcollection touched is pptxRenders (the parsed text layer,
    // which lives elsewhere, is untouched).
    expect(docSpy.set).toHaveBeenCalledTimes(1);
    expect(docSpy.set.mock.calls[0]?.[0]).not.toHaveProperty("storagePath");
    expect(orgCollectionSpy).toHaveBeenCalledWith("pptxRenders");
    expect(orgCollectionSpy).not.toHaveBeenCalledWith("members");
  });

  it("case 4: ★ failed on a page-number gap even when the counts match", async () => {
    // Reported 3, three objects present -- counts agree at 3, but the
    // sequence page-0001/0002/0004 is not contiguous 1..3. A count-only
    // check would incorrectly pass this as complete.
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 3 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    mockRenderBucket(["page-0001.png", "page-0002.png", "page-0004.png"]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome.status).toBe("failed");
    expect(outcome.failureReason).toBe("incomplete-render");
  });

  it("case 5: ★ trap 1 -- the parser's slide count is never consulted", async () => {
    // Simulates the deck where mapAstToSlides's heuristic MappedSlide[]
    // length would be 4 (a 6-slide deck with one skipped content-free slide
    // and one 3-image collage slide emitting 3 entries), while the renderer
    // reports 6 pages and six objects genuinely exist. If the implementation
    // had derived the expected count from the parser, it would read 4 here
    // and (wrongly) fail. parsePptxBuffer is never even mocked to resolve in
    // this test -- proving the handler cannot be consulting it.
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 6 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    mockRenderBucket([
      "page-0001.png",
      "page-0002.png",
      "page-0003.png",
      "page-0004.png",
      "page-0005.png",
      "page-0006.png",
    ]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome).toEqual({ status: "ready", renderedCount: 6 });
    expect(vi.mocked(parsePptxBuffer)).not.toHaveBeenCalled();

    // Source-inspection companion: requestPptxRenderHandler's body region
    // contains no parsePptxBuffer, MappedSlide or slides reference.
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export async function requestPptxRenderHandler(");
    const triggerStart = source.indexOf("export const requestPptxRender = onDocumentCreated(");
    expect(start).toBeGreaterThan(-1);
    expect(triggerStart).toBeGreaterThan(start);
    const handlerBody = source.slice(start, triggerStart);
    expect(handlerBody).not.toMatch(/parsePptxBuffer/);
    expect(handlerBody).not.toMatch(/MappedSlide/);
    expect(handlerBody).not.toMatch(/\bslides\b/);
  });

  it("case 6: unconfigured service URL never invokes the render service and cannot reach ready", async () => {
    fakeRenderServiceUrl = "";
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome).toEqual({
      status: "failed",
      renderedCount: 0,
      failureReason: "render-service-not-configured",
    });
    expect(invokeRenderService).not.toHaveBeenCalled();
  });

  it("case 7: invoker rejection resolves to failed with render-service-error, never a ready flip", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockRejectedValue(new Error("network unreachable"));
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome).toEqual({
      status: "failed",
      renderedCount: 0,
      failureReason: "render-service-error",
    });
  });

  it("case 8: stray objects under the prefix are not counted -- cannot inflate the recount into agreement", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 3 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    mockRenderBucket(["page-0001.png", "page-0002.png", "thumbnail.jpg"]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome.renderedCount).toBe(2);
    expect(outcome.status).toBe("failed");
  });

  it("case 9: the listing uses the exact rendered/ prefix", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 1 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    const { getFiles } = mockRenderBucket(["page-0001.png"]);

    await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(getFiles).toHaveBeenCalledWith({ prefix: RENDERED_PREFIX });
  });

  it("case 10: missing render doc returns a failed outcome and writes nothing", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    const docSpy = fakeRenderDoc({ exists: false });
    mockRenderDb(docSpy);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome.status).toBe("failed");
    expect(docSpy.set).not.toHaveBeenCalled();
    expect(invokeRenderService).not.toHaveBeenCalled();
  });

  it("case 11: zero-padded names sort to render order regardless of listing order", async () => {
    fakeRenderServiceUrl = SERVICE_URL;
    vi.mocked(invokeRenderService).mockResolvedValue({ renderedCount: 12 });
    const docSpy = fakeRenderDoc();
    mockRenderDb(docSpy);
    // Deliberately hostile listing order: page-0010 before page-0002 before
    // page-0001, etc. -- the fake bucket returns these AS LISTED, not sorted.
    mockRenderBucket([
      "page-0010.png",
      "page-0002.png",
      "page-0001.png",
      "page-0012.png",
      "page-0003.png",
      "page-0011.png",
      "page-0004.png",
      "page-0009.png",
      "page-0005.png",
      "page-0008.png",
      "page-0006.png",
      "page-0007.png",
    ]);

    const outcome = await requestPptxRenderHandler({ orgId: ORG_ID, importId: IMPORT_ID });

    expect(outcome).toEqual({ status: "ready", renderedCount: 12 });
  });
});

describe("RENDERED_OBJECT_GUARD", () => {
  it("matches objects under a pptx-imports rendered/ prefix", () => {
    expect(RENDERED_OBJECT_GUARD.test("orgs/orgA/pptx-imports/i1/rendered/page-0001.png")).toBe(true);
  });

  it("does not match source.pptx or anything under images/ at the same importId", () => {
    expect(RENDERED_OBJECT_GUARD.test("orgs/orgA/pptx-imports/i1/source.pptx")).toBe(false);
    expect(RENDERED_OBJECT_GUARD.test("orgs/orgA/pptx-imports/i1/images/0.png")).toBe(false);
  });

  it("does not match a media path or any other unrelated path", () => {
    expect(RENDERED_OBJECT_GUARD.test("orgs/orgA/media/m1/old.mp4")).toBe(false);
    expect(RENDERED_OBJECT_GUARD.test("some/other/path.txt")).toBe(false);
  });
});

describe("cleanupOrphanRendersHandler", () => {
  const ORG_ID = "orgA";
  const STALE_HOURS = ORPHAN_RENDER_STALE_HOURS + 24; // comfortably past the staleness window
  const FRESH_HOURS = 1; // comfortably inside it

  interface FakeOrphanDocOptions {
    orgId?: string | null;
    importId?: string;
    status?: "pending" | "failed" | "ready";
    ageHours?: number; // omit to simulate an unreadable/missing createdAt
  }

  function fakeOrphanDoc(opts: FakeOrphanDocOptions = {}) {
    const orgId = opts.orgId === undefined ? ORG_ID : opts.orgId;
    const importId = opts.importId ?? "i1";
    const status = opts.status ?? "failed";
    const createdAt =
      opts.ageHours === undefined
        ? undefined
        : { toMillis: () => Date.now() - opts.ageHours! * 60 * 60 * 1000 };
    const deleteSpy = vi.fn(async () => undefined);
    return {
      id: importId,
      data: () => ({ status, createdAt }),
      ref: {
        parent: { parent: orgId === null ? null : { id: orgId } },
        path: `organizations/${orgId}/pptxRenders/${importId}`,
        delete: deleteSpy,
      },
    };
  }

  /**
   * A fake collectionGroup("pptxRenders").where("status", "in", [...]).get()
   * chain. The where() simulation actually filters by status -- mirroring
   * what a real Firestore query does server-side -- so a "ready" doc is
   * provably never returned to the handler at all, not just skipped in-memory.
   */
  function mockOrphanDb(allDocs: ReturnType<typeof fakeOrphanDoc>[]) {
    const whereSpy = vi.fn((field: string, op: string, values: string[]) => {
      const filtered =
        field === "status" && op === "in"
          ? allDocs.filter((d) => values.includes(d.data().status as string))
          : allDocs;
      return { get: vi.fn(async () => ({ docs: filtered })) };
    });
    const collectionGroupSpy = vi.fn((name: string) => {
      if (name !== "pptxRenders") {
        throw new Error(`mockOrphanDb: unexpected collectionGroup "${name}"`);
      }
      return { where: whereSpy };
    });
    vi.mocked(getFirestore).mockReturnValue({ collectionGroup: collectionGroupSpy } as never);
    return { collectionGroupSpy, whereSpy };
  }

  interface FakeRenderedObject {
    name: string;
    delete: ReturnType<typeof vi.fn>;
  }

  function fakeRenderedObject(name: string): FakeRenderedObject {
    return { name, delete: vi.fn(async () => undefined) };
  }

  function mockOrphanBucket(files: FakeRenderedObject[]) {
    const getFiles = vi.fn(async () => [files]);
    vi.mocked(getStorage).mockReturnValue({
      bucket: () => ({ getFiles }),
    } as never);
    return { getFiles };
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
    vi.mocked(getStorage).mockReset();
    delete process.env.PPTX_RENDER_CLEANUP_ENABLED;
  });

  it("deletes both rendered objects and the doc when explicitly enabled", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    const obj2 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0002.png`);
    mockOrphanBucket([obj1, obj2]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).toHaveBeenCalledTimes(1);
    expect(obj2.delete).toHaveBeenCalledTimes(1);
    expect(stale.ref.delete).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ dryRun: false, deletedDocCount: 1, deletedObjectCount: 2 });
  });

  it("FAILS SAFE: unset PPTX_RENDER_CLEANUP_ENABLED deletes nothing, even for a stale failed doc with rendered objects", async () => {
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).not.toHaveBeenCalled();
    expect(stale.ref.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedObjectCount: 1, deletedDocCount: 1 });
  });

  it("FAILS SAFE: an empty-string PPTX_RENDER_CLEANUP_ENABLED behaves identically to unset", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it('FAILS SAFE: PPTX_RENDER_CLEANUP_ENABLED="false" does not enable deletion', async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "false";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it('FAILS SAFE: a non-"true" value ("1") does not enable deletion', async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "1";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it('FAILS SAFE: a case-typo value ("True") does not enable deletion -- the comparison is exact and case-sensitive', async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "True";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it("never touches a ready render, even with the gate enabled -- excluded by the status filter itself", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const ready = fakeOrphanDoc({ status: "ready", ageHours: 90 * 24 });
    const { whereSpy } = mockOrphanDb([ready]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(ready.ref.delete).not.toHaveBeenCalled();
    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
    expect(whereSpy).toHaveBeenCalledWith("status", "in", ["pending", "failed"]);
  });

  it("never touches a fresh pending render -- a render in flight is not an orphan", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const fresh = fakeOrphanDoc({ status: "pending", ageHours: FRESH_HOURS });
    mockOrphanDb([fresh]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(fresh.ref.delete).not.toHaveBeenCalled();
    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
  });

  it("★ never deletes outside the rendered/ prefix -- source.pptx and images/ are structurally unreachable", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const sourceFile = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    const imageFile = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/images/0.png`);
    const renderedFile = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([sourceFile, imageFile, renderedFile]);

    const summary = await cleanupOrphanRendersHandler();

    expect(sourceFile.delete).not.toHaveBeenCalled();
    expect(imageFile.delete).not.toHaveBeenCalled();
    expect(renderedFile.delete).toHaveBeenCalledTimes(1);
    expect(summary.deletedObjectCount).toBe(1);
  });

  it("an unreadable createdAt is skipped even with the gate enabled -- fail safe", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const unreadable = fakeOrphanDoc({ status: "failed" }); // ageHours omitted -> unreadable createdAt
    mockOrphanDb([unreadable]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockOrphanBucket([obj1]);

    const summary = await cleanupOrphanRendersHandler();

    expect(unreadable.ref.delete).not.toHaveBeenCalled();
    expect(obj1.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
  });

  it("partial-failure tolerance: one rejecting object delete does not abort the run -- the second object and the doc are still deleted", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const failing = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    failing.delete.mockRejectedValueOnce(new Error("network blip"));
    const succeeding = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0002.png`);
    mockOrphanBucket([failing, succeeding]);

    const summary = await cleanupOrphanRendersHandler();

    expect(succeeding.delete).toHaveBeenCalledTimes(1);
    expect(stale.ref.delete).toHaveBeenCalledTimes(1);
    expect(summary.deletedObjectCount).toBe(1);
  });

  it('★ SOURCE INSPECTION: the dry-run gate direction is pinned against the 2026-07-28 inverted-gate incident (9f1b881)', () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export async function cleanupOrphanRendersHandler(");
    const wrapperStart = source.indexOf("export const cleanupOrphanRenders = onSchedule(");
    expect(start).toBeGreaterThan(-1);
    expect(wrapperStart).toBeGreaterThan(start);
    const handlerBody = source.slice(start, wrapperStart);
    expect(handlerBody).toMatch(
      /const dryRun = process\.env\.PPTX_RENDER_CLEANUP_ENABLED !== "true";/,
    );
  });
});

// --- queueServiceMessage send-path enqueue (59-02) ----------------------
//
// The thin enqueue half of the send path: a pure createQueuedMessage()
// doc-shaper (shared with Phase 61's cron so the messages/{id} shape can
// never drift) plus the queueServiceMessageHandler onCall body, which
// re-authorizes the caller (editor-tier), re-reads the org messaging
// kill-switch server-side, validates the request, and enqueues exactly one
// messages/{id} doc. It holds NO provider secret (RESEND_API_KEY binds only
// to sendQueuedMessage in 59-03). Follows the same mock-everything-at-module
// -scope discipline as the parsePptxHandler block above.

describe("createQueuedMessage", () => {
  const BASE_INPUT = {
    orgId: "org1",
    serviceId: "svc1",
    type: "oneoff" as const,
    subject: "Sunday reminder",
    body: "Please arrive by 8am. {{their_roles}}",
    recipientSelector: {
      teams: ["band"],
      individualPersonIds: ["p1"],
      includeEveryone: false,
    },
    options: { attachServiceLink: true, sendCopyToSelf: false },
    scheduledFor: null as string | null,
    requestedByUid: "user1",
  };

  it("shapes status 'queued' when scheduledFor is null (send-now)", () => {
    const doc = createQueuedMessage({ ...BASE_INPUT, scheduledFor: null });
    expect(doc.status).toBe("queued");
    expect(doc.scheduledFor).toBeNull();
  });

  it("shapes status 'scheduled' when scheduledFor is a non-empty string", () => {
    const when = "2099-01-01T09:00:00.000Z";
    const doc = createQueuedMessage({ ...BASE_INPUT, scheduledFor: when });
    expect(doc.status).toBe("scheduled");
    expect(doc.scheduledFor).toBe(when);
  });

  it("carries the full CONTEXT §Data Model shape with zeroed deliveryCounts and null changeDiff/sentAt", () => {
    const doc = createQueuedMessage(BASE_INPUT);
    expect(doc).toMatchObject({
      type: "oneoff",
      status: "queued",
      subject: BASE_INPUT.subject,
      body: BASE_INPUT.body,
      recipientSelector: BASE_INPUT.recipientSelector,
      options: BASE_INPUT.options,
      changeDiff: null,
      sentAt: null,
      requestedByUid: "user1",
      deliveryCounts: { sent: 0, failed: 0 },
    });
    // createdAt is the FieldValue.serverTimestamp() sentinel (mocked at :42).
    expect(doc.createdAt).toBe("SERVER_TIMESTAMP_SENTINEL");
  });

  it("never emits an undefined field value -- Firestore rejects undefined", () => {
    const doc = createQueuedMessage(BASE_INPUT) as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(doc)) {
      expect(value, `field ${key} must not be undefined`).not.toBeUndefined();
    }
  });
});

// --- NLT proxy branch (45-01: query-param secret injection) -------------
//
// The `api` onRequest handler itself has no existing test harness
// (Assumption A2, 45-RESEARCH.md), so this suite exercises the pure
// `buildUpstreamUrl` helper directly plus the PROXY_TARGETS/SECRET_INJECTED
// membership the handler's existing auth gate reuses -- proving R090's
// proxy half without needing a full onRequest test harness.

describe("PROXY_TARGETS / SECRET_INJECTED (nlt membership)", () => {
  it("registers the nlt upstream host in PROXY_TARGETS", () => {
    expect(PROXY_TARGETS.nlt).toBe("https://api.nlt.to");
  });

  it("adds nlt to SECRET_INJECTED, reusing the existing x-app-auth gate -- unauthenticated callers get 401, no new auth surface (T-45-12)", () => {
    expect(SECRET_INJECTED.has("nlt")).toBe(true);
  });

  it("leaves the esv and anthropic PROXY_TARGETS/SECRET_INJECTED entries byte-unchanged", () => {
    expect(PROXY_TARGETS.esv).toBe("https://api.esv.org");
    expect(PROXY_TARGETS.anthropic).toBe("https://api.anthropic.com");
    expect(SECRET_INJECTED.has("esv")).toBe(true);
    expect(SECRET_INJECTED.has("anthropic")).toBe(true);
  });
});

describe("buildUpstreamUrl", () => {
  it("returns the esv URL unchanged -- esv's key travels in a header, not the URL", () => {
    const url = "https://api.esv.org/v3/passage/text/?q=John+3:16";
    expect(buildUpstreamUrl("esv", url, "SERVER_SECRET")).toBe(url);
  });

  it("returns the anthropic URL unchanged", () => {
    const url = "https://api.anthropic.com/v1/messages";
    expect(buildUpstreamUrl("anthropic", url, "SERVER_SECRET")).toBe(url);
  });

  it("appends key=<secret> to an nlt URL that carries no key param yet", () => {
    const url = "https://api.nlt.to/api/passages?ref=John+3:16&version=NLT";
    const built = buildUpstreamUrl("nlt", url, "SERVER_SECRET");
    const parsed = new URL(built);
    expect(parsed.searchParams.get("key")).toBe("SERVER_SECRET");
    expect(parsed.searchParams.get("ref")).toBe("John 3:16");
    expect(parsed.searchParams.get("version")).toBe("NLT");
  });

  it("T-45-11: OVERWRITES a client-supplied key on an nlt URL rather than trusting it -- spoofing/quota-theft prevention", () => {
    const url = "https://api.nlt.to/api/passages?ref=John+3:16&version=NLT&key=attacker";
    const built = buildUpstreamUrl("nlt", url, "SERVER_SECRET");
    const parsed = new URL(built);
    expect(parsed.searchParams.get("key")).toBe("SERVER_SECRET");
    expect(parsed.searchParams.getAll("key")).toEqual(["SERVER_SECRET"]);
  });
});

describe("redactUrl", () => {
  it("WR-02: masks the nlt `key` query-param value, never the live secret", () => {
    const built = buildUpstreamUrl(
      "nlt",
      "https://api.nlt.to/api/passages?ref=John+3:16&version=NLT",
      "LIVE_SECRET_VALUE",
    );
    const redacted = redactUrl(built);
    expect(redacted).not.toContain("LIVE_SECRET_VALUE");
    const parsed = new URL(redacted);
    expect(parsed.searchParams.get("key")).toBe("REDACTED");
    // Non-secret params survive untouched -- only `key` is masked.
    expect(parsed.searchParams.get("ref")).toBe("John 3:16");
    expect(parsed.searchParams.get("version")).toBe("NLT");
  });

  it("leaves a URL with no `key` param byte-unchanged (esv/anthropic never have one)", () => {
    const url = "https://api.esv.org/v3/passage/text/?q=John+3:16";
    expect(redactUrl(url)).toBe(url);
  });

  it("fails closed to a generic placeholder on an unparseable URL, rather than risking a raw leak", () => {
    expect(redactUrl("not a url")).toBe("[unparseable URL]");
  });
});
