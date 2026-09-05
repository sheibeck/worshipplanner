import { onCall, onRequest, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import {
  getFirestore,
  FieldValue,
  type Firestore,
  type DocumentReference,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { parsePptxBuffer, type MappedSlide } from "./pptxParser";
import { invokeRenderService } from "./renderInvoker";
import { syncOrgMembershipClaim } from "./orgMembershipClaims";
import { syncSuperAdminClaim, setSuperAdminClaim } from "./superAdminClaims";
import { onboardOrganization, assignOrgAdmin, listOrganizations, setOrgActive, setOrgAiEnabled, setOrgBibleEnabled } from "./orgProvisioning";
import { deleteOrganization } from "./orgDeletion";
import { sendInviteOnboardingEmail } from "./inviteOnboarding";
import { Resend } from "resend";
import { renderMessageTokens } from "./messageTokens";
import { verifySvixSignature } from "./webhookSignature";
import {
  resolveServiceRoleAssignments,
  resolveMessageRecipients,
  coerceLegacyRoleGroup,
  type PortedQuarter,
  type PortedRole,
  type PortedPerson,
  type RoleGroup,
  type RecipientSelection,
} from "./serviceRoles";
import { getAppConfig, DEFAULT_APP_CONFIG, type AppConfig } from "./appConfig";
// Shared secret + From-header helpers + share-base-url param. MOVED to the
// dependency-free ./params so orgProvisioning.ts/adminEmail.ts can reuse them
// without a circular import (index.ts imports orgProvisioning.ts). Re-exported
// below so index.ts's public surface is unchanged.
import {
  RESEND_API_KEY,
  SERVICE_SHARE_BASE_URL,
  fromDisplayName,
  bareEmailAddress,
} from "./params";
export { RESEND_API_KEY, SERVICE_SHARE_BASE_URL, fromDisplayName, bareEmailAddress };

// Server-held secrets (Google Secret Manager). Set once with:
//   firebase functions:secrets:set CLAUDE_API_KEY
//   firebase functions:secrets:set ESV_API_KEY
//   firebase functions:secrets:set NLT_API_KEY
//   firebase functions:secrets:set RESEND_API_KEY
//   firebase functions:secrets:set RESEND_WEBHOOK_SECRET
// These are NEVER shipped to the browser — that is the whole point of this proxy.
const CLAUDE_API_KEY = defineSecret("CLAUDE_API_KEY");
const ESV_API_KEY = defineSecret("ESV_API_KEY");
const NLT_API_KEY = defineSecret("NLT_API_KEY");

// See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)

// The Resend/Svix webhook SIGNING secret (whsec_-prefixed base64) — DISTINCT
// from RESEND_API_KEY. It is the HMAC key verifySvixSignature checks the raw
// webhook body against. Set once via
//   firebase functions:secrets:set RESEND_WEBHOOK_SECRET
// and bound to EXACTLY ONE Function — messageWebhook below (the smallest
// key-holding surface, mirroring RESEND_API_KEY -> sendQueuedMessage). It is
// never shipped to the client bundle and never lives in .env.local (T-60-02f).
const RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET");

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

// Services requiring a signed-in app caller (X-App-Auth) but injecting NO
// server secret -- distinct from SECRET_INJECTED. planningcenter forwards the
// caller's OWN Planning Center OAuth token untouched; the gate exists only to
// close the unauthenticated open relay (R339 / SEC-A-01), not to protect a
// key we pay for.
export const AUTH_REQUIRED = new Set(["planningcenter"]);

/** See ADR-0019 (docs/adr/0019-nlt-auth-travels-as-a-key-query-parameter-not-a-header-unlik.md) */
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

// Headers we forward from the client to the upstream API.
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
const FORWARDED_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "x-api-key",
  "anthropic-version",
  "anthropic-dangerous-direct-browser-access",
];

/** See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts) */
export async function verifyAppCaller(idToken: string | undefined): Promise<DecodedIdToken | null> {
  if (!idToken) return null;
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

/**
 * Reads the `orgId` custom claim (the v1.5 org-membership claim -- see
 * orgMembershipClaims.ts's ORG_CLAIM_KEYS, a top-level readable key on the
 * decoded token). Returns null rather than throwing when the claim is
 * absent/empty, so an otherwise-valid caller with no org (yet) still gets a
 * uid-only usage ledger entry instead of a failed request.
 */
export function resolveOrgId(decoded: DecodedIdToken): string | null {
  const orgId = (decoded as unknown as Record<string, unknown>)["orgId"];
  return typeof orgId === "string" && orgId.length > 0 ? orgId : null;
}

/** R161/R162 tunable knobs -- all env-configurable with generous defaults so
 * a fresh deploy works with zero config (v1.8 grant: no .env file is written
 * by this plan). Mirrors the existing env-read style at MEDIA_CLEANUP_ENABLED
 * (index.ts, near the media-cleanup handlers below).
 */
export interface AiProxyLimits {
  maxPerMin: number;
  maxPerDay: number;
  allowedModels: string[];
  maxTokensCeiling: number;
}

/** See ADR-0020 (docs/adr/0020-cached-form-no-fresh-true-the-api-handler-is-a-hot-request.md) */
export function readNumericKnob(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Remaps the resolved appConfig.aiProxy group onto the AiProxyLimits shape
 * this file's callers/tests already expect. The parsing/coercion/fail-closed
 * allow-list logic now lives in appConfig.ts's coerceAiProxy -- this is a
 * thin passthrough, not a re-implementation (R181).
 */
export function readAiProxyLimits(config: AppConfig): AiProxyLimits {
  return {
    maxPerMin: config.aiProxy.rateLimitPerMin,
    maxPerDay: config.aiProxy.rateLimitPerDay,
    allowedModels: config.aiProxy.allowedModels,
    maxTokensCeiling: config.aiProxy.maxTokensCeiling,
  };
}

// See ADR-0021 (docs/adr/0021-r164-an-explicit-maxinstances-ceiling-motivated-by-the-highe.md)
const AI_PROXY_MAX_INSTANCES = readNumericKnob(process.env.AI_PROXY_MAX_INSTANCES, 10);

// R172: a project-wide maxInstances ceiling so EVERY function inherits a
// fan-out cap, even ones with no explicit per-function option of their own
// (e.g. messageWebhook). Called ONCE, here, before the first function
// definition (`api` below) so the default is in place for the whole module.
// A per-function `maxInstances` (like api's own AI_PROXY_MAX_INSTANCES just
// above) OVERRIDES this default for that function -- it is never clobbered.
// Env-overridable so the owner can tune fan-out without a logic redeploy.
const GLOBAL_MAX_INSTANCES = readNumericKnob(process.env.GLOBAL_MAX_INSTANCES, 20);
setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES });

export interface EnforceModelAndTokensOk {
  ok: true;
  body: Record<string, unknown>;
}
export interface EnforceModelAndTokensReject {
  ok: false;
  status: number;
  error: { error: string; allowedModels: string[] };
}
export type EnforceModelAndTokensResult = EnforceModelAndTokensOk | EnforceModelAndTokensReject;

/**
 * R162: server-side model allow-list + max_tokens ceiling. The proxy stops
 * trusting the client-supplied `model`/`max_tokens` -- a disallowed, missing,
 * or blank model is REJECTED (400, not forwarded; a wrong/expensive model is
 * almost certainly a bug or abuse). An over-ceiling max_tokens is CLAMPED
 * down rather than rejected (friendlier, still caps per-call output cost);
 * an absent max_tokens is left absent, never injected.
 */
export function enforceModelAndTokens(
  body: unknown,
  limits: Pick<AiProxyLimits, "allowedModels" | "maxTokensCeiling">,
): EnforceModelAndTokensResult {
  if (typeof body !== "object" || body === null) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "Request body must be a JSON object naming a server-permitted model.",
        allowedModels: limits.allowedModels,
      },
    };
  }
  const record = body as Record<string, unknown>;
  const model = record.model;
  if (typeof model !== "string" || model.trim().length === 0 || !limits.allowedModels.includes(model)) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "The requested model is not permitted by server policy.",
        allowedModels: limits.allowedModels,
      },
    };
  }
  // See ADR-0022 (docs/adr/0022-reject-a-streamed-request-outright-rather-than-forward-it.md)
  if (record.stream === true) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "Streaming responses are not supported by this proxy; omit `stream` or set it to false.",
        allowedModels: limits.allowedModels,
      },
    };
  }
  // IN-01: the clamp used to only fire for `typeof "number"`, so a numeric
  // string (`max_tokens: "99999999"`) skipped it and was forwarded
  // byte-unchanged. Coerce a numeric-string `max_tokens` before comparing so
  // a client can't dodge the ceiling purely by changing the JSON type.
  const maxTokens = record.max_tokens;
  const numericMaxTokens =
    typeof maxTokens === "number"
      ? maxTokens
      : typeof maxTokens === "string" && maxTokens.trim().length > 0 && Number.isFinite(Number(maxTokens))
        ? Number(maxTokens)
        : undefined;
  if (numericMaxTokens !== undefined && numericMaxTokens > limits.maxTokensCeiling) {
    return { ok: true, body: { ...record, max_tokens: limits.maxTokensCeiling } };
  }
  return { ok: true, body: record };
}

export interface OrgAiEnablementOk {
  ok: true;
}
export interface OrgAiEnablementReject {
  ok: false;
  status: number;
  error: { error: string };
}
export type OrgAiEnablementResult = OrgAiEnablementOk | OrgAiEnablementReject;

/**
 * R242/R243: the real, server-side half of the per-org master AI gate.
 * See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)
 * FAIL CLOSED on a read error -- a DELIBERATE departure from the rate limiter's fail-open posture.
 */
export async function checkOrgAiEnablement(
  db: Firestore,
  orgId: string,
): Promise<OrgAiEnablementResult> {
  try {
    const orgSnap = await db.collection("organizations").doc(orgId).get();
    const aiMasterEnabled = (orgSnap.data() as { aiMasterEnabled?: boolean } | undefined)?.aiMasterEnabled ?? false;
    if (aiMasterEnabled !== true) {
      return {
        ok: false,
        status: 403,
        error: { error: "AI features are disabled for your organization." },
      };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[api] org AI-enablement read failed; failing closed:", {
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      status: 503,
      error: { error: "Could not verify AI availability. Try again shortly." },
    };
  }
}

/**
 * R297: the server-side half of the per-org Bible-API (ESV/NLT) gate. Mirrors checkOrgAiEnablement 1:1.
 * See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)
 */
export type OrgBibleEnablementResult = OrgAiEnablementResult;

export async function checkOrgBibleEnablement(
  db: Firestore,
  orgId: string,
): Promise<OrgBibleEnablementResult> {
  try {
    const orgSnap = await db.collection("organizations").doc(orgId).get();
    const bibleApiEnabled = (orgSnap.data() as { bibleApiEnabled?: boolean } | undefined)?.bibleApiEnabled ?? false;
    if (bibleApiEnabled !== true) {
      return {
        ok: false,
        status: 403,
        error: { error: "Bible API features are disabled for your organization." },
      };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[api] org Bible-enablement read failed; failing closed:", {
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      status: 503,
      error: { error: "Could not verify Bible availability. Try again shortly." },
    };
  }
}

export interface RateLimitResult {
  allowed: boolean;
  scope?: "minute" | "day";
}

