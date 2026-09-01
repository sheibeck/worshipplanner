---
phase: 103
slug: manual-fallback-when-bible-api-is-off
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-31
---

# Phase 103 — UI Design Contract

> Adds the DISABLED-state scripture fallback to two existing dark-theme editors (`ScriptureInput.vue`, `CongregationalEditor.vue`) and hides the Settings "Bible Translation" card when the org's Bible API is off. All visuals inherit the existing app design system (dark: gray-950 body, gray-900/800 surfaces, indigo accent, Inter). New elements: a BibleGateway deep-link, a paste-the-passage textarea, and brief explanatory copy — shown ONLY when the org's Bible API is off. When on, the UI is unchanged.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (existing Vue 3 + Tailwind v4 system) |
| Preset | not applicable |
| Component library | none (project components) |
| Icon library | existing app icon set (use the app's external-link icon for the BibleGateway link if one exists; text link otherwise) |
| Font | Inter (app default) |

**Inheritance rule:** the paste textarea reuses the existing dark-theme input/textarea styling already used elsewhere in these editors (same border, bg, focus ring). The deep-link is a standard text link/button in the app's link style. No new tokens.

---

## Spacing / Typography / Color

Inherited. The fallback block sits inside each editor's existing disabled branch, using the editors' current section spacing. Explanatory copy uses the app's existing helper-text style (`text-sm text-gray-400`). No new color roles; the accent stays the existing indigo, used only for the link/CTA.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Fallback intro (both editors) | **Bible API is off for your church.** Open the passage in BibleGateway, then paste the text below. |
| Deep-link CTA | **Open in BibleGateway** (opens the entered reference in a new tab) |
| Paste textarea label | **Paste the passage text** |
| Paste textarea placeholder | Paste the verses here (any version) |
| Paste empty state (nothing entered yet) | No passage text yet — open BibleGateway above and paste it here. |
| Congregational, AI on | (after paste) the existing "split into reading" action works on the pasted text — reuse current split copy |
| Congregational, AI off | (no auto-split; existing manual-sectioning behavior + its current copy — unchanged) |
| Settings — Bible Translation card | HIDDEN entirely when Bible API is off (no copy shown), mirroring how "AI Features" hides when the AI master gate is off |

**Tone:** the fallback is intentional, not an error — never render it red or as a failure. It is the normal path for an off org.

---

## UI Considerations

Applicable state considerations resolved: 5 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| enabled (unchanged) | ScriptureInput / CongregationalEditor | ✅ covered | When Bible API on, no fallback UI renders — auto-fetch path unchanged (R296 held in P102); asserted by tests |
| disabled (fallback shown) | both editors | ✅ covered | When off, the intro + "Open in BibleGateway" link + paste textarea render, non-error styling; component tests assert presence |
| empty | paste textarea before entry | ✅ covered | Shows placeholder + empty-state helper; slide/reading simply has no scripture text yet (no crash) |
| populated | paste textarea after entry | ✅ covered | Pasted text becomes the slide/reading content via the same downstream path the fetch used; congregational split runs on it when AI on |
| off-vs-off independence | AI gate vs Bible gate | ✅ covered | Bible-off + AI-on → paste + split works; Bible-off + AI-off → paste works, no auto-split (existing behavior). Gates independent |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not required |

External link target: `https://www.biblegateway.com/passage/?search=<reference>[&version=<stored version>]`, opened `target="_blank" rel="noopener"`.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (intentional-not-error copy pinned; empty/populated states covered)
- [x] Dimension 2 Visuals: PASS (inherits editor styling; fallback only when off)
- [x] Dimension 3 Color: PASS (inherited; never rendered as an error/red state)
- [x] Dimension 4 Typography: PASS (inherited)
- [x] Dimension 5 Spacing: PASS (inherited section spacing)
- [x] Dimension 6 Registry Safety: PASS (no external registry; BibleGateway link is a plain external anchor)

**Approval:** approved 2026-08-31 (autonomous — affordances added to existing editors; inherits the app design system)
