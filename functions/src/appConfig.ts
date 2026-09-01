import type { Firestore } from "firebase-admin/firestore";

// --- appConfig (R180-R184: Firestore-backed runtime config) --------------
//
// This module deliberately does NOT call initializeApp()/getFirestore() at
// module scope -- mirrors claimsHelpers.ts's convention. getAppConfig(db)
// always takes an injected Firestore instance as its first parameter so
// both the deployed runtime (which initializes the Admin SDK itself) and
// unit tests (a fake db) can call it identically.
//
// appConfig/global is a single admin-only Firestore doc (Phase 68 rules
// gate WHO may write it to super-admins; the Admin SDK bypasses rules to
// read it here). Its shape mirrors the v1.8 process.env/defineString knobs,
// grouped by area. A missing or partial doc is deep-merged onto
// DEFAULT_APP_CONFIG (R182) so today's behavior is reproduced byte-for-byte
// until an operator explicitly writes a value -- this phase's read-site
// swap (Plan 02) is a behavior-neutral no-op deploy until then.
//
// The coerce* layer below is the input-validation boundary: the Phase 68
// rules enforce WHO writes appConfig/global; this layer enforces WHAT shape
// is trusted once read back, per-knob, per the R184 fail-open/fail-closed
// table (see CONTEXT.md / RESEARCH.md for the full rationale per knob).

export interface AppConfig {
  cleanup: {
    mediaEnabled: boolean;
    pptxRenderEnabled: boolean;
    backgroundEnabled: boolean;
    pptxSourceEnabled: boolean;
  };
  retention: {
    mediaDays: number;
    orphanRenderStaleHours: number;
    backgroundDays: number;
    pptxSourceDays: number;
  };
  deleteCapPerRun: number;
  aiProxy: {
    rateLimitPerMin: number;
    rateLimitPerDay: number;
    allowedModels: string[];
    maxTokensCeiling: number;
  };
  messaging: {
    scheduledCronEnabled: boolean;
    maxRecipients: number;
    orgDailyEmailQuota: number;
  };
  onboarding: {
    emailsEnabled: boolean;
  };
  sender: {
    fromName: string;
    fromAddress: string;
  };
  // Provenance -- written by the Phase 70 save path, read here harmlessly
  // if present. Optional: an unwritten doc (or one written before Phase 70
  // ships) has neither field.
  updatedBy?: string;
  updatedAt?: unknown;
}

// DEFAULT_APP_CONFIG holds the EXACT current env/defineString fallback
// values (R182 source of truth) -- every field cites its origin read-site
// in index.ts so a future diff of that file's defaults can be checked
// against this constant.
//
// Phase 70 (R186): src/config/appConfigDefaults.ts is a DELIBERATE CLIENT-
// SIDE DUPLICATE of this interface + constant (src/ cannot import functions/
// -- separate build targets). If you change a default value here, mirror the
// change there too, or the Owner Console's (default) badge will show a
// stale value. src/config/__tests__/appConfigDefaults.test.ts's drift-guard
// snapshot test will fail if the two fall out of sync.
export const DEFAULT_APP_CONFIG: AppConfig = {
  cleanup: {
    mediaEnabled: false, // MEDIA_CLEANUP_ENABLED unset today == dry-run (index.ts:1038)
    pptxRenderEnabled: false, // PPTX_RENDER_CLEANUP_ENABLED unset today == dry-run (index.ts:1200)
    backgroundEnabled: false, // BACKGROUND_CLEANUP_ENABLED unset today == dry-run (index.ts:1440)
    pptxSourceEnabled: false, // PPTX_SOURCE_CLEANUP_ENABLED unset today == dry-run (index.ts:1668)
  },
  retention: {
    mediaDays: 30, // readMediaRetentionDays fallback (index.ts:1010)
    orphanRenderStaleHours: 24, // readOrphanRenderStaleHours fallback (index.ts:1170)
    backgroundDays: 30, // readBackgroundRetentionDays fallback (index.ts:1388)
    pptxSourceDays: 30, // readPptxSourceRetentionDays fallback (index.ts:1634)
  },
  deleteCapPerRun: 500, // readDeleteCap() fallback (index.ts:961-964)
  aiProxy: {
    rateLimitPerMin: 20, // readAiProxyLimits fallback (index.ts:210)
    rateLimitPerDay: 500, // readAiProxyLimits fallback (index.ts:211)
    allowedModels: ["claude-haiku-4-5-20251001"], // DEFAULT_AI_ALLOWED_MODELS (index.ts:191)
    maxTokensCeiling: 2048, // readAiProxyLimits fallback (index.ts:212)
  },
  messaging: {
    scheduledCronEnabled: false, // SCHEDULED_MESSAGING_CRON_ENABLED unset today == off (index.ts:1986)
    maxRecipients: 200, // MESSAGE_MAX_RECIPIENTS fallback (index.ts:2744)
    orgDailyEmailQuota: 1000, // ORG_MAX_EMAILS_PER_DAY fallback (index.ts:2745)
  },
  onboarding: {
    emailsEnabled: false, // fail-safe default until Resend domain verified + owner confirms (Phase 99, R293)
  },
  sender: {
    // NEW field -- defined for Phase 70 forward-compatibility but DORMANT
    // this phase: no read-site consumes it, the per-message display name
    // stays the org's own name (R159 behavior unchanged). See the DECISION
    // note on getAppConfig below.
    fromName: "",
    fromAddress: "onboarding@resend.dev", // MESSAGE_FROM_ADDRESS defineString default (index.ts:2488)
  },
};

