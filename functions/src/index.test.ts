import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  buildUpstreamUrl,
  cleanupExpiredMediaHandler,
  cleanupOrphanRendersHandler,
  cleanupOrphanBackgroundsHandler,
  cleanupPptxSourcesHandler,
  BACKGROUND_PATH_GUARD,
  BACKGROUND_RETENTION_DAYS,
  extractBackgroundObjectPath,
  PPTX_SOURCE_GUARD,
  PPTX_SOURCE_RETENTION_DAYS,
  sourcePrefixFor,
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
  todayInTimeZone,
  minusDays,
  sendScheduledRemindersHandler,
  dispatchDueScheduledMessagesHandler,
  runScheduledMessagingCron,
  readAiProxyLimits,
  readNumericKnob,
  resolveOrgId,
  verifyAppCaller,
  enforceModelAndTokens,
  checkAndConsumeRateLimit,
  checkAndConsumeOrgEmailQuota,
  buildUsageEntry,
  writeUsageLedger,
  api,
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
let fakeMessageFromAddress = "onboarding@resend.dev";
// The email getAuth().getUser(uid) resolves to for sendCopyToSelf.
let fakeEditorEmail = "editor@example.com";

// The mocked Resend .emails.send — hoisted so the vi.mock("resend") factory can
// close over it. No real email is ever sent (59-03 ships against a mocked
// provider; the real RESEND_API_KEY is never set in tests).
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));
// R172: setGlobalOptions is called at index.ts MODULE-SCOPE (once, at import
// time), so this spy must be hoisted and wired in BEFORE `./index` is
// imported below -- there is no other seam to observe that call.
const { setGlobalOptionsSpy } = vi.hoisted(() => ({ setGlobalOptionsSpy: vi.fn() }));

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
// R172: only setGlobalOptions is mocked (a spy) -- the module-scope call in
// index.ts is the ONLY thing under test here; every other v2 builder
// (onRequest/onCall/onSchedule) is left real because they're pure
// declarative wrappers with no side effect requiring network/credentials.
vi.mock("firebase-functions/v2/options", () => ({
  setGlobalOptions: setGlobalOptionsSpy,
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
  metadata: { timeCreated: string; size: number };
  delete: ReturnType<typeof vi.fn>;
}

// sizeBytes defaults to a fixed value so every pre-existing call site (which
// never passes a third arg) keeps working unchanged -- only the new 66-01
// byte-observability tests below need to pass an explicit, known size.
function fakeFile(name: string, ageDays: number, sizeBytes = 1000): FakeFile {
  return {
    name,
    metadata: { timeCreated: daysAgoIso(ageDays), size: sizeBytes },
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
    delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
  });

  it("deletes a media file older than the retention window when explicitly enabled", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ deletedObjectCount: 1, dryRun: false });
  });

  it("FAILS SAFE: deletes nothing when MEDIA_CLEANUP_ENABLED is unset, even for an expired file", async () => {
    // Regression guard for the 22-03 defect: the gate used to be
    // `MEDIA_CLEANUP_DRY_RUN === "true"`, so an unset env var meant LIVE
    // deletion on a daily schedule. Unset must mean dry-run.
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedObjectCount: 1, scannedCount: 1 });
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

  it('FAILS SAFE: an empty-string MEDIA_CLEANUP_ENABLED behaves identically to unset', async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it('FAILS SAFE: a case-typo value ("True") does not enable deletion -- the comparison is exact and case-sensitive', async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "True";
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
  });

  it("R165: deletes exactly the guarded+aged set -- an aged pptx-imports file and a recent media file both survive alongside an aged media file", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const agedMedia = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6);
    const agedPptx = fakeFile("orgs/orgA/pptx-imports/i1/deck.pptx", RETENTION_DAYS + 6);
    const recentMedia = fakeFile("orgs/orgA/media/m2/new.mp3", 3);
    mockBucket([agedMedia, agedPptx, recentMedia]);

    const summary = await cleanupExpiredMediaHandler();

    expect(agedMedia.delete).toHaveBeenCalledTimes(1);
    expect(agedPptx.delete).not.toHaveBeenCalled();
    expect(recentMedia.delete).not.toHaveBeenCalled();
    expect(summary.deletedObjectCount).toBe(1);
  });

  it("R165/T-66-01-04: reports deletedBytes for a LIVE delete, and dry-run reports the same would-delete byte total", async () => {
    const KNOWN_SIZE = 54321;
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", RETENTION_DAYS + 6, KNOWN_SIZE);
    mockBucket([old]);

    const dryRunSummary = await cleanupExpiredMediaHandler();
    expect(dryRunSummary).toMatchObject({ dryRun: true, deletedBytes: KNOWN_SIZE });

    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const liveSummary = await cleanupExpiredMediaHandler();
    expect(old.delete).toHaveBeenCalledTimes(1);
    expect(liveSummary).toMatchObject({ dryRun: false, deletedBytes: KNOWN_SIZE });
  });

  it("T-66-01-02: a per-run delete cap bounds a LIVE run -- exactly one delete() call, cappedByLimit=true, deletedObjectCount=1", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    const old1 = fakeFile("orgs/orgA/media/m1/old1.mp4", RETENTION_DAYS + 6);
    const old2 = fakeFile("orgs/orgA/media/m2/old2.mp4", RETENTION_DAYS + 6);
    mockBucket([old1, old2]);

    const summary = await cleanupExpiredMediaHandler();

    const totalDeleteCalls =
      (old1.delete as ReturnType<typeof vi.fn>).mock.calls.length +
      (old2.delete as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(totalDeleteCalls).toBe(1);
    expect(summary).toMatchObject({ deletedObjectCount: 1, cappedByLimit: true, dryRun: false });

    delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
  });

  it("T-66-01-02: the delete cap does NOT truncate a dry-run -- the full would-delete count is still reported", async () => {
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    const old1 = fakeFile("orgs/orgA/media/m1/old1.mp4", RETENTION_DAYS + 6);
    const old2 = fakeFile("orgs/orgA/media/m2/old2.mp4", RETENTION_DAYS + 6);
    mockBucket([old1, old2]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old1.delete).not.toHaveBeenCalled();
    expect(old2.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedObjectCount: 2, cappedByLimit: false });

    delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
  });

  it("does not delete a recent media file", async () => {
    process.env.MEDIA_CLEANUP_ENABLED = "true";
    const recent = fakeFile("orgs/orgA/media/m2/new.mp3", 3);
    mockBucket([recent]);

    const summary = await cleanupExpiredMediaHandler();

    expect(recent.delete).not.toHaveBeenCalled();
    expect(summary.deletedObjectCount).toBe(0);
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

  it("dry-run mode counts/logs an old media file but calls no delete, and reports deletedObjectCount via the dry-run count", async () => {
    const old = fakeFile("orgs/orgA/media/m1/old.mp4", 20);
    mockBucket([old]);

    const summary = await cleanupExpiredMediaHandler();

    expect(old.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedObjectCount: 1, scannedCount: 1 });
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
    expect(firstRun.deletedObjectCount).toBe(1);

    // Second run: simulate the deleted file no longer present in the bucket
    // listing (as a real bucket would report after a successful delete).
    getFiles.mockResolvedValueOnce([[recent]]);
    const secondRun = await cleanupExpiredMediaHandler();

    expect(recent.delete).not.toHaveBeenCalled();
    expect(secondRun.deletedObjectCount).toBe(0);
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
    metadata: { size: number };
    delete: ReturnType<typeof vi.fn>;
  }

  // sizeBytes defaults to a fixed value so every pre-existing call site
  // (which never passes a second arg) keeps working unchanged -- only the
  // new 66-01 byte-observability/cap tests below pass an explicit size.
  function fakeRenderedObject(name: string, sizeBytes = 1000): FakeRenderedObject {
    return { name, metadata: { size: sizeBytes }, delete: vi.fn(async () => undefined) };
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
    delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
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

  it("R166/T-66-01-04: reports deletedBytes for a LIVE run summing known rendered-object sizes, and dry-run reports the same total", async () => {
    const SIZE_1 = 11111;
    const SIZE_2 = 22222;
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(
      `orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`,
      SIZE_1,
    );
    const obj2 = fakeRenderedObject(
      `orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0002.png`,
      SIZE_2,
    );
    mockOrphanBucket([obj1, obj2]);

    const dryRunSummary = await cleanupOrphanRendersHandler();
    expect(dryRunSummary).toMatchObject({ dryRun: true, deletedBytes: SIZE_1 + SIZE_2 });

    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    const liveSummary = await cleanupOrphanRendersHandler();
    expect(obj1.delete).toHaveBeenCalledTimes(1);
    expect(obj2.delete).toHaveBeenCalledTimes(1);
    expect(liveSummary).toMatchObject({ dryRun: false, deletedBytes: SIZE_1 + SIZE_2 });
  });

  it("T-66-01-02: a per-run delete cap bounds a LIVE run within a single doc -- exactly one object delete() call, cappedByLimit=true, the doc itself is not removed", async () => {
    process.env.PPTX_RENDER_CLEANUP_ENABLED = "true";
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    const obj2 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0002.png`);
    mockOrphanBucket([obj1, obj2]);

    const summary = await cleanupOrphanRendersHandler();

    const totalDeleteCalls =
      (obj1.delete as ReturnType<typeof vi.fn>).mock.calls.length +
      (obj2.delete as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(totalDeleteCalls).toBe(1);
    expect(stale.ref.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      dryRun: false,
      deletedObjectCount: 1,
      deletedDocCount: 0,
      cappedByLimit: true,
    });
  });

  it("T-66-01-02: the delete cap does NOT truncate a dry-run -- the full would-delete object count is still reported", async () => {
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    const stale = fakeOrphanDoc({ status: "failed", ageHours: STALE_HOURS });
    mockOrphanDb([stale]);
    const obj1 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    const obj2 = fakeRenderedObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0002.png`);
    mockOrphanBucket([obj1, obj2]);

    const summary = await cleanupOrphanRendersHandler();

    expect(obj1.delete).not.toHaveBeenCalled();
    expect(obj2.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      dryRun: true,
      deletedObjectCount: 2,
      deletedDocCount: 1,
      cappedByLimit: false,
    });
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

describe("BACKGROUND_PATH_GUARD", () => {
  it("matches background objects under orgs/{orgId}/backgrounds/", () => {
    expect(BACKGROUND_PATH_GUARD.test("orgs/orgA/backgrounds/bg1/file.png")).toBe(true);
  });

  it("does not match media/ or pptx-imports/ or other non-background paths", () => {
    expect(BACKGROUND_PATH_GUARD.test("orgs/orgA/media/m1/old.mp4")).toBe(false);
    expect(BACKGROUND_PATH_GUARD.test("orgs/orgA/pptx-imports/i1/source.pptx")).toBe(false);
    expect(BACKGROUND_PATH_GUARD.test("some/other/path.txt")).toBe(false);
  });
});

describe("extractBackgroundObjectPath", () => {
  it("recovers the decoded object path from a Firebase download URL", () => {
    const objectPath = "orgs/orgA/backgrounds/bg1/my file.png";
    const url = `https://firebasestorage.googleapis.com/v0/b/test.appspot.com/o/${encodeURIComponent(objectPath)}?alt=media&token=abc123`;
    expect(extractBackgroundObjectPath(url)).toBe(objectPath);
  });

  it("returns null for a URL with no /o/{path} segment", () => {
    expect(extractBackgroundObjectPath("https://example.com/not-a-storage-url")).toBeNull();
  });

  it("returns null for a malformed percent-encoding that fails to decode", () => {
    expect(extractBackgroundObjectPath("https://x/o/%E0%A4%A?alt=media")).toBeNull();
  });
});

describe("PPTX_SOURCE_GUARD", () => {
  it("matches source.pptx and images/ under a pptx-imports scope", () => {
    expect(PPTX_SOURCE_GUARD.test("orgs/orgA/pptx-imports/i1/source.pptx")).toBe(true);
    expect(PPTX_SOURCE_GUARD.test("orgs/orgA/pptx-imports/i1/images/0.png")).toBe(true);
  });

  it("NEVER matches rendered/ -- structurally excluded, not by exception list", () => {
    expect(PPTX_SOURCE_GUARD.test("orgs/orgA/pptx-imports/i1/rendered/page-0001.png")).toBe(
      false,
    );
  });

  it("does not match other non-source paths", () => {
    expect(PPTX_SOURCE_GUARD.test("orgs/orgA/media/m1/old.mp4")).toBe(false);
    expect(PPTX_SOURCE_GUARD.test("orgs/orgA/pptx-imports/i1/other.txt")).toBe(false);
  });
});

describe("cleanupOrphanBackgroundsHandler", () => {
  const ORG_ID = "orgA";
  const STALE_DAYS = BACKGROUND_RETENTION_DAYS + 60; // comfortably past the retention window

  function downloadUrlFor(objectPath: string): string {
    return `https://firebasestorage.googleapis.com/v0/b/test.appspot.com/o/${encodeURIComponent(objectPath)}?alt=media&token=abc123`;
  }

  interface FakeBackgroundFile {
    name: string;
    metadata: { timeCreated?: string; size: number };
    delete: ReturnType<typeof vi.fn>;
  }

  // ageDays omitted simulates an unreadable/missing timeCreated.
  function fakeBackgroundFile(
    name: string,
    ageDays?: number,
    sizeBytes = 1000,
  ): FakeBackgroundFile {
    return {
      name,
      metadata: {
        timeCreated: ageDays === undefined ? undefined : daysAgoIso(ageDays),
        size: sizeBytes,
      },
      delete: vi.fn(async () => undefined),
    };
  }

  function mockBackgroundBucket(files: FakeBackgroundFile[]) {
    const getFiles = vi.fn(async () => [files]);
    vi.mocked(getStorage).mockReturnValue({
      bucket: () => ({ getFiles }),
    } as never);
    return { getFiles };
  }

  interface MockBackgroundDbOptions {
    slideGroups?: Array<{ data: () => unknown }>;
    lyrics?: Array<{ data: () => unknown }>;
    slideGroupsThrows?: boolean;
    lyricsThrows?: boolean;
  }

  function mockBackgroundDb(opts: MockBackgroundDbOptions = {}) {
    const collectionGroupSpy = vi.fn((name: string) => {
      if (name === "slideGroups") {
        return {
          get: vi.fn(async () => {
            if (opts.slideGroupsThrows) {
              throw new Error("slideGroups scan failed");
            }
            return { docs: opts.slideGroups ?? [] };
          }),
        };
      }
      if (name === "lyrics") {
        return {
          get: vi.fn(async () => {
            if (opts.lyricsThrows) {
              throw new Error("lyrics scan failed");
            }
            return { docs: opts.lyrics ?? [] };
          }),
        };
      }
      throw new Error(`mockBackgroundDb: unexpected collectionGroup "${name}"`);
    });
    vi.mocked(getFirestore).mockReturnValue({ collectionGroup: collectionGroupSpy } as never);
    return { collectionGroupSpy };
  }

  function slideGroupDoc(opts: {
    backgroundImageUrl?: string;
    slides?: Array<{ backgroundImageUrl?: string }>;
  }) {
    return { data: () => ({ backgroundImageUrl: opts.backgroundImageUrl, slides: opts.slides }) };
  }

  function lyricsDoc(opts: { backgroundImageUrl?: string }) {
    return { data: () => ({ backgroundImageUrl: opts.backgroundImageUrl }) };
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
    vi.mocked(getStorage).mockReset();
    delete process.env.BACKGROUND_CLEANUP_ENABLED;
    delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
  });

  it("R167: deletes an aged unreferenced background when explicitly enabled, and never deletes an aged background referenced at the GROUP tier in the same run", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    const referencedPath = `orgs/${ORG_ID}/backgrounds/bg-ref/keep.png`;
    mockBackgroundDb({
      slideGroups: [slideGroupDoc({ backgroundImageUrl: downloadUrlFor(referencedPath) })],
    });
    const orphan = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg-orphan/delete-me.png`, STALE_DAYS);
    const referenced = fakeBackgroundFile(referencedPath, STALE_DAYS);
    mockBackgroundBucket([orphan, referenced]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(orphan.delete).toHaveBeenCalledTimes(1);
    expect(referenced.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      dryRun: false,
      deletedObjectCount: 1,
      orphanCount: 1,
      referencesComplete: true,
    });
  });

  it("NEVER deletes a background referenced at the SLIDE tier (embedded slides[] array entry, not the group field)", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    const referencedPath = `orgs/${ORG_ID}/backgrounds/bg-slide/keep.png`;
    mockBackgroundDb({
      slideGroups: [
        slideGroupDoc({
          backgroundImageUrl: undefined,
          slides: [{ backgroundImageUrl: downloadUrlFor(referencedPath) }],
        }),
      ],
    });
    const referenced = fakeBackgroundFile(referencedPath, STALE_DAYS);
    mockBackgroundBucket([referenced]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(referenced.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: false, deletedObjectCount: 0, referencesComplete: true });
  });

  it("NEVER deletes a background referenced at the SONG (lyrics) tier", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    const referencedPath = `orgs/${ORG_ID}/backgrounds/bg-song/keep.png`;
    mockBackgroundDb({
      lyrics: [lyricsDoc({ backgroundImageUrl: downloadUrlFor(referencedPath) })],
    });
    const referenced = fakeBackgroundFile(referencedPath, STALE_DAYS);
    mockBackgroundBucket([referenced]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(referenced.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: false, deletedObjectCount: 0, referencesComplete: true });
  });

  it("path guard: an aged object under orgs/{orgId}/media/ or .../pptx-imports/ is never considered, even when enabled", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    mockBackgroundDb({});
    const mediaFile = fakeBackgroundFile(`orgs/${ORG_ID}/media/m1/old.mp4`, STALE_DAYS);
    const pptxFile = fakeBackgroundFile(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`, STALE_DAYS);
    mockBackgroundBucket([mediaFile, pptxFile]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(mediaFile.delete).not.toHaveBeenCalled();
    expect(pptxFile.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ scannedCount: 0, deletedObjectCount: 0 });
  });

  it("REFERENCES-INCOMPLETE FAIL-SAFE: an unparseable backgroundImageUrl forces the whole run to dry-run, even with the flag enabled", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    mockBackgroundDb({
      slideGroups: [slideGroupDoc({ backgroundImageUrl: "https://example.com/not-a-storage-url" })],
    });
    const orphan = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg-orphan/delete-me.png`, STALE_DAYS);
    mockBackgroundBucket([orphan]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(orphan.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, referencesComplete: false });
  });

  it("REFERENCES-INCOMPLETE FAIL-SAFE: a collectionGroup scan throwing forces the whole run to dry-run", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    mockBackgroundDb({
      slideGroups: [slideGroupDoc({ backgroundImageUrl: downloadUrlFor("orgs/orgA/backgrounds/x/y.png") })],
      lyricsThrows: true,
    });
    const orphan = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg-orphan/delete-me.png`, STALE_DAYS);
    mockBackgroundBucket([orphan]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(orphan.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, referencesComplete: false });
  });

  it("REFERENCES-INCOMPLETE FAIL-SAFE: a slideGroups doc with a non-array slides field forces the whole run to dry-run", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    mockBackgroundDb({
      slideGroups: [
        // `slides` present but not an array -- a corrupted/malformed write.
        // Cannot prove no reference exists inside it, so this must NOT be
        // treated the same as "no slides".
        { data: () => ({ backgroundImageUrl: undefined, slides: "not-an-array" }) },
      ],
    });
    const orphan = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg-orphan/delete-me.png`, STALE_DAYS);
    mockBackgroundBucket([orphan]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(orphan.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedObjectCount: 0, referencesComplete: false });
  });

  it("FLOOR GUARD: zero total references found anywhere, yet candidate backgrounds exist -- treats references as incomplete and deletes nothing", async () => {
    // Both collectionGroup scans succeed (no throw, no unparseable URL) but
    // return zero docs -- a silent-empty result, not an error. This must be
    // just as unsafe as a throw or a parse failure: never delete every
    // background because a scan came back empty.
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    mockBackgroundDb({}); // no slideGroups docs, no lyrics docs at all
    const candidate = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg1/maybe-orphan.png`, STALE_DAYS);
    mockBackgroundBucket([candidate]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(candidate.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      dryRun: true,
      deletedObjectCount: 0,
      referencesComplete: false,
    });
  });

  it("does NOT trip the floor guard when there truly are no candidate backgrounds at all (zero references, zero candidates is not suspicious)", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    mockBackgroundDb({});
    mockBackgroundBucket([]); // no background objects exist yet -- not an anomaly

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(summary).toMatchObject({
      dryRun: false,
      referencesComplete: true,
      scannedCount: 0,
      deletedObjectCount: 0,
    });
  });

  it("an unreadable/missing timeCreated is skipped even with the gate enabled -- fail safe", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    // A dummy reference elsewhere keeps the floor guard from being the
    // reason nothing is deleted -- isolates the assertion to the NaN path.
    mockBackgroundDb({
      slideGroups: [
        slideGroupDoc({ backgroundImageUrl: downloadUrlFor(`orgs/${ORG_ID}/backgrounds/other/keep.png`) }),
      ],
    });
    const unreadable = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg1/unreadable.png`); // no ageDays
    mockBackgroundBucket([unreadable]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(unreadable.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ orphanCount: 0, deletedObjectCount: 0 });
  });

  it("FAILS SAFE: unset/empty/false/1/True all leave dryRun=true and delete nothing", async () => {
    for (const value of [undefined, "", "false", "1", "True"]) {
      if (value === undefined) {
        delete process.env.BACKGROUND_CLEANUP_ENABLED;
      } else {
        process.env.BACKGROUND_CLEANUP_ENABLED = value;
      }
      mockBackgroundDb({
        slideGroups: [
          slideGroupDoc({ backgroundImageUrl: downloadUrlFor(`orgs/${ORG_ID}/backgrounds/other/keep.png`) }),
        ],
      });
      const candidate = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg1/maybe.png`, STALE_DAYS);
      mockBackgroundBucket([candidate]);

      const summary = await cleanupOrphanBackgroundsHandler();

      expect(candidate.delete).not.toHaveBeenCalled();
      expect(summary.dryRun).toBe(true);
    }
  });

  it("T-66-02-04: a per-run delete cap bounds a LIVE run -- exactly one delete() call, cappedByLimit=true", async () => {
    process.env.BACKGROUND_CLEANUP_ENABLED = "true";
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    mockBackgroundDb({
      slideGroups: [
        slideGroupDoc({ backgroundImageUrl: downloadUrlFor(`orgs/${ORG_ID}/backgrounds/other/keep.png`) }),
      ],
    });
    const orphan1 = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg1/one.png`, STALE_DAYS);
    const orphan2 = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg2/two.png`, STALE_DAYS);
    mockBackgroundBucket([orphan1, orphan2]);

    const summary = await cleanupOrphanBackgroundsHandler();

    const totalDeleteCalls =
      (orphan1.delete as ReturnType<typeof vi.fn>).mock.calls.length +
      (orphan2.delete as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(totalDeleteCalls).toBe(1);
    expect(summary).toMatchObject({ dryRun: false, deletedObjectCount: 1, cappedByLimit: true });
  });

  it("the delete cap does NOT truncate a dry-run -- would-delete bytes/count reported in full", async () => {
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    mockBackgroundDb({
      slideGroups: [
        slideGroupDoc({ backgroundImageUrl: downloadUrlFor(`orgs/${ORG_ID}/backgrounds/other/keep.png`) }),
      ],
    });
    const orphan1 = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg1/one.png`, 90, 1234);
    const orphan2 = fakeBackgroundFile(`orgs/${ORG_ID}/backgrounds/bg2/two.png`, 90, 5678);
    mockBackgroundBucket([orphan1, orphan2]);

    const summary = await cleanupOrphanBackgroundsHandler();

    expect(orphan1.delete).not.toHaveBeenCalled();
    expect(orphan2.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      dryRun: true,
      deletedObjectCount: 0,
      deletedBytes: 1234 + 5678,
      cappedByLimit: false,
    });
  });

  it('★ SOURCE INSPECTION: the dry-run gate direction is pinned (BACKGROUND_CLEANUP_ENABLED)', () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export async function cleanupOrphanBackgroundsHandler(");
    const wrapperStart = source.indexOf("export const cleanupOrphanBackgrounds = onSchedule(");
    expect(start).toBeGreaterThan(-1);
    expect(wrapperStart).toBeGreaterThan(start);
    const handlerBody = source.slice(start, wrapperStart);
    expect(handlerBody).toMatch(
      /const dryRun = process\.env\.BACKGROUND_CLEANUP_ENABLED !== "true";/,
    );
  });
});

describe("cleanupPptxSourcesHandler", () => {
  const ORG_ID = "orgA";
  const STALE_DAYS = PPTX_SOURCE_RETENTION_DAYS + 5; // comfortably past the retention window
  const FRESH_DAYS = 1; // comfortably inside it

  interface FakeSourceRenderDocOptions {
    orgId?: string | null;
    importId?: string;
    status?: "pending" | "failed" | "ready";
    ageDays?: number; // omit to simulate an unreadable/missing createdAt
  }

  function fakeSourceRenderDoc(opts: FakeSourceRenderDocOptions = {}) {
    const orgId = opts.orgId === undefined ? ORG_ID : opts.orgId;
    const importId = opts.importId ?? "i1";
    const status = opts.status ?? "ready";
    const createdAt =
      opts.ageDays === undefined
        ? undefined
        : { toMillis: () => Date.now() - opts.ageDays! * 24 * 60 * 60 * 1000 };
    return {
      id: importId,
      data: () => ({ status, createdAt }),
      ref: {
        parent: { parent: orgId === null ? null : { id: orgId } },
        path: `organizations/${orgId}/pptxRenders/${importId}`,
      },
    };
  }

  function mockPptxSourceDb(allDocs: ReturnType<typeof fakeSourceRenderDoc>[]) {
    const whereSpy = vi.fn((field: string, op: string, values: string[]) => {
      const filtered =
        field === "status" && op === "in"
          ? allDocs.filter((d) => values.includes(d.data().status as string))
          : allDocs;
      return { get: vi.fn(async () => ({ docs: filtered })) };
    });
    const collectionGroupSpy = vi.fn((name: string) => {
      if (name !== "pptxRenders") {
        throw new Error(`mockPptxSourceDb: unexpected collectionGroup "${name}"`);
      }
      return { where: whereSpy };
    });
    vi.mocked(getFirestore).mockReturnValue({ collectionGroup: collectionGroupSpy } as never);
    return { collectionGroupSpy, whereSpy };
  }

  interface FakeSourceObject {
    name: string;
    metadata: { size: number };
    delete: ReturnType<typeof vi.fn>;
  }

  function fakeSourceObject(name: string, sizeBytes = 1000): FakeSourceObject {
    return { name, metadata: { size: sizeBytes }, delete: vi.fn(async () => undefined) };
  }

  function mockSourceBucket(files: FakeSourceObject[]) {
    const getFiles = vi.fn(async () => [files]);
    vi.mocked(getStorage).mockReturnValue({
      bucket: () => ({ getFiles }),
    } as never);
    return { getFiles };
  }

  afterEach(() => {
    vi.mocked(getFirestore).mockReset();
    vi.mocked(getStorage).mockReset();
    delete process.env.PPTX_SOURCE_CLEANUP_ENABLED;
    delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
  });

  it("R168: deletes source.pptx and images/ for a CONSUMED (ready) aged import while KEEPING rendered/", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const ready = fakeSourceRenderDoc({ status: "ready", ageDays: STALE_DAYS });
    mockPptxSourceDb([ready]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    const image = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/images/0.png`);
    const rendered = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    mockSourceBucket([source, image, rendered]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).toHaveBeenCalledTimes(1);
    expect(image.delete).toHaveBeenCalledTimes(1);
    expect(rendered.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: false, deletedObjectCount: 2 });
  });

  it("KEEP rendered/: even a 90-day-old ready import with the flag enabled never has a rendered/ object deleted", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const ready = fakeSourceRenderDoc({ status: "ready", ageDays: 90 });
    mockPptxSourceDb([ready]);
    const rendered1 = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0001.png`);
    const rendered2 = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/rendered/page-0002.png`);
    mockSourceBucket([rendered1, rendered2]);

    const summary = await cleanupPptxSourcesHandler();

    expect(rendered1.delete).not.toHaveBeenCalled();
    expect(rendered2.delete).not.toHaveBeenCalled();
    expect(summary.deletedObjectCount).toBe(0);
  });

  it("prunes source.pptx + images/ for an aged FAILED import too -- rendered/ and doc lifecycle stay owned by cleanupOrphanRenders", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const failed = fakeSourceRenderDoc({ status: "failed", ageDays: STALE_DAYS });
    mockPptxSourceDb([failed]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    const image = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/images/0.png`);
    mockSourceBucket([source, image]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).toHaveBeenCalledTimes(1);
    expect(image.delete).toHaveBeenCalledTimes(1);
    expect(summary.deletedObjectCount).toBe(2);
    // This sweep never deletes the render doc itself -- no delete method was
    // even attached to the fake doc ref, so calling it would throw.
    expect((failed.ref as { delete?: unknown }).delete).toBeUndefined();
  });

  it("never touches a fresh/too-new ready import -- consumption alone is not sufficient, only consumption AND age", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const fresh = fakeSourceRenderDoc({ status: "ready", ageDays: FRESH_DAYS });
    mockPptxSourceDb([fresh]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    mockSourceBucket([source]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
  });

  it("never touches a pending import -- excluded by the status filter itself", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const pending = fakeSourceRenderDoc({ status: "pending", ageDays: STALE_DAYS });
    const { whereSpy } = mockPptxSourceDb([pending]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    mockSourceBucket([source]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
    expect(whereSpy).toHaveBeenCalledWith("status", "in", ["ready", "failed"]);
  });

  it("an unreadable/missing createdAt is skipped even with the gate enabled -- fail safe", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const unreadable = fakeSourceRenderDoc({ status: "ready" }); // ageDays omitted
    mockPptxSourceDb([unreadable]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    mockSourceBucket([source]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
  });

  it("skips a doc whose parent org id is missing from the parent chain", async () => {
    const orphaned = fakeSourceRenderDoc({ status: "ready", ageDays: STALE_DAYS, orgId: null });
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    mockPptxSourceDb([orphaned]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    mockSourceBucket([source]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).not.toHaveBeenCalled();
    expect(summary.scannedCount).toBe(0);
  });

  it("FAILS SAFE: unset/empty/false/1/True all leave dryRun=true and delete nothing", async () => {
    for (const value of [undefined, "", "false", "1", "True"]) {
      if (value === undefined) {
        delete process.env.PPTX_SOURCE_CLEANUP_ENABLED;
      } else {
        process.env.PPTX_SOURCE_CLEANUP_ENABLED = value;
      }
      const ready = fakeSourceRenderDoc({ status: "ready", ageDays: STALE_DAYS });
      mockPptxSourceDb([ready]);
      const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
      mockSourceBucket([source]);

      const summary = await cleanupPptxSourcesHandler();

      expect(source.delete).not.toHaveBeenCalled();
      expect(summary.dryRun).toBe(true);
    }
  });

  it("T-66-02-04: a per-run delete cap bounds a LIVE run -- exactly one object delete() call, cappedByLimit=true", async () => {
    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    const ready = fakeSourceRenderDoc({ status: "ready", ageDays: STALE_DAYS });
    mockPptxSourceDb([ready]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    const image = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/images/0.png`);
    mockSourceBucket([source, image]);

    const summary = await cleanupPptxSourcesHandler();

    const totalDeleteCalls =
      (source.delete as ReturnType<typeof vi.fn>).mock.calls.length +
      (image.delete as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(totalDeleteCalls).toBe(1);
    expect(summary).toMatchObject({ dryRun: false, deletedObjectCount: 1, cappedByLimit: true });
  });

  it("the delete cap does NOT truncate a dry-run -- the full would-delete object count is still reported", async () => {
    process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN = "1";
    const ready = fakeSourceRenderDoc({ status: "ready", ageDays: STALE_DAYS });
    mockPptxSourceDb([ready]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`);
    const image = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/images/0.png`);
    mockSourceBucket([source, image]);

    const summary = await cleanupPptxSourcesHandler();

    expect(source.delete).not.toHaveBeenCalled();
    expect(image.delete).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ dryRun: true, deletedObjectCount: 2, cappedByLimit: false });
  });

  it("reports deletedBytes for a LIVE run summing known object sizes, and dry-run reports the same would-delete total", async () => {
    const SIZE_1 = 33333;
    const SIZE_2 = 44444;
    const ready = fakeSourceRenderDoc({ status: "ready", ageDays: STALE_DAYS });
    mockPptxSourceDb([ready]);
    const source = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/source.pptx`, SIZE_1);
    const image = fakeSourceObject(`orgs/${ORG_ID}/pptx-imports/i1/images/0.png`, SIZE_2);
    mockSourceBucket([source, image]);

    const dryRunSummary = await cleanupPptxSourcesHandler();
    expect(dryRunSummary).toMatchObject({ dryRun: true, deletedBytes: SIZE_1 + SIZE_2 });

    process.env.PPTX_SOURCE_CLEANUP_ENABLED = "true";
    const liveSummary = await cleanupPptxSourcesHandler();
    expect(source.delete).toHaveBeenCalledTimes(1);
    expect(image.delete).toHaveBeenCalledTimes(1);
    expect(liveSummary).toMatchObject({ dryRun: false, deletedBytes: SIZE_1 + SIZE_2 });
  });

  it("sourcePrefixFor builds the per-import prefix mirroring renderedPrefixFor's shape", () => {
    expect(sourcePrefixFor("orgA", "i1")).toBe("orgs/orgA/pptx-imports/i1/");
  });

  it('★ SOURCE INSPECTION: the dry-run gate direction is pinned (PPTX_SOURCE_CLEANUP_ENABLED)', () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export async function cleanupPptxSourcesHandler(");
    const wrapperStart = source.indexOf("export const cleanupPptxSources = onSchedule(");
    expect(start).toBeGreaterThan(-1);
    expect(wrapperStart).toBeGreaterThan(start);
    const handlerBody = source.slice(start, wrapperStart);
    expect(handlerBody).toMatch(
      /const dryRun = process\.env\.PPTX_SOURCE_CLEANUP_ENABLED !== "true";/,
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

  it("persists a provided changeDiff array as the audit trail (relock-notification)", () => {
    const changeDiff = [
      { type: "SONG", description: "Added 'Amazing Grace'", affectedTeams: ["band", "vocals"] },
      { type: "ORDER", description: "Moved sermon before offering", affectedTeams: [] },
    ];
    const doc = createQueuedMessage({ ...BASE_INPUT, changeDiff });
    expect(doc.changeDiff).toEqual(changeDiff);
  });

  it("normalizes an absent changeDiff to null (every other message type is unaffected)", () => {
    const doc = createQueuedMessage(BASE_INPUT);
    expect(doc.changeDiff).toBeNull();
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

  it("enqueues a type:'lock-notification' from an editor with messaging on (R144 send-path plumbing)", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: true });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const result = await queueServiceMessageHandler(
      fakeRequest({ data: { type: "lock-notification" } }),
    );

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "lock-notification", status: "queued" }),
    );
  });

  it("still rejects an unknown type after the enum widened → invalid-argument", async () => {
    const { db, setSpy } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(
        fakeRequest({ data: { type: "nonsense" as unknown as QueueMessageRequest["type"] } }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("still rejects a viewer sending 'lock-notification' → permission-denied (enum widened, auth unchanged)", async () => {
    const { db, setSpy } = fakeDb({ role: "viewer" });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { type: "lock-notification" } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("still rejects 'lock-notification' when the kill-switch is off → failed-precondition (enum widened, kill-switch unchanged)", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: false });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { type: "lock-notification" } })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("enqueues a type:'relock-notification' from an editor with messaging on (R146 send-path plumbing)", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: true });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const result = await queueServiceMessageHandler(
      fakeRequest({ data: { type: "relock-notification" } }),
    );

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "relock-notification", status: "queued" }),
    );
  });

  it("still rejects an unknown type after the relock-notification enum add → invalid-argument", async () => {
    const { db, setSpy } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(
        fakeRequest({ data: { type: "relock-nonsense" as unknown as QueueMessageRequest["type"] } }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("still rejects a viewer sending 'relock-notification' → permission-denied (enum widened, auth unchanged)", async () => {
    const { db, setSpy } = fakeDb({ role: "viewer" });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { type: "relock-notification" } })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("still rejects 'relock-notification' when the kill-switch is off → failed-precondition (enum widened, kill-switch unchanged)", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: false });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await expect(
      queueServiceMessageHandler(fakeRequest({ data: { type: "relock-notification" } })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("threads a changeDiff array into the messages/{id} doc for a relock-notification enqueue (R148 audit trail)", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: true });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const changeDiff = [
      { type: "ROLE", description: "Jane now on drums", affectedTeams: ["band"] },
    ];

    const result = await queueServiceMessageHandler(
      fakeRequest({ data: { type: "relock-notification", changeDiff } }),
    );

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "relock-notification", changeDiff }),
    );
  });

  it("writes changeDiff:null for an ordinary enqueue that provides no changeDiff (unaffected)", async () => {
    const { db, setSpy } = fakeDb();
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await queueServiceMessageHandler(fakeRequest());

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ changeDiff: null }));
  });

  it("does NOT require changeDiff -- a relock-notification without one still enqueues (optional field)", async () => {
    const { db, setSpy } = fakeDb({ role: "editor", messagingEnabled: true });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    const result = await queueServiceMessageHandler(
      fakeRequest({ data: { type: "relock-notification" } }),
    );

    expect(result).toEqual({ messageId: GENERATED_ID });
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ changeDiff: null }));
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

// --- todayInTimeZone / minusDays (61-01 org-local date primitives) ------
//
// Pure helpers consumed by 61-02's reminder cron: todayInTimeZone reckons the
// org-local calendar date so a service near midnight is dated in the org zone,
// not UTC (R133); minusDays subtracts calendar days UTC-pinned so DST never
// drifts the count. No Firestore, no mocks -- pure string/date in, string out.

describe("todayInTimeZone / minusDays", () => {
  it("returns different local dates for two IANA zones on the SAME UTC instant (R133 boundary)", () => {
    // 04:30 UTC is still 2026-08-13 in Chicago (UTC-5 CDT) but already
    // 2026-08-14 in Kiritimati (UTC+14) -- one instant, two calendar days.
    const instant = new Date("2026-08-14T04:30:00Z");
    expect(todayInTimeZone("America/Chicago", instant)).toBe("2026-08-13");
    expect(todayInTimeZone("Pacific/Kiritimati", instant)).toBe("2026-08-14");
    expect(todayInTimeZone("America/Chicago", instant)).not.toBe(
      todayInTimeZone("Pacific/Kiritimati", instant),
    );
  });

  it("formats org-local today as a 10-char 'YYYY-MM-DD' string for any IANA zone", () => {
    const instant = new Date("2026-08-14T04:30:00Z");
    const ymd = todayInTimeZone("Asia/Tokyo", instant);
    expect(ymd).toBe("2026-08-14");
    expect(ymd).toHaveLength(10);
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("minusDays subtracts plain calendar days", () => {
    expect(minusDays("2026-08-14", 7)).toBe("2026-08-07");
  });

  it("minusDays is DST-safe (UTC-pinned, no 23/25h drift across a spring-forward week)", () => {
    // 2026-03-08 is US spring-forward day; subtracting exactly n calendar days
    // must not shift by an hour-based off-by-one.
    expect(minusDays("2026-03-09", 1)).toBe("2026-03-08");
    expect(minusDays("2026-03-15", 7)).toBe("2026-03-08");
  });
});

// --- sendScheduledReminders daily cron (61-02: R145 / R133 / SC3 / SC4) --
//
// The R145 reminder engine: a daily onSchedule cron that auto-enqueues the
// shared service link to everyone assigned N days before a service, reckoned in
// the org's local timezone, exactly once. It mirrors cleanupOrphanRendersHandler
// EXACTLY -- a broad collectionGroup('services').where('status','in',
// ['planned','exported']) scan (NEVER 'draft'), org recovered from the parent
// chain, per-item try/catch, handler exported separately for this unit test,
// offset to its own 04:00 UTC slot. It enqueues via the SHARED createQueuedMessage
// shaper (byte-identical to a human send) and holds NO secret. The two
// load-bearing assertions of the whole reminder feature live here: the org-tz
// date boundary (R133/SC3) and the reminderSentAt idempotency (SC4).
describe("sendScheduledRemindersHandler", () => {
  // 04:30 UTC on 2026-08-14 is still 2026-08-13 in Chicago (UTC-5 CDT) but
  // already 2026-08-14 in Kiritimati (UTC+14) -- one instant, two calendar days.
  // This is the load-bearing timezone boundary the reminder date check stands on.
  const FIXED_NOW = new Date("2026-08-14T04:30:00Z");
  const ORG_CHICAGO = "orgChi"; // today = 2026-08-13
  const ORG_KIRITIMATI = "orgKir"; // today = 2026-08-14
  const CHI_TZ = "America/Chicago";
  const KIR_TZ = "Pacific/Kiritimati";
  // With N=7 and Chicago's today 2026-08-13, a service on 2026-08-20 is due today.
  const CHI_DUE_DATE = "2026-08-20";

  interface FakeServiceMessaging {
    reminderEnabled?: boolean;
    reminderDaysBefore?: number;
    reminderSentAt?: unknown;
  }
  interface FakeServiceOptions {
    orgId?: string | null;
    id?: string;
    status?: "planned" | "exported" | "draft";
    date?: string;
    messaging?: FakeServiceMessaging;
  }

  // A fake collectionGroup("services") doc whose ref.set actually mutates the
  // doc's own messaging state, so a SECOND handler run in the same window sees
  // the reminderSentAt marker the first run wrote (the SC4 no-double-send proof).
  function fakeServiceDoc(opts: FakeServiceOptions = {}) {
    const orgId = opts.orgId === undefined ? ORG_CHICAGO : opts.orgId;
    const id = opts.id ?? "svc1";
    const status = opts.status ?? "planned";
    let messaging: FakeServiceMessaging | undefined = opts.messaging;
    const setSpy = vi.fn(async (data: { messaging?: FakeServiceMessaging }) => {
      // Admin-SDK merge write of the idempotency marker -- reflect it into the
      // doc's own data() so a re-scan in the same window skips it (SC4).
      if (data?.messaging) {
        messaging = { ...(messaging ?? {}), ...data.messaging };
      }
      return undefined;
    });
    return {
      id,
      data: () => ({ status, date: opts.date, messaging }),
      ref: {
        parent: { parent: orgId === null ? null : { id: orgId } },
        path: `organizations/${orgId}/services/${id}`,
        set: setSpy,
      },
    };
  }

  interface FakeOrgOptions {
    enabled?: boolean;
    reminderEnabled?: boolean;
    reminderDaysBefore?: number | undefined;
    timezone?: string;
  }

  function orgData(opts: FakeOrgOptions = {}) {
    const messaging: Record<string, unknown> = {
      enabled: opts.enabled ?? true,
      reminderEnabled: opts.reminderEnabled ?? true,
    };
    // reminderDaysBefore is left ABSENT when explicitly undefined so the
    // handler's `?? 7` default can be exercised.
    if (opts.reminderDaysBefore !== undefined) {
      messaging.reminderDaysBefore = opts.reminderDaysBefore;
    }
    return { settings: { timezone: opts.timezone ?? CHI_TZ, messaging } };
  }

  /**
   * A fake Firestore exposing BOTH the collectionGroup("services") scan chain
   * and the collection("organizations").doc(orgId) org read + the nested
   * services/{id}/messages/{}.set() enqueue path. Every enqueued message doc is
   * captured (with its serviceId) into the returned `enqueued` array; the org
   * .get() spy is created per orgId so a two-zone test can hand each org its own
   * settings. `orgs` maps orgId -> org data (or null to simulate a missing org).
   */
  function mockServicesDb(
    services: ReturnType<typeof fakeServiceDoc>[],
    orgs: Record<string, ReturnType<typeof orgData> | null>,
  ) {
    const enqueued: { serviceId: string; doc: Record<string, unknown> }[] = [];
    const whereSpy = vi.fn((field: string, op: string, values: string[]) => {
      const filtered =
        field === "status" && op === "in"
          ? services.filter((d) => values.includes(d.data().status as string))
          : services;
      return { get: vi.fn(async () => ({ docs: filtered })) };
    });
    const collectionGroupSpy = vi.fn((name: string) => {
      if (name !== "services") {
        throw new Error(`mockServicesDb: unexpected collectionGroup "${name}"`);
      }
      return { where: whereSpy };
    });

    const orgRefCache = new Map<string, unknown>();
    function orgDocRef(orgId: string) {
      const cached = orgRefCache.get(orgId);
      if (cached) return cached;
      const has = Object.prototype.hasOwnProperty.call(orgs, orgId);
      const data = has ? orgs[orgId] : undefined;
      const ref = {
        get: vi.fn(async () => ({
          exists: data !== undefined && data !== null,
          data: () => data,
        })),
        collection: vi.fn((name: string) => {
          if (name !== "services") {
            throw new Error(`mockServicesDb: unexpected org sub-collection "${name}"`);
          }
          return {
            doc: (serviceId: string) => ({
              collection: (mname: string) => {
                if (mname !== "messages") {
                  throw new Error(`mockServicesDb: unexpected messages sub-collection "${mname}"`);
                }
                return {
                  doc: () => ({
                    id: `msg-${enqueued.length}`,
                    set: vi.fn(async (doc: Record<string, unknown>) => {
                      enqueued.push({ serviceId, doc });
                      return undefined;
                    }),
                  }),
                };
              },
            }),
          };
        }),
      };
      orgRefCache.set(orgId, ref);
      return ref;
    }

    const collectionSpy = vi.fn((name: string) => {
      if (name !== "organizations") {
        throw new Error(`mockServicesDb: unexpected collection "${name}"`);
      }
      return { doc: (orgId: string) => orgDocRef(orgId) };
    });

    vi.mocked(getFirestore).mockReturnValue({
      collectionGroup: collectionGroupSpy,
      collection: collectionSpy,
    } as never);
    return { enqueued, whereSpy, collectionGroupSpy, collectionSpy };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(getFirestore).mockReset();
  });

  it("enqueues exactly one type:'reminder' message AND sets reminderSentAt for a due planned service", async () => {
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcDue",
      status: "planned",
      date: CHI_DUE_DATE,
      messaging: {},
    });
    const { enqueued } = mockServicesDb([svc], { [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }) });

    const summary = await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]!.serviceId).toBe("svcDue");
    expect(enqueued[0]!.doc).toMatchObject({
      type: "reminder",
      status: "queued",
      scheduledFor: null,
      requestedByUid: "system",
      recipientSelector: { teams: [], individualPersonIds: [], includeEveryone: true },
      options: { attachServiceLink: true, sendCopyToSelf: false },
    });
    // Idempotency marker written AFTER the enqueue via the Admin-SDK merge write.
    expect(svc.ref.set).toHaveBeenCalledTimes(1);
    expect(svc.ref.set).toHaveBeenCalledWith(
      { messaging: { reminderSentAt: "SERVER_TIMESTAMP_SENTINEL" } },
      { merge: true },
    );
    expect(summary).toMatchObject({ enqueued: 1 });
  });

  it("does not enqueue or mark a service whose reminder is not due today (date - N !== today)", async () => {
    // Chicago today is 2026-08-13; date 2026-08-21 with N=7 is due 2026-08-14, not today.
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcNotDue",
      date: "2026-08-21",
      messaging: {},
    });
    const { enqueued } = mockServicesDb([svc], { [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }) });

    const summary = await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
    expect(svc.ref.set).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ enqueued: 0 });
  });

  it("SC4: a 'draft' service is never returned by the scan -- the where filter excludes it, no reminder", async () => {
    // A draft service that would otherwise be due today. Proven never-returned by
    // the status filter itself (like the orphan 'ready' test), not skipped in-memory.
    const draft = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcDraft",
      status: "draft",
      date: CHI_DUE_DATE,
      messaging: {},
    });
    const due = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcDue",
      status: "planned",
      date: CHI_DUE_DATE,
      messaging: {},
    });
    const { enqueued, whereSpy } = mockServicesDb([draft, due], {
      [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }),
    });

    await sendScheduledRemindersHandler();

    expect(whereSpy).toHaveBeenCalledWith("status", "in", ["planned", "exported"]);
    expect(draft.ref.set).not.toHaveBeenCalled();
    expect(enqueued.map((e) => e.serviceId)).toEqual(["svcDue"]);
  });

  it("skips when the org kill-switch is off (settings.messaging.enabled !== true) -- fail-closed", async () => {
    const svc = fakeServiceDoc({ orgId: ORG_CHICAGO, date: CHI_DUE_DATE, messaging: {} });
    const { enqueued } = mockServicesDb([svc], {
      [ORG_CHICAGO]: orgData({ enabled: false, reminderDaysBefore: 7 }),
    });

    await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
    expect(svc.ref.set).not.toHaveBeenCalled();
  });

  it("fails closed when the org doc is missing entirely", async () => {
    const svc = fakeServiceDoc({ orgId: "orgGone", date: CHI_DUE_DATE, messaging: {} });
    const { enqueued } = mockServicesDb([svc], { orgGone: null });

    await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
    expect(svc.ref.set).not.toHaveBeenCalled();
  });

  it("skips when effectiveReminderEnabled resolves off (service-level reminderEnabled:false overrides on org)", async () => {
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      date: CHI_DUE_DATE,
      messaging: { reminderEnabled: false },
    });
    const { enqueued } = mockServicesDb([svc], {
      [ORG_CHICAGO]: orgData({ reminderEnabled: true, reminderDaysBefore: 7 }),
    });

    await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
    expect(svc.ref.set).not.toHaveBeenCalled();
  });

  it("skips when the org reminder default is off and the service does not override it", async () => {
    const svc = fakeServiceDoc({ orgId: ORG_CHICAGO, date: CHI_DUE_DATE, messaging: {} });
    const { enqueued } = mockServicesDb([svc], {
      [ORG_CHICAGO]: orgData({ reminderEnabled: false, reminderDaysBefore: 7 }),
    });

    await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
  });

  it("effectiveN uses the service-level reminderDaysBefore over the org default", async () => {
    // Service overrides N=3; Chicago today 2026-08-13 -> due date must be 2026-08-16.
    // (With the org default of 7 this same service would NOT be due today.)
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcOverride",
      date: "2026-08-16",
      messaging: { reminderDaysBefore: 3 },
    });
    const { enqueued } = mockServicesDb([svc], { [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }) });

    await sendScheduledRemindersHandler();

    expect(enqueued.map((e) => e.serviceId)).toEqual(["svcOverride"]);
  });

  it("effectiveN falls back to 7 when neither the service nor the org sets reminderDaysBefore", async () => {
    // No N anywhere -> default 7. Chicago today 2026-08-13 -> due date 2026-08-20.
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcDefault7",
      date: CHI_DUE_DATE,
      messaging: {},
    });
    const { enqueued } = mockServicesDb([svc], {
      [ORG_CHICAGO]: orgData({ reminderDaysBefore: undefined }),
    });

    await sendScheduledRemindersHandler();

    expect(enqueued.map((e) => e.serviceId)).toEqual(["svcDefault7"]);
  });

  it("R133/SC3 org-timezone boundary: the SAME instant + SAME service.date fires in Chicago but NOT in Kiritimati", async () => {
    // Both services dated 2026-08-20, N=7. Chicago today (2026-08-13) -> due.
    // Kiritimati today (2026-08-14) -> due date 2026-08-13 != today -> NOT due.
    // One UTC instant, one calendar date, opposite outcomes purely by org zone.
    const chiSvc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "chiSvc",
      date: "2026-08-20",
      messaging: {},
    });
    const kirSvc = fakeServiceDoc({
      orgId: ORG_KIRITIMATI,
      id: "kirSvc",
      date: "2026-08-20",
      messaging: {},
    });
    const { enqueued } = mockServicesDb([chiSvc, kirSvc], {
      [ORG_CHICAGO]: orgData({ timezone: CHI_TZ, reminderDaysBefore: 7 }),
      [ORG_KIRITIMATI]: orgData({ timezone: KIR_TZ, reminderDaysBefore: 7 }),
    });

    await sendScheduledRemindersHandler();

    expect(enqueued.map((e) => e.serviceId)).toEqual(["chiSvc"]);
    expect(chiSvc.ref.set).toHaveBeenCalledTimes(1);
    expect(kirSvc.ref.set).not.toHaveBeenCalled();
  });

  it("mirror boundary: a Kiritimati service dated to be due in ITS zone fires while the Chicago-dated one does not", async () => {
    // Kiritimati today is 2026-08-14; date 2026-08-21 with N=7 is due today there.
    const kirSvc = fakeServiceDoc({
      orgId: ORG_KIRITIMATI,
      id: "kirDue",
      date: "2026-08-21",
      messaging: {},
    });
    const { enqueued } = mockServicesDb([kirSvc], {
      [ORG_KIRITIMATI]: orgData({ timezone: KIR_TZ, reminderDaysBefore: 7 }),
    });

    await sendScheduledRemindersHandler();

    expect(enqueued.map((e) => e.serviceId)).toEqual(["kirDue"]);
  });

  it("SC4: a service whose reminderSentAt is already set enqueues ZERO messages", async () => {
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      date: CHI_DUE_DATE,
      messaging: { reminderSentAt: "SERVER_TIMESTAMP_SENTINEL" },
    });
    const { enqueued } = mockServicesDb([svc], { [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }) });

    await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
    expect(svc.ref.set).not.toHaveBeenCalled();
  });

  it("★ SC4 no-double-send: a SECOND run in the same window against a just-marked service enqueues ZERO new messages", async () => {
    const svc = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcOnce",
      date: CHI_DUE_DATE,
      messaging: {},
    });
    const { enqueued } = mockServicesDb([svc], { [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }) });

    // First run: fires once and writes reminderSentAt (the fake set() mutates data()).
    await sendScheduledRemindersHandler();
    expect(enqueued).toHaveLength(1);
    expect(svc.ref.set).toHaveBeenCalledTimes(1);

    // Second run in the SAME window: the marker is now set -> zero new messages.
    await sendScheduledRemindersHandler();
    expect(enqueued).toHaveLength(1); // still just the one from the first run
    expect(svc.ref.set).toHaveBeenCalledTimes(1);
  });

  it("per-item try/catch: one service that throws (malformed date) is skipped; other candidates still enqueue", async () => {
    const bad = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcBad",
      date: "not-a-real-date", // minusDays() throws RangeError on toISOString of an Invalid Date
      messaging: {},
    });
    const good = fakeServiceDoc({
      orgId: ORG_CHICAGO,
      id: "svcGood",
      date: CHI_DUE_DATE,
      messaging: {},
    });
    const { enqueued } = mockServicesDb([bad, good], {
      [ORG_CHICAGO]: orgData({ reminderDaysBefore: 7 }),
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const summary = await sendScheduledRemindersHandler();

    expect(enqueued.map((e) => e.serviceId)).toEqual(["svcGood"]);
    expect(summary).toMatchObject({ enqueued: 1 });
    errSpy.mockRestore();
  });

  it("skips (never crashes) on a service whose parent chain is missing the org id", async () => {
    const orphan = fakeServiceDoc({ orgId: null, date: CHI_DUE_DATE, messaging: {} });
    const { enqueued } = mockServicesDb([orphan], {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const summary = await sendScheduledRemindersHandler();

    expect(enqueued).toHaveLength(0);
    expect(summary).toMatchObject({ enqueued: 0 });
    errSpy.mockRestore();
  });

  it("★ SOURCE INSPECTION: the scan is planned/exported (never draft), the wrapper is 04:00 UTC, and it holds NO secret", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const start = source.indexOf("export async function sendScheduledRemindersHandler(");
    const wrapperStart = source.indexOf("export const sendScheduledReminders = onSchedule(");
    expect(start).toBeGreaterThan(-1);
    expect(wrapperStart).toBeGreaterThan(start);
    const handlerBody = source.slice(start, wrapperStart);
    // The scan must be status-in planned/exported and must never mention draft.
    expect(handlerBody).toMatch(
      /\.where\(\s*"status",\s*"in",\s*\[\s*"planned",\s*"exported"\s*\]\s*\)/,
    );
    expect(handlerBody).not.toMatch(/"draft"/);
    // The wrapper runs at its own 04:00 UTC slot and carries NO secrets: array
    // (only sendQueuedMessage holds RESEND_API_KEY -- R131 smallest surface).
    const wrapperBody = source.slice(wrapperStart, wrapperStart + 300);
    expect(wrapperBody).toMatch(/schedule:\s*"every day 04:00"/);
    expect(wrapperBody).toMatch(/timeZone:\s*"UTC"/);
    expect(wrapperBody).not.toMatch(/secrets:/);
  });

  // R170: gate the WHOLE cron off by default -- the flag lives at the very
  // top of runScheduledMessagingCron, before either sweep, so a
  // disabled/default cron makes ZERO calls into getFirestore/collectionGroup.
  // Reuses this suite's mockServicesDb (collectionGroup-spy) harness so
  // "zero reads" is proven against the SAME fake Firestore the enqueue tests
  // above use, not a hand-waved assertion.
  describe("runScheduledMessagingCron (R170: gate OFF by default)", () => {
    it("performs ZERO collectionGroup reads when SCHEDULED_MESSAGING_CRON_ENABLED is unset", async () => {
      const { collectionGroupSpy } = mockServicesDb([], {});

      await runScheduledMessagingCron({});

      expect(collectionGroupSpy).not.toHaveBeenCalled();
    });

    it("performs ZERO collectionGroup reads for any value that is not exactly 'true'", async () => {
      const { collectionGroupSpy } = mockServicesDb([], {});

      await runScheduledMessagingCron({ SCHEDULED_MESSAGING_CRON_ENABLED: "False" });

      expect(collectionGroupSpy).not.toHaveBeenCalled();
    });

    it("runs both sweeps (collectionGroup IS invoked) when SCHEDULED_MESSAGING_CRON_ENABLED is exactly 'true'", async () => {
      const { collectionGroupSpy } = mockServicesDb([], {});
      // The dispatch sweep's own collectionGroup('messages') scan is outside
      // this suite's mockServicesDb (which only wires 'services') and throws
      // -- caught by runScheduledMessagingCron's own try/catch, same as
      // production; suppress the expected console.error noise.
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await runScheduledMessagingCron({ SCHEDULED_MESSAGING_CRON_ENABLED: "true" });

      expect(collectionGroupSpy).toHaveBeenCalledWith("services");
      errSpy.mockRestore();
    });
  });
});

// --- dispatchDueScheduledMessagesHandler (61-03: R141 schedule-for-later) ---
//
// The Phase 59 carryover: user-scheduled (status:'scheduled') message docs sit
// inert because sendQueuedMessage is an onDocumentCreated trigger -- a status
// FLIP on the existing doc does NOT re-fire it. This sweep finds due scheduled
// messages via a single-field collectionGroup('messages').where('status','==',
// 'scheduled') scan (NO composite index), code-filters scheduledFor <= now,
// transactionally claims each scheduled->dispatched on the ORIGINAL (the
// idempotency guard mirrors sendQueuedMessage's queued->sending claim), and then
// CREATES A FRESH status:'queued' doc via the shared createQueuedMessage shaper
// so onDocumentCreated fires sendQueuedMessage exactly as for a human send.
describe("dispatchDueScheduledMessagesHandler", () => {
  // One fixed instant so due-ness (scheduledFor <= now) is deterministic.
  const FIXED_NOW = new Date("2026-08-14T04:30:00Z");
  const NOW_MS = FIXED_NOW.getTime();
  const ORG_ID = "orgDisp";
  const SVC_ID = "svcDisp";

  /** A Firestore-Timestamp-shaped scheduledFor (the real composer writes a string; the handler supports both). */
  function ts(ms: number) {
    return { toMillis: () => ms };
  }

  interface FakeScheduledOptions {
    orgId?: string | null;
    serviceId?: string;
    id?: string;
    status?: string;
    scheduledFor?: unknown;
    type?: string;
    subject?: string;
    body?: string;
    recipientSelector?: unknown;
    options?: unknown;
    requestedByUid?: string;
  }

  // A fake scheduled messages/{id} doc. State lives on ref._state so the
  // runTransaction fake's tx.get(ref)/tx.update(ref, patch) reads and mutates the
  // SAME object a re-scan later sees (the idempotency proof). The parent chain
  // resolves the service id (ref.parent.parent.id) and the org id one level up
  // (ref.parent.parent.parent.parent.id).
  function fakeScheduledDoc(opts: FakeScheduledOptions = {}) {
    const orgId = opts.orgId === undefined ? ORG_ID : opts.orgId;
    const serviceId = opts.serviceId ?? SVC_ID;
    const id = opts.id ?? "sched1";
    const state: Record<string, unknown> = {
      status: opts.status ?? "scheduled",
      scheduledFor: opts.scheduledFor === undefined ? ts(NOW_MS - 60_000) : opts.scheduledFor,
      type: opts.type ?? "oneoff",
      subject: opts.subject ?? "Scheduled subject",
      body: opts.body ?? "Scheduled body {{service_link}}",
      recipientSelector:
        opts.recipientSelector ?? { teams: ["band"], individualPersonIds: [], includeEveryone: false },
      options: opts.options ?? { attachServiceLink: true, sendCopyToSelf: true },
      requestedByUid: opts.requestedByUid ?? "uidOriginalEditor",
    };
    const ref = {
      path: `organizations/${orgId}/services/${serviceId}/messages/${id}`,
      _state: state,
      // messages collection -> service doc -> services collection -> org doc
      parent: {
        parent:
          serviceId === null
            ? null
            : {
                id: serviceId,
                parent: { parent: orgId === null ? null : { id: orgId } },
              },
      },
    };
    return { id, ref, data: () => ({ ...ref._state }) };
  }

  /**
   * A fake Firestore exposing the three seams the handler touches: the
   * collectionGroup('messages').where('status','==','scheduled').get() scan, the
   * runTransaction claim (reads/mutates ref._state), and the
   * organizations/{orgId}/services/{serviceId}/messages/{}.set() fresh-doc write.
   * Every created doc is captured into `created`.
   */
  function mockDispatchDb(docs: ReturnType<typeof fakeScheduledDoc>[]) {
    const created: { orgId: string; serviceId: string; doc: Record<string, unknown> }[] = [];
    const txUpdateSpy = vi.fn();

    const whereSpy = vi.fn((_field: string, _op: string, _value: string) => ({
      // The fake returns the fixed docs list regardless of mutated state so the
      // idempotency test exercises the CLAIM guard, not the query filter.
      get: vi.fn(async () => ({ docs })),
    }));
    const collectionGroupSpy = vi.fn((name: string) => {
      if (name !== "messages") {
        throw new Error(`mockDispatchDb: unexpected collectionGroup "${name}"`);
      }
      return { where: whereSpy };
    });

    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async (r: { _state?: Record<string, unknown> | null }) => ({
          exists: r._state != null,
          data: () => (r._state ? { ...r._state } : undefined),
        })),
        update: vi.fn((r: { _state?: Record<string, unknown> }, patch: Record<string, unknown>) => {
          txUpdateSpy(r, patch);
          if (r._state) Object.assign(r._state, patch);
        }),
      };
      return fn(tx);
    });

    function orgDocRef(orgId: string) {
      return {
        collection: (n: string) => {
          if (n !== "services") throw new Error(`mockDispatchDb: unexpected org sub-collection "${n}"`);
          return {
            doc: (serviceId: string) => ({
              collection: (m: string) => {
                if (m !== "messages")
                  throw new Error(`mockDispatchDb: unexpected messages sub-collection "${m}"`);
                return {
                  doc: () => ({
                    id: `new-${created.length}`,
                    set: vi.fn(async (doc: Record<string, unknown>) => {
                      created.push({ orgId, serviceId, doc });
                      return undefined;
                    }),
                  }),
                };
              },
            }),
          };
        },
      };
    }

    const collectionSpy = vi.fn((name: string) => {
      if (name !== "organizations") {
        throw new Error(`mockDispatchDb: unexpected collection "${name}"`);
      }
      return { doc: (orgId: string) => orgDocRef(orgId) };
    });

    vi.mocked(getFirestore).mockReturnValue({
      collectionGroup: collectionGroupSpy,
      collection: collectionSpy,
      runTransaction,
    } as never);
    return { created, txUpdateSpy, whereSpy, collectionGroupSpy, runTransaction };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(getFirestore).mockReset();
  });

  it("a due scheduled message is claimed scheduled->dispatched AND one fresh status:'queued' doc is created with copied fields", async () => {
    const doc = fakeScheduledDoc({
      scheduledFor: ts(NOW_MS - 60_000),
      type: "oneoff",
      subject: "Hi there",
      body: "Body {{service_link}}",
      requestedByUid: "uidOriginalEditor",
      recipientSelector: { teams: ["band"], individualPersonIds: ["p1"], includeEveryone: false },
      options: { attachServiceLink: true, sendCopyToSelf: true },
    });
    const { created, txUpdateSpy, whereSpy } = mockDispatchDb([doc]);

    const summary = await dispatchDueScheduledMessagesHandler();

    // Single-field equality scan (no composite index).
    expect(whereSpy).toHaveBeenCalledWith("status", "==", "scheduled");
    // The ORIGINAL is transactionally claimed scheduled -> dispatched.
    expect(txUpdateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "dispatched" }),
    );
    expect(doc.ref._state.status).toBe("dispatched");
    // Exactly one FRESH doc, under the same service, byte-identical to a human send.
    expect(created).toHaveLength(1);
    expect(created[0]!.orgId).toBe(ORG_ID);
    expect(created[0]!.serviceId).toBe(SVC_ID);
    expect(created[0]!.doc).toMatchObject({
      type: "oneoff",
      status: "queued",
      scheduledFor: null,
      requestedByUid: "uidOriginalEditor",
      subject: "Hi there",
      body: "Body {{service_link}}",
      recipientSelector: { teams: ["band"], individualPersonIds: ["p1"], includeEveryone: false },
      options: { attachServiceLink: true, sendCopyToSelf: true },
      deliveryCounts: { sent: 0, failed: 0 },
      sentAt: null,
    });
    expect(summary).toMatchObject({ scanned: 1, dispatched: 1 });
  });

  it("a future-scheduled message (scheduledFor > now) is neither claimed nor recreated (code-filtered)", async () => {
    const doc = fakeScheduledDoc({ scheduledFor: ts(NOW_MS + 60 * 60 * 1000) });
    const { created, txUpdateSpy } = mockDispatchDb([doc]);

    const summary = await dispatchDueScheduledMessagesHandler();

    expect(txUpdateSpy).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
    expect(doc.ref._state.status).toBe("scheduled");
    expect(summary).toMatchObject({ dispatched: 0 });
  });

  it("idempotency: a SECOND run over an already-'dispatched' doc claims nothing and creates NO additional doc", async () => {
    const doc = fakeScheduledDoc({ scheduledFor: ts(NOW_MS - 60_000) });
    const { created } = mockDispatchDb([doc]);

    await dispatchDueScheduledMessagesHandler();
    expect(created).toHaveLength(1);
    expect(doc.ref._state.status).toBe("dispatched");

    // The scan still returns the doc; the transaction now reads 'dispatched', so
    // the claim guard (status !== 'scheduled') fails and nothing fresh is made.
    const summary2 = await dispatchDueScheduledMessagesHandler();
    expect(created).toHaveLength(1);
    expect(summary2).toMatchObject({ dispatched: 0 });
  });

  it("supports the real composer's ISO-string scheduledFor (not just a Timestamp) so production docs actually dispatch", async () => {
    const doc = fakeScheduledDoc({ scheduledFor: new Date(NOW_MS - 60_000).toISOString() });
    const { created } = mockDispatchDb([doc]);

    const summary = await dispatchDueScheduledMessagesHandler();

    expect(created).toHaveLength(1);
    expect(created[0]!.doc).toMatchObject({ status: "queued", scheduledFor: null });
    expect(summary).toMatchObject({ dispatched: 1 });
  });

  it("skips a scheduled message with a null/absent scheduledFor (never due)", async () => {
    const doc = fakeScheduledDoc({ scheduledFor: null });
    const { created, txUpdateSpy } = mockDispatchDb([doc]);

    const summary = await dispatchDueScheduledMessagesHandler();

    expect(txUpdateSpy).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
    expect(summary).toMatchObject({ dispatched: 0 });
  });

  it("one malformed scheduled message that throws is logged and skipped; other due messages still dispatch", async () => {
    const bad = fakeScheduledDoc({
      id: "bad",
      serviceId: "svcBad",
      scheduledFor: {
        toMillis: () => {
          throw new Error("boom");
        },
      },
    });
    const good = fakeScheduledDoc({ id: "good", serviceId: "svcGood", scheduledFor: ts(NOW_MS - 60_000) });
    const { created } = mockDispatchDb([bad, good]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const summary = await dispatchDueScheduledMessagesHandler();

    expect(created).toHaveLength(1);
    expect(created[0]!.serviceId).toBe("svcGood");
    expect(summary).toMatchObject({ dispatched: 1 });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("skips (never crashes) a scheduled message whose parent chain is missing the org id", async () => {
    const orphan = fakeScheduledDoc({ orgId: null, scheduledFor: ts(NOW_MS - 60_000) });
    const { created, txUpdateSpy } = mockDispatchDb([orphan]);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const summary = await dispatchDueScheduledMessagesHandler();

    expect(txUpdateSpy).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
    expect(summary).toMatchObject({ dispatched: 0 });
    errSpy.mockRestore();
  });

  it("SOURCE: the dispatch sweep is wired into runScheduledMessagingCron in its own try/catch — no new onSchedule wrapper, no secret", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    // R170: the two sweeps now live inside the gated runScheduledMessagingCron
    // orchestrator (not directly in the onSchedule callback) -- assert against
    // ITS body, then separately assert the onSchedule wrapper just delegates.
    const cronStart = source.indexOf("export async function runScheduledMessagingCron(");
    const wrapperStart = source.indexOf("export const sendScheduledReminders = onSchedule(");
    expect(cronStart).toBeGreaterThan(-1);
    expect(wrapperStart).toBeGreaterThan(cronStart);
    const cronBody = source.slice(cronStart, wrapperStart);
    // Both sweeps run inside the one gated orchestrator; the dispatch sweep is called here.
    expect(cronBody).toContain("dispatchDueScheduledMessagesHandler()");
    expect(cronBody).toMatch(/try\s*\{/);
    const wrapperBody = source.slice(wrapperStart, wrapperStart + 300);
    expect(wrapperBody).toContain("runScheduledMessagingCron()");
    // No dedicated onSchedule wrapper and no secret bound to the dispatch sweep.
    expect(source).not.toContain("export const dispatchDueScheduledMessages = onSchedule");
    const handlerStart = source.indexOf("export async function dispatchDueScheduledMessagesHandler(");
    expect(handlerStart).toBeGreaterThan(-1);
    const wrapperEnd = source.indexOf("// ---", wrapperStart);
    const handlerBody = source.slice(handlerStart, handlerStart + 2500);
    expect(handlerBody).not.toMatch(/secrets:/);
    // The scan is a single-field equality on status (no composite index).
    expect(handlerBody).toMatch(
      /collectionGroup\(\s*"messages"\s*\)\s*\.where\(\s*"status",\s*"==",\s*"scheduled"\s*\)/,
    );
    void wrapperEnd;
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

// --- AI proxy cost controls (65-01: R161/R162/R163/R164) -----------------
//
// Mirrors the buildUpstreamUrl/redactUrl precedent above: the `api`
// onRequest handler still has no full test harness, so each control is
// exercised through its exported pure/helper function against a mocked
// Firestore/Auth -- never a live Anthropic call.

describe("readAiProxyLimits", () => {
  it("returns the documented defaults for an empty env", () => {
    expect(readAiProxyLimits({})).toEqual({
      maxPerMin: 20,
      maxPerDay: 500,
      allowedModels: ["claude-haiku-4-5-20251001"],
      maxTokensCeiling: 2048,
    });
  });

  it("parses all four knobs from env when present", () => {
    expect(
      readAiProxyLimits({
        AI_RATELIMIT_MAX_PER_MIN: "5",
        AI_RATELIMIT_MAX_PER_DAY: "50",
        AI_MAX_TOKENS_CEILING: "512",
        AI_ALLOWED_MODELS: " claude-haiku-4-5-20251001 , claude-sonnet-4-5-20250929 ",
      }),
    ).toEqual({
      maxPerMin: 5,
      maxPerDay: 50,
      allowedModels: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929"],
      maxTokensCeiling: 512,
    });
  });

  it("falls back to defaults for unset or non-numeric knobs", () => {
    expect(
      readAiProxyLimits({
        AI_RATELIMIT_MAX_PER_MIN: "not-a-number",
        AI_ALLOWED_MODELS: "",
      }),
    ).toEqual({
      maxPerMin: 20,
      maxPerDay: 500,
      allowedModels: ["claude-haiku-4-5-20251001"],
      maxTokensCeiling: 2048,
    });
  });

  it("drops empty entries from a comma-separated AI_ALLOWED_MODELS list", () => {
    const limits = readAiProxyLimits({ AI_ALLOWED_MODELS: "claude-haiku-4-5-20251001,, ," });
    expect(limits.allowedModels).toEqual(["claude-haiku-4-5-20251001"]);
  });

  it("WR-01: honors an operator's explicit `0` for any numeric knob instead of falling back to the default", () => {
    expect(
      readAiProxyLimits({
        AI_RATELIMIT_MAX_PER_MIN: "0",
        AI_RATELIMIT_MAX_PER_DAY: "0",
        AI_MAX_TOKENS_CEILING: "0",
      }),
    ).toEqual({
      maxPerMin: 0,
      maxPerDay: 0,
      allowedModels: ["claude-haiku-4-5-20251001"],
      maxTokensCeiling: 0,
    });
  });
});

describe("readNumericKnob", () => {
  it("WR-01: returns the fallback for an undefined value", () => {
    expect(readNumericKnob(undefined, 20)).toBe(20);
  });

  it("WR-01: returns the fallback for a blank/whitespace-only value", () => {
    expect(readNumericKnob("   ", 20)).toBe(20);
    expect(readNumericKnob("", 20)).toBe(20);
  });

  it("WR-01: returns the fallback for a non-numeric value", () => {
    expect(readNumericKnob("not-a-number", 20)).toBe(20);
  });

  it("WR-01: honors an explicit `0` rather than falling back to the default", () => {
    expect(readNumericKnob("0", 20)).toBe(0);
  });

  it("parses a valid non-zero numeric string", () => {
    expect(readNumericKnob("5", 20)).toBe(5);
    expect(readNumericKnob(" 5 ", 20)).toBe(5);
  });
});

describe("resolveOrgId", () => {
  it("returns the orgId custom claim when present", () => {
    expect(resolveOrgId({ orgId: "org1" } as never)).toBe("org1");
  });

  it("returns null when the orgId claim is absent", () => {
    expect(resolveOrgId({} as never)).toBeNull();
  });

  it("returns null when the orgId claim is an empty string", () => {
    expect(resolveOrgId({ orgId: "" } as never)).toBeNull();
  });
});

describe("verifyAppCaller", () => {
  afterEach(() => {
    vi.mocked(getAuth).mockReset();
    vi.mocked(getAuth).mockReturnValue({
      verifyIdToken: vi.fn(),
      getUser: vi.fn(async () => ({ email: fakeEditorEmail })),
    } as never);
  });

  it("returns null for a missing token, without calling verifyIdToken", async () => {
    const verifyIdToken = vi.fn();
    vi.mocked(getAuth).mockReturnValue({ verifyIdToken } as never);
    expect(await verifyAppCaller(undefined)).toBeNull();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("resolves to the decoded token for a valid token", async () => {
    const decoded = { uid: "uid1", orgId: "org1" };
    const verifyIdToken = vi.fn(async () => decoded);
    vi.mocked(getAuth).mockReturnValue({ verifyIdToken } as never);
    expect(await verifyAppCaller("good-token")).toEqual(decoded);
  });

  it("resolves to null when verifyIdToken throws (invalid token)", async () => {
    const verifyIdToken = vi.fn(async () => {
      throw new Error("invalid token");
    });
    vi.mocked(getAuth).mockReturnValue({ verifyIdToken } as never);
    expect(await verifyAppCaller("bad-token")).toBeNull();
  });
});

describe("enforceModelAndTokens", () => {
  const limits = { allowedModels: ["claude-haiku-4-5-20251001"], maxTokensCeiling: 2048 };

  it("passes an allow-listed model with an under-ceiling max_tokens through unchanged", () => {
    const body = { model: "claude-haiku-4-5-20251001", max_tokens: 512, messages: [] };
    const result = enforceModelAndTokens(body, limits);
    expect(result).toEqual({ ok: true, body });
  });

  it("rejects a non-allow-listed model with 400", () => {
    const result = enforceModelAndTokens({ model: "claude-opus-4-1", max_tokens: 100 }, limits);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.allowedModels).toEqual(limits.allowedModels);
    }
  });

  it("clamps an over-ceiling max_tokens down to the ceiling rather than rejecting", () => {
    const result = enforceModelAndTokens(
      { model: "claude-haiku-4-5-20251001", max_tokens: 9999 },
      limits,
    );
    expect(result).toEqual({
      ok: true,
      body: { model: "claude-haiku-4-5-20251001", max_tokens: 2048 },
    });
  });

  it("leaves an absent max_tokens absent rather than injecting one", () => {
    const result = enforceModelAndTokens({ model: "claude-haiku-4-5-20251001" }, limits);
    expect(result).toEqual({ ok: true, body: { model: "claude-haiku-4-5-20251001" } });
  });

  it("rejects a missing model with 400", () => {
    const result = enforceModelAndTokens({ max_tokens: 100 }, limits);
    expect(result.ok).toBe(false);
  });

  it("rejects a blank model with 400", () => {
    const result = enforceModelAndTokens({ model: "   ", max_tokens: 100 }, limits);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body with 400", () => {
    expect(enforceModelAndTokens(null, limits).ok).toBe(false);
    expect(enforceModelAndTokens("a string", limits).ok).toBe(false);
    expect(enforceModelAndTokens(42, limits).ok).toBe(false);
  });

  it("WR-03: rejects `stream: true` with 400 rather than forwarding it (would bypass the aiUsage ledger)", () => {
    const result = enforceModelAndTokens(
      { model: "claude-haiku-4-5-20251001", max_tokens: 100, stream: true },
      limits,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.allowedModels).toEqual(limits.allowedModels);
    }
  });

  it("WR-03: allows `stream: false` (an explicit non-streaming request) through unchanged", () => {
    const body = { model: "claude-haiku-4-5-20251001", max_tokens: 100, stream: false };
    const result = enforceModelAndTokens(body, limits);
    expect(result).toEqual({ ok: true, body });
  });

  it("WR-03: allows a request that omits `stream` entirely (the normal case)", () => {
    const body = { model: "claude-haiku-4-5-20251001", max_tokens: 100 };
    const result = enforceModelAndTokens(body, limits);
    expect(result).toEqual({ ok: true, body });
  });

  it("IN-01: clamps an over-ceiling max_tokens sent as a numeric STRING, not just a number", () => {
    const result = enforceModelAndTokens(
      { model: "claude-haiku-4-5-20251001", max_tokens: "99999999" },
      limits,
    );
    expect(result).toEqual({
      ok: true,
      body: { model: "claude-haiku-4-5-20251001", max_tokens: 2048 },
    });
  });

  it("IN-01: leaves an under-ceiling numeric-string max_tokens untouched", () => {
    const body = { model: "claude-haiku-4-5-20251001", max_tokens: "512" };
    const result = enforceModelAndTokens(body, limits);
    expect(result).toEqual({ ok: true, body });
  });

  it("IN-01: ignores a non-numeric max_tokens string rather than throwing", () => {
    const body = { model: "claude-haiku-4-5-20251001", max_tokens: "not-a-number" };
    const result = enforceModelAndTokens(body, limits);
    expect(result).toEqual({ ok: true, body });
  });
});

describe("checkAndConsumeRateLimit", () => {
  const NOW = 1_700_000_000_000; // fixed instant
  const limits = { maxPerMin: 2, maxPerDay: 5 };

  function mockRateLimitDb(counts: Record<string, number>) {
    const state: Record<string, { count: number }> = {};
    for (const [id, count] of Object.entries(counts)) {
      state[id] = { count };
    }
    const setSpy = vi.fn();
    const doc = vi.fn((id: string) => ({ id, _docId: id }));
    const collection = vi.fn((name: string) => {
      if (name !== "aiRateLimits") throw new Error(`unexpected collection "${name}"`);
      return { doc };
    });
    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async (ref: { _docId: string }) => {
          const entry = state[ref._docId];
          return {
            exists: entry !== undefined,
            data: () => (entry ? { ...entry } : undefined),
          };
        }),
        set: vi.fn((ref: { _docId: string }, patch: { count: number }) => {
          setSpy(ref._docId, patch);
          state[ref._docId] = { count: patch.count };
        }),
      };
      return fn(tx);
    });
    return { db: { collection, runTransaction } as never, runTransaction, setSpy, state };
  }

  it("allows and increments both counters when under both ceilings", async () => {
    const { db, setSpy } = mockRateLimitDb({});
    const result = await checkAndConsumeRateLimit(db, "uid1", limits, NOW);
    expect(result).toEqual({ allowed: true });
    expect(setSpy).toHaveBeenCalledTimes(2);
  });

  it("blocks and does NOT increment when the minute counter is already at the ceiling", async () => {
    const minuteWindow = Math.floor(NOW / 60000);
    const { db, setSpy } = mockRateLimitDb({ [`uid1__min__${minuteWindow}`]: 2 });
    const result = await checkAndConsumeRateLimit(db, "uid1", limits, NOW);
    expect(result).toEqual({ allowed: false, scope: "minute" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("blocks and does NOT increment when the day counter is already at the ceiling", async () => {
    const dayWindow = Math.floor(NOW / 86400000);
    const { db, setSpy } = mockRateLimitDb({ [`uid1__day__${dayWindow}`]: 5 });
    const result = await checkAndConsumeRateLimit(db, "uid1", limits, NOW);
    expect(result).toEqual({ allowed: false, scope: "day" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("propagates a throwing transaction so the caller can fail open", async () => {
    const db = {
      collection: () => ({ doc: (id: string) => ({ id }) }),
      runTransaction: vi.fn(async () => {
        throw new Error("Firestore unavailable");
      }),
    } as never;
    await expect(checkAndConsumeRateLimit(db, "uid1", limits, NOW)).rejects.toThrow(
      "Firestore unavailable",
    );
  });
});

// R171: per-org daily Resend email quota -- mirrors checkAndConsumeRateLimit's
// harness above, but on a single top-level orgEmailCounters doc keyed by day
// and incremented by an arbitrary `count` (the number of emails one send is
// about to attempt), not always by 1.
describe("checkAndConsumeOrgEmailQuota", () => {
  const NOW = 1_700_000_000_000; // fixed instant
  const LIMIT = 5;

  function mockOrgEmailCounterDb(counts: Record<string, number>) {
    const state: Record<string, { count: number }> = {};
    for (const [id, count] of Object.entries(counts)) {
      state[id] = { count };
    }
    const setSpy = vi.fn();
    const doc = vi.fn((id: string) => ({ id, _docId: id }));
    const collection = vi.fn((name: string) => {
      if (name !== "orgEmailCounters") throw new Error(`unexpected collection "${name}"`);
      return { doc };
    });
    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async (ref: { _docId: string }) => {
          const entry = state[ref._docId];
          return {
            exists: entry !== undefined,
            data: () => (entry ? { ...entry } : undefined),
          };
        }),
        set: vi.fn((ref: { _docId: string }, patch: { count: number }) => {
          setSpy(ref._docId, patch);
          state[ref._docId] = { count: patch.count };
        }),
      };
      return fn(tx);
    });
    return { db: { collection, runTransaction } as never, runTransaction, setSpy, state };
  }

  it("allows and increments the day counter by `count` when under the limit", async () => {
    const { db, setSpy } = mockOrgEmailCounterDb({});
    const result = await checkAndConsumeOrgEmailQuota(db, "org1", 3, LIMIT, NOW);
    expect(result).toEqual({ allowed: true });
    const dayWindow = Math.floor(NOW / 86400000);
    expect(setSpy).toHaveBeenCalledWith(`org1__day__${dayWindow}`, expect.objectContaining({ count: 3 }));
  });

  it("blocks and does NOT increment when the day counter is already at the ceiling", async () => {
    const dayWindow = Math.floor(NOW / 86400000);
    const { db, setSpy } = mockOrgEmailCounterDb({ [`org1__day__${dayWindow}`]: LIMIT });
    const result = await checkAndConsumeOrgEmailQuota(db, "org1", 2, LIMIT, NOW);
    expect(result).toEqual({ allowed: false, scope: "day" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("blocks and does NOT increment when the day counter is already OVER the ceiling", async () => {
    const dayWindow = Math.floor(NOW / 86400000);
    const { db, setSpy } = mockOrgEmailCounterDb({ [`org1__day__${dayWindow}`]: LIMIT + 10 });
    const result = await checkAndConsumeOrgEmailQuota(db, "org1", 1, LIMIT, NOW);
    expect(result).toEqual({ allowed: false, scope: "day" });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("propagates a throwing transaction so the caller decides the fail policy", async () => {
    const db = {
      collection: () => ({ doc: (id: string) => ({ id }) }),
      runTransaction: vi.fn(async () => {
        throw new Error("Firestore unavailable");
      }),
    } as never;
    await expect(checkAndConsumeOrgEmailQuota(db, "org1", 1, LIMIT, NOW)).rejects.toThrow(
      "Firestore unavailable",
    );
  });
});

describe("buildUsageEntry", () => {
  it("returns the exact documented shape, reading input/output tokens from usage", () => {
    const entry = buildUsageEntry("uid1", "org1", "claude-haiku-4-5-20251001", {
      input_tokens: 120,
      output_tokens: 340,
    });
    expect(entry).toEqual({
      uid: "uid1",
      orgId: "org1",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 120,
      outputTokens: 340,
      createdAt: "SERVER_TIMESTAMP_SENTINEL",
    });
  });

  it("falls back orgId to null and token counts to 0 when unresolved", () => {
    const entry = buildUsageEntry("uid1", null, "claude-haiku-4-5-20251001", undefined);
    expect(entry.orgId).toBeNull();
    expect(entry.inputTokens).toBe(0);
    expect(entry.outputTokens).toBe(0);
  });
});

describe("writeUsageLedger", () => {
  it("adds the entry to the top-level aiUsage collection via the Admin SDK", async () => {
    const addSpy = vi.fn(async () => ({ id: "new-doc" }));
    const collection = vi.fn((name: string) => {
      if (name !== "aiUsage") throw new Error(`unexpected collection "${name}"`);
      return { add: addSpy };
    });
    const db = { collection } as never;
    const entry = buildUsageEntry("uid1", "org1", "claude-haiku-4-5-20251001", {
      input_tokens: 1,
      output_tokens: 2,
    });
    await writeUsageLedger(db, entry);
    expect(addSpy).toHaveBeenCalledWith(entry);
  });
});

// R172: a project-wide setGlobalOptions({ maxInstances }) ceiling so EVERY
// function inherits a fan-out cap, even ones (like messageWebhook) with no
// per-function option of their own. setGlobalOptions is called exactly once,
// at index.ts module scope, which this suite observes via the hoisted
// setGlobalOptionsSpy wired into the firebase-functions/v2/options mock.
describe("setGlobalOptions (R172: project-wide maxInstances ceiling)", () => {
  it("is called exactly once, at module load, with the default maxInstances of 20", () => {
    expect(setGlobalOptionsSpy).toHaveBeenCalledTimes(1);
    expect(setGlobalOptionsSpy).toHaveBeenCalledWith({ maxInstances: 20 });
  });

  it("SOURCE: api's own maxInstances is NOT clobbered by the global default", () => {
    const source = readFileSync(path.join(__dirname, "index.ts"), "utf-8");
    const globalCallIndex = source.indexOf("setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES });");
    const apiStart = source.indexOf("export const api = onRequest(");
    expect(globalCallIndex).toBeGreaterThan(-1);
    expect(apiStart).toBeGreaterThan(globalCallIndex);
    const apiOptions = source.slice(apiStart, apiStart + 300);
    expect(apiOptions).toMatch(/maxInstances:\s*AI_PROXY_MAX_INSTANCES/);
  });
});

// WR-04: every control above (enforceModelAndTokens, checkAndConsumeRateLimit,
// buildUsageEntry, writeUsageLedger, verifyAppCaller, resolveOrgId) is
// unit-tested in isolation against its own extracted pure function, but
// nothing proved the `api` onRequest handler actually WIRES them together --
// that `outboundBody` (the clamped body), not raw `req.body`, is what's
// passed to `fetch`, and that a 2xx anthropic response writes exactly one
// aiUsage ledger entry. `onRequest` (firebase-functions/v2/https, NOT mocked
// in this suite) just wraps the handler and returns it directly callable as
// `(req, res) => Promise<void>` -- so `api` can be driven with a hand-rolled
// fake req/res, no supertest/emulator needed.
describe("api (WR-04: anthropic branch end-to-end wiring)", () => {
  // No AI_ALLOWED_MODELS env override is set in this test process, so
  // readAiProxyLimits() falls back to the compiled-in DEFAULT_AI_ALLOWED_MODELS.
  const ALLOWED_MODEL = "claude-haiku-4-5-20251001";

  function fakeReq(body: unknown, headers: Record<string, string> = {}) {
    return {
      path: "/api/anthropic/v1/messages",
      originalUrl: "/api/anthropic/v1/messages",
      method: "POST",
      headers: { "x-app-auth": "valid-token", ...headers },
      body,
    };
  }

  function fakeRes() {
    const res = {
      statusCode: undefined as number | undefined,
      jsonBody: undefined as unknown,
      sentBody: undefined as unknown,
      setHeaders: {} as Record<string, string>,
    };
    const status = vi.fn((code: number) => {
      res.statusCode = code;
      return typed;
    });
    const json = vi.fn((body: unknown) => {
      res.jsonBody = body;
      return typed;
    });
    const set = vi.fn((key: string, value: string) => {
      res.setHeaders[key] = value;
      return typed;
    });
    const send = vi.fn((body: unknown) => {
      res.sentBody = body;
      return typed;
    });
    const typed = { ...res, status, json, set, send };
    return typed;
  }

  function mockCombinedDb() {
    const addSpy = vi.fn(async (_entry: unknown) => ({ id: "ledger-doc" }));
    const setSpy = vi.fn();
    const doc = vi.fn((id: string) => ({ id, _docId: id }));
    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async () => ({ exists: false, data: () => undefined })),
        set: vi.fn((ref: { _docId: string }, patch: unknown) => {
          setSpy(ref._docId, patch);
        }),
      };
      return fn(tx);
    });
    const collection = vi.fn((name: string) => {
      if (name === "aiRateLimits") return { doc };
      if (name === "aiUsage") return { add: addSpy };
      throw new Error(`unexpected collection "${name}"`);
    });
    return { db: { collection, runTransaction } as never, addSpy, setSpy };
  }

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getAuth).mockReturnValue({
      verifyIdToken: vi.fn(async () => ({ uid: "uid1", orgId: "org1" })),
      getUser: vi.fn(async () => ({ email: fakeEditorEmail })),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(getAuth).mockReset();
    vi.mocked(getAuth).mockReturnValue({
      verifyIdToken: vi.fn(),
      getUser: vi.fn(async () => ({ email: fakeEditorEmail })),
    } as never);
    vi.mocked(getFirestore).mockReset();
  });

  it("WR-04: a disallowed model is rejected 400 before fetch is ever called", async () => {
    const { db } = mockCombinedDb();
    vi.mocked(getFirestore).mockReturnValue(db);
    const req = fakeReq({ model: "claude-opus-4-1", max_tokens: 100, messages: [] });
    const res = fakeRes();

    await api(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("WR-04: a normal request forwards the CLAMPED outboundBody (not raw req.body) and writes exactly one aiUsage ledger entry", async () => {
    const { db, addSpy } = mockCombinedDb();
    vi.mocked(getFirestore).mockReturnValue(db);
    fetchMock.mockResolvedValue({
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ usage: { input_tokens: 12, output_tokens: 34 } }),
    });
    const rawBody = {
      model: ALLOWED_MODEL,
      max_tokens: 999_999, // deliberately over the 2048 default ceiling
      messages: [{ role: "user", content: "hi" }],
    };
    const req = fakeReq(rawBody);
    const res = fakeRes();

    await api(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchOpts = fetchMock.mock.calls[0]?.[1] as { body: string };
    const sentBody = JSON.parse(fetchOpts.body) as Record<string, unknown>;
    // The clamped body was forwarded -- NOT the raw 999_999 max_tokens.
    expect(sentBody.max_tokens).toBe(2048);
    expect(sentBody).not.toEqual(rawBody);

    expect(addSpy).toHaveBeenCalledTimes(1);
    const ledgerEntry = addSpy.mock.calls[0]?.[0] as {
      uid: string;
      inputTokens: number;
      outputTokens: number;
    };
    expect(ledgerEntry.uid).toBe("uid1");
    expect(ledgerEntry.inputTokens).toBe(12);
    expect(ledgerEntry.outputTokens).toBe(34);

    expect(res.status).toHaveBeenCalledWith(200);
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
    orgName?: string | null; // the org doc's name → From display name (default "Test Church")
    // R171: seeds the fake top-level orgEmailCounters collection the
    // checkAndConsumeOrgEmailQuota transaction reads/writes, keyed exactly as
    // the helper keys it (`${orgId}__day__${dayWindow}`). Absent = under quota.
    orgEmailCounterSeed?: Record<string, number>;
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
      // The send path reads the org doc for its name (the From display name).
      get: vi.fn(async () => docSnap(true, { name: cfg.orgName ?? "Test Church" })),
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

    // R171: the org-quota counter state, seeded from cfg.orgEmailCounterSeed.
    // orgEmailCounters doc refs are tagged { _kind: "orgEmailCounter" } so the
    // ONE shared runTransaction fake below can route tx.get/tx.set to the
    // right store WITHOUT guessing from call order — it distinguishes the
    // message-claim transaction from the counter transaction by the ref
    // itself, exactly as production code passes two structurally different
    // refs (messageRef vs. an orgEmailCounters doc) into the same db.runTransaction.
    const orgEmailCounters: Record<string, { count: number }> = {};
    for (const [id, count] of Object.entries(cfg.orgEmailCounterSeed ?? {})) {
      orgEmailCounters[id] = { count };
    }
    const orgEmailCounterSetSpy = vi.fn();
    const orgEmailCountersCol = {
      doc: vi.fn((id: string) => ({ _kind: "orgEmailCounter" as const, _docId: id })),
    };

    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: vi.fn(async (ref?: { _kind?: string; _docId?: string }) => {
          if (ref && ref._kind === "orgEmailCounter") {
            const entry = orgEmailCounters[ref._docId!];
            return { exists: entry !== undefined, data: () => (entry ? { ...entry } : undefined) };
          }
          return messageExists
            ? docSnap(true, { ...messageData, status: messageStatus })
            : docSnap(false, undefined);
        }),
        update: vi.fn((_ref: unknown, patch: { status?: string }) => {
          txUpdateSpy(_ref, patch);
          if (patch && typeof patch.status === "string") messageStatus = patch.status;
        }),
        set: vi.fn((ref: { _kind?: string; _docId?: string }, patch: { count: number }) => {
          if (ref && ref._kind === "orgEmailCounter") {
            orgEmailCounterSetSpy(ref._docId, patch);
            orgEmailCounters[ref._docId!] = { count: patch.count };
          }
        }),
      };
      return fn(tx);
    });

    const db = {
      collection: vi.fn((name: string) => {
        if (name === "organizations") return { doc: vi.fn(() => orgRef) };
        if (name === "shareTokens") return { where: shareTokensWhere };
        if (name === "orgEmailCounters") return orgEmailCountersCol;
        throw new Error(`makeSendDb: unexpected collection "${name}"`);
      }),
      runTransaction,
    };

    return {
      db,
      messageSetSpy,
      recipientWrites,
      txUpdateSpy,
      runTransaction,
      orgEmailCounterSetSpy,
      orgEmailCounters,
    };
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
    fakeMessageFromAddress = "onboarding@resend.dev";
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

  // --- R171: Resend volume guardrails (67-01) --------------------------------
  describe("R171: recipient cap + org daily quota", () => {
    afterEach(() => {
      delete process.env.MESSAGE_MAX_RECIPIENTS;
      delete process.env.ORG_MAX_EMAILS_PER_DAY;
    });

    it("an over-cap send (MESSAGE_MAX_RECIPIENTS) is REJECTED 'failed' with ZERO sends -- never truncated", async () => {
      process.env.MESSAGE_MAX_RECIPIENTS = "1";
      const { db, recipientWrites, messageSetSpy } = makeSendDb(twoRecipientConfig());
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const outcome = await sendQueuedMessageHandler({
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        messageId: MESSAGE_ID,
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(recipientWrites).toHaveLength(0);
      expect(messageSetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", deliveryCounts: { sent: 0, failed: 0 } }),
        { merge: true },
      );
      expect(outcome).toMatchObject({
        status: "failed",
        sentCount: 0,
        failedCount: 0,
        skippedReason: "over-recipient-cap",
      });
    });

    it("an org at/over ORG_MAX_EMAILS_PER_DAY (env override) is failed/skipped with ZERO sends", async () => {
      process.env.ORG_MAX_EMAILS_PER_DAY = "0";
      const { db, recipientWrites, messageSetSpy } = makeSendDb(twoRecipientConfig());
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const outcome = await sendQueuedMessageHandler({
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        messageId: MESSAGE_ID,
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(recipientWrites).toHaveLength(0);
      expect(messageSetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", deliveryCounts: { sent: 0, failed: 0 } }),
        { merge: true },
      );
      expect(outcome).toMatchObject({
        status: "failed",
        sentCount: 0,
        failedCount: 0,
        skippedReason: "over-org-daily-quota",
      });
    });

    it("an org whose counter is already AT the default daily cap is failed/skipped, without incrementing it further", async () => {
      const dayWindow = Math.floor(Date.now() / 86_400_000);
      const { db, recipientWrites, orgEmailCounterSetSpy } = makeSendDb({
        ...twoRecipientConfig(),
        orgEmailCounterSeed: { [`${ORG_ID}__day__${dayWindow}`]: 1000 },
      });
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const outcome = await sendQueuedMessageHandler({
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        messageId: MESSAGE_ID,
      });

      expect(mockSend).not.toHaveBeenCalled();
      expect(recipientWrites).toHaveLength(0);
      expect(orgEmailCounterSetSpy).not.toHaveBeenCalled();
      expect(outcome).toMatchObject({ status: "failed", skippedReason: "over-org-daily-quota" });
    });

    it("under both default limits, the two-recipient send is unaffected (no MESSAGE_MAX_RECIPIENTS/ORG_MAX_EMAILS_PER_DAY override)", async () => {
      const { db, recipientWrites, messageSetSpy } = makeSendDb(twoRecipientConfig());
      vi.mocked(getFirestore).mockReturnValue(db as never);

      const outcome = await sendQueuedMessageHandler({
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        messageId: MESSAGE_ID,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(recipientWrites).toHaveLength(2);
      expect(messageSetSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: "sent", deliveryCounts: { sent: 2, failed: 0 } }),
        { merge: true },
      );
      expect(outcome).toMatchObject({ status: "sent", sentCount: 2, failedCount: 0 });
    });
  });

  // --- From / Reply-To (owner UAT 2026-08-17) --------------------------------
  // Churches no longer set From/Reply-To. From = the org's own NAME (display)
  // over the app's single verified sending address (MESSAGE_FROM_ADDRESS);
  // Reply-To = the sending editor's email, auto-resolved server-side.
  it("From = the org's name as display name over MESSAGE_FROM_ADDRESS", async () => {
    const { db } = makeSendDb(twoRecipientConfig()); // orgName defaults to "Test Church"
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const from = (mockSend.mock.calls[0][0] as { from: string }).from;
    expect(from).toBe('"Test Church" <onboarding@resend.dev>');
  });

  it("peels a display name already in MESSAGE_FROM_ADDRESS so wrapping never nests brackets (422 repro)", async () => {
    // Reproduces the reported 422: a "Name <email>" config value wrapped again
    // produced "My's Church" <Worship Planner <noreply@…>>. bareEmailAddress must
    // extract just the address → a single, valid quoted-name form.
    fakeMessageFromAddress = "Worship Planner <noreply@worshipplanner.app>";
    const { db } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const from = (mockSend.mock.calls[0][0] as { from: string }).from;
    expect(from).toBe('"Test Church" <noreply@worshipplanner.app>');
    expect(from).not.toContain("<Worship Planner");
    expect((from.match(/</g) ?? []).length).toBe(1);
  });

  it("From falls back to the BARE address when the org has no name", async () => {
    const { db } = makeSendDb({ ...twoRecipientConfig(), orgName: "" });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const from = (mockSend.mock.calls[0][0] as { from: string }).from;
    expect(from).toBe("onboarding@resend.dev");
  });

  it("SECURITY: strips CR/LF and quotes from the org name before the From header (no header injection)", async () => {
    const { db } = makeSendDb({ ...twoRecipientConfig(), orgName: 'Bad\r\nBcc: evil@x.com "Church"' });
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    const from = (mockSend.mock.calls[0][0] as { from: string }).from;
    expect(from).not.toMatch(/[\r\n]/);
    expect(from).toBe('"Bad Bcc: evil@x.com Church" <onboarding@resend.dev>');
  });

  it("Reply-To = the sending editor's own email (auto-built from requestedByUid)", async () => {
    fakeEditorEmail = "leader@church.example";
    const { db } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect((mockSend.mock.calls[0][0] as { replyTo?: string }).replyTo).toBe("leader@church.example");
  });

  it("omits Reply-To when the requesting editor's email cannot be resolved", async () => {
    fakeEditorEmail = "";
    const { db } = makeSendDb(twoRecipientConfig());
    vi.mocked(getFirestore).mockReturnValue(db as never);

    await sendQueuedMessageHandler({ orgId: ORG_ID, serviceId: SERVICE_ID, messageId: MESSAGE_ID });

    expect((mockSend.mock.calls[0][0] as { replyTo?: string }).replyTo).toBeUndefined();
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
    // Absent `tags` key -> default TAGS; an explicit `tags: undefined` -> omit
    // tags entirely (forces the providerMessageId fallback path in tests).
    const tags = "tags" in overrides ? overrides.tags : TAGS;
    return {
      type: overrides.type ?? "email.bounced",
      data: {
        email_id: overrides.email_id ?? "re_abc123",
        ...(tags ? { tags } : {}),
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
