import type { SlotKind, ServiceSection } from '@/types/service'

/**
 * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) ->
 * src/types/organization.ts).
 */
export interface ServiceTemplateEntry {
  id: string
  kind: SlotKind
  section?: ServiceSection
  /** Optional recurring body text for a body-bearing MISC entry (R116),
   *  threaded through `buildSlotsFromTemplate` → `createSlot` into the created
   *  slot's `NonAssignableSlot.body`. Absent for entries with no default body. */
  body?: string
  /** Optional recurring custom label for a MISC entry (R127, Phase 56),
   *  threaded through `buildSlotsFromTemplate` → `createSlot` into the created
   *  slot's `NonAssignableSlot.label` so a template's MISC name flows into every
   *  new service. Absent for entries with no custom label. */
  label?: string
}

/**
 * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) ->
 * src/types/organization.ts).
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
  /**
   * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) ->
   * src/types/organization.ts).
   */
  defaultServiceTemplate: ServiceTemplateEntry[]
  /**
   * Church-level choice of scripture translation for NEW passages (R090).
   * `'ESV'` (English Standard Version) or `'NLT'` (New Living Translation).
   * Set in Settings, gated to org editors. Governs only scripture fetched
   * going forward — an existing slide's own `translationSource` field
   * (R092) never changes when this setting changes.
   */
  bibleVersion: 'ESV' | 'NLT'
  /**
   * See .planning/codebase/CONCERNS.md (Type Concern Notes (R318) ->
   * src/types/organization.ts).
   */
  slideTypography: {
    fontFamily: string
    fontWeight: number
    fontScale: 'sm' | 'md' | 'lg'
  }
  /**
   * Church-level volunteer-email messaging settings (R130/R132, Phase 58).
   * No send path, UI, or Cloud Function exists yet — this is the typed
   * substrate every later messaging phase (59-62) builds on.
   */
  messaging: {
    /** GLOBAL kill switch for volunteer email messaging. DELIBERATE
     *  deviation from `aiEnabled`/`pcEnabled` (which default true): a fresh
     *  org has no email provider configured, so messaging must fail closed
     *  until the owner explicitly opts in via Settings (R130). Enforced at
     *  `src/utils/messaging.ts::isMessagingEnabled`, the single client
     *  choke point every later messaging surface reads. */
    enabled: boolean
    /** Org-level default for whether a service lock triggers a
     *  lock-notification email, inherited by a service unless overridden
     *  (R132). Conservative default: off, owner opts in. */
    lockNotifyDefault: boolean
    /** Org-level default for whether the pre-service reminder email is
     *  sent, inherited by a service unless overridden (R132). Conservative
     *  default: off, owner opts in. */
    reminderEnabled: boolean
    /** Number of days before a service's date the reminder email fires
     *  (Phase 61 cron). Only load-bearing once that scheduler ships; this
     *  phase persists the field + its Settings UI. */
    reminderDaysBefore: number
    // `fromName`/`replyTo` removed (owner UAT 2026-08-17): outgoing emails send
    // from the app's own verified address with the ORG NAME as the display name,
    // and Reply-To is auto-built from the sending editor — neither is
    // church-configurable (a church can't own the sending domain). The From
    // display name comes from Organization.name; see functions/src/index.ts.
  }
  /** Church-wide local timezone (IANA name, e.g. `'America/Chicago'`),
   *  R133. Only load-bearing for Phase 61's scheduled reminder cron; this
   *  phase just persists the field + its Settings `<select>`. */
  timezone: string
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
   * LEGACY (Phase 16.1, D-15/D-16) — do not delete, deprecate, or stop reading. See
   * .planning/codebase/CONCERNS.md (Type Concern Notes (R318) -> src/types/organization.ts).
   */
  vwModeEnabled?: boolean
  /** See ADR-0001 (docs/adr/0001-super-admin-explicitly-enables-it-written-only-by-the.md) */
  aiMasterEnabled?: boolean
  /**
   * Phase 101 (R295) — super-admin MASTER gate, written ONLY server-side. See
   * .planning/codebase/INTEGRATIONS.md (Type & View Integration Notes (R318) ->
   * src/types/organization.ts).
   */
  bibleApiEnabled?: boolean
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
  defaultServiceTemplate: [],
  // Owner's LOCKED override (45-CONTEXT.md § Area 1, 2026-08-07): NLT, not
  // ESV. This is deliberately NOT "preserve current behavior" — a church
  // that never opens the Bible Translation setting fetches NEW scripture
  // from NLT. Existing slides are unaffected (see `translationSource` on
  // the slide types, R092) — this default only governs scripture fetched
  // going forward.
  bibleVersion: 'NLT',
  // Medium (1.0) = identity scale: a church that never opens the Slide
  // Typography setting sees zero size change. Family default anchors on the
  // ROADMAP's designated Helvetica-Neue stand-in (Inter, weight 400).
  slideTypography: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontScale: 'md',
  },
  // R130 — DELIBERATE deviation from aiEnabled/pcEnabled: `enabled` defaults
  // false (kill-switch fails closed for a fresh org with no email provider
  // configured yet). `lockNotifyDefault`/`reminderEnabled` default false
  // (conservative opt-in); `reminderDaysBefore` defaults to 7.
  messaging: {
    enabled: false,
    lockNotifyDefault: false,
    reminderEnabled: false,
    reminderDaysBefore: 7,
  },
  // R133 — sensible US-central placeholder the owner changes in Settings.
  timezone: 'America/Chicago',
}
