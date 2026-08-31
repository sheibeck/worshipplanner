---
phase: 102
slug: gated-scripture-fetch-dispatcher
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-31
---

# Phase 102 — UI Design Contract

> **This phase introduces NO new UI.** It is a fetch-layer refactor + per-org gate: a new `src/utils/scriptureApi.ts` dispatcher becomes the single choke point for ESV/NLT fetching (client) plus a mirrored server gate on the esv/nlt proxy branches. The gate flags "frontend" only because it edits two existing Vue components (`ScriptureInput.vue`, `CongregationalEditor.vue`) to route their fetch through the dispatcher.
>
> **When the org is ENABLED:** the UI is byte-for-byte unchanged (R296 no-regression) — same scripture preview, same congregational auto-fetch.
> **When the org is DISABLED:** the components' auto-fetch simply **no-ops** (the dispatcher returns a non-error `'disabled'` signal). No new control, no error state, no red message is added in THIS phase. The rich manual fallback (BibleGateway deep-link + paste-in) and hiding the Settings translation selector are **Phase 103**, which conditions its UI on this phase's `'disabled'` signal.

---

## Design System

Inherited — no changes. No new components, tokens, colors, typography, spacing, or copy are introduced in Phase 102.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| (none) | Phase 102 adds no user-facing copy. The disabled branch is a silent no-op; all fallback copy lands in Phase 103. |

---

## UI Considerations

Applicable state considerations resolved: 2 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| enabled (unchanged) | ScriptureInput / CongregationalEditor fetch | ✅ covered | Enabled-org path is a pure passthrough of the pre-existing fetch — no visible change (R296); asserted by existing + new component tests |
| disabled (no-op) | ScriptureInput / CongregationalEditor fetch | ✅ covered | Disabled-org path does not fetch, does not throw, does not render an error; component stays functional. The visible fallback affordance is deferred to Phase 103 by design |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (no new copy — by design)
- [x] Dimension 2 Visuals: PASS (no visual change)
- [x] Dimension 3 Color: PASS (n/a)
- [x] Dimension 4 Typography: PASS (n/a)
- [x] Dimension 5 Spacing: PASS (n/a)
- [x] Dimension 6 Registry Safety: PASS (no external registry)

**Approval:** approved 2026-08-31 (autonomous — non-UI fetch-layer gate; visible fallback UI deferred to Phase 103)