/**
 * R161: per-uid fixed-window Firestore rate limit.
 * See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)
 * Deliberately does NOT catch its own Firestore errors -- caller decides fail-open policy.
 * `collectionName` (R344, 117-01) defaults to the original "aiRateLimits" so
 * every existing caller is byte-unchanged; a caller passes a DEDICATED
 * collection name to keep its counter from cross-depleting the shared
 * AI-proxy budget (e.g. queueServiceMessage's own enqueue-rate ceiling).
 */
export async function checkAndConsumeRateLimit(
  db: Firestore,
  uid: string,
  limits: Pick<AiProxyLimits, "maxPerMin" | "maxPerDay">,
  now: number = Date.now(),
  collectionName: string = "aiRateLimits",
): Promise<RateLimitResult> {
  const minuteWindow = Math.floor(now / 60_000);
  const dayWindow = Math.floor(now / 86_400_000);
  const minuteRef = db.collection(collectionName).doc(`${uid}__min__${minuteWindow}`);
  const dayRef = db.collection(collectionName).doc(`${uid}__day__${dayWindow}`);

  return db.runTransaction(async (tx) => {
    const [minuteSnap, daySnap] = await Promise.all([tx.get(minuteRef), tx.get(dayRef)]);
    const minuteCount = minuteSnap.exists ? ((minuteSnap.data()?.count as number | undefined) ?? 0) : 0;
    const dayCount = daySnap.exists ? ((daySnap.data()?.count as number | undefined) ?? 0) : 0;

    if (minuteCount >= limits.maxPerMin) {
      return { allowed: false, scope: "minute" as const };
    }
    if (dayCount >= limits.maxPerDay) {
      return { allowed: false, scope: "day" as const };
    }

    // expireAt is a bit past the window's own end so an OPTIONAL owner TTL
    // policy on aiRateLimits can reap stale counters -- nothing here depends
    // on that policy existing.
    tx.set(minuteRef, { count: minuteCount + 1, expireAt: new Date((minuteWindow + 2) * 60_000) });
    tx.set(dayRef, { count: dayCount + 1, expireAt: new Date((dayWindow + 2) * 86_400_000) });
    return { allowed: true };
  });
}

/**
 * R171: per-org daily Resend email quota -- a fixed-window Admin-SDK counter
 * that mirrors checkAndConsumeRateLimit's shape (single-doc transaction,
  * See ADR-0023 (docs/adr/0023-projected-check-not-a-check-against-the-pre-send-count.md)
 * (sendQueuedMessageHandler) decides the fail policy, same as
 * checkAndConsumeRateLimit above.
 *
 * Despite the name, this is now a GENERIC per-key daily projected-count quota
 * (R344/R345, 117-01): the second argument is any string key (an orgId, or a
 * uid for a per-uid daily ceiling), not necessarily an orgId, and
 * `collectionName` defaults to the original "orgEmailCounters" so the email
 * quota binding stays byte-unchanged. Callers pass a DEDICATED collection
 * name to keep their counter independent of the email quota and of each
 * other (e.g. queueServiceMessage's enqueue quota, parsePptx's import quota).
 */
export async function checkAndConsumeOrgEmailQuota(
  db: Firestore,
  orgId: string,
  count: number,
  limit: number,
  now: number = Date.now(),
  collectionName: string = "orgEmailCounters",
): Promise<RateLimitResult> {
  const dayWindow = Math.floor(now / 86_400_000);
  const dayRef = db.collection(collectionName).doc(`${orgId}__day__${dayWindow}`);

  return db.runTransaction(async (tx) => {
    const daySnap = await tx.get(dayRef);
    const dayCount = daySnap.exists ? ((daySnap.data()?.count as number | undefined) ?? 0) : 0;

    // See ADR-0023 (docs/adr/0023-projected-check-not-a-check-against-the-pre-send-count.md)
    if (dayCount + count > limit) {
      return { allowed: false, scope: "day" as const };
    }

    // expireAt is a bit past the window's own end so an OPTIONAL owner TTL
    // policy on orgEmailCounters can reap stale counters -- nothing here
    // depends on that policy existing.
    tx.set(dayRef, { count: dayCount + count, expireAt: new Date((dayWindow + 2) * 86_400_000) });
    return { allowed: true };
  });
}

export interface AiUsageEntry {
  uid: string;
  orgId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: unknown;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
}

/**
 * R163: builds one aiUsage ledger entry per proxied Claude request. orgId is
 * null (uid-only) rather than throwing when unresolved; token counts default
 * to 0 when the upstream response usage is missing either field.
 */
export function buildUsageEntry(
  uid: string,
  orgId: string | null,
  model: string,
  usage: AnthropicUsage | undefined,
): AiUsageEntry {
  return {
    uid,
    orgId: orgId ?? null,
    model,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    createdAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Writes the ledger entry to the TOP-LEVEL `aiUsage` collection via the
 * Admin SDK (bypasses rules -- no firestore.rules change needed to write;
 * see 65-CONTEXT.md). Kept top-level, not nested under organizations/{orgId},
 * for the same T-37-15 reason as aiRateLimits above.
 */
export async function writeUsageLedger(db: Firestore, entry: AiUsageEntry): Promise<void> {
  await db.collection("aiUsage").add(entry);
}

export const api = onRequest(
  { secrets: [CLAUDE_API_KEY, ESV_API_KEY, NLT_API_KEY], maxInstances: AI_PROXY_MAX_INSTANCES },
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

    // Gate the secret-bearing routes: only signed-in app users may spend our
    // keys. `decodedCaller` is held for the rest of the handler so the
    // anthropic-only controls below (R161 rate limit, R163 ledger) can read
    // `decoded.uid` / resolveOrgId(decoded) without re-verifying the token.
    let decodedCaller: DecodedIdToken | null = null;
    if (SECRET_INJECTED.has(service) || AUTH_REQUIRED.has(service)) {
      const appToken = req.headers["x-app-auth"];
      const token = typeof appToken === "string" ? appToken : undefined;
      decodedCaller = await verifyAppCaller(token);
      if (!decodedCaller) {
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

    // R161/R162/R163: all four cost controls apply to the anthropic upstream
    // ONLY. esv/nlt/planningcenter fall straight through to the existing
    // fetch below with `outboundBody` left as `req.body`, byte-unchanged.
    let outboundBody: unknown = req.body;
    if (service === "anthropic") {
      // R242/R243: the org-AI-enablement gate runs FIRST, before any other
      // anthropic control (appConfig read, rate limit, enforceModelAndTokens)
      // See ADR-0024 (docs/adr/0024-a-disabled-org-must-never-reach-even-the-cheapest-of-those-c.md)
      const callerOrgId = resolveOrgId(decodedCaller!);
      if (!callerOrgId) {
        res.status(403).json({ error: "AI features require an organization." });
        return;
      }
      const enablementVerdict = await checkOrgAiEnablement(getFirestore(), callerOrgId);
      if (!enablementVerdict.ok) {
        res.status(enablementVerdict.status).json(enablementVerdict.error);
        return;
      }

      // See ADR-0020 (docs/adr/0020-cached-form-no-fresh-true-the-api-handler-is-a-hot-request.md)
      let config: AppConfig = DEFAULT_APP_CONFIG;
      try {
        config = await getAppConfig(getFirestore());
      } catch (configErr) {
        console.warn("[api] appConfig read failed; failing open to defaults:", {
          message: configErr instanceof Error ? configErr.message : String(configErr),
        });
      }
      const aiLimits = readAiProxyLimits(config);
      const enforcement = enforceModelAndTokens(req.body, aiLimits);
      if (!enforcement.ok) {
        res.status(enforcement.status).json(enforcement.error);
        return;
      }
      outboundBody = enforcement.body;

      // decodedCaller is always non-null here: anthropic is in SECRET_INJECTED,
      // so the auth gate above already returned 401 for a null caller.
      try {
        const rateResult = await checkAndConsumeRateLimit(
          getFirestore(),
          decodedCaller!.uid,
          aiLimits,
        );
        if (!rateResult.allowed) {
          res.status(429).json({
            error: "Rate limit exceeded. Please slow down and try again shortly.",
            scope: rateResult.scope,
            retryAfterSec: rateResult.scope === "minute" ? 60 : 86_400,
          });
          return;
        }
      } catch (limiterErr) {
        // Fail OPEN: the limiter is a cost guardrail, not a security control
        // (locked decision, 65-CONTEXT.md) -- a Firestore hiccup must never
        // take AI down.
        console.warn("[api] rate limiter Firestore op failed; failing open:", {
          message: limiterErr instanceof Error ? limiterErr.message : String(limiterErr),
        });
      }
    }

    // R297: defense-in-depth server-side half of the per-org Bible-API gate
    // (Plan 102-01 built the client dispatcher; this is the real security
    // control, enforced independently of any client bypass). Mirrors the
    // anthropic branch's org-resolution + enablement reject immediately
    // above -- decodedCaller is always non-null here (esv and nlt are both
    // in SECRET_INJECTED, so the auth gate above already returned 401 for a
    // null caller). planningcenter is not a Bible service and is untouched
    // by this condition, falling through exactly as before.
    if (service === "esv" || service === "nlt") {
      const callerOrgId = resolveOrgId(decodedCaller!);
      if (!callerOrgId) {
        res.status(403).json({ error: "Bible API features require an organization." });
        return;
      }
      const bibleVerdict = await checkOrgBibleEnablement(getFirestore(), callerOrgId);
      if (!bibleVerdict.ok) {
        res.status(bibleVerdict.status).json(bibleVerdict.error);
        return;
      }

      // R340: layer the SAME per-uid proxy budget that already guards
      // anthropic onto esv/nlt -- one shared aiRateLimits counter across all
      // three upstreams, not a separate esv/nlt budget. Fail-OPEN on a
      // Firestore hiccup (locked decision, 65-CONTEXT.md -- cost guardrail,
      // not a security control); the enablement gate above stays fail-CLOSED.
      let config: AppConfig = DEFAULT_APP_CONFIG;
      try {
        config = await getAppConfig(getFirestore());
      } catch (configErr) {
        console.warn("[api] appConfig read failed; failing open to defaults:", {
          message: configErr instanceof Error ? configErr.message : String(configErr),
        });
      }
      const aiLimits = readAiProxyLimits(config);
      try {
        const rateResult = await checkAndConsumeRateLimit(
          getFirestore(),
          decodedCaller!.uid,
          aiLimits,
        );
        if (!rateResult.allowed) {
          res.status(429).json({
            error: "Rate limit exceeded. Please slow down and try again shortly.",
            scope: rateResult.scope,
            retryAfterSec: rateResult.scope === "minute" ? 60 : 86_400,
          });
          return;
        }
      } catch (limiterErr) {
        console.warn("[api] rate limiter Firestore op failed; failing open:", {
          message: limiterErr instanceof Error ? limiterErr.message : String(limiterErr),
        });
      }
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : JSON.stringify(outboundBody),
      });

      res.status(upstream.status);
      const ct = upstream.headers.get("content-type");
      if (ct) res.set("content-type", ct);

      const body = await upstream.text();

      // R163: one aiUsage ledger entry per 2xx anthropic response. Reads the
      // token counts from the parsed (non-streaming) response body BEFORE
      // res.send -- wrapped so a parse/usage/write failure never breaks the
      // proxy response the caller is waiting on.
      if (service === "anthropic" && decodedCaller && upstream.status >= 200 && upstream.status < 300) {
        try {
          const parsed = JSON.parse(body) as { usage?: AnthropicUsage };
          const outboundModel =
            outboundBody && typeof outboundBody === "object" && typeof (outboundBody as Record<string, unknown>).model === "string"
              ? ((outboundBody as Record<string, unknown>).model as string)
              : "unknown";
          await writeUsageLedger(
            getFirestore(),
            buildUsageEntry(decodedCaller.uid, resolveOrgId(decodedCaller), outboundModel, parsed.usage),
          );
        } catch (ledgerErr) {
          console.warn("[api] aiUsage ledger write failed:", {
            message: ledgerErr instanceof Error ? ledgerErr.message : String(ledgerErr),
          });
        }
      }

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

// pptxRenders queue (R062: async server-side render bridge)
// See .planning/codebase/CONCERNS.md (Backend Concern Notes (R318) § functions/src/index.ts)

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
  * See ADR-0025 (docs/adr/0025-custom-metadata-not-the-gcs-reserved-top-level-fields-phase.md)
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

  const db = getFirestore();

  // Independent org-membership check -- never trust the client-declared orgId
  // alone, even though storage.rules also enforces this at the Storage layer.
  const memberDoc = await db
    .collection("organizations")
    .doc(orgId)
    .collection("members")
    .doc(request.auth.uid)
    .get();
  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this organization.");
  }

  // R345 (117-01 / SEC-C-06): a per-uid + per-org daily import quota, on
  // DEDICATED counters, independent of the render service's own
  // --concurrency=1/--max-instances=3 ceiling. Reuses the existing
  // aiProxy.rateLimitPerDay / messaging.orgDailyEmailQuota knobs -- a new
  // appConfig field would need the out-of-scope frontend appConfig
  // duplicate (117-CONTEXT.md). Fails OPEN on a Firestore hiccup, same
  // posture as the sibling limits.
  let pptxConfig: AppConfig = DEFAULT_APP_CONFIG;
  try {
    pptxConfig = await getAppConfig(db);
  } catch (configErr) {
    console.warn("[parsePptx] appConfig read failed; failing open to defaults:", {
      message: configErr instanceof Error ? configErr.message : String(configErr),
    });
  }
  try {
    const uidQuota = await checkAndConsumeOrgEmailQuota(
      db,
      request.auth.uid,
      1,
      pptxConfig.aiProxy.rateLimitPerDay,
      Date.now(),
      "pptxImportUidCounters",
    );
    if (!uidQuota.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "You have reached your daily PowerPoint import limit. Try again tomorrow.",
      );
    }
    const orgQuota = await checkAndConsumeOrgEmailQuota(
      db,
      orgId,
      1,
      pptxConfig.messaging.orgDailyEmailQuota,
      Date.now(),
      "pptxImportOrgCounters",
    );
    if (!orgQuota.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "This organization has reached its daily PowerPoint import limit.",
      );
    }
  } catch (limiterErr) {
    if (limiterErr instanceof HttpsError) {
      throw limiterErr;
    }
    // Fail OPEN: the quota is a cost guardrail, not a security control
    // (locked decision, 65-CONTEXT.md) -- a Firestore hiccup must never block
    // a legitimate import.
    console.warn("[parsePptx] import quota Firestore op failed; failing open:", {
      message: limiterErr instanceof Error ? limiterErr.message : String(limiterErr),
    });
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
 * The requestPptxRender trigger body, exported separately from the onDocumentCreated wrapper.
 * See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)
 * ★ Trap 1: never derive the expected render page count from mapAstToSlides' output length.
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

  // ★ The gate (T-37-13). Three independent conjuncts, all required.
  // See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
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

// Shared cleanup-sweep safety knob (66-01: T-66-01-02)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
export function readDeleteCap(config: AppConfig): number {
  return config.deleteCapPerRun;
}

// cleanupExpiredMedia (R015: 2-week Storage retention)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
// FAILS SAFE by default -- do not flip the historical MEDIA_CLEANUP_DRY_RUN env var, it is dead.

/**
 * Default retention window (days), used when MEDIA_RETENTION_DAYS is
 * unset/blank/non-numeric. Bumped 14 -> 30 (v1.8 follow-up) per owner
 * request; env-tunable via readMediaRetentionDays() below.
 */
export const RETENTION_DAYS = 30;

/**
 * Reads the effective media retention window in days from a resolved
 * AppConfig (R181) -- a thin passthrough; the fail-open-capped default
 * (RETENTION_DAYS) is applied by appConfig.ts's coerceRetention, not here.
 */
export function readMediaRetentionDays(config: AppConfig): number {
  return config.retention.mediaDays;
}

/**
 * Hard path guard: matches ONLY object names under orgs/{orgId}/media/.
 * Anything else (pptx-imports, or any future non-media path) never reaches
 * the delete decision, regardless of age.
 */
export const MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//;

export interface CleanupSummary {
  scannedCount: number;
  deletedObjectCount: number;
  dryRun: boolean;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run (66-01: T-66-01-04). */
  deletedBytes: number;
  /** True when readDeleteCap() stopped a LIVE run before all aged candidates were deleted. */
  cappedByLimit: boolean;
}

/**
 * The cleanupExpiredMedia handler body, exported separately from the
 * `onSchedule` wrapper (mirroring parsePptxHandler/parsePptx) so it can be
 * unit-tested directly against a mocked bucket.
 */
export async function cleanupExpiredMediaHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<CleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.mediaEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.mediaEnabled;
  const bucket = getStorage().bucket();
  const cutoffMs = Date.now() - readMediaRetentionDays(config) * 24 * 60 * 60 * 1000;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

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

    const fileBytes = Number(file.metadata?.size ?? 0);

    if (dryRun) {
      // Dry-run is NEVER capped -- the owner needs the true backlog
      // count/bytes before enabling live deletion, not a truncated one.
      deletedObjectCount++;
      deletedBytes += fileBytes;
      continue;
    }

    if (deletedObjectCount >= deleteCap) {
      // T-66-01-02: bound this run's blast radius. Idempotent-by-age means
      // the next daily run resumes deleting the remaining backlog.
      cappedByLimit = true;
      break;
    }

    try {
      await file.delete();
      deletedObjectCount++;
      deletedBytes += fileBytes;
    } catch (err) {
      // Partial-failure tolerance (T-22-03-03): one bad delete never aborts
      // the run. Idempotent-by-age means the next daily run retries it.
      console.error(`cleanupExpiredMedia: failed to delete ${file.name}:`, err);
    }
  }

  const summary: CleanupSummary = {
    scannedCount,
    deletedObjectCount,
    dryRun,
    deletedBytes,
    cappedByLimit,
  };
  console.log("cleanupExpiredMedia summary:", summary);
  return summary;
}

