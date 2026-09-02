import { randomUUID } from "node:crypto";

/** See .planning/codebase/ARCHITECTURE.md (Backend Behavioral Notes (R318) § functions/src/orgTemplateSeed.ts) */

/** Mirrors `src/types/service.ts`'s `SlotKind` union. */
export type PortedSlotKind =
  | "SONG"
  | "SCRIPTURE"
  | "PRAYER"
  | "MESSAGE"
  | "ANNOUNCEMENTS"
  | "MISC"
  | "HYMN"
  | "IMPORTED";

/** Mirrors `src/types/service.ts`'s `ServiceSection` union. */
export type PortedServiceSection = "pre-service" | "worship" | "message" | "sending" | "post-service";

/**
 * Minimal hand-mirrored port of `src/types/organization.ts`'s
 * `ServiceTemplateEntry` — only the fields this seed touches (`id`, `kind`,
 * optional `section`). Never carries chosen content or a computed VW type.
 */
export interface PortedTemplateEntry {
  id: string;
  kind: PortedSlotKind;
  section?: PortedServiceSection;
}

/**
 * The FIXED 9-entry `{kind, section}` sequence `buildSlots('1-2-2-3')`
 * produces (src/utils/slotTypes.ts:319-371). Order is significant — it IS
 * the creation/display order (Assumption A3, no separate `position` field).
 */
const SUGGESTED_TEMPLATE_SHAPE: ReadonlyArray<Pick<PortedTemplateEntry, "kind" | "section">> = [
  { kind: "SONG", section: "worship" },
  { kind: "SCRIPTURE", section: "worship" },
  { kind: "SONG", section: "worship" },
  { kind: "PRAYER", section: "worship" },
  { kind: "SCRIPTURE", section: "worship" },
  { kind: "SONG", section: "worship" },
  { kind: "SONG", section: "worship" },
  { kind: "MESSAGE", section: "message" },
  { kind: "SONG", section: "sending" },
];

/**
 * Data-only port of `src/utils/slotTypes.ts`'s `buildSuggestedTemplateEntries()`.
 * Each row gets a fresh `randomUUID()` — ids are NOT compared cross-module
 * (client and server each mint their own), only the `{kind, section}`
 * sequence needs to match.
 */
export function buildSuggestedTemplateEntries(): PortedTemplateEntry[] {
  return SUGGESTED_TEMPLATE_SHAPE.map((entry) => ({ id: randomUUID(), ...entry }));
}

/**
 * Minimal hand-mirrored port of `src/types/organization.ts`'s `OrgSettings`.
 */
export interface PortedOrgSettings {
  aiEnabled: boolean;
  pcEnabled: boolean;
  vwModeEnabled: boolean;
  defaultServiceTemplate: PortedTemplateEntry[];
  bibleVersion: "ESV" | "NLT";
  slideTypography: {
    fontFamily: string;
    fontWeight: number;
    fontScale: "sm" | "md" | "lg";
  };
  messaging: {
    enabled: boolean;
    lockNotifyDefault: boolean;
    reminderEnabled: boolean;
    reminderDaysBefore: number;
  };
  timezone: string;
}

/**
 * Data-only port of `src/types/organization.ts`'s `DEFAULT_ORG_SETTINGS`,
 * with `defaultServiceTemplate` populated by a fresh
 * `buildSuggestedTemplateEntries()` call (the client's default is `[]` there
 * because `createService` resolves the Suggested-Template fallback at its own
 * call site — but a freshly onboarded org has no services yet, so this seed
 * populates the template directly per R198).
 */
export function buildDefaultOrgSettings(): PortedOrgSettings {
  return {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    defaultServiceTemplate: buildSuggestedTemplateEntries(),
    bibleVersion: "NLT",
    slideTypography: {
      fontFamily: "Inter",
      fontWeight: 400,
      fontScale: "md",
    },
    messaging: {
      enabled: false,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 7,
    },
    timezone: "America/Chicago",
  };
}
