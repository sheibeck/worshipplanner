---
phase: 101
slug: per-org-bible-api-toggle-owner-console-infrastructure
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-31
---

# Phase 101 — UI Design Contract

> Visual and interaction contract. This phase adds ONE new control — a per-org "Enable Bible API" toggle — plus a state indicator, both **mirroring the existing per-org "Enable AI features" toggle** already shipped in the Owner Console (v2.2). It inherits the entire established design system; there is no new design language. The contract's real content is the copywriting + the mirror rule.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (existing hand-rolled Vue 3 + Tailwind v4 system) |
| Preset | not applicable |
| Component library | none (project components) |
| Icon library | existing app icon set (whatever the AI toggle row uses) |
| Font | app default (Inter) |

**Canonical rule:** every visual property (spacing, typography, color, dark-mode palette, checkbox styling, row layout) is **inherited by mirroring the adjacent "Enable AI features" control** in `src/components/admin/OrgConfigDrawer.vue` and its state treatment in `src/components/admin/OrganizationsTab.vue`. Do not invent new tokens — copy the AI toggle's markup/classes and change only the label, bound field (`org.bibleApiEnabled`), and emitted event (`toggle-bible`).

---

## Spacing / Typography / Color

Inherited verbatim from the existing OrgConfigDrawer / OrganizationsTab (dark theme: gray-950 body, gray-900/800 surfaces). The new checkbox row uses the **same** spacing, label size/weight, and control styling as the "Enable AI features" row immediately above/below it. No exceptions.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Toggle label (OrgConfigDrawer) | **Enable Bible API** |
| Toggle helper text (optional, if the AI row has one) | *Allow this church to auto-fetch ESV/NLT scripture text. When off, they use the manual BibleGateway / paste path (no API cost).* |
| Organizations list state — ON | Same affordance the AI state uses to show "on" (e.g. badge/checkmark), labelled for Bible API |
| Organizations list state — OFF (default) | Same affordance the AI state uses to show "off"; every org shows OFF until enabled |
| Toggle confirmation / feedback | Reuse the existing toggle's success/inline feedback pattern (no new toast text needed) |

**Naming precision:** the control governs the **Bible API** (paid ESV/NLT proxy), not scripture features in general. Copy must not imply scripture is unavailable when off — it is available manually (Phases 102–103).

---

## UI Considerations

Applicable state considerations resolved: 3 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | Organizations list rows | ✅ covered | Each org row independently shows its own Bible-API on/off state; mirrors the AI-state rendering already handling N rows |
| default/empty | org with no `bibleApiEnabled` field | ✅ covered | Absent field renders as OFF (default), identical to how an org missing `aiMasterEnabled` renders |
| loading/optimistic | toggle click round-trip | ✅ covered | Reuse the existing AI toggle's click→callable→listOrganizations-refresh behavior; no new loading UI introduced |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none — project-local components only | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS (label + precise helper copy pinned)
- [x] Dimension 2 Visuals: PASS (mirrors existing AI toggle)
- [x] Dimension 3 Color: PASS (inherited dark palette)
- [x] Dimension 4 Typography: PASS (inherited)
- [x] Dimension 5 Spacing: PASS (inherited, matches adjacent row)
- [x] Dimension 6 Registry Safety: PASS (no external registry)

**Approval:** approved 2026-08-31 (autonomous — trivial mirror of an existing shipped control)
