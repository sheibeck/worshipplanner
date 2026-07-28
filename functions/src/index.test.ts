import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import {
  cleanupExpiredMediaHandler,
  MEDIA_PATH_GUARD,
  RETENTION_DAYS,
} from "./index";

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
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(),
}));
vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({ value: () => "fake-secret" })),
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
