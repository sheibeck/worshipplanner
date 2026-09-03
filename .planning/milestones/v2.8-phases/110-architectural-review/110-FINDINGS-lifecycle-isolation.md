# 110-01 Findings: Store/Firestore-Listener Lifecycle & Multi-Tenant Isolation

**Plan:** 110-01 (Phase 110: Architectural Review)
**Reviewer:** executor (self-review, no sub-agents — per plan's review_method_note)
**Method:** Direct source reading (`src/stores/**`, `src/views/**`, `src/components/**`,
`src/composables/**`, `firestore.rules`, `functions/src/**`) grounded against live code, cross-checked
against `.planning/codebase/ARCHITECTURE.md`/`CONCERNS.md` (Phase 109 relocated notes) and
`docs/adr/`. All findings below cite the real file:line confirmed at review time (2026-09-02).
**Severity rubric:** Critical = data loss / cross-tenant leak / auth bypass. High = correctness bug or
isolation weakness likely to bite under real use. Medium = maintainability/coupling risk or a latent
bug needing specific conditions. Low = nits/style. Critical+High → Phase 111 remediation scope;
Medium+Low → backlog.

---

## Dimension 2: Store / Firestore-Listener Lifecycle (incl. org-scoped teardown/re-subscription)

### Reconciliation: `resetOrgScopedStores()` vs. the actual org-scoped store set

`resetOrgScopedStores()` (`src/stores/orgScopedStores.ts:22-34`) calls exactly 11 teardown methods:
`useServiceStore().unsubscribeAll()`, `useSongStore().unsubscribeAll()`, `useRosterStore().unsubscribeAll()`,
`useTeamsStore().unsubscribeAll()`, `useQuartersStore().unsubscribeAll()`,
`useSlideGroups().unsubscribeGroups()`, `useScriptureSlides().unsubscribeReadings()`,
`useImportedSlides().unsubscribeDecks()`, `usePptxRenders().unsubscribeAll()`,
`useServiceMessagesStore().unsubscribeServiceMessages()`, `useSongLyricsStore().unsubscribeLyrics()`.

Cross-checked against every `src/stores/*.ts` file's own `onSnapshot`/`Unsubscribe` surface
(`services.ts:209-249`, `songs.ts:52,230-273`, `roster.ts:32-33,43-94`, `teams.ts:26-47`,
`quarters.ts:67-86`, `slideGroups.ts:30-60`, `scriptureSlides.ts:22-48`, `importedSlides.ts:28-50`,
`pptxRenders.ts:17-77`, `serviceMessages.ts:113-139`, `songLyrics.ts:23-62`). This is the complete set
of org-scoped stores with a Firestore `onSnapshot` — `appConfig.ts` (`subscribe()`/`unsubscribe()`,
lines 23-47) is the only other store with a live listener, but it subscribes the global
`appConfig/global` doc (not org-scoped), correctly excluded. `saveStatus.ts`/`toasts.ts` are pure UI
state, no listeners. **No drift found**: every org-scoped store's teardown method name is present and
correctly wired in `resetOrgScopedStores()`.

**F-LC-01 (informational — no severity, verification note):** `resetOrgScopedStores()` is called at
exactly 4 sites, all confirmed to run it BEFORE the corresponding `orgId.value` mutation that drives
every view-level `watch(() => authStore.orgId, ...)`, so no view watcher can observe a new `orgId`
before the old org's listeners are already closed: `selectOrg` (`src/stores/auth.ts:570-581`,
reset at line 578-579, `orgId.value` set later inside `loadOrgContext` at line 464),
`enterOrgAsSuperAdmin` (`auth.ts:592-613`, reset at 598-599, `orgId.value` set at 608),
`exitSuperAdminView` (`auth.ts:617-636`, reset at 625-626, `orgId.value` set inside the subsequent
`loadOrgContext` call at 634), `logout` (`auth.ts:749-774`, reset at 771-772, followed by `signOut`).
This ordering is structurally correct — a stale-org `onSnapshot` cannot fire into the new org's UI
through this path, because the Firestore SDK detaches the callback synchronously on `unsubscribe()`.