export const cleanupExpiredMedia = onSchedule(
  { schedule: "every day 02:00", timeZone: "UTC" },
  async () => {
    await cleanupExpiredMediaHandler();
  },
);

// cleanupOrphanRenders (R062: dry-run-by-default orphan sweep)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
// Runs 03:00 UTC (one hour after cleanupExpiredMedia's 02:00, so the two sweeps never overlap).

/**
 * Default staleness window (hours), used when ORPHAN_RENDER_STALE_HOURS
 * (env var) is unset/blank/non-numeric. Render docs older than this many
 * hours (and still pending/failed) are orphan candidates.
 */
export const ORPHAN_RENDER_STALE_HOURS = 24;

/**
 * Reads the effective orphan-render staleness window in hours from a
 * resolved AppConfig (R181) -- a thin passthrough over
 * config.retention.orphanRenderStaleHours; appConfig.ts's coerceRetention
 * owns the fail-open-capped default (ORPHAN_RENDER_STALE_HOURS).
 */
export function readOrphanRenderStaleHours(config: AppConfig): number {
  return config.retention.orphanRenderStaleHours;
}

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
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run (66-01: T-66-01-04). */
  deletedBytes: number;
  /** True when readDeleteCap() stopped a LIVE run before all stale candidates were cleared. */
  cappedByLimit: boolean;
}

/**
 * The cleanupOrphanRenders handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupExpiredMediaHandler/cleanupExpiredMedia)
 * so it can be unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupOrphanRendersHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<OrphanCleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.pptxRenderEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.pptxRenderEnabled;

  const cutoffMs = Date.now() - readOrphanRenderStaleHours(config) * 60 * 60 * 1000;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let deletedDocCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  const snapshot = await db
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
      // Dry-run is NEVER capped -- the owner needs the true backlog
      // count/bytes before enabling live deletion, not a truncated one.
      deletedObjectCount += eligibleFiles.length;
      deletedDocCount++;
      for (const file of eligibleFiles) {
        deletedBytes += Number(file.metadata?.size ?? 0);
      }
      continue;
    }

    // T-66-01-02: the cap bounds the TOTAL objects deleted across the whole
    // run (a single run-level counter, not per-doc). If the cap is reached
    // partway through this doc's rendered objects, stop deleting objects AND
    // do not delete the doc itself -- a doc is only removed once its
    // rendered objects are FULLY cleared, so the next daily run can finish
    // the job before the doc disappears.
    let hitCapThisDoc = false;
    for (const file of eligibleFiles) {
      if (deletedObjectCount >= deleteCap) {
        cappedByLimit = true;
        hitCapThisDoc = true;
        break;
      }
      try {
        await file.delete();
        deletedObjectCount++;
        deletedBytes += Number(file.metadata?.size ?? 0);
      } catch (err) {
        // Partial-failure tolerance: one bad delete never aborts the run.
        console.error(`cleanupOrphanRenders: failed to delete ${file.name}:`, err);
      }
    }

    if (hitCapThisDoc) {
      // Stop processing further docs this run -- the cap is already spent.
      break;
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
    deletedBytes,
    cappedByLimit,
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

/** Shared day-length constant for the two 66-02 retention sweeps below. */
const DAY_MS = 24 * 60 * 60 * 1000;

// cleanupOrphanBackgrounds (R167: orphan+age background sweep, Phase 66-02)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
// FLOOR GUARD: a reference scan returning silently EMPTY must never be trusted as "nothing
// referenced" -- treated as incomplete (forces dry-run) too. Runs 05:00 UTC (after the other sweeps).

/**
 * Default retention window (days), used when the BACKGROUND_RETENTION_DAYS
 * env var is unset/blank/non-numeric. Backgrounds are only orphan-eligible
 * once older than this many days.
 */
export const BACKGROUND_RETENTION_DAYS = 30;

/**
 * Reads the effective background retention window in days from a resolved
 * AppConfig (R181) -- a thin passthrough over config.retention.backgroundDays;
 * appConfig.ts's coerceRetention owns the fail-open-capped default
 * (BACKGROUND_RETENTION_DAYS).
 */
export function readBackgroundRetentionDays(config: AppConfig): number {
  return config.retention.backgroundDays;
}

/**
 * Hard path guard: matches ONLY object names under
 * orgs/{orgId}/backgrounds/. Anything else (media/, pptx-imports/, or any
 * future path) never reaches the delete decision, regardless of age or
 * reference state.
 */
export const BACKGROUND_PATH_GUARD = /^orgs\/[^/]+\/backgrounds\//;

export interface OrphanBackgroundSummary {
  scannedCount: number;
  orphanCount: number;
  deletedObjectCount: number;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run. */
  deletedBytes: number;
  /** False when the reference picture could not be fully proven this run -- forces dryRun. */
  referencesComplete: boolean;
  /** True when readDeleteCap() stopped a LIVE run before all orphan candidates were deleted. */
  cappedByLimit: boolean;
  dryRun: boolean;
}

