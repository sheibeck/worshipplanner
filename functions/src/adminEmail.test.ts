import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppConfig } from "./appConfig";
import { sendAdminOnboardingEmail } from "./adminEmail";

// Quick task 260823: unit-test the REAL From/subject/body construction of the
// admin-onboarding email helper. Mirrors index.test.ts's send-path mocking:
// - "resend" is fully mocked (a hoisted mockSend) so no real email is sent,
// - "firebase-functions/params" is mocked so params.ts's RESEND_API_KEY.value()
//   and SERVICE_SHARE_BASE_URL.value() resolve to test seams (the pure
//   bareEmailAddress/fromDisplayName helpers in params.ts stay REAL),
// - getAppConfig is mocked so each case injects its own sender.fromAddress.

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn(async () => ({ data: { id: "m1" } })) }));

// Per-test seam the mocked defineString reads for SERVICE_SHARE_BASE_URL.
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
vi.mock("./appConfig", () => ({
  getAppConfig: vi.fn(),
}));

const FAKE_DB = { __fakeDb: true } as never;

function mockConfig(fromAddress: string) {
  vi.mocked(getAppConfig).mockResolvedValue({
    sender: { fromName: "", fromAddress },
  } as never);
}

afterEach(() => {
  mockSend.mockClear();
  vi.mocked(getAppConfig).mockReset();
  fakeShareBaseUrl = "https://app.example.com";
});

describe("sendAdminOnboardingEmail", () => {
  it("kind='added': subject + org-name From over the configured bare address + app link", async () => {
    mockConfig("onboarding@resend.dev");

    await sendAdminOnboardingEmail({
      db: FAKE_DB,
      to: "admin@church.org",
      orgName: "Grace Church",
      kind: "added",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0]![0] as { from: string; to: string; subject: string; text: string };
    expect(arg.from).toBe('"Grace Church" <onboarding@resend.dev>');
    expect(arg.to).toBe("admin@church.org");
    expect(arg.subject).toBe("You've been added as an admin to Grace Church");
    expect(arg.text).toContain("added as an admin to Grace Church");
    expect(arg.text).toContain("https://app.example.com");
  });

  it("kind='invited': distinct subject telling them to sign in WITH THIS EMAIL", async () => {
    mockConfig("onboarding@resend.dev");

    await sendAdminOnboardingEmail({
      db: FAKE_DB,
      to: "newadmin@church.org",
      orgName: "Grace Church",
      kind: "invited",
    });

    const arg = mockSend.mock.calls[0]![0] as { subject: string; text: string };
    expect(arg.subject).toBe("You've been invited to Grace Church on Worship Planner");
    expect(arg.text).toContain("newadmin@church.org");
    expect(arg.text.toLowerCase()).toContain("sign in");
  });

  it("omits the app link gracefully when SERVICE_SHARE_BASE_URL is blank (no broken URL, no 'undefined')", async () => {
    fakeShareBaseUrl = "";
    mockConfig("onboarding@resend.dev");

    await sendAdminOnboardingEmail({
      db: FAKE_DB,
      to: "admin@church.org",
      orgName: "Grace Church",
      kind: "added",
    });

    const arg = mockSend.mock.calls[0]![0] as { text: string };
    expect(arg.text).not.toContain("http");
    expect(arg.text).not.toContain("undefined");
    expect(arg.text).toContain("Sign in to Worship Planner");
  });

  it("peels a legacy decorated fromAddress so the From never nests angle brackets", async () => {
    mockConfig("Old Name <noreply@verified.org>");

    await sendAdminOnboardingEmail({
      db: FAKE_DB,
      to: "admin@church.org",
      orgName: "Grace Church",
      kind: "added",
    });

    const arg = mockSend.mock.calls[0]![0] as { from: string };
    expect(arg.from).toBe('"Grace Church" <noreply@verified.org>');
  });

  it("sanitizes CR/LF/quote header-injection chars out of the org display name", async () => {
    mockConfig("noreply@verified.org");

    await sendAdminOnboardingEmail({
      db: FAKE_DB,
      to: "admin@church.org",
      orgName: 'Evil"\r\nBcc: victim@x.com',
      kind: "added",
    });

    const arg = mockSend.mock.calls[0]![0] as { from: string };
    expect(arg.from).not.toContain("\r");
    expect(arg.from).not.toContain("\n");
    // The stray double-quote is stripped so it can't break the quoted-string;
    // the CR/LF collapses to a single space.
    expect(arg.from).toBe('"Evil Bcc: victim@x.com" <noreply@verified.org>');
  });

  it("propagates a send rejection so the caller can record emailSent=false", async () => {
    mockConfig("onboarding@resend.dev");
    mockSend.mockRejectedValueOnce(new Error("resend 500"));

    await expect(
      sendAdminOnboardingEmail({
        db: FAKE_DB,
        to: "admin@church.org",
        orgName: "Grace Church",
        kind: "added",
      }),
    ).rejects.toThrow("resend 500");
  });
});
