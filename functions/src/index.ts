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
import { syncOrgMembershipClaim } from "./orgMembershipClaims";

// Server-held secrets (Google Secret Manager). Set once with:
//   firebase functions:secrets:set CLAUDE_API_KEY
//   firebase functions:secrets:set ESV_API_KEY
//   firebase functions:secrets:set NLT_API_KEY
//   firebase functions:secrets:set RESEND_API_KEY
// These are NEVER shipped to the browser — that is the whole point of this proxy.
const CLAUDE_API_KEY = defineSecret("CLAUDE_API_KEY");
const ESV_API_KEY = defineSecret("ESV_API_KEY");
const NLT_API_KEY = defineSecret("NLT_API_KEY");

// The Resend email provider key for the send path (59-02/59-03). DECLARED here
// alongside the other secrets so the whole secret list lives in one place, but
// bound to NO Function in this plan: it attaches ONLY to sendQueuedMessage
// (59-03), the single Function that ever holds it — the smallest key-holding
// surface (R131). queueServiceMessage below carries no secrets: array at all.
// Exported (unlike the proxy secrets) only so noUnusedLocals does not flag it
// while it is declared-but-unbound this plan; 59-03 references it in-file.
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

if (!getApps().length) {
  initializeApp();
}

// Exported (not just used internally) so the SECRET_INJECTED/PROXY_TARGETS
// membership assertions below have something to import — the `api` onRequest
// handler itself has no existing test harness (Assumption A2).
export const PROXY_TARGETS: Record<string, string> = {
  planningcenter: "https://api.planningcenteronline.com",
  anthropic: "https://api.anthropic.com",
  esv: "https://api.esv.org",
  nlt: "https://api.nlt.to",
};

// Services where THIS proxy injects one of our own secrets. Because we spend our
// own money/quota on these, they must not be an open relay — the caller has to be
// a signed-in app user (verified Firebase ID token in X-App-Auth).
export const SECRET_INJECTED = new Set(["anthropic", "esv", "nlt"]);

/**
 * NLT auth travels as a `key` QUERY PARAMETER, not a header — unlike the esv/
 * anthropic branches, which only ever rewrite `headers`. `upstreamUrl` is built
 * once as a `const` before any service-specific branching runs (see below), so
 * this is a small pure helper rather than an inline mutation, both to avoid
 * restructuring that `const` into a `let` inline in the handler body and to be
 * unit-testable in isolation (Pitfall 6 / Assumption A2 — the `api` onRequest
 * handler otherwise has zero existing test precedent).
 *
 * For `esv`/`anthropic` (and any other service), the URL is returned
 * byte-unchanged — their secrets are injected into `headers` elsewhere, never
 * into the URL.
 *
 * For `nlt`, the `key` search param is always SET (overwritten, never merged)
 * to the server-held secret — a client-supplied `key=attacker` on the inbound
 * request must never survive onto the outbound URL (T-45-11, spoofing/quota
 * theft). This holds even though NLT's own upstream does not actually enforce
 * the key (verified live, 45-RESEARCH.md Pitfall 4: a missing or garbage key
 * still returns HTTP 200 with correct content) — the point of injecting here
 * is keeping NLT_API_KEY out of the client bundle, independent of whether the
 * upstream enforces it. Do NOT "fix" this by removing the injection.
 */
export function buildUpstreamUrl(
  service: string,
  upstreamUrl: string,
  secretValue: string,
): string {
  if (service !== "nlt") {
    return upstreamUrl;
  }
  const nltUrl = new URL(upstreamUrl);
  nltUrl.searchParams.set("key", secretValue);
  return nltUrl.toString();
}

