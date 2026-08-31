import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { resetAppConfigCacheForTest } from "./appConfig";
import {
  sendInviteOnboardingEmailHandler,
  type SendInviteOnboardingEmailRequest,
} from "./inviteOnboarding";

// --- inviteOnboarding.test.ts (R289/R290/R291/R293 + caller gate) -----------
//
// Mirrors orgProvisioning.test.ts's FakeFirestore + mocked getAuth() pattern,
// extended with createUser/generatePasswordResetLink (new to this repo, no
// prior mock precedent -- added fresh), and adminEmail.test.ts's mocked
// resend/firebase-functions/params seams for the send-path assertions. Uses
// the REAL getAppConfig (not mocked) + resetAppConfigCacheForTest() in
// beforeEach so the 60s TTL cache never bleeds a prior test's onboarding
// flag between cases.

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    generatePasswordResetLink: vi.fn(),
  })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(async (_payload: unknown) => ({ data: { id: "m1" } })),
}));
let fakeShareBaseUrl = "https://app.example.com";

vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return { emails: { send: mockSend } };
  }),
}));
vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({ value: () => "fake-secret" })),
  defineString: vi.fn((name: string) => ({
    value: () => (name === "SERVICE_SHARE_BASE_URL" ? fakeShareBaseUrl : ""),
  })),
}));

const CALLER_UID = "callerUid";
const ORG_ID = "org1";
const ORG_NAME = "Grace Church";
const INVITEE_EMAIL = "invitee@example.com";

interface DocState {
  exists: boolean;
  data?: Record<string, unknown>;
}

/** A minimal path-addressable fake Firestore, mirrors orgProvisioning.test.ts's
 * FakeFirestore -- only the .get() surface this handler actually calls. */
class FakeFirestore {
  docStates = new Map<string, DocState>();

  setDocState(path: string, state: DocState) {
    this.docStates.set(path, state);
  }

  private makeDocRef(path: string) {
    return {
      get: async () => {
        const state = this.docStates.get(path) ?? { exists: false };
        return { exists: state.exists, data: () => state.data };
      },
      collection: (name: string) => this.makeCollectionRef(`${path}/${name}`),
    };
  }

  private makeCollectionRef(path: string) {
    return {
      doc: (id: string) => this.makeDocRef(`${path}/${id}`),
    };
  }

  db() {
    return { collection: (name: string) => this.makeCollectionRef(name) } as never;
  }
}

function seedOrg(
  fake: FakeFirestore,
  opts: { memberExists?: boolean; memberRole?: string; emailsEnabled?: boolean } = {},
): FakeFirestore {
  const { memberExists = true, memberRole = "editor", emailsEnabled = true } = opts;
  if (memberExists) {
    fake.setDocState(`organizations/${ORG_ID}/members/${CALLER_UID}`, {
      exists: true,
      data: { role: memberRole },
    });
  }
  fake.setDocState(`organizations/${ORG_ID}`, { exists: true, data: { name: ORG_NAME } });
  fake.setDocState("appConfig/global", { exists: true, data: { onboarding: { emailsEnabled } } });
  return fake;
}

function mockAuth(
  opts: {
    getUserByEmailImpl?: () => Promise<unknown>;
    createUserImpl?: () => Promise<unknown>;
    generatePasswordResetLinkImpl?: () => Promise<string>;
  } = {},
) {
  const getUserByEmail = vi.fn(
    opts.getUserByEmailImpl ??
      (async () => {
        throw { code: "auth/user-not-found" };
      }),
  );
  const createUser = vi.fn(opts.createUserImpl ?? (async () => ({ uid: "newUid" })));
  const generatePasswordResetLink = vi.fn(
    opts.generatePasswordResetLinkImpl ?? (async () => "https://app.example.com/reset/abc123"),
  );
  vi.mocked(getAuth).mockReturnValue({
    getUserByEmail,
    createUser,
    generatePasswordResetLink,
  } as never);
  return { getUserByEmail, createUser, generatePasswordResetLink };
}

function fakeRequest(
  overrides: {
    auth?: { uid: string } | null;
    data?: Partial<SendInviteOnboardingEmailRequest>;
  } = {},
): CallableRequest<SendInviteOnboardingEmailRequest> {
  const auth = overrides.auth === undefined ? { uid: CALLER_UID } : overrides.auth;
  return {
    auth: auth === null ? undefined : { uid: auth.uid },
    data: { orgId: ORG_ID, email: INVITEE_EMAIL, ...overrides.data },
  } as unknown as CallableRequest<SendInviteOnboardingEmailRequest>;
}

beforeEach(() => {
  resetAppConfigCacheForTest();
});

afterEach(() => {
  vi.mocked(getAuth).mockReset();
  vi.mocked(getFirestore).mockReset();
  mockSend.mockReset();
  mockSend.mockResolvedValue({ data: { id: "m1" } });
  fakeShareBaseUrl = "https://app.example.com";
});

// --- CALLER GATE -------------------------------------------------------------

