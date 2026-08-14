import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  queueServiceMessageHandler,
  redactUrl,
  RENDERED_OBJECT_GUARD,
  RETENTION_DAYS,
  SECRET_INJECTED,
  parsePptxHandler,
  requestPptxRenderHandler,
  sendQueuedMessageHandler,
  sendQueuedMessage,
  resolveRecipientRef,
  recordBounce,
  messageWebhookHandler,
} from "./index";
import type { QueueMessageRequest } from "./index";
import { parsePptxBuffer } from "./pptxParser";
import { invokeRenderService } from "./renderInvoker";

// A per-test variable the mocked defineString's value() reads, so each
// requestPptxRenderHandler test case can set/clear PPTX_RENDER_SERVICE_URL
// independently without needing to re-import the module.
let fakeRenderServiceUrl = "";
// Send-path (59-03) config seams, keyed by defineString NAME below so the
// three configs don't collide on one shared value.
let fakeShareBaseUrl = "";
let fakeMessageFromAddress = "Worship Planner <noreply@worshipplanner.app>";
// The email getAuth().getUser(uid) resolves to for sendCopyToSelf.
let fakeEditorEmail = "editor@example.com";

// The mocked Resend .emails.send — hoisted so the vi.mock("resend") factory can
// close over it. No real email is ever sent (59-03 ships against a mocked
// provider; the real RESEND_API_KEY is never set in tests).
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

