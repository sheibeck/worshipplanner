import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
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

// --- cleanupExpiredMedia (R015: 2-week Storage retention) ---------------
//
// SAFETY CONTRACT (see 22-03 threat model, T-22-03-01..05):
// - MEDIA_PATH_GUARD is applied to every candidate BEFORE any delete decision.
//   Only objects under orgs/{orgId}/media/ are ever eligible; pptx-imports and
//   every other Storage path are structurally excluded, even when old.
// - getFiles() is scoped with prefix "orgs/" -- never the bucket root -- as a
//   second, independent bound on the blast radius.
// - Age is keyed on the object's native GCS `timeCreated` (server-set at
//   upload time), NEVER on client-settable custom metadata -- a user cannot
//   backdate metadata to force-expire another org's media early.
// - This handler imports NO Firestore API at all. It is structurally
//   incapable of touching slide documents, slot metadata, or slide text --
//   it can only ever list/delete Storage objects.
// - FAILS SAFE: deletion requires an explicit opt-in, MEDIA_CLEANUP_ENABLED="true".
//   With it unset (or any other value) the run is a dry-run: it scans and logs
//   what WOULD be deleted and deletes nothing. A human must review a dry-run
//   before enabling live deletion.
//
//   History: this shipped in 22-03 gated on `MEDIA_CLEANUP_DRY_RUN === "true"`,
//   which meant an UNSET env var produced LIVE deletion -- while the comment here
//   claimed the opposite. A destructive daily scheduled job must default to safe,
//   so the gate was inverted to an explicit enable. `MEDIA_CLEANUP_DRY_RUN` is no
//   longer read at all; setting it has no effect.
// - Idempotent by age: deletion eligibility depends only on an object's own
//   timeCreated vs "now", never on prior-run state, so a partially-failed run
//   is safely retried by the next daily invocation. Per-file deletes are each
//   wrapped in try/catch so one failure never aborts the whole run.

/** Objects are only eligible for cleanup once older than this many days. */
export const RETENTION_DAYS = 14;

/**
 * Hard path guard: matches ONLY object names under orgs/{orgId}/media/.
 * Anything else (pptx-imports, or any future non-media path) never reaches
 * the delete decision, regardless of age.
 */
export const MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//;

export interface CleanupSummary {
  scannedCount: number;
  deletedCount: number;
  dryRun: boolean;
}

/**
 * The cleanupExpiredMedia handler body, exported separately from the
 * `onSchedule` wrapper (mirroring parsePptxHandler/parsePptx) so it can be
 * unit-tested directly against a mocked bucket.
 */
export async function cleanupExpiredMediaHandler(): Promise<CleanupSummary> {
  // Fail safe: only an explicit opt-in enables real deletion. Anything else --
  // unset, empty, "false", a typo -- leaves this a dry run.
  const dryRun = process.env.MEDIA_CLEANUP_ENABLED !== "true";
  const bucket = getStorage().bucket();
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  let scannedCount = 0;
  let deletedCount = 0;

  const [files] = await bucket.getFiles({
    prefix: "orgs/",
    autoPaginate: true,
  });

  for (const file of files) {
    // Hard safety gate: never consider anything outside orgs/{orgId}/media/,
    // no matter how old it is (excludes pptx-imports and any other path).
    if (!MEDIA_PATH_GUARD.test(file.name)) {
      continue;
    }

    scannedCount++;

    const timeCreated = file.metadata?.timeCreated;
    const createdMs = timeCreated ? new Date(timeCreated).getTime() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not old enough yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    if (dryRun) {
      deletedCount++;
      continue;
    }

    try {
      await file.delete();
      deletedCount++;
    } catch (err) {
      // Partial-failure tolerance (T-22-03-03): one bad delete never aborts
      // the run. Idempotent-by-age means the next daily run retries it.
      console.error(`cleanupExpiredMedia: failed to delete ${file.name}:`, err);
    }
  }

  const summary: CleanupSummary = { scannedCount, deletedCount, dryRun };
  console.log("cleanupExpiredMedia summary:", summary);
  return summary;
}

export const cleanupExpiredMedia = onSchedule(
  { schedule: "every day 02:00", timeZone: "UTC" },
  async () => {
    await cleanupExpiredMediaHandler();
  },
);
