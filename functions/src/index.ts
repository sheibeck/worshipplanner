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
import { Resend } from "resend";
import { renderMessageTokens } from "./messageTokens";
import { verifySvixSignature } from "./webhookSignature";
import {
  resolveServiceRoleAssignments,
  resolveMessageRecipients,
  type PortedQuarter,
  type PortedRole,
  type PortedPerson,
  type RoleGroup,
  type RecipientSelection,
} from "./serviceRoles";
import { getAppConfig, DEFAULT_APP_CONFIG, type AppConfig } from "./appConfig";

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

// The Resend email provider key for the send path (59-02/59-03). DECLARED here
// alongside the other secrets so the whole secret list lives in one place, but
// bound to NO Function in this plan: it attaches ONLY to sendQueuedMessage
// (59-03), the single Function that ever holds it — the smallest key-holding
// surface (R131). queueServiceMessage below carries no secrets: array at all.
// Exported (unlike the proxy secrets) only so noUnusedLocals does not flag it
// while it is declared-but-unbound this plan; 59-03 references it in-file.
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

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

/**
 * verifyAppCaller replaces the old boolean `callerIsAuthenticated` gate with
 * the SAME accept/reject decision (valid token -> proceed, missing/invalid ->
 * 401), but resolves to the decoded ID token itself rather than throwing it
 * away -- the anthropic-only controls below (Tasks 2-3, R161/R162/R163) need
 * `decoded.uid` for the rate limiter/ledger and the `orgId` custom claim for
 * the ledger's org attribution. Every other SECRET_INJECTED service
 * (esv/nlt) keeps the identical "any valid caller" behavior; only the
 * anthropic branch reads anything off the returned token.
 */
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

/**
 * WR-01 fix: parses an env-var numeric knob so an operator's explicit `0`
 * (e.g. an emergency full-stop on `AI_RATELIMIT_MAX_PER_MIN=0`) is honored
 * rather than discarded. `Number(x) || fallback` treats a genuinely-parsed
 * `0` as falsy and silently replaces it with the default -- the opposite of
 * the caller's intent. Only an unset, blank/whitespace-only, or non-numeric
 * value falls back to `fallback`.
 */
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

// R164: an explicit maxInstances ceiling motivated by the highest-cost route
// (the anthropic branch of `api` spends real money per call). NOTE (WR-02,
// accepted as won't-fix): `maxInstances` is a Cloud Functions v2 /
// Cloud Run FUNCTION-level setting on the single shared `onRequest` below --
// it caps the whole `api` function (esv/nlt/planningcenter traffic included),
// not just the anthropic upstream. That's intentional: esv/nlt/planningcenter
// also cost money to run, and there is no way to scope maxInstances to one
// upstream within a single function. Env-overridable so the owner can tune
// fan-out without a logic redeploy.
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
  // WR-03: reject a streamed request outright rather than forward it. The
  // aiUsage ledger write below parses the upstream response body as a single
  // JSON object (`JSON.parse(body) as { usage?: AnthropicUsage }`) -- an SSE
  // stream's raw text is not valid JSON, so a `stream: true` request would
  // still be billed/rate-limited but silently never recorded in the ledger
  // (the `catch (ledgerErr)` swallows the JSON.parse throw). The server
  // dictates non-streaming so every proxied request records a usage entry
  // (R163), matching the "reject, don't silently trust" posture already used
  // for `model` above.
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

export interface RateLimitResult {
  allowed: boolean;
  scope?: "minute" | "day";
}

/**
 * R161: per-uid fixed-window Firestore rate limit. Two top-level
 * `aiRateLimits` counter docs per call -- `${uid}__min__${minuteWindow}` and
 * `${uid}__day__${dayWindow}` -- read inside a single transaction so the
 * check-then-increment is atomic across concurrent requests from the same
 * user. A rejected request (either ceiling already met) does NOT increment
 * either counter. Kept TOP-LEVEL (not nested under organizations/{orgId}) so
 * the firestore.rules catch-all deny already blocks client reads (T-37-15).
 *
 * Deliberately does NOT catch its own Firestore errors -- the caller (the
 * anthropic branch below) decides the fail-open policy so a limiter
 * datastore hiccup never takes AI down (locked decision, 65-CONTEXT.md).
 */
