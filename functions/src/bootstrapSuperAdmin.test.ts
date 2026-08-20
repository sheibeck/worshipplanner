import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { bootstrapSuperAdmin, runBootstrapCli } from "./bootstrapSuperAdmin";

// Mirrors functions/src/backfillOrgClaims.test.ts's established mocking seams.
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
  })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));

const UID = "ownerUid";
const EMAIL = "owner@example.com";

function mockAuth(opts: {
  existingClaims?: Record<string, unknown>;
  getUserByEmailImpl?: () => Promise<{ uid: string }>;
} = {}) {
  const setCustomUserClaims = vi.fn(async () => undefined);
  const getUser = vi.fn(async () => ({ customClaims: opts.existingClaims }));
  const getUserByEmail =
    opts.getUserByEmailImpl !== undefined
      ? vi.fn(opts.getUserByEmailImpl)
      : vi.fn(async () => ({ uid: UID }));
  vi.mocked(getAuth).mockReturnValue({
    getUserByEmail,
    getUser,
    setCustomUserClaims,
  } as never);
  return { setCustomUserClaims, getUser, getUserByEmail };
}

function mockFirestore() {
  const setSpy = vi.fn(async () => undefined);
  const docSpy = vi.fn(() => ({ set: setSpy }));
  const superAdminsCollection = { doc: docSpy };
  vi.mocked(getFirestore).mockReturnValue({
    collection: vi.fn((name: string) => {
      if (name === "superAdmins") return superAdminsCollection;
      throw new Error(`mockFirestore: unexpected collection "${name}"`);
    }),
  } as never);
  return { setSpy, docSpy };
}

afterEach(() => {
  vi.mocked(getAuth).mockReset();
  vi.mocked(getFirestore).mockReset();
});

describe("bootstrapSuperAdmin", () => {
  it("dry run (the default): resolves the target but writes neither the Firestore doc nor the claim", async () => {
    const { setCustomUserClaims } = mockAuth();
    const { setSpy, docSpy } = mockFirestore();

    const result = await bootstrapSuperAdmin({ apply: false, email: EMAIL });

    expect(result).toEqual({ uid: UID, email: EMAIL, applied: false });
    expect(docSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("--apply true: writes superAdmins/{uid} AND calls mergeAndSetCustomClaims exactly once for the resolved uid", async () => {
    const { setCustomUserClaims, getUserByEmail } = mockAuth();
    const { setSpy, docSpy } = mockFirestore();

    const result = await bootstrapSuperAdmin({ apply: true, email: EMAIL });

    expect(getUserByEmail).toHaveBeenCalledWith(EMAIL);
    expect(docSpy).toHaveBeenCalledWith(UID);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({
      email: EMAIL,
      grantedBy: "bootstrap",
      grantedAt: expect.any(Date),
    });
    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { superAdmin: true });
    expect(result).toEqual({ uid: UID, email: EMAIL, applied: true });
  });

  it("--apply true with existing { orgId, role } claims: merges superAdmin onto them rather than replacing", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: "orgA", role: "editor" } });
    mockFirestore();

    await bootstrapSuperAdmin({ apply: true, email: EMAIL });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: "orgA",
      role: "editor",
      superAdmin: true,
    });
  });
});

describe("runBootstrapCli", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
  });

  it("missing --email: logs a diagnostic and sets a non-zero exit code without calling getUserByEmail", async () => {
    process.argv = ["node", "bootstrapSuperAdmin.js"];
    const { getUserByEmail } = mockAuth();
    mockFirestore();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(runBootstrapCli()).resolves.toBeUndefined();

    expect(process.exitCode).toBe(1);
    expect(getUserByEmail).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("top-level failure (e.g. unknown email): catches the rejection, logs a diagnostic, sets a non-zero exit code instead of throwing", async () => {
    process.argv = ["node", "bootstrapSuperAdmin.js", "--email", EMAIL, "--apply"];
    mockAuth({
      getUserByEmailImpl: async () => {
        throw new Error("auth/user-not-found");
      },
    });
    mockFirestore();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(runBootstrapCli()).resolves.toBeUndefined();

    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[bootstrapSuperAdmin] aborted -- top-level failure:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("dry run via CLI args: resolves and reports but writes nothing", async () => {
    process.argv = ["node", "bootstrapSuperAdmin.js", "--email", EMAIL];
    const { setCustomUserClaims } = mockAuth();
    const { setSpy } = mockFirestore();
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(runBootstrapCli()).resolves.toBeUndefined();

    expect(process.exitCode).toBeUndefined();
    expect(setSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaims).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