describe("caller gate", () => {
  it("rejects an unauthenticated caller before any Auth or Resend call", async () => {
    mockAuth();
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    await expect(sendInviteOnboardingEmailHandler(fakeRequest({ auth: null }))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects an authenticated caller who is not a member of orgId", async () => {
    mockAuth();
    const fake = seedOrg(new FakeFirestore(), { memberExists: false });
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    await expect(sendInviteOnboardingEmailHandler(fakeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects a caller whose role is 'viewer'", async () => {
    mockAuth();
    const fake = seedOrg(new FakeFirestore(), { memberRole: "viewer" });
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    await expect(sendInviteOnboardingEmailHandler(fakeRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// --- DISABLED (R293) ---------------------------------------------------------

describe("disabled", () => {
  it("emailsEnabled=false short-circuits with kind 'skipped-disabled', no Auth or Resend call", async () => {
    const { getUserByEmail, createUser } = mockAuth();
    const fake = seedOrg(new FakeFirestore(), { emailsEnabled: false });
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(fakeRequest());

    expect(result).toEqual({ emailSent: false, kind: "skipped-disabled" });
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// --- GOOGLE (R289) ------------------------------------------------------------

describe("google", () => {
  it("Bob@GMAIL.com (case-insensitive): sends notify-only, no createUser, kind 'google-notify'", async () => {
    const { createUser } = mockAuth();
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(
      fakeRequest({ data: { email: "Bob@GMAIL.com" } }),
    );

    expect(result).toEqual({ emailSent: true, kind: "google-notify" });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(createUser).not.toHaveBeenCalled();
    const arg = mockSend.mock.calls[0]![0] as { to: string; text: string };
    expect(arg.to).toBe("bob@gmail.com");
    expect(arg.text.toLowerCase()).toContain("google");
  });

  it("x@googlemail.com: same notify-only path, no createUser", async () => {
    const { createUser } = mockAuth();
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(
      fakeRequest({ data: { email: "x@googlemail.com" } }),
    );

    expect(result).toEqual({ emailSent: true, kind: "google-notify" });
    expect(createUser).not.toHaveBeenCalled();
  });
});

// --- SET-PASSWORD / CREATEUSER (R290/R291) -----------------------------------

describe("set-password / createUser", () => {
  it("new user: getUserByEmail auth/user-not-found -> createUser -> generatePasswordResetLink -> send", async () => {
    const { getUserByEmail, createUser, generatePasswordResetLink } = mockAuth();
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(fakeRequest());

    expect(result).toEqual({ emailSent: true, kind: "set-password" });
    expect(getUserByEmail).toHaveBeenCalledWith(INVITEE_EMAIL);
    expect(createUser).toHaveBeenCalledWith({ email: INVITEE_EMAIL });
    expect(generatePasswordResetLink).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0]![0] as { text: string };
    expect(arg.text).toContain("https://app.example.com/reset/abc123");
    expect(arg.text.toLowerCase()).toContain("google");
  });

  it("existing user: getUserByEmail resolves -> createUser NOT called, link+send still happen", async () => {
    const { createUser, generatePasswordResetLink } = mockAuth({
      getUserByEmailImpl: async () => ({ uid: "existingUid" }),
    });
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(fakeRequest());

    expect(result).toEqual({ emailSent: true, kind: "set-password" });
    expect(createUser).not.toHaveBeenCalled();
    expect(generatePasswordResetLink).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("createUser races auth/email-already-exists: falls through to link+send, no throw", async () => {
    const { generatePasswordResetLink } = mockAuth({
      createUserImpl: async () => {
        throw { code: "auth/email-already-exists" };
      },
    });
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(fakeRequest());

    expect(result).toEqual({ emailSent: true, kind: "set-password" });
    expect(generatePasswordResetLink).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("createUser fails with a non-race code: handler throws HttpsError('internal', ...)", async () => {
    mockAuth({
      createUserImpl: async () => {
        throw { code: "auth/internal-error" };
      },
    });
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    await expect(sendInviteOnboardingEmailHandler(fakeRequest())).rejects.toMatchObject({
      code: "internal",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("getUserByEmail rejects a non-'auth/user-not-found' code: handler rejects", async () => {
    mockAuth({
      getUserByEmailImpl: async () => {
        throw { code: "auth/internal-error" };
      },
    });
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    await expect(sendInviteOnboardingEmailHandler(fakeRequest())).rejects.toMatchObject({
      code: "auth/internal-error",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("generatePasswordResetLink fails: handler throws HttpsError('internal', ...), no send", async () => {
    mockAuth({
      generatePasswordResetLinkImpl: async () => {
        throw new Error("link generation failed");
      },
    });
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    await expect(sendInviteOnboardingEmailHandler(fakeRequest())).rejects.toMatchObject({
      code: "internal",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("Resend send fails after Auth succeeded: best-effort, resolves emailSent:false (no throw)", async () => {
    mockAuth();
    mockSend.mockRejectedValueOnce(new Error("resend 500"));
    const fake = seedOrg(new FakeFirestore());
    vi.mocked(getFirestore).mockReturnValue(fake.db());

    const result = await sendInviteOnboardingEmailHandler(fakeRequest());

    expect(result).toEqual({ emailSent: false, kind: "set-password" });
  });
});

// --- EMAIL FORMAT --------------------------------------------------------------

describe("email format", () => {
  it("rejects an empty email with invalid-argument", async () => {
    await expect(
      sendInviteOnboardingEmailHandler(fakeRequest({ data: { email: "" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects an email with no '@' with invalid-argument", async () => {
    await expect(
      sendInviteOnboardingEmailHandler(fakeRequest({ data: { email: "not-an-email" } })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});
