// render-service/src/server.ts
//
// The Cloud Run service's single HTTP surface: POST /render. Route logic is factored into
// plain, socket-free functions (validateRenderBody, handleRenderRequest) so they are testable
// without binding a port and without adding a new HTTP test dependency (no supertest).
import express, { type Express } from "express";
import { renderPptxToImages, type RenderRequest, type RenderResult } from "./render";

export class BadRequestError extends Error {}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Validates the untrusted JSON body crossing the bridging-function -> Cloud Run trust
// boundary (T-37-04). Only orgId/importId/storagePath are extracted -- any extra fields on
// the body are dropped, never passed through to renderPptxToImages.
export function validateRenderBody(body: unknown): RenderRequest {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("request body must be an object");
  }
  const { orgId, importId, storagePath } = body as Record<string, unknown>;
  if (!isNonEmptyString(orgId)) {
    throw new BadRequestError("orgId is required");
  }
  if (!isNonEmptyString(importId)) {
    throw new BadRequestError("importId is required");
  }
  if (!isNonEmptyString(storagePath)) {
    throw new BadRequestError("storagePath is required");
  }
  return {
    orgId: orgId.trim(),
    importId: importId.trim(),
    storagePath: storagePath.trim(),
  };
}

// Maps validation/render outcomes to an HTTP status + payload. The caller here is always the
// bridging Cloud Function (IAM-authenticated by the platform before this code ever runs) --
// but per T-37-07, error responses still never leak the underlying error's message or stack.
// Real errors are logged server-side with console.error only.
export async function handleRenderRequest(
  body: unknown,
  render: (req: RenderRequest) => Promise<RenderResult>,
): Promise<{ status: number; payload: unknown }> {
  let req: RenderRequest;
  try {
    req = validateRenderBody(body);
  } catch (err) {
    if (err instanceof BadRequestError) {
      console.error("render request validation failed:", err);
      return { status: 400, payload: { error: "invalid request" } };
    }
    throw err;
  }

  try {
    const result = await render(req);
    return { status: 200, payload: { renderedCount: result.renderedCount } };
  } catch (err) {
    console.error("render failed:", err);
    return { status: 500, payload: { error: "render failed" } };
  }
}

// createApp never calls listen() -- that keeps this module import-safe in tests (no socket
// bound just by importing it). main.ts is the only module that binds a port.
export function createApp(render: (req: RenderRequest) => Promise<RenderResult> = renderPptxToImages): Express {
  const app = express();
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/render", (req, res) => {
    void handleRenderRequest(req.body, render).then(({ status, payload }) => {
      res.status(status).json(payload);
    });
  });

  return app;
}
