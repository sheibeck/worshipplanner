# Project Research Summary

**Project:** WorshipPlanner
**Domain:** Multi-tenant Vue 3 + Firebase worship-planning SPA — v2.2 Configurability, Hardening & Cleanup
**Researched:** 2026-08-23
**Confidence:** HIGH

## Executive Summary

v2.2 is integration work on a mature, already-conventioned codebase, not new-product work. All six milestone items — configurable per-org Teams, a generalized per-team song-tag filter, dropping a Berean-specific ordinal-Sunday auto-select rule, firestore.rules hardening (inviteLookup create gate + createdBy immutability), deleteService share-token revocation, an Owner Console a11y retrofit, and the Resend verified-sending-domain migration — each has a working precedent already in the repo to copy rather than a pattern to invent. Five of six need zero new dependencies; the sixth (a11y) needs exactly one dev-only lint plugin (eslint-plugin-vuejs-accessibility). Only one of the five architectural changes touches firestore.rules, and it is a narrow, mirrorable allow create clause — everything else is client-only.

The recommended approach is: dedupe first (the team-list literals still duplicated in ServiceEditorView.vue/NewServiceDialog.vue, and VW_TYPE_LABELS, which turned out to already be deduped — verify before "fixing" it), then build Configurable Teams as a teams subcollection modeled exactly on the existing roles subcollection (not an OrgSettings array field — that would fork the read pattern across two call sites and reintroduce drift), then land the independent hardening/hygiene items (rules gate, createdBy guard, share-token revocation) in parallel since none of them depend on Teams or each other, then close with the Owner Console a11y pass and the Resend domain-verification runbook (the latter is owner-run DNS ops, not a coding task the app can complete or self-verify).

The main risks are all "looks done but isn't" traps rather than unknowns: porting deleteQuarter's single-token revocation shape onto deleteService naively misses that a service can accumulate multiple shareTokens docs across re-shares, so a query-based delete-all is required, not a single-doc lookup; the inviteLookup rules tightening needs a companion regression test proving first-login invite acceptance still works, not just a new DENY case, because the "obviously safe" narrowing has three distinct write/read actors and only one is the target of the fix; and the Owner Console tab strips deliberately use v-show (never v-if) to keep an onSnapshot roster listener alive across tab switches — a generic ARIA-tabs retrofit copied from a tutorial commonly swaps that to conditional rendering and silently kills the listener. Each of these is well-understood and cheaply avoided once named, which is why overall confidence is HIGH rather than the usual "hardening work is risky" caveat.

## Key Findings

### Recommended Stack

No new core technology. The only new dependency for the whole milestone is eslint-plugin-vuejs-accessibility@^2.6.0 (dev-only, flat-config compatible with the installed eslint@^10.0.2, drops into the existing eslint.config.ts with no config-format migration) — a static linter chosen over vue-axe/@axe-core/playwright because the known a11y defects (placeholder-only inputs, missing tab ARIA) are static-template issues a linter catches, and the project has no Playwright/E2E harness to justify a runtime tool. The Resend verified-domain item needs no SDK change at all — it is 100% Resend-dashboard + DNS configuration plus flipping two already-wired, already-owner-editable config values (appConfig/global.sender.fromAddress, live no-redeploy; SERVICE_SHARE_BASE_URL, a defineString param requiring firebase deploy --only functions only if the owner wants share links on the new domain too).

**Core technologies (all already installed, reused as-is):**
- Firebase client SDK (^12.0.0) + firebase-admin/firebase-functions — Firestore schema extension + Cloud Functions cascade-delete pattern reuse, no new integration
- resend (6.19.0, optional bump to 6.22.0) — already the chosen provider (v1.7 ADR); this milestone is domain verification, not an API change
- Vue 3 + Pinia + Vue Router — ordinary composition-API work for the Teams editor, song-browse extraction, and a11y retrofit

### Expected Features

