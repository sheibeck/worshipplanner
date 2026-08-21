import { describe, expect, it } from "vitest";
import { buildDefaultOrgSettings, buildSuggestedTemplateEntries } from "./orgTemplateSeed";

// Pins the ported Suggested Template byte-identical (kind+section, order) to
// src/utils/slotTypes.ts's buildSuggestedTemplateEntries() output, traced from
// buildSlots('1-2-2-3')/defaultSectionForPosition (74-RESEARCH.md Code Examples).
const EXPECTED_SHAPE = [
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

describe("buildSuggestedTemplateEntries", () => {
  it("matches the client's 9-row {kind, section} sequence in order", () => {
    const entries = buildSuggestedTemplateEntries();
    expect(entries.map((e) => ({ kind: e.kind, section: e.section }))).toEqual(EXPECTED_SHAPE);
  });

  it("has exactly 9 entries", () => {
    expect(buildSuggestedTemplateEntries()).toHaveLength(9);
  });

  it("assigns every entry a distinct, non-empty string id", () => {
    const entries = buildSuggestedTemplateEntries();
    const ids = entries.map((e) => e.id);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns a fresh array (and fresh ids) on every call", () => {
    const first = buildSuggestedTemplateEntries();
    const second = buildSuggestedTemplateEntries();
    expect(first).not.toBe(second);
    expect(first[0].id).not.toBe(second[0].id);
  });
});

describe("buildDefaultOrgSettings", () => {
  it("matches the ported default settings literal", () => {
    const settings = buildDefaultOrgSettings();
    expect(settings.aiEnabled).toBe(true);
    expect(settings.pcEnabled).toBe(true);
    expect(settings.vwModeEnabled).toBe(true);
    expect(settings.bibleVersion).toBe("NLT");
    expect(settings.slideTypography).toEqual({ fontFamily: "Inter", fontWeight: 400, fontScale: "md" });
    expect(settings.messaging).toEqual({
      enabled: false,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 7,
    });
    expect(settings.timezone).toBe("America/Chicago");
  });

  it("seeds defaultServiceTemplate with the same 9-entry sequence", () => {
    const settings = buildDefaultOrgSettings();
    expect(settings.defaultServiceTemplate.map((e) => ({ kind: e.kind, section: e.section }))).toEqual(
      EXPECTED_SHAPE,
    );
  });
});