// index.ts's module-scope initializeApp()/defineSecret() calls, and its
// getAuth/getFirestore/getStorage imports, must be neutralized so importing
// it in tests never touches a real Firebase project, Secret Manager, or
// emulator -- mirrors the mocking pattern in pptxParser.test.ts.
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(),
    // sendQueuedMessage resolves the requesting editor's own email server-side
    // (never a client-supplied address) for options.sendCopyToSelf.
    getUser: vi.fn(async () => ({ email: fakeEditorEmail })),
  })),
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
  // Name-aware so PPTX_RENDER_SERVICE_URL, SERVICE_SHARE_BASE_URL and
  // MESSAGE_FROM_ADDRESS each read their own per-test seam instead of colliding
  // on one shared value.
  defineString: vi.fn((name: string) => ({
    value: () => {
      if (name === "SERVICE_SHARE_BASE_URL") return fakeShareBaseUrl;
      if (name === "MESSAGE_FROM_ADDRESS") return fakeMessageFromAddress;
      return fakeRenderServiceUrl;
    },
  })),
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
// The Resend SDK is fully mocked — sendQueuedMessage never sends a real email
// in tests (59-03 ships built/tested/UNDEPLOYED against a mocked provider).
vi.mock("resend", () => ({
  // A regular function (not an arrow) so `new Resend(key)` constructs cleanly —
  // an arrow function "is not a constructor".
  Resend: vi.fn(function () {
    return { emails: { send: mockSend } };
  }),
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

describe("queueServiceMessageHandler", () => {
  const ORG_ID = "org1";
  const SERVICE_ID = "svc1";
  const UID = "user1";
  const GENERATED_ID = "msg-generated-id";
  const DAY = 24 * 60 * 60 * 1000;

  interface FakeDbOptions {
    memberExists?: boolean;
    role?: string;
    orgExists?: boolean;
    messagingEnabled?: boolean;
    setSpy?: ReturnType<typeof vi.fn>;
  }

  /**
   * A minimal fake Firestore supporting exactly the chains
   * queueServiceMessageHandler uses:
   *   organizations/{orgId}/members/{uid}          -> .get()  (role re-check)
   *   organizations/{orgId}                        -> .get()  (kill-switch)
   *   organizations/{orgId}/services/{serviceId}/messages -> .doc().set() (enqueue)
   */
  function fakeDb(opts: FakeDbOptions = {}) {
    const memberExists = opts.memberExists ?? true;
    const role = opts.role ?? "editor";
    const orgExists = opts.orgExists ?? true;
    const messagingEnabled = opts.messagingEnabled ?? true;
    const setSpy = opts.setSpy ?? vi.fn(async () => undefined);

    const memberDoc = {
      get: vi.fn(async () => ({
        exists: memberExists,
        data: () => (memberExists ? { role } : undefined),
      })),
    };
    const messageDoc = { id: GENERATED_ID, set: setSpy };
    const messagesCollection = { doc: vi.fn(() => messageDoc) };
    const serviceDoc = {
      collection: vi.fn((name: string) => {
        if (name === "messages") return messagesCollection;
        throw new Error(`fakeDb: unexpected service subcollection "${name}"`);
      }),
    };
    const servicesCollection = { doc: vi.fn(() => serviceDoc) };

    const orgDoc = {
      get: vi.fn(async () => ({
        exists: orgExists,
        data: () =>
          orgExists ? { settings: { messaging: { enabled: messagingEnabled } } } : undefined,
      })),
      collection: vi.fn((name: string) => {
        if (name === "members") return { doc: vi.fn(() => memberDoc) };
        if (name === "services") return servicesCollection;
        throw new Error(`fakeDb: unexpected org subcollection "${name}"`);
      }),
    };

    const db = {
      collection: vi.fn((name: string) => {
        if (name === "organizations") return { doc: vi.fn(() => orgDoc) };
        throw new Error(`fakeDb: unexpected collection "${name}"`);
      }),
    };

    return { db, memberDoc, orgDoc, messageDoc, messagesCollection, setSpy };
  }

  function validData(overrides: Partial<QueueMessageRequest> = {}): QueueMessageRequest {
    return {
      orgId: ORG_ID,
      serviceId: SERVICE_ID,
      type: "oneoff",
      subject: "Sunday reminder",
      body: "Please arrive by 8am.",
      recipientSelector: { teams: ["band"], individualPersonIds: [], includeEveryone: false },
      options: { attachServiceLink: false, sendCopyToSelf: false },
      scheduledFor: null,
      ...overrides,
    };
  }

  function fakeRequest(
    overrides: { auth?: { uid: string } | null; data?: Partial<QueueMessageRequest> } = {},
  ): CallableRequest<QueueMessageRequest> {
    const auth = overrides.auth === undefined ? { uid: UID } : overrides.auth;
    return {
      auth: auth ?? undefined,
      data: validData(overrides.data ?? {}),
    } as unknown as CallableRequest<QueueMessageRequest>;
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
  });

  it("throws unauthenticated when request.auth is missing, and never reads Firestore", async () => {
    await expect(
      queueServiceMessageHandler(fakeRequest({ auth: null })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("throws invalid-argument when a required field is missing", async () => {
    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { subject: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { orgId: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws invalid-argument for a type outside oneoff|reminder|share-link (R137)", async () => {
    await expect(
      queueServiceMessageHandler(
        fakeRequest({ data: { type: "broadcast" as unknown as QueueMessageRequest["type"] } }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws permission-denied for a caller whose member doc is absent (wrong org / not a member)", async () => {
    const { db } = fakeDb({ memberExists: false });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(queueServiceMessageHandler(fakeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("throws permission-denied for a viewer (member role not in editor|admin)", async () => {
    const { db, setSpy } = fakeDb({ role: "viewer" });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(queueServiceMessageHandler(fakeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("accepts an admin as editor-tier", async () => {
    const { db, setSpy } = fakeDb({ role: "admin" });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const result = await queueServiceMessageHandler(fakeRequest());

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it("re-reads the kill-switch server-side and rejects when messaging is off, even for an editor", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: false });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(queueServiceMessageHandler(fakeRequest())).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("rejects a scheduledFor in the past → invalid-argument", async () => {
    const { db, setSpy } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(
        fakeRequest({ data: { scheduledFor: new Date(Date.now() - DAY).toISOString() } }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("rejects an implausibly far-future scheduledFor → invalid-argument", async () => {
    const { db } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(
        fakeRequest({ data: { scheduledFor: new Date(Date.now() + 400 * DAY).toISOString() } }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects an unparseable scheduledFor → invalid-argument", async () => {
    const { db } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { scheduledFor: "not-a-date" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("a valid send-now request enqueues ONE messages/{id} with status 'queued' and returns { messageId }", async () => {
    const { db, setSpy, messageDoc } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const result = await queueServiceMessageHandler(fakeRequest());

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
        type: "oneoff",
        requestedByUid: UID,
        scheduledFor: null,
      }),
    );
    expect(messageDoc.id).toBe(GENERATED_ID);
  });

  it("a valid scheduled request enqueues status 'scheduled' with the scheduledFor persisted", async () => {
    const when = new Date(Date.now() + 3 * DAY).toISOString();
    const { db, setSpy } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const result = await queueServiceMessageHandler(fakeRequest({ data: { scheduledFor: when } }));

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled", scheduledFor: when }),
    );
  });

  it("writes under organizations/{orgId}/services/{serviceId}/messages -- the enqueue path", async () => {
    const { db, orgDoc } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await queueServiceMessageHandler(fakeRequest());

    expect(orgDoc.collection).toHaveBeenCalledWith("services");
    expect(orgDoc.collection).toHaveBeenCalledWith("members");
  });

  it("SOURCE INSPECTION: the queueServiceMessage onCall wrapper carries NO secrets array (never holds RESEND_API_KEY)", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export const queueServiceMessage = onCall(");
    expect(start).toBeGreaterThan(-1);
    // Slice to the end of the onCall(...) call expression.
    const tail = source.slice(start, start + 400);
    const optionsEnd = tail.indexOf("queueServiceMessageHandler");
    expect(optionsEnd).toBeGreaterThan(-1);
    const optionsObject = tail.slice(0, optionsEnd);
    expect(optionsObject).not.toMatch(/secrets/);
    expect(optionsObject).not.toMatch(/RESEND_API_KEY/);
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

// --- sendQueuedMessage send trigger (59-03: R131/R138/R139) --------------
//
// The send half of the path: an onDocumentCreated trigger (handler body
// exported separately, requestPptxRenderHandler precedent) that is the ONLY
// Function bound to RESEND_API_KEY. It runs a transactional queued->sending
// idempotency claim (GENUINELY NEW code — the PPTX precedent has no status
// claim), re-resolves recipients server-side (never the client list,
// Anti-Pattern 1), renders per-recipient tokens (R139), sends via a MOCKED
// Resend, writes one recipients/{id} doc per recipient, rolls up
// deliveryCounts, and flips the message status.

describe("sendQueuedMessageHandler", () => {
  const ORG_ID = "org1";
  const SERVICE_ID = "svc1";
  const MESSAGE_ID = "msg1";
  const SERVICE_DATE = "2026-08-16";

  interface FakeMessage {
    status?: string;
    subject?: string;
    body?: string;
    recipientSelector?: {
      teams: string[];
      individualPersonIds: string[];
      includeEveryone: boolean;
    };
    options?: { attachServiceLink: boolean; sendCopyToSelf: boolean };
    requestedByUid?: string;
  }

  interface SendDbConfig {
    message?: FakeMessage | null; // null => message doc missing
    service?: { date: string; slots?: unknown[]; roleAssignmentOverrides?: Record<string, string[]> } | null;
    quarters?: Array<{ serviceDates: string[]; calendar: Record<string, Record<string, string[]>> }>;
    roles?: Array<{ id: string; name: string; group: string; order: number }>;
    people?: Array<{ id: string; name: string; email: string }>;
    shareTokens?: Array<{ token: string; orgId: string; createdAtMs: number }>;
  }

  function docSnap(exists: boolean, data: unknown) {
    return { exists, data: () => data };
  }
  function colSnap(docs: Array<{ id: string; data: unknown }>) {
    return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
  }

  function makeSendDb(cfg: SendDbConfig) {
    const messageExists = cfg.message !== null && cfg.message !== undefined;
    const messageData = messageExists ? { ...(cfg.message as FakeMessage) } : undefined;
    let messageStatus = messageExists ? (cfg.message as FakeMessage).status ?? "queued" : undefined;

    const messageSetSpy = vi.fn(async () => undefined);
    const txUpdateSpy = vi.fn();
    const recipientWrites: Array<{ id: string; payload: Record<string, unknown> }> = [];

    const recipientsCol = {
      doc: vi.fn((rid: string) => ({
        set: vi.fn(async (payload: Record<string, unknown>) => {
          recipientWrites.push({ id: rid, payload });
        }),
      })),
    };

    const messageRef = {
      set: messageSetSpy,
      collection: vi.fn((name: string) => {
        if (name === "recipients") return recipientsCol;
        throw new Error(`makeSendDb: unexpected message subcollection "${name}"`);
      }),
    };
    const messagesCol = { doc: vi.fn(() => messageRef) };

    const serviceRef = {
      get: vi.fn(async () =>
        cfg.service ? docSnap(true, cfg.service) : docSnap(false, undefined),
      ),
      collection: vi.fn((name: string) => {
        if (name === "messages") return messagesCol;
        throw new Error(`makeSendDb: unexpected service subcollection "${name}"`);
      }),
    };
    const servicesCol = { doc: vi.fn(() => serviceRef) };

    const orgRef = {
      collection: vi.fn((name: string) => {
        if (name === "services") return servicesCol;
        if (name === "quarters")
          return {
            get: vi.fn(async () =>
              colSnap((cfg.quarters ?? []).map((q, i) => ({ id: `q${i}`, data: q }))),
            ),
          };
        if (name === "roles")
          return {
            get: vi.fn(async () =>
              colSnap((cfg.roles ?? []).map((r) => ({ id: r.id, data: r }))),
            ),
          };
        if (name === "people")
          return {
            get: vi.fn(async () =>
              colSnap((cfg.people ?? []).map((p) => ({ id: p.id, data: p }))),
            ),
          };
        throw new Error(`makeSendDb: unexpected org subcollection "${name}"`);
      }),
    };

    const shareTokensWhere = vi.fn(() => ({
      get: vi.fn(async () =>
        colSnap(
          (cfg.shareTokens ?? []).map((t) => ({
            id: t.token,
            data: { orgId: t.orgId, createdAt: { toMillis: () => t.createdAtMs } },
          })),
        ),
      ),
    }));

    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async () =>
          messageExists
            ? docSnap(true, { ...messageData, status: messageStatus })
            : docSnap(false, undefined),
        ),
        update: vi.fn((_ref: unknown, patch: { status?: string }) => {
          txUpdateSpy(_ref, patch);
          if (patch && typeof patch.status === "string") messageStatus = patch.status;
        }),
      };
      return fn(tx);
    });

    const db = {
      collection: vi.fn((name: string) => {
        if (name === "organizations") return { doc: vi.fn(() => orgRef) };
        if (name === "shareTokens") return { where: shareTokensWhere };
        throw new Error(`makeSendDb: unexpected collection "${name}"`);
      }),
      runTransaction,
    };

    return { db, messageSetSpy, recipientWrites, txUpdateSpy, runTransaction };
  }

  // Two band people filling two different band roles — the R139 divergence fixture.
  function twoRecipientConfig(overrides: Partial<FakeMessage> = {}): SendDbConfig {
    return {
      message: {
        status: "queued",
        subject: "Reminder for {{service_date}}",
        body: "You: {{their_roles}}",
        recipientSelector: { teams: ["band"], individualPersonIds: [], includeEveryone: false },
        options: { attachServiceLink: false, sendCopyToSelf: false },
        requestedByUid: "uidEditor",
        ...overrides,
      },
      service: { date: SERVICE_DATE, slots: [], roleAssignmentOverrides: {} },
      quarters: [
        {
          serviceDates: [SERVICE_DATE],
          calendar: { [SERVICE_DATE]: { rg: ["pA"], rb: ["pB"] } },
        },
      ],
      roles: [
        { id: "rg", name: "guitar", group: "band", order: 0 },
        { id: "rb", name: "bass", group: "band", order: 1 },
      ],
      people: [
        { id: "pA", name: "Alice", email: "alice@example.com" },
        { id: "pB", name: "Bob", email: "bob@example.com" },
      ],
    };
  }

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "re_fake_id" }, error: null });
    fakeShareBaseUrl = "";
    fakeMessageFromAddress = "Worship Planner <noreply@worshipplanner.app>";
    fakeEditorEmail = "editor@example.com";
  });

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
  });

  it("a 'queued' doc: the transaction flips it to 'sending' and the handler sends to every reachable recipient", async () => {
    const { db, txUpdateSpy, recipientWrites, messageSetSpy } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    // Idempotency claim ran and flipped queued -> sending.
    expect(txUpdateSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "sending" }));
    // One send per reachable recipient.
    expect(mockSend).toHaveBeenCalledTimes(2);
    const toAddresses = mockSend.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
    expect(toAddresses).toEqual(["alice@example.com", "bob@example.com"]);
    // recipients/{id} written per recipient, deliveryCounts + status rolled up.
    expect(recipientWrites).toHaveLength(2);
    expect(recipientWrites.every((w) => w.payload.status === "sent")).toBe(true);
    expect(messageSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", deliveryCounts: { sent: 2, failed: 0 } }),
      { merge: true },
    );
    expect(outcome).toMatchObject({ status: "sent", sentCount: 2, failedCount: 0 });
  });

  it("carries the exact Resend tags [orgId, serviceId, messageId, recipientId] as the Firestore path segments (Phase 60 webhook contract)", async () => {
    const { db } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const aliceCall = mockSend.mock.calls.find((c) => (c[0] as { to: string }).to === "alice@example.com");
    expect(aliceCall).toBeDefined();
    const tags = (aliceCall![0] as { tags: Array<{ name: string; value: string }> }).tags;
    expect(tags).toEqual([
      { name: "orgId", value: ORG_ID },
      { name: "serviceId", value: SERVICE_ID },
      { name: "messageId", value: MESSAGE_ID },
      { name: "recipientId", value: "pA" },
    ]);
  });

  it("R139: renders {{their_roles}} per recipient — person A ('guitar') != person B ('bass') from the SAME body template", async () => {
    const { db } = makeSendDb(twoRecipientConfig({ body: "You: {{their_roles}}" }));
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const alice = mockSend.mock.calls.find((c) => (c[0] as { to: string }).to === "alice@example.com")![0] as { text: string };
    const bob = mockSend.mock.calls.find((c) => (c[0] as { to: string }).to === "bob@example.com")![0] as { text: string };
    expect(alice.text).toBe("You: guitar");
    expect(bob.text).toBe("You: bass");
    expect(alice.text).not.toBe(bob.text);
  });

  it("★ IDEMPOTENCY: a SECOND invocation on an already-'sending' doc sends ZERO emails and writes no status flip", async () => {
    const cfg = twoRecipientConfig({ status: "sending" });
    const { db, messageSetSpy, recipientWrites } = makeSendDb(cfg);
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect(mockSend).not.toHaveBeenCalled();
    expect(recipientWrites).toHaveLength(0);
    expect(messageSetSpy).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: "skipped", sentCount: 0, failedCount: 0 });
  });

  it("★ IDEMPOTENCY: an already-'sent' doc likewise sends ZERO emails", async () => {
    const { db } = makeSendDb(twoRecipientConfig({ status: "sent" }));
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect(mockSend).not.toHaveBeenCalled();
    expect(outcome.status).toBe("skipped");
  });

  it("a 'scheduled' doc never satisfies the === 'queued' guard — skipped, no send (left for Phase 61 cron)", async () => {
    const { db, messageSetSpy } = makeSendDb(twoRecipientConfig({ status: "scheduled" }));
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect(mockSend).not.toHaveBeenCalled();
    expect(messageSetSpy).not.toHaveBeenCalled();
    expect(outcome.status).toBe("skipped");
  });

  it("a missing message doc is skipped without sending", async () => {
    const { db } = makeSendDb({ message: null, service: { date: SERVICE_DATE } });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect(mockSend).not.toHaveBeenCalled();
    expect(outcome.status).toBe("skipped");
  });

  it("Anti-Pattern 1: re-resolves the send list from Firestore — a stale individualPersonId in the selector is dropped, the real address comes only from people/{id}", async () => {
    const cfg = twoRecipientConfig({
      // Selector points at ONE team plus a stale/deleted individual id. The
      // client never supplies an address — only Firestore re-resolution does.
      recipientSelector: { teams: ["band"], individualPersonIds: ["ghost-deleted"], includeEveryone: false },
    });
    const { db } = makeSendDb(cfg);
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    // The ghost id has no people/{id} doc → silently skipped, never emailed.
    const toAddresses = mockSend.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
    expect(toAddresses).toEqual(["alice@example.com", "bob@example.com"]);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("partial failure: one rejecting send → that recipient is 'failed', the batch continues, message rolls up to 'partial'", async () => {
    const { db, recipientWrites, messageSetSpy } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);
    // Fail Bob's send, succeed Alice's (order-independent: reject whenever the
    // recipient is bob@…).
    mockSend.mockImplementation(async (payload: { to: string }) => {
      if (payload.to === "bob@example.com") throw new Error("invalid recipient");
      return { data: { id: "re_ok" }, error: null };
    });

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const byId = Object.fromEntries(recipientWrites.map((w) => [w.id, w.payload.status]));
    expect(byId.pA).toBe("sent");
    expect(byId.pB).toBe("failed");
    expect(messageSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "partial", deliveryCounts: { sent: 1, failed: 1 } }),
      { merge: true },
    );
    expect(outcome).toMatchObject({ status: "partial", sentCount: 1, failedCount: 1 });
  });

  it("all sends failing rolls the message up to 'failed'", async () => {
    const { db, messageSetSpy } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);
    mockSend.mockRejectedValue(new Error("provider down"));

    const outcome = await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect(messageSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", deliveryCounts: { sent: 0, failed: 2 } }),
      { merge: true },
    );
    expect(outcome.status).toBe("failed");
  });

  it("options.sendCopyToSelf: also sends to the requesting editor's own email, resolved server-side (never a client address)", async () => {
    fakeEditorEmail = "self@editor.com";
    const { db, recipientWrites } = makeSendDb(twoRecipientConfig({ options: { attachServiceLink: false, sendCopyToSelf: true }, requestedByUid: "uidEditor" }));
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const toAddresses = mockSend.mock.calls.map((c) => (c[0] as { to: string }).to);
    expect(toAddresses).toContain("self@editor.com");
    expect(mockSend).toHaveBeenCalledTimes(3); // 2 volunteers + 1 self copy
    // The self copy is recorded under the editor's uid.
    expect(recipientWrites.some((w) => w.id === "uidEditor")).toBe(true);
  });

  it("{{song_list}} renders the service doc's SONG-slot titles in order (non-SONG slots excluded)", async () => {
    const cfg = twoRecipientConfig({ body: "Songs: {{song_list}}" });
    cfg.service = {
      date: SERVICE_DATE,
      slots: [
        { kind: "SONG", position: 0, songTitle: "Amazing Grace" },
        { kind: "PRAYER", position: 1, body: "Opening prayer" },
        { kind: "SONG", position: 2, songTitle: "How Great Thou Art" },
      ],
      roleAssignmentOverrides: {},
    };
    const { db } = makeSendDb(cfg);
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const alice = mockSend.mock.calls.find((c) => (c[0] as { to: string }).to === "alice@example.com")![0] as { text: string };
    expect(alice.text).toBe("Songs: Amazing Grace, How Great Thou Art");
  });

  it("{{service_link}} renders ${base}/share/${token} from the latest adoptable shareTokens doc for this service", async () => {
    fakeShareBaseUrl = "https://app.example.com";
    const cfg = twoRecipientConfig({ body: "Plan: {{service_link}}" });
    cfg.shareTokens = [
      { token: "old_token", orgId: ORG_ID, createdAtMs: 1000 },
      { token: "new_token", orgId: ORG_ID, createdAtMs: 5000 },
      { token: "foreign_token", orgId: "other-org", createdAtMs: 9000 }, // wrong org, ignored
    ];
    const { db } = makeSendDb(cfg);
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const alice = mockSend.mock.calls.find((c) => (c[0] as { to: string }).to === "alice@example.com")![0] as { text: string };
    expect(alice.text).toBe("Plan: https://app.example.com/share/new_token");
  });

  it("{{service_link}} renders '' when no share token exists for the service (A1 empty substitution)", async () => {
    fakeShareBaseUrl = "https://app.example.com";
    const cfg = twoRecipientConfig({ body: "Plan:{{service_link}}" });
    cfg.shareTokens = [];
    const { db } = makeSendDb(cfg);
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const alice = mockSend.mock.calls.find((c) => (c[0] as { to: string }).to === "alice@example.com")![0] as { text: string };
    expect(alice.text).toBe("Plan:");
  });

  it("the sendQueuedMessage onDocumentCreated wrapper delegates event.params to the handler", async () => {
    const { db } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);

    // onDocumentCreated is mocked to return the handler function directly.
    await (sendQueuedMessage as unknown as (event: { params: { orgId: string; serviceId: string; messageId: string } }) => Promise<void>)({
      params: { orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID },
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("SOURCE INSPECTION: RESEND_API_KEY is bound to EXACTLY ONE Function, and it is sendQueuedMessage", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    // The secret binds via `secrets: [RESEND_API_KEY]` exactly once in the file.
    const bindings = source.match(/secrets:\s*\[RESEND_API_KEY\]/g) ?? [];
    expect(bindings).toHaveLength(1);
    // And that single binding lives inside the sendQueuedMessage wrapper.
    const wrapperStart = source.indexOf("export const sendQueuedMessage = onDocumentCreated(");
    expect(wrapperStart).toBeGreaterThan(-1);
    const wrapperRegion = source.slice(wrapperStart, wrapperStart + 600);
    expect(wrapperRegion).toMatch(/secrets:\s*\[RESEND_API_KEY\]/);
  });
});

// --- messageWebhook addressing + idempotent bounce persistence (60-02) -------
//
// resolveRecipientRef addresses the bounced recipient from the echoed Resend
// tags (a direct doc() at the exact nested path — no query, no index) and, only
// when tags are absent, falls back to a collectionGroup('recipients') lookup on
// the providerMessageId (data.email_id) 59-03 stored. recordBounce is a
// transition-guarded transaction: it flips recipients/{id} to status:'bounced'
// and increments messages/{id}.deliveryCounts.bounced as a LITERAL prev+1 ONLY
// on the not-bounced -> bounced transition, so a duplicate (at-least-once)
// delivery is a safe no-op and the count never double-counts (success
// criterion 4).

describe("resolveRecipientRef (60-02 addressing)", () => {
  const TAGS = { orgId: "org1", serviceId: "svc1", messageId: "msg1", recipientId: "rec1" };

  function makeAddressingDb(fallbackRef: unknown | null = null) {
    const collectionGroupGet = vi.fn(async () => ({
      empty: fallbackRef == null,
      docs: fallbackRef == null ? [] : [{ ref: fallbackRef }],
    }));
    const limit = vi.fn(() => ({ get: collectionGroupGet }));
    const where = vi.fn(() => ({ limit }));
    const collectionGroup = vi.fn(() => ({ where }));
    const doc = vi.fn((docPath: string) => ({ path: docPath }));
    const db = { doc, collectionGroup };
    return { db, doc, collectionGroup, where, limit, collectionGroupGet };
  }

  it("addresses the recipient DIRECTLY from tags — a single doc() at the nested path, NO collectionGroup query", async () => {
    const { db, doc, collectionGroup } = makeAddressingDb();

    const ref = await resolveRecipientRef(db as never, { tags: TAGS });

    expect(doc).toHaveBeenCalledWith(
      "organizations/org1/services/svc1/messages/msg1/recipients/rec1",
    );
    expect(ref).toEqual({ path: "organizations/org1/services/svc1/messages/msg1/recipients/rec1" });
    // The tags path must NOT touch the collection-group query (no index dependency).
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it("falls back to collectionGroup('recipients').where('providerMessageId','==',email_id) when tags are absent", async () => {
    const fallbackRef = { path: "fallback/ref" };
    const { db, doc, collectionGroup, where, limit } = makeAddressingDb(fallbackRef);

    const ref = await resolveRecipientRef(db as never, { email_id: "re_abc123" });

    expect(collectionGroup).toHaveBeenCalledWith("recipients");
    expect(where).toHaveBeenCalledWith("providerMessageId", "==", "re_abc123");
    expect(limit).toHaveBeenCalledWith(1);
    expect(doc).not.toHaveBeenCalled();
    expect(ref).toBe(fallbackRef);
  });

  it("returns null when tags are absent and the providerMessageId fallback matches nothing", async () => {
    const { db } = makeAddressingDb(null);

    const ref = await resolveRecipientRef(db as never, { email_id: "re_missing" });

    expect(ref).toBeNull();
  });

  it("returns null (no throw) when neither tags nor an email_id are present", async () => {
    const { db, collectionGroup } = makeAddressingDb(null);

    const ref = await resolveRecipientRef(db as never, {});

    expect(ref).toBeNull();
    expect(collectionGroup).not.toHaveBeenCalled();
  });

  it("ignores partial tags (missing recipientId) and uses the providerMessageId fallback instead", async () => {
    const fallbackRef = { path: "fallback/ref" };
    const { db, doc, collectionGroup } = makeAddressingDb(fallbackRef);

    const ref = await resolveRecipientRef(db as never, {
      tags: { orgId: "org1", serviceId: "svc1", messageId: "msg1" } as never,
      email_id: "re_abc123",
    });

    expect(doc).not.toHaveBeenCalled();
    expect(collectionGroup).toHaveBeenCalledWith("recipients");
    expect(ref).toBe(fallbackRef);
  });
});

describe("recordBounce (60-02 idempotent transition-guarded write)", () => {
  // A recipients/{id} + its messages/{id} parent, seeded with a status and a
  // current deliveryCounts.bounced, wired into a runTransaction fake that reads
  // before writing and applies the dot-path count merge.
  function makeRecipientWorld(opts: { status?: string; bounced?: number } = {}) {
    const state = {
      recipient: { status: opts.status ?? "sent" } as Record<string, unknown>,
      message: {
        deliveryCounts: { sent: 1, failed: 0, bounced: opts.bounced ?? 0 },
      } as { deliveryCounts: { sent: number; failed: number; bounced: number } },
    };
    const messageRef = { id: "msg1", __kind: "message" };
    const recipientRef = { id: "rec1", __kind: "recipient", parent: { parent: messageRef } };
    const updates: Array<{ ref: unknown; patch: Record<string, unknown> }> = [];
    const getSpy = vi.fn();
    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      let recipientReadAt = -1;
      let messageReadAt = -1;
      let firstWriteAt = -1;
      let step = 0;
      const tx = {
        get: vi.fn(async (ref: unknown) => {
          getSpy(ref);
          const at = step++;
          if (ref === recipientRef) {
            recipientReadAt = at;
            return { exists: true, data: () => state.recipient };
          }
          if (ref === messageRef) {
            messageReadAt = at;
            return { exists: true, data: () => state.message };
          }
          throw new Error("recordBounce fake: unexpected tx.get ref");
        }),
        update: vi.fn((ref: unknown, patch: Record<string, unknown>) => {
          if (firstWriteAt === -1) firstWriteAt = step++;
          else step++;
          updates.push({ ref, patch });
          if (ref === recipientRef) Object.assign(state.recipient, patch);
          if (ref === messageRef && "deliveryCounts.bounced" in patch) {
            state.message.deliveryCounts.bounced = patch["deliveryCounts.bounced"] as number;
          }
        }),
      };
      const result = await fn(tx);
      // Expose read/write ordering for the "all reads before writes" assertion.
      (runTransaction as unknown as { lastOrdering?: unknown }).lastOrdering = {
        recipientReadAt,
        messageReadAt,
        firstWriteAt,
      };
      return result;
    });
    const db = { runTransaction };
    return { db, recipientRef, messageRef, state, updates, runTransaction };
  }

  it("on a not-yet-bounced recipient: sets status:'bounced' + bounceReason + bouncedAt AND writes deliveryCounts.bounced = prev+1 as a literal, in one transaction", async () => {
    const world = makeRecipientWorld({ status: "sent", bounced: 0 });

    await recordBounce(world.db as never, world.recipientRef as never, {
      type: "Permanent",
      message: "mailbox does not exist",
    });

    expect(world.runTransaction).toHaveBeenCalledTimes(1);
    expect(world.state.recipient.status).toBe("bounced");
    expect(world.state.recipient.bounceReason).toBe("mailbox does not exist");
    expect(world.state.recipient.bouncedAt).toBe("SERVER_TIMESTAMP_SENTINEL");
    expect(world.state.message.deliveryCounts.bounced).toBe(1);
    // The count was written as a literal number (prev+1), not a FieldValue sentinel.
    const messageUpdate = world.updates.find((u) => u.ref === world.messageRef);
    expect(messageUpdate?.patch["deliveryCounts.bounced"]).toBe(1);
  });

  it("preserves the sibling sent/failed counts by writing the dot-path 'deliveryCounts.bounced' (no full-object overwrite)", async () => {
    const world = makeRecipientWorld({ status: "sent", bounced: 0 });

    await recordBounce(world.db as never, world.recipientRef as never, { type: "Permanent" });

    const messageUpdate = world.updates.find((u) => u.ref === world.messageRef);
    expect(Object.keys(messageUpdate!.patch)).toEqual(["deliveryCounts.bounced"]);
    expect(world.state.message.deliveryCounts).toEqual({ sent: 1, failed: 0, bounced: 1 });
  });

  it("derives bounceReason from subType when message is absent, and null when both are absent", async () => {
    const w1 = makeRecipientWorld({ status: "sent" });
    await recordBounce(w1.db as never, w1.recipientRef as never, { type: "Permanent", subType: "General" });
    expect(w1.state.recipient.bounceReason).toBe("General");

    const w2 = makeRecipientWorld({ status: "sent" });
    await recordBounce(w2.db as never, w2.recipientRef as never, { type: "Permanent" });
    expect(w2.state.recipient.bounceReason).toBeNull();
  });

  it("IDEMPOTENT: a second identical delivery finds status already 'bounced' and no-ops — count stays 1 (success criterion 4)", async () => {
    const world = makeRecipientWorld({ status: "sent", bounced: 0 });

    await recordBounce(world.db as never, world.recipientRef as never, { type: "Permanent", message: "hard bounce" });
    await recordBounce(world.db as never, world.recipientRef as never, { type: "Permanent", message: "hard bounce" });

    expect(world.state.recipient.status).toBe("bounced");
    expect(world.state.message.deliveryCounts.bounced).toBe(1);
    // Second transaction ran but performed NO update (guarded by the prior status).
    expect(world.runTransaction).toHaveBeenCalledTimes(2);
    const messageUpdates = world.updates.filter((u) => u.ref === world.messageRef);
    expect(messageUpdates).toHaveLength(1);
  });

  it("reads BOTH the recipient and the message before any write within the transaction", async () => {
    const world = makeRecipientWorld({ status: "sent", bounced: 0 });

    await recordBounce(world.db as never, world.recipientRef as never, { type: "Permanent" });

    const ordering = (world.runTransaction as unknown as {
      lastOrdering: { recipientReadAt: number; messageReadAt: number; firstWriteAt: number };
    }).lastOrdering;
    expect(ordering.recipientReadAt).toBeLessThan(ordering.firstWriteAt);
    expect(ordering.messageReadAt).toBeLessThan(ordering.firstWriteAt);
  });
});

// --- messageWebhookHandler (60-02 verify-first trust boundary) ---------------
//
// The unauthenticated boundary. ORDER CONTRACT: assert Buffer.isBuffer(rawBody)
// (400 otherwise) -> verify the Svix HMAC over the RAW body (401 on any
// missing/tampered/stale signature, with ZERO Firestore access) -> only then
// parse and, only for email.bounced/Permanent, address + recordBounce. A
// valid-but-unprocessable event (soft/Transient, delivered, complaint, unknown
// type, unresolvable recipient) returns 200 with no write — a non-2xx would make
// Resend retry forever. firebase-functions/v2/https is NOT mocked, so the handler
// is called directly with a fake rawBody+headers and no res.

describe("messageWebhookHandler (60-02 verify-first)", () => {
  // A whsec_-prefixed secret whose remainder is real base64 (exercises the
  // base64-decode key path in verifySvixSignature).
  const WEBHOOK_SECRET = "whsec_" + Buffer.from("resend-webhook-signing-key").toString("base64");
  const TAGS = { orgId: "org1", serviceId: "svc1", messageId: "msg1", recipientId: "rec1" };

  function nowSec(): number {
    return Math.floor(Date.now() / 1000);
  }

  // Self-consistent signer: mirrors the verifier's exact steps so the "valid"
  // branch is genuinely valid (research A5), reused from webhookSignature.test.ts.
  function signContent(rawBody: Buffer, id: string, ts: number, secret: string): string {
    const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    return createHmac("sha256", keyBytes)
      .update(`${id}.${ts}.${rawBody.toString("utf8")}`)
      .digest("base64");
  }
  function svixHeadersFor(
    rawBody: Buffer,
    ts: number,
    secret: string,
    id = "msg_evt1",
  ): Record<string, string> {
    return {
      "svix-id": id,
      "svix-timestamp": String(ts),
      "svix-signature": `v1,${signContent(rawBody, id, ts, secret)}`,
    };
  }

  function bouncedEvent(overrides: {
    type?: string;
    bounceType?: string;
    tags?: Record<string, string> | undefined;
    email_id?: string;
    bounceMessage?: string;
  } = {}) {
    return {
      type: overrides.type ?? "email.bounced",
      data: {
        email_id: overrides.email_id ?? "re_abc123",
        ...(overrides.tags === undefined ? { tags: TAGS } : overrides.tags ? { tags: overrides.tags } : {}),
        bounce: { type: overrides.bounceType ?? "Permanent", message: overrides.bounceMessage ?? "mailbox full" },
      },
    };
  }

  // A getFirestore fake wiring the tags-direct doc() to a seeded recipient/message
  // world (so the end-to-end recordBounce path is exercised through the handler).
  function makeWebhookFirestore(opts: { recipientStatus?: string; bounced?: number } = {}) {
    const state = {
      recipient: { status: opts.recipientStatus ?? "sent" } as Record<string, unknown>,
      message: { deliveryCounts: { sent: 1, failed: 0, bounced: opts.bounced ?? 0 } } as {
        deliveryCounts: { sent: number; failed: number; bounced: number };
      },
    };
    const messageRef = { id: "msg1" };
    const recipientRef = { id: "rec1", parent: { parent: messageRef } };
    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async (ref: unknown) => {
          if (ref === recipientRef) return { exists: true, data: () => state.recipient };
          if (ref === messageRef) return { exists: true, data: () => state.message };
          throw new Error("webhook fake: unexpected tx.get ref");
        }),
        update: vi.fn((ref: unknown, patch: Record<string, unknown>) => {
          if (ref === recipientRef) Object.assign(state.recipient, patch);
          if (ref === messageRef && "deliveryCounts.bounced" in patch) {
            state.message.deliveryCounts.bounced = patch["deliveryCounts.bounced"] as number;
          }
        }),
      };
      return fn(tx);
    });
    const collectionGroupGet = vi.fn(async () => ({ empty: true, docs: [] as unknown[] }));
    const collectionGroup = vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(() => ({ get: collectionGroupGet })) })),
    }));
    const doc = vi.fn(() => recipientRef);
    const db = { doc, collectionGroup, runTransaction };
    return { db, state, runTransaction, collectionGroup };
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
  });

  it("valid signature + email.bounced/Permanent -> 200 and drives recordBounce (recipient flips to bounced, deliveryCounts.bounced == 1)", async () => {
    const { db, state } = makeWebhookFirestore({ recipientStatus: "sent", bounced: 0 });
    vi.mocked(getFirestore).mockReturnValue(db as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent()));
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(200);
    expect(state.recipient.status).toBe("bounced");
    expect(state.message.deliveryCounts.bounced).toBe(1);
  });

  it("TRUST BOUNDARY: no svix headers -> 401 and ZERO Firestore access (getFirestore NEVER called)", async () => {
    vi.mocked(getFirestore).mockReturnValue({} as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent()));

    const out = await messageWebhookHandler(rawBody, {}, WEBHOOK_SECRET);

    expect(out.status).toBe(401);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("TRUST BOUNDARY: body tampered after signing -> 401 + zero Firestore access", async () => {
    vi.mocked(getFirestore).mockReturnValue({} as never);
    const signedBody = Buffer.from(JSON.stringify(bouncedEvent()));
    const headers = svixHeadersFor(signedBody, nowSec(), WEBHOOK_SECRET);
    const tamperedBody = Buffer.from(JSON.stringify(bouncedEvent({ bounceMessage: "tampered" })));

    const out = await messageWebhookHandler(tamperedBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(401);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("TRUST BOUNDARY: stale svix-timestamp (outside +/-5 min) -> 401 + zero Firestore access", async () => {
    vi.mocked(getFirestore).mockReturnValue({} as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent()));
    const staleTs = nowSec() - 3600; // 1 hour old
    const headers = svixHeadersFor(rawBody, staleTs, WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(401);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("wrong secret -> 401 + zero Firestore access", async () => {
    vi.mocked(getFirestore).mockReturnValue({} as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent()));
    const headers = svixHeadersFor(rawBody, nowSec(), "whsec_" + Buffer.from("attacker-key").toString("base64"));

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(401);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("non-Buffer body -> 400 (malformed) + zero Firestore access", async () => {
    vi.mocked(getFirestore).mockReturnValue({} as never);

    const out = await messageWebhookHandler(
      "not a buffer" as unknown as Buffer,
      {},
      WEBHOOK_SECRET,
    );

    expect(out.status).toBe(400);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("valid signature but non-JSON body -> 400 (malformed json), parsed only AFTER the signature passes, no Firestore write", async () => {
    vi.mocked(getFirestore).mockReturnValue({} as never);
    const rawBody = Buffer.from("this is not json{");
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(400);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it("valid signature, soft bounce (Transient) -> 200 with NO recipient write and NO count change", async () => {
    const { db, state, runTransaction } = makeWebhookFirestore({ recipientStatus: "sent", bounced: 0 });
    vi.mocked(getFirestore).mockReturnValue(db as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent({ bounceType: "Transient" })));
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(200);
    expect(state.recipient.status).toBe("sent");
    expect(state.message.deliveryCounts.bounced).toBe(0);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("valid signature, email.delivered -> 200, no write", async () => {
    const { db, runTransaction } = makeWebhookFirestore();
    vi.mocked(getFirestore).mockReturnValue(db as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent({ type: "email.delivered" })));
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(200);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("valid signature, unknown event type -> 200, no write", async () => {
    const { db, runTransaction } = makeWebhookFirestore();
    vi.mocked(getFirestore).mockReturnValue(db as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent({ type: "email.opened" })));
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(200);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("valid hard bounce but recipient cannot be resolved -> 200 (never 4xx/5xx, no retry storm), no transaction", async () => {
    // No tags and an email_id whose collectionGroup fallback matches nothing.
    const { db, runTransaction } = makeWebhookFirestore();
    vi.mocked(getFirestore).mockReturnValue(db as never);
    const event = bouncedEvent({ tags: undefined, email_id: "re_missing" });
    const rawBody = Buffer.from(JSON.stringify(event));
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const out = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(out.status).toBe(200);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it("IDEMPOTENT end-to-end: two identical valid deliveries -> recipient bounced once, deliveryCounts.bounced == 1", async () => {
    const { db, state } = makeWebhookFirestore({ recipientStatus: "sent", bounced: 0 });
    vi.mocked(getFirestore).mockReturnValue(db as never);
    const rawBody = Buffer.from(JSON.stringify(bouncedEvent()));
    const headers = svixHeadersFor(rawBody, nowSec(), WEBHOOK_SECRET);

    const first = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);
    const second = await messageWebhookHandler(rawBody, headers, WEBHOOK_SECRET);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(state.recipient.status).toBe("bounced");
    expect(state.message.deliveryCounts.bounced).toBe(1);
  });

  it("SOURCE INSPECTION: RESEND_WEBHOOK_SECRET is bound to EXACTLY ONE Function, and it is messageWebhook", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    // The secret binds via `secrets: [RESEND_WEBHOOK_SECRET]` exactly once.
    const bindings = source.match(/secrets:\s*\[RESEND_WEBHOOK_SECRET\]/g) ?? [];
    expect(bindings).toHaveLength(1);
    // And that single binding lives inside the messageWebhook wrapper.
    const wrapperStart = source.indexOf("export const messageWebhook = onRequest(");
    expect(wrapperStart).toBeGreaterThan(-1);
    const wrapperRegion = source.slice(wrapperStart, wrapperStart + 400);
    expect(wrapperRegion).toMatch(/secrets:\s*\[RESEND_WEBHOOK_SECRET\]/);
  });
});