/**
 * Recovers the Storage object path from a Firebase Storage download URL of
 * the shape `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{ENCODED_PATH}?alt=media&token=...`.
 * Returns the URL-decoded object path (e.g.
 * `orgs/{orgId}/backgrounds/{backgroundId}/{fileName}`), or null when the
 * string has no parseable `/o/{path}` segment -- callers treat a null as an
 * incomplete reference picture rather than guessing.
 */
export function extractBackgroundObjectPath(url: string): string | null {
  const match = /\/o\/([^?]+)/.exec(url);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * The cleanupOrphanBackgrounds handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupOrphanRendersHandler) so it can be
 * unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupOrphanBackgroundsHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<OrphanBackgroundSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.backgroundEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.backgroundEnabled;

  const referencedPaths = new Set<string>();
  let referencesComplete = true;

  const trackUrl = (url: unknown): void => {
    if (typeof url !== "string" || url.length === 0) {
      return;
    }
    const objectPath = extractBackgroundObjectPath(url);
    if (objectPath === null) {
      // Unparseable reference -- the picture is incomplete, never guess.
      referencesComplete = false;
      return;
    }
    referencedPaths.add(objectPath);
  };

  // Tier 1 (group) + Tier 2 (slide, embedded slides[] array on the SAME doc).
  try {
    const slideGroupsSnap = await db.collectionGroup("slideGroups").get();
    for (const doc of slideGroupsSnap.docs) {
      const data = doc.data() as
        | { backgroundImageUrl?: unknown; slides?: Array<{ backgroundImageUrl?: unknown }> }
        | undefined;
      trackUrl(data?.backgroundImageUrl);
      if (data?.slides !== undefined) {
        if (Array.isArray(data.slides)) {
          for (const slide of data.slides) {
            trackUrl(slide?.backgroundImageUrl);
          }
        } else {
          // Malformed slides field -- can't prove no reference exists in it.
          referencesComplete = false;
        }
      }
    }
  } catch (err) {
    console.error("cleanupOrphanBackgrounds: slideGroups reference scan failed:", err);
    referencesComplete = false;
  }

  // Tier 3 (song lyrics).
  try {
    const lyricsSnap = await db.collectionGroup("lyrics").get();
    for (const doc of lyricsSnap.docs) {
      const data = doc.data() as { backgroundImageUrl?: unknown } | undefined;
      trackUrl(data?.backgroundImageUrl);
    }
  } catch (err) {
    console.error("cleanupOrphanBackgrounds: lyrics reference scan failed:", err);
    referencesComplete = false;
  }

  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: "orgs/", autoPaginate: true });
  const candidates = files.filter((file) => BACKGROUND_PATH_GUARD.test(file.name));

  // FLOOR GUARD: zero references found anywhere, yet background objects
  // exist to consider -- never trust an empty Set as "nothing referenced".
  if (referencedPaths.size === 0 && candidates.length > 0) {
    referencesComplete = false;
  }

  const effectiveDryRun = dryRun || !referencesComplete;
  const cutoffMs = Date.now() - readBackgroundRetentionDays(config) * DAY_MS;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let orphanCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  for (const file of candidates) {
    scannedCount++;

    if (referencedPaths.has(file.name)) {
      // Referenced at some tier -- NEVER delete, no matter how old.
      continue;
    }

    const timeCreated = file.metadata?.timeCreated;
    const createdMs = timeCreated ? new Date(timeCreated).getTime() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not old enough yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    orphanCount++;
    const fileBytes = Number(file.metadata?.size ?? 0);

    if (effectiveDryRun) {
      // Dry-run (explicit or references-incomplete) is NEVER capped -- the
      // owner needs the true backlog count/bytes before enabling live
      // deletion, not a truncated one.
      deletedBytes += fileBytes;
      continue;
    }

    if (deletedObjectCount >= deleteCap) {
      cappedByLimit = true;
      break;
    }

    try {
      await file.delete();
      deletedObjectCount++;
      deletedBytes += fileBytes;
    } catch (err) {
      // Partial-failure tolerance: one bad delete never aborts the run.
      console.error(`cleanupOrphanBackgrounds: failed to delete ${file.name}:`, err);
    }
  }

  const summary: OrphanBackgroundSummary = {
    scannedCount,
    orphanCount,
    deletedObjectCount,
    deletedBytes,
    referencesComplete,
    cappedByLimit,
    dryRun: effectiveDryRun,
  };
  console.log("cleanupOrphanBackgrounds summary:", summary);
  return summary;
}

export const cleanupOrphanBackgrounds = onSchedule(
  { schedule: "every day 05:00", timeZone: "UTC" },
  async () => {
    await cleanupOrphanBackgroundsHandler();
  },
);

// cleanupPptxSources (R168: prune consumed/failed import sources)
// See .planning/codebase/CONCERNS.md (Backend Concern Notes (R318) § functions/src/index.ts)

/**
 * Default retention window (days), used when the PPTX_SOURCE_RETENTION_DAYS
 * env var is unset/blank/non-numeric. Source decks are only prune-eligible
 * once older than this many days.
 */
export const PPTX_SOURCE_RETENTION_DAYS = 30;

/**
 * Reads the effective pptx-source retention window in days from a resolved
 * AppConfig (R181) -- a thin passthrough over config.retention.pptxSourceDays;
 * appConfig.ts's coerceRetention owns the fail-open-capped default
 * (PPTX_SOURCE_RETENTION_DAYS).
 */
export function readPptxSourceRetentionDays(config: AppConfig): number {
  return config.retention.pptxSourceDays;
}

/**
 * Hard POSITIVE path guard: matches ONLY the source deck and the extracted
 * images/ prefix of a pptx-imports scope. Structurally unable to match
 * anything under rendered/ at the same importId -- rendered/ is excluded by
 * construction, never by a runtime name check.
 */
export const PPTX_SOURCE_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\/(source\.pptx$|images\/)/;

/** Builds the per-import Storage prefix a pptx import's source lives under. */
export function sourcePrefixFor(orgId: string, importId: string): string {
  return `orgs/${orgId}/pptx-imports/${importId}/`;
}

export interface PptxSourceCleanupSummary {
  scannedCount: number;
  deletedObjectCount: number;
  /** Total bytes deleted (LIVE) or would-delete (dry-run) this run. */
  deletedBytes: number;
  /** True when readDeleteCap() stopped a LIVE run before all eligible objects were cleared. */
  cappedByLimit: boolean;
  dryRun: boolean;
}

/**
 * The cleanupPptxSources handler body, exported separately from the
 * `onSchedule` wrapper (mirroring cleanupOrphanRendersHandler) so it can be
 * unit-tested directly against mocked Firestore/Storage.
 */
export async function cleanupPptxSourcesHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<PptxSourceCleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.pptxSourceEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.pptxSourceEnabled;

  const cutoffMs = Date.now() - readPptxSourceRetentionDays(config) * DAY_MS;
  const deleteCap = readDeleteCap(config);

  let scannedCount = 0;
  let deletedObjectCount = 0;
  let deletedBytes = 0;
  let cappedByLimit = false;

  const snapshot = await db
    .collectionGroup("pptxRenders")
    .where("status", "in", ["ready", "failed"])
    .get();

  const bucket = getStorage().bucket();

  outer: for (const renderDoc of snapshot.docs) {
    // Recover the org id from the parent chain rather than guessing -- skip
    // any doc whose parent chain is unexpectedly missing.
    const orgId = renderDoc.ref.parent.parent?.id;
    if (!orgId) {
      console.error(
        `cleanupPptxSources: skipping ${renderDoc.ref.path} -- missing parent org id`,
      );
      continue;
    }
    const importId = renderDoc.id;

    const data = renderDoc.data() as { createdAt?: { toMillis?: () => number } } | undefined;
    const createdAt = data?.createdAt;
    const createdMs = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : NaN;
    if (Number.isNaN(createdMs) || createdMs > cutoffMs) {
      // Not old enough yet (or timestamp unreadable -- fail safe, skip it).
      continue;
    }

    scannedCount++;

    const [files] = await bucket.getFiles({ prefix: sourcePrefixFor(orgId, importId) });

    // Hard safety gate, applied BEFORE any delete decision: never consider
    // anything outside source.pptx/images/, no matter how old this import is.
    const eligibleFiles = files.filter((file) => PPTX_SOURCE_GUARD.test(file.name));

    if (dryRun) {
      // Dry-run is NEVER capped -- the owner needs the true backlog
      // count/bytes before enabling live deletion, not a truncated one.
      deletedObjectCount += eligibleFiles.length;
      for (const file of eligibleFiles) {
        deletedBytes += Number(file.metadata?.size ?? 0);
      }
      continue;
    }

    for (const file of eligibleFiles) {
      if (deletedObjectCount >= deleteCap) {
        // T-66-02-04: bound this run's blast radius across the WHOLE run.
        // Idempotent-by-status/age means the next daily run resumes.
        cappedByLimit = true;
        break outer;
      }
      try {
        await file.delete();
        deletedObjectCount++;
        deletedBytes += Number(file.metadata?.size ?? 0);
      } catch (err) {
        // Partial-failure tolerance: one bad delete never aborts the run.
        console.error(`cleanupPptxSources: failed to delete ${file.name}:`, err);
      }
    }
    // Deliberately never delete renderDoc.ref here -- that doc's lifecycle
    // (and its rendered/ objects) stays owned by cleanupOrphanRendersHandler.
  }

  const summary: PptxSourceCleanupSummary = {
    scannedCount,
    deletedObjectCount,
    deletedBytes,
    cappedByLimit,
    dryRun,
  };
  console.log("cleanupPptxSources summary:", summary);
  return summary;
}

export const cleanupPptxSources = onSchedule(
  { schedule: "every day 06:00", timeZone: "UTC" },
  async () => {
    await cleanupPptxSourcesHandler();
  },
);

// previewCleanupDryRun (R188/R190: on-demand blast-radius preview)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)

export type CleanupPreviewType = "media" | "orphanRenders" | "backgrounds" | "pptxSources";

const CLEANUP_PREVIEW_TYPES: CleanupPreviewType[] = [
  "media",
  "orphanRenders",
  "backgrounds",
  "pptxSources",
];

export interface PreviewCleanupDryRunRequest {
  type: CleanupPreviewType;
}

export interface PreviewCleanupDryRunResponse {
  wouldDeleteCount: number;
  wouldDeleteBytes: number;
  /** Present only for type === "backgrounds" -- see BACKGROUND_PATH_GUARD's referencesComplete contract above. */
  referencesComplete?: boolean;
}

/**
 * The testable handler body, exported separately from the onCall wrapper
 * below -- mirrors setSuperAdminClaimHandler/setSuperAdminClaim and
 * parsePptxHandler/parsePptx.
 */
