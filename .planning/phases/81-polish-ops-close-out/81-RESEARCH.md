# Phase 81: Polish & Ops Close-Out - Research

**Researched:** 2026-08-24
**Domain:** Vue 3 + Firebase worship-planning SPA — 4 independent polish/ops items (PC export completeness, verified-domain email, Owner Console a11y, shared song-browse component)
**Confidence:** HIGH — every claim below was verified directly against live source (`Read`/`Grep`/`Bash`) in this session, not inferred from milestone research alone. Milestone-level `STACK.md`/`PITFALLS.md` findings are cited where they add external (Resend/eslint) facts this session didn't re-fetch.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**R237 — PC export includes non-song/non-scripture slots (client-only)**
- Every service slot (prayer, offering, welcome, message/sermon, announcements, etc.) must become a
  Planning Center plan item in EVERY export mode — no slot silently dropped. Today the export
  special-cases only song + scripture item titles (`planningCenterApi.ts` "Worship Song -"/"Scripture -"
  conventions).
- For a non-song/non-scripture slot, create a generic PC item titled from the slot's own label/section (a
  sensible default length), across all export modes. Research must confirm what "all export modes" means
  in the current code and where items are assembled.
- Client-only; no rules/functions/deploy. (backlog 999.4)

**R238 — verified-domain email + owner runbook (owner-run ops; minimal code)**
- Per the standing grant: change ONLY the sender address to the verified domain; leave
  `SERVICE_SHARE_BASE_URL` on the Firebase default (no functions redeploy for share links).
- The send path already reads the sender from Firestore-backed `appConfig.sender.fromAddress`
  (owner-settable live in the Owner Console `SenderConfigCard`). Deliverable is primarily a DOC: an owner
  runbook (`functions/DEPLOY-EMAIL-DOMAIN.md` or similar) covering Resend domain add + SPF/DKIM/DMARC DNS
  records + setting `fromAddress` to a verified sender in the Console. Confirm the send path uses the
  configured sender (not a hard-coded `onboarding@resend.dev`); if any hard-coded fallback remains on the
  live send path, make the configured value authoritative. Record the owner steps in
  PENDING-VERIFICATION.md.
- DNS/domain verification is OWNER-RUN and not app-verifiable — this requirement's "done" is a documented,
  correct runbook + the code wiring, NOT a guarantee mail is verified. (backlog 999.6)