---

### F-LC-02 — High — `exitSuperAdminView()` has no re-entrancy guard; `memberUnsub` is a single unscoped race point

**Location:** `src/stores/auth.ts:31` (module-scope `let memberUnsub`), `auth.ts:301-316`
(`resetOrgContext`), `auth.ts:506-532` (the `onSnapshot` assignment inside `loadOrgContext`),
`auth.ts:617-636` (`exitSuperAdminView`); caller `src/components/AppShell.vue:46-48,74-79`
(`onExitSuperAdminView`, bound to a plain `@click` with no `:disabled` and no in-flight ref guard).

**Problem:** `memberUnsub` is a single module-scope variable shared across every caller of
`loadOrgContext`/`resetOrgContext`/`selectOrg`/`enterOrgAsSuperAdmin`/`exitSuperAdminView`/`logout`.
Two of the four org-context-changing entry points have a UI-level guard against a rapid double-click
firing the underlying store action twice: `src/components/AppSidebar.vue:271-281`
(`switchingId` ref, guards `selectOrg`) and `src/components/admin/OrganizationsTab.vue:773-796`
(`enteringOrgId` ref, guards `enterOrgAsSuperAdmin`). **`exitSuperAdminView` has no equivalent guard**
— `AppShell.vue`'s exit button (`type="button" @click="onExitSuperAdminView"`, lines 46-48) can be
clicked twice in quick succession, firing two concurrent `resetOrgContext()` → `resetOrgScopedStores()`
→ `loadOrgContext()` sequences. Each `loadOrgContext` call independently does
`memberUnsub?.(); memberUnsub = onSnapshot(...)` (lines 507-508) — with two calls interleaved, the
`onSnapshot` assignment that completes LAST silently overwrites `memberUnsub`, and the OTHER call's
still-open listener handle is never captured, so it is never torn down by any future
`resetOrgContext()`/`logout()`. This is a genuine orphaned-listener leak, not merely theoretical: both
concurrent calls in this specific path resolve to the SAME destination org (the super-admin's own
church), so this instance does not itself prove a cross-tenant snapshot bleed, but it is a real,
reproducible double-`onSnapshot`/listener-leak bug and demonstrates the underlying race is live, not
just latent.

**Impact:** Repeated rapid exits accumulate orphaned `members/{uid}` listeners over a session (memory/
read-cost leak); more importantly, the pattern this exposes (`memberUnsub` with no generation/epoch
token) is the SAME primitive `selectOrg`/`enterOrgAsSuperAdmin` rely on being protected purely by their
own call sites' UI guards — a future caller of `loadOrgContext` that forgets to add its own re-entrancy
guard reintroduces this race with NO defense-in-depth at the store layer.

**Recommendation (for Phase 111):** Add the same in-flight guard `AppShell.vue`'s exit button is
missing (mirror `switchingId`/`enteringOrgId`), AND/OR add a generation counter inside
`auth.ts` itself (e.g. an incrementing `loadOrgContextEpoch`, captured at the top of each
`loadOrgContext` call, checked before the `onSnapshot` assignment) so a superseded call can never win
the `memberUnsub` race regardless of which call site invoked it.

---

### F-LC-03 — Medium — `ServicesView.vue`'s org-switch watcher does not tear down `teamsStore` locally, unlike its sibling views

**Location:** `src/views/ServicesView.vue:383-390` (the `watch(() => authStore.orgId, ...)` block) vs.
`src/views/ServicesView.vue:364-380` (`initStore(orgId)`, which conditionally subscribes `teamsStore`
at line 371 via `if (authStore.isEditor && !teamsStore.orgId) { teamsStore.subscribe(orgId) ... }`).
Contrast with the canonical pattern (quick 260901-lua, ADR-0066) used by every other migrated view:
`src/views/RosterView.vue:761-773` explicitly calls `teamsStore.unsubscribeAll()` inside its own
`authStore.orgId` watcher; `src/views/DashboardView.vue:276-289` explicitly unsubscribes all three
stores it manages (`songStore`, `serviceStore`, `rosterStore`) inside its watcher;
`src/views/TeamView.vue:522-533` (the CR-01 canonical template this migration was modeled on) tears
down ALL of its own listeners inside the watcher before re-subscribing.

