import { describe, expect, it, vi } from "vitest";
import { defineString } from "firebase-functions/params";
import { SERVICE_SHARE_BASE_URL } from "./params";

// R449: the share-link default is the new origin. See ADR-0247
// (docs/adr/0247-app-home-is-worshipbuilder-web-app-old-addresses-redirect.md)

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({ value: () => "" })),
  defineString: vi.fn((_name: string, opts?: { default?: string }) => ({
    value: () => opts?.default ?? "",
  })),
}));

describe("params SERVICE_SHARE_BASE_URL default (R449)", () => {
  it("declares the param with the new origin as its default", () => {
    expect(vi.mocked(defineString)).toHaveBeenCalledWith("SERVICE_SHARE_BASE_URL", {
      default: "https://worshipbuilder.web.app",
    });
    expect((SERVICE_SHARE_BASE_URL as unknown as { value: () => string }).value()).toBe(
      "https://worshipbuilder.web.app",
    );
  });
});