/**
 * Redaction boundary for any URL that might carry a live secret in its query
 * string (today: only the nlt `key` param injected by buildUpstreamUrl
 * above). Every log/error path in the `api` handler that could include
 * `upstreamUrl` must route it through this first -- the real key must never
 * be loggable, even via a future `cause`/stack-trace field on a Node/undici
 * version bump. Malformed input fails closed to a generic placeholder
 * rather than risking a raw, unredacted string leaking through.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("key")) {
      parsed.searchParams.set("key", "REDACTED");
    }
    return parsed.toString();
  } catch {
    return "[unparseable URL]";
  }
}

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
  { secrets: [CLAUDE_API_KEY, ESV_API_KEY, NLT_API_KEY] },
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
    const builtUpstreamUrl = `${target}${upstreamPath}`;
    // nlt's key is a query param, not a header — see buildUpstreamUrl above.
    // Byte-unchanged for esv/anthropic/planningcenter. Only read the NLT
    // secret on the nlt branch -- buildUpstreamUrl ignores the third
    // argument for every other service, so there is no reason to touch an
    // unrelated secret on every request.
    const upstreamUrl = buildUpstreamUrl(
      service,
      builtUpstreamUrl,
      service === "nlt" ? NLT_API_KEY.value() : "",
    );

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
      // Never log `err` verbatim -- a future `cause`/stack-trace field could
      // embed `upstreamUrl` (which, for nlt, carries the live secret in its
      // query string). Log only the service, the redacted URL, and a plain
      // message string.
      console.error("Proxy error:", {
        service,
        url: redactUrl(upstreamUrl),
        message: err instanceof Error ? err.message : String(err),
      });
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

// --- cleanupOrphanRenders (R062: dry-run-by-default orphan sweep) --------
//
// A second, SEPARATE scheduled job from cleanupExpiredMedia above. It is not
// folded into that handler because it must read the pptxRenders queue
// (Firestore) -- something cleanupExpiredMedia deliberately never does, and
// whose "imports no Firestore API at all" property is exactly why that
// handler needs zero changes for this phase.
//
// SAFETY CONTRACT:
// - FAILS SAFE: real deletion requires an explicit opt-in,
//   PPTX_RENDER_CLEANUP_ENABLED="true". With it unset, empty, "false", or any
//   other value (including a case-sensitive typo like "True" or "1"), this is
//   a dry run: it scans and logs what WOULD be deleted and deletes nothing.
//   This is the same gate shape as cleanupExpiredMediaHandler's own
//   post-incident fix above, in the same direction -- the 2026-07-28 incident
//   (9f1b881) was precisely an inverted gate whose doc comment claimed the
//   opposite default from what the code implemented. This comment describes
//   only the default the code below actually implements.
// - RENDERED_OBJECT_GUARD is applied to every listed Storage object BEFORE
//   any delete decision. Only objects under
//   orgs/{orgId}/pptx-imports/{importId}/rendered/ are ever eligible; a
//   deck's source.pptx and its extracted images/ are structurally
//   unreachable through this guard, no matter how stale the render doc is.
// - Only pptxRenders docs whose status is "pending" or "failed" AND whose
//   createdAt is older than ORPHAN_RENDER_STALE_HOURS are ever candidates. A
//   "ready" render is never a candidate (excluded by the status filter), and
//   an in-flight "pending" render younger than the staleness window is
//   skipped. A doc with an unreadable createdAt is skipped rather than
//   treated as old -- fail safe, matching cleanupExpiredMediaHandler's own
//   NaN handling of an unparseable timeCreated.
// - Age is keyed on the server-set Firestore createdAt timestamp
//   (FieldValue.serverTimestamp(), written by parsePptxHandler's queue
//   write), never on client-settable input.
// - Per-object deletes are each wrapped in their own try/catch so one
//   failure never aborts the run, mirroring cleanupExpiredMediaHandler's
//   partial-failure tolerance. The render doc's own delete is likewise
//   wrapped so a doc-delete failure cannot abort the scan of remaining
//   candidates.
// - Runs on its own daily schedule, 03:00 UTC -- deliberately one hour after
//   cleanupExpiredMedia's 02:00 UTC, so the two sweeps never overlap.

/** Render docs older than this many hours (and still pending/failed) are orphan candidates. */
export const ORPHAN_RENDER_STALE_HOURS = 24;

/**
 * Hard path guard: matches ONLY object names under the rendered/ prefix of a
 * pptx-imports scope. Structurally unable to match source.pptx or anything
 * under images/ at the same importId -- both are excluded by construction,
 * not by a runtime check on their names.
 */
export const RENDERED_OBJECT_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\/rendered\//;