**Problem:** `ServicesView.vue`'s watcher unsubscribes only `serviceStore` on an org change
(`serviceStore.unsubscribeAll()`, line 386) — it does not call `teamsStore.unsubscribeAll()`. Today
this is not an active bug ONLY because `teamsStore` is also one of the 11 stores torn down by
`resetOrgScopedStores()` (see F-LC-01), which is guaranteed to run before this watcher's callback ever
observes the new `orgId` value at any of the 4 real org-switch call sites. But this view's *local*
teardown surface has drifted from the pattern its sibling views deliberately established in the SAME
quick task (260901-lua) — it relies entirely on the global reset having already run, with no local
defense-in-depth, whereas RosterView/DashboardView/TeamView each independently guarantee correctness
of the stores THEY use, regardless of whether a caller of `authStore.orgId`-mutation forgot to invoke
`resetOrgScopedStores()` first.

**Impact:** If any future code path changes `authStore.orgId` without going through
`resetOrgScopedStores()` first (a real risk: there are currently 4 independent call sites, each
separately doing a dynamic `import('./orgScopedStores')` — see auth.ts:578,598,625,771 — with no
single enforced choke point), `ServicesView.vue`'s `teamsStore` subscription would continue streaming
the PREVIOUS org's `teams` collection into the new org's Services page (the team checkbox row on
`NewServiceDialog`), a stale-org-data bleed into the UI. Medium because it needs that specific
precondition (a new/future org-switch path that skips the shared reset) rather than being reachable
through any of today's real call sites.

**Recommendation:** Add `teamsStore.unsubscribeAll()` to `ServicesView.vue`'s org-switch watcher for
parity with `RosterView.vue`/`DashboardView.vue`, closing the local defense-in-depth gap.

---

### F-LC-04 — Medium — Component-local org-scoped subscriptions (`SongLyricEditor.vue`, `ScriptureSlideEditor.vue`) subscribe once on mount via a static prop, with no reactive re-subscribe/teardown on an in-flight org switch

**Location:** `src/components/SongLyricEditor.vue:848-850` (`onMounted(() => { songLyricsStore
.subscribeLyrics(props.orgId, props.songId) })`) and `:856` (`onUnmounted` calls
`unsubscribeLyrics()`); `src/components/ScriptureSlideEditor.vue:230-241`
(`onMounted(async () => { if (props.readingId) { store.subscribeReadings(props.orgId) ... } })`) and
`:247` (`onUnmounted` calls `unsubscribeReadings()`).

