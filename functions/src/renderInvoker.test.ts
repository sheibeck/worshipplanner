import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getIdTokenClient = vi.fn();
const requestSpy = vi.fn();

vi.mock("google-auth-library", () => ({
  GoogleAuth: vi.fn().mockImplementation(function FakeGoogleAuth(this: {
    getIdTokenClient: typeof getIdTokenClient;
  }) {
    this.getIdTokenClient = getIdTokenClient;
  }),
}));

import { GoogleAuth } from "google-auth-library";
import {
  invokeRenderService,
  RENDER_REQUEST_TIMEOUT_MS,
} from "./renderInvoker";

const SERVICE_URL = "https://pptx-render-abc123.run.app";

describe("invokeRenderService", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(GoogleAuth).mockClear();
    getIdTokenClient.mockReset();
    requestSpy.mockReset();
    getIdTokenClient.mockResolvedValue({ request: requestSpy });
    requestSpy.mockResolvedValue({ data: { renderedCount: 3 } });
    // Every test can assert this was never called -- there is no
    // unauthenticated fallback path in invokeRenderService.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("globalThis.fetch must never be called by invokeRenderService");
    });
  });

  afterEach(() => {
    // Belt-and-suspenders: across every test in this suite, fetch was never
    // actually invoked (case 6). Individual tests also assert this inline.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("case 1: calls getIdTokenClient exactly once, with the bare service URL as its only argument", async () => {
    await invokeRenderService({
      orgId: "org1",
      importId: "import1",
      storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
      renderServiceUrl: SERVICE_URL,
    });

    expect(getIdTokenClient).toHaveBeenCalledTimes(1);
    expect(getIdTokenClient).toHaveBeenCalledWith(SERVICE_URL);
    // Specifically NOT with the URL plus /render.
    expect(getIdTokenClient).not.toHaveBeenCalledWith(`${SERVICE_URL}/render`);
  });

  it("case 2: client.request receives POST, {serviceUrl}/render, the exact data fields, and the configured timeout", async () => {
    await invokeRenderService({
      orgId: "org1",
      importId: "import1",
      storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
      renderServiceUrl: SERVICE_URL,
    });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const call = requestSpy.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.url).toBe(`${SERVICE_URL}/render`);
    expect(call.timeout).toBe(240_000);
    expect(RENDER_REQUEST_TIMEOUT_MS).toBe(240_000);
    expect(call.data).toEqual({
      orgId: "org1",
      importId: "import1",
      storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
    });
    expect(Object.keys(call.data)).toHaveLength(3);
  });

  it("case 3: returns the resolved renderedCount unchanged", async () => {
    requestSpy.mockResolvedValue({ data: { renderedCount: 7 } });

    const result = await invokeRenderService({
      orgId: "org1",
      importId: "import1",
      storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
      renderServiceUrl: SERVICE_URL,
    });

    expect(result).toEqual({ renderedCount: 7 });
  });

  it("case 4: an empty renderServiceUrl rejects, never calls getIdTokenClient, and never calls fetch", async () => {
    await expect(
      invokeRenderService({
        orgId: "org1",
        importId: "import1",
        storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
        renderServiceUrl: "",
      }),
    ).rejects.toThrow();

    expect(getIdTokenClient).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("case 5: a whitespace-only renderServiceUrl behaves identically to the empty-string case", async () => {
    await expect(
      invokeRenderService({
        orgId: "org1",
        importId: "import1",
        storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
        renderServiceUrl: "   ",
      }),
    ).rejects.toThrow();

    expect(getIdTokenClient).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("case 6: globalThis.fetch is never called by a successful invocation (also re-checked in afterEach for every test)", async () => {
    await invokeRenderService({
      orgId: "org1",
      importId: "import1",
      storagePath: "orgs/org1/pptx-imports/import1/source.pptx",
      renderServiceUrl: SERVICE_URL,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("case 7: source inspection -- no bare HTTP-client call exists outside of comments", () => {
    const source = readFileSync(path.join(__dirname, "renderInvoker.ts"), "utf-8");
    const codeOnly = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");

    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/require\(["']https?["']\)/);
  });
});
