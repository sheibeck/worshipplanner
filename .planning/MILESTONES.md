# Milestones

## v2.9 Live Presentation Field Fixes (Shipped: 2026-09-04)

**Phases completed:** 3 phases, 11 plans, 25 tasks

**Key accomplishments:**

- Reworked the pure `monitorConfig.ts` persistence module — v2 fingerprint identity that drops the macOS-volatile `left`/`top`/`isPrimary` fields, a delta-aware `matchMapping` that keeps matched assignments instead of wiping the whole mapping, per-monitor nicknames, and a v1→v2 storage-key bump.
- Generalized Run mode's output-window launch from two hard-coded `wp-audience`/`wp-confidence` windows to an N-assignment model keyed by fingerprint, with a `>=1-Audience` go-live gate and dynamic Displays/Preflight panels.
- Popup-side `requestFullscreen({ screen })` in `useOutputWindow.ts` — each output window re-resolves its own live screens, matches the assigned display by fingerprint, and requests fullscreen directly on it, additively layered over the existing plain fullscreen + manual fallback.
- Built the framework-light auto-fit engine every R329 render site will share: a pure, binary-searched text-fit function (`computeFitScale`) plus its ResizeObserver composable (`useSlideAutoFit`), and a geometric "contain" scaler (`computeContainScale` / `useContainScale`) for the canonical 1280x720 stage. No consumers wired yet — this is the highest-leverage, lowest-risk piece that unblocks the SlideCanvas + output-view integration in Plan 03.
- Made the live Run/control screen readable at a glance: the On-screen (program) preview pane no longer dominates the layout (moved from a 2/3-share 3-column grid to an even 2-column split with Next-up), the in-item filmstrip thumbnails are 1.5x larger (w-32→w-48) while staying WYSIWYG via the same reference-stage scaling, the filmstrip always ends with a cap naming the next service item (or end-of-service), and the filmstrip's horizontal scrollbar is forced always-visible with a subtle edge fade so it survives macOS's overlay auto-hide.
- Wired 115-01's measure-and-fit engine into SlideCanvas and both output windows: per-slide text now auto-scales against a canonical 1280x720 frame (grow-to-fill, shrink-to-avoid-overflow, capped), and Audience/Confidence render on that same canonical stage via useContainScale — so the fit computed once is pixel-identical across the projector, the band monitor, and the Run-screen previews (WYSIWYG). The Confidence next-pane's fixed `scale(0.8)` hack is gone, replaced by a properly contain-scaled mini stage.
- Migrated SlideCard.vue and EditSlideDrawer.vue off the discrete `--slide-font-scale` multiplier to a fixed 13px base, removing the last two non-SlideCanvas readers of that variable so Plan 05 can delete it cleanly.
- Removed the discrete `--slide-font-scale` sm/md/lg multiplier end to end — `SCALE_MAP`, the `fontScale` field, the Settings Size radios, and every test mock that spelled it out — completing R329's auto-fit-owns-text-size decision now that every render site (SlideCanvas/output in Plan 03, editor surfaces in Plan 04) had already migrated off it.
- Read-only slide-viewer badge now names the song and opens the lyric editor in a new tab (leaving the viewer in place); the song editor header gained a SongSelect deep link and its dismiss button now reads "Close" instead of "Cancel".
- SongLyricEditor's copyright block now has an inline "Edit credits" form covering all 5 CCLI fields (works from empty), its read-only display gate widened to any non-empty field, and the History toggle/panel are hidden (not deleted) from the editor UI.

---

## v2.8 Production Hardening: Comments-as-Specs, Architecture & Security Review (Shipped: 2026-09-02)

**Phases completed:** 6 phases, 19 plans, 38 tasks

**Key accomplishments:**

