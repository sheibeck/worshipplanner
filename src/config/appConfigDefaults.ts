// Phase 70 (R186/R187) — client-side mirror of functions/src/appConfig.ts's
// `AppConfig` interface + `DEFAULT_APP_CONFIG` (lines 24-97 as of Phase 69).
//
// This file is a DELIBERATE DUPLICATE, not an import. `src/` (Vite build) and
// `functions/` (Cloud Functions build) are separate build targets in this
// repo — a relative import across that boundary would either fail to resolve
// at build time or silently bundle server-only code into the client. See
// 70-RESEARCH.md Pitfall 2 / Anti-Patterns for the full rationale.
//
// If functions/src/appConfig.ts's DEFAULT_APP_CONFIG values ever change, this
// file MUST be updated by hand to match — that file carries a matching
// forward-pointing comment. `appConfigDefaults.test.ts`'s drift-guard/
// snapshot test hard-codes the values below so an unmirrored change fails
// loudly at test time, not just via a stale docs comment.

export interface AppConfig {
  cleanup: {
    mediaEnabled: boolean
    pptxRenderEnabled: boolean
    backgroundEnabled: boolean
    pptxSourceEnabled: boolean
  }
  retention: {
    mediaDays: number
    orphanRenderStaleHours: number
    backgroundDays: number
    pptxSourceDays: number
  }
  deleteCapPerRun: number
  aiProxy: {
    rateLimitPerMin: number
    rateLimitPerDay: number
    allowedModels: string[]
    maxTokensCeiling: number
  }
  messaging: {
    scheduledCronEnabled: boolean
    maxRecipients: number
    orgDailyEmailQuota: number
  }
  sender: {
    fromName: string
    fromAddress: string
  }
  // Provenance — written by the Phase 70 save path (saveField in
  // src/stores/appConfig.ts), read here harmlessly if present. Optional: an
  // unwritten doc (or one written before Phase 70 ships) has neither field.
  updatedBy?: string
  updatedAt?: unknown
}

// A raw Firestore doc (or a hand-written test fixture) legitimately sets
// only SOME leaves of a nested group — e.g. { cleanup: { mediaEnabled: true } }
// with no sibling cleanup.* keys at all. `Partial<AppConfig>` only makes the
// TOP-LEVEL keys optional; each nested group's own type is still the FULL
// interface, so a partial nested literal fails to type-check against it.
// AppConfigInput recursively makes every leaf optional so both mergeAppConfig
// and isExplicitlySet accept exactly the partial-doc shapes R182/R186 exist
// to handle.
export type AppConfigInput = {
  [K in keyof AppConfig]?: AppConfig[K] extends object
    ? AppConfig[K] extends unknown[]
      ? AppConfig[K]
      : Partial<AppConfig[K]>
    : AppConfig[K]
}

// DEFAULT_APP_CONFIG — byte-identical to functions/src/appConfig.ts's
// DEFAULT_APP_CONFIG, verified against the shipped Phase 69 source
// (functions/src/appConfig.ts:64-97) on 2026-08-20.
export const DEFAULT_APP_CONFIG: AppConfig = {
  cleanup: {
    mediaEnabled: false,
    pptxRenderEnabled: false,
    backgroundEnabled: false,
    pptxSourceEnabled: false,
  },
  retention: {
    mediaDays: 30,
    orphanRenderStaleHours: 24,
    backgroundDays: 30,
    pptxSourceDays: 30,
  },
  deleteCapPerRun: 500,
  aiProxy: {
    rateLimitPerMin: 20,
    rateLimitPerDay: 500,
    allowedModels: ['claude-haiku-4-5-20251001'],
    maxTokensCeiling: 2048,
  },
  messaging: {
    scheduledCronEnabled: false,
    maxRecipients: 200,
    orgDailyEmailQuota: 1000,
  },
  sender: {
    fromName: '',
    fromAddress: 'onboarding@resend.dev',
  },
}

/**
 * A client-side mirror of functions/src/appConfig.ts's mergeAppConfig —
 * deliberately a PER-GROUP merge (not a naive recursive deep-merge or a
 * generic deep-merge library), so a doc that sets only e.g.
 * cleanup.mediaEnabled never wipes sibling cleanup.* defaults (R182/R186).
 *
 * This mirror does not need the server copy's full fail-open/fail-closed
 * coerce* discipline (the field components' own min/max/required validation
 * already blocks obviously-bad saves before they reach Firestore) — it only
 * needs to be forgiving of a partial/absent doc, matching R182's guarantee
 * that an absent appConfig/global doc resolves to DEFAULT_APP_CONFIG.
 */
export function mergeAppConfig(raw: AppConfigInput | undefined): AppConfig {
  const p = raw ?? {}
  return {
    cleanup: { ...DEFAULT_APP_CONFIG.cleanup, ...p.cleanup },
    retention: { ...DEFAULT_APP_CONFIG.retention, ...p.retention },
    deleteCapPerRun: p.deleteCapPerRun ?? DEFAULT_APP_CONFIG.deleteCapPerRun,
    aiProxy: { ...DEFAULT_APP_CONFIG.aiProxy, ...p.aiProxy },
    messaging: { ...DEFAULT_APP_CONFIG.messaging, ...p.messaging },
    sender: { ...DEFAULT_APP_CONFIG.sender, ...p.sender },
    ...(typeof p.updatedBy === 'string' ? { updatedBy: p.updatedBy } : {}),
    ...(p.updatedAt !== undefined ? { updatedAt: p.updatedAt } : {}),
  }
}

/**
 * Drives the presence-based `(default)` badge (R186): a field's badge
 * reflects whether the RAW leaf key is present in the pre-merge Firestore
 * doc — never whether the resolved value happens to numerically equal the
 * default. Comparing resolved-value-equality would mislabel a deliberate
 * "set it back to 30" save as still-default, which is dishonest provenance
 * (70-UI-SPEC.md's precise semantics section).
 */
export function isExplicitlySet(rawDoc: AppConfigInput | undefined, path: string): boolean {
  if (!rawDoc) return false
  const segments = path.split('.')
  let cursor: unknown = rawDoc
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== 'object' || !(seg in cursor)) return false
    cursor = (cursor as Record<string, unknown>)[seg]
  }
  return cursor !== undefined
}
