# Requirements: WorshipPlanner v1.5 "Settings, Sharing, and Fidelity"

**Defined:** 2026-08-06
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song
progression) while rotating through the full song stable and respecting team configurations.

**Milestone goal:** Make the app configurable per church — settings that turn features on and off and
set the house style — while fixing the sharing and fidelity defects that make a service plan not match
what was actually planned.

**Numbering:** continues from v1.4 (R036–R072). v1.5 owns **R073–R103**.

**Research basis:** `.planning/research/SUMMARY.md` and the four dimension files. Findings that constrain
these requirements are cited inline as `[SUMMARY]`, `[ARCH]`, `[PITFALL]`, `[STACK]`, `[FEAT]`.

> **Read `SUMMARY.md` § "Contradictions/Refinements to PROJECT.md" before planning any phase.** Eight
> findings refine or contradict decisions recorded in PROJECT.md, most importantly the share-token
> storage location (R076) and the scope of the custom-claims migration (R074). Requirements below are
> written against the *corrected* understanding; PROJECT.md's Key Decisions table records the original
> reasoning and is annotated where superseded.

---

## v1.5 Requirements

### Settings Foundation

- [x] **R073**: Every church-level setting introduced in this milestone persists per organization and
      resolves to a sensible default when the field is absent, so an organization document created
      before a setting existed never errors or renders blank.
      <br>`[ARCH]` No `Organization` type exists today — org fields are read via `orgData.x as T` casts
      scattered across call sites. This requirement establishes a typed `OrgSettings` with a single
      defaults merge in `auth.ts::loadOrgContext`. Firestore's schemalessness means **no migration is
      needed**; the existing `vwModeEnabled` `?? true` pattern already proves the approach.

### Storage Security and Testability

- [x] **R074**: An authenticated member of an organization can read and write objects under that
      organization's Storage path, **and that permission is proven by an automated allow-case test that
      actually runs** in the Storage emulator.
      <br>`[STACK]` The fix works: firebase-js-sdk#6803 makes `firestore.exists()` inert in the Storage
      emulator, but `request.auth.token.<claim>` is a direct JWT read, and the already-installed
      `@firebase/rules-unit-testing` exposes `authenticatedContext(uid, tokenOptions)` to bake claims
      into a mock token. This is what makes the two currently-failing allow-cases in
      `src/storage.rules.test.ts` genuinely runnable.
      <br>**Scoped to `storage.rules` only** `[ARCH]` — `firestore.rules` uses same-service
      `exists()`/`get()`, which #6803 does not affect; migrating it too would trade one staleness class
      for a worse one (role changes lagging a token refresh).

- [x] **R075**: The membership-claim rollout never locks out an existing signed-in member, and a user
      who belongs to no organization is still denied.
      <br>`[PITFALL]` Requires an **`OR`, never an `AND`**, between the new claim and the existing check,
      held through at least one full max-token-lifetime (1 hour) soak before the fallback is removed in a
      **separate** deploy. `users/{uid}.orgIds` is already an array (`auth.ts:86-99` picks `ids[0]`), so
      multi-org membership is a live constraint against the 1000-byte claim limit — the claim shape must
      be designed before the Cloud Function is written.
      <br>**Deploy-gated.** Both deploys are the owner's step per the v1.5 standing autonomy grant, so
      this requirement cannot fully close during an autonomous run.

### Membership Integrity

- [x] **R104**: Only a user holding a valid invite — or the creator of a brand-new organization — can
      create a membership document. A signed-in user cannot self-join an arbitrary organization, and
      cannot choose their own role on create.
      <br>**Added 2026-08-06** after Phase 40's code review (WR-03). **Pre-existing vulnerability, not
      introduced by v1.5:** `firestore.rules:36-41` reads
      `allow create: if isSignedIn() && request.auth.uid == uid`, so any signed-in user can create
      `organizations/{ANY_ORG}/members/{their-uid}` — and because the document body is client-controlled,
      set `role: 'editor'` while doing it. That is privilege escalation, not merely unwanted membership.
      <br>**Why it belongs in v1.5 rather than the backlog:** Phase 40 does not widen the hole, but it
      slows remediation. Once Phase 40's deploy 2 removes the Firestore-membership fallback, the custom
      claim becomes the sole authority and revocation latency stretches from per-request to **up to one
      hour**. Fixing it in the same deploy session is strictly cheaper than fixing it after.
      <br>⚠ The current rule is loose **on purpose** — its own comment says *"Allow creator to write
      their own membership when creating an org or accepting an invite."* Both flows are legitimate and
      both must survive. A fix considering only the invite path silently breaks org creation.