**Problem:** Both components subscribe exactly once in `onMounted` using `props.orgId` at that instant,
with no `watch(() => props.orgId, ...)` to react to an org change while the component stays mounted.
Because `songLyricsStore`/`scriptureSlidesStore` are both included in `resetOrgScopedStores()`
(F-LC-01), the underlying Firestore listener these components believe they "own" IS correctly closed
by the global reset the moment an org switch happens — so this is not a proven live cross-tenant
listener leak. However, the component itself has no awareness this happened: it never re-subscribes to
the new org, and if the parent view/flow does not force-navigate away from a screen with one of these
editors open during a switch (unlike `ServiceEditorView.vue`'s explicit fail-safe nav — see F-LC-05
below, which only covers that one view), the editor could sit mounted showing silently-emptied data
(the store's reactive state was cleared by the global unsubscribe) with no error or indication to the
user that they're now looking at nothing / the wrong context.

**Impact:** Maintainability/latent-bug risk — needs the specific combination of (a) one of these
editors mounted, and (b) an org switch happening without the hosting view navigating away first. Not
confirmed as reachable in the current view graph (SongLyricEditor/ScriptureSlideEditor are opened from
modals/slide-overs whose parent views were NOT part of the 260901-lua fail-safe-nav migration), but
flagged because it is the same class of gap Task 1 was asked to scrutinize.

**Recommendation:** Add a `watch(() => props.orgId, ...)` re-subscribe/teardown pair to both
components, or confirm (and document) that every hosting parent unconditionally closes/unmounts these
editors on an org switch.

---

### F-LC-05 — Low (informational, confirms a correct design) — `ServiceEditorView.vue`'s org-switch fail-safe nav is correctly scoped, does not attempt a stale re-load

**Location:** `src/views/ServiceEditorView.vue:2937-2942` — `watch(() => authStore.orgId, (orgId,
oldOrgId) => { if (oldOrgId) router.push('/services') })`, deliberately WITHOUT `{ immediate: true }`.

**Confirmed correct:** Since `/services/:id` is keyed to a `serviceId` that cannot exist under a newly
selected org, this view intentionally does not try to re-subscribe/re-load under the new org — it
navigates away, relying on `ServicesView.vue`'s own watcher to subscribe fresh. The `if (oldOrgId)`
guard correctly excludes the initial `null → value` resolution (a user landing directly on the route
before `authStore.orgId` has resolved) from triggering a spurious navigation. No teardown gap: by the
time this watcher's callback runs, `resetOrgScopedStores()` has already torn down every org-scoped
listener this view's own subscriptions depend on (F-LC-01), and `onUnmounted`
(`ServiceEditorView.vue:2962-2972`) tears down the view-local `serviceMessagesStore` listener on the
resulting unmount. No finding to remediate — recorded per the plan's instruction to explicitly address
this hot spot.

---

### F-LC-06 — Medium — `pptxRenders.ts`'s per-id listener pool relies on callers reactively re-driving `syncSubscriptions`, with no single canonical re-subscribe site outside `useSlideshowAssembly.ts`

**Location:** `src/stores/pptxRenders.ts:37-70` (`syncSubscriptions(orgId, renderImportIds)`, diffs the
open listener set and tears down ALL listeners on an org change — `orgId !== subscribedOrgId` branch,
lines 41-45); sole call site `src/composables/useSlideshowAssembly.ts:206-212`
(`watch([distinctRenderImportIds, resolvedOrgId], ([ids, org]) => { pptxRendersStore
.syncSubscriptions(org, ids) }, { immediate: true })`).

**Confirmed correct for the one call site reviewed:** `syncSubscriptions`'s internal org-change branch
(lines 41-45) independently guards against a stale-org bleed even without relying on
`resetOrgScopedStores()` — any org change closes every open listener before evaluating the new id set.
This is a stronger local guarantee than several of the simple stores. Recorded as Medium/informational
only because `usePptxRenders()` is a shared Pinia singleton with exactly one reactive driver
(`useSlideshowAssembly.ts`) today — if a second, unrelated call site is added in the future that also
calls `syncSubscriptions` with a DIFFERENT, un-synchronized org value (e.g. a second composable
instance reading a stale `orgId` capture), the two callers would fight over the same
`rendersByImportId` map with no coordination. No evidence this happens today
(`activeSlideshowAssemblyInstances` tracking in the same file suggests this exact hazard was already
considered — ADR-0137).

---

## Dimension 3: Multi-Tenant (Org) Isolation Architecture

### Isolation implications of the church-switch flow (Task 1 cross-reference)

Per the plan's Task 2 instruction to assess whether the church-switch flow reviewed in Task 1 leaves
any store bound to the prior org: **no proven cross-tenant read/write vector was found.** The listener
teardown ordering (F-LC-01) structurally prevents a stale-org `onSnapshot` from ever firing into the
new org's UI at all 4 real org-switch call sites. F-LC-02 (the `exitSuperAdminView` re-entrancy gap)
is a listener-leak/race, not a cross-tenant leak, because both racing calls resolve to the identical
destination org. F-LC-03 (`ServicesView.vue`'s local teardown drift) IS the one finding with a genuine
isolation dimension: it is entirely reset-order-dependent rather than self-defending, so it is recorded
under both dimensions — see F-LC-03 above for full detail; not duplicated here.

---

### F-ISO-01 — Low (confirmed, no new residual) — `orgId` derivation has exactly one source of truth; no hardcoded org IDs or route-param-driven org access found in production `src/`

**Location:** `src/stores/auth.ts:90,464` (`authStore.orgId` set only inside `loadOrgContext`/
`enterOrgAsSuperAdmin`, sourced from the user's `orgIds` doc field + the `orgs` custom-claim map —
never a literal string); every org-scoped store's `subscribe(orgId: string)` signature takes `orgId` as
a caller-supplied parameter, and every call site reviewed (`ServicesView.vue`, `SongsView.vue`,
`DashboardView.vue`, `RosterView.vue`, `QuarterView.vue`, `ServiceEditorView.vue`, `TeamView.vue`)
reads it from `authStore.orgId` at the point of the `watch()`/`initStore()` call, never from a literal.

**Verification performed:** `grep -rE "doc\(db, 'organizations', '[a-zA-Z]" src/` (excluding
`src/rules.test.ts`, which intentionally hardcodes `orgA`/`orgB` fixture IDs for the rules emulator
suite) returns zero matches in production source — the `ARCHITECTURE.md` "Hardcoded Org IDs"
anti-pattern is not present today. `grep -rE "params\.orgId|route\.params\.org|:orgId" src/` (routes +
views) also returns zero matches — no authenticated route accepts an org id as a URL/route parameter;
the only org-scoped public route is the pre-existing share-token flow (`QuarterShareView.vue`, gated by
an unguessable Firestore-doc token, not by an org id in the URL — already documented as an accepted
low-severity residual in `firestore.rules`' `serviceShareLinks` note, ARCHITECTURE.md). No new finding;
recorded because the plan explicitly asked this to be assessed.

---

### F-ISO-02 — Low (confirmed, matches documented accepted residual — no new finding) — super-admin's `isOrgEditor` grant is universal by design, already accepted (Phase 78 R225/T-78-03)

**Location:** `firestore.rules:28-43` (`isOrgEditor(orgId)`, the `isSuperAdmin() ||` disjunct at line
38 makes this true for every super-admin on every org, unconditional on `isOrgActive()`); `src/stores/
auth.ts:592-613` (`enterOrgAsSuperAdmin`, deliberately writes NO `setDoc`/`writeBatch` per its own
comment at lines 588-591, so R226 — "entering a church as a super-admin creates no member doc" — holds
only as a client-code contract, not a rules invariant, per `ARCHITECTURE.md`'s own IN-02 note).

**Confirmed, not re-litigated:** This is architecturally as documented in `ARCHITECTURE.md`'s
"Backend Behavioral Notes" for `firestore.rules` — a super-admin's client SDK COULD legally `create` a
membership doc for any org via this rule shape, and the only reason it does not happen in practice is
`enterOrgAsSuperAdmin`'s client code choosing not to call `setDoc`. This was already reviewed and
accepted at Phase 78 (T-78-03, both 78-01-PLAN.md and 78-02-PLAN.md threat models). Re-confirmed here
per the plan's read_first instruction; recorded as Low/no-new-finding rather than re-opening an
already-accepted residual. If Phase 111 wants to close it anyway (e.g. an explicit rules-level
membership-doc-write guard scoped to `isOrgMember(orgId)` rather than the broader `isOrgEditor`),
that is a Phase 112 (security review) scoping decision, not this phase's.

---

### F-ISO-03 — Medium — `functions/src/orgProvisioning.ts` and Cloud Functions org-context callables are built and tested but UNDEPLOYED per their own hand-over notes; isolation architecture correctness cannot be verified in production until deployed

**Location:** `functions/src/index.ts` re-exports of `onboardOrganization`/`assignOrgAdmin`/
`listOrganizations`/`setOrgActive` (per `ARCHITECTURE.md`'s Backend Behavioral Notes, "shipped
built+tested+UNDEPLOYED per 74-01-PLAN.md's/76-01-PLAN.md's hand-over deploy notes").

**Handoff note (Phase 112, not fixed here):** This is a deployment-state observation, not a code defect
— the client-side and Cloud Functions code paths for org provisioning/deactivation are architecturally
sound as reviewed (independent server-side re-verification patterns match `parsePptxHandler`'s "never
trust the client-declared value alone" precedent throughout `functions/src/*.ts`), but the review
cannot confirm the LIVE production Firestore/Functions state matches what's in this repo without a
deploy-state audit, which is out of this review-only phase's scope. Flagged for Phase 112/deploy
verification rather than fixed or deep-dived here, per the plan's "genuine security findings noticed
incidentally are out of scope for fixing here" instruction.

---

### F-ISO-04 — Low (confirmed, no new finding) — `functions/src/index.ts`'s proxy and callable handlers consistently re-derive org membership server-side rather than trusting the client-declared `orgId`

**Location:** `functions/src/index.ts:723-751` (`parsePptxHandler`, "Independent org-membership check
-- never trust the client-declared orgId", lines 736-751); `functions/src/orgMembershipClaims.ts:151-
201` (`decideMembershipClaim`, "never fall back to trusting the event's orgId param alone", lines
156-160, independently re-derives the user's primary org from the `users/{uid}` doc rather than the
Firestore-trigger event's own path segment); `functions/src/index.ts:1859` /
`queueServiceMessageHandler` (per ARCHITECTURE.md's Backend Behavioral Notes, "the client-declared
orgId is used ONLY to scope the Firestore path, membership and role are re-verified for THAT path").

**Confirmed:** every server-side handler reviewed re-verifies org membership from Firestore/Auth-claim
state rather than trusting a client-supplied `orgId` field at face value — the architectural invariant
the plan asked to assess ("whether any client path can construct a Firestore reference for an org the
user is not currently scoped to") holds throughout the Cloud Functions surface reviewed. No new
finding; recorded as explicit confirmation per the plan's assessment instruction.

---

## Summary Table

| ID | Dimension | Severity | Location |
|----|-----------|----------|----------|
| F-LC-02 | Lifecycle | **High** | `src/stores/auth.ts:31,301-316,506-532,617-636`; `src/components/AppShell.vue:46-48,74-79` |
| F-LC-03 | Lifecycle + Isolation | **Medium** | `src/views/ServicesView.vue:364-390` |
| F-LC-04 | Lifecycle | Medium | `src/components/SongLyricEditor.vue:848-856`; `src/components/ScriptureSlideEditor.vue:230-247` |
| F-LC-06 | Lifecycle | Medium | `src/stores/pptxRenders.ts:37-70`; `src/composables/useSlideshowAssembly.ts:206-212` |
| F-ISO-03 | Isolation | Medium (Phase 112/deploy-audit handoff) | `functions/src/index.ts` re-exports of `orgProvisioning.ts` |
| F-LC-01 | Lifecycle | Informational (verification, no action) | `src/stores/orgScopedStores.ts:22-34` |
| F-LC-05 | Lifecycle | Low (confirms correct design) | `src/views/ServiceEditorView.vue:2937-2942` |
| F-ISO-01 | Isolation | Low (confirmed, no new residual) | `src/stores/auth.ts`; all org-scoped store `subscribe()` call sites |
| F-ISO-02 | Isolation | Low (confirmed, matches accepted Phase 78 residual) | `firestore.rules:28-43`; `src/stores/auth.ts:592-613` |
| F-ISO-04 | Isolation | Low (confirmed, no new finding) | `functions/src/index.ts`; `functions/src/orgMembershipClaims.ts:151-201` |

**Critical+High findings for Phase 111 remediation:** F-LC-02 only.
**Medium findings for backlog triage:** F-LC-03, F-LC-04, F-LC-06, F-ISO-03.
**Low/informational (no action required):** F-LC-01, F-LC-05, F-ISO-01, F-ISO-02, F-ISO-04.