export async function checkAndConsumeRateLimit(
  db: Firestore,
  uid: string,
  limits: Pick<AiProxyLimits, "maxPerMin" | "maxPerDay">,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const minuteWindow = Math.floor(now / 60_000);
  const dayWindow = Math.floor(now / 86_400_000);
  const minuteRef = db.collection("aiRateLimits").doc(`${uid}__min__${minuteWindow}`);
  const dayRef = db.collection("aiRateLimits").doc(`${uid}__day__${dayWindow}`);

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
 * check-then-increment, no double-count on a rejected send) but on ONE
 * top-level `orgEmailCounters` doc keyed `${orgId}__day__${dayWindow}`, and
 * increments by an arbitrary `count` -- the number of emails THIS send is
 * about to attempt -- rather than always by 1 (a single 50-recipient send
 * costs 50 against the quota, not 1). Rejects when the PROJECTED total
 * (`dayCount + count`) would EXCEED the limit, not merely when `dayCount`
 * already meets it (WR-01, 67-REVIEW.md) -- because `count` can be well
 * above 1, a check against only the pre-send count could let one accepted
 * send push the day's total past `limit` by up to `count - 1`. On rejection,
 * returns not-allowed WITHOUT incrementing -- the org's quota is not
 * consumed by a send that never happens. Kept TOP-LEVEL (not nested under
 * organizations/{orgId}) for the same T-37-15 reason as aiRateLimits/aiUsage: the firestore.rules
 * catch-all deny already blocks client reads, so no rules change is needed.
 *
 * Deliberately does NOT catch its own Firestore errors -- the caller
 * (sendQueuedMessageHandler) decides the fail policy, same as
 * checkAndConsumeRateLimit above.
 */
