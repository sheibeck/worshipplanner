import { GoogleAuth } from "google-auth-library";

/**
 * The single, mockable seam that mints a Google-issued ID token and invokes
 * the private "pptx-render" Cloud Run service (R062: bridging function's
 * IAM-authenticated invocation of a Cloud Run service).
 *
 * ★ Security contract (37-RESEARCH.md T-37-09, "no unauthenticated fallback"):
 * this module NEVER calls `globalThis.fetch` or any bare HTTP client. The
 * only egress is `client.request(...)` on the client returned by
 * `GoogleAuth#getIdTokenClient`. An unauthenticated call to a service that is
 * supposed to be private is a strictly worse outcome than a failed render --
 * a failed render is already handled safely elsewhere (the parsed text layer
 * stays usable), so there is deliberately no degrade-to-plain-fetch path.
 */

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