export async function previewCleanupDryRunHandler(
  request: CallableRequest<PreviewCleanupDryRunRequest>,
): Promise<PreviewCleanupDryRunResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  // Re-check #1: the caller's own ID-token claim.
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }

  // Re-check #2: an independent Firestore re-read of the source-of-truth
  // document. Defense-in-depth against a stale/forged token claim, verbatim
  // from setSuperAdminClaimHandler.
  const callerDoc = await getFirestore()
    .collection("superAdmins")
    .doc(request.auth.uid)
    .get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }

  const { type } = request.data ?? ({} as PreviewCleanupDryRunRequest);
  if (typeof type !== "string" || !CLEANUP_PREVIEW_TYPES.includes(type as CleanupPreviewType)) {
    throw new HttpsError(
      "invalid-argument",
      "type must be one of: " + CLEANUP_PREVIEW_TYPES.join(", "),
    );
  }

  switch (type as CleanupPreviewType) {
    case "media": {
      const s = await cleanupExpiredMediaHandler({ forceDryRun: true });
      if (!s.dryRun) {
        throw new Error("previewCleanupDryRun: media preview did not return dryRun:true");
      }
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
    case "orphanRenders": {
      const s = await cleanupOrphanRendersHandler({ forceDryRun: true });
      if (!s.dryRun) {
        throw new Error(
          "previewCleanupDryRun: orphanRenders preview did not return dryRun:true",
        );
      }
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
    case "backgrounds": {
      const s = await cleanupOrphanBackgroundsHandler({ forceDryRun: true });
      if (!s.dryRun) {
        throw new Error(
          "previewCleanupDryRun: backgrounds preview did not return dryRun:true",
        );
      }
      // See ADR-0026 (docs/adr/0026-note-orphancount-not-deletedobjectcount-deletedobjectcount-o.md)
      return {
        wouldDeleteCount: s.orphanCount,
        wouldDeleteBytes: s.deletedBytes,
        referencesComplete: s.referencesComplete,
      };
    }
    case "pptxSources": {
      const s = await cleanupPptxSourcesHandler({ forceDryRun: true });
      if (!s.dryRun) {
        throw new Error(
          "previewCleanupDryRun: pptxSources preview did not return dryRun:true",
        );
      }
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
  }
}

export const previewCleanupDryRun = onCall(previewCleanupDryRunHandler);

// sendScheduledReminders daily reminder cron (61-02: R145/R133/SC3/SC4)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)

/**
 * A reminderDaysBefore further ahead than this is treated as a misconfiguration
 * and skipped -- the code-side lookahead bound (the scan returns all
 * planned/exported services regardless of how far out they are; N varies per
 * service so it cannot be a query filter). A year comfortably covers any real
 * "remind me N days before" while refusing an absurd value that would fire a
 * reminder years early.
 */
export const REMINDER_MAX_DAYS_BEFORE = 366;

export interface ReminderSummary {
  scanned: number;
  enqueued: number;
}

/** The per-service messaging leaf the reminder cron reads (all fields optional). */
interface ServiceMessagingFields {
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  reminderSentAt?: unknown;
}

/** The org doc shape the reminder cron reads (settings.messaging.*, NOT messaging.*). */
interface OrgReminderData {
  settings?: {
    timezone?: string;
    messaging?: {
      enabled?: boolean;
      reminderEnabled?: boolean;
      reminderDaysBefore?: number;
    };
  };
}

/**
 * The sendScheduledReminders handler body, exported separately from the
 * onSchedule wrapper (the cleanupOrphanRendersHandler convention) so the unit
 * test imports it by name and drives it with a fixed system time -- required for
 * the timezone-boundary (R133) and SC4 idempotency assertions.
 *
 * `now` defaults to the real clock; the wrapper passes nothing so production
 * uses the invocation time, while tests pin it via vi.setSystemTime.
 */
export async function sendScheduledRemindersHandler(
  now: Date = new Date(),
): Promise<ReminderSummary> {
  const db = getFirestore();

  // Broad collection-group scan -- NEVER 'draft' (SC4 never-on-draft is
  // structural, not a runtime check). Same single-field `in` collection-group
  // class as the shipped pptxRenders scan, so it needs NO firestore.indexes.json
  // entry. The due-date and lookahead filters are applied in CODE below (N
  // varies per service, so it cannot be pushed into the query).
  const snapshot = await db
    .collectionGroup("services")
    .where("status", "in", ["planned", "exported"])
    .get();

  // Cache each org's settings across the loop so a run scanning many services in
  // one org reads that org doc at most once. `null` caches a missing org.
  const orgCache = new Map<string, OrgReminderData | null>();
  let enqueued = 0;

  for (const svcDoc of snapshot.docs) {
    // Per-item try/catch: one malformed service/org is logged and skipped, never
    // aborting the remaining candidates in the same daily run.
    try {
      const orgId = svcDoc.ref.parent.parent?.id;
      if (!orgId) {
        console.error(
          `sendScheduledReminders: skipping ${svcDoc.ref.path} -- missing parent org id`,
        );
        continue;
      }

      const svc = svcDoc.data() as {
        date?: string;
        messaging?: ServiceMessagingFields;
      };

      // SC4 idempotency: skip BEFORE any work if this service was already
      // reminded. This is the first line of the never-double-send guard.
      if (svc.messaging?.reminderSentAt) {
        continue;
      }

      // See ADR-0027 (docs/adr/0027-load-the-org-settings-for-this-org-cached-read-settings-mess.md)
      let org = orgCache.get(orgId);
      if (org === undefined) {
        const orgSnap = await db.collection("organizations").doc(orgId).get();
        org = orgSnap.exists ? (orgSnap.data() as OrgReminderData) : null;
        orgCache.set(orgId, org);
      }

      // Fail-closed kill-switch: absent settings.messaging.enabled = OFF (the
      // === true read the enqueue handler uses at :1035-1037).
      if (org?.settings?.messaging?.enabled !== true) {
        continue;
      }
      const orgMessaging = org.settings.messaging;

      // service-then-org resolution for the enable flag and N (service-then-org
      // -then-7 for N).
      const effectiveReminderEnabled =
        svc.messaging?.reminderEnabled ?? orgMessaging.reminderEnabled;
      if (!effectiveReminderEnabled) {
        continue;
      }
      const effectiveN =
        svc.messaging?.reminderDaysBefore ?? orgMessaging.reminderDaysBefore ?? 7;

      // Code-side lookahead bound (not a query filter): refuse an absurd N.
      if (!Number.isFinite(effectiveN) || effectiveN < 0 || effectiveN > REMINDER_MAX_DAYS_BEFORE) {
        continue;
      }

      // Due check (R133/SC3): fire only when the service date minus N days equals
      // "today" in the ORG's local timezone -- calendar-day granularity via the
      // 61-01 helpers. A malformed svc.date makes minusDays throw, which the
      // per-item catch turns into a skip.
      const dueDate = minusDays(svc.date as string, effectiveN);
      const today = todayInTimeZone(org.settings.timezone ?? "UTC", now);
      if (dueDate !== today) {
        continue;
      }

      // Enqueue via the SHARED shaper -- the SAME write shape as
      // queueServiceMessageHandler (:1047-1064), so sendQueuedMessage fires
      // identically to a human send. requestedByUid:'system' is a safe sentinel:
      // sendCopyToSelf:false means the requester email is never resolved.
      const subject = "Reminder: your upcoming service";
      const body =
        "This is a reminder that you're scheduled to serve at an upcoming service. " +
        "View the service details here: {{service_link}}";
      const messageRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("services")
        .doc(svcDoc.id)
        .collection("messages")
        .doc();
      await messageRef.set(
        createQueuedMessage({
          orgId,
          serviceId: svcDoc.id,
          type: "reminder",
          subject,
          body,
          recipientSelector: { teams: [], individualPersonIds: [], includeEveryone: true },
          options: { attachServiceLink: true, sendCopyToSelf: false },
          scheduledFor: null,
          requestedByUid: "system",
        }),
      );

      // AFTER a successful enqueue, set the idempotency marker via the Admin SDK
      // dot-path merge -- this bypasses the Phase 58 draft-only /services rule so
      // it lands on a LOCKED service. (The crash-between-writes window is a rare
      // single double-send at daily cadence; the claim-first transactional
      // upgrade is documented in 61-02-SUMMARY.)
      await svcDoc.ref.set(
        { messaging: { reminderSentAt: FieldValue.serverTimestamp() } },
        { merge: true },
      );
      enqueued++;
    } catch (err) {
      console.error(
        `sendScheduledReminders: skipping ${svcDoc.ref.path} -- error during processing:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const summary: ReminderSummary = { scanned: snapshot.docs.length, enqueued };
  console.log("sendScheduledReminders summary:", summary);
  return summary;
}

// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
export async function runScheduledMessagingCron(
  db: Firestore = getFirestore(),
): Promise<void> {
  const config = await getAppConfig(db, { fresh: true });
  if (!config.messaging.scheduledCronEnabled) {
    console.log(
      "runScheduledMessagingCron: messaging.scheduledCronEnabled is not true -- skipping both the reminder sweep and the schedule-for-later dispatch sweep (zero cross-org reads).",
    );
    return;
  }
  try {
    await sendScheduledRemindersHandler();
  } catch (err) {
    console.error(
      "sendScheduledReminders: reminder sweep failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
  try {
    await dispatchDueScheduledMessagesHandler();
  } catch (err) {
    console.error(
      "sendScheduledReminders: dispatch sweep failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export const sendScheduledReminders = onSchedule(
  { schedule: "every day 04:00", timeZone: "UTC" },
  async () => {
    await runScheduledMessagingCron();
  },
);

// dispatchDueScheduledMessagesHandler (61-03: R141 schedule-for-later)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)

/** The rolled-up outcome of one dispatch sweep. */
export interface DispatchSummary {
  scanned: number;
  dispatched: number;
}

/**
 * Reads a scheduledFor value (the composer stores an ISO string; a Firestore
 * Timestamp exposes toMillis()) as epoch millis, or null when it is absent or
 * unparseable. Supporting BOTH shapes is load-bearing: the real 59-02 composer
 * writes an ISO string, so a Timestamp-only reader would silently never dispatch
 * any production scheduled message.
 */
function scheduledForMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts) */
export async function dispatchDueScheduledMessagesHandler(
  now: Date = new Date(),
): Promise<DispatchSummary> {
  const db = getFirestore();
  const nowMs = now.getTime();

  // Single-field equality collection-group scan -- NO composite index. The
  // due-ness filter is applied in CODE below (a `.where('scheduledFor','<=',now)`
  // would force a composite index; research § Firestore Indexes).
  const snapshot = await db
    .collectionGroup("messages")
    .where("status", "==", "scheduled")
    .get();

  let dispatched = 0;

  for (const msgDoc of snapshot.docs) {
    // Per-item try/catch: one malformed scheduled message is logged and skipped,
    // never aborting the remaining due candidates in the same run.
    try {
      const data = msgDoc.data() as QueuedMessageDoc | undefined;

      // Code-side due filter: skip a null/absent or future scheduledFor.
      const whenMs = scheduledForMillis(data?.scheduledFor);
      if (whenMs === null || whenMs > nowMs) {
        continue;
      }

      // Recover the service id from the parent chain (ref.parent.parent is the
      // service doc) and the org id one level up.
      const serviceDocRef = msgDoc.ref.parent?.parent;
      const serviceId = serviceDocRef?.id;
      const orgId = serviceDocRef?.parent?.parent?.id;
      if (!serviceId || !orgId) {
        console.error(
          `dispatchDueScheduledMessages: skipping ${msgDoc.ref.path} -- missing service/org id`,
        );
        continue;
      }

      // Transactional claim on the ORIGINAL, mirroring sendQueuedMessage's
      // queued->sending claim (:1442-1449): flip scheduled->dispatched ONLY if
      // still 'scheduled'. A retried run reads 'dispatched' and no-ops here --
      // the idempotency guard (T-61-03a).
      const claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(msgDoc.ref);
        if (!snap.exists) return { claimed: false as const };
        const current = snap.data() as QueuedMessageDoc | undefined;
        if (!current || current.status !== "scheduled") return { claimed: false as const };
        tx.update(msgDoc.ref, { status: "dispatched", updatedAt: FieldValue.serverTimestamp() });
        return { claimed: true as const };
      });
      if (!claim.claimed) {
        continue;
      }

      // ONLY after a successful claim: CREATE a FRESH doc (a genuine
      // onDocumentCreated that re-fires sendQueuedMessage). scheduledFor:null ->
      // status:'queued' (:1141). Preserving requestedByUid keeps
      // options.sendCopyToSelf resolving the ORIGINAL editor's address.
      const newRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("services")
        .doc(serviceId)
        .collection("messages")
        .doc();
      await newRef.set(
        createQueuedMessage({
          orgId,
          serviceId,
          type: data!.type,
          subject: data!.subject,
          body: data!.body,
          recipientSelector: data!.recipientSelector,
          options: data!.options,
          scheduledFor: null,
          requestedByUid: data!.requestedByUid,
        }),
      );
      dispatched++;
    } catch (err) {
      console.error(
        `dispatchDueScheduledMessages: skipping ${msgDoc.ref.path} -- error during processing:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const summary: DispatchSummary = { scanned: snapshot.docs.length, dispatched };
  console.log("dispatchDueScheduledMessages summary:", summary);
  return summary;
}

// queueServiceMessage send-path enqueue (59-02: R131/R137/R141)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)

/**
 * The message types a composer or an automatic trigger can queue (R137).
 * 'lock-notification' (Phase 61) is the automatic lock email; 'relock-notification'
 * (Phase 62) is the re-lock change notice, added the same way — appended to BOTH the
 * union and the MESSAGE_TYPES array, and the enum gate + shared shaper pick it up
 * unchanged.
 */
export type MessageType =
  | "oneoff"
  | "reminder"
  | "share-link"
  | "lock-notification"
  | "relock-notification";

const MESSAGE_TYPES: readonly MessageType[] = [
  "oneoff",
  "reminder",
  "share-link",
  "lock-notification",
  "relock-notification",
];

/** Clock-skew grace so a "send now" whose client clock is slightly ahead is not rejected as past. */
const SCHEDULE_PAST_GRACE_MS = 5 * 60 * 1000;

/** A scheduledFor further ahead than ~1 year is treated as absurd input. */
const MAX_SCHEDULE_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

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

/**
 * A single scoped change entry in a relock-notification's audit trail (R148).
 * Functions-LOCAL: the monorepo has no shared package, so `affectedTeams` is
 * `string[]` (the same RoleGroup enum-string values the client uses), never the
 * client `RoleGroup` type. `type` is a change-category string ('SONG' | 'ORDER'
 * | 'ROLE' | 'NOTES' | 'SLIDES').
 */
export interface ChangeEntry {
  type: string;
  description: string;
  affectedTeams: string[];
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
  /** Optional scoped change audit trail — relock-notification only (R148). */
  changeDiff?: ChangeEntry[] | null;
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
  changeDiff: ChangeEntry[] | null;
  scheduledFor: string | null;
  requestedByUid: string;
  createdAt: FieldValue;
  sentAt: null;
  deliveryCounts: DeliveryCounts;
}

/** Input to the pure createQueuedMessage shaper: the request plus the re-verified caller uid. */
export type CreateQueuedMessageInput = QueueMessageRequest & { requestedByUid: string };

/**
/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts) */
export function createQueuedMessage(input: CreateQueuedMessageInput): QueuedMessageDoc {
  const scheduledFor = input.scheduledFor ?? null;
  return {
    type: input.type,
    status: scheduledFor ? "scheduled" : "queued",
    subject: input.subject,
    body: input.body,
    recipientSelector: input.recipientSelector,
    options: input.options,
    changeDiff: input.changeDiff ?? null,
    scheduledFor,
    requestedByUid: input.requestedByUid,
    createdAt: FieldValue.serverTimestamp(),
    sentAt: null,
    deliveryCounts: { sent: 0, failed: 0 },
  };
}

/**
/**
 * The queueServiceMessage handler body (59-02 threat model T-59-02a..e).
 * See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
 */
export async function queueServiceMessageHandler(
  request: CallableRequest<QueueMessageRequest>,
): Promise<QueueMessageResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const {
    orgId,
    serviceId,
    type,
    subject,
    body,
    recipientSelector,
    options,
    scheduledFor,
    changeDiff,
  } = request.data ?? ({} as QueueMessageRequest);

  if (!orgId || !serviceId || !type || !subject || !body || !recipientSelector || !options) {
    throw new HttpsError(
      "invalid-argument",
      "orgId, serviceId, type, subject, body, recipientSelector, and options are all required.",
    );
  }

  // Type enum (R137) — reject anything outside the three known types.
  if (!MESSAGE_TYPES.includes(type)) {
    throw new HttpsError("invalid-argument", `Unknown message type "${type}".`);
  }

  // scheduledFor sanity: null means send now. When present it must parse and
  // fall within (now - grace, now + ~1 year]; a past or absurd-future instant
  // is rejected before any Firestore work.
  const normalizedScheduledFor = scheduledFor ?? null;
  if (normalizedScheduledFor !== null) {
    const whenMs = Date.parse(normalizedScheduledFor);
    if (Number.isNaN(whenMs)) {
      throw new HttpsError("invalid-argument", "scheduledFor is not a valid date.");
    }
    const now = Date.now();
    if (whenMs < now - SCHEDULE_PAST_GRACE_MS) {
      throw new HttpsError("invalid-argument", "scheduledFor is in the past.");
    }
    if (whenMs > now + MAX_SCHEDULE_AHEAD_MS) {
      throw new HttpsError("invalid-argument", "scheduledFor is too far in the future.");
    }
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);

  // Independent editor-tier re-check — never trust the client-declared orgId.
  const memberDoc = await orgRef.collection("members").doc(request.auth.uid).get();
  if (!memberDoc.exists) {
    throw new HttpsError("permission-denied", "You are not a member of this organization.");
  }
  const role = (memberDoc.data() as { role?: string } | undefined)?.role;
  if (role !== "editor" && role !== "admin") {
    throw new HttpsError("permission-denied", "You must be an editor to send messages.");
  }

  // Kill-switch re-read server-side (no existing Function reads settings.messaging;
  // modeled on the memberDoc.get() shape above). Defaults closed: a missing org
  // doc or absent settings.messaging.enabled is treated as OFF.
  const orgDoc = await orgRef.get();
  const messagingEnabled =
    (orgDoc.data() as { settings?: { messaging?: { enabled?: boolean } } } | undefined)?.settings
      ?.messaging?.enabled === true;
  if (!messagingEnabled) {
    throw new HttpsError(
      "failed-precondition",
      "Messaging is turned off for this organization.",
    );
  }

  // R344 (117-01): a per-uid enqueue-rate ceiling and a per-org daily enqueue
  // quota, on DEDICATED counters so message enqueues never cross-deplete the
  // shared AI-proxy aiRateLimits budget or the send-side orgEmailCounters
  // quota. Independent of, and additional to, the downstream
  // MESSAGE_MAX_RECIPIENTS / ORG_MAX_EMAILS_PER_DAY send-side caps. Reusing
  // the existing aiProxy/messaging appConfig knobs is deliberate -- a new
  // knob would need the out-of-scope frontend appConfig duplicate.
  let queueConfig: AppConfig = DEFAULT_APP_CONFIG;
  try {
    queueConfig = await getAppConfig(db);
  } catch (configErr) {
    console.warn("[queueServiceMessage] appConfig read failed; failing open to defaults:", {
      message: configErr instanceof Error ? configErr.message : String(configErr),
    });
  }
  try {
    const enqueueRate = await checkAndConsumeRateLimit(
      db,
      request.auth.uid,
      {
        maxPerMin: queueConfig.aiProxy.rateLimitPerMin,
        maxPerDay: queueConfig.aiProxy.rateLimitPerDay,
      },
      Date.now(),
      "msgEnqueueRateLimits",
    );
    if (!enqueueRate.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "You are enqueueing messages too quickly. Please slow down and try again shortly.",
      );
    }
    const enqueueOrgQuota = await checkAndConsumeOrgEmailQuota(
      db,
      orgId,
      1,
      queueConfig.messaging.orgDailyEmailQuota,
      Date.now(),
      "msgEnqueueOrgCounters",
    );
    if (!enqueueOrgQuota.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        "This organization has reached its daily message-enqueue limit.",
      );
    }
  } catch (limiterErr) {
    if (limiterErr instanceof HttpsError) {
      throw limiterErr;
    }
    // Fail OPEN: the limiter is a cost guardrail, not a security control
    // (locked decision, 65-CONTEXT.md) -- a Firestore hiccup must never block
    // a legitimate enqueue.
    console.warn("[queueServiceMessage] enqueue limiter Firestore op failed; failing open:", {
      message: limiterErr instanceof Error ? limiterErr.message : String(limiterErr),
    });
  }

  // Enqueue exactly one messages/{id} doc via the shared shaper. Recipients are
  // NOT resolved and nothing is sent here — the 59-03 trigger owns that.
  const messageRef = orgRef
    .collection("services")
    .doc(serviceId)
    .collection("messages")
    .doc();
  await messageRef.set(
    createQueuedMessage({
      orgId,
      serviceId,
      type,
      subject,
      body,
      recipientSelector,
      options,
      scheduledFor: normalizedScheduledFor,
      changeDiff,
      requestedByUid: request.auth.uid,
    }),
  );

  return { messageId: messageRef.id };
}

// NO secrets: array — queueServiceMessage only enqueues and must never hold
// RESEND_API_KEY (R131 "smallest key-holding surface"). The secret binds only
// to sendQueuedMessage (59-03).
export const queueServiceMessage = onCall(queueServiceMessageHandler);

// --- sendQueuedMessage send trigger (59-03: R131/R138/R139) --------------
//
// See ADR-0028 (docs/adr/0028-the-send-half-of-the-queue-then-trigger-path-an-ondocumentcr.md)

// R181: the bare From *address* Resend sends as used to live here as a
// deploy-time defineString param -- REMOVED outright (not layered as a
// fallback) and replaced by the live, admin-editable config.sender.fromAddress
// (appConfig/global, resolved once at the top of sendQueuedMessageHandler
// below). The organization's own name is still applied as the RFC 5322
// display name at send time (see `fromDisplayName`); only the bare address
// itself moved to appConfig.
//
// ⚠ Whatever address is configured MUST have its domain verified in Resend or
// every send 403s ("domain is not verified"). appConfig.ts's DEFAULT_APP_CONFIG
// falls back to Resend's zero-setup test sender `onboarding@resend.dev`, which
// needs NO domain verification but (in Resend's test mode) only delivers to
// the Resend account owner's own email -- enough to validate the send path
// end-to-end while testing. Editing the live value (Phase 70 console, or
// directly in appConfig/global) to a verified `no-reply@<your domain>` is how
// real volunteers receive mail -- no redeploy required, unlike the old
// deploy-time param. A `*.web.app` address can never be verified
// See ADR-0029 (docs/adr/0029-google-managed-no-dns-access-fromdisplayname-bareemailaddres.md)

/** Resend tag names AND values allow only these chars (59-RESEARCH.md Pitfall 3). */
const RESEND_TAG_SAFE = /^[A-Za-z0-9_-]+$/;

/** The rolled-up outcome of a send attempt (or a skipped no-op). */
export interface SendOutcome {
  status: "sent" | "partial" | "failed" | "skipped";
  sentCount: number;
  failedCount: number;
  skippedReason?: string;
}

/** One resolved send target (a reachable volunteer, or the self-copy). */
interface SendTarget {
  id: string;
  name: string;
  email: string;
  roleNames: string[];
}

/**
 * Org-local calendar "today" as 'YYYY-MM-DD' (R145 / R133). Uses
 * Intl.DateTimeFormat('en-CA', { timeZone }) — 'en-CA' emits YYYY-MM-DD
 * directly and Node 22 ships full ICU, so any IANA zone resolves with NO npm
 * package. This is the same timeZone-aware discipline formatServiceDate relies
 * on (see the UTC-pin below, :1120-1130): a service near midnight is reckoned
 * in the org's zone, not UTC. Pure — no Firestore, no firebase-admin.
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Subtracts n calendar days from a 'YYYY-MM-DD' string, UTC-pinned. The `Z` in
 * `${dateYmd}T00:00:00Z` is load-bearing: it makes the subtraction a pure
 * calendar-day count immune to DST (no 23/25h drift), matching formatServiceDate's
 * UTC pin (:1120-1130). Pure — string in, string out.
 */
export function minusDays(dateYmd: string, n: number): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats a service's YYYY-MM-DD date for {{service_date}}. UTC-pinned so the
 * output is deterministic regardless of the Function's locale/timezone; falls
 * back to the raw string if it does not parse.
 */
function formatServiceDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Resolves the service's public share-link URL for {{service_link}} directly
 * from the top-level `shareTokens` collection (VERIFIED shape: serviceId field,
 * route /share/:token — src/stores/services.ts:652). Picks the most-recently
 * created token belonging to THIS org (the client's pickAdoptableToken filters
 * by org then recency); returns '' when the base is unconfigured or no token
 * exists (A1). Does NOT import buildServiceSnapshot (Pinia/@-bound, 59-RESEARCH
 * Anti-Pattern).
 */
async function resolveServiceLink(
  db: ReturnType<typeof getFirestore>,
  orgId: string,
  serviceId: string,
): Promise<string> {
  const base = SERVICE_SHARE_BASE_URL.value().trim();
  if (base === "") return "";

  const snap = await db.collection("shareTokens").where("serviceId", "==", serviceId).get();
  const candidates = snap.docs
    .map((d) => {
      const data = d.data() as { orgId?: string; createdAt?: { toMillis?: () => number } };
      const createdMs =
        typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0;
      return { token: d.id, orgId: data.orgId, createdMs };
    })
    .filter((c) => c.orgId === orgId);
  if (candidates.length === 0) return "";

  candidates.sort((a, b) => b.createdMs - a.createdMs);
  const token = candidates[0]!.token;
  return `${base.replace(/\/+$/, "")}/share/${token}`;
}

/**
 * Resolves the requesting editor's own email SERVER-SIDE from their auth record
 * (never a client-supplied address) for options.sendCopyToSelf. Returns '' if
 * the user or email cannot be resolved.
 */
async function resolveEditorEmail(uid: string): Promise<string> {
  try {
    const user = await getAuth().getUser(uid);
    return user.email ?? "";
  } catch (err) {
    console.error("sendQueuedMessage: could not resolve requesting editor's email:", err instanceof Error ? err.message : String(err));
    return "";
  }
}

export async function sendQueuedMessageHandler(params: {
  orgId: string;
  serviceId: string;
  messageId: string;
}): Promise<SendOutcome> {
  const { orgId, serviceId, messageId } = params;
  const db = getFirestore();
  // R181/R183: resolved ONCE here, before any per-recipient loop below --
  // the CACHED form (no {fresh:true}), since sendQueuedMessage is a hot,
  // per-message request path, not a cron (mirrors the api proxy's own
  // cached read above). Anti-pattern to avoid: never re-resolve inside the
  // recipient loop -- the loop can iterate up to maxRecipients recipients.
  // Fail OPEN to DEFAULT_APP_CONFIG (review IN-01): this is a cost/limits
  // guardrail, not a security control -- a Firestore hiccup here must not
  // strand the message in 'queued' (the onDocumentCreated trigger has no
  // retry configured, so it would otherwise sit stuck until manual reprocess).
  let config: AppConfig = DEFAULT_APP_CONFIG;
  try {
    config = await getAppConfig(db);
  } catch (configErr) {
    console.warn("[sendQueuedMessage] appConfig read failed; failing open to defaults:", {
      message: configErr instanceof Error ? configErr.message : String(configErr),
    });
  }
  const orgRef = db.collection("organizations").doc(orgId);
  const serviceRef = orgRef.collection("services").doc(serviceId);
  const messageRef = serviceRef.collection("messages").doc(messageId);

  // ① + ② IDEMPOTENCY CLAIM (NEW code, no verbatim analog): a transaction reads
  // status and flips queued->sending ONLY if currently 'queued'. A missing doc,
  // or any other status ('sending'/'sent'/'scheduled'/…), returns "not claimed"
  // and the handler sends nothing — this stops a retried at-least-once
  // onDocumentCreated from double-sending, and leaves a 'scheduled' doc inert
  // for Phase 61's cron.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(messageRef);
    if (!snap.exists) return { claimed: false as const, data: null };
    const data = snap.data() as QueuedMessageDoc | undefined;
    if (!data || data.status !== "queued") return { claimed: false as const, data: null };
    tx.update(messageRef, { status: "sending", updatedAt: FieldValue.serverTimestamp() });
    return { claimed: true as const, data };
  });
  if (!claim.claimed || !claim.data) {
    return { status: "skipped", sentCount: 0, failedCount: 0, skippedReason: "not-queued" };
  }
  const message = claim.data;

  // See ADR-0030 (docs/adr/0030-the-three-message-level-ids-become-resend-tags-pitfall-3-if.md)
  if (![orgId, serviceId, messageId].every((id) => RESEND_TAG_SAFE.test(id))) {
    await messageRef.set(
      { status: "failed", sentAt: FieldValue.serverTimestamp(), deliveryCounts: { sent: 0, failed: 0 } },
      { merge: true },
    );
    return { status: "failed", sentCount: 0, failedCount: 0, skippedReason: "unsafe-tag-id" };
  }

  // ③ RE-RESOLVE recipients from scratch (Anti-Pattern 1). Admin-SDK-load the
  // service, its quarters, the org roles and people, and feed them through the
  // 59-01 port using the doc's recipientSelector as who-to-resolve intent — the
  // client's stored list is NEVER the send list.
  const serviceSnap = await serviceRef.get();
  if (!serviceSnap.exists) {
    await messageRef.set(
      { status: "failed", sentAt: FieldValue.serverTimestamp(), deliveryCounts: { sent: 0, failed: 0 } },
      { merge: true },
    );
    return { status: "failed", sentCount: 0, failedCount: 0, skippedReason: "missing-service" };
  }
  const serviceData = serviceSnap.data() as {
    date: string;
    slots?: Array<{ kind?: string; position?: number; songTitle?: string | null }>;
    roleAssignmentOverrides?: Record<string, string[]>;
  };

  const [orgSnap, quartersSnap, rolesSnap, peopleSnap] = await Promise.all([
    orgRef.get(),
    orgRef.collection("quarters").get(),
    orgRef.collection("roles").get(),
    orgRef.collection("people").get(),
  ]);
  const orgName = fromDisplayName((orgSnap.data() as { name?: string | null } | undefined)?.name);
  const quarters = quartersSnap.docs.map((d) => d.data() as PortedQuarter);
  // See ADR-0031 (docs/adr/0031-read-time-compat-shim-r250-mirrors-src-stores-roster-ts-s.md)
  const roles = rolesSnap.docs.map((d) => {
    const data = d.data() as { group?: string; vocal?: boolean; [k: string]: unknown };
    return { id: d.id, ...data, ...coerceLegacyRoleGroup(data) } as PortedRole;
  });
  const people = peopleSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PortedPerson);

  const assignments = resolveServiceRoleAssignments(
    { date: serviceData.date, roleAssignmentOverrides: serviceData.roleAssignmentOverrides },
    quarters,
    roles,
  );
  const selection: RecipientSelection = {
    teams: (message.recipientSelector?.teams ?? []) as RoleGroup[],
    individualPersonIds: message.recipientSelector?.individualPersonIds ?? [],
    includeEveryone: message.recipientSelector?.includeEveryone ?? false,
  };
  const { reachable } = resolveMessageRecipients(assignments, people, selection);

  // ④ Derive the message-level token context once (the per-recipient
  // {{their_roles}} is applied inside the loop). {{song_list}} comes from the
  // service doc's SONG slots (Admin SDK — never buildServiceSnapshot);
  // {{service_link}} from the stored share link.
  const serviceDate = formatServiceDate(serviceData.date);
  const songTitles = (serviceData.slots ?? [])
    .filter((s) => s?.kind === "SONG")
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => (typeof s.songTitle === "string" ? s.songTitle.trim() : ""))
    .filter((t) => t.length > 0);
  const serviceLink = await resolveServiceLink(db, orgId, serviceId);

  // Build the send list: reachable volunteers + optional server-resolved self-copy.
  const sendList: SendTarget[] = reachable.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    roleNames: r.roleNames,
  }));
  // Resolve the sending editor's email ONCE — it is both the auto-built
  // Reply-To (so a volunteer's reply reaches the human who sent the message,
  // with no domain-verification requirement on Reply-To) and, when opted in,
  // the self-copy recipient. Empty string when unresolved (Reply-To omitted).
  const senderEmail = message.requestedByUid ? await resolveEditorEmail(message.requestedByUid) : "";
  if (message.options?.sendCopyToSelf && message.requestedByUid && senderEmail) {
    sendList.push({ id: message.requestedByUid, name: "You", email: senderEmail, roleNames: [] });
  }

  // R171/R181: Resend send-loop volume guardrails, both config-tunable (live,
  // no redeploy) and both generous so a legitimate send never hits them --
  // they exist to stop a loop/bug/abuse fan-out, not to shape normal use.
  // Sourced from the `config` resolved once at the top of this handler
  // (mirroring the api proxy's own cached readAiProxyLimits(config) read).
  const MESSAGE_MAX_RECIPIENTS = config.messaging.maxRecipients;
  const ORG_MAX_EMAILS_PER_DAY = config.messaging.orgDailyEmailQuota;

  // Per-message recipient cap: a queued message resolving to MORE than
  // MESSAGE_MAX_RECIPIENTS is REJECTED (never truncated) -- a 200+ recipient
  // worship-team message is almost certainly a mistake, and silent
  // truncation would be worse than a visible failure. Checked BEFORE `new
  // Resend(...)` / the send loop, so an over-cap message sends zero emails.
  if (sendList.length > MESSAGE_MAX_RECIPIENTS) {
    await messageRef.set(
      {
        status: "failed",
        sentAt: FieldValue.serverTimestamp(),
        deliveryCounts: { sent: 0, failed: 0 },
        failureReason: "over-recipient-cap",
      },
      { merge: true },
    );
    console.error(
      `sendQueuedMessage: rejected ${messageId} -- ${sendList.length} recipients exceeds MESSAGE_MAX_RECIPIENTS (${MESSAGE_MAX_RECIPIENTS})`,
    );
    return { status: "failed", sentCount: 0, failedCount: 0, skippedReason: "over-recipient-cap" };
  }

  // See ADR-0032 (docs/adr/0032-r171-per-org-daily-resend-send-quota-a-fixed-window-admin-sd.md)
  if (sendList.length > 0) {
    try {
      const quota = await checkAndConsumeOrgEmailQuota(db, orgId, sendList.length, ORG_MAX_EMAILS_PER_DAY);
      if (!quota.allowed) {
        await messageRef.set(
          {
            status: "failed",
            sentAt: FieldValue.serverTimestamp(),
            deliveryCounts: { sent: 0, failed: 0 },
            failureReason: "over-org-daily-quota",
          },
          { merge: true },
        );
        console.error(
          `sendQueuedMessage: skipped ${messageId} -- org ${orgId} is at/over ORG_MAX_EMAILS_PER_DAY (${ORG_MAX_EMAILS_PER_DAY})`,
        );
        return { status: "failed", sentCount: 0, failedCount: 0, skippedReason: "over-org-daily-quota" };
      }
    } catch (quotaErr) {
      // Fail OPEN: the quota is a cost guardrail, not a security control
      // (locked decision, 65-CONTEXT.md) -- a quota-check Firestore hiccup
      // must never take mail down or leave a claimed message stuck in
      // `sending` with no terminal status.
      console.warn("sendQueuedMessage: org quota check Firestore op failed; failing open:", {
        messageId,
        orgId,
        message: quotaErr instanceof Error ? quotaErr.message : String(quotaErr),
      });
    }
  }

  // ⑤ + ⑥ Per recipient: render THAT person's subject/body (R139), send via the
  // mocked-in-tests Resend, and write recipients/{id}. Per-recipient try/catch
  // so one bad address is a status:'failed' recipient, not an aborted batch.
  const resend = new Resend(RESEND_API_KEY.value());
  // From = the org's own name (display) over the app's verified sending
  // address (R181: config.sender.fromAddress, resolved once at the top of
  // this handler -- REPLACES the old defineString-based sender param
  // outright, no competing fallback). bareEmailAddress peels any display
  // name already baked into the configured value (e.g. a legacy "Name
  // <email>" override) so wrapping never nests angle brackets. Org name is
  // header-sanitized above; wrap in a quoted-string. Bare address when the
  // org has no name. config.sender.fromName stays dormant this phase (the
  // per-message display name is still the org's own name, R159 unchanged).
  const fromEmail = bareEmailAddress(config.sender.fromAddress);
  const fromAddress = orgName ? `"${orgName}" <${fromEmail}>` : fromEmail;
  let sentCount = 0;
  let failedCount = 0;

  for (const target of sendList) {
    const recipientRef = messageRef.collection("recipients").doc(target.id);
    try {
      if (!RESEND_TAG_SAFE.test(target.id)) {
        throw new Error("recipient id is not Resend-tag-safe");
      }
      const tokenCtx = { serviceDate, theirRoles: target.roleNames, recipientName: target.name, songTitles, serviceLink };
      const subject = renderMessageTokens(message.subject, tokenCtx);
      const body = renderMessageTokens(message.body, tokenCtx);

      const result = await resend.emails.send({
        from: fromAddress,
        to: target.email,
        ...(senderEmail ? { replyTo: senderEmail } : {}),
        subject,
        text: body,
        tags: [
          { name: "orgId", value: orgId },
          { name: "serviceId", value: serviceId },
          { name: "messageId", value: messageId },
          { name: "recipientId", value: target.id },
        ],
      });
      const providerMessageId = (result as { data?: { id?: string } | null })?.data?.id ?? null;

      await recipientRef.set({
        personId: target.id,
        email: target.email,
        name: target.name,
        roleNames: target.roleNames,
        status: "sent",
        providerMessageId,
        bounceReason: null,
        sentAt: FieldValue.serverTimestamp(),
        bouncedAt: null,
      });
      sentCount++;
    } catch (err) {
      // Never log the recipient's full email at info level (T-59-03c) — the
      // tag-safe recipient id is enough to correlate.
      console.error(
        `sendQueuedMessage: send failed for recipient ${target.id}:`,
        err instanceof Error ? err.message : String(err),
      );
      await recipientRef.set({
        personId: target.id,
        email: target.email,
        name: target.name,
        roleNames: target.roleNames,
        status: "failed",
        providerMessageId: null,
        bounceReason: null,
        sentAt: FieldValue.serverTimestamp(),
        bouncedAt: null,
      });
      failedCount++;
    }
  }

  // ⑦ Roll up deliveryCounts and flip the message status. Zero recipients (or
  // all succeeded) => 'sent'; a mix => 'partial'; all failed => 'failed'.
  const total = sentCount + failedCount;
  const status: "sent" | "partial" | "failed" =
    total === 0 || failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
  await messageRef.set(
    {
      status,
      sentAt: FieldValue.serverTimestamp(),
      deliveryCounts: { sent: sentCount, failed: failedCount },
    },
    { merge: true },
  );

  return { status, sentCount, failedCount };
}

