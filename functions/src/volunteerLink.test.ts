import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAppConfig, DEFAULT_APP_CONFIG } from "./appConfig";
import { mintAndSendVolunteerLink } from "./volunteerLink";

// Phase 128, Task 1 -- unit tests for the shared mint/send core in isolation.
// Mocks mirror index.test.ts's harness shape (getAuth / Resend / appConfig).

const MINTED_LINK = "https://example.com/volunteer/verify?slug=grace-church&apiKey=fake&oobCode=abc&mode=signIn";

interface FakeActionCodeSettings {
  url: string;
  handleCodeInApp: boolean;
}
interface FakeSendArgs {
  from: string;
  to: string;
  subject: string;
  text: string;
}

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(async (_args: FakeSendArgs) => ({ data: { id: "email-1" } })),
}));
const { mockGenerateLink } = vi.hoisted(() => ({
  mockGenerateLink: vi.fn(
    async (_email: string, _settings: FakeActionCodeSettings) =>
      "https://example.com/volunteer/verify?slug=grace-church&apiKey=fake&oobCode=abc&mode=signIn",
  ),
}));

let fakeShareBaseUrl = "https://example.com";

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    generateSignInWithEmailLink: mockGenerateLink,
  })),
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({ value: () => "fake-resend-key" })),
  defineString: vi.fn(() => ({ value: () => fakeShareBaseUrl })),
}));

vi.mock("resend", () => ({
  // A regular function (not an arrow) so `new Resend(key)` constructs cleanly.
  Resend: vi.fn(function () {
    return { emails: { send: mockSend } };
  }),
}));

vi.mock("./appConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./appConfig")>();
  return { ...actual, getAppConfig: vi.fn() };
});

beforeEach(() => {
  vi.mocked(getAppConfig).mockResolvedValue(DEFAULT_APP_CONFIG);
  fakeShareBaseUrl = "https://example.com";
});
afterEach(() => {
  vi.mocked(getAppConfig).mockReset();
  mockSend.mockClear();
  mockGenerateLink.mockClear();
});

describe("mintAndSendVolunteerLink", () => {
  const db = {} as never;

  it("mints via generateSignInWithEmailLink with a url ending /volunteer/verify?slug=... before Firebase's own params, and sends exactly once", async () => {
    await mintAndSendVolunteerLink({
      db,
      to: "vol@example.com",
      orgName: "Grace Church",
      slug: "grace-church",
    });

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    const [calledEmail, settings] = mockGenerateLink.mock.calls[0];
    expect(calledEmail).toBe("vol@example.com");
    expect(settings.handleCodeInApp).toBe(true);
    expect(settings.url).toBe("https://example.com/volunteer/verify?slug=grace-church");
    expect(settings.url).toContain("/volunteer/verify?slug=");

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("sends a standalone subject/body (NOT a service-reminder template), embedding the minted link", async () => {
    await mintAndSendVolunteerLink({
      db,
      to: "vol@example.com",
      orgName: "Grace Church",
      slug: "grace-church",
    });

    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.to).toBe("vol@example.com");
    expect(sendArgs.subject).not.toMatch(/reminder/i);
    expect(sendArgs.subject).not.toMatch(/added as an admin/i);
    expect(sendArgs.subject).not.toMatch(/invited/i);
    expect(sendArgs.subject).toMatch(/Grace Church/);
    expect(sendArgs.text).toContain(MINTED_LINK);
  });

  it("builds a header-safe From using bareEmailAddress + fromDisplayName(orgName)", async () => {
    vi.mocked(getAppConfig).mockResolvedValue({
      ...DEFAULT_APP_CONFIG,
      sender: { ...DEFAULT_APP_CONFIG.sender, fromAddress: "Old Name <noreply@example.com>" },
    });

    await mintAndSendVolunteerLink({
      db,
      to: "vol@example.com",
      orgName: 'Grace "Community" Church\r\nBcc: evil@example.com',
      slug: "grace-church",
    });

    const sendArgs = mockSend.mock.calls[0][0];
    // bareEmailAddress peels the pre-existing display name off the configured
    // address so wrapping never nests angle brackets.
    expect(sendArgs.from).toContain("noreply@example.com");
    expect(sendArgs.from).not.toContain("Old Name <noreply@example.com>>");
    // fromDisplayName strips CR/LF (header-injection defense) and quotes out
    // of the DISPLAY NAME itself -- the only two quote chars in the whole
    // header are the wrapping quoted-string delimiters, never a nested/broken quote.
    expect(sendArgs.from).not.toMatch(/[\r\n]/);
    expect(sendArgs.from.split('"').length - 1).toBe(2);
    expect(sendArgs.from).toBe('"Grace Community Church Bcc: evil@example.com" <noreply@example.com>');
  });

  it("handles a blank/unconfigured SERVICE_SHARE_BASE_URL without throwing -- mint still proceeds with a full verify URL", async () => {
    fakeShareBaseUrl = "";

    await expect(
      mintAndSendVolunteerLink({ db, to: "vol@example.com", orgName: "Grace Church", slug: "grace-church" }),
    ).resolves.toBeUndefined();

    const [, settings] = mockGenerateLink.mock.calls[0];
    expect(settings.url).toBe("/volunteer/verify?slug=grace-church");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