### Sharing

- [x] **R076**: A service's share link is created once and never changes, however many times the service
      is shared or edited.
      <br>`[ARCH]` **Do not persist the token on the service document** as PROJECT.md's original decision
      states — a bare `{shareToken}` write matches none of the three R036 draft-lock carve-outs
      (`services.ts:197-203`, `firestore.rules:64-84`) and would be **rejected on any `planned` or
      `exported` service**, which is the common sharing case. Use a separate
      `serviceShareLinks/{serviceId}` document. The owner's intent is unchanged; only the storage
      location moves.

- [x] **R077**: A shared service always shows the current plan and the current role overrides, without
      anyone re-pressing Share.
      <br>`[ARCH]` `shareTokens` currently has `allow update: if false`, which blocks the refresh
      regardless of where the token lives — it must be loosened to mirror `serviceShares`' existing
      org-scoped update rule. `[PITFALL]` The refresh must write to `shareTokens`/`serviceShares` and
      **never back to `services/{docId}`**, or it forms a trigger loop. The snapshot's existing PII guard
      (names only, never the raw Person object) must survive the rework.

- [ ] **R078**: Share links already circulated to a congregation before this change keep working.
      <br>`[PITFALL]` `createShareToken()` mints fresh on every call, so a service may already have
      several `shareTokens` documents. The backfill must **adopt the most recent existing token**, not
      mint a new one — minting would silently orphan a link someone already emailed out.

### PowerPoint Fidelity (carryover R062)