**Must have (table stakes) — all P1, all scoped for v2.2:**
- Per-org editable Team list (add/edit/delete, seeded defaults), modeled exactly on the existing RolesConfigPanel.vue/roster.ts pattern — an inconsistent exception here would be more surprising than building it
- Single source of truth for the team list, collapsing the ServiceEditorView.vue:1675 / NewServiceDialog.vue:145 duplication — a precondition, not optional polish
- Per-team song-tag filter as an optional field on the Team row (generalizes the hard-coded Orchestra-to-Orchestra-tag rule)
- Dropping the ordinal-Sunday auto-team-preselect rule entirely (once Teams are user-editable, manual selection already exists as the replacement — no new UI needed)
- deleteService revokes all of a service's shareTokens/serviceShareLinks/serviceShares docs, mirroring deleteQuarter's already-shipped cascade
- EditSlideDrawer.vue gains renderState awareness (warn/disable customization while a PPTX-render slide is pending) to close a known silent-data-loss gap
- Real label/aria-label on Owner Console + new Teams-editor inputs, and role=tablist/aria-selected ARIA-tabs semantics on both the Owner Console and Service Editor tab strips (named, already-scored a11y debt from Phase 72/74 reviews)

**Should have (differentiators):** the per-team song-tag filter generalized beyond the single Orchestra rule (the actual payoff of this milestone — lets a second church define its own team/song-pool rule with no code change); a disable-and-explain (not just warn) pending-render guard, which signals more maturity than either "block editing entirely" or "allow silent loss."

**Explicitly defer / drop, not build (anti-features named by both FEATURES.md and SEED-002):**
- Making the ordinal-Sunday rule configurable instead of dropping it — a disproportionate mini-recurrence-rule editor to save Berean two clicks a month, meaningless to every other church
- A fully generic boolean-expression "rule builder" for per-team filters — the observed need is a single-tag filter; build that, not a speculative general case
- Configurable VW_TYPE_LABELS / org-editable Vertical Worship taxonomy labels — platform-scope concept, not a per-org one; only real defect here was duplication (see Gaps below — already resolved)
- A grace window / soft-delete TTL on revoked share links — contradicts the security intent of immediate revocation and mirrors the no-grace-period posture already used for org deactivation
- A generic "disable inputs during any pending async job" framework — solve the one concrete case (EditSlideDrawer.vue + renderState) narrowly; generalize only if a second case appears

### Architecture Approach

Every one of the five architectural changes slots into an existing pattern: (1) a new organizations/{orgId}/teams subcollection, structurally identical to the existing roles subcollection (seed-defaults-if-empty, per-row CRUD store, no dedicated firestore.rules block needed — it falls through the same generic per-org wildcard roles already uses); (2) one firestore.rules clause on inviteLookup's allow create, mirroring the exact orgSlugs/orgNames/shareTokens idiom (isOrgEditor(request.resource.data.orgId)) already deployed three times; (3) a client-side cascade-delete in deleteService copying deleteQuarter's shape, adapted for services' query-based (not single-field) share-token cardinality; (4) a narrow read-only renderState check added to EditSlideDrawer.vue; (5) a VW_TYPE_LABELS dedup that turns out to already be done (verify, don't re-implement).