export async function checkAndConsumeOrgEmailQuota(
  db: Firestore,
  orgId: string,
  count: number,
  limit: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const dayWindow = Math.floor(now / 86_400_000);
  const dayRef = db.collection("orgEmailCounters").doc(`${orgId}__day__${dayWindow}`);

  return db.runTransaction(async (tx) => {
    const daySnap = await tx.get(dayRef);
    const dayCount = daySnap.exists ? ((daySnap.data()?.count as number | undefined) ?? 0) : 0;

    // WR-01 (67-REVIEW.md): PROJECTED check, not a check against the
    // pre-send count. `count` (this send's recipient count, up to
    // MESSAGE_MAX_RECIPIENTS) can be far more than 1, so comparing only
    // `dayCount` to `limit` (the checkAndConsumeRateLimit shape, correct
    // there because it always increments by exactly 1) let an accepted send
    // push the day total past `limit` by up to `count - 1`. Rejecting when
    // the PROJECTED total would exceed the limit keeps the daily total from
    // ever exceeding `limit`, at the cost of possibly rejecting a send that
    // would fit under a smaller one -- the correct tradeoff for a hard cap.
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
    if (SECRET_INJECTED.has(service)) {
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
      // Cached form (no {fresh:true}) -- the api handler is a hot request
      // path (R183); getFirestore() is already called later in this same
      // handler (checkAndConsumeRateLimit/writeUsageLedger), so this is no
      // new Firestore dependency class, only an additional cached read.
      // Scoped to the anthropic branch only (review WR-01): esv/nlt/
      // planningcenter have no relationship to AI cost controls and must
      // stay Firestore-independent, exactly as before this phase. The read
      // itself is fail-open (same guardrail-not-security-control rationale
      // as the rate limiter below): a Firestore hiccup degrades the
      // anthropic route to DEFAULT_APP_CONFIG's limits rather than failing
      // the request outright.
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

// --- Shared cleanup-sweep safety knob (66-01: T-66-01-02) ----------------
//
// Bounds how many objects a SINGLE LIVE cleanup run may delete. The first
// LIVE enablement of MEDIA_CLEANUP_ENABLED/PPTX_RENDER_CLEANUP_ENABLED (and
// any future sweep built on this same helper, e.g. 66-02's background/pptx-
// source sweeps) may hit a large accumulated backlog; without a cap that
// first run could fan out an unbounded number of deletes/cost in one shot.
// Both sweeps below are idempotent-by-age, so anything left uncapped this
// run is picked up by the next daily invocation -- capping never leaves an
// object stuck past its retention window, only spreads its deletion over
// more runs. Dry-run summaries are NEVER capped: the owner needs the true
// backlog count/bytes before flipping the enable flag, not a truncated one.
//
// R181/R184: this is now a thin passthrough over a resolved AppConfig
// (appConfig.ts owns the coercion/fail-open-capped default logic) rather
// than a direct process.env read -- see appConfig.ts's coercePositiveInt.
export function readDeleteCap(config: AppConfig): number {
  return config.deleteCapPerRun;
}

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
// - R181: this handler now reads appConfig/global via the Admin SDK (Plan
//   69-01's getAppConfig, bypassing rules) for its enable flag/retention/cap
//   -- its first-ever Firestore read. It still touches NO slide documents,
//   slot metadata, or slide text: appConfig/global is the only doc it ever
//   reads, so the letter of "no Firestore API" changed but the spirit --
//   structurally incapable of touching content documents -- did not.
// - FAILS SAFE: deletion requires an explicit opt-in, cleanup.mediaEnabled=true
//   in the resolved config. With it unset/false/malformed the run is a
//   dry-run: it scans and logs what WOULD be deleted and deletes nothing. A
//   human must review a dry-run before enabling live deletion.
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

// --- cleanupOrphanRenders (R062: dry-run-by-default orphan sweep) --------
//
// A second, SEPARATE scheduled job from cleanupExpiredMedia above. It is not
// folded into that handler because it must read the pptxRenders queue
// (Firestore) -- historically something cleanupExpiredMedia never touched at
// all; as of R181 (69-02) BOTH handlers now also read appConfig/global via
// getAppConfig(), but neither ever reads slide/service/song content docs.
//
// SAFETY CONTRACT:
// - FAILS SAFE: real deletion requires an explicit opt-in,
//   cleanup.pptxRenderEnabled=true in the resolved config. With it unset,
//   false, or a malformed value, this is a dry run: it scans and logs what
//   WOULD be deleted and deletes nothing.
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

// --- cleanupOrphanBackgrounds (R167: orphan+age background sweep) --------
//
// A NEW sweep, never shipped before this phase. Backgrounds
// (orgs/{orgId}/backgrounds/{backgroundId}/{fileName}, written by
// src/composables/useBackgroundUpload.ts:103) are structurally exempt from
// cleanupExpiredMediaHandler's MEDIA_PATH_GUARD and were never pruned at
// all until now.
//
// SAFETY CONTRACT (66-02 threat model T-66-02-01/T-66-02-03/T-66-02-05):
// - This is ORPHAN+AGE, deliberately NEVER pure age. A background is only a
//   deletion candidate once it is BOTH (a) unreferenced by any live
//   document, at ANY of the three tiers below, AND (b) older than
//   BACKGROUND_RETENTION_DAYS. A 90-day-old background still set on an
//   active slide is never eligible, regardless of age.
// - The three reference tiers, all enumerated via plain collectionGroup()
//   scans (no composite index required):
//     1. Group tier   -- organizations/{orgId}/slideGroups/{slotId}.backgroundImageUrl
//     2. Slide tier   -- the SAME doc's embedded slides[] array, each
//                        entry.backgroundImageUrl (an array field, not a
//                        subcollection -- read via doc.data().slides).
//     3. Song tier    -- organizations/{orgId}/songs/{songId}/lyrics/{lyricsId}.backgroundImageUrl
// - References are stored as full Firebase download URLs
//   (https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{ENCODED_PATH}?...).
//   extractBackgroundObjectPath() recovers the exact object name from the
//   /o/{path} segment (URL-decoded) so it can be compared 1:1 against
//   file.name from the bucket listing.
// - REFERENCES-INCOMPLETE FAIL-SAFE: if any non-empty backgroundImageUrl
//   cannot be parsed to an object path, or either collectionGroup scan
//   throws, referencesComplete is set to false and the ENTIRE run is forced
//   to dry-run -- it deletes NOTHING that run, regardless of
//   BACKGROUND_CLEANUP_ENABLED. The sweep never deletes when it cannot
//   prove an object is unreferenced. Under-deletion (leaving an orphan
//   another day) is always preferred over deleting a live background.
// - FLOOR GUARD (beyond the above): a reference scan that returns silently
//   EMPTY -- no throw, no unparseable URL, just zero docs/zero references
//   -- must never be trusted as "nothing anywhere is referenced". If there
//   are background objects to consider at all (candidates.length > 0) but
//   the reference Set ended up with zero entries, references are ALSO
//   treated as incomplete and the run stays dry-run. This closes the one
//   gap the throw/parse-failure fail-safe alone doesn't cover: a scan that
//   "succeeds" against the wrong collection, an empty project, or a
//   permissions issue that silently returns no docs.
// - BACKGROUND_PATH_GUARD is applied to every candidate BEFORE any delete
//   decision, mirroring MEDIA_PATH_GUARD/RENDERED_OBJECT_GUARD -- only
//   objects under orgs/{orgId}/backgrounds/ are ever eligible.
// - FAILS SAFE: real deletion requires cleanup.backgroundEnabled=true in the
//   resolved appConfig (R181); anything else (unset, false, malformed) is a
//   dry run, matching the gate direction of every other sweep in this file
//   (the 9f1b881 inverted-gate incident).
// - Per-object deletes are wrapped in try/catch so one failure never aborts
//   the run; readDeleteCap() bounds a single LIVE run's blast radius, and
//   dry-run is never capped so the owner sees the true backlog first.
// - Runs on its own daily schedule, 05:00 UTC -- after media (02:00),
//   orphan-renders (03:00), and reminders (04:00), so the sweeps never
//   overlap.

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

// --- cleanupPptxSources (R168: prune consumed/failed import sources) -----
//
// A NEW sweep, never shipped before this phase. cleanupOrphanRendersHandler
// (above) already prunes a stale pending/failed import's rendered/ pages,
// but it has never touched the heavier source.pptx deck or the extracted
// images/ intermediate files -- those grow forever today. This sweep closes
// that gap while NEVER touching rendered/, the PNGs the app actually
// displays.
//
// SAFETY CONTRACT (66-02 threat model T-66-02-02/T-66-02-03/T-66-02-05):
// - PPTX_SOURCE_GUARD is a POSITIVE guard: it matches ONLY
//   orgs/{orgId}/pptx-imports/{importId}/source.pptx and
//   orgs/{orgId}/pptx-imports/{importId}/images/*. It is structurally
//   unable to match .../rendered/* -- rendered/ is excluded by construction,
//   not by a runtime exception list.
// - Driven by the pptxRenders collectionGroup (status "ready" or "failed"),
//   the same collection cleanupOrphanRendersHandler reads. "ready" = the
//   import is CONSUMED -- the app now displays from rendered/, so the
//   source deck and its extracted images are dead weight. "failed" = an
//   orphaned import whose source is also dead weight; its rendered/ +
//   doc lifecycle stay owned by cleanupOrphanRendersHandler, unchanged by
//   this sweep. An image-only import (no pptxRenders doc at all, whose
//   images/ ARE the only display) is structurally out of scope -- this scan
//   never sees it because it is driven entirely by render docs.
// - Age is keyed on the server-set Firestore createdAt timestamp
//   (FieldValue.serverTimestamp(), written by parsePptxHandler's queue
//   write), never on client-settable input. A "ready" doc younger than
//   PPTX_SOURCE_RETENTION_DAYS is skipped -- consumption alone is not
//   sufficient, only consumption AND age.
// - Disclosed benign race: if cleanupOrphanRendersHandler (once owner-
//   enabled) deletes a "failed" doc before this sweep first observes it,
//   that failed import's source may be missed this run. This is
//   under-deletion only -- never over-deletion -- and the source stays
//   in place (safe) until manually cleared or the doc reappears.
// - FAILS SAFE: real deletion requires cleanup.pptxSourceEnabled=true in the
//   resolved appConfig (R181); anything else (unset, false, malformed) is a
//   dry run, matching the gate direction of every other sweep in this file.
// - Per-object deletes are wrapped in try/catch so one failure never aborts
//   the run; readDeleteCap() bounds a single LIVE run's blast radius across
//   the WHOLE run (all imports), and dry-run is never capped.
// - Runs on its own daily schedule, 06:00 UTC -- after the 05:00 background
//   sweep, so the sweeps never overlap.

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

// --- sendScheduledReminders daily reminder cron (61-02: R145/R133/SC3/SC4) --
//
// The R145 reminder engine: a daily onSchedule cron that auto-enqueues the
// shared service link to everyone assigned N days before a service, reckoned in
// the org's LOCAL timezone (R133), exactly once (SC4). It mirrors
// cleanupOrphanRendersHandler (729-817) EXACTLY -- a broad
// collectionGroup('services').where('status','in',['planned','exported']) scan
// (NEVER 'draft', so a draft is structurally unreachable -- SC4), the org id
// recovered from the parent chain (never a client field), a per-item try/catch
// so one bad service never aborts the daily run, the handler body exported
// separately from the wrapper for direct unit test, and its own 04:00 UTC slot
// (offset from cleanupExpiredMedia's 02:00 and cleanupOrphanRenders' 03:00 so
// the three daily sweeps never overlap). It enqueues via the SHARED
// createQueuedMessage() shaper, so a cron-created reminder is byte-identical to
// a human send at the sendQueuedMessage trigger. It holds NO secret -- only
// sendQueuedMessage binds RESEND_API_KEY (R131 smallest key-holding surface).

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

      // Load the org settings for THIS org (cached). Read settings.messaging.*
      // and settings.timezone -- NOT messaging.* (research Pitfall 2).
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

// NO secrets: array -- the cron only ENQUEUES; RESEND_API_KEY binds solely to
// sendQueuedMessage (R131). 04:00 UTC is a NEW slot, offset from the taken 02:00
// (media) and 03:00 (renders) so the three daily sweeps never overlap.
//
// TWO sweeps share this ONE daily invocation (one Cloud Scheduler job, one
// deploy): the reminder sweep (R145) and the schedule-for-later dispatch sweep
// (R141, 61-03). Each runs in its OWN try/catch so a failure in one never aborts
// the other. No new onSchedule wrapper and no secret is added for the dispatch
// sweep -- it only re-creates a 'queued' doc; only sendQueuedMessage holds the
// key (R131).
//
// R170: the body used to live directly in the onSchedule callback below;
// it is now extracted into this EXPORTED orchestrator, exclusively so a
// config gate can sit at its very top, before EITHER sweep -- and therefore
// before the first collectionGroup call either sweep makes. Default OFF
// (unset, false, or malformed -- the same fail-CLOSED idiom as the cleanup
// enable flags above, R181/R184): gating the WHOLE function off is the
// lowest-cost option and kills BOTH the reminder collectionGroup('services')
// scan AND the schedule-for-later collectionGroup('messages') scan -- zero
// cross-org reads when disabled.
//
// DISCLOSED behavior change: gating the whole function off also disables
// dispatchDueScheduledMessagesHandler, i.e. the composer's "schedule for
// later" send. To restore reminders OR schedule-for-later dispatch, flip
// messaging.scheduledCronEnabled=true in appConfig/global -- no redeploy
// needed (R181), and takes effect on the very next scheduled run since this
// is a cron path reading {fresh:true} (R183). Fully reversible, no data loss
// either way.
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

// --- dispatchDueScheduledMessagesHandler (61-03: R141 schedule-for-later) ---
//
// The Phase 59 carryover -- actually SEND user-scheduled messages. The composer
// (59-02) writes a status:'scheduled' messages doc (createQueuedMessage :1141)
// that sendQueuedMessage, an onDocumentCreated trigger, leaves inert by design
// (:1440 comment). Flipping that existing doc's status to 'queued' would NOT
// re-fire the create trigger (the whole trap), so this sweep CREATES A FRESH
// 'queued' doc instead -- a genuine onDocumentCreated. It is exported separately
// from the wrapper (the sendScheduledRemindersHandler convention) so it is unit
// -tested with a fixed clock and a fake Firestore.

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
 * Finds due user-scheduled messages and dispatches each by (1) transactionally
 * claiming the ORIGINAL scheduled->dispatched (only if still 'scheduled' -- the
 * idempotency guard that makes an at-least-once cron retry a no-op) and (2)
 * creating a FRESH status:'queued' doc via the shared createQueuedMessage shaper
 * so onDocumentCreated fires sendQueuedMessage exactly as for a human send.
 *
 * The scan is a single-field equality collectionGroup('messages').where(
 * 'status','==','scheduled') -- the SAME no-index class as the reminder scan.
 * Due-ness (scheduledFor <= now) is filtered in CODE, NOT the query, so NO
 * composite index is introduced. `now` defaults to the real clock; tests pin it.
 */
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
    changeDiff: input.changeDiff ?? null,
    scheduledFor,
    requestedByUid: input.requestedByUid,
    createdAt: FieldValue.serverTimestamp(),
    sentAt: null,
    deliveryCounts: { sent: 0, failed: 0 },
  };
}

/**
 * The queueServiceMessage handler body, exported separately from the onCall
 * wrapper (parsePptxHandler/parsePptx precedent) so tests invoke it directly
 * with a fake CallableRequest.
 *
 * Security contract (59-02 threat model T-59-02a..e):
 * - Requires Firebase Auth (request.auth).
 * - Independently re-reads organizations/{orgId}/members/{uid} and requires the
 *   member's role ∈ ['editor','admin'] — a viewer or a wrong-org caller is
 *   rejected. The client-declared orgId is used ONLY to scope the Firestore
 *   path; membership and role are re-verified for THAT path, never trusted
 *   (mirrors parsePptxHandler's membership re-check and firestore.rules'
 *   isOrgEditor).
 * - Re-reads the org messaging kill-switch (settings.messaging.enabled) server
 *   -side and rejects when off — the composer's disabled entry point is
 *   convenience; this is the boundary.
 * - Validates the type enum (R137) and scheduledFor sanity before any write.
 * - Writes exactly ONE messages/{id} doc via the shared createQueuedMessage
 *   shaper and returns its id. It resolves NO recipients and sends nothing —
 *   the 59-03 trigger does that. This Function holds NO secret (see the wrapper
 *   below: no secrets: array — only sendQueuedMessage gets RESEND_API_KEY).
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

  const orgRef = getFirestore().collection("organizations").doc(orgId);

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
// The send half of the queue-then-trigger path: an onDocumentCreated trigger
// on .../messages/{messageId}, the ONLY Function bound to RESEND_API_KEY. Its
// handler body (sendQueuedMessageHandler) is exported separately from the
// wrapper (requestPptxRenderHandler precedent) so the idempotency + send logic
// is directly unit-tested with Resend mocked. It runs a transactional
// queued->sending claim (GENUINELY NEW code — the PPTX precedent has NO status
// claim, 59-RESEARCH.md Pitfall 1), re-resolves recipients server-side (never
// the client's stored list — Anti-Pattern 1), renders per-recipient tokens
// (R139), sends once per recipient (per-recipient try/catch so one bad address
// is a failed recipient, not an aborted batch), writes one recipients/{id} doc
// per recipient, rolls up deliveryCounts, and flips the message status.

/**
 * The public share-link base origin — the APPLICATION's own base domain, shared
 * by ALL orgs (churches never get their own domain; the org is identified by the
 * URL slug in the path, not the host). Config, not a secret — defineString,
 * mirroring PPTX_RENDER_SERVICE_URL. Defaults to the app's hosting domain so
 * {{service_link}} always renders a real link; override at deploy time only to
 * point at a custom app domain, or locally (e.g. http://localhost:5173) for
 * dev links. A blank value still renders {{service_link}} as '' (A1 empty
 * substitution) rather than a broken URL.
 */
export const SERVICE_SHARE_BASE_URL = defineString("SERVICE_SHARE_BASE_URL", {
  default: "https://worship-planner-bc515.web.app",
});

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
// (Google-managed, no DNS access).

/**
 * Build a header-safe RFC 5322 display name from an org-supplied name. The org
 * name is user-controlled and flows into the From header, so CR/LF (email
 * header-injection vectors) and quote/backslash chars are stripped; the caller
 * wraps the result in a quoted-string. Empty in → empty out (caller omits the
 * display name and sends the bare address).
 */
export function fromDisplayName(name: string | null | undefined): string {
  return (name ?? "").replace(/[\r\n]+/g, " ").replace(/["\\]/g, "").trim();
}

/**
 * Extract the bare email address from a configured From value. config.sender.fromAddress
 * may be a plain `email@x` OR an already-decorated `Display Name <email@x>` form
 * (e.g. a legacy value carried over from the old defineString-based sender param). We
 * always re-apply the org name as the display name, so we must peel any existing
 * `<…>` off first — otherwise wrapping produces an invalid nested
 * `"Org" <Name <email>>` and Resend 422s. Returns the inner address when
 * angle-bracketed, else the trimmed input.
 */
export function bareEmailAddress(configured: string): string {
  const m = configured.match(/<([^>]*)>/);
  return (m ? m[1] : configured).trim();
}

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

  // The three message-level ids become Resend tags (Pitfall 3). If any is not
  // tag-safe the send is unsafe for the whole message — fail closed.
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
  const roles = rolesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PortedRole);
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

  // R171: per-org daily Resend send quota -- a fixed-window Admin-SDK
  // counter backstopping a loop/cron fan-out. Also checked BEFORE `new
  // Resend(...)` / the send loop, so an over-quota message sends zero
  // emails. Skipped entirely for a zero-recipient send -- nothing to
  // consume, and an org already at quota should not block an empty send.
  //
  // WR-02 (67-REVIEW.md): wrapped in try/catch and failed OPEN on a thrown
  // Firestore error, matching this file's own documented cost-guardrail
  // fail-open precedent for checkAndConsumeRateLimit (`// Fail OPEN: the
  // limiter is a cost guardrail, not a security control`, locked decision,
  // 65-CONTEXT.md). By this point the message doc has already been claimed
  // `queued` -> `sending`, so a fail-CLOSED error here would leave the
  // message stuck with no terminal status and no retry -- worse than
  // letting one send through uncounted against the quota.
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

// --- messageWebhook (60-02: R143 — Resend delivery/bounce receiver) ---------
//
// The milestone's new UNAUTHENTICATED trust boundary. Resend POSTs delivery and
// bounce events here; the only thing that gates a Firestore write is the Svix
// HMAC over the RAW request body (verifySvixSignature, 60-01), checked FIRST.
// Only a hard (Permanent) bounce surfaces: it idempotently flips the addressed
// recipients/{id} to status:'bounced' and increments
// messages/{id}.deliveryCounts.bounced. See messageWebhookHandler for the
// verify-first order contract.

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

/**
 * Resolve the bounced recipient's DocumentReference.
 *
 * PRIMARY (tags): when the echoed Resend tags carry all four path segments,
 * build the recipients/{id} ref DIRECTLY at the exact nested path — a single
 * doc() with NO query and NO index dependency (60-RESEARCH § Tags Echo). All
 * ids are untrusted strings that only form path segments scoped under the org
 * (Admin SDK), never a broader query (T-60-02e).
 *
 * FALLBACK (providerMessageId): when tags are absent/incomplete, look the
 * recipient up by the provider message id 59-03 stored, via
 * collectionGroup('recipients').where('providerMessageId','==',email_id) — the
 * true safety net (tags echo is only MEDIUM confidence). Requires 60-01's
 * deploy-gated collection-group index at run time.
 *
 * Returns null (never throws) when neither resolves — the caller 200s an
 * unresolvable event rather than triggering a Resend retry storm.
 */
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
 *
 * Runs ONE transaction that reads the recipient status AND the message's
 * current count BEFORE any write (mirrors sendQueuedMessageHandler's
 * transition-guarded claim). Only on the not-bounced -> bounced transition does
 * it set status:'bounced' + bounceReason + bouncedAt and write
 * deliveryCounts.bounced as a LITERAL prev+1 (NOT FieldValue.increment). A
 * duplicate at-least-once delivery finds status already 'bounced' and no-ops,
 * so the count never double-counts (success criterion 4). The dot-path
 * 'deliveryCounts.bounced' merges into the existing {sent,failed} leaf; a
 * missing leaf is treated as 0, so older docs need no migration.
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
 * The messageWebhook handler body, exported separately from the onRequest
 * wrapper (the sendQueuedMessageHandler/parsePptxHandler convention) so it is
 * unit-testable directly with a fake rawBody+headers and no res —
 * firebase-functions/v2/https is not mocked in the test harness.
 *
 * VERIFY-FIRST ORDER CONTRACT (security-critical, 60-CONTEXT.md):
 *   1. rawBody MUST be a Buffer (Cloud Functions supplies req.rawBody as the
 *      exact received bytes). A non-Buffer body is malformed -> 400. Do NOT fall
 *      back to a re-serialized req.body — the HMAC is over the raw bytes.
 *   2. Verify the Svix HMAC over rawBody BEFORE any Firestore access. Any
 *      missing/malformed/invalid/stale signature -> 401, with ZERO state access.
 *      401 is reserved for signature failure ONLY.
 *   3. Parse the JSON only AFTER the signature passes; unparseable -> 400.
 *   4. Only email.bounced with a Permanent (hard) bounce surfaces. Every other
 *      valid event (soft/Transient, delivered, complaint, unknown type, or an
 *      unresolvable recipient) -> 200 with no write: a non-2xx would make Resend
 *      retry the event forever.
 *
 * The webhook is provider-facing, so it is NOT gated on isMessagingEnabled()
 * (a client concept) — only the signature gates it.
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

// --- superAdminClaims (68-02: syncSuperAdminClaim trigger + setSuperAdminClaim
// onCall, R174/R175-B/R176/R179) ------------------------------------------
//
// Implementation lives in ./superAdminClaims so its testable handlers
// (syncSuperAdminClaimHandler, setSuperAdminClaimHandler) can be imported
// directly by tests without going through the deployed wrappers. Only the
// two deployed Functions are re-exported here -- the handlers are
// intentionally NOT part of this module's exports, mirroring
// syncOrgMembershipClaim above. bootstrapSuperAdmin.ts (the owner-run first-
// grant script) is deliberately NOT imported or exported here -- it is a
// Node script, not a deployed Function.
export { syncSuperAdminClaim, setSuperAdminClaim };
