# Project Research Summary

**Project:** WorshipPlanner — v1.5 "Settings, Sharing, and Fidelity"
**Domain:** Church worship-planning / presentation SaaS (mature, shipped product — subsequent-milestone integration research, not 0-to-1)
**Researched:** 2026-08-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

v1.5 is overwhelmingly a wiring milestone, not a new-library milestone: four of five stack questions need zero or near-zero new dependencies, and the one real addition (self-hosted fonts via `@fontsource/*`) needs no build step. The real difficulty is not "what to build" but reconciling the owner's locked decisions with code that already exists — the R036 draft-lock write guard, an inert cross-service Storage-rules check, an exhaustive-but-silently-forkable `SlotKind` switch pattern, and a share-token mint-fresh-every-time bug. Three subsystems that look like small settings features are actually schema/migration decisions in disguise: sharing, custom claims, and service-item types.

The recommended approach: build shared settings infrastructure first (a typed `OrgSettings` sub-object — nothing like it exists today), do the custom-claims migration as its own long-soak infrastructure phase sequenced early, resolve the share-token storage location explicitly before writing code (it conflicts with R036 as literally decided), and treat the congregational-reading divider as the priority UI-research item since no comparable church product has solved it.

The dominant risk is rules-testing discipline: this project already shipped a deny-everyone Storage rule that passed its (deny-only) test suite for an entire milestone. Every rule change in v1.5 must ship with a passing allow-case test proven against the real emulator, written first. The second dominant risk is treating custom-claims rollout as a single deploy: it is structurally two deploys with a mandatory soak period, and deploying is the owner's action per the v1.5 autonomy grant, so that phase cannot fully close inside an autonomous run.

## Key Findings

### Recommended Stack

Nearly the entire stack is unchanged (Vue 3 / Vite / Pinia / Tailwind v4 / Firebase 12). Additions: `@fontsource/*` packages for self-hosted curated fonts (Inter as the Helvetica Neue stand-in, plus 7 more OFL/Apache families); a `nlt` branch in the existing Cloud Function proxy — structurally different from ESV because NLT auth is a query parameter (not a header) and its response is HTML (not JSON), requiring `DOMParser`-based stripping; `firebase-admin`'s `setCustomUserClaims` (already available) for claims; native `Intl.Collator({ numeric: true })` for deterministic multi-image ordering.

**Core technologies:**
- `@fontsource/inter` + 7 curated families (`5.3.0`) — self-hosted, offline-safe fonts — a projector without internet cannot fetch Google Fonts at service time (already decided, non-negotiable)
- `NLT_API_KEY` + new proxy branch in `functions/src/index.ts` — reuses the proxy pattern but needs its own query-param-injection branch
- Firestore `onDocumentWritten` trigger + `setCustomUserClaims` — mirrors the existing `requestPptxRender` trigger already shipped
- `Intl.Collator` — native, zero-bytes, fixes the `slide2`-before-`slide10` ordering defect

### Expected Features

**Must have (table stakes, all in the locked v1.5 list):** AI toggle (hide-on-off, not grey-out); Planning Center toggle; ESV/NLT selection with mandatory "(ESV)"/"(NLT)" attribution suffix (both publishers require initials-only for non-saleable media — no verse-count enforcement needed at this scale); stable share links (Planning Center's "Permalink" model validates persist-token + auto-refresh-content); Announcements/Miscellaneous as plain input boxes (Planning Center's generic "Item" type is the direct precedent); default service template at item-type+title granularity; congregational reading manual divider (priority — **no church-software precedent exists**; ProPresenter/EasyWorship/Proclaim all lack a documented leader/congregation split editor); global slide typography (family+weight+size); multi-image natural-sort ordering.

**Should have / flag to owner:** text outline/shadow on slide typography — near-universal in comparable tools specifically as the standard legibility technique against background images (shipped v1.4) — not in the locked v1.5 list; recommend surfacing this gap explicitly.

