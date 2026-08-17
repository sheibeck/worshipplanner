import type { SlotKind, ServiceSection } from '@/types/service'

/**
 * A single entry in a church's default service template (R086/R087). Carries
 * the item's type, its section, and — for body-bearing kinds (MISC and the
 * other NonAssignable kinds the live editor treats the same way) — an optional
 * recurring `body` text (R116, e.g. "canned music", "more announcement
 * slides"). It never carries chosen content (no `songId` or scripture
 * reference) and never a computed Vertical Worship type. VW typing is derived
 * fresh at service-creation time by `buildSlotsFromTemplate`
 * (`src/utils/slotTypes.ts`) and is never stored here. Array order in
 * `OrgSettings.defaultServiceTemplate` IS the creation/display order — there
 * is no `position` field (Assumption A3).
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
  /**
   * Church-defined default set/order of items for a new service (R086/R087).
   * Entries carry `{ id, kind, section, body? }` — never a chosen song/scripture
   * and never a computed VW type, which is derived fresh at service-creation
   * time; `body?` carries recurring MISC text for body-bearing kinds (R116).
   * An empty/unset array does NOT produce an empty service: per R115 (which
   * supersedes the owner's 2026-08-07 EMPTY override), `createService` seeds a
   * new service from the Suggested Template (`buildSuggestedTemplateEntries()`,
   * the 1-2-2-3-derived preset) when this array is empty. The fallback is
   * resolved at the `createService` call site — `buildSlotsFromTemplate` stays
   * pure (`[]` → `[]`).
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
   * Church's one house font, applied to every slide surface — the Slides
   * grid, the Edit Slide drawer preview, and the presenter
   * (`PresentationViewer.vue`) — via CSS custom properties (R093).
   * `ServicePrintLayout.vue` is deliberately excluded; the printed Order of
   * Service is out of scope for this setting.
   *
   * `fontFamily` must be one of `SLIDE_FONTS`'s keys (`src/config/
   * slideFonts.ts`); `fontWeight` must be one of that family's `weights`;
   * both are defensively re-validated at render time by
   * `src/utils/slideTypography.ts::cssVarsFor`/`snapWeight`, never trusted
   * as free text (ASVS V5). `fontScale` is a **multiplier** applied via
   * `--slide-font-scale`, not an absolute pixel size — `'md'` is the
   * identity scale (1.0), so a church that never opens this setting sees
   * zero size change.
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