- [ ] **R079**: An imported PowerPoint displays as its original rendered slides — in the slide grid and
      when presenting — so it looks the way it looked in PowerPoint.
      <br>`[ARCH]` **Not a URL swap.** The render count structurally disagrees with the parsed-slide
      count (documented in the render trigger's own comments). Needs new `IMPORTED`-branch logic in
      **both** `slideGroupMaterializer.ts` and `slideshowAssembler.ts`, plus render status folded into
      `sourceSignature` so the existing rebuild-on-mismatch mechanism ever notices a `pending → ready`
      transition. Parsed text is retained in the document for search and labels but is never drawn.

- [ ] **R080**: A slide whose render is still pending or has failed shows an explicit state rather than
      a blank, broken, or misleadingly-stale slide.

### Service Items

- [ ] **R081**: A planner can add an **Announcements** item to a service and type free text into it.

- [ ] **R082**: A planner can add a **Miscellaneous** item to a service and type free text into it.

- [ ] **R083**: The **Message** item is a plain free-text box with no URL link field.

- [ ] **R084**: **Hymn** is no longer offered when adding an item, and every existing Hymn item in a
      saved service keeps rendering, printing and presenting exactly as before.
      <br>Palette-only removal by owner decision — no migration. `HYMN` carries free-text
      `hymnName`/`hymnNumber`/`verses` that `SONG` (which requires a catalog `songId`) cannot represent
      losslessly.

- [ ] **R085**: The new item types export to Planning Center as themselves, never silently as
      "Message".
      <br>`[ARCH]` `addSlotAsItem`'s export is an **unguarded if-chain that falls through to a "Message"
      branch** for any unhandled `SlotKind`. `IMPORTED` already needed an explicit skip, with a comment
      naming this exact trap. `[PITFALL]` The exhaustive `switch(slot.kind)` sites are compiler-caught
      (`npm run type-check`, the `vue-tsc --build` form — see CLAUDE.md); this if-chain is not.

### Default Service Template

- [ ] **R086**: A church can define, in Settings, the default set and order of items that make up a new
      blank service.

- [ ] **R087**: A new blank service is built from the church's template, and when Vertical Worship mode
      is on the song slots in that template still receive their required VW types from the chosen
      progression.
      <br>`[ARCH]` VW typing is computed at creation time and **never frozen into the stored template**,
      so toggling VW mode later does not leave stale types behind. `buildSlots()` becomes the fallback
      when no template is set. Depends on R081–R085 — the template editor needs the final `SlotKind` set.

### Feature Toggles

- [x] **R088**: A church can turn AI features off, and with them off the app makes no AI request from
      anywhere.
      <br>`[PITFALL]` The guard must live at the `claudeApi.ts` module entry point, **not** in the `.vue`
      files — hiding UI while leaving the code path callable is the anti-pattern. Requires a test proving
      a direct `claudeApi.ts` call with the toggle off issues no network request. `[FEAT]` Hide the AI
      entry points entirely rather than greying them out. Turning AI off must never alter slide content
      that AI already generated.

- [x] **R089**: A church can turn Planning Center integration off, hiding its features without altering
      already-imported roster data or the status of services already exported.

### Bible Translation

- [ ] **R090**: A church can choose ESV or NLT as the source for scripture passages, in Settings.
      <br>`[STACK]` NLT is **not a drop-in ESV swap** — authentication is a `key` query parameter rather
      than a header, and the response is **HTML, not JSON**, so the proxy in `functions/src/index.ts`
      needs a genuinely different branch and a new `nltApi.ts` needs an HTML-stripping step (native
      `DOMParser`, no new dependency). *Confidence: LOW-MEDIUM on the exact response shape — verify
      against a real sample using the owner's key during planning.*

- [ ] **R091**: Scripture text carries its required translation attribution wherever it is displayed or
      projected.
      <br>`[FEAT]` ESV and NLT are structurally near-identical here: 500 verses without formal
      permission, and for non-saleable media (bulletins, projected slides) **only the initials "(ESV)" or
      "(NLT)" are required** — not a full copyright notice. Built once and shared by the existing
      scripture-slide path and the new congregational-reading path. *Confidence: MEDIUM-HIGH — sourced
      from Crossway's own permissions page and Tyndale's standard notice.*

- [ ] **R092**: Changing the translation setting does not retroactively alter scripture on slides that
      already exist.
      <br>`[ARCH]` Requires a per-slide translation-source field — a schema decision that must be made in
      the same phase, not deferred.

### Slide Typography

- [ ] **R093**: A church can set one font family, weight and size that applies to every slide.
      <br>Family **and weight**, because "Helvetica Neue Light" is a weight and a family-only picker
      cannot reach it. Curated self-hosted woff2 via `@fontsource/*` `[STACK]` — **not** the runtime
      Google Fonts API, which would fail on a projector without internet at service time. Inter is the
      Helvetica Neue stand-in (Light = 300, Regular = 400).
      <br>**Scope confirmed by the owner 2026-08-06:** family, weight and size only — no outline or
      shadow — and **slide surfaces only** (slide grid, Edit Slide drawer preview, presenter view).
      `ServicePrintLayout.vue` is explicitly out of scope.

- [ ] **R094**: The presenter never renders a fallback font — the chosen font is loaded before first
      paint.
      <br>`[PITFALL]` A font flash mid-service on a projection screen is the failure mode. Requires
      `document.fonts.ready`-gated first paint and pre-measurement gating.

### Congregational Reading

- [ ] **R095**: A user can divide a scripture passage into Leader, Congregation and All sections by
      hand, placing the dividers themselves.
      <br>`[FEAT]` **No church-software precedent exists** — ProPresenter, EasyWorship and Proclaim all
      have Bible modules but no leader/congregation split editor. The reference class is subtitle/caption
      editors (click-between-verses to divide) plus per-segment label chips, crossed with printed hymnal
      convention. Drag handles and free-range text selection were both evaluated and **rejected** with
      reasoning — read `FEATURES.md` before designing this. Refrains require non-adjacent segments to
      share a label.

- [ ] **R096**: The AI-proposed split is offered as one starting point among several — alongside
      one-click alternating assignment and starting blank — and disappears entirely when AI is off.
      <br>All three seeding routes write to the same editable `{ text, role }[]` structure. Depends on
      R088.

- [ ] **R097**: The first slide of a congregational reading shows the scripture reference; every later
      slide shows only the speaker label.

### Slide Media

- [ ] **R098**: Dropping several images at once produces slides in filename natural order.
      <br>`[STACK]` JPEG **already works** — `dropRouting.ts:51` classifies on
      `file.type.startsWith('image/')`. Only the *ordering* is defective: `classifyFiles` preserves the
      browser's `DataTransfer` order, which for a multi-file OS drag is selection/filesystem order.
      Native `Intl.Collator({ numeric: true, sensitivity: 'base' })` — no new dependency — and it must
      handle the `slide2` vs `slide10` trap.

### Mobile and Layout

- [ ] **R099**: The Slides tab is usable on a phone.
      <br>`[ARCH]` The Slides tab's mobile-blocking layout was **not** independently audited during
      research — the implementing phase must audit it first rather than assume the scope.
      `[PITFALL]` Retrofitting touch onto SortableJS risks reproducing the documented index bug
      (reproduction case `ZTXcpNRcJTalEQp42fTx`); reuse the exact desktop config with touch-only options
      added rather than reconfiguring.

- [ ] **R100**: Buttons stack on the service edit screen on a phone, the way the Schedule screen already
      does.
      <br>`[ARCH]` `QuarterView.vue` carries the responsive button-stacking recipe to copy.

- [ ] **R101**: Print and Share appear in the contextual action bar at the top of the Services screens
      rather than at the bottom of the page.

- [ ] **R102**: Undo is a link beside the last-saved text rather than a button among the primary
      actions.

- [ ] **R103**: The Getting Started panel on the dashboard can be dismissed.

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Migrating existing HYMN slots to SONG | Owner decision — palette-only removal. HYMN's free-text `hymnName`/`hymnNumber`/`verses` cannot be represented losslessly by SONG, which requires a catalog `songId`; unmatched hymns would become empty slots |
| Runtime Google Fonts API | Considered and rejected during scoping: a projector without internet at service time could not fetch the font. Curated self-hosted woff2 instead |
| Text outline / shadow in slide typography | Raised explicitly from `[FEAT]` research (near-universal in comparable tools, and the legibility technique for text over the v1.4 background images) and **declined by the owner 2026-08-06**. Revisit if it bites during a real service |
| Global typography applied to the printed Order of Service | Owner decision 2026-08-06 — slide surfaces only. `ServicePrintLayout.vue` is a text document, not a slide; one size cannot serve 48pt projected and 11pt printed |
| Migrating `firestore.rules` to custom claims | `[ARCH]` Same-service `exists()`/`get()` is unaffected by firebase-js-sdk#6803. Migrating would trade one staleness class for a worse one — role changes lagging a token refresh |
| Deploying any v1.5 artifact | `firebase deploy` and `gcloud run deploy` remain the owner's step per the v1.5 standing autonomy grant in STATE.md. Every deployable artifact ships built, tested and undeployed |
| Multiple named service templates | One default template per organization for v1.5; named template sets are a v1.6 question if the need appears |
| Line height, alignment, safe-area margins in typography | Out with outline/shadow — family, weight and size only |

## Deferred to v1.6

| Requirement | Reason |
|-------------|--------|
| Full Google Fonts catalog picker | The curated list proves the family+weight+size plumbing first; swapping the picker later does not change the storage shape |
| Text outline / shadow | See Out of Scope — declined for v1.5, but the most likely legibility complaint from real use |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R073 | Phase 39 | Complete |
| R074 | Phase 40 | Complete |
| R075 | Phase 40 | Complete |
| R076 | Phase 41 | Complete |
| R077 | Phase 41 | Complete |
| R078 | Phase 41 | Pending |
| R079 | Phase 42 | Pending |
| R080 | Phase 42 | Pending |
| R081 | Phase 43 | Pending |
| R082 | Phase 43 | Pending |
| R083 | Phase 43 | Pending |
| R084 | Phase 43 | Pending |
| R085 | Phase 43 | Pending |
| R086 | Phase 44 | Pending |
| R087 | Phase 44 | Pending |
| R088 | Phase 39 | Complete |
| R089 | Phase 39 | Complete |
| R090 | Phase 45 | Pending |
| R091 | Phase 45 | Pending |
| R092 | Phase 45 | Pending |
| R093 | Phase 46 | Pending |
| R094 | Phase 46 | Pending |
| R095 | Phase 47 | Pending |
| R096 | Phase 47 | Pending |
| R097 | Phase 47 | Pending |
| R098 | Phase 48 | Pending |
| R099 | Phase 48 | Pending |
| R100 | Phase 48 | Pending |
| R101 | Phase 48 | Pending |
| R102 | Phase 48 | Pending |
| R103 | Phase 48 | Pending |
| R104 | Phase 40.1 | Complete |

**Coverage:**

- v1.5 requirements: 32 total
- Mapped to phases: 32 (Phases 39-48, including inserted Phase 40.1)
- Unmapped: 0

> **R104 inserted 2026-08-06** mid-milestone, after Phase 40's code review surfaced a pre-existing
> `firestore.rules` privilege-escalation gap. Phase 40.1 was numbered as a decimal rather than
> renumbering Phases 41-48, and sequenced immediately after Phase 40 so both rules files ship in one
> owner deploy session.

---
*Requirements defined: 2026-08-06*
*Last updated: 2026-08-06 — ROADMAP.md created; Phases 39-48 (10 phases, compressed from SUMMARY.md's
12-phase default under this project's `coarse` granularity setting), 31/31 requirements mapped, 0
unmapped.*
