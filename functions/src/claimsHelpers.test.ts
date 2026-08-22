import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "firebase-admin/auth";
import {
  clearClaimKeys,
  isClaimsTooLargeError,
  mergeAndSetCustomClaims,
  mergeSetAndClearCustomClaims,
  patchNestedClaimKey,
} from "./claimsHelpers";

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

describe("mergeSetAndClearCustomClaims", () => {
  it("clears the named keys and applies the set patch in a SINGLE setCustomUserClaims call (WR-01)", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { orgId: "orgA", role: "editor", orgs: { orgA: "editor", orgB: "viewer" }, superAdmin: true },
    });

    await mergeSetAndClearCustomClaims(UID, {
      set: { orgs: { orgB: "viewer" } },
      clear: ["orgId", "role"],
    });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      orgs: { orgB: "viewer" },
      superAdmin: true,
    });
  });

  it("passes null (not {}) when clearing leaves nothing remaining and set is empty", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { orgId: "orgA", role: "editor" } });

    await mergeSetAndClearCustomClaims(UID, { clear: ["orgId", "role"] });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, null);
  });

  it("works with only `set` and no `clear` -- behaves like mergeAndSetCustomClaims", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: { superAdmin: true } });

    await mergeSetAndClearCustomClaims(UID, { set: { orgId: "orgA", role: "editor" } });

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      superAdmin: true,
      orgId: "orgA",
      role: "editor",
    });
  });
});

describe("patchNestedClaimKey", () => {
  it("sets a nested key onto an empty/absent nested map", async () => {
    const { setCustomUserClaims } = mockAuth({ existingClaims: undefined });

    await patchNestedClaimKey(UID, "deactivatedOrgs", "orgA", true);

    expect(setCustomUserClaims).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { deactivatedOrgs: { orgA: true } });
  });

  it("sets a nested key alongside an EXISTING sibling nested key -- sibling survives", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { deactivatedOrgs: { orgB: true }, superAdmin: true },
    });

    await patchNestedClaimKey(UID, "deactivatedOrgs", "orgA", true);

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      deactivatedOrgs: { orgB: true, orgA: true },
      superAdmin: true,
    });
  });

  it("deletes one nested key while a sibling nested key and an unrelated top-level claim both survive", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: {
        deactivatedOrgs: { orgA: true, orgB: true },
        superAdmin: true,
        orgs: { orgA: "editor", orgB: "viewer" },
      },
    });

    await patchNestedClaimKey(UID, "deactivatedOrgs", "orgA", undefined);

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, {
      deactivatedOrgs: { orgB: true },
      superAdmin: true,
      orgs: { orgA: "editor", orgB: "viewer" },
    });
  });

  it("deleting the last remaining nested key leaves an empty object, not null", async () => {
    const { setCustomUserClaims } = mockAuth({
      existingClaims: { deactivatedOrgs: { orgA: true }, superAdmin: true },
    });

    await patchNestedClaimKey(UID, "deactivatedOrgs", "orgA", undefined);

    expect(setCustomUserClaims).toHaveBeenCalledWith(UID, { deactivatedOrgs: {}, superAdmin: true });
  });

  it("deactivate-then-reactivate round trip for the SAME uid preserves superAdmin/orgs/a sibling deactivatedOrgs entry", async () => {
    // Deactivate orgA -- starting from a claims object that already has a
    // sibling deactivated org and an unrelated superAdmin claim.
    const { setCustomUserClaims: setDeactivate } = mockAuth({
      existingClaims: { superAdmin: true, orgs: { orgA: "editor", orgB: "editor" }, deactivatedOrgs: { orgB: true } },
    });
    await patchNestedClaimKey(UID, "deactivatedOrgs", "orgA", true);
    expect(setDeactivate).toHaveBeenCalledWith(UID, {
      superAdmin: true,
      orgs: { orgA: "editor", orgB: "editor" },
      deactivatedOrgs: { orgB: true, orgA: true },
    });

    // Reactivate orgA -- from the claims state the deactivate call above produced.
    const { setCustomUserClaims: setReactivate } = mockAuth({
      existingClaims: { superAdmin: true, orgs: { orgA: "editor", orgB: "editor" }, deactivatedOrgs: { orgB: true, orgA: true } },
    });
    await patchNestedClaimKey(UID, "deactivatedOrgs", "orgA", undefined);
    expect(setReactivate).toHaveBeenCalledWith(UID, {
      superAdmin: true,
      orgs: { orgA: "editor", orgB: "editor" },
      deactivatedOrgs: { orgB: true },
    });
  });
});

describe("isClaimsTooLargeError", () => {
  it("returns true for an error with code 'auth/claims-too-large'", () => {
    expect(isClaimsTooLargeError({ code: "auth/claims-too-large" })).toBe(true);
    expect(isClaimsTooLargeError(Object.assign(new Error("too big"), { code: "auth/claims-too-large" }))).toBe(
      true,
    );
  });

  it("returns false for other error shapes", () => {
    expect(isClaimsTooLargeError(new Error("boom"))).toBe(false);
    expect(isClaimsTooLargeError({ code: "auth/user-not-found" })).toBe(false);
    expect(isClaimsTooLargeError(undefined)).toBe(false);
    expect(isClaimsTooLargeError("auth/claims-too-large")).toBe(false);
  });
});