/** See ADR-0008 (docs/adr/0008-mirrors-readnumericknob-s-zero-vs-falsy-discipline-index-ts.md) */
export function coerceConfigNumber(raw: unknown, fallback: number): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }
  return fallback; // undefined, null, boolean, object, array -- all fall back
}

/**
 * deleteCapPerRun additionally requires a POSITIVE integer, mirroring
 * readDeleteCap()'s extra guard beyond plain numeric coercion
 * (index.ts:961-964: `Number.isInteger(raw) && raw > 0 ? raw : 500`) --
 * a missing/zero/negative/non-integer cap must never resolve to
 * "unbounded deletes."
 */
export function coercePositiveInt(raw: unknown, fallback: number): number {
  const n = coerceConfigNumber(raw, fallback);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Fail-CLOSED boolean coercion for cleanup/messaging-cron flags: only a
 * literal `true` enables; anything else (missing, "true" string, 1, null)
 * resolves to false -- mirrors the existing `!== "true"` dry-run gate
 * direction exactly. A malformed flag can never silently enable deletion
 * or the cross-org cron.
 */
export function coerceEnableFlag(raw: unknown): boolean {
  return raw === true;
}

/**
 * Fail-CLOSED allow-list coercion: a non-array/empty/malformed value falls
 * back to the restrictive default list -- mirrors readAiProxyLimits'
 * existing `parsedModels.length > 0 ? parsedModels : DEFAULT` fallback
 * (index.ts:209-226). A bad doc can only narrow/break the allow-list,
 * never widen it to "allow all models."
 */
export function coerceAllowedModels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_APP_CONFIG.aiProxy.allowedModels;
  const models = raw.filter(
    (m): m is string => typeof m === "string" && m.trim().length > 0,
  );
  return models.length > 0 ? models : DEFAULT_APP_CONFIG.aiProxy.allowedModels;
}

/** Coerces sender.fromName/fromAddress to strings, falling back to the
 * DEFAULT values on any non-string (fail to a safe default -- not a
 * security control, just must not crash the send path). */
function coerceSender(raw: unknown): { fromName: string; fromAddress: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    fromName: typeof r.fromName === "string" ? r.fromName : DEFAULT_APP_CONFIG.sender.fromName,
    fromAddress:
      typeof r.fromAddress === "string" && r.fromAddress.trim().length > 0
        ? r.fromAddress
        : DEFAULT_APP_CONFIG.sender.fromAddress,
  };
}

function coerceCleanup(raw: unknown): AppConfig["cleanup"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    mediaEnabled: coerceEnableFlag(r.mediaEnabled),
    pptxRenderEnabled: coerceEnableFlag(r.pptxRenderEnabled),
    backgroundEnabled: coerceEnableFlag(r.backgroundEnabled),
    pptxSourceEnabled: coerceEnableFlag(r.pptxSourceEnabled),
  };
}

function coerceRetention(raw: unknown): AppConfig["retention"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    mediaDays: coerceConfigNumber(r.mediaDays, DEFAULT_APP_CONFIG.retention.mediaDays),
    orphanRenderStaleHours: coerceConfigNumber(
      r.orphanRenderStaleHours,
      DEFAULT_APP_CONFIG.retention.orphanRenderStaleHours,
    ),
    backgroundDays: coerceConfigNumber(
      r.backgroundDays,
      DEFAULT_APP_CONFIG.retention.backgroundDays,
    ),
    pptxSourceDays: coerceConfigNumber(
      r.pptxSourceDays,
      DEFAULT_APP_CONFIG.retention.pptxSourceDays,
    ),
  };
}

