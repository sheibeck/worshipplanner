import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { parsePptxBuffer, type MappedSlide } from "./pptxParser";

// Server-held secrets (Google Secret Manager). Set once with:
//   firebase functions:secrets:set CLAUDE_API_KEY
//   firebase functions:secrets:set ESV_API_KEY
// These are NEVER shipped to the browser — that is the whole point of this proxy.
const CLAUDE_API_KEY = defineSecret("CLAUDE_API_KEY");
const ESV_API_KEY = defineSecret("ESV_API_KEY");

if (!getApps().length) {
  initializeApp();
}

const PROXY_TARGETS: Record<string, string> = {
  planningcenter: "https://api.planningcenteronline.com",
  anthropic: "https://api.anthropic.com",
  esv: "https://api.esv.org",
};

// Services where THIS proxy injects one of our own secrets. Because we spend our
// own money/quota on these, they must not be an open relay — the caller has to be
// a signed-in app user (verified Firebase ID token in X-App-Auth).
const SECRET_INJECTED = new Set(["anthropic", "esv"]);

// Headers we forward from the client to the upstream API. Note: `x-api-key` and
// `authorization` for secret-injected services are overwritten below, never trusted
// from the client.
const FORWARDED_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-api-key",
  "anthropic-version",
  "anthropic-dangerous-direct-browser-access",
];

async function callerIsAuthenticated(idToken: string | undefined): Promise<boolean> {
  if (!idToken) return false;
  try {
    await getAuth().verifyIdToken(idToken);
    return true;
  } catch {
    return false;
  }
}

export const api = onRequest(
  { secrets: [CLAUDE_API_KEY, ESV_API_KEY] },
  async (req, res) => {
    // Extract service name from /api/<service>/...
    const match = req.path.match(/^\/api\/(\w+)(\/.*)?$/);
    if (!match || !match[1]) {
      res.status(404).json({ error: "Unknown route" });
      return;
    }

    const service = match[1];
    const target = PROXY_TARGETS[service];
    if (!target) {
      res.status(404).json({ error: `Unknown proxy target: ${service}` });
      return;
    }

    // Gate the secret-bearing routes: only signed-in app users may spend our keys.
    if (SECRET_INJECTED.has(service)) {
      const appToken = req.headers["x-app-auth"];
      const token = typeof appToken === "string" ? appToken : undefined;
      if (!(await callerIsAuthenticated(token))) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
    }

    // Strip /api/<service> prefix to get the upstream path
    const prefix = `/api/${service}`;
    const upstreamPath = req.originalUrl.replace(prefix, "");
    const upstreamUrl = `${target}${upstreamPath}`;

    // Forward relevant headers
    const headers: Record<string, string> = {};
    for (const h of FORWARDED_HEADERS) {
      const val = req.headers[h];
      if (typeof val === "string") {
        headers[h] = val;
      }
    }
    // Never allow the client's app-identity token to leak upstream.
    delete headers["x-app-auth"];

    // Inject our server-held credentials, overwriting anything the client sent.
    if (service === "anthropic") {
      headers["x-api-key"] = CLAUDE_API_KEY.value();
      if (!headers["anthropic-version"]) {
        headers["anthropic-version"] = "2023-06-01";
      }
    } else if (service === "esv") {
      headers["authorization"] = `Token ${ESV_API_KEY.value()}`;
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : JSON.stringify(req.body),
      });

      res.status(upstream.status);
      const ct = upstream.headers.get("content-type");
      if (ct) res.set("content-type", ct);

      const body = await upstream.text();
      res.send(body);
    } catch (err) {
      console.error("Proxy error:", err);
      res.status(502).json({ error: "Upstream request failed" });
    }
  },
);

interface ParsePptxRequestData {
  orgId?: string;
  importId?: string;
  storagePath?: string;
}

/**
 * The parsePptx handler body, exported separately from the `onCall` wrapper
 * so tests can invoke it directly with a fake CallableRequest without needing
 * the full Firebase Functions test harness.
 *
 * Security contract (21-04 threat model T-21-04-01/T-21-04-04):
 * - Requires Firebase Auth (request.auth).
 * - storagePath must be prefixed with the caller-claimed orgs/{orgId}/pptx-imports/.
 * - request.auth.uid's org membership is independently re-verified via a
 *   Firestore read (organizations/{orgId}/members/{uid}) -- the client-declared
 *   orgId is never trusted alone, matching firestore.rules' isOrgMember pattern.
 * - Returns Storage PATHS for extracted images (never signed URLs); the client
 *   resolves getDownloadURL() under storage.rules' org gate.
 * - On any parse failure, throws a friendly HttpsError and never deletes the
 *   source object at storagePath -- this function never issues a delete call
 *   at all, on any path (CONTEXT D004 / 21-RESEARCH.md Pitfall 5).
 */
export async function parsePptxHandler(
  request: CallableRequest<ParsePptxRequestData>,
): Promise<{ slides: MappedSlide[] }> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const { orgId, importId, storagePath } = request.data ?? {};
  if (!orgId || !importId || !storagePath) {
    throw new HttpsError(
      "invalid-argument",
      "orgId, importId, and storagePath are all required.",
    );
  }

  // Defense in depth: the storage path must live under this org's own prefix.
  if (!storagePath.startsWith(`orgs/${orgId}/pptx-imports/`)) {
    throw new HttpsError("permission-denied", "Invalid storage path for this organization.");
  }

  // Independent org-membership check -- never trust the client-declared orgId
  // alone, even though storage.rules also enforces this at the Storage layer.
  const memberDoc = await getFirestore()
    .collection("organizations")
    .doc(orgId)
    .collection("members")
    .doc(request.auth.uid)
    .get();
  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this organization.");
  }

  try {
    const bucket = getStorage().bucket();
    const [buffer] = await bucket.file(storagePath).download();
    const slides = await parsePptxBuffer(buffer, orgId, importId);
    return { slides };
  } catch (err) {
    console.error("parsePptx failed:", err);
    throw new HttpsError(
      "invalid-argument",
      "We couldn't read this file — try re-exporting from PowerPoint.",
    );
    // storagePath is never deleted here, on this or any other path.
  }
}

export const parsePptx = onCall(
  { memory: "1GiB", timeoutSeconds: 120 },
  parsePptxHandler,
);