- Grep-first triage inventory of all 696 load-bearing comments across the runtime codebase, classified into Decision-Rationale (382, ready for ADR extraction in 108-02), Behavioral/Architectural (309, handed off to Phase 109), and Genuinely-Local (5) buckets, with a Tag Collision Index warning that this codebase's WR-/CR- tags are per-file labels, not a global namespace.
- Extracted 382 tagged decision-rationale comments into 244 MADR-lite ADRs under `docs/adr/`, then shrank 381 of them across 93 source files to `// See ADR-NNNN (...)` pointers — comment-only, zero behavior change, verified by a clean type-check plus unchanged app/render-service/rules test baselines.
- Wrote the durable "Comment Convention" section in CONVENTIONS.md (short inline comments; rationale in ADRs; behavior/architecture in `.planning/codebase/` map docs; two documented pointer forms) plus a one-line CLAUDE.md pointer, satisfying R319.
- Relocated 76 backend "how it works" comments from functions/src/
- Relocated all 80 Bucket-B "how it works" comment entries from the 34 src/utils/
- Relocated all 85 in-scope Bucket B "how it works" comments from `src/components/
- 1. [Rule 1 - Bug] Two ServiceEditorView.vue handoff entries missed on first content-search pass
- Traced every org-scoped Pinia store's `onSnapshot`
- Spot-checked `.planning/codebase/ARCHITECTURE.md`'s documented
- Merged 24 named findings from the two Phase 110 review passes into one 23-ID, severity-ranked report (`110-ARCHITECTURE-REVIEW.md`) with exactly one High finding scoped to Phase 111 and 22 Medium/Low findings triaged to backlog.
- Closed the sole High architectural finding (ARCH-001) with a store-layer epoch guard in auth.ts's `loadOrgContext` plus a matching UI in-flight guard on AppShell.vue's exit button, both proven by a regression test and a full no-regression gate (type-check + app-suite baseline + render-service 39/39).
- Consolidated all 22 Medium/Low architectural findings (ARCH-002..023) into one Phase 999.4 backlog entry in ROADMAP.md, pointing at the Phase 110 report for full detail instead of creating 22 near-empty stubs.
- Reviewed firestore.rules/storage.rules and multi-tenant isolation grounded in a live 200/200-passing Firestore rules-emulator run; found a legacy client-side org self-provisioning bypass (High) and a member-removal Storage-claim revocation gap (High), plus one Medium provenance-forgery gap and three Low/informational notes.
- Static security review of auth.ts custom-claims, router guards, and every Cloud Functions handler's server-side authz — surfaced an unauthenticated `/api/planningcenter` proxy route, and used live `firebase functions:list` evidence to overturn Phase 110's stale "undeployed provisioning functions" premise while independently re-scoring the super-admin universal-grant residual (ARCH-018) as a genuine Medium finding.
- Live Firestore-emulator probe proves `shareTokens`/`quarterShares`/`serviceShares` are fully LISTABLE (not just gettable) via `allow read: if true`, exposing every organization's shared service plans and volunteer names cross-tenant with no token needed — the review's single Critical finding, plus 4 Medium/Low share/PII findings and 6 cost/abuse findings (2 Medium, 4 confirmed-sound-or-Low), all written to `112-FINDINGS-sharetoken-pii-abuse.md`.
- Consolidated three per-dimension findings files (rules-isolation, auth-functions, sharetoken-pii-abuse) into the single 112-SECURITY-REVIEW.md, surfacing 1 Critical + 2 High findings as Phase 113's exact remediation scope, with 11 Medium/Low findings routed to backlog.
- 3/3 (Task 3 verification + this summary finished by the orchestrator after the executor
- Added `getAuth().revokeRefreshTokens(uid)` to `syncOrgMembershipClaimHandler`'s clear branch, closing the ~55-minute stale-token Storage authz window on member removal, with a functions unit test proving it fires and a Storage ALLOW-case proving scoped blast radius.
- Consolidated all 11 Medium/Low Phase 112 security findings into one new ### Phase 999.5 ROADMAP.md backlog entry, pointing to 112-SECURITY-REVIEW.md for full detail — no code changed, nothing deployed.

---

## v2.7 Rehearsal, Stage Plans & Presentation Polish (Shipped: 2026-09-01)

**Phases completed:** 4 phases (104–107), 10 plans

**Audit:** [v2.7-MILESTONE-AUDIT.md](v2.7-MILESTONE-AUDIT.md) — PASSED (14/14 reqs, 6/6 integration seams
WIRED).

**Deployed to production 2026-09-01** (hosting only — client-side changes, no rules/functions; predeploy
rebuilt `dist/`; tag `v2.7`). Closed on owner acceptance. Built via `/gsd-autonomous` with per-phase
verification deferred to a batched end pass, then extensively refined interactively before ship. The
batched human/visual UAT (`.planning/v2.7-DEFERRED-VERIFICATION.md`) was performed manually by the owner
on 2026-09-01 and all three phases PASSED — a verified closeout.

**Key accomplishments:**

- **Phase 104 — Notification & Multi-Church Foundations (R309–R312):** a system-wide dismissible
  notification store (`toasts.ts`/`ToastHost` at `App.vue`) replacing stuck banners, the "monitors not
  configured" warning made state-driven, and a user-menu church switcher (`selectOrg` +
  `resetOrgScopedStores`, distinct from super-admin enter-any-church). Code review caught a Critical R312
  org-scoped listener leak in `TeamView`/`GettingStarted` — fixed with reactive re-subscription.

- **Phase 105 — Blackout & Inline Black Slide (R302–R305):** an additive `LyricSection.kind` blackout
  slide (excluded from numbering), solid-black render on every surface, and "Go to black" scoped to the
  Audience output only.

- **Phase 106 — Per-Item Loop (R306–R308):** `slot.loop {enabled,intervalSeconds}` (default 10s,
  preset+custom) driven from `useRunControl.postIndex`'s single writer; go-to-black pauses the loop.

- **Phase 107 — Visual Stage Layout (R313–R315):** an additive `Service.stageLayout` field (no new
  collection/rules/store) with a native-Pointer-Events drag canvas + draft-locked Stage Layout tab, and a
  read-only render on the public share snapshot + print.

- **Post-audit interactive polish (same milestone/tag):** the Stage Layout was redesigned to the owner's
  imported "Nocturne" design (single-room diagram, palette, icon-tile markers, inspector slide-over);
  Instruments mirror the org's Band roles with person "Name - Role" assignment + notes + "+ Vocal";
  stage share/print split out (landscape `?view=stage` + landscape B&W "Print for tech"); loop authoring
  relocated to the Slide editor (MISC/Announcement-only); and button-area consistency (Run primary in the
  cluster, Present→"Review Slides", Save rightmost + dropped from Slides, save-status into the header).

- **A WYSIWYG stage bug was diagnosed in the running app** (via browser inspection): Tailwind v4's
  `-translate-x/y-1/2` emits the CSS `translate` property, which stacked with the editor's inline
  `transform` translate and drew markers half a tile too far left only while editing — fixed with a single
  inline-transform centering + a hard-coded room size so editing/locked/share/print render identically.

- Full suite = only the two documented baselines fail (`storage.rules.test.ts`, stale `appConfig.test.ts`);
  type-check clean.

## v2.6 Per-Org Bible API Toggle & Manual Fallback (Shipped: 2026-08-31)

**Phases completed:** 3 phases (101–103), 6 plans

**Audit:** [v2.6-MILESTONE-AUDIT.md](v2.6-MILESTONE-AUDIT.md) — PASSED (7/7 reqs, 5/5 integration seams
WIRED).

**Deployed to production 2026-08-31** (rules + `functions:api`/`setOrgBibleEnabled`/`listOrganizations` +
hosting; tag `v2.6`). Closed on owner acceptance; human/visual UAT was deferred and batched into
`.planning/v2.6-DEFERRED-UAT.md` per explicit owner instruction for this autonomous run.

**Key accomplishments:**

- **Phase 101 — Owner Console Infrastructure:** a super-admin-gated `setOrgBibleEnabled` Cloud Function
  writes a new `Organization.bibleApiEnabled` master field (mirroring `setOrgAiEnabled`/`aiMasterEnabled`),
  client-write-denied in `firestore.rules`, defaulting every org (including Berean) to OFF with no data
  migration; an `authStore` mirror plus an `OrgConfigDrawer` checkbox and an at-a-glance Organizations-list
  badge surface the state.

- **Phase 102 — Gated Scripture Fetch Dispatcher:** a new `src/utils/scriptureApi.ts` choke point (the
  `isAiEnabled()` analog) replaced the previously split direct calls to `esvApi.ts`/`nltApi.ts` from
  `ScriptureInput.vue` and `CongregationalEditor.vue`, with an independent server-side
  `checkOrgBibleEnablement` gate added to the `api` proxy's `esv`/`nlt` branches as defense-in-depth — zero
  regression for an enabled org.

- **Phase 103 — Manual Fallback When Off:** an "Open in BibleGateway" deep-link (any version, reusing the
  existing `scripture.ts` link builder) and Settings' "Bible Translation" card hidden when the API is off,
  mirroring the AI Features card. **Owner refinement post-Phase-103 (2026-08-31):** the originally-built
  standalone paste-the-passage textarea and off-state message were removed — a plain scripture slide is
  reference-only (deep-link only) when off, and a congregational reading is composed directly in the
  existing bottom reading/format textarea, with the LLM split still operating on that text under the
  independent AI gate.

- **Two code-review rounds caught and fixed real defects before ship:** Phase 102's review caught a live
  gate bypass in `planningCenterApi.ts`'s scripture-push branch (a Planning-Center-export path reaching
  ESV/NLT without the new per-org gate); Phase 103's review caught two fallback data-loss bugs — pasted
  text silently erased by a reference edit or the still-visible Preview button, and paste-box keystrokes
  clobbering an AI split or a manual edit.

- Milestone audit independently re-ran all three test/type gates (type-check clean; app suite 175/177
  files with only the two pre-existing baseline failures; functions suite 636/636) and traced the full
  toggle → dispatcher gate → fallback UI path end to end against live source — PASSED 7/7 requirements,
  5/5 integration seams WIRED, zero blocking gaps.

**Standing owner follow-up:** because the default is OFF, each production org — including Berean — must
be explicitly enabled for the Bible API via the Owner Console, or that org's ESV/NLT auto-fetch stops
working and it falls back to the manual/BibleGateway path.

---

## v2.5 Invite Email & Non-Google Onboarding (Shipped: 2026-08-31)

**Phases completed:** 2 phases, 3 plans, 3 tasks

**Key accomplishments:**

- TeamView.onInvite now calls Phase 99's sendInviteOnboardingEmail callable (best-effort, after the authoritative Firestore batch commit) with honest three-state copy, and LoginView gains an actionable auth/operation-not-allowed message plus an invitee discoverability hint.

---

## v2.3 Scheduling Accuracy & Song/Team Refinements (Shipped: 2026-08-27)

**Phases completed:** 6 phases, 11 plans, 28 tasks

**Key accomplishments:**

- Fixed `lastUsedAt` to derive from `MAX(service.date)` over a song's LOCKED (non-draft) services via a new canonical, firebase/vue-free `src/utils/lastUsed.ts` helper, wired into `services.ts`'s lock/unlock lifecycle — removing the old `serverTimestamp()` stamp on draft assignment that caused the reported "His Mercy Is More showed Aug 11 for a Sep 6 locked service" bug.
- One-time, owner-run Admin-SDK Node script (`functions/src/backfillLastUsed.ts`) that retroactively corrects `lastUsedAt` for the single production org, writing `MAX(locked service date)` only for songs that have at least one locked service and never touching any other song — mirroring `computeLastUsedDate`/`serviceDateToMillis` byte-identical from the 84-01 canonical helper so the live path and the backfill can never disagree.
- Narrowed RoleGroup to band/tech/other, rewrote the shared evaluateGroupCombo rule (Band<->Tech exclusive, Other combines freely, ≤1 Band instrument with Vocals exempt), and added a read-time-only compat shim for legacy vocals data.
- Optional `Team.recurrence` field + pure UTC-stable `teamMatchesDate` helper, wired into NewServiceDialog so picking/changing the Service Date pre-checks every team whose configured Nth-Sunday pattern matches — fully overridable, never clobbering manual choices, and never applied to existing services.
- `TeamRecurrenceSlideOver.vue` — a Teleported right-drawer mirroring `SongSlideOver.vue`'s shell — plus a per-row `>` chevron on the Volunteer → Teams tab, letting a planner multi-select 1st–5th Sunday ordinals (or clear to none) and persist via `teamsStore.updateTeam(id, { recurrence })`, with the saved pattern round-tripping on reopen.
- Editable song Key bound to the primary/first arrangement, Scripture rotation excluding the sermon passage, and verified-accurate schedulable-roles copy — closing R249, R253, R256.
- Song Key field in SongSlideOver is now a native `<input list>`+`<datalist>` typeahead over a shared 14-key constant, with free entry still accepted; ArrangementAccordion consumes the same constant instead of an inline literal.
- Two new standalone slide-over editors — RoleSlideOver and TeamSlideOver — mirror SongSlideOver's drawer shell for create/edit/delete, with TeamSlideOver absorbing the Phase-86 recurrence multi-select into one drawer and preserving both the WR-01 duplicate-name guard and the WR-02 rename soft-warn.
- Roles and Teams tabs now match the Songs editing pattern — RolesConfigPanel and TeamsConfigPanel are pure read-only row presenters emitting `edit`/`add`, RosterView owns the selection state and mounts Plan-02's RoleSlideOver/TeamSlideOver, and the now-absorbed TeamRecurrenceSlideOver.vue is deleted.
- Renamed Role.vocal to a general per-role multiRole flag, rewrote evaluateGroupCombo to filter multi-role roles out before applying the Band/Tech/cap rule (making cross-type co-occurrence, e.g. vocalist + sound, now legal), and generalized the RoleSlideOver control to any group with owner helper text — all with a read-time-only legacy compat shim, no data migration.
- Added a non-recursive `propagateMultiRole` pass to `proposeQuarterSchedule`, mirroring `propagatePairing`, so a person's multi-role assignments (e.g. bass + vocals + lead) co-schedule onto the same date — anchored on their rarest role for free via the existing `withinCadence` even-spread gate, with no rarity sort or scoring change.

---

## v2.2 Configurability, Hardening & Cleanup (Shipped: 2026-08-25)

**Phases completed:** 5 phases, 13 plans, 35 tasks

**Key accomplishments:**

- Per-org `teams` Firestore subcollection + `useTeamsStore()` Pinia store, mirroring `roster.ts`'s roles half exactly, with an idempotent 4-team default seed and church-switch teardown registration
- New accessible-from-the-start Teams tab in RosterView.vue — TeamsConfigPanel.vue mirrors RolesConfigPanel.vue's draft+Save+soft-warn-delete UX as a flat list, adds a per-team song-tag filter select, and RosterView seeds/subscribes it on first load.
- Both service-plan team-checkbox surfaces and the AI song-suggestion filter now read the shared teams store instead of a hard-coded `['Choir','Orchestra','Communion','Special']` array and a twice-duplicated Orchestra-only filter — the ordinal-Sunday auto-team-selection is deleted outright.
- Closed two server-side Firestore rules gaps — the inviteLookup self-invite privilege-forgery vector and the mutable org createdBy provenance field — both mirroring idioms already live in the same rules file, shipped BUILT + TESTED + UNDEPLOYED.
- deleteService now revokes every public share artifact a service can accumulate — shareTokens (query-based, handles multiples), serviceShareLinks, and serviceShares — before deleting the service doc, closing the stale-share-URL information-disclosure gap.
- Fixed `rebuildSongGroup`'s stale-slides-on-removal bug (R235, reprise-safe by construction) and added a pending-render customization block in `EditSlideDrawer.vue` (R236), both client-only.
- Re-confirmed already-shipped R237 PC-export coverage and R238 sender wiring via existing tests; delivered the R238 owner runbook (`functions/DEPLOY-EMAIL-DOMAIN.md`) and a PENDING-VERIFICATION.md entry — no source rebuild.
- Real `<label for>` and `aria-label` accessible names added to all 4 previously placeholder-only Owner Console inputs, plus `useId()`-based label/input association in the shared `ConfigTextField.vue`.
- WAI-ARIA APG Tabs pattern (role=tablist/tab/tabpanel, aria-selected, aria-controls, aria-labelledby) added to both the Owner Console and Service Editor tab strips, bound to each view's existing activeTab state, with a regression test proving the Owner Console panels' always-mounted onSnapshot listeners survive the retrofit.
- Extracted the duplicated tag include/exclude Set-intersection logic into `filterSongsByTags()` and built a real `SongBrowser.vue` shell (search + tag checklist + shared filtered-song computed) that now powers both the Songs page and the service-plan song picker, leaving both consumers' row markup untouched.
- Super-admin-only `aiMasterEnabled` field + `setOrgAiEnabled` callable + fail-closed AI-proxy enforcement, all mirroring the existing `active`/`setOrgActive` pattern — ships BUILT + TESTED + UNDEPLOYED
- authStore.aiMasterEnabled ref (default OFF) two-gates claudeApi.ts's isAiEnabled(), hides SettingsView's AI Features card, and drives a new Owner Console per-row AI toggle against the (Plan-01, still-undeployed) setOrgAiEnabled callable.
- Constrained the Roles/Teams config tabs to max-w-4xl, restyled both panels' Delete text-link into a real destructive button matching SettingsView's Clear Credentials, and corrected the schedulable-roles copy (plus a matching stale type doc-comment) to accurately describe the scheduler's real per-role auto-fill behavior.

**Post-close scope change (2026-08-25):** The per-team song-tag AI filter (R230) — referenced in the Teams-tab and AI-filter accomplishments above — was **delivered in Phase 79 and then removed** by owner decision on the same day the milestone closed. It only fed AI song suggestions, did nothing when AI was off, and presented a live-looking control that had no effect — confusing for no benefit. `songFilterTag` and `filterSongsByTeamTags()` were deleted (commit `951ffe80`); team selection no longer narrows the AI candidate pool. REQUIREMENTS.md marks R230 as removed; the team-list dedup (R241) stands.

**Deploy status at close:** Hosting deployed to production 2026-08-25 (client changes live). Phase 80 rules (`inviteLookup` gate + `createdBy` immutability) and Phase 82 rules+functions (per-org AI enablement) ship UNDEPLOYED as owner-gated hand-overs, then re-enable AI for Berean (OFF by default at cutover). Audit PASSED 19/19; human UAT `/gsd-verify-work 79–83` deferred (`PENDING-VERIFICATION.md`).

---

## v2.1 Organization Lifecycle & Super-Admin Access (Shipped: 2026-08-23)

**Phases completed:** 4 phases (75–78), 7 plans

**Audit:** [v2.1-MILESTONE-AUDIT.md](milestones/v2.1-MILESTONE-AUDIT.md) — PASSED (16/16 reqs, 5/5
integration seams WIRED, 3/3 security-critical phases SECURED).

**Deployed to production 2026-08-23** as the third of three stacked milestones (v1.9 → v2.0 → v2.1,
deployed in that order because each depends on the prior's auth-claim widening). Closed on owner
acceptance with human UAT (`/gsd-verify-work 75–78`) deferred and preserved in
`PENDING-VERIFICATION.md`, mirroring the v1.4–v1.7 close pattern (and, unlike those, deployed at close).

**Key accomplishments:**

- **Phase 75 — Pending-Invite Visibility:** the super-admin Organizations list distinguishes active
  (logged-in) members from invited-but-pending ones, computed server-side by the existing
  `listOrganizations` callable.

- **Phase 76 — Church Deactivation & Reactivation (SECURED 11/11):** a super-admin-gated `setOrgActive`
  callable flips an org's `active` status, `firestore.rules`/`storage.rules` deny a deactivated org's
  members org-scoped access (Firestore via a live `get()`, Storage via a fanned-out `deactivatedOrgs`
  claim since cross-service reads are inert there), and reactivation restores it; lifecycle fields are
  callable-write-only.

- **Phase 77 — Church Deletion, Cascade Cleanup (SECURED 11/11):** deletion is gated on prior
  deactivation, runs through a re-verifying super-admin-gated `deleteOrganization` callable that
  cascades every Firestore subcollection + cross-reference + Storage object, requires typed
  confirmation, and is safely retriable; `allow delete: if false` keeps clients out entirely.

- **Phase 78 — Super-Admin Enter-Any-Church (SECURED 7/7):** an additive super-admin arm in
  `firestore.rules`/`storage.rules` grants a super-admin editor-equivalent read/write on any church
  with no membership doc (invisible to that church's member list), with a persistent "viewing as
  super-admin" banner and exit; the "no member doc" contract is enforced client-side (accepted
  residual T-78-03, documented inline).

**Deploy (owner-run 2026-08-23):** `firebase deploy --only firestore:rules,storage,functions` (added
`setOrgActive`, `deleteOrganization`, `listOrganizations`; `onboardOrganization` from v2.0) + hosting
(client UI). First super-admin bootstrapped via `node lib/bootstrapSuperAdmin.js --apply`.

---

## v2.0 Multi-Church Onboarding & Owner Console Tabs (Shipped: 2026-08-23)

**Phases completed:** 3 phases (72–74), 6 plans

**Delivered:** Turned the owner console into a tabbed Configuration/Organizations shell and added
platform-level multi-tenancy — onboard a new church end-to-end and assign its first admin — while
closing the multi-org Storage auth-claim gap (backlog 999.5) that onboarding a second-org admin would
otherwise trip. **Deployed to production 2026-08-23** (second of the three stacked milestones). Closed
on owner acceptance; human UAT (`/gsd-verify-work 72–74`) deferred and preserved in
`PENDING-VERIFICATION.md`. Requirements R193–R211 (19, 100% mapped).

**Key accomplishments:**

- **Phase 72 — Owner Console Tabs:** restructured `OwnerConsoleView` into a query-driven tabbed shell
  (Configuration = the pre-v2.0 console body relocated byte-for-byte; Organizations = the new tab),
  super-admin-gated, with the open tab reflected in the route query.

- **Phase 73 — Multi-Org Storage Auth Claim (SECURED 6/6, backlog 999.5):** widened the org-membership
  claim to an additive `orgs: {[orgId]: role}` map (recomputed from `collectionGroup('members')`,
  superAdmin-preserving), widened `storage.rules`' `isOrgMemberByClaim` with a null-guarded `orgs` arm
  ORed with the legacy primary-only arm (no access gap during rollout), plus an idempotent
  dry-run/`--apply` backfill.

- **Phase 74 — Organizations: List, Onboard & Admin Assignment (SECURED 8/8):** three super-admin-gated
  callables — `listOrganizations` (server `count()` summaries), `onboardOrganization` (atomic org +
  default `OrgSettings` + seeded service template + first admin at editor tier, plus a Resend
  onboarding email), and `assignOrgAdmin` (additive `arrayUnion` membership or invite) — plus the
  Organizations tab UI; the client never writes `organizations/*`, `orgNames/*`, or another org's
  `members/*` directly.

**Deploy (owner-run 2026-08-23):** widened `syncOrgMembershipClaim` + the three callables via
`firebase deploy --only functions`; `storage.rules` via `firebase deploy --only storage`; multi-org
claim backfill `node lib/backfillOrgClaims.js --apply` (3 accounts, idempotent-verified).

---

## v1.9 Owner Admin Console (Shipped: 2026-08-23)

**Phases completed:** 4 phases (68–71), 12 plans

**Delivered:** A super-admin owner console lifting the v1.8 cost/cleanup levers and the no-reply sender
into Firestore-backed runtime config, with a dry-run blast-radius preview gating every cleanup-toggle
flip. **Deployed to production 2026-08-23** (first of the three stacked milestones — its super-admin
claim + claim-merge fix are the foundation v2.0's multi-org claim and v2.1's lifecycle logic build on).
Closed on owner acceptance; human UAT (`/gsd-verify-work 68–71`) deferred and preserved in
`PENDING-VERIFICATION.md`. Requirements R175–R192.

**Key accomplishments:**

- **Phase 68 — Super-Admin Access Gate & Claim-Merge Fix:** an end-to-end `superAdmin` custom-claim
  gate — grantable via `superAdmins/{uid}`, enforced by both the client route and claim-only Firestore
  rules — with the shared `mergeAndSetCustomClaims`/`clearClaimKeys` helper closing the claim-replace
  hazard (a claim write no longer wipes `orgId`/`role`).

- **Phase 69 — Firestore Runtime Config:** every v1.8 cost/cleanup/messaging knob moved out of
  `process.env` into an admin-only `appConfig/global` doc that 7 Cloud Functions read at runtime, with
  safe deep-merged defaults so an absent/empty doc reproduces prior behavior byte-for-byte.

- **Phase 70 — Admin Console UI & No-Reply Sender:** a super-admin console showing/editing every
  managed setting with validation and provenance, plus the app's no-reply sender configuration.

- **Phase 71 — Cleanup Deletion-Toggle Safety:** a dry-run blast-radius preview (`previewCleanupDryRun`
  callable) and explicit confirm step gate every `*_CLEANUP_ENABLED` flip, with the song-linked
  background fail-safes proven intact.

**Deploy (owner-run 2026-08-23):** `firebase deploy --only firestore:rules,functions` (added
`syncSuperAdminClaim`, `setSuperAdminClaim`, `previewCleanupDryRun`; swapped 7 functions to the
`appConfig` read) + hosting. First super-admin granted via
`node lib/bootstrapSuperAdmin.js --email sheibeck@gmail.com --apply`.

---

## v1.8 Cost & Billing Hardening (Shipped: 2026-08-20)

**Phases completed:** 3 phases, 6 plans, 13 tasks

**Key accomplishments:**

- Rate limiter, model/token enforcement, usage ledger, and maxInstances ceiling on the anthropic branch of the `api` proxy — all four cost controls wired, tested against mocked Firestore/Auth, built and committed, staged for the orchestrator's consolidated deploy.
- Client-side 429/400 graceful-degrade guard for the AI proxy's new cost controls, plus an owner-gated (committed, UNDEPLOYED) firestore.rules deny for the aiUsage/aiRateLimits collections.
- Proved by test (against mocked Storage/Firestore) that `cleanupExpiredMediaHandler` (R165) and `cleanupOrphanRendersHandler` (R166) actually delete the right objects when enabled, and added a shared `readDeleteCap()` per-run delete-cap plus `deletedBytes`/`cappedByLimit` observability to both — every enable flag still ships OFF.
- Built the first-ever retention paths for two Storage areas that grow forever today: background images (orphan+age, with a three-tier reference model and two independent fail-safes) and PPTX-import sources (positive-guard consumed/failed pruning that structurally cannot touch the rendered display artifacts) -- both dry-run by default, both proven only against mocked Storage/Firestore.
- Gated the daily cross-org reminder scan off by default, capped the Resend send loop with a reject-over-cap recipient limit + per-org daily quota, and applied a project-wide `maxInstances` ceiling — all built, tested, and committed but NOT deployed (staged for the orchestrator's consolidated milestone-end deploy).
- Pinned Cloud Run `pptx-render`'s `--max-instances` at an explicit R173 ceiling of 3 and kept `--concurrency=1` deliberately (not the 4 floated in 67-CONTEXT), with the rationale committed in render-service/DEPLOY.md.

---

## v1.7 Volunteer Messaging (Shipped: 2026-08-18)

**Phases completed:** 7 phases, 25 plans, 41 tasks (58–64)

**Delivered:** The complete volunteer-messaging system — a Settings kill-switch and org timezone, one shared server-side recipient resolver, a ✉ composer, per-service delivery history, an HMAC-verified bounce webhook, automatic lock and scheduled-reminder emails, and a re-lock scoped change diff — plus the v1.8 messaging-UX refinements (dedicated Messages tab, always-visible history, live preview, corrected tokens) and the post-UAT hotfix batch (R157–R160). **Deployed to production 2026-08-17** (firestore rules+indexes, all messaging Cloud Functions incl. `messageWebhook` with the real Resend secret, hosting). Closed on owner acceptance — the `/gsd-verify-work 58..64` human-UAT items were accepted as deferred (preserved in `PENDING-VERIFICATION.md`), consistent with the v1.4/v1.5/v1.6 close pattern.

> **Scope note:** internally tracked as two milestones (v1.7 Phases 58–62, v1.8 Phases 63–64) that stacked without archiving in between; shipped together in one production deploy and combined into this single v1.7 milestone at close (owner decision 2026-08-18).

**Key accomplishments:**

- Extended `OrgSettings`/`Service` with a fail-closed messaging kill-switch + org timezone, deep-merged both in `loadOrgContext`, and added the single `isMessagingEnabled()` choke point — no send path, UI, or Cloud Function yet.
- `resolveRecipients` — a pure resolver wrapping `resolveServiceRoleAssignments` that turns a team/individual/everyone selection into a person-id-deduped reachable list plus an unreachable count, with `MESSAGING_TEAM_LABELS` as the messaging surfaces' own RoleGroup label map.
- Deny-by-default `firestore.rules` for `services/{id}/messages`, `.../recipients`, and `services/{id}/lockSnapshots`, proven by 6 new genuine ALLOW-cases plus Admin-SDK-only and cross-org DENY-cases against the real emulator — ships undeployed per the v1.7 gate.
- Messaging card on SettingsView.vue with a fail-closed global kill-switch, an org-level automatic-email-defaults sub-block (reminderDaysBefore persisted as a number), and an always-visible 7-zone organization-timezone select — all writing scoped Firestore dot-path leaves with store mirror-writes.
- Per-service automatic-email override storage (R132): a scoped `setServiceMessagingDefaults` dot-path store action plus a Draft-editable / locked-read-only "Messaging defaults" panel on the Service Order tab that inherits from org Settings until explicitly overridden.
- resend@6.19.0 added as an exact-pinned functions-only dependency plus functions/src/serviceRoles.ts — a self-contained port of the pure recipient resolver that additionally yields per-recipient roleNames for {{their_roles}} (R131/R139), all UNDEPLOYED.
- Added the enqueue half of the send path to `functions/src/index.ts` — `queueServiceMessage` (`onCall`, NO secret) that re-authorizes the caller (independent editor-tier membership re-check), re-reads the org messaging kill-switch server-side, validates the type enum + scheduledFor, then writes ONE `messages/{id}` doc via the shared pure `createQueuedMessage()` shaper and returns its id (R131/R137/R141), all UNDEPLOYED.
- Added the send half of the path — `sendQueuedMessage` (`onDocumentCreated`, the sole `RESEND_API_KEY` holder) with a transactional `queued→sending` idempotency claim, server-side recipient re-resolution, per-recipient token rendering via a new pure `messageTokens.ts`, Resend send (mocked), `recipients/{id}` writes and `deliveryCounts` rollup (R131/R138/R139), all UNDEPLOYED against a mocked provider.
- Shipped the client send surface for v1.7 — a ✉ Messages action-bar entry point (editor-gated, present-but-disabled with a Settings tooltip when messaging is off) that opens the new `MessageComposer.vue`: teams-first recipient chips + individuals writing a `{ teams, individualPersonIds, includeEveryone }` selector, three message types seeding subject/body behind a dirty guard, a subject/body with caret-inserted merge tokens (raw template stored), a live pluralized "Reaches N" via the Phase 58 pure resolver, the three options with a schedule reveal, and a dynamic Send that calls the `queueServiceMessage` client callable with the recipient SELECTOR only — no email list crosses the boundary.
- Pure, exported node:crypto Svix HMAC-SHA256 verifier (`verifySvixSignature`) with length-guarded timing-safe compare, key-rotation multi-`v1,` support, and a ±300s replay window, plus the deploy-gated `recipients.providerMessageId` collection-group index — no npm dependency, nothing deployed.
- The milestone's unauthenticated Resend delivery/bounce `onRequest` receiver: it verifies the Svix HMAC over the raw body BEFORE any Firestore access (401/400 + zero state on a bad request), then — only for a hard `Permanent` bounce — idempotently flips the addressed `recipients/{id}` to `status:'bounced'` and increments `messages/{id}.deliveryCounts.bounced` once, bound to `RESEND_WEBHOOK_SECRET` and shipped built/tested/UNDEPLOYED.
- Read-only per-service delivery-history card (R142) with per-message hard-bounce surfacing (R143) — a nested-path `serviceMessages` onSnapshot store, a props-driven `ServiceMessageHistory.vue` card, its kill-switch/editor-gated mount in the Service Order tab, and a `/volunteers?edit={personId}` roster deep-link — reads only, no new Firestore rule, no deploy.
- R145 reminder engine — a daily 04:00 UTC onSchedule Cloud Function that auto-enqueues the shared service link to everyone assigned N days before a planned/exported service, reckoned in the org's local timezone, exactly once; built/tested against a mocked provider and UNDEPLOYED.
- dispatchDueScheduledMessagesHandler claims each due status:'scheduled' message scheduled→dispatched in a Firestore transaction and creates a FRESH status:'queued' doc via createQueuedMessage — a genuine onDocumentCreated that re-fires sendQueuedMessage — completing R141's schedule-for-later dispatch half deferred from Phase 59.
- Locking a draft service the first time now writes lockSnapshots/current and, behind the Phase 58 messaging gates, auto-enqueues one lock-notification via queueServiceMessage — surfaced by a subordinate amber aria-live confirmation line whose failure never misreports the successful lock.
- A pure, dependency-free `serviceLockDiff.ts` — DJB2 `fingerprintSlideGroups` over ordered sourceRef identities and `diffServiceSnapshots` returning typed `ChangeEntry[]` (SONG/ORDER/ROLE/NOTES/SLIDES) with R147 narrow/broad team tagging — proven by 26 mock-free fixture tests.
- The re-lock notify flow (`ReLockNotifyPrompt.vue` + lock-hook restructure): a real slide-groups fingerprint on every lock, a read-before-write branch that diffs a re-lock against the prior `lockSnapshots/current`, a checkable team-tagged change prompt with affected-vs-everyone reach, "Lock quietly", and a deferred snapshot-overwrite-on-confirm so a failed send leaves the pre-edit diff basis intact (SC4).
- **Phase 63 — dedicated Messages tab & always-visible history:** moved the per-service messaging-defaults panel and the "Sent on this service" history out of the Service Order tab into a new 4th Messages tab, and fixed the Phase 60 `canEditService` defect so the history renders on a LOCKED service (gated `isMessagingEnabled() && isEditor`, no lock term).
- **Phase 64 — composer refinements:** roster-matching team labels (Band/Vocals/Tech/Other), a working "+ Add someone" individual picker, a live email preview (no click-to-preview), the `{{song_list}}` token dropped and a per-recipient `{{name}}` token added (client + server), a Send spinner, the misleading success-toast removed, aged-`queued`/`sending` (>5min) surfaced as "Failed to send", and distinct per-type seed content (One-off / Reminder / Share).
- **Post-UAT hotfixes (R157–R160):** hide the ✉ button when messaging is off (R157); let the add-someone picker select the only addable person (R158); rework the email From to `"<Org Name>" <app-owned address>` with auto Reply-To = sending editor, removing per-church From fields that triggered Resend 403s (R159); unique org **names** via a new `orgNames` create-only registry + rule (R160).

---

## v1.6 Editing Reliability & Song Slides (Shipped: 2026-08-12)

**Phases completed:** 7 phases, 19 plans, 26 tasks

**Key accomplishments:**

- Added a DOM-mutating cross-section drag repro to `ServiceEditorView.test.ts`. The module's `sortablejs` mock only captures options and never moves a DOM node, so an `onEnd`-only test is false-GREEN on buggy code (51-RESEARCH Pitfall 1). The new test physically detaches the dragged `.slot-item` from the ungrouped ("No Section") container and appends it into the worship container **before** invoking the captured `onEnd`, mirroring real SortableJS. It then asserts on rendered DOM node counts: zero clones left in the source list, and **exactly one** `.slot-item` for the moved id tree-wide. Committed RED (`expected 2 to be 1` — the phantom).
- Added a DOM-mutating cross-section drag repro to `ServiceTemplateEditor.test.ts`. The module's `sortablejs` mock only captures options and never relocates a node (51-RESEARCH Pitfall 1), so an `onEnd`-only test is false-GREEN on buggy code — the existing cross-section test at line 415 already passed because it only asserts on the (correct) reactive render. The new test physically detaches the dragged `[data-entry-id="song-1"]` row from the ungrouped ("No Section") container and appends it into the worship container **before** invoking the captured `onEnd`, mirroring real SortableJS. It then asserts on rendered node counts: zero rows for the moved id left in the source list, and **exactly one** `[data-entry-id="song-1"]` tree-wide. Committed RED (`expected 2 to be 1` — the phantom).
- `updateService` now runs its payload through `stripUndefined` before `updateDoc`, so moving a service item back to "No Section" (which sets `slot.section = undefined`) saves cleanly instead of throwing Firestore's "Unsupported field value: undefined".
- Reversed the v1.5 empty-by-default creation path so every new service now seeds from a single shared `buildSuggestedTemplateEntries()` preset, and threaded an optional `ServiceTemplateEntry.body` through `buildSlotsFromTemplate` → `createSlot` while keeping the util pure.
- Renamed the template editor's seed control to "Suggested Template" (seeding through the one shared `buildSuggestedTemplateEntries()` preset, no forked copy) and exposed a `template-item-body` textarea for MISC/ANNOUNCEMENTS rows bound to `ServiceTemplateEntry.body`, normalizing a cleared body back to absent.
- The default-service-template editor moved off the main Settings page to an editor-gated cog next to "New Service" on the Services page; the editor component is structurally unchanged (only its trigger + mount moved).
- Additive `slideBreaks` split metadata + pure `sliceSectionIntoSlides`, render-time per-kind `displayLabel` numbering via `deriveSectionKind`, and `'Pre-Chorus'` in the add palette — all in the two pure modules, stored labels never rewritten.
- A manually-split lyric section (`slideBreaks` present) now resolves LIVE to N slides at BOTH in-lockstep lyric-emission call sites in `assembleSlideshow` — split ids `${entry.id}:${i}` (stored) / advancing `${slot.id}:${localSeq}` (fallback), unsplit byte-identical — and R118 (duplicate a split as one unit) falls out for free with zero `duplicateRow`/slide-group-model change.
- SongLyricEditor now renders Plan 01's derived per-kind `displayLabel` (killing the bare-"Verse" bug), surfaces the Pre-Chorus palette chip, and adds a manual click-between-lines split affordance that authors `section.slideBreaks` through the existing one-write autosave.
- The paste-lyrics commit button now reads "Save" on a brand-new song (0 sections), "Replace lyrics" once lyrics exist, and "Saving..." while a save is in flight — driven entirely by the existing currentSectionCount prop with no new prop and no SongLyricEditor change.
- A plain-text `slot.notes` field on the shared MediaAttachableSlot base, surfaced as one shared input beside every item's selector in a `flex flex-col sm:flex-row` two-column layout, riding the existing autosave + stripUndefined path.
- Re-pointed every suffix-asserting test in `slideDisplay.test.ts` and `PresentationViewer.test.ts` to assert the version suffix is ABSENT, adding explicit `not.toContain('(ESV)')` / `not.toContain('(NLT)')` guards. The reference-only-no-text case was kept verbatim as a regression anchor. Running the two files against the still-present suffix produced the expected 14 failures (RED); `scripture.test.ts` was not modified.
- Added a new `describe` block to `ServiceEditorView.test.ts` (with its own `teleport: false` mountView, since the export dialog is a `<Teleport to="body">`). The tests drive the component into the "options loaded, export running" state by setting the existing `showExportDialog` / `exportLoading` / `exportSelectedServiceTypeId` / `isExporting` reactive flags directly (the same vm-level approach the file's WR-02 export tests use), then assert against `document.body` via `DOMWrapper` that `[data-testid="export-spinner"]` is present and carries the `animate-spin` class while exporting, and that the Confirm Export button (its "Exporting..." label) stays `disabled`. A complementary case asserts the spinner is absent when `isExporting` is false. Ran RED — failing on the missing glyph as expected; the absent-case passed.
- Roboto added as a sixth self-hosted @fontsource slide font (sans, weights [300,400,500,600,700], OFL-1.1) via one registry entry + one static-prefix loader line; Inter stays first/default and the other four families are unchanged.
- An optional custom label for Miscellaneous service items — editable in both the live and template editors, exported as the Planning Center item title, and rendered in print — via a single `miscLabel()` helper and an absent-key-preserving optional field.
- An optional per-item ESV/NLT override on a Scripture service item, honored at the three surfaces where passage text is actually produced — Planning Center export routing, the editor reference preview, and the congregational split fetch — while reference-only slide/preview/print stay version-agnostic by design.
- Task 1 — shared `kindBadgeClass` (commit `49135fd`)

---

## v1.5 Settings, Sharing, and Fidelity (Shipped: 2026-08-10)

**Phases completed:** 13 phases, 49 plans, 110 tasks

**Key accomplishments:**

- Two new mount-based Vitest harnesses (SettingsView.test.ts, SongsView.test.ts) against unmodified source, both carrying a forward-compatible settings-shaped auth-store mock and a shared findImportSongsButton selector for Wave 2 to reuse.
- Typed `OrgSettings`/`Organization` shape in `src/types/organization.ts`, a single defaults-merge point in `auth.ts::loadOrgContext`, and a dual-read for `vwModeEnabled` that cannot silently re-enable a deliberately-off church.
- Two new Settings toggles (AI Features, Planning Center enable) and a relocated `vwModeEnabled` write target, all three now writing concurrency-safe Firestore dot-path leaf keys instead of flat or whole-map fields.
- Single `isAiEnabled()` guard in `claudeApi.ts` gates exactly the 3 network-calling exports (proven at the module entry point via the existing Anthropic SDK mocks), and three composed `v-if`s hide the corresponding UI affordances without touching any pre-existing state.
- Five of the six enumerated Planning Center entry points (export action-bar item, export dialog invocation, the set-up hint row, both roster import triggers, and the song import trigger) are hidden with `v-if`/composed-early-return gates on `authStore.settings.pcEnabled`, with the export item's gate proven at the data level and no credential or already-imported data path touched.
- Independently re-ran the full type gate and test suite over the assembled phase, confirmed both green against their documented baselines, mapped R073/R088/R089 each to a real passing command, reconfirmed the firestore.rules finding in writing, and closed the last gap in the phase's manual-verification disclosure — the congregational editor button-row reflow backstop that 39-03 had not yet recorded.
- Added a claim-first dual-read (`isOrgMemberByClaim || isOrgMemberByFirestore`) to `storage.rules` and rewrote `src/storage.rules.test.ts` so every assertion is non-vacuous — turned the measured-baseline `2 failed | 96 passed (98)` into `0 failed | 103 passed (103)`.
- Single `onDocumentWritten` trigger (`syncOrgMembershipClaim`) that computes and sets the `{ orgId, role }` custom auth claim from `organizations/{orgId}/members/{uid}` writes, sharing its decision logic (`decideMembershipClaim`) for plan 40-04's backfill to reuse — built and unit-tested, never deployed.
- Forced `getIdTokenResult(user, true)` on every `loadOrgContext` load, with a P-01-scoped bounded retry (4 attempts × 1500ms) that fires only on the just-created-membership path — the ordinary already-a-member path pays exactly one refresh with zero added latency.
- `backfillOrgMembershipClaims` -- an idempotent, dry-run-by-default Node script over `collectionGroup('members')` that shares its decision logic with the trigger via `decideMembershipClaim` -- plus `functions/DEPLOY-ORG-CLAIMS.md`, the exact owner-run two-deploy sequence with a mandatory one-hour soak and multi-org pre-check between the two deploys.
- Replaced Firestore's unconditional `allow create` on `members/{uid}` with an OR of two explicit, emulator-proven flow branches (`getAfter()` for org founding, `get()`/`exists()` with role-pinning for invite acceptance), closing a pre-existing privilege-escalation hole where any signed-in user could self-join any org at a role of their choosing.
- Loosened `shareTokens`' unconditional update denial to the org-scoped `isOrgEditor` idiom and added a new absence-tolerant `serviceShareLinks/{serviceId}` CRUD block, proven by 20 new/replaced emulator-backed tests including two load-bearing genuine ALLOW cases.
- Pure `src/utils/shareTokens.ts` module extracting R078's mint and adopt-vs-mint decisions into dependency-free, exhaustively-tested functions — no Firestore, no Pinia, no mock, and no `orderBy` anywhere in the diff, closing off the composite-index production failure mode the research pass found.
- `ensureShareLink` replaces "mint a fresh token and freeze a snapshot on every call" with "resolve one stable token per service — reading `serviceShareLinks/{serviceId}`, else adopting the most recent already-circulated `shareTokens` doc, else minting — then always writing the current payload in place," with a `runTransaction` re-read making concurrent first-shares converge on a single token.
- `maybeRefreshShareLink(id, overrides?)` hooked into `updateService`, `setRoleOverride` and `clearRoleOverride` so a previously-shared service's public snapshot — including role overrides — stays current after every save, with zero write-back to the service document, a soft-fail that never breaks the user's save, and a per-session cache so an unshared service costs nothing extra.
- Closed a live-in-production Firestore write hole letting any org editor forge a `pptxRenders` render-status doc to `ready`, and made read access an intentional member-tier grant instead of an accident of wildcard fallthrough — both proven RED-then-GREEN against the real emulator.
- Client PptxRenderDoc type, a byte-identical rendered-page Storage-path builder, and a Pinia store managing a dynamic set of live per-renderImportId Firestore listeners — the phase's one genuinely new design (no prior codebase analog).
- `src/utils/importedRenderReconciler.ts` — the single render-decision-table helper (resolveImportedRender/importedEntryIdentities/renderedPageNumberFromIdentity/importedEntryContent/importedSourceSignature) both assembly engines will consume, plus the two `SlideBase` render-state fields and two `AssemblyInputs` maps it needs.
- `slideGroupMaterializer.ts`'s two IMPORTED branches now read from the one shared reconciler instead of a second, unsafe decision table — and a `pending`/`failed` → `ready` render transition is proven, by test, to rebuild exactly once and never destroy a user's own slides.
- `slideshowAssembler.ts`'s two IMPORTED branches now read from the one shared reconciler instead of a direct `deck.slides` lookup — proven by 10 new tests that a pending/failed render is a present slide, page 1 and the last page of a multi-page render resolve to their own URLs, and the grid and presenter agree content-for-content.
- Added the grid's two explicit R080 states — an indigo "Rendering…" pending tile and a red "Render failed" tile with a mapped human sentence — plus the one sanctioned `slideDisplay.ts` lookup that turns any `failureReason` slug into one of three authored sentences.
- Added the presenter's two explicit R080 states — an indigo "This slide is still rendering." pending block and an amber "This slide couldn't be rendered." failed block with the same mapped caption the grid uses — and proved by test that neither state removes a slide from `props.slides`, `hasSlides`, `atFirst`, `atLast` or the `n / m` progress count.
- A fifth live `onSnapshot` subscription and a second async URL-caching loader in `useSlideshowAssembly.ts` make a `pending → ready` render transition update the grid and presenter once, with no reload, bounded Storage calls, and no possibility of a stale page array — this is what makes ROADMAP criterion 4 observable end to end.
- Widened `SlotKind` with `ANNOUNCEMENTS`/`MISC` and one shared optional `NonAssignableSlot.body?: string` field, then used `npm run type-check`'s compiler-surfaced worklist (plus three compiler-silent sites found by hand) to close every `switch (slot.kind)` in the codebase with an explicit case — zero new `default` arms.
- Converted `addSlotAsItem`'s unguarded if-chain — whose implicit final `else` labelled every unhandled `SlotKind` "Message" — into an exhaustive, compiler-guarded dispatch with an explicit branch per kind and a `never`-typed backstop that fails `vue-tsc --build` if a future kind is ever left unhandled.
- Gave the planner the editor surface for the new item kinds: two new palette chips (Announcements, Miscellaneous) added to both palette rows, the Hymn chip retired from the palette (but not the type), one shared body `<textarea>` serving Message/Announcements/Miscellaneous, and the Message URL control removed from the markup while its `linkUrl`/`linkLabel` type fields and stored values remain untouched.
- Closed the print/share silent-omission gap for ANNOUNCEMENTS/MISC (T-43-12), added the standing cross-surface HYMN absence-of-regression suite proving R084's hard half, and empirically proved the `addSlotAsItem` exhaustiveness backstop fires both at compile time and at runtime.
- `buildSlotsFromTemplate()` builds a new service's slots from `OrgSettings.defaultServiceTemplate`, computing Vertical Worship types at creation by walking SONG entries as an ordinal sequence (not array position) into `PROGRESSION_SLOT_TYPES`, with an empty/unset template deliberately producing a zero-slot service instead of the old automatic 1-2-3 default.
- `ServiceTemplateEditor.vue` — a Teleported, no-scrim slide-out that structurally ports `EditSlideDrawer.vue`'s panel shell around Phase 43's closed six-chip palette and `ServiceEditorView.vue`'s per-section SortableJS reorder, wired into a new "Services" card on `SettingsView.vue` with a live item/section-count summary — completing R086's UI half on top of Plan 44-01's storage engine.
- NLT scripture proxy (query-param secret injection) and DOMParser-based nltApi.ts client, built and unit-tested against real NLT response fixtures, shipped built/tested/UNDEPLOYED per the standing v1.5 NO-DEPLOYS grant.
- Church-level `bibleVersion: 'ESV' | 'NLT'` field defaulting to NLT (owner's locked override) via the single existing `loadOrgContext` merge, plus a "Bible Translation" Settings card mirroring the AI/Planning Center/Vertical Worship toggle cards exactly.
- Established the data-layer foundation that makes R091 attribution and R092 immutability true by construction: an optional `translationSource` field on the scripture-slide / congregational-section / source-ref types, two pure helpers (`scriptureAttribution` for initials-only attribution, `resolveTranslationSource` whose hardcoded `?? 'ESV'` fallback never reads the live org setting), and materializer/assembler threading that carries a stamped value through without re-deriving it — proven by a named R092 invariant test.
- Closes R091 and R092 end to end: `CongregationalEditor.vue`/`ScriptureInput.vue` route ESV/NLT scripture fetches by the church's `bibleVersion` setting, `CongregationalEditor.vue` stamps `translationSource` exactly once at fetch time (never restamped by a later setting change or a subsequent AI split), and both scripture render sites (`PresentationViewer.vue`, `slideDisplay.ts::slideBodyText()`) append the one shared `(ESV)`/`(NLT)` attribution suffix, driven entirely by each slide's own resolved provenance.
- Five self-hosted @fontsource packages (Inter, Open Sans, Poppins, Lora, Source Serif 4) pinned at 5.3.0, with a typed `SLIDE_FONTS` registry whose license and weight-ramp claims were verified directly against each package's own LICENSE/CSS files rather than assumed.
- `OrgSettings.slideTypography` field + default, and a pure `src/utils/slideTypography.ts` module (CSS-var computation, weight snapping, the bounded R094 font-load gate, and the on-demand font-CSS loader) — unit-tested independently of any component mount, plus the `:root` CSS variables and app-init eager import of the default face.
- Added the "Slide Typography" card to Settings — font-family/weight selects, a Small/Medium/Large size control, and a live Preview bound to the shared `cssVarsFor` — as the single editor-gated write point for `authStore.settings.slideTypography`, with family-change weight snapping and on-demand font loading.
- Wired the church's chosen slide typography (family/weight/scale) into the grid, drawer preview, and presenter — and gated the presenter's first paint on that font being resident (R094), closing UI-SPEC unresolved item #1 with a bounded 3000ms timeout.
- Task 1 — ALL speaker unions, `isFirstSection`, AI split schema + validator widen
- Reworked `CongregationalEditor.vue` from fetch-auto-splits-then-binary-toggle into a boundary-indexed hand-divide editor with three equal seeds (AI/Alternate/Blank), click-between-verses gap-+ dividers, a 3-way Leader/Congregation/All chip, and a re-seed confirm — all three seeds resolve to the same draft shape via a byte-exact text-to-boundary alignment helper.
- Task 1 — Failing tests (RED)
- Intl.Collator natural-order sort closes the slide10-before-slide2 drop defect; a synchronously-seeded localStorage flag makes the Getting Started panel dismissible per-device
- Responsive Slides-tab stacking (rail-above-grid + horizontal-scroll strip), 44px hit areas on the drag handle and menu trigger, and additive SortableJS touch options on the existing instance — all unit-proven, with the two physical-device backstops deferred to the owner.
- Print and Share moved into the top ContextualActionBar with reused icon SVGs, Undo demoted to a text link beside the save-status text, and the header Save-area row now stacks on a phone using QuarterView's recipe — all three landing on a type-clean commit at every step.
- A congregational scripture reading now assembles to N+1 slides — a dedicated leading reference slide (byte-identical to a plain scripture reference slide) plus one text-only slide per section — emitted at assembly time on both assembler paths (approach B), with the reference eyebrow removed from every section slide.
- A 9-case preservation suite proving `slideGroupMaterializer.ts`'s existing derived-vs-user-added split already guarantees R107 end-to-end — zero production code changed.
- Threads a 1-based source-slide page reference from `officeparser`'s AST through the `parsePptx` callable, `PptxImportModal`, and `SlideGrid.onImportConfirmed` onto a hand-added imported entry's `sourceRef.renderedPage`, entirely optional and backward-compatible with every pre-phase deck.
- Per-group "Remove imported slides" bulk-delete control in `SlideGrid.vue`, gated behind the existing `canMutateGroup` seam and a `window.confirm` prompt, writing through `replaceGroupSlides`'s CR-02 concurrent-merge with the source signature left unchanged.
- A hand-added imported PPTX slide now resolves to its correct rendered page for multi-image decks by consuming the 50-03 `renderedPage` reference, closing the gap the ec217aa 1:1 positional resolver could never handle.

---

## v1.4 Service and Slides (Shipped: 2026-08-05)

**Phases completed:** 10 phases, 61 plans, 147 tasks

**Key accomplishments:**

- Committed failing reproductions of the ZTXcpNRcJTalEQp42fTx drag-reorder bug (R044) and the SlideGrid append-order defect (R050), built on a DOM-derived (never hand-passed) drag-index harness that reproduces exactly what the pre-existing header-free/tile-free fixtures could not catch.
- groupBySection/flattenBySection/orderSlotsBySection in slotTypes.ts — total, SERVICE_SECTIONS-driven, identity-preserving ordering contract, plus an audit confirming defaultSectionForPosition needs no change for the fifth section.
- Rebuilt `ServiceEditorView.vue`'s drag-reorder from a single flat Sortable list to one Sortable instance per `SERVICE_SECTIONS` container (always visible, sharing a `service-slots` group for cross-section drag), keyed on the stable `slot.id`, with `reindexSlots(orderSlotsBySection(...))` composed at every mutation site so the rendered order and the persisted order can never diverge — plus a real revert-and-surface path for a rejected reorder write.
- SlideGrid.vue's reorder/append defects fixed via draggable-scoped indices, a single `appendToGroup` sort-append-renumber contract shared by all three append paths, and an inline reorder-failure surface that replaces a hand-rolled DOM revert with a props-driven re-render.
- Widened `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS`/`ServiceSection` to a fifth, last member (`'post-service'`) with zero migration and zero source changes anywhere except `src/types/service.ts` and one placeholder-copy branch in `ServiceEditorView.vue` — confirmed by test, not assumed, that all four downstream consumers (slideshow assembly, print layout, Planning Center export, plan rail) already propagate it correctly.
- Deleted the entire reconcile/confirm-modal UI surface (component, prop chain, store decline-action, and confirm-copy builder) from the Slides tab, leaving the concurrent-write transaction merge untouched and a narrower prop surface for 30-02's unconditional-rebuild engine.
- Replaced the three-branch confirm-gated slide-group reconciler with one unconditional, idempotent rebuild per slot kind, generalizing SONG's hand-added-slide survival to SCRIPTURE and IMPORTED groups in the same commit that deleted the confirm gate, and narrowed scripture derivation to a single reference-only slide.
- Song groups in the Slides tab now expose zero slide create/update/delete/reorder affordances — controls are absent from the DOM, not disabled — while retaining group-level bed audio and the existing Edit in song link, plus a new muted read-only notice on both the drawer and the grid.
- Proved R045's order and membership lock with a 50-permutation property test (this codebase's first), ran the phase's widened reconciliation-symbol removal gate clean, and closed the phase through a human-verify pass that failed twice — a song-group drop tile still advertising an action its handler silently rejected (R054), and a scripture item producing NO slide at all because nothing in `src/` ever wrote `scriptureReadingId` onto its slot (R047) — the second failure's real fix rebuilding scripture derivation around the SCRIPTURE slot's own book/chapter/verse fields instead of a linked reading document.
- 2026-07-30
- 2026-07-30
- `toggleStatus` is gone
- Every site matched the class the UI-SPEC assigned it.
- Plan gate 1
- 2026-07-30
- Reproduced (live, not merely hypothesized) that a save's own Firestore echo swallows the next discrete mutation, then fixed it in `serviceStore.subscribe()` via `onSnapshot({includeMetadataChanges: true})` + per-doc `metadata.hasPendingWrites`, not a view-layer `updatedAt` patch.
- Extended `useAutoSave`'s status union to a five-member `'idle' | 'pending' | 'saving' | 'saved' | 'error'`, added a generic catch on both save paths so a rejected `saveFn` sets `'error'` instead of stranding at `'saving'`, and removed the 3-second saved-to-idle fade so `'saved'` is now terminal.
- Two client-only Pinia stores — a per-surfaceId save-status aggregator with a deterministic "most urgent" rollup, and a minimal array-backed failure-toast store — wired together so a save failure raises exactly one toast per episode, from inside `set()`, with zero Firestore involvement in either store.
- Two new components — a single shared `aria-live` save-status span consumed by four surfaces, and an app-level `role="alert"` failure-toast stack mounted once in `AppShell.vue` — built verbatim from 32-UI-SPEC.md's markup against the real `useSaveStatus`/`useToasts` Pinia stores plan 03 shipped, with no surface migrated yet.
- Deleted ServiceEditorView's ~150-line hand-rolled autosave duplicate in favor of `useAutoSave` (folding the lock into its dirty computed) plus a shared `useSaveStatus` store, and replaced the header's inline status text with one sticky `service-save-status-bar` that stays on screen underneath a long Service Order — the largest single de-duplication in Phase 32, landing at exactly a 100-line net reduction.
- Rolled the shared `SaveStatusIndicator`/`useSaveStatus` pair out to `CongregationalEditor.vue`, `ScriptureSlideEditor.vue` and `SongLyricEditor.vue` — retiring the nine per-status `data-testid`s these three duplicated, resolving the surface-id race the phase's own RESEARCH flagged as its sharpest UI-layer correctness risk, and fixing a same-plan regression in an out-of-scope test file this migration exposed. This is Phase 32's last plan.
- Three-level `backgroundImageUrl` fields (slide/group/song) plus a resolved tri-state `backgroundSource`, wired into `resolveEntryMedia`'s existing slide/group precedence — computed ahead of the video audio carve-out so a video slide keeps its background but not its bed audio.
- Pure per-kind 3-dot menu item list (`slideActionMenuItems`) plus the codebase's first real ARIA menu component (`SlideActionMenu.vue`), both fully unit-tested and unwired — no existing surface changed yet.
- Image-only 10MB-capped Firebase Storage upload composable (`orgs/{orgId}/backgrounds/
- Deleted `GroupSlideEntry.audioScope`, the drawer's two-write-route scope toggle, and the stale store doc-comment paragraph — leaving one attach route and a hint naming `SlideGroupMusicControl.vue` as where group-wide audio now lives.
- Swapped `SlideCard.vue`'s root from a native `<button>` to a `role="button"` div so `SlideActionMenu` can legally nest, and added a three-variant background provenance chip read directly off the assembled slide.
- A `setSongBackground` Pinia store action (explicit `deleteField()` clear, mirroring `setGroupBedMedia`) plus the existing `BackgroundControl.vue` mounted as a new sibling row in `SongLyricEditor.vue`, with the song's least-specific-tier caption copy and no `inheritedFrom`.
- `EditSlideDrawer.vue` gained a `mode: 'details' | 'lyrics'` prop (one component, no tabs), a three-state Slide Background section wired through `useBackgroundUpload`, and a nonce-keyed `pendingAction` seam that routes menu-dispatched Delete onto the drawer's existing confirm rather than a second, quieter path.
- Added a `setGroupBackground` store action (mirroring `setGroupBedMedia` exactly), mounted `BackgroundControl` as a new sibling row below the group's music control, and made `SlideGrid.vue` the single owner of menu state — one `openMenuEntryId` ref, per-card items sourced entirely from `slideActionMenuItems`, and a new `menu-action` emit the tab one level up will dispatch.
- `SlidesTab.vue`'s `onSelectSlide` is reduced to a one-line selection-only handler (R051's entire fix), and a new `onMenuAction` dispatches all six 3-dot menu keys from one place — the two edit keys open `EditSlideDrawer` in the matching mode, the two navigation keys route/relay without opening it, and Duplicate/Delete open the drawer and hand off to its EXISTING 33-07 `pendingAction` seam rather than mutating anything themselves.
- Pure-function boundary layer (`computeBoundaries`, `hasSplittableBoundaries`, `embedBoundaryMarkers`, `sliceAtBoundaries`, `stripVerseMarkers`, `verseRangeForSlice`) that makes altered scripture structurally impossible by constraining the model to integer indices into a pre-computed legal-position array.
- The model's entire permitted vocabulary (speaker enum + two integer boundary indices, `additionalProperties:false` everywhere) and the client-side `validateSplitResult()` gate — 19 distinct rejection tests plus one acceptance test prove every bounds/ordering/adjacency/coverage check the JSON Schema subset cannot express.
- Assembled the one place the model's output and real scripture meet: `splitCongregationalReading()` computes legal boundaries once, calls `messages.parse()` with the exact accepted shape for pre-4.6-family Haiku (dated id, `output_config.format`, no `thinking`/`effort`), validates via 34-02's `validateSplitResult`, and slices every section's text from the untouched ESV source — with 16 new tests proving the call shape, the byte-exact slicing, and every failure path's total-rejection `null`.
- Wired `splitCongregationalReading()` into `CongregationalEditor.vue` as an explicit, gated, opt-in `data-testid="ai-split-btn"` that either replaces sections wholesale or changes nothing and says so via one R041 toast — closing R064 end to end while recording the two things this phase cannot settle by itself: empirical split determinism (needs a live API call) and the editor's total unreachability in production (needs an owner decision).
- `ScriptureSlot.congregationalSections` plus one shared predicate helper threaded through both `slideshowAssembler.ts` scripture call sites, with `slideGroupMaterializer.ts` proven — not assumed — to need no change
- `CongregationalEditor.vue` converted from a self-persisting component (separate `ScriptureReading` Firestore document via `useScriptureSlides`) to a pure controlled prop/emit component — the exact model R047 rejected is now fully gone from this file
- Closed the R064 reachability gap `34-VERIFICATION.md` recorded — `CongregationalEditor.vue` is now mounted by `ServiceEditorView.vue` as a keyed, Teleported modal reachable from two slide-side routes that converge on one relay, with sections written onto `ScriptureSlot.congregationalSections` through the existing autosave and exactly one save-status live region on screen at any moment.
- Proved the slot -> group -> slide composition end to end in one test file, extended the validation record without disturbing what was already there, resolved the blocking PENDING-VERIFICATION item and opened four new (unapproved) ones, ran the full three-command phase gate, and corrected R064/R070/R071 to match what the gate actually observed.
- Added R070 to REQUIREMENTS.md/ROADMAP.md, then wired `PresentationViewer.vue`'s `currentBackgroundUrl` computed and a scrim layer so a group/slide background set in the Slides tab now appears while presenting — closing owner UAT finding F3.
- Fixed owner UAT finding F4 — the empty bordered save-status box left pinned at the top of a reopened service — by stripping only the wrapper's chrome at idle (border/background/padding/margin/sticky) instead of unmounting it, so the aria-live region inside it survives every status transition including the very first.
- SlideGrid.vue's two separate group-media rows (group music bar, group background control) are now one `slide-grid-group-media-panel`, with each control's own visibility condition preserved and the permission gate, caption, inherited-display rule, and all four write handlers byte-unchanged.
- Diagnosed owner UAT finding F5 as a misdiagnosis (Export to PC was never removed — `hasPcCredentials` behaves correctly), wrote R071 for the real defect (a silent, unexplained button swap), and shipped only the UX fix: a `canEditService`-gated note beside Copy for PC that names the missing-credentials reason and links to Settings by route name — the export affordance itself stays exactly as gated as it was.
- Deleted the lyric-slide `sectionLabel` render in `PresentationViewer.vue` (R059) and threaded a `SlidesTab` → `ServiceEditorView` → `PresentationViewer` start-index chain so Present opens on the highlighted slide/group instead of always slide 0 (R061).
- Pinned the already-shipped leading-and-trailing copyright bracket with 17 new unit tests across both group-construction paths — zero production code touched.
- Built LyricPasteRegion.vue — a chrome-less, multi-root successor to the Teleported LyricPasteDialog.vue — with an R065 copyright-missing warning that blocks the save unless an always-available override checkbox is checked, plus a save-rejection backstop; migrated and extended LyricPasteDialog.test.ts's 13-test suite into 16 tests with zero coverage loss.
- SongLyricEditor.vue now swaps its whole Sections view for LyricPasteRegion in place via `v-if="!pasteMode"`/`v-else` — LyricPasteDialog.vue and its test file are deleted entirely, closing R066 with exactly one paste surface reachable from both entry points, host-driven open/close/reopen-reset/exit-guard mechanics covered by 9 new tests, and zero net test-count drop across the phase (2253 passing, up from ~2219 pre-phase, against the same 9-test/2-file known-failing baseline).
- `SlideDropTarget` gains a keyboard-accessible `clickable` variant and `SlideGrid` deletes its separate `⇪ Import into this group` button, wiring both drop-tile instances (`:clickable="canMutateGroup"`, `@browse="openImportModal"`) as the click-to-import affordance — R053, minus the button that duplicated it.
- Pure `buildActionBarItems(tab, ctx)` builder plus the one shared `ContextualActionBar.vue` renderer, with R068's leak invariant proven as data over the full cartesian product of context flags rather than as DOM assertions in three places.
- `ServiceEditorView`'s header now renders one per-tab `ContextualActionBar` (built by 36-02) instead of four unconditional buttons, `▶ Present` relocates from `SlidesTab` into that header via a `slidesTabRef`/`defineExpose` seam, and the tab strip reorders to Service Order · Slides · Roles — with the pre-phase export/copy gate, R071's note, and 34-10's chrome-strip all verified byte-for-byte intact.
- Every Service Order section band now renders a labelled, counted header with its own inline `＋ Add item` chip row, backed by an additive `addSlot(kind, vwType?, targetSection?)` parameter that routes a per-band add into the clicked band — even an empty one — while every existing capability (drag, section select, remove, scripture editing, the lock banner, the save-status bar) is verified untouched.
- The bottom-of-list Add Element dropdown is rebuilt as a single-state dashed chip row (5 always-clickable chips, no open/closed state), a dedicated behavioural sweep proves the whole Service Order tab lost nothing across 36-01..36-05, and the phase closes with a clean type-check, a clean build, and the app suite at its documented 2-file baseline — with one environment-only gate-command discrepancy found and disclosed rather than smoothed over.
- Standalone `render-service/` Cloud Run project scaffolded outside `functions/`, with a two-stage LibreOffice+Poppler Dockerfile whose open-font-only policy (Carlito/Caladea/Liberation, never Microsoft fonts) is proven by a 15-assertion text-only test — no Docker daemon, nothing built, nothing deployed.
- LibreOffice→PDF→PNG render pipeline with a numeric (never lexical) page-ordering guarantee and a single validated `/render` route, all proven by 39 mocked tests — no container built, no real `soffice`/`pdftoppm` invoked, nothing deployed.
- Added `renderInvoker.ts` (IAM-authenticated Cloud Run invocation seam with zero unauthenticated fallback) and one additive, failure-swallowing Firestore queue write in `parsePptxHandler`, with 16 new regression tests proving nothing else about the existing handler moved.
- `requestPptxRenderHandler` gates a deck's ready flip on three independent agreements — a positive Storage recount, a reported-vs-actual equality, and a contiguous 1..N page sequence — never on the render service's self-report alone and never on the parser's structurally-decoupled slide count, proven by 11 new tests plus two deliberate-failure confirmations that show the gate's two sharpest conjuncts are genuinely load-bearing.
- A second, separate `cleanupOrphanRendersHandler` scheduled job (03:00 UTC) that defaults to dry-run exactly like the post-incident `cleanupExpiredMedia` gate, plus `ImportedDeck.renderImportId` wiring `PptxImportModal.vue`'s Storage import id onto the confirmed deck.
- Wrote `render-service/DEPLOY.md` (the complete, unexecuted `gcloud run deploy` handoff with both IAM directions and the STORAGE_BUCKET env var), added six unchecked owner to-dos to `PENDING-VERIFICATION.md`, ran the full three-suite gate green, audited the phase for zero executed deploy commands, and marked R062 `[~]` partial rather than overstating completion.
- A congregational scripture reading now derives, signs, rebuilds and assembles as N independently-editable slide-group entries — one per section — detached from the slot once converted, instead of one slide carrying a stacked sections array.
- `ScriptureSlide.sections?: CongregationalSection[]` is now the singular `section?: CongregationalSection`, and the projected slide renders the speaker on its own line above that section's words at the reference's unified body treatment — the stacked multi-section rendering branch is deleted, not left standing.
- A Congregational-state section slide now names its speaker on its card, and the Edit Slide drawer edits that section's words and flips its speaker independently of every sibling — both writes gated to the single `congregationalSectionFromRef` predicate, leaving a Reference-state scripture slide completely untouched.
- A 15-case composed test file (`congregationalDetachment.test.ts`) proves the congregational two-state mechanism survives repeated rebuild ticks — not just one — covering delete/edit/speaker-flip/reorder survival, both DESTROY paths, RE-CONVERT/RE-SPLIT, and both migration shapes; four stale doc-comment claims in `slideGroupMaterializer.ts` were corrected; and the phase's owner-verification checkpoint was deferred (never self-approved) into `PENDING-VERIFICATION.md` items 38.1-38.7.

---

## v1.4 Service and Slides (In progress — since 2026-07-28)

**Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you see,
slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Phases:** 29-37 (9). **Requirements:** `.planning/REQUIREMENTS.md` (R036-R069, 34 total, 34/34 mapped).

Scope covers service lifecycle locking, autosave reliability + app-wide save visibility, a fifth
Post-Service section, the long-standing drag-and-drop reordering corruption, hard-locking slide groups
to the service order (deleting the reconcile/confirm flow), slide interaction fixes, backgrounds at
group/slide/song level, presentation correctness (labels, CCLI copyright), true-fidelity PPTX rendering,
LLM-assisted congregational reading splits, lyric-editor copyright warnings, and a contextual
action-bar audit across every tabbed screen.

First milestone with `workflow.verifier: true` — every phase produces a real `VERIFICATION.md`.

Roadmap: `.planning/ROADMAP.md` §Phase 29-37. Phase 29 (Order Structure — Stable Reordering &
Post-Service) is first — foundational; Phase 37 (PowerPoint Server-Side Rendering) is deliberately
last, per user decision, so an overrun or cut disturbs nothing else.

---

## v1.3 Slides Tab Rework (Shipped: 2026-07-28)

**Phases:** 24-28 (5), 33 plans. **Requirements:** `milestones/v1.3-REQUIREMENTS.md` (R028-R035).

**Delivered:** A persisted slide-group model and a dedicated **Slides** tab where all slide editing
lives — plan rail mirroring the service order, Edit Slide drawer, and a song lyrics editor rebuilt as
one list that IS the slide order. The first tab was renamed **Service Order** and stripped of slide
editing.

**Verification:** closed on direct owner verification, not an automated gate — `workflow.verifier` was
`false` for the whole milestone. Each phase carries an owner-attributed `*-VERIFICATION.md` stating so
explicitly.

**Notable defects caught during the milestone:** a compounding reconciliation bug (2→4→8→16 slide
duplication on the additive path, which has no confirm gate) and two competing `performanceOrder`
fields where the builder read one but wrote the other.

---

## v1.2 Worship Service Slide Management (Shipped: 2026-07-28)

**Migrated from gsdpi** (milestone M001, slices S01-S06) into gsd-core on 2026-07-24. The
`.gsd/` store is legacy/read-only.

**Phases:** 18-23 (6). **Requirements:** `milestones/v1.2-REQUIREMENTS.md` (R001-R020).

**Delivered:** Song lyric slides + CCLI paste parser and editor; scripture and congregational reading
slides with ESV auto-pull; four formalized service sections with slide auto-assembly; PowerPoint import
for announcements and sermon; media attachments with a storage lifecycle; presentation preview mode.

**Verification:** closed by explicit owner acceptance with checkpoints waived — *"close v1.2. I've
verified everything I need to anyway."* Phases 18-23 were never verified by a passing gate. Recorded
plainly so this milestone's archived state is not later read as evidence that the checkpoints ran.

**Decisions:** D001-D006 (unified slide model, single canonical song version, PPTX universal import,
server-side parsing, four service sections, CCLI paste). See STATE.md.

---

## v1.1 (Shipped: 2026-07-24)

**Phases:** 8-17 plus 16.1 (11 total). Archived to `milestones/v1.1-phases/`.

**Delivered:** Planning Center API export for published plans; PC song import and tag management; song
export naming templates; song catalog and service planner improvements; advanced song search with
multi-select persistent tag filtering; volunteer role scheduling with PC roster import; in-app quarterly
availability editor; per-role serve frequency and role-category rules; quarterly schedule share links;
song list tag/column customization; schedule sync with planned services plus a Roles tab on the service
editor.

---

## v1.0 MVP (Shipped: 2026-03-05)

**Phases completed:** 6 phases (1, 2, 3, 4, 6, 7), 18 plans
**Commits:** 218
**Lines of code:** 12,747 (TypeScript + Vue)
**Timeline:** 2 days (2026-03-03 → 2026-03-04)
**Git range:** cbd8583..66b2202

**Delivered:** A complete worship service planning app with song library, smart Vertical Worship suggestions, AI-powered song/scripture discovery, print/share/export, and team collaboration with RBAC.

**Key accomplishments:**

1. Vue 3 + Firebase foundation with Google/email auth, Firestore security rules, and dark mode app shell
2. Song library with CSV import (Planning Center format), VW type categorization, team tags, search & filter
3. Weekly service planning with 9-slot template, 1-2-2-3/1-2-3-3 progression enforcement, smart song suggestions, scripture input with ESV preview
4. Print layout, Planning Center text export, and shareable read-only links via denormalized Firestore tokens
5. AI-powered song suggestions and natural language scripture discovery using Claude, with graceful degradation
6. Team management with email invite flow and editor/viewer RBAC enforced across Firestore rules, router guards, and UI

**Quick tasks shipped:** 14 polish/UX improvements including autosave, infinite scroll, hymn slots, settings screen, communion checkbox, and rotation visibility fixes

### Known Gaps

Phase 5 (Collaboration, Tasks & Events) deferred to v1.1:

- TASK-01: Recurring tasks with church-specific categories
- TASK-02: Assign tasks to team members with relative due dates
- TASK-03: Check off completed tasks per service week
- EVNT-01: Create special event services
- EVNT-02: Special events on calendar with advance lead time
- EVNT-03: View past special event plans as reference
- EVNT-04: Duplicate past special event to new date

Note: AUTH-03 and AUTH-04 (team invites and shared access) were completed in Phase 7, not Phase 5.

---