export interface OrphanCleanupSummary {
  scannedCount: number;
  deletedDocCount: number;
  deletedObjectCount: number;
  dryRun: boolean;
}

/**
 * The cleanupOrphanRenders handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupExpiredMediaHandler/cleanupExpiredMedia)
 * so it can be unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupOrphanRendersHandler(): Promise<OrphanCleanupSummary> {
  // Fail safe: only an explicit opt-in enables real deletion. Anything else --
  // unset, empty, "false", a typo -- leaves this a dry run.
  const dryRun = process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true";

  const cutoffMs = Date.now() - ORPHAN_RENDER_STALE_HOURS * 60 * 60 * 1000;

  let scannedCount = 0;
  let deletedDocCount = 0;
  let deletedObjectCount = 0;

  const snapshot = await getFirestore()
    .collectionGroup("pptxRenders")
    .where("status", "in", ["pending", "failed"])
    .get();

  const bucket = getStorage().bucket();

  for (const renderDoc of snapshot.docs) {
    // Recover the org id from the parent chain rather than guessing -- skip
    // any doc whose parent chain is unexpectedly missing.
    const orgId = renderDoc.ref.parent.parent?.id;
    if (!orgId) {
      console.error(
        `cleanupOrphanRenders: skipping ${renderDoc.ref.path} -- missing parent org id`,
      );
      continue;
    }
    const importId = renderDoc.id;

    const data = renderDoc.data() as { createdAt?: { toMillis?: () => number } } | undefined;
    const createdAt = data?.createdAt;
    const createdMs = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not stale yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    scannedCount++;

    const [files] = await bucket.getFiles({ prefix: renderedPrefixFor(orgId, importId) });

    // Hard safety gate, applied BEFORE any delete decision: never consider
    // anything outside rendered/, no matter how stale this render doc is.
    const eligibleFiles = files.filter((file) => RENDERED_OBJECT_GUARD.test(file.name));

    if (dryRun) {
      deletedObjectCount += eligibleFiles.length;
      deletedDocCount++;
      continue;
    }

    for (const file of eligibleFiles) {
      try {
        await file.delete();
        deletedObjectCount++;
      } catch (err) {
        // Partial-failure tolerance: one bad delete never aborts the run.
        console.error(`cleanupOrphanRenders: failed to delete ${file.name}:`, err);
      }
    }

    try {
      await renderDoc.ref.delete();
      deletedDocCount++;
    } catch (err) {
      console.error(
        `cleanupOrphanRenders: failed to delete render doc ${renderDoc.ref.path}:`,
        err,
      );
    }
  }

  const summary: OrphanCleanupSummary = {
    scannedCount,
    deletedDocCount,
    deletedObjectCount,
    dryRun,
  };
  console.log("cleanupOrphanRenders summary:", summary);
  return summary;
}

export const cleanupOrphanRenders = onSchedule(
  { schedule: "every day 03:00", timeZone: "UTC" },
  async () => {
    await cleanupOrphanRendersHandler();
  },
);

// --- queueServiceMessage send-path enqueue (59-02: R131/R137/R141) ------
//
// The thin enqueue half of the send path, mirroring the parsePptxHandler ->
// pptxRenders queue -> requestPptxRender triad above: an onCall Function whose
// handler body (queueServiceMessageHandler) is exported separately from the
// wrapper for direct unit testing. It re-authorizes the caller server-side
// (editor-tier of the PATH-derived org, never the client-declared orgId),
// re-reads the org messaging kill-switch, validates the request, and writes
// ONE messages/{id} doc via the shared createQueuedMessage() shaper. It
// resolves no recipients and sends nothing — the 59-03 trigger does that, and
// is the only Function that holds RESEND_API_KEY.

/** The three message types a composer can queue (R137). */
export type MessageType = "oneoff" | "reminder" | "share-link";

/**
 * A message is 'queued' for immediate send (the 59-03 trigger fires now) or
 * 'scheduled' for a future scheduledFor that Phase 61's cron later flips to
 * 'queued'. sendQueuedMessage (59-03) owns the rest of the lifecycle
 * ('sending' | 'sent' | 'partial' | 'failed').
 */