**Major components:**
1. src/types/team.ts + stores/teams.ts (NEW) — Team shape, DEFAULT_TEAMS seed, CRUD + seedDefaultTeamsIfEmpty(), structural copy of roster.ts
2. Settings "Teams" panel (NEW, mirrors RosterView.vue's Roles editor) — CRUD UI for name + optional song-tag filter + optional free-text-name flag
3. ServiceEditorView.vue / NewServiceDialog.vue / ServiceCard.vue (MODIFIED) — read teamsStore.teams instead of local hard-coded arrays; delete sundayOrdinal() and its call sites
4. firestore.rules inviteLookup block (MODIFIED) — narrowed allow create, read/delete untouched
5. stores/services.ts deleteService (MODIFIED) — query-based multi-doc share-token revocation before deleting the service doc

### Critical Pitfalls

1. SEED-002's catalog is partially stale — it claims VW_TYPE_LABELS is duplicated in "6+ files"; a direct grep shows it is already down to one source file with one consumer. Re-verify every SEED-002 file/line claim by grep before scoping a phase off it; the team-list duplication (2 files) and the a11y tab-strip debt are still live and confirmed.
2. deleteService share-token revocation must be query-based, not single-doc — unlike deleteQuarter (one shareToken field), a service can accumulate multiple shareTokens docs across re-shares (pickAdoptableToken already queries where serviceId equals the service id for this reason). Porting deleteQuarter's single-reference lookup verbatim orphans older tokens, leaving a deleted service's data publicly viewable via a stale link — a real data-exposure bug, not cosmetic debt.
3. inviteLookup tightening needs a regression test, not just a DENY case — the collection has three distinct actors (client create via TeamView.vue, client read+delete at first login via ensureUserDocument, Admin-SDK create via orgProvisioning.ts which bypasses rules entirely). Ship ALLOW (editor-of-target-org create), DENY (non-editor/wrong-org create), AND a third test proving the existing first-login invite-acceptance read+delete path is unaffected.
4. createdBy is still unprotected post-v2.1 — preservesLifecycleFields() guards exactly 5 fields (active/deactivatedAt/deactivatedBy/reactivatedAt/reactivatedBy); createdBy was never added despite PROJECT.md flagging it as "needs re-verification since v2.1." Fix by extending the same diff().affectedKeys() pattern, verified by quoting the literal current field array, not the v2.1 changelog narrative.
5. A11y retrofit must not swap v-show for conditional rendering — OwnerConsoleView.vue deliberately keeps panels always-mounted (v-show) so a roster onSnapshot listener survives tab switches; generic ARIA-tabs tutorials commonly bundle a switch to v-if/unmount semantics that would silently kill that listener. Add ARIA attributes without changing mount/hide mechanics, and verify the listener is still firing after the change.
6. Team-list backfill must follow the subcollection (roles) pattern, not the OrgSettings array pattern — SEED-002 explicitly specifies "model exactly like DEFAULT_ROLES." Bolting teams onto OrgSettings as an array would fork the merge logic across the two still-hard-coded read sites and require both to be repointed to the exact same merged value in the same commit — miss one and the 2-copy drift this feature exists to kill reappears.

## Implications for Roadmap

Based on combined research, suggested phase structure (5 phases, largely parallelizable after phase 1):

### Phase 1: Dedup and Configurable Teams (A1 + A2 + B1)
Rationale: SEED-002, FEATURES.md, and ARCHITECTURE.md all treat de-dup as a hard prerequisite — building config against one copy of the team-list literal while the other stays hard-coded reintroduces the exact drift this milestone exists to fix. B1 (dropping the ordinal rule) is only a safe UX change once A1 gives users an editable list to select from manually, so it must land in the same phase, sequenced after A1's store/UI exist.
Delivers: src/types/team.ts + stores/teams.ts (seeded subcollection, mirrors roster.ts), Settings Teams panel, both ServiceEditorView.vue/NewServiceDialog.vue repointed to the single store, per-team songTagFilter field replacing the hard-coded Orchestra rule, sundayOrdinal() and its call sites deleted with NewServiceDialog.test.ts updated to assert the deliberate new default-team behavior (not gutted).
Addresses: Table-stakes per-org Team list, per-row Save/delete-confirm UX, the milestone's stated differentiator (generalized song-tag filter), and the B1 anti-feature cut.
Avoids: Pitfall 1 (stale seed numbers — re-grep first), Pitfall 2 (backfill pattern choice + read-site repoint), Pitfall 3 (test-gutting on B1 removal).

### Phase 2: Security and Data-Integrity Hardening (rules)
Rationale: Independent of Teams; both sub-items are organizations-collection rule tightenings that belong in one rules-review pass sharing the same test file. Small, narrow, and mirrors an idiom (allow create if isOrgEditor) already deployed three times elsewhere.
Delivers: inviteLookup create gate narrowed to the target org's editor (ALLOW/DENY/regression-test triad); createdBy added to an immutable-fields guard extending preservesLifecycleFields()'s pattern.
Uses: Existing @firebase/rules-unit-testing harness (src/rules.test.ts, run via npm run test:rules).
Implements: ARCHITECTURE.md Pattern 2 (create-only idiom mirror).
Ships: Built + tested + UNDEPLOYED, per standing project deploy discipline — hand the owner the exact firebase deploy --only firestore:rules command.

### Phase 3: deleteService Share-Token Revocation
Rationale: Independent of Teams and rules hardening; a client-only store change with zero rules impact (existing allow delete already permits it).
Delivers: deleteService queries and deletes ALL shareTokens docs matching serviceId (not a single-field lookup), plus serviceShareLinks/{serviceId} and the deterministic serviceShares/{slug}__service-{date} doc, ordered before the service doc delete itself.
Uses: ARCHITECTURE.md Pattern 3 (cascade revocation), adapted per Pitfall 6 for services' multi-token cardinality.
Implements: A unit test seeding 2+ shareTokens docs for one serviceId (simulating re-share) asserting all are removed.

### Phase 4: Pending-Render Edit Guard
Rationale: Smallest, most isolated change; independent of everything else in the milestone.
Delivers: EditSlideDrawer.vue reads the already-existing renderState field and disables/warns on customization of a slide whose render is still pending, closing a known silent-data-loss gap (previously ruled out as fixable by index-pairing).
Uses: No new data flow — a read of an existing field already streamed to the drawer.

### Phase 5: Owner Console A11y Retrofit and Resend Domain Verification
Rationale: Both are cross-cutting, dependency-free polish/ops items that can land in any order relative to the rest; grouping them keeps the "closing-out" phase focused on debt and owner-facing runbook items rather than new capability.
Delivers: eslint-plugin-vuejs-accessibility added to eslint.config.ts; real label/aria-label on Owner Console (super-admin grant, Organizations onboard/assign) and the new Teams-editor inputs; role=tablist/role=tab/aria-selected/aria-controls added to BOTH OwnerConsoleView.vue and ServiceEditorView.vue tab strips without changing v-show mount semantics; a documented manual runbook for Resend domain verification (owner adds a controlled domain plus SPF/DKIM/DMARC/MX records, verifies fully in Resend's dashboard, only then flips appConfig/global.sender.fromAddress, then sends a real test message to a real external inbox).
Avoids: Pitfall 5/8 (a11y retrofit must not swap v-show to v-if, must cover both tab strips in one pass, must not desync ARIA state from the existing route-query tab sync); Pitfall 7 (Resend: never a web.app domain, never flip the config before DNS shows fully Verified).

### Phase Ordering Rationale

- Phase 1 must come first only because its new Settings panel is a natural place to also confirm/import the already-deduped VW_TYPE_LABELS if the panel surfaces VW-related copy, and because it establishes the teams subcollection every later reference to "team" (a11y retrofit of the Teams editor's own inputs) builds on.
- Phases 2, 3, and 4 have no cross-dependencies and can be planned/executed in parallel — ARCHITECTURE.md's Build Order confirms this explicitly ("Steps 2-5 have no cross-dependencies on each other and can be sequenced in any order or built in parallel").
- Phase 5 is scheduled last only for narrative/cleanup reasons (it's genuinely dependency-free); the a11y half could equally run first or in parallel — the Resend half is gated on owner DNS action outside the app's control regardless of phase order, so scheduling it doesn't block or accelerate anything else.
- Only Phase 2 touches firestore.rules; it is deliberately isolated so its owner deploy-hand-over doesn't gate any other phase's completion.

### Research Flags

Phases likely needing deeper research during planning:
- None flagged as needing a dedicated --research-phase pass — every item in every phase already has a direct, cited in-repo precedent (roles subcollection, deleteQuarter, orgSlugs rules idiom, preservesLifecycleFields()), and the one external-ops item (Resend domain verification) has vendor-doc-sourced HIGH-confidence steps already captured in STACK.md/PITFALLS.md.

Phases with standard, well-documented patterns (skip research-phase):
- Phase 1 (Teams): Direct structural copy of RolesConfigPanel.vue/roster.ts — the pattern is proven and already shipped in this codebase.
- Phase 2 (Rules hardening): Direct structural copy of the orgSlugs/orgNames/shareTokens create-gate idiom and the preservesLifecycleFields() immutable-field idiom, both already deployed and tested elsewhere in firestore.rules.
- Phase 3 (deleteService revocation): Direct structural copy of deleteQuarter, adapted per the one documented cardinality difference (query vs single-field) already fully specified in ARCHITECTURE.md's Data Flow section.
- Phase 4 (Pending-render guard): A single-field read in one component; PENDING-VERIFICATION.md already rejected the one plausible alternative approach (index-pairing), so the direction is settled.
- Phase 5 (a11y and Resend): The a11y rule set is the standard W3C ARIA APG Tabs pattern plus WCAG 1.3.1/4.1.2, and Resend's verification steps are sourced directly from Resend's own current dashboard docs — both are stable, well-established external references, not areas of genuine uncertainty for this codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 5 of 6 items are "use what's already installed," verified by direct repo/package.json inspection; the one new dependency's peer-compatibility was verified via npm view; Resend steps sourced from Resend's own current docs |
| Features | HIGH | Cross-checked against this codebase's own RolesConfigPanel.vue/roster.ts precedent and PENDING-VERIFICATION.md C4/C5, not speculative industry patterns |
| Architecture | HIGH | Every recommendation is grounded in direct source reads of the exact files/lines involved (firestore.rules, stores/quarters.ts, stores/services.ts, roster.ts), not inference |
| Pitfalls | HIGH | Every finding traced against current firestore.rules, functions/src/index.ts, and the relevant stores/views — one seed-catalog claim (VW_TYPE_LABELS count) was explicitly caught as stale and corrected rather than repeated |

Overall confidence: HIGH

### Gaps to Address

- VW_TYPE_LABELS de-dup status: SEED-002 claims 6+ duplicate files; direct grep as of 2026-08-23 shows exactly one source file and one consumer. Treat this item as already resolved — do NOT schedule work for it — but re-confirm with a fresh grep at phase-plan time in case anything has changed since this research pass, per Pitfall 1's general caution about trusting seed numbers unverified.
- Team-list backfill seed-race: seedDefaultRolesIfEmpty() (the precedent Teams will copy) has a known, never-fixed double-seed race if two editors open a brand-new org simultaneously. Decide explicitly during Phase 1 planning whether to accept this low-blast-radius race as-is (matching roles) or close it with an existence-check-then-batch-write — either is acceptable, but the decision must be made deliberately and documented, not defaulted silently.
- Ordinal-rule replacement UX: Dropping B1 needs an explicit decision (not left implicit) on what a new-service dialog defaults teams to afterward — no pre-selection at all, or the org's own saved default from A1. Surface this as a discussion-phase question, not something the phase plan should assume.
- Resend verification is unverifiable from inside the app: there is no automated check the app can perform to confirm DNS records are propagated/verified before a send is attempted; the phase deliverable is necessarily a documented manual runbook plus optional warning copy, not an automated guarantee. Flag this to the owner explicitly as an operational dependency outside the coding phase's control.

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: firestore.rules, src/stores/roster.ts, src/stores/quarters.ts, src/stores/services.ts, src/views/ServiceEditorView.vue, src/components/NewServiceDialog.vue, src/views/OwnerConsoleView.vue, src/views/TeamView.vue, src/types/organization.ts, src/types/song.ts, src/components/slides/EditSlideDrawer.vue, src/types/slide.ts, functions/src/index.ts, functions/src/appConfig.ts, functions/src/orgProvisioning.ts, functions/src/orgTemplateSeed.ts, package.json, functions/package.json, eslint.config.ts — verified 2026-08-23
- npm view eslint-plugin-vuejs-accessibility peerDependencies, npm view resend version — npm registry ground truth, verified 2026-08-23
- Resend's own current docs: resend.com/docs/dashboard/domains/introduction, resend.com/docs/dashboard/domains/dmarc — fetched 2026-08-23
- .planning/PROJECT.md, .planning/PENDING-VERIFICATION.md (C2/C4/C5), .planning/seeds/SEED-002-church-specific-rules-configurability.md — this project's own planning record
- W3C ARIA Authoring Practices Guide (Tabs pattern), WCAG 2.1 SC 1.3.1 / 4.1.2 — stable, standard web-accessibility references

### Secondary (MEDIUM confidence)
- Third-party corroboration of Resend's SPF/DKIM/MX/DMARC record shape (dmarcdkim.com, dmarc.wiki/resend, phishfence.io) — used only to corroborate vendor docs, not as primary source
- eslint-plugin-vuejs-accessibility project docs site (vue-a11y.github.io) — corroborated directly by the npm peerDependencies field

### Tertiary (LOW confidence)
- None — no findings in this milestone's research rest on a single unverified source; the one instance of a stale secondary claim (SEED-002's VW_TYPE_LABELS file count) was caught and corrected against a direct primary-source grep rather than carried forward.

---
Research completed: 2026-08-23
Ready for roadmap: yes