**Defer (v2+):** per-item template durations; multiple named service templates; safe-area margin guides; free-range select-text-then-label divider mode (rejected — real responsive readings never break mid-sentence).

**Anti-features rejected:** drag-handle dividers (breaks are discrete, not continuous — false precision, mobile accidental-drag risk); greyed-out (vs. hidden) AI controls when off; verse-count enforcement UI.

### Architecture Approach

The org document has never had a typed shape — v1.5's ~8 new settings values must land as one typed `settings` sub-object with a single defaults-merge point in `auth.ts`, not eight more bare top-level fields. This is a hard prerequisite for every other settings feature.

**Major components:**
1. `src/types/organization.ts` + `DEFAULT_ORG_SETTINGS` — the org-settings foundation
2. A Firestore `onDocumentWritten` trigger on `organizations/{orgId}/members/{uid}` — mirrors membership into a custom auth claim, matching the existing `requestPptxRender` trigger pattern
3. A new (or repurposed) share-link document, resolving the R036 conflict (see below)
4. A client-side render-status resolver for `pptxRenders`/`rendered/*.png` — genuinely new IMPORTED-branch logic, not a URL swap
5. A CSS custom-property triplet + static font-registry module — greenfield; no font seam exists anywhere in this codebase today

### Critical Pitfalls

1. **Custom claims can lock out or under-authorize users** — the 1000-byte ceiling is live (multi-org membership is real), claims stale up to 1 hour. Avoid via dual-read (`OR`) rules through one full soak, idempotent backfill, fallback removed only in a separate later deploy.
2. **A rules change proves it denies the wrong thing, not that it allows the right thing** — this project already shipped a deny-everyone Storage rule that passed a deny-only test suite for a full milestone. Every rules change needs a passing allow-case test, written first, against the real emulator.
3. **Share-link backfill can orphan already-circulated links** — must reuse the most recent existing token, not mint anew. Auto-refresh gated on "already shared"; must never write back to the document it watches (loop hazard).
4. **Widening `SlotKind` is compiler-caught at 6+ exhaustive-switch sites but NOT at silent-fallthrough sites** — above all `addSlotAsItem`'s Planning Center export, which defaults unhandled kinds to "Message" with no guard.
5. **A feature toggle that only hides UI leaves the code path callable** — AI/PC gates must live inside `claudeApi.ts`/the PC utility itself, not only in `v-if`s, and must never mutate already-generated content when flipped.

## Contradictions/Refinements to PROJECT.md — Roadmapper Must Not Plan Against Superseded Decisions