export type QueuedMessageStatus = "queued" | "scheduled";

/** teams-first recipient selection (R136) — a who-to-resolve instruction, never a final email list. */
export interface RecipientSelector {
  teams: string[];
  individualPersonIds: string[];
  includeEveryone: boolean;
}

/** attach-service-link / send-me-a-copy send options (R141). */
export interface MessageOptions {
  attachServiceLink: boolean;
  sendCopyToSelf: boolean;
}

/** The client-declared queue request (every field is re-validated server-side). */
export interface QueueMessageRequest {
  orgId: string;
  serviceId: string;
  type: MessageType;
  subject: string;
  body: string;
  recipientSelector: RecipientSelector;
  options: MessageOptions;
  /** ISO instant to send at, or null for send-now. */
  scheduledFor: string | null;
}

export interface QueueMessageResponse {
  messageId: string;
}

/** Rolled-up per-message delivery tallies, written by 59-03's send trigger. */
export interface DeliveryCounts {
  sent: number;
  failed: number;
}

/**
 * The persisted messages/{id} document shape (ARCHITECTURE §Data Model). The
 * body stores the RAW token template, never pre-rendered — {{their_roles}} can
 * only be correct per-recipient at send time (R139), so 59-03 renders it then.
 * createdAt is the FieldValue.serverTimestamp() sentinel until the write lands.
 */
export interface QueuedMessageDoc {
  type: MessageType;
  status: QueuedMessageStatus;
  subject: string;
  body: string;
  recipientSelector: RecipientSelector;
  options: MessageOptions;
  changeDiff: null;
  scheduledFor: string | null;
  requestedByUid: string;
  createdAt: FieldValue;
  sentAt: null;
  deliveryCounts: DeliveryCounts;
}

/** Input to the pure createQueuedMessage shaper: the request plus the re-verified caller uid. */
export type CreateQueuedMessageInput = QueueMessageRequest & { requestedByUid: string };

/**
 * The single canonical messages/{id} doc-shaper — pure, no Firestore I/O (its
 * role mirrors pptxRenderDocRef's "one canonical shape so the callable and the
 * trigger cannot drift", and buildServiceSnapshot's pure field-assembly). It is
 * factored out precisely so queueServiceMessage now and Phase 61's cron later
 * produce an IDENTICAL shape (R141).
 *
 * Status is 'scheduled' when a scheduledFor instant is present, else 'queued'
 * (send-now). Optional/absent leaves are normalized to null (scheduledFor,
 * changeDiff, sentAt) rather than left undefined — Firestore rejects undefined.
 */
export function createQueuedMessage(input: CreateQueuedMessageInput): QueuedMessageDoc {
  const scheduledFor = input.scheduledFor ?? null;
  return {
    type: input.type,
    status: scheduledFor ? "scheduled" : "queued",
    subject: input.subject,
    body: input.body,
    recipientSelector: input.recipientSelector,
    options: input.options,
    changeDiff: null,
    scheduledFor,
    requestedByUid: input.requestedByUid,
    createdAt: FieldValue.serverTimestamp(),
    sentAt: null,
    deliveryCounts: { sent: 0, failed: 0 },
  };
}

// --- syncOrgMembershipClaim (R074/R075: the claim storage.rules reads) --
//
// Sets the { orgId, role } custom auth claim that storage.rules' dual-read
// isOrgMemberByClaim(orgId) arm reads as request.auth.token.orgId /
// request.auth.token.role (plan 40-01). One onDocumentWritten trigger on
// organizations/{orgId}/members/{uid} covers create, role change and delete.
// Invite acceptance (ensureUserDocument's batch .set() on this same
// document) flows through this trigger too, so no separate invite-specific
// code path is needed. Implementation lives in ./orgMembershipClaims so its
// shared decision logic (decideMembershipClaim) can be imported by plan
// 40-04's backfill script without duplicating it. Only the deployed trigger
// is re-exported here -- decideMembershipClaim, buildOrgMembershipClaim and
// syncOrgMembershipClaimHandler are intentionally NOT part of this module's
// exports, mirroring how requestPptxRenderHandler is reachable only via a
// direct module import in tests.
export { syncOrgMembershipClaim };