// The ONLY Function bound to RESEND_API_KEY (R131). The options-object form of
// onDocumentCreated is required to attach the secret (mirrors the `api`
// handler's { secrets: [...] } shape).
export const sendQueuedMessage = onDocumentCreated(
  {
    document: "organizations/{orgId}/services/{serviceId}/messages/{messageId}",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    await sendQueuedMessageHandler({
      orgId: event.params.orgId,
      serviceId: event.params.serviceId,
      messageId: event.params.messageId,
    });
  },
);

// messageWebhook (60-02: R143 — Resend delivery/bounce receiver)
// See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)

/**
 * The subset of a Resend `email.bounced` event's `data` object this handler
 * reads. Declared functions-local (mirroring index.ts's other inline domain
 * types) rather than importing a client type. `tags` echoes back the four path
 * segments 59-03 sent ({orgId,serviceId,messageId,recipientId}); `email_id` is
 * the provider message id 59-03 stored as recipients/{id}.providerMessageId.
 */
interface ResendBounceData {
  email_id?: string;
  tags?: Record<string, string>;
  bounce?: { type?: string; subType?: string; message?: string };
}

/** See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts) */
export async function resolveRecipientRef(
  db: Firestore,
  data: ResendBounceData,
): Promise<DocumentReference | null> {
  const tags = data.tags;
  if (tags?.orgId && tags.serviceId && tags.messageId && tags.recipientId) {
    return db.doc(
      `organizations/${tags.orgId}/services/${tags.serviceId}/messages/${tags.messageId}/recipients/${tags.recipientId}`,
    );
  }
  if (data.email_id) {
    const snap = await db
      .collectionGroup("recipients")
      .where("providerMessageId", "==", data.email_id)
      .limit(1)
      .get();
    if (!snap.empty && snap.docs[0]) return snap.docs[0].ref;
  }
  return null;
}

