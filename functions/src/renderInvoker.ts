import { GoogleAuth } from "google-auth-library";

/** See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/renderInvoker.ts) */

export interface InvokeRenderServiceArgs {
  orgId: string;
  importId: string;
  storagePath: string;
  /** The Cloud Run service's own base URL, e.g. https://pptx-render-xyz.run.app */
  renderServiceUrl: string;
}

export interface RenderServiceResponse {
  renderedCount: number;
}

/** Generous timeout for a LibreOffice + Poppler conversion on a private Cloud Run service. */
export const RENDER_REQUEST_TIMEOUT_MS = 240_000;

export async function invokeRenderService(
  args: InvokeRenderServiceArgs,
): Promise<RenderServiceResponse> {
  const { orgId, importId, storagePath, renderServiceUrl } = args;

  // No fallback, by design: a missing/blank URL throws rather than degrading
  // to an unauthenticated fetch. There is no code path in this module that
  // can reach the network without first obtaining an ID-token client.
  if (!renderServiceUrl || renderServiceUrl.trim() === "") {
    throw new Error(
      "invokeRenderService: renderServiceUrl is required -- refusing to call " +
        "the render service unauthenticated. There is no fallback path.",
    );
  }

  // The audience MUST be the service URL exactly -- NOT the /render path.
  // Cloud Run validates the ID token's `aud` claim against its own service
  // URL before the request ever reaches application code, so an audience
  // mismatch here fails closed at the platform layer, not in our code.
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(renderServiceUrl);

  const res = await client.request<RenderServiceResponse>({
    url: `${renderServiceUrl}/render`,
    method: "POST",
    data: { orgId, importId, storagePath },
    timeout: RENDER_REQUEST_TIMEOUT_MS,
  });

  return res.data;
}
