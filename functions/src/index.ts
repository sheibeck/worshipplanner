import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { parsePptxBuffer, type MappedSlide } from "./pptxParser";
import { invokeRenderService } from "./renderInvoker";

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

// --- pptxRenders queue (R062: async server-side render bridge) ----------
//
// One canonical path builder so parsePptxHandler (37-03, this plan), the
// requestPptxRenderHandler trigger (37-04), and cleanupOrphanRendersHandler
// (37-05) cannot drift apart on the collection path.
//
// No firestore.rules change is needed or made: the rules file's catch-all
// `match /{document=**} { allow read, write: if false; }` already denies
// client access to this collection by default, and the Admin SDK (used here
// and by every handler that touches it) bypasses rules entirely. Rules
// deployment is separately deferred as backlog 999.3.

export type PptxRenderStatus = "pending" | "ready" | "failed";

export interface PptxRenderDoc {
  status: PptxRenderStatus;
  storagePath: string;
  renderedCount?: number;
  failureReason?: string;
}

export function pptxRenderDocRef(orgId: string, importId: string) {
  return getFirestore()
    .collection("organizations")
    .doc(orgId)
    .collection("pptxRenders")
    .doc(importId);
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
 * - ★ R062 additive write: on a successful parse, also queues a render by
 *   writing organizations/{orgId}/pptxRenders/{importId} (status "pending").
 *   This write is wrapped in its own nested try/catch and can NEVER fail this
 *   call -- a queue-write failure is swallowed and logged, not surfaced to
 *   the caller, because the parsed text layer above is already a complete,
 *   successful result and a render is only an enhancement over it. This
 *   handler never awaits or imports invokeRenderService; rendering happens
 *   asynchronously via a separate trigger (37-04), never on this onCall path.
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

    // ★ Additive queue write (R062). Nested try/catch is deliberate, not
    // defensive padding: the outer catch below converts ANY thrown error
    // into a user-facing "couldn't read this file" failure, which would
    // wrongly turn a successful parse into an apparent corrupt-file error
    // and throw away a text layer that already works. Swallow and log only.
    try {
      const renderDoc: PptxRenderDoc = { status: "pending", storagePath };
      await pptxRenderDocRef(orgId, importId).set({
        ...renderDoc,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (queueErr) {
      console.error("parsePptx: failed to queue render (non-fatal):", queueErr);
    }

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

// --- requestPptxRender (R062: the completeness check) -------------------
//
// The bridging trigger: fires when parsePptxHandler's additive queue write
// (above) creates a pptxRenders/{importId} doc, invokes the render service,
// and is the ONLY place that flips status to "ready". Configuration, not a
// credential -- defineString, not defineSecret and not the deprecated
// functions.config(). Empty default is deliberate: nothing is deployed yet
// (37-CONTEXT.md's deploy prohibition), and the unconfigured branch below is
// a tested behaviour, never a placeholder.
export const PPTX_RENDER_SERVICE_URL = defineString("PPTX_RENDER_SERVICE_URL", {
  default: "",
});

/** Builds the Storage prefix a completed render uploads its pages under. */
export function renderedPrefixFor(orgId: string, importId: string): string {
  return `orgs/${orgId}/pptx-imports/${importId}/rendered/`;
}

// The exact 4-digit zero-padded shape render-service/src/render.ts's
// renderedObjectName produces (RENDERED_PAGE_PAD = 4). The padding is what
// makes a Storage listing sort identically to render order under any locale
// collation -- an unpadded page-1/page-10/page-2 would corrupt the recount
// below by making "contiguous" impossible to determine from listing order.
export const RENDERED_OBJECT_NAME = /^page-(\d{4})\.png$/;

export interface RenderOutcome {
  status: PptxRenderStatus;
  renderedCount: number;
  failureReason?: string;
}

/**
 * The requestPptxRender trigger body, exported separately from the
 * onDocumentCreated wrapper (mirroring parsePptxHandler/parsePptx and
 * cleanupExpiredMediaHandler/cleanupExpiredMedia) so it is directly
 * unit-testable against mocked Firestore/Storage/renderInvoker seams.
 *
 * ★ Trap 1 (37-CONTEXT.md / 37-VALIDATION.md): this handler must NEVER
 * import, reference, or reason about parsePptxBuffer, MappedSlide, or a
 * parsed slide array. mapAstToSlides (pptxParser.ts) SKIPS slides with
 * neither substantial text nor images, and emits ONE ENTRY PER IMAGE on a
 * multi-image slide -- its length is structurally decoupled from the deck's
 * real page count (a 6-slide deck can yield 4 entries, or more than 6 with a
 * multi-image collage). Deriving the expected render page count from it
 * would be silently wrong in BOTH directions. The expected count comes only
 * from the render service's own self-report, cross-checked below.
 *
 * ★ The ready gate (T-37-13): status flips to "ready" only when THREE
 * independent signals agree -- never on the render service's self-report
 * alone, mirroring parsePptxHandler's own "never trust the caller alone"
 * pattern (independent org-membership re-check) at lines 172-181 above.
 */
export async function requestPptxRenderHandler(params: {
  orgId: string;
  importId: string;
}): Promise<RenderOutcome> {
  const { orgId, importId } = params;
  const docRef = pptxRenderDocRef(orgId, importId);

  const doc = await docRef.get();
  if (!doc.exists) {
    console.error(`requestPptxRender: no render doc at organizations/${orgId}/pptxRenders/${importId}`);
    return { status: "failed", renderedCount: 0, failureReason: "missing-render-doc" };
  }

  const data = doc.data() as PptxRenderDoc | undefined;
  const storagePath = data?.storagePath;
  if (typeof storagePath !== "string" || storagePath.length === 0) {
    const outcome: RenderOutcome = {
      status: "failed",
      renderedCount: 0,
      failureReason: "missing-storage-path",
    };
    await docRef.set(
      { status: outcome.status, renderedCount: outcome.renderedCount, failureReason: outcome.failureReason, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return outcome;
  }

  // Unconfigured service URL: fail closed, before ANY invocation. There is
  // no branch from here that can reach "ready" -- an unconfigured render
  // service must never be able to produce a ready flip (T-37-15). This is
  // the expected state until the owner runs render-service/DEPLOY.md's
  // deploy command; it is a tested behaviour, not a TODO.
  const renderServiceUrl = PPTX_RENDER_SERVICE_URL.value().trim();
  if (renderServiceUrl === "") {
    const outcome: RenderOutcome = {
      status: "failed",
      renderedCount: 0,
      failureReason: "render-service-not-configured",
    };
    await docRef.set(
      { status: outcome.status, renderedCount: outcome.renderedCount, failureReason: outcome.failureReason, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return outcome;
  }

  let reportedCount: number;
  try {
    const response = await invokeRenderService({ orgId, importId, storagePath, renderServiceUrl });
    reportedCount = response.renderedCount;
  } catch (err) {
    console.error(`requestPptxRender: invokeRenderService failed for ${orgId}/${importId}:`, err);
    const outcome: RenderOutcome = {
      status: "failed",
      renderedCount: 0,
      failureReason: "render-service-error",
    };
    await docRef.set(
      { status: outcome.status, renderedCount: outcome.renderedCount, failureReason: outcome.failureReason, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return outcome;
  }

  // ★ Independent recount (never trust the response's renderedCount alone,
  // mirroring parsePptxHandler's "never trust the client-declared value
  // alone, independently re-verify" pattern at lines 172-181). Only objects
  // whose final path segment matches RENDERED_OBJECT_NAME are counted, so a
  // stray upload (e.g. a thumbnail) can never inflate the count.
  const [files] = await getStorage()
    .bucket()
    .getFiles({ prefix: renderedPrefixFor(orgId, importId) });

  const pageNumbers: number[] = [];
  for (const file of files) {
    const segments = file.name.split("/");
    const basename = segments[segments.length - 1] ?? "";
    const match = RENDERED_OBJECT_NAME.exec(basename);
    if (!match) continue;
    pageNumbers.push(Number(match[1]));
  }
  pageNumbers.sort((a, b) => a - b);

  const actualCount = pageNumbers.length;

  // ★ The gate (T-37-13). Three independent conjuncts, all required:
  //   - actualCount > 0        -- the empty-render guard. A deck that
  //                                rendered nothing must be "failed", never
  //                                "ready" -- its parsed text layer stays
  //                                usable either way.
  //   - actualCount === reportedCount -- the self-report cross-check.
  //   - contiguous              -- catches the partial render that count
  //                                alone misses: pages 1, 2 and 4 uploaded
  //                                against a reported count of 3 would
  //                                otherwise pass the count check above.
  const contiguous = pageNumbers.every((n, i) => n === i + 1);
  const complete = actualCount > 0 && actualCount === reportedCount && contiguous;

  const outcome: RenderOutcome = {
    status: complete ? "ready" : "failed",
    renderedCount: actualCount,
    ...(complete ? {} : { failureReason: "incomplete-render" }),
  };

  await docRef.set(
    {
      status: outcome.status,
      renderedCount: outcome.renderedCount,
      updatedAt: FieldValue.serverTimestamp(),
      ...(outcome.failureReason ? { failureReason: outcome.failureReason } : {}),
    },
    { merge: true },
  );

  return outcome;
}

export const requestPptxRender = onDocumentCreated(
  "organizations/{orgId}/pptxRenders/{importId}",
  async (event) => {
    await requestPptxRenderHandler({
      orgId: event.params.orgId,
      importId: event.params.importId,
    });
  },
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