**R239 — Owner Console accessibility (client-only; adds ONE dev dependency)**
- Add `eslint-plugin-vuejs-accessibility@^2.6.0` (confirmed ESLint-10 compatible, flat-config export —
  research STACK.md) to `eslint.config.ts`; let it enumerate the defect surface, then fix:
  - real `<label>`/`aria-label` on the Owner Console text inputs (super-admin grant form; Organizations
    onboard + assign forms — currently placeholder-only);
  - ARIA tab semantics (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`) on the
    Configuration/Organizations tab strip AND the matching `ServiceEditorView.vue` tab strip.
- CRITICAL (research PITFALLS): the Owner Console tab strip is `v-show`-always-mounted so its `onSnapshot`
  listeners stay live — do NOT convert to `v-if`/conditional render; add ARIA attributes WITHOUT changing
  the mount strategy. A generic ARIA-tabs retrofit that assumes conditional panels would regress the live
  listeners.
- Client-only (dev-dependency + lint config + template attributes); no runtime deploy. (backlog 999.7)

**R240 — shared song-browse component (client-only refactor)**
- Extract ONE shared song-browse component (search + filters + list) used by BOTH the Songs page
  (`SongsView.vue`/`SongTable.vue`) and the service-plan song picker (in `ServiceEditorView.vue`). Preserve
  each consumer's current behavior; the goal is de-duplication, not redesign. Research must map the two
  current browse surfaces and the smallest shared component that serves both. (backlog 999.1)

**Deploy discipline**
- R238 is owner-run DNS/Resend ops — not app-deployable; deliver the runbook + wiring, record owner steps.
- R237, R239, R240 are client-only (R239 adds a dev-only lint dependency — no runtime change).

### Claude's Discretion
- The exact generic PC item title/length for non-song slots (R237); the precise shared-component boundary
  and name (R240); which lint rules to enable vs. defer if the plugin flags a very large pre-existing
  surface (keep R239 scoped to the Owner Console + the two named tab strips — do NOT expand to an
  app-wide a11y sweep).

### Deferred Ideas (OUT OF SCOPE)
- App-wide accessibility sweep beyond the Owner Console + the two named tab strips (R239 stays scoped).
- In-app surfacing of Resend domain-verification status (webhook/API poll) — beyond the manual runbook.
- Moving `SERVICE_SHARE_BASE_URL`/share links to a custom domain (grant: leave on Firebase default).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R237 | Non-song/non-scripture service slots are included in all Planning Center export modes (no dropped items) | **Already implemented and tested** by quick task `260809-vvq` (2026-08-09, commit `8c602bc0`), which predates this milestone's requirements gathering. All three PC export code paths in `ServiceEditorView.vue` already append PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots; `addSlotAsItem` in `planningCenterApi.ts` has a compiler-enforced exhaustive switch over all 8 `SlotKind` members. See "Summary" and "R237 — Already Done" below for the exact scope that remains (verification/traceability, not a build task). |
| R238 | Real volunteers reliably receive email — verified sending domain, replacing `onboarding@resend.dev`, with a documented owner runbook | **Code wiring is already complete and unit-tested.** Both live send paths (`sendQueuedMessageHandler` in `index.ts`, `sendAdminOnboardingEmail` in `adminEmail.ts`) already read `config.sender.fromAddress` live via `getAppConfig()` — no hard-coded override on either send path. `SenderConfigCard.vue` already has an owner-editable field with an `isUnverifiableHost` warning for `*.web.app`/`*.firebaseapp.com`. The ONLY missing deliverable is the runbook doc + a `PENDING-VERIFICATION.md` entry. See "R238 — Already Wired" below. |
| R239 | Owner Console real labels + ARIA tab semantics on Configuration/Organizations tab strip and the matching ServiceEditorView tab strip, without breaking `v-show`-always-mounted panels | Concrete defect inventory below: exactly 4 placeholder-only inputs (`ConfigurationTab.vue` grant form, `OrganizationsTab.vue` onboard form x2, `OrganizationsTab.vue` per-row assign form), 1 unassociated-`<label>` component (`ConfigTextField.vue`, used by Sender/AI-Proxy cards), and 2 tab strips (`OwnerConsoleView.vue` 2 tabs, `ServiceEditorView.vue` up to 4 tabs) with plain buttons + `v-show` panels, zero ARIA. |
| R240 | One shared song-browse component powers both the Songs page and the service-plan song picker | The two current surfaces (`SongTable.vue`/`SongFilters.vue`/`SongsView.vue` vs. `SongSlotPicker.vue`) diverge significantly in UX (sortable data-management table vs. AI/rotation-augmented selection dropdown). Genuine duplication is narrower than "the whole browse surface" — see the recommended extraction boundary below (composable + a wrapping component with a scoped slot for row rendering), which satisfies R240 literally without a redesign. |
</phase_requirements>

## Summary

This phase is unusually far along before any Phase-81 code has been written. Two of the four items —
**R237 and R238 — are already functionally complete and unit-tested in the live codebase**, done as prior
quick tasks (`260809-vvq` for R237; ongoing `appConfig`/`SenderConfigCard` work across Phases 69–70 for
R238) that predate this milestone's requirements gathering. This is the single most important finding of
this research: **the planner must not re-implement either of these** — R237's task should be scoped to
verification/requirement-traceability (confirm coverage, add an explicit R237-tagged assertion if the
existing tests aren't self-evidently traceable, and make an explicit call on the one edge case — `IMPORTED`
slots — that is still, by design, excluded). R238's task is almost entirely a **documentation** deliverable:
write the owner runbook and a `PENDING-VERIFICATION.md` entry; the code-side "confirm the send path uses
the configured sender" check this phase was scoped to investigate is already true and already has a
passing regression test (`functions/src/index.test.ts:4719`, `functions/src/adminEmail.test.ts`).

R239 and R240 are genuine build work. R239 has a small, fully-enumerated defect surface (4 unlabeled
inputs, 1 unassociated `<label>`, 2 tab strips) and one concrete new risk this research surfaces that
neither CONTEXT.md nor the milestone PITFALLS.md called out: `OrganizationsTab.vue`'s per-row "Assign
email" input lives inside a `v-for`, so a naive `<label for="assign-email">` retrofit would produce
duplicate `id`s across rows — every row's label would point at the first row's input. R240 requires
research judgment on the "smallest shared boundary": the two song-browse surfaces' *list rendering* is
genuinely incompatible without a redesign (sortable/selectable data table vs. AI-suggestion dropdown), so
the recommended extraction is a shared filtering composable plus a thin wrapper component that owns
search/tag-filter state and UI, exposing the filtered song list to each consumer via a scoped slot for its
own (unchanged) row rendering.

**Primary recommendation:** Scope R237 and R238 phase-81 tasks as *verification + docs*, not *build*. Scope
R239 as a template-only ARIA/label retrofit using `eslint-plugin-vuejs-accessibility` for defect discovery,
with a mandatory post-retrofit regression check that the Organizations tab's `onSnapshot` listener is still
live while the Configuration tab is displayed, and unique per-row `id`s for the Organizations assign form.
Scope R240 as: extract `filterSongsByTags()` into `src/utils/songSearch.ts` (dedupes the same include/
exclude logic currently duplicated in `stores/songs.ts` and `SongSlotPicker.vue`), then build one new
`SongBrowser.vue`-style wrapper component owning search input + `TagFilterChecklist` + the filtered-song
computed, with a scoped default slot for the row/list markup — consumed by both `SongFilters.vue`'s call
site area and `SongSlotPicker.vue`, without touching `SongTable.vue`'s or the picker's row rendering.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| R237 — PC export item assembly | Browser/Client | CDN/Static (Hosting rewrite → PC proxy) | `planningCenterApi.ts` and `ServiceEditorView.vue` run entirely client-side; the PC API is reached through a Vite dev proxy / Firebase Hosting rewrite, not a Cloud Function |
| R238 — email send | API/Backend (Cloud Functions) | Database/Storage (Firestore `appConfig/global`) | `sendQueuedMessageHandler`/`sendAdminOnboardingEmail` run in Cloud Functions and call the Resend SDK; the sender address is owner-configured live data read from Firestore, not a build-time value |
| R238 — sender config UI | Browser/Client | Database/Storage | `SenderConfigCard.vue` writes directly to Firestore (`appConfig/global`) via the app config store; no Function call needed to change the address |
| R239 — Owner Console / Service Editor a11y | Browser/Client | — | Pure template/ARIA markup change; the `v-show` mount strategy and `onSnapshot` subscriptions it must not disturb are also purely client-side |
| R240 — shared song-browse component | Browser/Client | — | Vue component/composable extraction; no server or data-model change |

## Standard Stack

### Core (already installed — no version bump needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | `^3.5.29` (root `package.json`) | Template/ARIA markup (R239), component extraction (R240) | Existing framework |
| Pinia | `^3.0.4` | `songs` store (R240), `appConfig` store (R238 UI) | Existing state layer |
| `resend` (Node SDK) | `6.19.0` installed in `functions/` [VERIFIED: source, `functions/package.json`] | Transactional email send | Already the chosen provider (v1.7 ADR); R238 needs zero SDK code change — only the live config value changes |
| `firebase-functions`/`firebase-admin` | already installed | `getAppConfig()` read in the send path | Unchanged by this phase |

### Supporting — new addition

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint-plugin-vuejs-accessibility` | `^2.6.0` [VERIFIED: npm registry, `npm view eslint-plugin-vuejs-accessibility version` → `2.6.0`, published `2026-08-10T02:12:33Z`] | Static ESLint rules for `.vue` templates: missing `alt`, missing form `<label>` association, invalid/missing ARIA roles | R239's only new dependency. Peer range `^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0` [VERIFIED: npm registry, `npm view eslint-plugin-vuejs-accessibility peerDependencies`] — compatible with this repo's installed `eslint@10.0.2` [VERIFIED: source, `npx eslint --version` → `v10.0.2`]. Ships a `flat/recommended` export — drops into `eslint.config.ts`'s `defineConfigWithVueTs(...)` call alongside `pluginVue`/`vueTsConfigs` with zero config-format migration |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `eslint-plugin-vuejs-accessibility` (static lint) | `vue-axe` (runtime devtools panel) | Requires a running browser session for exploratory audits; heavier setup than a lint rule for a scoped, one-time console retrofit |
| `eslint-plugin-vuejs-accessibility` | `@axe-core/playwright` | Requires adopting Playwright, which this project's test stack (vitest + `@vue/test-utils`) does not have — disproportionate for one console page |
| One `SongBrowser.vue` doing search+filter+list identically for both consumers | Two separately-maintained duplicate list UIs (status quo) | Duplication risk (the tag-filter logic is ALREADY duplicated between `stores/songs.ts` and `SongSlotPicker.vue` with identical semantics) vs. forcing a shared list renderer across two behaviorally incompatible UX shapes (data table vs. AI-suggestion dropdown), which would be a redesign CONTEXT.md explicitly rules out |

**Installation:**
```bash
npm install -D eslint-plugin-vuejs-accessibility@^2.6.0
```

**Version verification (done this session):**
```
$ npm view eslint-plugin-vuejs-accessibility version
2.6.0
$ npm view eslint-plugin-vuejs-accessibility peerDependencies
{ eslint: '^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0', globals: '>= 13.12.1' }
$ npm view eslint-plugin-vuejs-accessibility scripts.postinstall
(empty — no postinstall script)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `eslint-plugin-vuejs-accessibility` | npm | latest version (`2.6.0`) published 2026-08-10 — 14 days old at research time | 558,030/week [VERIFIED: `gsd-tools query package-legitimacy check`] | `github.com/vue-a11y/eslint-plugin-vuejs-accessibility` (verified reachable) | **SUS** (heuristic reason: `too-new`, triggered by the recency of the `2.6.0` version publish, not the package's overall history) | **Flagged — planner must add a `checkpoint:human-verify` task immediately before the `npm install -D eslint-plugin-vuejs-accessibility@^2.6.0` step**, even though the package itself is well-established (vue-a11y org, half-a-million weekly downloads, no postinstall script, not deprecated) — the automated "too-new" signal is almost certainly a false positive on THIS version's publish date, but per protocol SUS verdicts are never silently upgraded to OK |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `eslint-plugin-vuejs-accessibility` — see disposition above. No other new packages are introduced by this phase (R237/R238/R240 add zero dependencies; `resend` is already installed and unchanged).

## Architecture Patterns

### R237 — PC Export: Current (Already-Correct) Architecture

```
ServiceEditorView.vue "Export to Planning Center" dialog
        │
        ├─ exportMode = 'existing' ──► fetchPlanItems() ──► classify existing PC items
        │                              into song/scripture/unmatched buckets
        │                              ├─ pass 1-2: classify + delete unmatched placeholders
        │                              ├─ pass 3-4: replace matched song/scripture placeholders
        │                              ├─ pass 5: append leftover song/scripture slots
        │                              └─ pass 6: append otherSlots (PRAYER/MESSAGE/
        │                                          ANNOUNCEMENTS/MISC)          ◄── already covers R237
        │
        └─ exportMode = 'new' ──► createPlan()
                ├─ templateId set ──► fetchTemplateItems() ──► for each template item:
                │                     match song/scripture slots into template slots,
                │                     else createItem(tItem.title) for template's own
                │                     items ──► THEN append leftover song/scripture slots
                │                     ──► THEN append otherSlots               ◄── already covers R237
                │
                └─ no templateId ──► loop over ALL localService.value.slots in order,
                                      calling addSlotAsItem() for every kind except
                                      IMPORTED (which `continue`s past)         ◄── already covers R237
```

All three branches call into `addSlotAsItem()` (`src/utils/planningCenterApi.ts:896-1082`), which has an
explicit `if` branch for every `SlotKind` member (`SONG`, `HYMN`, `SCRIPTURE`, `PRAYER`, `ANNOUNCEMENTS`,
`MISC`, `MESSAGE`, `IMPORTED`) plus a compiler-enforced exhaustiveness backstop:

```typescript
// src/utils/planningCenterApi.ts:1069-1081 — already in the codebase
const unhandledKind: never = slot.kind
throw new Error(`addSlotAsItem: unhandled SlotKind "${unhandledKind}"`)
```

This means a future 9th `SlotKind` added to `src/types/service.ts` without a matching branch here is a
**`npm run type-check` compile error**, not a silent drop — the exact protection R237 is asking for is
already load-bearing. `IMPORTED` (PPTX/image import slides) is the one kind that never becomes a PC item,
by explicit design (`ServiceEditorView.vue:4104`, comment: "no analogous Planning Center item type") —
this is documented, tested (`ServiceEditorView.test.ts:7481` asserts `kinds` never contains `'IMPORTED'`),
and consistent with CONTEXT.md's own list of examples ("prayer, offering, welcome, message/sermon,
announcements") which never mentions PPTX/image imports.

### R237 — What Remains

Given the above, the R237 task for this phase should be:
1. Confirm (already true) that `otherSlots` in both the existing-plan and with-template branches, and the
   direct slot loop in the no-template branch, cover exactly `PRAYER | MESSAGE | ANNOUNCEMENTS | MISC` —
   verified this session by reading `ServiceEditorView.vue:3862-3990` and `4087-4116`.
2. Decide, and document, that `IMPORTED` staying excluded is the correct interpretation of "no dropped
   items" (it has no PC representation to drop into) — this is Claude's Discretion per CONTEXT.md, not an
   open question; the existing tests already encode this decision.
3. If the phase's Nyquist gate wants an explicit R237-traceable test (rather than inheriting the
   quick-task's untagged coverage), add one thin assertion referencing "R237" in a comment at
   `src/views/__tests__/ServiceEditorView.test.ts` near the existing `260809-vvq` block
   (`ServiceEditorView.test.ts:7447-7522`) — do not duplicate the whole test, just tag it for traceability.
4. No code change to `planningCenterApi.ts` or `ServiceEditorView.vue` is expected to be necessary.

### R238 — Email Send Path (Already Wired)

```
Owner Console → SenderConfigCard.vue
  (ConfigTextField "From address", isUnverifiableHost() warns on *.web.app/*.firebaseapp.com)
        │  onSaveText → store.saveField('sender.fromAddress', v)
        ▼
Firestore appConfig/global.sender.fromAddress
        │
        ├─► sendQueuedMessageHandler (functions/src/index.ts:2786+)
        │     config = await getAppConfig(db)              // R181 pattern
        │     fromEmail = bareEmailAddress(config.sender.fromAddress)
        │     fromAddress = orgName ? `"${orgName}" <${fromEmail}>` : fromEmail
        │     resend.emails.send({ from: fromAddress, ... })    ◄── NOT hard-coded
        │
        └─► sendAdminOnboardingEmail (functions/src/adminEmail.ts:91-109)
              config = await getAppConfig(db)
              fromEmail = bareEmailAddress(config.sender.fromAddress)
              resend.emails.send({ from, ... })                 ◄── NOT hard-coded
```

`onboarding@resend.dev` appears in the codebase ONLY as `DEFAULT_APP_CONFIG.sender.fromAddress`
(`functions/src/appConfig.ts:102`) — the fallback used when `appConfig/global` doesn't yet have an
explicit `sender.fromAddress` set. That is correct, intended behavior (byte-for-byte reproduces pre-R181
behavior until an owner sets a real value), not a hard-coded override on the live send path. Both send
paths are covered by passing unit tests that assert `from` is built from the injected `config.sender.
fromAddress`:
- `functions/src/adminEmail.test.ts:35-65` (mocks `getAppConfig`, asserts `arg.from` uses the mocked
  address)
- `functions/src/index.test.ts:4719-4770` (asserts `From = the org's name as display name over
  config.sender.fromAddress`, plus a `422`-repro test for a pre-formatted "Name <email>" value)

**R238's only real deliverable this phase is the runbook document** (see Code Examples below for the
concrete DNS steps) plus a `PENDING-VERIFICATION.md` entry recording the owner-run steps, following the
existing `functions/DEPLOY-*.md` placement precedent (`DEPLOY-ORG-CLAIMS.md`, `DEPLOY-RUNTIME-CONFIG.md`,
`DEPLOY-SUPER-ADMIN.md` all live directly in `functions/`).

### R239 — Tab-Strip ARIA Retrofit Pattern (Preserve `v-show`)

Both tab strips (`OwnerConsoleView.vue:13-34` — 2 tabs; `ServiceEditorView.vue:696-747` — up to 4 tabs,
gated by `authStore.isEditor`/`isMessagingEnabled()`) share the exact same shape: a `<div>` of plain
`<button type="button">`s with `:class`-toggled active styling and a `@click` handler, followed by
`v-show="activeTab === 'x'"` panel `<div>`s. Neither currently has any ARIA. The retrofit must add
attributes WITHOUT touching the `v-show` directive or the `@click`/route-query sync logic:

```vue
<!-- Recommended pattern — additive only, no mount-strategy change -->
<div role="tablist" class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0">
  <button
    id="tab-configuration"
    role="tab"
    type="button"
    :aria-selected="activeTab === 'configuration'"
    aria-controls="panel-configuration"
    :tabindex="activeTab === 'configuration' ? 0 : -1"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'configuration' ? '...' : '...'"
    @click="setTab('configuration')"
  >
    Configuration
  </button>
  <!-- ...Organizations button mirrors this, id="tab-organizations" -->
</div>

<div
  v-show="activeTab === 'configuration'"
  id="panel-configuration"
  role="tabpanel"
  aria-labelledby="tab-configuration"
  data-testid="configuration-panel"
>
  <ConfigurationTab />
</div>
```

`v-show` and `role`/`aria-*`/`id` attributes are ordinary HTML attributes — they coexist freely with
`v-show`'s `display:none` toggling; nothing here changes when `ConfigurationTab`/`OrganizationsTab`
mount or unmount (they never do). **Do not** add roving-tabindex/arrow-key JS handlers unless explicitly
asked — `tabindex="0"/-1"` above is the simplest APG-compliant static version; a full roving-tabindex
implementation is optional polish CONTEXT.md's discretion note allows deferring given the scoped intent.

**Mandatory regression check** (from milestone PITFALLS.md Pitfall 8, re-confirmed against live code this
session): after the retrofit, verify the Organizations tab's live `onSnapshot`-backed list still updates
while the Configuration tab is displayed (`activeTab !== 'organizations'`) — i.e., `OrganizationsTab.vue`
is never unmounted. A test asserting `wrapper.findComponent(OrganizationsTab).exists()` stays `true`
across a `setTab()` call is sufficient; do not assert on DOM visibility alone.

### R239 — Concrete Label Defects (exhaustive list, verified this session)

| File | Input | Current State | Fix |
|------|-------|----------------|-----|
| `src/components/admin/ConfigurationTab.vue:13-17` | Super-admin grant email | `placeholder="Enter email address"`, no `<label>` | Add `<label for="grant-email">Email address</label>` + `id="grant-email"` on the input (single instance, not repeated — safe for `for`/`id`) |
| `src/components/admin/OrganizationsTab.vue:7-12` | Onboard form "Church name" | `placeholder="Church name"`, no `<label>` | Add associated `<label for="onboard-church-name">` (single instance) |
| `src/components/admin/OrganizationsTab.vue:13-19` | Onboard form "First admin email" | `placeholder="First admin email"`, no `<label>` | Add associated `<label for="onboard-admin-email">` (single instance) |
| `src/components/admin/OrganizationsTab.vue:85-91` | Per-row "Assign email" (inline, inside `v-for="org in orgs"`) | `placeholder="Admin email"`, no `<label>` | **Do NOT use a static `id="assign-email"`** — it repeats once per row and duplicate `id`s break `for`/`id` association (every row's label would target the FIRST row's input, and `id` collisions are themselves an a11y/HTML-validity defect the linter may not catch since each row's template is structurally correct in isolation). Use `:id="`assign-email-${org.orgId}`"` with a matching `:for` on a visually-hidden `<label>`, OR simply `aria-label="Admin email"` (no `id` needed) — the latter is simpler and avoids the per-row-uniqueness burden entirely |
| `src/components/admin/ConfigTextField.vue:3-6` (used by `SenderConfigCard.vue` fromName/fromAddress, `AiProxyConfigCard.vue`, etc.) | Generic `<label>{{ label }}</label>` followed by a sibling `<input>` | `<label>` text renders visually but has **no `for` attribute and the `<input>` has no `id`** — an `eslint-plugin-vuejs-accessibility`/`label-has-for`-class defect despite looking "labeled" to a sighted user | Generate a stable `id` from `props.label` (slugified) or accept an `id`/`fieldId` prop from the caller, wire `:for`/`:id` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static template a11y auditing (R239) | A custom regex/AST scan for missing labels/ARIA | `eslint-plugin-vuejs-accessibility@^2.6.0` `flat/recommended` | Purpose-built, actively maintained (vue-a11y org), zero config-format migration cost in this repo's flat ESLint setup |
| ARIA tab semantics (R239) | A novel attribute scheme | WAI-ARIA APG Tabs pattern (`role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`, `aria-controls`) | Standard, screen-reader-tested pattern; anything bespoke risks incorrect AT (assistive technology) behavior |
| Song text/field search matching (R240) | A new search-matching function for the shared component | `songMatchesQuery`/`matchesToken` (`src/utils/songSearch.ts`, already shared between `stores/songs.ts` and `SongSlotPicker.vue`) | Already handles field-prefix syntax (`tag:`, `key:`, `theme:`, `team:`, `type:`) and VW-mode gating correctly — don't reimplement |
| Tag include/exclude filtering (R240) | A third copy of the include/exclude Set-intersection logic | Extract the ALREADY-DUPLICATED logic (`stores/songs.ts:75-90`-ish and `SongSlotPicker.vue:272-291`, verified identical semantics: exclude wins, include OR-combines) into one `filterSongsByTags(songs, include, exclude)` in `songSearch.ts` | Two independent, drifting copies of the same filter is exactly the kind of debt R240 exists to remove |
| Resend domain-verification status (R238) | An in-app poller/webhook against Resend's API | Resend's own dashboard (manual check, per the owner runbook) | Explicitly deferred by CONTEXT.md's Deferred Ideas — do not build this in Phase 81 |

**Key insight:** Three of this phase's four items are actually about NOT building something — R237 and R238
because the code is already done, and part of R240 because the "smallest shared boundary" is a filtering
composable/thin wrapper, not a from-scratch unified list component.

## Common Pitfalls

### Pitfall 1 (R237): Treating this as new build work
**What goes wrong:** A plan that schedules "implement PC export for non-song slots" as a multi-file
build task duplicates `260809-vvq`'s already-shipped, already-tested work, risking a regression if the
"reimplementation" doesn't match the existing exhaustiveness-guarded dispatch exactly.
**How to avoid:** Read `src/utils/planningCenterApi.ts:889-1082` and `src/views/ServiceEditorView.vue:
3850-4117` FIRST, and grep `git log -S "otherSlots"` before writing any task. This phase's R237 task
should verify + traceability-tag, not rebuild.
**Warning signs:** A plan diff that touches `addSlotAsItem`'s branch structure or the `otherSlots` bucket
definition without first confirming they're wrong today.

### Pitfall 2 (R238): Treating this as new build work
**What goes wrong:** Same failure mode as Pitfall 1 — a plan that "wires the send path to read the
configured sender" duplicates work completed across Phases 69-70 (R181/R187/R191/R192).
**How to avoid:** Read `functions/src/index.ts:2986-3016`, `functions/src/adminEmail.ts:91-109`, and
`functions/src/appConfig.ts:71-178` first; run the existing test files
(`functions/src/adminEmail.test.ts`, `functions/src/index.test.ts -t "config.sender.fromAddress"`) to
confirm they already pass before writing any "fix the send path" task.
**Warning signs:** A plan diff that touches `sendQueuedMessageHandler`'s From-construction logic.

### Pitfall 3 (R238, inherited from milestone PITFALLS.md Pitfall 7): Resend verification is external/async
**What goes wrong:** Nothing in this app can detect Resend's DNS verification state; a `403 domain is not
verified` error only surfaces on the FIRST real send after the config value is (prematurely) changed, and
is caught by the per-recipient try/catch, degrading silently to a `partial`/`failed` message-status
instead of a visible error.
**How to avoid:** The runbook must explicitly sequence: (1) add domain + publish DNS records in Resend
dashboard, (2) wait for ALL records to show "Verified" (not "Pending"), (3) only then set `sender.
fromAddress` in the Owner Console, (4) send a real test message to a real EXTERNAL inbox (not the Resend
account owner's own address — that's the one address test-mode `onboarding@resend.dev` already delivers
to) and check the delivery-history rollup for `partial`/`failed`.
**Phase to address:** This phase's runbook doc — no code change possible.

### Pitfall 4 (R239, inherited + re-verified from milestone PITFALLS.md Pitfall 8): `v-show`/route-query regression
**What goes wrong:** A generic ARIA-tabs tutorial commonly assumes conditional (`v-if`) panel mounting;
copy-pasting that pattern here would kill `ConfigurationTab`'s/`OrganizationsTab`'s always-live
`onSnapshot` subscriptions (`OwnerConsoleView.vue:36-39`'s own comment already documents this
requirement), or desync `aria-selected` from the `router.replace({query:{tab}})` deep-link sync if a new
keyboard handler is added carelessly.
**How to avoid:** Keep `v-show`; wire new ARIA state (`aria-selected`) to the EXISTING `setTab()`/
`activeTab` reactive value, never a second source of truth; do both `OwnerConsoleView.vue` AND
`ServiceEditorView.vue` tab strips in the same pass (PITFALLS.md explicitly warns this gets done on one
and forgotten on the other).
**Warning signs:** Any diff touching `v-show` → `v-if`/`hidden` on these panels; a PR touching only one of
the two tab strips.

### Pitfall 5 (R239, new finding this session — not in milestone PITFALLS.md): duplicate `id` in `v-for`
**What goes wrong:** `OrganizationsTab.vue`'s per-row "Assign email" input (line 85-91) is rendered inside
`v-for="org in orgs"`. A naive `<label for="assign-email">`/`id="assign-email"` retrofit — the obvious
first move when reading the eslint plugin's `label-has-for` rule output — produces N duplicate `id`s (one
per org row), which is invalid HTML and means every row's label targets the FIRST row's input via
`for`/`id` association, regardless of which row a screen reader user is actually on.
**How to avoid:** Use `aria-label="Admin email"` directly on this one input (no `id`/`for` pair needed),
or generate a per-row-unique `id` (`:id="`assign-email-${org.orgId}`"`) if a visible `<label>` is
preferred. Verify no other Owner Console input inside a `v-for`/`v-if`-repeated block gets a static `id`.
**Phase to address:** This phase, R239 task — flag explicitly in the plan so it isn't discovered only
after the lint pass flags a false-negative (the linter checks each template instance in isolation and
cannot know the surrounding element repeats at runtime).

### Pitfall 6 (R240): Forcing one list component across two incompatible UX shapes
**What goes wrong:** `SongTable.vue` is a sortable, multi-select, column-visibility-aware data-management
table (checkboxes, `toggleSort`, bulk-tag action bar, edit/delete). `SongSlotPicker.vue` is a compact
selection dropdown with AI suggestions, rotation-ranked suggestions, and IntersectionObserver-based
load-more — a fundamentally different interaction model (pick-one-and-close vs. browse-and-manage). A
plan that tries to unify their ROW rendering into one component either becomes a large `mode`-branching
component (defeats the "smallest shared boundary" and "not a redesign" intent) or subtly changes one
consumer's behavior.
**How to avoid:** Extract only the genuinely-duplicated pieces — the tag-filter Set-intersection logic
(already byte-for-byte duplicated between `stores/songs.ts` and `SongSlotPicker.vue`) into a shared pure
function, and the search-input + `TagFilterChecklist` UI into a thin wrapper component with a scoped
default slot for the row/list markup, leaving `SongTable.vue`'s rows and `SongSlotPicker.vue`'s AI/
rotation/search-result rows exactly as they are today.
**Warning signs:** A plan diff that rewrites `SongTable.vue`'s `<tr>` markup or `SongSlotPicker.vue`'s
AI-Picks/By-Rotation sections "to match the new shared component."

## Code Examples

### R238 — Resend Domain Verification Runbook Steps (verified via milestone STACK.md, itself sourced from Resend's own docs — [CITED: resend.com/docs/dashboard/domains/introduction, resend.com/docs/dashboard/domains/dmarc])

```
1. Choose a real domain the owner controls DNS for. *.web.app/*.firebaseapp.com CANNOT be
   verified (Google-managed, no DNS access) — SenderConfigCard.vue's isUnverifiableHost()
   already warns about exactly this.
2. Resend Dashboard → Domains → Add Domain → enter the domain (a dedicated sending
   subdomain, e.g. send.yourdomain.com, is Resend's own recommendation).
3. Publish the per-domain-generated DNS records at the domain's DNS provider:
   - SPF: TXT record on the sending subdomain.
   - DKIM: TXT record at resend._domainkey.<subdomain> (a literal value, not a CNAME).
   - MX: issued by Resend for bounce/complaint feedback.
   - DMARC: TXT at _dmarc.<yourdomain>, start with `v=DMARC1; p=none; rua=mailto:<owner>;`
     (monitoring mode); progress to p=quarantine/p=reject only after confirming legitimate
     mail passes for a few weeks.
4. Click Verify in the Resend dashboard. Propagation: minutes to up to 48h depending on TTL.
   Wait for ALL records (SPF/DKIM/MX) to show "Verified," not "Pending."
5. In the Owner Console → Configuration tab → Sender card, set "From address" to the new
   verified address (e.g. noreply@send.yourdomain.com). This is a LIVE Firestore write —
   no redeploy needed. SERVICE_SHARE_BASE_URL stays on the Firebase default per CONTEXT.md's
   locked decision (leave it — it is independent of the sending domain).
6. Send a real test message to a real EXTERNAL inbox (not the Resend account owner's own
   address) and check the message's delivery-history rollup for partial/failed status.
```

### R239 — ARIA Tab Retrofit (see full pattern in Architecture Patterns above)

### R240 — Recommended `filterSongsByTags` Extraction

```typescript
// src/utils/songSearch.ts — new export, extracted from the two duplicated call sites
// (stores/songs.ts's filteredSongs computed, SongSlotPicker.vue's tagFilteredSongs computed)
export function filterSongsByTags(
  songs: Song[],
  include: Set<string>,
  exclude: Set<string>,
): Song[] {
  if (include.size === 0 && exclude.size === 0) return songs
  return songs.filter((s) => {
    if (exclude.size > 0) {
      const carriesExcluded =
        (s.themes ?? []).some((t) => exclude.has(t)) || (s.tags ?? []).some((t) => exclude.has(t))
      if (carriesExcluded) return false
    }
    if (include.size > 0) {
      const carriesIncluded =
        (s.themes ?? []).some((t) => include.has(t)) || (s.tags ?? []).some((t) => include.has(t))
      return carriesIncluded
    }
    return true
  })
}
```

Both `stores/songs.ts`'s `filteredSongs` computed and `SongSlotPicker.vue`'s `tagFilteredSongs` computed
should call this instead of inlining the logic — behavior-neutral by construction (the extracted function
is a byte-for-byte lift of the existing logic in both places, confirmed identical this session).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `eslint-plugin-vuejs-accessibility` `[SUS]`/"too-new" verdict from `gsd-tools query package-legitimacy check` is a false positive driven by the `2.6.0` version's recent publish date, not evidence of a slopsquat/hallucination risk | Package Legitimacy Audit | Low — the package has an authentic, long-lived GitHub org (`vue-a11y`), 558K weekly downloads, no postinstall script, and is not deprecated; still gated behind a mandatory `checkpoint:human-verify` per protocol regardless of this assessment |
| A2 | `IMPORTED` slots should remain permanently excluded from PC export (no PC representation exists) rather than getting a generic placeholder item under R237's "no dropped items" wording | R237 — What Remains | Low-medium — if the owner actually wants a placeholder item for PPTX/image slides (e.g. "See attached slides"), this is a one-branch addition to `addSlotAsItem`'s existing `IMPORTED` case; flagged for planner/discuss-phase confirmation since CONTEXT.md's own examples never mention this kind |

**If this table is empty:** N/A — see above; both entries are low-risk since either is inexpensive to
revisit if the assumption is wrong.

## Open Questions

1. **Should `IMPORTED` slots get a generic PC placeholder item, or stay excluded?**
   - What we know: Currently excluded by design, tested, and consistent with CONTEXT.md's own examples of
     "non-song/non-scripture slots" (which lists prayer/offering/welcome/message/announcements — never
     PPTX/image imports).
   - What's unclear: Whether R237's literal wording ("no dropped items") was meant to also cover this kind.
   - Recommendation: Keep excluded (current behavior); document the decision explicitly in the plan rather
     than silently inheriting it, so it's an intentional call, not an oversight.

2. **Does the R239 retrofit need keyboard arrow-key roving-tabindex, or is static `tabindex="0"/"−1"` +
   `aria-selected` sufficient for this milestone's scope?**
   - What we know: CONTEXT.md's discretion note allows keeping the scope tight (labels + ARIA roles);
     PITFALLS.md warns that adding roving-tabindex incorrectly risks breaking existing Tab-key muscle
     memory for super-admins.
   - What's unclear: Whether "baseline accessibility" (roadmap wording) requires full keyboard tab-panel
     navigation (Left/Right arrow keys moving focus between tab buttons) per the WAI-ARIA APG pattern, or
     whether static roles + labels clears the bar.
   - Recommendation: Ship static ARIA + labels first (satisfies the literal requirement text: "real
     labels/aria-labels... and ARIA tab semantics"); treat roving-tabindex as optional polish only if time
     remains, and test manual Tab/Shift+Tab/Enter/Space navigation either way per PITFALLS.md's UX-pitfall
     guidance.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all phase work | ✓ | v22.23.2 [VERIFIED: source, `node --version`] | — |
| npm | package install | ✓ | 10.9.8 [VERIFIED: source, `npm --version`] | — |
| ESLint | R239 lint config | ✓ | 10.0.2 [VERIFIED: source, `npx eslint --version`] | — |
| `eslint-plugin-vuejs-accessibility` | R239 | ✗ (not yet installed) | `2.6.0` on npm, confirmed installable | Straightforward `npm install -D`; no fallback needed |
| Resend Dashboard (external, owner-controlled) | R238 | N/A — owner-run, not app-probeable | — | The runbook IS the fallback for the app's inability to verify this |
| A DNS provider the owner controls | R238 | N/A — owner-run | — | None; blocks actual domain verification, but does not block this phase's coding/doc deliverable |

**Missing dependencies with no fallback:** none that block this phase's deliverables (R238's DNS
dependency blocks real-world email verification, not the phase's own runbook+wiring deliverable, per
CONTEXT.md's own "done" definition for R238).
**Missing dependencies with fallback:** `eslint-plugin-vuejs-accessibility` — trivial `npm install`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` (root `package.json`, client suite); Vitest `^4.1.10` (`functions/package.json`, isolated workspace) |
| Config file | `vite.config.ts` (client — excludes `src/rules.test.ts` and `render-service/**`); `functions/` uses its own `vitest` config via `functions/package.json`'s `"test": "vitest run"` |
| Quick run command | `npx vitest run <path/to/file>.test.ts` (client); `cd functions && npx vitest run src/<file>.test.ts` (functions) |
| Full suite command | `npx vitest run` (client — per CLAUDE.md, bare command is now correct, returns the 2-file baseline); `cd functions && npm test` (functions) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R237 | All 3 PC export modes include PRAYER/MESSAGE/ANNOUNCEMENTS/MISC, never IMPORTED | unit/component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "PRAYER/MESSAGE/ANNOUNCEMENTS/MISC"` | ✅ Already exists (`ServiceEditorView.test.ts:7447-7522`, 3 passing tests, one per export mode) |
| R237 | `addSlotAsItem` dispatch is exhaustive over `SlotKind` | compile-time | `npm run type-check` (vue-tsc --build) | ✅ Already exists (the `never`-typed backstop at `planningCenterApi.ts:1080`) |
| R238 | `sendQueuedMessageHandler` From uses `config.sender.fromAddress`, not hard-coded | unit | `cd functions && npx vitest run src/index.test.ts -t "config.sender.fromAddress"` | ✅ Already exists (`index.test.ts:4719-4770`) |
| R238 | `sendAdminOnboardingEmail` From uses `config.sender.fromAddress` | unit | `cd functions && npx vitest run src/adminEmail.test.ts` | ✅ Already exists (`adminEmail.test.ts`, full file) |
| R238 | Runbook doc is complete/accurate | manual review | N/A — no automated check possible for an owner-run DNS process | ❌ N/A by design |
| R239 | Grant/onboard/assign inputs have real `<label>`/`aria-label` | component | new assertions in `OrganizationsTab.test.ts` (exists, extend) and a new small test for `ConfigurationTab.vue` (no existing test file — Wave 0 gap) | Partial — `OrganizationsTab.test.ts` exists; `ConfigurationTab.vue` has none |
| R239 | Tab strips expose `role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls` | component | new assertions in `OwnerConsoleView.test.ts` (exists, extend) and `ServiceEditorView.test.ts` (exists, extend) | Partial — files exist, ARIA-specific assertions don't yet |
| R239 | `onSnapshot`/live-listener invariant survives the retrofit | component (regression) | assert `wrapper.findComponent(OrganizationsTab).exists()` stays `true` across `setTab()` in `OwnerConsoleView.test.ts` | ❌ New assertion needed (Wave 0 gap) |
| R240 | `filterSongsByTags` produces identical results to both prior inline implementations | unit | new test in `src/utils/__tests__/songSearch.test.ts` (file exists — extend) | Partial — file exists, new function untested |
| R240 | `SongsView`/`SongTable` behavior unchanged after extraction | component (regression) | `npx vitest run src/views/__tests__/SongsView.test.ts src/components/__tests__/SongTable.test.ts` | ✅ Existing suites double as the regression net |
| R240 | `ServiceEditorView`'s song picker behavior unchanged after extraction | component (regression) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (song-picker-relevant tests) | ✅ Existing suite (260+ tests) doubles as the regression net |

### Sampling Rate
- **Per task commit:** the quick-run command for the file(s) touched by that task.
- **Per wave merge:** `npx vitest run` (client) AND `cd functions && npm test` (functions) — this phase
  touches both workspaces (R237/R239/R240 client-only, R238 doc-only but functions tests should still be
  re-run to confirm no regression from reading the code).
- **Phase gate:** both full suites green, plus `npm run type-check` and `npm run lint:eslint` (now
  including the new a11y plugin's rule set) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/admin/__tests__/ConfigurationTab.test.ts` — does not exist; needed for R239's
  grant-form label assertions (or extend an existing mount point if one is added elsewhere).
- [ ] New ARIA-role assertions in `OwnerConsoleView.test.ts` and `ServiceEditorView.test.ts` — files
  exist, specific `role`/`aria-*` assertions do not yet.
- [ ] New `onSnapshot`-survives-tab-switch regression assertion in `OwnerConsoleView.test.ts`.
- [ ] New `filterSongsByTags` unit tests in `src/utils/__tests__/songSearch.test.ts` (file exists, new
  function needs coverage).
- [ ] If a new `SongBrowser.vue`-style wrapper component is created for R240, a new test file for it.
- Framework install: none — Vitest is already the framework everywhere this phase touches.

*(R237 and R238 have NO Wave 0 gaps — their existing tests already cover this phase's requirements.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected by this phase |
| V3 Session Management | No | Unaffected by this phase |
| V4 Access Control | Yes (unchanged, verify no regression) | Owner Console routes/components are already gated by the `isSuperAdmin` custom claim (pre-existing); R239's ARIA/label retrofit must add ONLY presentational attributes — confirm no plan accidentally touches the auth-gating `v-if`/route-guard logic while adding ARIA markup nearby |
| V5 Input Validation | Yes (already implemented, no change needed) | `SenderConfigCard.vue`'s `isValidEmailFormat`/`isUnverifiableHost` already validate the `fromAddress` field format and warn on unverifiable Firebase-managed hosts — R238 requires no new validation |
| V6 Cryptography | No | Unaffected — Resend/DNS are not app-managed cryptographic material |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Duplicate `id` attributes from a naive `v-for` label retrofit (R239) | Tampering-adjacent (data-integrity of assistive-tech association, not a security vuln, but a genuine correctness defect) | Use `aria-label` instead of `id`/`for` pairing for per-row repeated inputs (`OrganizationsTab.vue`'s assign-email field), or generate a per-row-unique `id` |
| Sender address misconfiguration silently degrading to "0 emails delivered" (R238, inherited from milestone PITFALLS.md) | Denial of availability (of email delivery, not the app itself) | Runbook enforces sequencing (verify in Resend BEFORE flipping the live config) + a mandatory external test-send after any `fromAddress` change |

## Sources

### Primary (HIGH confidence — direct source verification this session)
- `src/utils/planningCenterApi.ts` (full file read) — `addSlotAsItem` exhaustive dispatch, all 8 `SlotKind`
  branches
- `src/views/ServiceEditorView.vue:690-4180` — all three PC export code paths, tab-strip markup
- `src/views/__tests__/ServiceEditorView.test.ts` (grepped, R237 test block at 7447-7522 read)
- `functions/src/adminEmail.ts`, `functions/src/adminEmail.test.ts` — full files read
- `functions/src/appConfig.ts` (grepped) — `DEFAULT_APP_CONFIG.sender.fromAddress`, `coerceSender`
- `functions/src/index.ts` (grepped around `sendQueuedMessageHandler`) and `functions/src/index.test.ts`
  (grepped around line 4716-4770)
- `src/components/admin/SenderConfigCard.vue` (full file read) — `isUnverifiableHost`, existing warning UI
- `src/views/OwnerConsoleView.vue` (full file read) — tab strip, `v-show` mount comment
- `src/components/admin/OrganizationsTab.vue`, `src/components/admin/ConfigurationTab.vue` (grepped/read) —
  the 4 placeholder-only inputs
- `src/components/admin/ConfigTextField.vue` (full file read) — unassociated `<label>`
- `src/components/SongSlotPicker.vue` (full file read), `src/components/SongTable.vue` (partial),
  `src/components/SongFilters.vue` (full file read), `src/views/SongsView.vue` (partial) — R240 surface map
- `src/stores/songs.ts`, `src/utils/songSearch.ts` (grepped/read) — duplicated tag-filter logic
- `git log -S "otherSlots"` / `git log -1 -S "previously dropped in the"` — dated the `260809-vvq` fix
- `.planning/milestones/quick-archive/260809-vvq-pc-export-nlt-types-title/260809-vvq-SUMMARY.md` — full
  read, confirms scope and test coverage of the prior fix
- `eslint.config.ts`, `package.json`, `functions/package.json` — confirmed installed versions
- `npm view eslint-plugin-vuejs-accessibility version|peerDependencies|scripts.postinstall` — run this
  session, confirms `2.6.0`, peer range, no postinstall
- `gsd-tools query package-legitimacy check --ecosystem npm eslint-plugin-vuejs-accessibility` — run this
  session, `SUS`/`too-new` verdict with 558,030 weekly downloads and a verified GitHub repo

### Secondary (MEDIUM/HIGH confidence — inherited from this milestone's own prior research, itself
sourced from official docs)
- `.planning/research/STACK.md` — eslint plugin peer-dependency verification (npm registry, HIGH), Resend
  domain-verification steps (Resend's own docs, HIGH)
- `.planning/research/PITFALLS.md` — Pitfall 7 (Resend async verification), Pitfall 8 (v-show/tab-strip
  regression risk)

## Metadata

**Confidence breakdown:**
- R237 finding (already implemented/tested) — HIGH: verified by reading the exact live source and the
  passing test file, plus the git-blame commit that introduced it
- R238 finding (already wired/tested) — HIGH: verified by reading both live send paths and both passing
  test files
- R239 defect inventory — HIGH: every input/tab-strip enumerated by direct file reads this session
- R239 Resend DNS steps — MEDIUM-HIGH (inherited from milestone STACK.md, itself HIGH/vendor-doc-sourced;
  not re-fetched from Resend's docs in this session)
- R240 architecture recommendation — HIGH for the "what's duplicated" facts (direct source read); MEDIUM
  for the specific recommended component boundary (a design judgment call, flagged as Claude's Discretion
  per CONTEXT.md, not a verified fact)

**Research date:** 2026-08-24
**Valid until:** 2026-09-23 (30 days — this is a stable, mature codebase; the main external-facing fact,
the eslint plugin's version, should be re-checked with `npm view` at plan/execute time if this research is
consumed more than a few days later)