**1. Share token storage location conflicts with the R036 draft-lock guard.** PROJECT.md's locked decision — "persist the token on the service doc" — collides with the write guard shipped in Phase 31 (`services.ts:197-203` `assertWritable`, `firestore.rules:64-84`). A bare `{ shareToken }` write matches none of the three carve-out shapes and is REJECTED on `planned`/`exported` services — the common sharing case. Recommended fix (not yet a locked decision): a separate `serviceShareLinks/{serviceId}` document, never touching the service doc or R036's carve-out surface. The owner's intent — one never-rotating link, snapshot auto-refreshed — is unchanged; only the storage location moves. Separately, regardless of which option is chosen: `firestore.rules`' `shareTokens` collection has `allow update: if false` today, which blocks any snapshot refresh and must change (mirror `serviceShares`' existing update rule).

**2. Custom claims scope: `storage.rules` ONLY, not `firestore.rules`.** `firestore.rules` reads Firestore from Firestore rules — a same-service call, unaffected by firebase-js-sdk#6803, already correctly synchronous. Moving `firestore.rules` to the claim too would trade one staleness class (real) for another (new and unnecessary). Scope this migration to `storage.rules`.

**3. Custom claims rollout is structurally two deploys with a soak between, not one.** Rules must `OR` (never `AND`) the new claim against the existing check for at least one full max-token-lifetime (1 hour) before the fallback is removed in a separate deploy. Deploys are the owner's action per the standing v1.5 autonomy grant — this phase cannot fully close inside an autonomous run; it ships built-and-undeployed.

**4. Multi-org membership is a live constraint.** `users/{uid}.orgIds` is already an array (`auth.ts:86-99` currently only uses `ids[0]`), so the 1000-byte claim-payload ceiling is real design pressure now. The claim shape must be designed before the Cloud Function is written.

**5. Share-token backfill must ADOPT the most recent existing token, never mint fresh.** `createShareToken()` mints on every call, so some services already have several `shareTokens` docs. Minting anew orphans links already circulated to a congregation.

**6. PPTX rendered-image display is not a URL swap — it's new branch logic in two files.** Rendered page count and parsed-slide count structurally disagree. The IMPORTED-kind derivation in both `slideGroupMaterializer.ts::deriveGroupEntries` and `slideshowAssembler.ts` needs a genuinely new code path for "ready render exists." `sourceSignature`'s IMPORTED case must fold in render status/count, or the existing rebuild-on-mismatch mechanism will never notice a `pending→ready` transition.

**7. `addSlotAsItem`'s silent fallthrough is a real, already-demonstrated trap.** The Planning Center export if-chain defaults any unhandled `SlotKind` to a generic "Message" branch with no guard. `IMPORTED` already required an explicit skip-with-comment to avoid exactly this mislabeling, but only in the new-plan export path. `ANNOUNCEMENTS`/`MISCELLANEOUS` need the same deliberate treatment, and it will not be caught by the compiler.

**8. NLT is not a drop-in ESV swap.** Auth is a `key` query parameter, not an `Authorization` header — the ESV branch's header-injection code cannot be reused verbatim. The response is HTML (not JSON), with no documented toggle to suppress verse numbers — needs a `DOMParser`-based strip step plus a follow-up regex pass, flagged as a phase-level unknown to resolve against a real fetched sample.

## Additional Sequencing Constraints

- **Do not parallelize phases that share a choke point.** The AI toggle and congregational-reading AI-split both gate through `claudeApi.ts`; custom claims and sharing rework both edit `firestore.rules`/`storage.rules`. Sequence these, don't run concurrently.
- **Item 3 (default service template) depends on item 5 (finalized item-type palette).** The template editor needs the final `SlotKind` set settled first.
- **Rules-testing discipline is mandatory on every phase touching `firestore.rules`/`storage.rules` this milestone.** Every such phase ships a positive (allow-case) test, written and run FIRST, against the real emulator — not a mental read of the `.rules` file. Any "environment limitation" claim must be proven inert by the strip-down method CLAUDE.md documents, not asserted.

## Open Scope Questions for the Owner

1. **Should global slide typography include text outline/shadow?** Near-universal in comparable tools, specifically as the legibility technique against background images (already shipped v1.4). Not in the locked v1.5 list — raise explicitly rather than silently including or dropping.
2. **Does global typography extend to the printed Order of Service (`ServicePrintLayout.vue`), or is it slide-surfaces only?** Currently text-only, not slide-shaped — would be a fifth consumer surface if in scope. PROJECT.md does not resolve this.

## Implications for Roadmap

Suggested phase structure, continuing numbering from v1.4 (phases start at 39):

### Phase 39: Org Settings Infrastructure
**Rationale:** Every other settings feature writes into this shape — build first or every later phase re-touches `auth.ts`'s load/reset logic piecemeal.
**Delivers:** `src/types/organization.ts` (`Organization`, `OrgSettings` — first of their kind), `DEFAULT_ORG_SETTINGS`, `auth.ts` merge-and-load logic, one nested `settings` field on the org doc.
**Avoids:** The "eight duplicated `?? default` lines" pattern.

### Phase 40: Custom Auth Claim for Org Membership
**Rationale:** The riskiest item — needs the longest verification window. Independent of Phase 39; sequence early, not last.
**Delivers:** `onDocumentWritten` trigger setting `{ orgId, role }` claims; dual-read `storage.rules` change; idempotent/resumable backfill; forced-refresh call sites in `auth.ts`.
**Research flag:** Deploy-gated — the soak-and-fallback-removal step is the owner's action and cannot close autonomously.
**Avoids:** Pitfall 1 (lockout/staleness), Pitfall 2 (unproven "environment limitation" claims).

### Phase 41: Sharing Correctness
**Rationale:** Resolve the R036 conflict explicitly before writing code (recommend the separate `serviceShareLinks` document). Sequence after Phase 40 to avoid two concurrent rewrites of the same rules files.
**Delivers:** Persisted, never-rotating share token (new document, not a service-doc field); `shareTokens`/`serviceShares` rules updated to permit snapshot overwrite; auto-refresh hooked to `services.ts`'s six write functions, gated on "already shared"; backfill that adopts existing tokens.
**Avoids:** Pitfall 3 (orphaned links, write amplification, PII scope creep).

### Phase 42: PPTX Rendered-Image Display (carryover R062)
**Rationale:** The largest, most structurally invasive item. Sequence after Phase 40/41 so Storage reads are claim-based for this brand-new code path.
**Delivers:** Client-side render-status resolver; new IMPORTED branches in both materializer and assembler; `sourceSignature` folding in render status; full-bleed presenter branch; pending/failed fallback states.
**Research flag:** Has slipped one milestone already — give it its own named phase with the stated acceptance criterion as explicit success condition.

### Phase 43: Service Item Types (Announcements, Miscellaneous, Message simplification, Hymn palette removal)
**Rationale:** Compiler-bounded at exhaustive-switch sites; real risk is silent-fallthrough sites. Independent of Phases 40-42; must land before or with Phase 44.
**Delivers:** Widened `SlotKind` union; new `text` field shared by Message/Announcements/Miscellaneous (Prayer keeps its link-based shape); explicit guard in `addSlotAsItem`; Hymn removed from both palette locations only.
**Avoids:** Pitfall 4 — verify `npm run type-check` (the `vue-tsc --build` form) is clean, and explicitly document which switch-group each new kind joins.

### Phase 44: Default Service Template
**Rationale:** Depends on Phase 39 and Phase 43. Otherwise small — one consumption site (`createService`).
**Delivers:** `OrgSettings.defaultServiceTemplate: ServiceSlot[] | null`; `createService` reading `orgTemplate ?? buildSlots(progression)`; a Services slide-out editor reusing existing slot primitives; VW typing computed at creation time, never frozen into the stored template.

### Phase 45: AI and Planning Center Settings Toggles
**Rationale:** Low complexity, but the choke-point guard must be written and tested before the UI. Shares `claudeApi.ts` with Phase 48 — sequence, don't fully parallelize.
**Delivers:** Two org-settings booleans; module-level guards; hide-not-grey UI treatment; explicit test proving a direct `claudeApi.ts` call with the toggle off makes no network request.
**Avoids:** Pitfall 5.

### Phase 46: ESV/NLT Bible Version Selection
**Rationale:** Independent, low complexity, but the per-slide translation-source field is a schema decision that must be made now. Feeds Phase 48.
**Delivers:** `NLT_API_KEY` + new proxy branch; settings picker; mandatory attribution suffix built once, shared by both scripture paths; per-slide translation-source field so a setting switch never retroactively alters existing slides.
**Confidence flag:** NLT terms-of-use and exact API shape are LOW-MEDIUM confidence — verify against the owner's actual key before shipping.

### Phase 47: Global Slide Typography
**Rationale:** Depends on Phase 39; needs the owner's answer on outline/shadow and print-surface scope before implementation. Greenfield infrastructure.
**Delivers:** Curated font registry with recorded per-font licenses; CSS custom-property triplet consumed by grid, drawer preview, presenter (and print, if confirmed in scope); `document.fonts.ready`-gated first paint and pre-measurement gating.
**Avoids:** Pitfall 6 (font flash/reflow on a live projection).
**Research flag:** UI-research sub-step required per PROJECT.md's own decision text — bundle legibility research and font-loading-safety research together.

### Phase 48: Congregational Reading Divider UX (priority feature)
**Rationale:** The owner-mandated UI-research-heavy item. Depends on Phase 46, benefits from Phase 47. No church-software precedent exists — reference class is subtitle/caption editors (click-to-split) plus per-segment label chips, not drag-handle or free-range-selection (both evaluated and rejected).
**Delivers:** Click-between-verses divider + per-segment Leader/Congregation/All chip control, seeded three ways (AI split, gated by Phase 45's toggle; one-click alternate-assignment; blank) into one editable `{ text, role }[]` structure; first slide shows the scripture reference, later slides show only the speaker label.
**Uses:** Phase 45's AI toggle (gates but does not block), Phase 46's translation/attribution logic.

### Phase 49: Multi-Image Import Ordering
**Rationale:** Fully independent, low-risk, bug-fix-shaped — good candidate to build roadmap momentum early or slot in wherever convenient.
**Delivers:** `Intl.Collator({ numeric: true, sensitivity: 'base' })` comparator applied to `classifyFiles`'s images bucket in `dropRouting.ts`.

### Phase 50: Mobile & Layout Polish
**Rationale:** Sequence last — benefits from Print/Share already having moved into the contextual action bar, and from no other phase still touching drag-and-drop order logic concurrently.
**Delivers:** `QuarterView.vue`'s responsive button-stacking recipe applied to `ServiceEditorView.vue`'s header; Print/Share moved into `ContextualActionBar.vue`; Undo demoted to a link; dismissible Getting Started panel; mobile-friendly Slides tab (not independently audited yet).
**Avoids:** Pitfall 8 (touch drag-and-drop reproducing the documented `ZTXcpNRcJTalEQp42fTx` index bug) — reuse the exact desktop SortableJS config with touch-only options added.

### Phase Ordering Rationale

- Settings infrastructure (39) and custom claims (40) are prerequisite/independent infrastructure and belong first.
- Sharing (41) is sequenced after claims (40) specifically to avoid two concurrent rewrites of the same rules files.
- PPTX display (42) follows sharing so its brand-new Storage read path inherits claim-based correctness.
- Service item types (43) is compiler-bounded and independent, but must precede the template (44).
- AI/PC toggles (45) precede the divider (48) since both touch `claudeApi.ts`.
- Bible version selection (46) precedes the divider (48) since the divider operates on already-fetched, already-attributed scripture text.
- Typography (47) loosely precedes the divider (48) so the divider's slide preview reflects real settings.
- Multi-image ordering (49) and mobile polish (50) are independent; mobile is last because it benefits from Print/Share already having moved and from no concurrent drag-and-drop work.

### Research Flags

Phases likely needing deeper research during planning (`--research-phase`):
- **Phase 40 (custom claims):** dual-read rollout, byte-budget claim shape, race-condition-at-invite-acceptance design.
- **Phase 41 (sharing):** the R036 storage-location decision must be made explicitly in the plan.
- **Phase 42 (PPTX display):** render-count-vs-parsed-count reconciliation across two files plus `sourceSignature`.
- **Phase 46 (NLT):** the HTML-to-plain-text extraction step needs a spike/discovery step against a real sample.
- **Phase 47 (typography):** owner must resolve outline/shadow and print-surface scope questions first.
- **Phase 48 (congregational reading divider):** no direct precedent exists; treat the interaction-pattern analysis as required reading.

Phases with standard, well-documented patterns (safe to skip a dedicated research sub-step):
- **Phase 39 (settings infrastructure):** direct generalization of the existing `vwModeEnabled` pattern.
- **Phase 43 (service item types):** compiler-guided, existing well-understood architecture.
- **Phase 44 (default template):** reuses existing slot primitives verbatim.
- **Phase 45 (AI/PC toggles):** table-stakes SaaS pattern, existing choke point already designed for this.
- **Phase 49 (multi-image ordering):** solved problem, native `Intl.Collator`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | HIGH on npm-registry facts; LOW-MEDIUM on NLT API shape/terms and font licensing/metrics (web-search only) |
| Features | MEDIUM | Official/primary for Planning Center and Crossway/Tyndale license pages; LOW-MEDIUM for congregational-reading UX specifically, since no church-software precedent exists |
| Architecture | HIGH | Every claim traced to a specific file/line read in this codebase; no external research used |
| Pitfalls | HIGH | Codebase-grounded, cross-checked against this project's own documented incident history; Firebase claims mechanics cross-checked directly against official docs |

**Overall confidence:** MEDIUM-HIGH — structural/architectural findings (where the real risk lives) are highly reliable; the two genuinely uncertain areas (NLT's exact terms/API shape, whether outline/shadow belongs in scope) are flagged as explicit open items.

### Gaps to Address

- **NLT API terms of use and exact response shape:** verified only by a single manual fetch — confirm against the owner's actual key during Phase 46's planning.
- **Font licensing for any curated family beyond Inter:** record and verify the license for each font actually added, don't assume by analogy.
- **Whether schedule-only changes should trigger a share-snapshot refresh:** `resolveServiceRoleAssignments` reads the `quarters` store, which can change independent of any service-doc write — the client-side refresh hook does NOT cover a volunteer's schedule changing for someone not overridden on this specific service. Unresolved product question — resolve explicitly, don't let it slide.
- **Slides tab mobile-blocking layout:** not independently audited line-by-line — Phase 50's plan needs the same targeted read-before-plan treatment given to `ServiceEditorView.vue`'s header.
- **The two open scope questions for the owner** (typography outline/shadow; print-surface inclusion) — must be resolved before Phase 47's plan is finalized.

## Sources

### Primary (HIGH confidence)
- Direct codebase reads across all four research files: `.planning/PROJECT.md`, `CLAUDE.md`, `firestore.rules`, `storage.rules`, `src/stores/services.ts`, `src/stores/auth.ts`, `src/utils/slotTypes.ts`, `src/utils/slideGroupMaterializer.ts`, `src/utils/slideshowAssembler.ts`, `functions/src/index.ts`, `src/utils/esvApi.ts`, `src/components/slides/dropRouting.ts`, and ~15 more files enumerated in ARCHITECTURE.md's Sources section
- npm registry live `npm view` (2026-08-06): `@fontsource/*@5.3.0` family, `subset-font@2.5.0`
- [ESV Permissions - Crossway](https://www.crossway.org/permissions/)
- [firebase.google.com/docs/auth/admin/custom-claims](https://firebase.google.com/docs/auth/admin/custom-claims)

### Secondary (MEDIUM confidence)
- [Set up plan templates - Planning Center](https://help.planningcenter.com/en/139469-set-up-plan-templates.html) and related PC help docs
- [Guide to Using Themes in ProPresenter](https://support.renewedvision.com/hc/en-us/articles/34551484745875-Guide-to-Using-Themes-in-ProPresenter)
- [NLT Bible Notices - thebible.org](https://thebible.org/gt/notices/nlt.html) / [StudyLight.org NLT copyright statement](https://www.studylight.org/site-resources/copyright-statements/eng/nlt.html)
- [firebase-js-sdk#6803](https://github.com/firebase/firebase-js-sdk/issues/6803)
- [Natural sort order - Wikipedia](https://en.wikipedia.org/wiki/Natural_sort_order); [Coding Horror - Sorting for Humans](https://blog.codinghorror.com/sorting-for-humans-natural-sort-order/)

### Tertiary (LOW confidence, needs validation)
- Direct `WebFetch` of `https://api.nlt.to/api/passages` (single manual sample, not full spec)
- Google Fonts OFL/Apache licensing terms (multiple secondary sources)
- Inter vs. Helvetica Neue metric-compatibility comparison (secondary comparison sites)
- Congregational-reading UX precedent (subtitle-editor analogy - no direct church-software comparable found)

---
*Research completed: 2026-08-06*
*Ready for roadmap: yes*
