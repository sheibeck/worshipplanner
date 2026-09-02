# Phase 110: Architectural Review — Consolidated Report

**Phase:** 110-architectural-review
**Plan:** 110-03 (consolidation of 110-01 and 110-02)
**Date:** 2026-09-02
**Method:** This report is a consolidation, not a re-review. It merges every finding from
`110-FINDINGS-lifecycle-isolation.md` (110-01: store/Firestore-listener lifecycle including org-scoped
teardown/re-subscription, and multi-tenant/org isolation architecture) and
`110-FINDINGS-boundaries-coupling-dataflow.md` (110-02: module boundaries, coupling, data flow) into one
severity-ranked list, assigns each finding a stable global ID (`ARCH-NNN`), and splits them into a
Critical/High set (Phase 111's remediation scope) and a Medium/Low set (backlog triage). No codebase
re-review, re-derivation, or re-classification was performed beyond what the severity rubric below
required (none did) — every severity below is carried over unchanged from its source finding.

**No source files were modified during Phase 110.** This plan reads two Markdown findings files and
writes this one Markdown report; it touches nothing under `src/`, `functions/`, `firestore.rules`, or
`storage.rules`.

**Severity rubric (per 110-CONTEXT.md):**
- **Critical** — data loss, cross-tenant data leak, or auth bypass.
- **High** — a correctness bug or multi-tenant isolation weakness likely to bite under real use.
- **Medium** — maintainability/coupling risk, or a latent bug needing specific conditions.
- **Low** — nits/style, or a confirmed-correct/no-new-finding observation recorded for coverage.
- Critical + High → **Phase 111 remediation scope**. Medium + Low → **backlog** (not fixed in-milestone).

**Coverage — all five ROADMAP areas are represented below:**
1. **Module boundaries** — findings ARCH-006 through ARCH-010, ARCH-020.
2. **Store/Firestore-listener lifecycle** (incl. org-scoped teardown/re-subscription) — findings
   ARCH-001, ARCH-002, ARCH-003, ARCH-004, ARCH-015, ARCH-016.
3. **Multi-tenant (org) isolation architecture** — findings ARCH-002, ARCH-005, ARCH-017, ARCH-018,
   ARCH-019.
4. **Data flow** — findings ARCH-012, ARCH-013, ARCH-014, ARCH-023.
5. **Coupling** — findings ARCH-004, ARCH-009, ARCH-010, ARCH-011, ARCH-021, ARCH-022.

---

## Summary Table

| ID | Severity | Area | Location | Finding |
|----|----------|------|----------|---------|
| ARCH-001 | **High** | Lifecycle | `src/stores/auth.ts:31,301-316,506-532,617-636`; `src/components/AppShell.vue:46-48,74-79` | `exitSuperAdminView()` has no re-entrancy guard; a double-click races two `loadOrgContext()` calls and orphans a `members/{uid}` listener via a shared unscoped `memberUnsub`. |
| ARCH-002 | Medium | Lifecycle + Isolation | `src/views/ServicesView.vue:364-390` | `ServicesView.vue`'s org-switch watcher tears down `serviceStore` but not `teamsStore` locally, relying entirely on the global reset for correctness (no local defense-in-depth). |
| ARCH-003 | Medium | Lifecycle | `src/components/SongLyricEditor.vue:848-856`; `src/components/ScriptureSlideEditor.vue:230-247` | `SongLyricEditor.vue`/`ScriptureSlideEditor.vue` subscribe once on mount via a static prop with no reactive re-subscribe/teardown if the org changes while mounted. |
| ARCH-004 | Medium (informational) | Lifecycle + Coupling | `src/stores/pptxRenders.ts:37-70`; `src/composables/useSlideshowAssembly.ts:5-8,206-212` | `pptxRenders.ts`'s per-id listener pool has exactly one reactive driver today (`useSlideshowAssembly.ts`, which also binds three other stores plus its own direct Firestore query); a second uncoordinated caller of `syncSubscriptions` would race. Internally correct today; flagged as fragile if a second driver is added. |
| ARCH-005 | Medium (Phase 112 handoff) | Isolation | `functions/src/index.ts` re-exports of `functions/src/orgProvisioning.ts` | Org-provisioning Cloud Functions (`onboardOrganization`/`assignOrgAdmin`/`listOrganizations`/`setOrgActive`) are built+tested but UNDEPLOYED per their own hand-over notes; isolation architecture cannot be verified against live production state until deployed. |
| ARCH-006 | Medium | Module Boundaries | `src/views/ServiceEditorView.vue` (whole file, 4612 lines) | `ServiceEditorView.vue` has grown past its already-documented monolith size, now owning ~12 distinct feature responsibilities inline; only `useAutoSave`/`useSlideshowAssembly` have been extracted to composables. |
| ARCH-007 | Medium | Module Boundaries | `src/components/settings/ServiceTemplateEditor.vue:291,570` | `ServiceTemplateEditor.vue` calls `updateDoc()` on the org document directly, then hand-syncs `authStore.settings` itself, bypassing the store-as-source-of-truth pattern for a write. |
| ARCH-008 | Medium | Module Boundaries | `src/components/GettingStarted.vue:77-135`; `src/components/admin/ConfigurationTab.vue:136,295-297` | `GettingStarted.vue` and `ConfigurationTab.vue` each open their own direct `onSnapshot` (member count, super-admins list) with no owning store, duplicating subscribe/unsubscribe lifecycle machinery. |
| ARCH-009 | Medium | Module Boundaries + Coupling | `src/composables/useSlideshowAssembly.ts:37-59`; `src/stores/songLyrics.ts:37-46` | `useSlideshowAssembly.ts`'s `defaultLyricsSubscriber` runs its own direct `onSnapshot` query duplicating `songLyricsStore.subscribeLyrics`, and the two queries have already drifted (`limit(1)` present in one, absent in the other). |
| ARCH-010 | Medium | Module Boundaries + Coupling | `functions/src/index.ts` (whole file, 2898 lines) | `functions/src/index.ts` is a god module holding five unrelated concerns inline (API proxy, PPTX pipeline, four cleanup sweeps, reminder/scheduled-message cron, messaging pipeline), unlike sibling concerns (`orgProvisioning.ts`, `superAdminClaims.ts`, `orgMembershipClaims.ts`) that were properly extracted. Shared helpers couple all five clusters together. |
| ARCH-011 | Medium | Coupling | `src/stores/services.ts:362-372,450-456,484-490` | `recomputeLastUsedFor`'s per-song update loop has no per-item try/catch; a mid-loop failure leaves `lastUsedAt` inconsistent across a service's songs with only a swallowed console log. |
| ARCH-012 | Medium | Data Flow | `src/views/ServiceEditorView.vue:2195-2209` + every `JSON.parse(JSON.stringify(...))` deep-clone site (`2801-2802`, `2829-2830`, `2509`, `2518`, `2868`, `4592`, `4607`) | `reopenPcWarning`'s date-formatting branch is unreachable dead code: the deep-clone-via-JSON idiom used for every `localService` assignment strips the `pcExportedAt` Firestore `Timestamp` to a plain object with no `.toDate()`, so the guard is always false. |
| ARCH-013 | Medium | Data Flow | `src/views/ServiceEditorView.vue:2505,2700-2864` | The remote-merge watcher's autosave-race guard (already substantially hardened per ARCH-023) does not coordinate with the separate reorder-save path's own `saveStatus` state machine; a narrow window remains where a remote snapshot during an in-flight reorder save is unguarded, with no test confirming safety. |
| ARCH-014 | Medium | Data Flow | `src/stores/songs.ts:342-440`; `src/components/PcImportModal.vue:303-314` | The Planning Center song-import path (`upsertSongs`) performs hundreds of sequential unbatched, non-isolated Firestore writes (unlike the sibling CSV `importSongs`, which chunks into `writeBatch`es of 499); a mid-loop failure gives no per-song success/failure feedback, though retries are idempotency-safe. |
| ARCH-015 | Low (informational, verification note) | Lifecycle | `src/stores/orgScopedStores.ts:22-34` | `resetOrgScopedStores()`'s 11 teardown calls were cross-checked against every org-scoped store's own listener surface — no drift found; all 4 real org-switch call sites run the reset before the new `orgId` is observable. |
| ARCH-016 | Low (confirms correct design) | Lifecycle | `src/views/ServiceEditorView.vue:2937-2942` | `ServiceEditorView.vue`'s org-switch fail-safe navigation (`watch(() => authStore.orgId, ...)`, no `{ immediate: true }`) is correctly scoped — it navigates away rather than attempting a stale reload, with no teardown gap. |
| ARCH-017 | Low (confirmed, no new residual) | Isolation | `src/stores/auth.ts:90,464`; every org-scoped store's `subscribe(orgId)` call site | `orgId` derivation has exactly one source of truth (`authStore.orgId`, sourced from user doc / custom claims); no hardcoded org IDs or route-param-driven org access found in production `src/`. |
| ARCH-018 | Low (confirmed, matches accepted Phase 78 residual) | Isolation | `firestore.rules:28-43`; `src/stores/auth.ts:592-613` | Super-admin's `isOrgEditor` grant is universal by rule design (`isSuperAdmin() ||` disjunct); a super-admin's client SDK could legally write a membership doc for any org, and the invariant that it doesn't holds only as client-code contract. Already reviewed and accepted at Phase 78 (R225/T-78-03); re-confirmed, not re-opened. |
| ARCH-019 | Low (confirmed, no new finding) | Isolation | `functions/src/index.ts:723-751,1859`; `functions/src/orgMembershipClaims.ts:151-201` | Every server-side Cloud Functions handler reviewed re-verifies org membership from Firestore/Auth-claim state server-side rather than trusting a client-declared `orgId`. |
| ARCH-020 | Low | Module Boundaries | `src/utils/claudeApi.ts:56`; `src/utils/messaging.ts:10-11`; `src/utils/scriptureApi.ts` | Three utility files import `useAuthStore()` for read-only settings gating, a mild inversion of the documented Utility-layer dependency direction. No correctness/circular-import risk. |
| ARCH-021 | Low (confirmed, no new finding) | Coupling | `src/stores/services.ts:362-372` | The one known cross-store write (`services` → `songs.lastUsedAt`) correctly goes through `songStore.updateSong()` rather than constructing a direct Firestore reference — follows the documented sanctioned pattern exactly. |
| ARCH-022 | Low (confirmed, no new finding) | Coupling | `src/stores/*.ts` (full import graph) | Full inter-store import scan shows a strict one-directional dependency graph; no circular import chains found across `src/stores/*.ts`. |
| ARCH-023 | Low (confirmed, corrects stale map) | Data Flow | `src/stores/services.ts:223-243`; `src/views/ServiceEditorView.vue:2825-2836` | The service-editor round-trip (assign → update → Firestore → `onSnapshot` → view) is substantially more hardened than `CONCERNS.md`'s 2026-07-16 analysis describes: own-write-echo tracking plus a byte-level dirty check gate local-state overwrites. Corrects the stale map rather than flagging a new issue. |

---

## Critical/High (→ Phase 111)

No Critical findings were identified in either review pass. One High finding requires Phase 111
remediation.

### ARCH-001 — High — `exitSuperAdminView()` has no re-entrancy guard; `memberUnsub` is a single unscoped race point

*(source: 110-01 F-LC-02)*

**Area:** Store/Firestore-listener lifecycle.

**Location:** `src/stores/auth.ts:31` (module-scope `let memberUnsub`), `auth.ts:301-316`
(`resetOrgContext`), `auth.ts:506-532` (the `onSnapshot` assignment inside `loadOrgContext`),
`auth.ts:617-636` (`exitSuperAdminView`); caller `src/components/AppShell.vue:46-48,74-79`
(`onExitSuperAdminView`, bound to a plain `@click` with no `:disabled` and no in-flight ref guard).

**Problem:** `memberUnsub` is a single module-scope variable shared across every caller of
`loadOrgContext`/`resetOrgContext`/`selectOrg`/`enterOrgAsSuperAdmin`/`exitSuperAdminView`/`logout`. Two
of the four org-context-changing entry points have a UI-level guard against a rapid double-click firing
the underlying store action twice: `src/components/AppSidebar.vue:271-281` (`switchingId` ref, guards
`selectOrg`) and `src/components/admin/OrganizationsTab.vue:773-796` (`enteringOrgId` ref, guards
`enterOrgAsSuperAdmin`). **`exitSuperAdminView` has no equivalent guard** — `AppShell.vue`'s exit button
(`type="button" @click="onExitSuperAdminView"`, lines 46-48) can be clicked twice in quick succession,
firing two concurrent `resetOrgContext()` → `resetOrgScopedStores()` → `loadOrgContext()` sequences. Each
`loadOrgContext` call independently does `memberUnsub?.(); memberUnsub = onSnapshot(...)` (lines
507-508) — with two calls interleaved, the `onSnapshot` assignment that completes LAST silently
overwrites `memberUnsub`, and the OTHER call's still-open listener handle is never captured, so it is
never torn down by any future `resetOrgContext()`/`logout()`. This is a genuine orphaned-listener leak,
not merely theoretical: both concurrent calls in this specific path resolve to the SAME destination org
(the super-admin's own church), so this instance does not itself prove a cross-tenant snapshot bleed,
but it is a real, reproducible double-`onSnapshot`/listener-leak bug and demonstrates the underlying
race is live, not just latent.

**Impact:** Repeated rapid exits accumulate orphaned `members/{uid}` listeners over a session (memory/
read-cost leak); more importantly, the pattern this exposes (`memberUnsub` with no generation/epoch
token) is the SAME primitive `selectOrg`/`enterOrgAsSuperAdmin` rely on being protected purely by their
own call sites' UI guards — a future caller of `loadOrgContext` that forgets to add its own re-entrancy
guard reintroduces this race with NO defense-in-depth at the store layer.

**Recommendation (Phase 111):** Add the same in-flight guard `AppShell.vue`'s exit button is missing
(mirror `switchingId`/`enteringOrgId`), AND/OR add a generation counter inside `auth.ts` itself (e.g. an
incrementing `loadOrgContextEpoch`, captured at the top of each `loadOrgContext` call, checked before
the `onSnapshot` assignment) so a superseded call can never win the `memberUnsub` race regardless of
which call site invoked it.

---

## Medium/Low (→ backlog)

Everything below is triage material, not Phase 111 scope. Ordered by severity (Medium first), then by
source ordering.

### ARCH-002 — Medium — `ServicesView.vue`'s org-switch watcher does not tear down `teamsStore` locally, unlike its sibling views

*(source: 110-01 F-LC-03)*

**Area:** Lifecycle + Isolation.

**Location:** `src/views/ServicesView.vue:383-390` (the `watch(() => authStore.orgId, ...)` block) vs.
`src/views/ServicesView.vue:364-380` (`initStore(orgId)`, which conditionally subscribes `teamsStore` at
line 371). Contrast with the canonical pattern (quick 260901-lua, ADR-0066) used by every other migrated
view: `RosterView.vue:761-773`, `DashboardView.vue:276-289`, `TeamView.vue:522-533` each explicitly tear
down every store they manage inside their own watcher.

**Problem:** `ServicesView.vue`'s watcher unsubscribes only `serviceStore` on an org change — it does
not call `teamsStore.unsubscribeAll()`. Today this is not an active bug ONLY because `teamsStore` is
also one of the 11 stores torn down by the global `resetOrgScopedStores()` (ARCH-015), which is
guaranteed to run before this watcher's callback ever observes the new `orgId` at any of the 4 real
org-switch call sites. But this view's *local* teardown surface has drifted from the pattern its sibling
views deliberately established in the same quick task — it relies entirely on the global reset having
already run, with no local defense-in-depth.

**Impact:** If any future code path changes `authStore.orgId` without going through
`resetOrgScopedStores()` first (a real risk: there are 4 independent call sites, each separately doing a
dynamic `import('./orgScopedStores')`, with no single enforced choke point), `ServicesView.vue`'s
`teamsStore` subscription would continue streaming the PREVIOUS org's `teams` collection into the new
org's Services page — a stale-org-data bleed into the UI. Medium because it needs that specific
precondition rather than being reachable through any of today's real call sites.

**Recommendation:** Add `teamsStore.unsubscribeAll()` to `ServicesView.vue`'s org-switch watcher for
parity with `RosterView.vue`/`DashboardView.vue`, closing the local defense-in-depth gap.

---

### ARCH-003 — Medium — Component-local org-scoped subscriptions (`SongLyricEditor.vue`, `ScriptureSlideEditor.vue`) subscribe once on mount via a static prop, with no reactive re-subscribe/teardown on an in-flight org switch

*(source: 110-01 F-LC-04)*

**Area:** Lifecycle.

**Location:** `src/components/SongLyricEditor.vue:848-850` (`onMounted` subscribes with `props.orgId`)
and `:856` (`onUnmounted` unsubscribes); `src/components/ScriptureSlideEditor.vue:230-241` (same
pattern) and `:247`.

**Problem:** Both components subscribe exactly once in `onMounted` using `props.orgId` at that instant,
with no `watch(() => props.orgId, ...)` to react to an org change while the component stays mounted.
Because `songLyricsStore`/`scriptureSlidesStore` are both included in `resetOrgScopedStores()`
(ARCH-015), the underlying Firestore listener these components believe they "own" IS correctly closed
by the global reset the moment an org switch happens — so this is not a proven live cross-tenant
listener leak. However, the component itself has no awareness this happened: it never re-subscribes to
the new org, and could sit mounted showing silently-emptied data (the store's reactive state was cleared
by the global unsubscribe) with no error or indication to the user.

**Impact:** Maintainability/latent-bug risk — needs the specific combination of (a) one of these editors
mounted, and (b) an org switch happening without the hosting view navigating away first. Not confirmed
as reachable in the current view graph (their parent views were not part of the 260901-lua fail-safe-nav
migration), but flagged because it is the same class of gap the review was asked to scrutinize.

**Recommendation:** Add a `watch(() => props.orgId, ...)` re-subscribe/teardown pair to both components,
or confirm (and document) that every hosting parent unconditionally closes/unmounts these editors on an
org switch.

---

### ARCH-004 — Medium (informational) — `pptxRenders.ts`'s per-id listener pool relies on callers reactively re-driving `syncSubscriptions`, with no single canonical re-subscribe site outside `useSlideshowAssembly.ts`

*(source: 110-01 F-LC-06, consolidated with 110-02 ARCH-C-04's coupling angle on the same composable)*

**Area:** Lifecycle + Coupling.

**Location:** `src/stores/pptxRenders.ts:37-70` (`syncSubscriptions(orgId, renderImportIds)`, tears down
ALL listeners on an org change); sole call site `src/composables/useSlideshowAssembly.ts:206-212`
(`watch([distinctRenderImportIds, resolvedOrgId], ...)`).

**Confirmed correct for the one call site reviewed:** `syncSubscriptions`'s internal org-change branch
independently guards against a stale-org bleed even without relying on `resetOrgScopedStores()` — any
org change closes every open listener before evaluating the new id set, a stronger local guarantee than
several of the simpler stores. Recorded as Medium/informational only because `usePptxRenders()` is a
shared Pinia singleton with exactly one reactive driver today — if a second, unrelated call site is added
in the future with a different, un-synchronized org value, the two callers would fight over the same
`rendersByImportId` map with no coordination. No evidence this happens today; `ADR-0137`
(`activeSlideshowAssemblyInstances` tracking) suggests this exact hazard class was already considered.

**Coupling angle (from ARCH-C-04):** `useSlideshowAssembly.ts` is itself a high-fan-in composable binding
four Pinia stores (`useScriptureSlides`, `useImportedSlides`, `useSlideGroups`, `usePptxRenders`) plus
its own direct Firestore subscription (see ARCH-009) in one 743-line file — all four stores' listener
lifecycles funnel through this single composable.

**Recommendation:** No action required today; if a second driver of `syncSubscriptions` is ever added,
coordinate it through the existing `ADR-0137` instance-tracking mechanism rather than introducing an
independent org value.

---

### ARCH-005 — Medium (Phase 112 handoff) — `functions/src/orgProvisioning.ts` and Cloud Functions org-context callables are built and tested but UNDEPLOYED per their own hand-over notes; isolation architecture correctness cannot be verified in production until deployed

*(source: 110-01 F-ISO-03)*

**Area:** Multi-tenant isolation architecture. **This is a SECURITY-relevant deployment-state
observation — handed off to Phase 112, not fixed in Phase 111.**

**Location:** `functions/src/index.ts` re-exports of `onboardOrganization`/`assignOrgAdmin`/
`listOrganizations`/`setOrgActive` (per `ARCHITECTURE.md`'s Backend Behavioral Notes, "shipped
built+tested+UNDEPLOYED per 74-01-PLAN.md's/76-01-PLAN.md's hand-over deploy notes").

**Handoff note (Phase 112, not fixed here):** This is a deployment-state observation, not a code defect
— the client-side and Cloud Functions code paths for org provisioning/deactivation are architecturally
sound as reviewed (independent server-side re-verification patterns match `parsePptxHandler`'s "never
trust the client-declared value alone" precedent throughout `functions/src/*.ts`), but the review cannot
confirm the LIVE production Firestore/Functions state matches what's in this repo without a deploy-state
audit, which is out of this review-only phase's scope. Flagged for Phase 112/deploy verification rather
than fixed or deep-dived here.

---

### ARCH-006 — Medium — `ServiceEditorView.vue` has grown past its already-documented monolith size and now owns at least a dozen distinct feature responsibilities inline

*(source: 110-02 ARCH-B-01)*

**Area:** Module Boundaries.

**Location:** `src/views/ServiceEditorView.vue` — file is **4612 lines** total (script block spans
`1718-4612`, ~2894 lines), not the 2176 lines `CONCERNS.md` (dated 2026-07-16) currently documents — the
map is stale and undercounts by more than 2x. Responsibility inventory: tab focus/keyboard management
(`1811-1881`), PC-export team pre-selection heuristics (`1881-1928`), re-lock notification handling
(`1929-2053`), congregational-section editing (`2053-2149`), run/present dispatch, stage-marker CRUD
(`2310-2356`), row-menu toggling, SortableJS drag-drop lifecycle (`2432-2587`), date-change handling
(`2587-2700`), autosave wiring + remote-merge watcher (`2700-2864`), lock-notify timer management,
status-transition handling (`3055-3285`), slot CRUD (`3310-3481`), AI song-suggestion fetch/accept/reject
(`3516-3711`), scripture slot handling, print + stage-layout print, the Planning Center export flow
(`3791-4253`, its confirm handler alone is **360 lines**), share-link generation for two surfaces
(`4253-4344`), role-assignment override handling, messaging overrides, delete/save/undo.

**Confirms and updates `CONCERNS.md`'s "Large monolithic ServiceEditorView component" entry:** the Tech
Debt entry is directionally correct but under-scoped. `useAutoSave` and `useSlideshowAssembly` are the
only responsibilities successfully extracted to composables — confirming the extraction pattern is
directionally correct and partially applied, but the majority of later-added features (AI suggestions,
PC export, congregational editing, share links, role overrides) were added directly into the view
instead.

**Impact:** Medium — not itself a live correctness bug, but elevates regression risk on every future
service-editor feature, since a change to any one concern shares the same file, the same 20+ reactive
refs, and the same deep-watch autosave surface as every other concern. See ARCH-012/ARCH-013 for two
concrete data-flow findings that are direct consequences of everything sharing
`localService`/`originalService`.

**Recommendation (backlog):** Extract PC export (~460 lines) and AI suggestions (~195 lines) into
composables next, mirroring `useAutoSave`/`useSlideshowAssembly` — the largest and most self-contained
remaining clusters.

---

### ARCH-007 — Medium — `ServiceTemplateEditor.vue` writes to Firestore directly, bypassing the auth store's own settings-mutation surface

*(source: 110-02 ARCH-B-02)*

**Area:** Module Boundaries.

**Location:** `src/components/settings/ServiceTemplateEditor.vue:291` (imports `doc, updateDoc` from
`firebase/firestore`), `:570` (`await updateDoc(doc(db, 'organizations', authStore.orgId),
{ 'settings.defaultServiceTemplate': payload })`, followed by a manual `authStore.settings...= payload`
at `:571`).

**Problem:** This is the `ARCHITECTURE.md` "Mutating Firestore Data Without Store" anti-pattern in live
form — a component calls `updateDoc()` directly, then hand-syncs the store's local ref itself, since
`useAuthStore` has no `updateSettings`/`updateOrgDoc` method surface for this. The manual sync line is
doing the job the store's own listener would otherwise do; it works only because `authStore`'s org-doc
`onSnapshot` will also independently re-deliver the same value shortly after — a race that happens to be
harmless here but is fragile by construction.

**Impact:** Medium — not a correctness bug today (both write target and manual sync are correct), but
the ONE component reviewed that bypasses the store-as-source-of-truth pattern for a WRITE (vs.
ARCH-008, a read-only bypass).

**Recommendation:** Add an `updateOrgSettings(patch)` method to `auth.ts` that performs the `updateDoc` +
local-state sync together, and have this component call it instead of touching `db`/`updateDoc`
directly.

---

### ARCH-008 — Medium — `GettingStarted.vue` and `ConfigurationTab.vue` subscribe to Firestore collections directly, bypassing any store

*(source: 110-02 ARCH-B-03)*

**Area:** Module Boundaries.

**Location:** `src/components/GettingStarted.vue:77,128-135` (`onSnapshot(collection(db,
'organizations', orgId, 'members'), ...)` counting into a local `memberCount` ref);
`src/components/admin/ConfigurationTab.vue:136,295-297` (`onSnapshot(collection(db, 'superAdmins'), ...)`
into a local `superAdmins` ref).

**Problem:** Both are the `ARCHITECTURE.md` "Direct Firestore Calls in Components" anti-pattern in live
form — no `membersStore`/`superAdminsStore` exists to own either subscription, so each component opens
and tears down its own listener. Neither is a security issue (both are read-only, gated the same way a
store subscription would be by `firestore.rules`), but both duplicate the store pattern's lifecycle
machinery in component-local code with no reusable state.

**Impact:** Medium — no other component reviewed needs `memberCount` or the `superAdmins` list today, so
blast radius is small, but per `STRUCTURE.md`'s own "Where to Add New Code" guidance this is exactly the
drift shape that guidance exists to prevent, confirmed present in two components independently.

**Recommendation:** Acceptable to leave as component-local given narrow, single-consumer usage; promote
to a store per the established pattern if a second consumer of either subscription appears.

---

### ARCH-009 — Medium — `useSlideshowAssembly.ts`'s default lyrics subscriber duplicates `songLyricsStore`'s query rather than routing through it, and the two have already drifted

*(source: 110-02 ARCH-B-04, consolidated with the identical finding recorded as ARCH-C-03 under the
Coupling dimension)*

**Area:** Module Boundaries + Coupling.

**Location:** `src/composables/useSlideshowAssembly.ts:37-59` (`defaultLyricsSubscriber`, its own direct
`onSnapshot(query(..., orderBy('createdAt', 'desc'), limit(1)), ...)`) vs.
`src/stores/songLyrics.ts:37-46` (`subscribeLyrics`, the store's own equivalent `onSnapshot` query — **no
`limit(1)`**).

**Problem:** This is both a boundary violation (a composable performing its own direct Firestore
`onSnapshot`, the same anti-pattern as ARCH-008 but in the composable layer) and a coupling/duplication
issue — the composable's own doc comment explicitly says it is "mirroring `songLyrics` store's
`subscribeLyrics`," an acknowledgment this is meant to be the same query maintained twice. The two
implementations have already drifted: the composable adds `limit(1)`, the store's `subscribeLyrics` does
not (it instead takes the first element of the full ordered array client-side elsewhere).

**Impact:** Medium — no evidence of an active disagreement today (both currently resolve to
newest-`createdAt`-wins), but it is live duplication with zero mechanism forcing the two to stay in sync.

**Recommendation:** Have `useSlideshowAssembly`'s default subscriber call `songLyricsStore.subscribeLyrics`
directly (or extract the shared query into one function both call) rather than maintaining a parallel
`onSnapshot`.

---

### ARCH-010 — Medium — `functions/src/index.ts` is a 2898-line god module holding five unrelated concerns inline, unlike its sibling concerns that were properly extracted

*(source: 110-02 ARCH-B-06, consolidated with the identical finding recorded as ARCH-C-05 under the
Coupling dimension)*

**Area:** Module Boundaries + Coupling.

**Location:** `functions/src/index.ts` (2898 lines) — inline responsibility clusters: the API
reverse-proxy (`~475-716`), the PPTX parse/render pipeline (`~716-955`), FOUR separate scheduled cleanup
sweeps each with its own guard regex and handler (`~955-1644`), the on-demand cleanup preview
(`~1644-1731`), the reminder + scheduled-message cron orchestration (`~1731-2205`), and the entire
service-messaging pipeline (`~2205-2898`).

**Contrast with the file's own sibling pattern:** `orgProvisioning.ts`, `superAdminClaims.ts`, and
`orgMembershipClaims.ts` each moved their implementation into a dedicated module specifically so
testable handlers can be imported directly by tests, with `index.ts` doing nothing but re-exporting. The
five clusters above do NOT follow that pattern — their handler bodies live directly in `index.ts` (though
several are still exported separately from their `onCall`/`onDocumentCreated` wrappers for direct
unit-test import, so the testability half of the sibling pattern is honored even though the
file-separation half is not).

**Impact:** Medium — mirrors ARCH-006's finding on the backend: every concern shares the same top-level
Admin SDK initialization and shared helpers (`checkAndConsumeRateLimit`, `writeUsageLedger`,
`checkOrgAiEnablement`, `checkOrgBibleEnablement`), so a change to any shared helper has a blast radius
across all five clusters with no per-concern module boundary to contain it.

**Recommendation (backlog, not Phase 111 — no correctness impact):** Extract the four cleanup sweeps
(already self-contained) into a `cleanupSweeps.ts` module, and the messaging pipeline into a
`messaging.ts` module, following the exact `orgProvisioning.ts` re-export pattern already established in
this same file.

---

### ARCH-011 — Medium — `recomputeLastUsedFor`'s per-song loop has no per-item failure isolation; a mid-loop failure can leave `lastUsedAt` inconsistent across the songs of one service with only a console log

*(source: 110-02 ARCH-C-02; ARCH-C-01, the write-path-boundary-correctness half of the same function,
is confirmed clean — see ARCH-021 below)*

**Area:** Coupling.

**Location:** `src/stores/services.ts:362-372` (the `for (const songId of affectedSongIds) { ... await
songStore.updateSong(songId, { lastUsedAt }) }` loop, no try/catch inside the loop body); callers
`services.ts:450-456` (`markAsPlanned`) and `:484-490` (`reopenService`), each wrapping the WHOLE call in
a try/catch that logs and swallows the error.

**Problem:** If `songStore.updateSong` throws on the Nth song, every song before N has already been
durably written with its new `lastUsedAt`, but N and every song after it silently keep their STALE
`lastUsedAt` — the caller's catch block only knows "recompute failed," not which specific songs
succeeded vs. failed, and takes no corrective action.

**Impact:** Medium (needs a specific mid-loop failure condition; `lastUsedAt` is a display/sort field —
not a security or financial value — so the blast radius is a stale sort position, not data loss).

**Recommendation:** Wrap each `songStore.updateSong` call in its own try/catch (mirroring the per-object
try/catch pattern already used throughout `functions/src/index.ts`'s cleanup sweeps), so one song's
failure never blocks the rest of the batch, and log which specific song ids failed.

---

### ARCH-012 — Medium — `reopenPcWarning`'s date clause is unreachable dead code: every `localService` deep-clone in `ServiceEditorView.vue` strips Firestore `Timestamp` instances down to plain objects with no `.toDate()`

*(source: 110-02 ARCH-D-01)*

**Area:** Data Flow.

**Location:** `src/views/ServiceEditorView.vue:2195-2209` (`reopenPcWarning` computed, guards
`typeof toDate === 'function'`) vs. every `localService.value = JSON.parse(JSON.stringify(...))`
deep-clone site: `:2801-2802` (initial load), `:2829-2830` (remote-merge), `:2509`/`:2518` (reorder
save/revert), `:2868` (autosave-failure revert), `:4592` (post-save resync), `:4607` (undo).
`src/types/service.ts:220-222` confirms `pcExportedAt` is typed as Firestore `Timestamp`.

**Problem:** `JSON.stringify` on a `Timestamp` serializes it to a plain `{seconds, nanoseconds}` object
via its own `toJSON`, and `JSON.parse` produces a plain object, NOT a reconstructed `Timestamp` — the
`.toDate()` method is gone. Since `localService` is deep-cloned this way on EVERY assignment (starting
with the very first load), by the time `reopenPcWarning` evaluates `localService.value?.pcExportedAt`,
the `typeof toDate === 'function'` guard is always false, `when` is always `null`, and the date-formatted
branch can never render — users always see only the generic fallback sentence with no date.

**Impact:** Medium — a genuine, always-reproducible correctness bug, but cosmetic in blast radius (the
fallback sentence is still accurate, it just omits the date). Downgraded from High per the rubric because
no data is wrong or lost. Flagged as a structural pattern risk: any future code reading a
`Timestamp`-typed field off `localService`/`originalService` and calling `.toDate()` UNGUARDED would
throw at runtime — none found today, but the risk is structural to the deep-clone-via-JSON idiom itself.

**Recommendation:** Either (a) reconstruct `pcExportedAt` as a real `Timestamp` after each deep-clone,
(b) replace the JSON deep-clone idiom with `structuredClone` or a `Timestamp`-aware custom clone, or (c)
convert `pcExportedAt` to a plain millis number at the point it's first read off the snapshot.

---

### ARCH-013 — Medium — the autosave race-condition risk `CONCERNS.md` names is narrowed but not fully closed; no test evidence confirms the remaining window is safe

*(source: 110-02 ARCH-D-03)*

**Area:** Data Flow.

**Location:** `src/views/ServiceEditorView.vue:2700-2864` (the `useAutoSave` wiring + remote-merge
watcher), `:2505` (`autoSave.cleanup()` inside the manual reorder-save path).

**Problem:** The remote-merge watcher (see ARCH-023, which confirms the broader race is now
well-guarded) only re-checks `autoSave.status.value` — it does not coordinate with the SEPARATE
reorder-save path, which calls `autoSave.cleanup()` and performs its own `updateService` call outside
the composable's status machine. If a remote `onSnapshot` fires in the narrow window between that
`updateService` promise settling and the reorder path's own `saveStatus.set(...)` call at `:2510`, the
merge watcher's `autoSave.status.value` check reads the COMPOSABLE's status, not the reorder flow's own
`saveStatus` state — two different state machines sharing the same `localService`/`originalService`
refs. No test was found confirming this specific cross-path ordering is safe.

**Impact:** Medium — needs a narrow timing window rather than being reachable on every save; exactly the
rubric's Medium definition. Confirms — with a narrower, more specific mechanism — that `CONCERNS.md`'s
"Autosave conflict resolution... not tested" entry is still accurate for this one path, even though the
broader autosave race (ARCH-023) is now well-guarded.

**Recommendation:** Route the reorder-save path's remote-merge suppression through the same
`autoSave.status`-equivalent signal the composable's own saves use, or add a regression test that
triggers a remote snapshot during an in-flight reorder save.

---

### ARCH-014 — Medium — the Planning Center song-import write path (`upsertSongs`) is unbatched and has no per-song failure isolation, unlike its sibling CSV import path in the same file

*(source: 110-02 ARCH-D-04)*

**Area:** Data Flow.

**Location:** `src/stores/songs.ts:342-423` (`upsertSongs` — a bare `for` loop, each iteration awaiting
its own `updateDoc`/`addDoc` with no `writeBatch` and no per-iteration try/catch) vs.
`src/stores/songs.ts:425-440` (`importSongs`, the CSV path in the SAME file, explicitly chunking into
`writeBatch`es of 499); caller `src/components/PcImportModal.vue:303-314` (one outer try/catch around
the entire `upsertSongs` call, generic error message only).

**Problem:** For a large Planning Center library, `upsertSongs` performs hundreds of SEQUENTIAL,
individually-awaited Firestore writes with no batching or progress indication, and no isolation between
songs — if a write throws on song N, the whole call rejects and every song from N onward is never
processed, with no way to tell the user which songs did or didn't import.

**Mitigating factor confirmed:** `upsertSongs`'s own matching logic (`byPcSongId`/`byCcliNumber`/
`byTitle`) makes a retry of the SAME import list idempotency-safe — no data-corruption risk on retry,
only a UX gap.

**Impact:** Medium — performance and UX gap for large libraries, not a data-loss or duplication risk.

**Recommendation:** Adopt the same `writeBatch`-chunking pattern `importSongs` already uses, and surface
per-song progress/failure counts in `PcImportModal.vue`'s `'importing'` step.

---

### ARCH-015 — Low (informational, verification note) — `resetOrgScopedStores()` reconciled against every org-scoped store's own listener surface — no drift found

*(source: 110-01 F-LC-01)*

**Area:** Lifecycle.

**Location:** `src/stores/orgScopedStores.ts:22-34` (11 teardown calls) cross-checked against every
`src/stores/*.ts` file's own `onSnapshot`/`Unsubscribe` surface.

**Finding:** `resetOrgScopedStores()` calls exactly 11 teardown methods — `serviceStore`, `songStore`,
`rosterStore`, `teamsStore`, `quartersStore`, `slideGroups`, `scriptureSlides`, `importedSlides`,
`pptxRenders`, `serviceMessagesStore`, `songLyricsStore`. This is confirmed to be the COMPLETE set of
org-scoped stores with a Firestore `onSnapshot`; `appConfig.ts` subscribes a global (not org-scoped) doc
and is correctly excluded; `saveStatus.ts`/`toasts.ts` are pure UI state. No drift found — every
org-scoped store's teardown method name is present and correctly wired.

Also confirmed: `resetOrgScopedStores()` is called at exactly 4 sites, all confirmed to run it BEFORE
the corresponding `orgId.value` mutation, so no view watcher can observe a new `orgId` before the old
org's listeners are already closed (`selectOrg`, `enterOrgAsSuperAdmin`, `exitSuperAdminView`, `logout`
— all in `src/stores/auth.ts`). This ordering is structurally correct.

No action required.

---

### ARCH-016 — Low (confirms correct design) — `ServiceEditorView.vue`'s org-switch fail-safe nav is correctly scoped, does not attempt a stale re-load

*(source: 110-01 F-LC-05)*

**Area:** Lifecycle.

**Location:** `src/views/ServiceEditorView.vue:2937-2942` — `watch(() => authStore.orgId, (orgId,
oldOrgId) => { if (oldOrgId) router.push('/services') })`, deliberately WITHOUT `{ immediate: true }`.

**Confirmed correct:** Since `/services/:id` is keyed to a `serviceId` that cannot exist under a newly
selected org, this view intentionally navigates away rather than re-subscribing under the new org,
relying on `ServicesView.vue`'s own watcher to subscribe fresh. The `if (oldOrgId)` guard correctly
excludes the initial `null → value` resolution. No teardown gap: `resetOrgScopedStores()` has already
torn down every org-scoped listener this view depends on by the time the watcher fires, and
`onUnmounted` tears down the view-local `serviceMessagesStore` listener.

No finding to remediate — recorded per the plan's instruction to explicitly address this hot spot.

---

### ARCH-017 — Low (confirmed, no new residual) — `orgId` derivation has exactly one source of truth; no hardcoded org IDs or route-param-driven org access found in production `src/`

*(source: 110-01 F-ISO-01)*

**Area:** Isolation.

**Location:** `src/stores/auth.ts:90,464` (`authStore.orgId` set only inside `loadOrgContext`/
`enterOrgAsSuperAdmin`, never a literal string); every org-scoped store's `subscribe(orgId: string)`
call site reads it from `authStore.orgId`.

**Verification performed:** `grep -rE "doc\(db, 'organizations', '[a-zA-Z]" src/` (excluding
`src/rules.test.ts`'s intentional `orgA`/`orgB` fixtures) returns zero matches in production source —
the `ARCHITECTURE.md` "Hardcoded Org IDs" anti-pattern is not present today. `grep -rE
"params\.orgId|route\.params\.org|:orgId" src/` also returns zero matches — no authenticated route
accepts an org id as a URL/route parameter; the only org-scoped public route is the pre-existing
share-token flow (`QuarterShareView.vue`, gated by an unguessable Firestore-doc token, already documented
as an accepted low-severity residual).

No new finding.

---

### ARCH-018 — Low (confirmed, matches accepted Phase 78 residual) — super-admin's `isOrgEditor` grant is universal by design, already accepted (Phase 78 R225/T-78-03)

*(source: 110-01 F-ISO-02)*

**Area:** Isolation.

**Location:** `firestore.rules:28-43` (`isOrgEditor(orgId)`, the `isSuperAdmin() ||` disjunct at line 38
makes this true for every super-admin on every org); `src/stores/auth.ts:592-613`
(`enterOrgAsSuperAdmin`, deliberately writes NO `setDoc`/`writeBatch` per its own comment).

**Confirmed, not re-litigated:** A super-admin's client SDK COULD legally `create` a membership doc for
any org via this rule shape, and the only reason it does not happen in practice is
`enterOrgAsSuperAdmin`'s client code choosing not to call `setDoc` — so R226 ("entering a church as a
super-admin creates no member doc") holds only as a client-code contract, not a rules invariant. Already
reviewed and accepted at Phase 78 (T-78-03, both 78-01-PLAN.md and 78-02-PLAN.md threat models).
Re-confirmed per this review's read_first instruction; recorded as Low/no-new-finding. If Phase 111
wants to close it anyway (e.g. an explicit rules-level membership-doc-write guard scoped to
`isOrgMember(orgId)` rather than the broader `isOrgEditor`), that is a **Phase 112 (security review)
scoping decision**, not this phase's.

---

### ARCH-019 — Low (confirmed, no new finding) — `functions/src/index.ts`'s proxy and callable handlers consistently re-derive org membership server-side rather than trusting the client-declared `orgId`

*(source: 110-01 F-ISO-04)*

**Area:** Isolation.

**Location:** `functions/src/index.ts:723-751` (`parsePptxHandler`, "Independent org-membership check —
never trust the client-declared orgId"); `functions/src/orgMembershipClaims.ts:151-201`
(`decideMembershipClaim`, independently re-derives the user's primary org from the `users/{uid}` doc
rather than the Firestore-trigger event's own path segment); `functions/src/index.ts:1859`
(`queueServiceMessageHandler`, "the client-declared orgId is used ONLY to scope the Firestore path,
membership and role are re-verified for THAT path").

**Confirmed:** every server-side handler reviewed re-verifies org membership from Firestore/Auth-claim
state rather than trusting a client-supplied `orgId` field at face value — the architectural invariant
("whether any client path can construct a Firestore reference for an org the user is not currently
scoped to") holds throughout the Cloud Functions surface reviewed. No new finding.

---

### ARCH-020 — Low — three `src/utils/*.ts` files import `useAuthStore` for read-only settings gating, a mild inversion of the documented Utility-layer dependency direction

*(source: 110-02 ARCH-B-05)*

**Area:** Module Boundaries.

**Location:** `src/utils/claudeApi.ts:56` (`isAiEnabled()`), `src/utils/messaging.ts:10-11`
(`isMessagingEnabled()`), `src/utils/scriptureApi.ts` (same pattern).

**Problem:** `ARCHITECTURE.md`'s Layers section states the Utility Layer "Depends on: Types, Firebase
(via stores)" — the documented direction is utils being CALLED BY stores, not utils reaching INTO a
store. These three call sites invert that for a narrow, read-only purpose (checking a boolean settings
flag), not a mutation.

**Impact:** Low — no correctness or data-integrity risk (read-only), and Pinia stores are legitimately
callable from anywhere once `createPinia()` is installed, so no circular-import failure risk. Recorded
as a consistent, repeated pattern (three files) worth a documented exception rather than silently
ignoring the stated constraint.

**Recommendation:** No action required; optionally update `ARCHITECTURE.md`'s Utility Layer entry to
note "read-only settings gates may read `useAuthStore()` directly" as a documented, intentional
exception.

---

### ARCH-021 — Low (confirmed, no new finding) — the one known cross-store write (`services` → `songs` `lastUsedAt`) follows the documented sanctioned pattern exactly

*(source: 110-02 ARCH-C-01)*

**Area:** Coupling.

**Location:** `src/stores/services.ts:362-372` (`recomputeLastUsedFor`, `const songStore =
useSongStore(); ... await songStore.updateSong(songId, { lastUsedAt })`).

**Confirmed:** This is precisely `ARCHITECTURE.md`'s documented constraint — "If store A needs to update
data owned by store B ... it calls `storeB.updateX()` via import, not Firestore directly" — implemented
correctly: `services.ts` never constructs a `doc(db, 'organizations', orgId, 'songs', ...)` reference
itself for this write. No boundary violation. See ARCH-011 for a genuine (but different) issue in the
same function.

---

### ARCH-022 — Low (confirmed, no new finding) — no circular import chains found across `src/stores/*.ts`

*(source: 110-02 ARCH-C-06)*

**Area:** Coupling.

**Verification performed:** Full inter-store import scan (`grep -rE "from ['\"]@/stores" src/stores/*.ts`)
shows a strict one-directional dependency graph: `services.ts` imports `songs.ts`/`roster.ts`/
`quarters.ts`/`auth.ts`; `quarters.ts` imports `roster.ts`; `appConfig.ts` imports `auth.ts`;
`saveStatus.ts` imports `toasts.ts`. None of `songs.ts`, `roster.ts`, or `auth.ts` import back in the
other direction — no cycle exists in the reviewed store graph. No finding.

---

### ARCH-023 — Low (confirmed, corrects stale map) — the service-editor round-trip (assign → update → Firestore → onSnapshot → view) has been substantially hardened since the 2026-07-16 map analysis

*(source: 110-02 ARCH-D-02)*

**Area:** Data Flow.

**Location:** `src/stores/services.ts:223-243` (`onSnapshot(q, { includeMetadataChanges: true }, ...)`
with explicit own-write-echo tracking — `ownWriteEchoIds`/`pendingWriteIds`);
`src/views/ServiceEditorView.vue:2825-2836` (the remote-merge watcher's `remoteJson !== localJson`
byte-compare guard, only overwriting local state when the incoming snapshot actually differs and only
when `autoSave.status.value` is `'idle'`/`'saved'`).

**Confirmed, corrects the map:** `CONCERNS.md`'s "JSON.parse on Firestore snapshots" Fragile-Areas entry
(dated 2026-07-16, citing old line numbers) describes a much simpler, less-guarded pattern than what live
source now shows. The current implementation is a deliberate deep-clone-for-comparison idiom (see
ARCH-012 for its own, different defect), gated by an own-write-echo classifier and a byte-level dirty
check before ever touching local state, with `ServiceLockedError`-aware failure handling that never
strands the UI at `'saving'` (documented as contract "BL-02"). No new finding recorded here — corrects
the map's characterization rather than re-flagging the same line numbers as still-fragile.

---

## Handoff to Phase 112 (Security Review)

Two items surfaced during this architectural review carry security-relevant weight beyond this phase's
architecture-only scope. Neither is fixed here (out of scope for Phase 110/111); both are explicitly
flagged for Phase 112's attention:

1. **ARCH-005 (F-ISO-03)** — `functions/src/orgProvisioning.ts`'s Cloud Functions
   (`onboardOrganization`/`assignOrgAdmin`/`listOrganizations`/`setOrgActive`) are built and tested but
   **UNDEPLOYED**. The isolation architecture cannot be verified against the actual live production
   Firestore/Functions state until a deploy-state audit is performed — recommended as a Phase 112 action
   item.
2. **ARCH-018 (F-ISO-02)** — Super-admin's `isOrgEditor(orgId)` rule grant is universal by design
   (`isSuperAdmin() ||`), meaning the guarantee that entering a church as super-admin creates no
   membership doc (R226) holds only as a client-code contract, not a Firestore-rules invariant. Already
   reviewed and accepted at Phase 78 (T-78-03); re-confirmed here, not re-opened. If Phase 112 wants to
   close this residual with an explicit rules-level write guard, that is a Phase 112 scoping decision.

---

## Summary Counts

- **Critical:** 0
- **High:** 1 (ARCH-001 → Phase 111)
- **Medium:** 13 (ARCH-002 through ARCH-014 → backlog)
- **Low:** 9 (ARCH-015 through ARCH-023 → backlog / no action)
- **Total findings:** 23
- **Phase 111 remediation scope:** ARCH-001 only.
- **Backlog triage list:** ARCH-002 through ARCH-023 (22 findings).
- **Phase 112 security handoff:** ARCH-005, ARCH-018 (both already Medium/Low above; flagged again here
  for cross-phase visibility).
</content>