/**
 * Idempotently record a hard bounce against an addressed recipient.
 * See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
 */
export async function recordBounce(
  db: Firestore,
  recipientRef: DocumentReference,
  bounce: { type?: string; subType?: string; message?: string },
): Promise<void> {
  const messageRef = recipientRef.parent.parent;
  if (!messageRef) return; // a recipients/{id} always has a messages/{id} parent — defensive
  const bounceReason = bounce.message ?? bounce.subType ?? null;
  await db.runTransaction(async (tx) => {
    const recipientSnap = await tx.get(recipientRef);
    const messageSnap = await tx.get(messageRef);
    const recipientData = recipientSnap.data() as { status?: string } | undefined;
    if (recipientData?.status === "bounced") return; // duplicate delivery — no-op
    tx.update(recipientRef, {
      status: "bounced",
      bounceReason,
      bouncedAt: FieldValue.serverTimestamp(),
    });
    const messageData = messageSnap.data() as
      | { deliveryCounts?: { bounced?: number } }
      | undefined;
    const prev = messageData?.deliveryCounts?.bounced ?? 0;
    tx.update(messageRef, { "deliveryCounts.bounced": prev + 1 });
  });
}

/**
 * The messageWebhook handler body -- VERIFY-FIRST ORDER CONTRACT (security-critical, 60-CONTEXT.md).
 * See .planning/codebase/INTEGRATIONS.md (Backend Integration Notes (R318) § functions/src/index.ts)
 */