function coerceAiProxy(raw: unknown): AppConfig["aiProxy"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    rateLimitPerMin: coerceConfigNumber(
      r.rateLimitPerMin,
      DEFAULT_APP_CONFIG.aiProxy.rateLimitPerMin,
    ),
    rateLimitPerDay: coerceConfigNumber(
      r.rateLimitPerDay,
      DEFAULT_APP_CONFIG.aiProxy.rateLimitPerDay,
    ),
    allowedModels: coerceAllowedModels(r.allowedModels),
    maxTokensCeiling: coerceConfigNumber(
      r.maxTokensCeiling,
      DEFAULT_APP_CONFIG.aiProxy.maxTokensCeiling,
    ),
  };
}

function coerceMessaging(raw: unknown): AppConfig["messaging"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    scheduledCronEnabled: coerceEnableFlag(r.scheduledCronEnabled),
    maxRecipients: coerceConfigNumber(
      r.maxRecipients,
      DEFAULT_APP_CONFIG.messaging.maxRecipients,
    ),
    orgDailyEmailQuota: coerceConfigNumber(
      r.orgDailyEmailQuota,
      DEFAULT_APP_CONFIG.messaging.orgDailyEmailQuota,
    ),
  };
}

function coerceOnboarding(raw: unknown): AppConfig["onboarding"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    emailsEnabled: coerceEnableFlag(r.emailsEnabled),
  };
}

/**
 * Deep-merges a partial/missing Firestore doc onto DEFAULT_APP_CONFIG, one
 * nested group at a time, so a doc that sets only e.g. cleanup.mediaEnabled
 * never wipes the sibling cleanup flags' defaults (R182). deleteCapPerRun
 * is the one top-level scalar and is coerced directly.
 */
export function mergeAppConfig(partial: Partial<AppConfig> | undefined): AppConfig {
  const p = partial ?? {};
  return {
    cleanup: coerceCleanup(p.cleanup),
    retention: coerceRetention(p.retention),
    deleteCapPerRun: coercePositiveInt(p.deleteCapPerRun, DEFAULT_APP_CONFIG.deleteCapPerRun),
    aiProxy: coerceAiProxy(p.aiProxy),
    messaging: coerceMessaging(p.messaging),
    onboarding: coerceOnboarding(p.onboarding),
    sender: coerceSender(p.sender),
    ...(typeof p.updatedBy === "string" ? { updatedBy: p.updatedBy } : {}),
    ...(p.updatedAt !== undefined ? { updatedAt: p.updatedAt } : {}),
  };
}

const CONFIG_COLLECTION = "appConfig";
const CONFIG_DOC = "global";
const TTL_MS = 60_000; // ~60s -- CONTEXT.md's own suggested number (30-60s all safe)

let cache: { value: AppConfig; fetchedAt: number } | null = null;

/**
 * Reads appConfig/global, deep-merges it onto DEFAULT_APP_CONFIG, and
 * returns the resolved config.
 *
 * Caching is asymmetric by design (R183): hot request-path callers (the
 * `api` proxy, `sendQueuedMessage`) use the default cached form -- a
 * module-scope { value, fetchedAt } TTL cache, refreshed every ~60s. Cron
 * callers (the cleanup handlers, sendScheduledReminders) MUST pass
 * { fresh: true } to always re-read.
 *
 * WHY a TTL and not an onDocumentWritten cache-bust: a Cloud Functions v2
 * instance's global scope is per-instance-process memory. A trigger firing
 * on appConfig/global's update runs as its own invocation, routed to
 * whichever instance the platform happens to pick -- it cannot reach into a
 * sibling warm instance's in-memory cache to clear it. A cache-bust design
 * is therefore correct for at most one of N warm instances, leaving every
 * other one serving a stale value until it independently re-reads. A TTL is
 * the only pattern that is correct regardless of instance count.
 */
export async function getAppConfig(
  db: Firestore,
  opts: { fresh?: boolean } = {},
): Promise<AppConfig> {
  const now = Date.now();
  if (!opts.fresh && cache && now - cache.fetchedAt < TTL_MS) {
    return cache.value;
  }
  const snap = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
  const raw = snap.exists ? (snap.data() as Partial<AppConfig> | undefined) : undefined;
  const resolved = mergeAppConfig(raw);
  cache = { value: resolved, fetchedAt: now };
  return resolved;
}

/** Test-only: resets the module-scope cache so TTL unit tests can isolate
 * cache state between cases. Not for use outside appConfig.test.ts. */
export function resetAppConfigCacheForTest(): void {
  cache = null;
}
