/**
 * Church-level settings stored on `organizations/{orgId}.settings` (R073).
 *
 * This shape is nested rather than flat because eight settings arrive across
 * five v1.5 phases (this phase's `aiEnabled`/`pcEnabled`, plus one field each
 * from Phase 44's default service template, Phase 45's Bible version, and
 * Phase 46's slide typography) — nesting isolates all of them from the org
 * document's identity fields (`name`, `slug`, `pcAppId`, `pcSecret`) instead
 * of polluting the document's top level one field at a time.
 *
 * Every member is REQUIRED, not optional. Optionality lives at the one
 * Firestore-read boundary — `auth.ts::loadOrgContext`, which narrows the
 * document's (possibly absent, possibly partial) `settings` field through
 * `Partial<OrgSettings>` and merges it under `DEFAULT_ORG_SETTINGS`. Because
 * that merge happens exactly once, every consumer downstream of the auth
 * store reads `authStore.settings.<field>` as a plain boolean — no consumer
 * anywhere writes its own `?? default` fallback.
 *
 * Phases 44, 45 and 46 each extend this contract by adding one field here
 * plus one default in `DEFAULT_ORG_SETTINGS` below — nothing else. They must
 * never introduce a second defaults-merge point.
 */
export interface OrgSettings {
  /** Church-level toggle for AI-assisted features (song suggestions,
   *  scripture discovery, congregational-reading split). Enforced at
   *  `src/utils/claudeApi.ts`'s module entry points (R088), not only in
   *  the UI. */
  aiEnabled: boolean
  /** Church-level toggle for Planning Center integration surfaces (export,
   *  roster import, song import, credentials block). Enforced by hiding
   *  each UI entry point (R089) — Planning Center has no single choke-point
   *  function the way AI does. */
  pcEnabled: boolean
  /**
   * Church-level Vertical Worship 1-2-3 methodology toggle (D-15/D-16).
   * MIGRATED here from the flat `Organization.vwModeEnabled` field this
   * phase. This is live production data: a church that deliberately turned
   * Vertical Worship off must not have it silently turned back on by this
   * migration. See `Organization.vwModeEnabled`'s JSDoc for the required
   * dual-read shape.
   */
  vwModeEnabled: boolean
}

/**
 * Describes the `organizations/{orgId}` document as it actually exists,
 * modeled the way `auth.ts::loadOrgContext` already treats each field
 * (nullable/optional where it currently coalesces) rather than as an
 * invented ideal shape.
 */
export interface Organization {
  name?: string | null
  slug?: string | null
  pcAppId?: string | null
  pcSecret?: string | null
  /**
   * Nested settings object (R073). Optional because a pre-v1.5 org document
   * does not have this key at all — that optionality is the whole point of
   * R073's "loads without error and yields a fully-populated OrgSettings"
   * requirement. `loadOrgContext` is the single place this gets merged with
   * `DEFAULT_ORG_SETTINGS`.
   */
  settings?: Partial<OrgSettings>
  /**
   * LEGACY flat storage location for the Vertical Worship toggle, in use
   * before this phase (Phase 16.1, D-15/D-16). This phase migrates the
   * canonical value into `settings.vwModeEnabled`, but this field stays
   * present and readable — `loadOrgContext` dual-reads
   * `settings?.vwModeEnabled ?? vwModeEnabled ?? true` — until every org
   * document has been lazily backfilled by a Settings save (never a bulk
   * migration script). Removing this field is explicitly deferred to a
   * later cleanup phase, not this one. Do not delete, deprecate, or stop
   * reading it here.
   */
  vwModeEnabled?: boolean
}

/**
 * Defaults for a church that has never configured `settings` at all —
 * i.e. every pre-v1.5 organization document. Both new settings, and the
 * migrated `vwModeEnabled`, default to ON: 39-CONTEXT.md locks "Both
 * toggles default to ON," and the Vertical Worship default has been ON
 * since Phase 16.1. A pre-v1.5 org therefore sees identical behavior the
 * moment this phase ships — nothing "changes" from the church's point of
 * view, only the storage shape does.
 */
export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  aiEnabled: true,
  pcEnabled: true,
  vwModeEnabled: true,
}
