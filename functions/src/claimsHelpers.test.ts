import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import { clearClaimKeys, mergeAndSetCustomClaims } from "./claimsHelpers";

// Mirrors orgMembershipClaims.test.ts's established mocking seam.
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ setCustomUserClaims: vi.fn(), getUser: vi.fn() })),
}));

function mockAuth(opts: { existingClaims?: Record<string, unknown> } = {}) {
  const setCustomUserClaims = vi.fn(async () => undefined);
  const getUser = vi.fn(async () => ({ customClaims: opts.existingClaims }));
  vi.mocked(getAuth).mockReturnValue({ setCustomUserClaims, getUser } as never);
  return { setCustomUserClaims, getUser };
}

afterEach(() => {
  vi.mocked(getAuth).mockReset();
});

const UID = "u1";

describe("mergeAndSetCustomClaims", () => {
  it("shallow-merges the patch onto existing claims, preserving unrelated keys", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: "orgA", role: "editor" } });

    await mergeAndSetCustomClaims(UID, { superAdmin: true });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgId: "orgA",
      role: "editor",
      superAdmin: true,
    });
  });

  it("writes just the patch when there are no existing claims", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    await mergeAndSetCustomClaims(UID, { superAdmin: true });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { superAdmin: true });
  });

  it("patch keys overwrite existing keys of the same name", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: "orgA", role: "editor" } });

    await mergeAndSetCustomClaims(UID, { role: "viewer" });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { orgId: "orgA", role: "viewer" });
  });
});

describe("clearClaimKeys", () => {
  it("removes only the named keys, preserving unrelated claims", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: "orgA", role: "editor", superAdmin: true },
    });

    await clearClaimKeys(UID, ["orgId", "role"]);

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { superAdmin: true });
  });

  it("passes null (not {}) when the clear leaves nothing remaining", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { superAdmin: true } });

    await clearClaimKeys(UID, ["superAdmin"]);

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, null);
  });

  it("passes null when there were no existing claims to begin with", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    await clearClaimKeys(UID, ["orgId"]);

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, null);
  });
});