export async function messageWebhookHandler(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  webhookSecret: string,
): Promise<{ status: number; body: string }> {
  // (1) Fail closed on a non-Buffer body — never re-serialize req.body.
  if (!Buffer.isBuffer(rawBody)) {
    return { status: 400, body: "malformed body" };
  }
  // (2) VERIFY FIRST — zero Firestore access before this passes.
  if (!verifySvixSignature(rawBody, headers, webhookSecret)) {
    return { status: 401, body: "invalid signature" };
  }
  // (3) Parse only after the signature is proven.
  let event: { type?: string; data?: ResendBounceData };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { status: 400, body: "malformed json" };
  }
  // (4) Only a hard (Permanent) bounce surfaces; everything else acks with 200.
  const data = event.data;
  const bounce = data?.bounce;
  if (event.type !== "email.bounced" || bounce?.type !== "Permanent" || !data) {
    return { status: 200, body: "ok" };
  }
  const db = getFirestore();
  const recipientRef = await resolveRecipientRef(db, data);
  if (!recipientRef) {
    // Valid event, unresolvable recipient -> 200 (never a retry loop).
    return { status: 200, body: "ok" };
  }
  await recordBounce(db, recipientRef, bounce);
  return { status: 200, body: "ok" };
}

// The ONLY Function bound to RESEND_WEBHOOK_SECRET (mirrors RESEND_API_KEY ->
// sendQueuedMessage). The onRequest options-object form attaches the secret (the
// `api` handler's { secrets: [...] } shape); the handler body stays exported
// separately. The secret is read via .value() inside the wrapper.
export const messageWebhook = onRequest(
  { secrets: [RESEND_WEBHOOK_SECRET] },
  async (req, res) => {
    const out = await messageWebhookHandler(
      req.rawBody,
      req.headers,
      RESEND_WEBHOOK_SECRET.value(),
    );
    res.status(out.status).send(out.body);
  },
);

// syncOrgMembershipClaim (R074/R075: the claim storage.rules reads)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
export { syncOrgMembershipClaim };

// superAdminClaims (68-02: syncSuperAdminClaim trigger + setSuperAdminClaim onCall, R174/R175-B/R176/R179)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
export { syncSuperAdminClaim, setSuperAdminClaim };

// orgProvisioning (Phase 74: onboardOrganization/assignOrgAdmin/listOrganizations, R196-R206; Phase 76: setOrgActive, R212-R214)
// See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/index.ts)
export { onboardOrganization, assignOrgAdmin, listOrganizations, setOrgActive, setOrgAiEnabled, setOrgBibleEnabled };

// --- inviteOnboarding (Phase 99: sendInviteOnboardingEmail, R289-R291/R293 --
// the invite-onboarding provisioning + email callable). Implementation lives
// in ./inviteOnboarding so its testable handler
// (sendInviteOnboardingEmailHandler) can be imported directly by tests
// without going through the deployed wrapper. Re-exported here so Firebase
// discovers it from the entry point -- mirrors the orgProvisioning block
// above (a function not re-exported here fails `firebase deploy` with "No
// function matches the filter").
export { sendInviteOnboardingEmail };

// --- orgDeletion (Phase 77: deleteOrganization, R215-R219, R221 -- the
// super-admin-gated permanent church deletion cascade). Implementation lives
// in its own module (orgDeletion.ts), so this is a dedicated re-export block
// rather than folded into the orgProvisioning line above. ---------------
export { deleteOrganization };
