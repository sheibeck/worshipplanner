import { describe, expect, it, vi } from "vitest";
import { BadRequestError, validateRenderBody, handleRenderRequest } from "./server";
import type { RenderRequest, RenderResult } from "./render";

describe("validateRenderBody", () => {
  const validBody = { orgId: "orgA", importId: "import1", storagePath: "orgs/orgA/pptx-imports/import1/source.pptx" };

  it("returns a trimmed RenderRequest for a fully valid body", () => {
    const req = validateRenderBody(validBody);
    expect(req).toEqual(validBody);
  });

  it("throws BadRequestError when orgId is missing", () => {
    const { orgId, ...rest } = validBody;
    expect(() => validateRenderBody(rest)).toThrow(BadRequestError);
  });

  it("throws BadRequestError when storagePath is not a string", () => {
    expect(() => validateRenderBody({ ...validBody, storagePath: 12345 })).toThrow(BadRequestError);
  });

  it("throws BadRequestError when importId is an empty string", () => {
    expect(() => validateRenderBody({ ...validBody, importId: "   " })).toThrow(BadRequestError);
  });

  it("throws BadRequestError for a non-object body", () => {
    expect(() => validateRenderBody(null)).toThrow(BadRequestError);
    expect(() => validateRenderBody("a string")).toThrow(BadRequestError);
  });
});

describe("handleRenderRequest", () => {
  const validBody = { orgId: "orgA", importId: "import1", storagePath: "orgs/orgA/pptx-imports/import1/source.pptx" };

  it("returns 400 with a generic error body when validation fails", async () => {
    const render = vi.fn();
    const { status, payload } = await handleRenderRequest({ orgId: "orgA" }, render);
    expect(status).toBe(400);
    expect(payload).toEqual({ error: "invalid request" });
    expect(render).not.toHaveBeenCalled();
  });

  it("returns 200 with the stub render function's renderedCount on success", async () => {
    const render = vi.fn(async () => ({ renderedCount: 7, pageNumbers: [1, 2, 3, 4, 5, 6, 7] }) as RenderResult);
    const { status, payload } = await handleRenderRequest(validBody, render);
    expect(status).toBe(200);
    expect(payload).toEqual({ renderedCount: 7 });
  });

  it("passes exactly {orgId, importId, storagePath} through to the render function, with no extra fields", async () => {
    const render = vi.fn(async (_req: RenderRequest) => ({ renderedCount: 1, pageNumbers: [1] }) as RenderResult);
    await handleRenderRequest({ ...validBody, extraField: "should not pass through" }, render);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith({
      orgId: "orgA",
      importId: "import1",
      storagePath: "orgs/orgA/pptx-imports/import1/source.pptx",
    });
  });

  it("returns a generic 500 body that does NOT contain the underlying error's message when render rejects", async () => {
    const secretDetail = "very specific internal path or stack trace leak /tmp/secret-workdir-abc123";
    const render = vi.fn(async () => {
      throw new Error(secretDetail);
    });
    const { status, payload } = await handleRenderRequest(validBody, render);
    expect(status).toBe(500);
    expect(payload).toEqual({ error: "render failed" });
    expect(JSON.stringify(payload)).not.toContain(secretDetail);
  });
});
