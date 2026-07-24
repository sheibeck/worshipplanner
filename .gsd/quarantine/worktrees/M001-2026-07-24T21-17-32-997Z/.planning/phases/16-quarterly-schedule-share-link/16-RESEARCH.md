# Phase 16: Quarterly Schedule Share Link — Research

**Researched:** 2026-07-09
**Domain:** Vue 3 SPA feature work — Firestore data-model relocation, scheduler algorithm fix, public share page redesign, editor UX redesign. No new external dependencies.
**Confidence:** MEDIUM-HIGH (all findings grounded directly in the actual codebase via full-file reads; the R-12 algorithm and R-09 layout direction carry the most residual design risk, flagged explicitly below)

## Summary

This phase touches five codebase areas that are more interconnected than the SPEC's 14 requirements suggest: (1) a routing addition for the memorable share URL, (2) a Firestore data-model relocation that moves per-role serve frequency from `Person` (standing) to `PersonQuarterData` (quarter-scoped) and unifies two currently-separate fields (`roleFrequencies` cadence-N and `roleTiers` tier) into one, (3) a scheduler algorithm change (`propagatePairing`) that must read the new quarter-scoped frequency and gate partner pull-ins by remaining cadence budget, (4) a public share-page redesign adding a matrix view that turns out to already match `QuarterGrid`'s existing table orientation, and (5) a Schedule-page UX pass that — evidence shows — should evolve the current card-stack layout rather than replace it with a calendar widget.

No new npm packages are required. Every requirement is implementable with the existing stack (Vue 3.5, Vue Router 5.0.3, Pinia 3, Firebase 12, Tailwind v4, Vitest 4). The highest-value research findings are: (a) `QuarterGrid.vue`'s table is **already** roles-across-top/dates-down (verified by direct read), which resolves D-12 with near-certainty; (b) Vue Router's route-specificity scoring means the reserved-slug guard (D-19) must be enforced at slug-derivation time, not at the router level, because a static route will always out-rank the dynamic `/:slug/...` pattern for a colliding first segment; (c) Firestore Security Rules' `create`-vs-`update` distinction (based on `resource == null`) gives a lock-free, Cloud-Function-free mechanism for slug-collision handling that matches this project's existing client-only Firestore architecture; (d) the R-12 pairing fix has a clean, low-risk implementation as a single gate inside `propagatePairing`, but a residual edge case (a lower-cadence partner being picked *independently* by the main greedy loop, off the anchor's date) cannot be ruled out in full generality — flagged as an Open Question with a recommended test-scenario mitigation.

**Primary recommendation:** Implement the frequency-model relocation as ONE new field (`PersonQuarterData.roleFrequency: Record<string, RoleFrequencyEntry>`) replacing `Person.roleFrequencies`/`frequencyTargetN` and `PersonQuarterData.roleTiers`/`frequencyTier` outright (greenfield, no migration per D-04); gate `propagatePairing` with a per-role remaining-cadence-budget predicate reusing the existing deficit machinery; evolve the Schedule page's existing card-stack layout (don't pivot to a calendar widget) with a shared, localStorage-backed `CollapsibleSection` component; and resolve the memorable URL via a single new public, denormalized `quarterShares/{slug}__q{N}-{year}` Firestore document (no cross-collection join needed at read time), guarded by a separate `orgSlugs/{slug}` claim-registry collection for uniqueness.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Matrix + list rendering, name filter | Browser/Client (Vue component) | Database (reads denormalized `shareTokens`/`quarterShares` snapshot only) | Public page must stay read-only, no roster/auth access (D-24 pattern) — all filtering/view-toggling happens client-side against the already-fetched snapshot |
| Memorable URL resolution | Browser/Client (vue-router) + Database | — | Client-side SPA with no SSR; router param parsing + a single Firestore doc read resolve the URL, no backend/API involved |
| Slug uniqueness enforcement | Database (Firestore Security Rules) | Browser/Client (retry-with-suffix loop) | No Cloud Functions used for data logic in this app (functions/ only proxies PC/Anthropic APIs) — enforcement must live in security rules' create/update semantics, orchestrated by client retry logic |
| Per-role frequency storage | Database (Firestore `PersonQuarterData`) | — | Quarter-scoped by definition (D-04) — moves fully out of the standing `Person` tier |
| Pairing/cadence reconciliation | Browser/Client (pure function `scheduler.ts`) | — | Existing scheduler is a pure, framework-free, unit-tested function (no DB/network) — the R-12 fix stays inside that boundary |
| Cross-screen roles editing | Browser/Client (Vue) + Database (`roster` store) | — | Roles remain standing on `Person`; both `RosterView` and `QuarterView` write through the same `rosterStore.upsertPeople`/`updatePerson` path (D-09) |
| Collapsible section state | Browser/Client (localStorage) | — | Per-user, per-device preference — no server round-trip needed (D-17) |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**Pairing fix — R-12 (`scheduler.ts::propagatePairing`)**
- D-01: Containment (asymmetric) guarantee — every date the lower-cadence partner serves must also be a date the higher-cadence partner serves; the higher-cadence partner may serve extra dates alone. NOT symmetric always-together.
- D-02: Even-spread, deficit-aligned placement — reuse the existing deficit model `(dateIndex+1)/n - servedByRole`; gate `propagatePairing` so a partner is only pulled in when it would not exceed their own per-role cadence target.
- D-03: Cadence-driven skips are silent — do NOT add them to `pairingConflicts`; that list stays reserved for genuine problems (blackout, no eligible role, group-rule violation).
- D-04-note: The R-12 fix reads the quarter-scoped per-role frequency (D-04), not a standing value. Existing hard constraints (blackout, `isGroupCompatible`) must remain intact.

**Frequency model — R-05**
- D-04: Frequency is quarter-scoped + per-role — the single source of truth. `Person.roleFrequencies`/`Person.frequencyTargetN` are removed as a live source. Greenfield — no migration, losing standing-frequency data is acceptable.
- D-05: One "frequency" control, Phase-14 shape. Values = the cadences (weekly/2×month/monthly/…) plus "fill-in" and "out this quarter". Exact persistence shape on `PersonQuarterData` (merge `roleTiers` enum with a per-role cadence number, vs. a single new per-role structure) → planner/researcher decides, honoring: per-role, quarter-scoped, values include fill-in + out.
- D-06: New-quarter seeding (per person, per role) — default each (person, role) frequency to that person's value for that role in the previous quarter if it exists; otherwise once/month (N=4). Also seed pairing/serve-with relationships from the previous quarter when present. Blackout Sundays do NOT carry forward.

**Editing surfaces — R-04/05/07 (scope reduction, supersedes SPEC "both screens")**
- D-07: Volunteer edit screen (`RosterView`) edits only roles (+ name/email/active). No frequency, no blackout, no pairing there.
- D-08: All scheduling data (per-role frequency, blackout, pairing) lives on the Schedule screen's per-quarter per-person editor. Editing schemas stay separate between the two screens.
- D-09: Roles are editable from BOTH screens, written through the `roster` store from either surface — identical persisted result.
- D-10: Net effect — R-04 pairing-cross-screen, R-05 frequency-cross-screen, R-07 blackout-cross-screen are descoped; only roles are cross-screen. Volunteer screen needs no quarter context.

**Schedule-page redesign — R-09/R-10**
- D-11: Layout direction is fully open — the research note decides (card-stack evolution vs calendar/matrix-centric), incl. calendar/matrix format evaluated on merit. Must integrate R-11 collapsible sections.
- D-12: Editing-grid format deferred to research — mirror the share-view matrix (roles × dates) or keep the current date-grouped `QuarterGrid` shape.
- D-13: Add-quarter flow — separate "select an existing quarter" (quarter switcher — dropdown/segmented) from "add a new quarter" (visually distinct secondary "Add quarter" button opening a small create form/modal).

**Share page — R-01/R-03**
- D-14: Matrix auto-falls back to list on narrow/phone screens. Matrix renders on wider screens; phones default to list; toggle remains available on both.
- D-15: Name filter is a searchable dropdown/typeahead of snapshot names only (no typos); exact selected name persists in the URL.
- D-16: Both view mode and name filter persist in the URL (extends SPEC's filter-in-URL requirement to also cover the view toggle).

**Smaller decisions locked by default**
- D-17: Collapsible sections (R-11) default to expanded; collapse/expand state remembered per-user (localStorage).
- D-18: Church slug stability (R-02) — auto-derived once on first share (lowercase, hyphenated, non-alphanumerics stripped), stable across org renames. Only a manual Settings edit changes it. Collision → numeric suffix.
- D-19: Reserved-slug guard (R-02) — `/{slug}/quarter{N}-{YYYY}` must not shadow existing app routes. Reserved segments: `songs`, `roster`, `schedule`, `services`, `team`, `settings`, `login`, `share`, `quarter-share`, `public`.

### Claude's Discretion
- Exact persistence shape for the quarter-scoped per-role frequency (D-05) — merge with `roleTiers` vs a new per-role structure on `PersonQuarterData`. **→ Resolved below: single new structure.**
- The precise reconciliation mechanism inside `propagatePairing` (D-01/D-02) — remaining-cadence predicate before `assignToRole` vs. a post-pass, as long as containment + even-spread + existing hard constraints hold and `scheduler.test.ts` passes. **→ Resolved below: pre-assignment gate, single pass.**
- QuarterGrid slide-out (R-14) mobile presentation (full-width sheet vs right panel) — reuse `AvailabilityDrawer`'s Teleport-to-body pattern.
- Matrix multi-person cell rendering (roles with count > 1) — stacked vs comma-separated names. **→ Resolved below: comma-separated, matches existing list view.**
- Exact "previous quarter" selection for seeding (D-06) — chronologically prior by (year, quarterNum).

### Deferred Ideas (OUT OF SCOPE)
- Cross-screen editing of frequency/blackout/pairing (descoped this phase, D-10) — only roles are cross-screen.
- Horizontal-scroll matrix on mobile (sticky date column) — not chosen (D-14 falls back to list instead).
- `.planning/todos/pending/per-role-frequency-and-vocal-instrument-pairing.md` — already shipped in Phase 15; its only leftover (pairing honoring per-role frequency) is R-12 here.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R-01 | Share-link matrix view (roles × dates, list toggle) | "Matrix Rendering" (Architecture Patterns); `QuarterGrid.vue`'s existing table orientation directly informs the matrix cell/header structure |
| R-02 | Memorable share URL `/{slug}/quarter{N}-{YYYY}` | "Memorable URL Routing" section — route pattern, Firestore doc design, slug uniqueness via Security Rules create/update semantics |
| R-03 | Filter by name | "Name Filter Typeahead" — reuses `AvailabilityDrawer.vue`'s existing pairing-typeahead pattern; URL persistence via `router.replace({query})` (existing `SongsView.vue` convention) |
| R-04 | Cross-screen pairing & role editing | **Descoped per D-10** — only roles cross-screen; see "Editing Surfaces" |
| R-05 | Unify serve frequency | "Frequency Model — Concrete Recommendation" — full field/type design, seeding logic, affected-files list |
| R-06 | Quarter framed as blackout dates | Minor labeling change in `AvailabilityDrawer.vue` — no architectural research needed beyond confirming `blackoutDates` stays quarter-scoped (verified in `types/roster.ts`) |
| R-07 | Unavailable Sundays editable from both screens | **Descoped per D-10** — blackout stays Schedule-screen-only |
| R-08 | Remove date-range control | Direct code deletion in `AvailabilityDrawer.vue` (lines ~118-145 range picker) — verified location |
| R-09 | Schedule-page UX research + redesign | "Schedule-Page UX Redesign — Concrete Recommendation" (largest section) |
| R-10 | Clearer add-quarter flow | Included in the UX redesign section — concrete quarter-switcher + separate "Add quarter" modal design |
| R-11 | Collapsible sections | "Reusable CollapsibleSection Component" — extracted from existing `ArrangementAccordion.vue` pattern + localStorage persistence |
| R-12 | Pairing honors per-role frequency | "Scheduler Fix — propagatePairing" (largest section) — concrete gate mechanism, containment analysis, residual risk documented |
| R-13 | Whole-cell click target | `QuarterGrid.vue` verified current click target is `@click` on the outer `<button>` already covering the whole cell — see Pitfall note (may already be satisfied) |
| R-14 | Right-side slide-out group editor | Reuse `AvailabilityDrawer.vue`'s exact Teleport/Transition markup — verified pattern |

</phase_requirements>

## Standard Stack

### Core (all already installed — no new packages)
| Library | Installed | Latest (npm) | Purpose | Notes |
|---------|-----------|---------------|---------|-------|
| vue | ^3.5.29 | — (unchanged) | SPA framework | No SSR — client-only, `window` access is always safe |
| vue-router | 5.0.3 (installed) | 5.1.0 [VERIFIED: npm registry] | Routing, memorable-URL matching | v5 is a "transition release" from v4 — path-matching/ranking semantics unchanged (no breaking changes if not using file-based routing) [CITED: router.vuejs.org migration guide] |
| pinia | ^3.0.4 | — (unchanged) | Stores (`roster`, `quarters`, `auth`) | No change to store architecture needed |
| firebase | ^12.0.0 | — (unchanged) | Firestore client SDK, Auth | New collections (`orgSlugs`, `quarterShares`) use the same client SDK calls as `shareTokens` |
| tailwindcss | ^4.0.0 | — (unchanged) | Styling | Existing "static class map" convention (Tailwind v4 purge safety) must be followed for any new dynamic-class UI (matrix cells, collapsible chevrons) |
| vitest | ^4.0.18 | — (unchanged) | Unit/component tests | `npm run test:unit`; Firestore rules tests via `npm run test:rules` (`firebase emulators:exec`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side slug-collision handling via Firestore create/update rule semantics | A Cloud Function with a transaction | Cloud Function would be more robust under high write concurrency, but this app has zero precedent for Firestore-triggered functions (the only function is an HTTP API proxy) — introducing one is a disproportionate architectural addition for a low-frequency, low-concurrency operation (slug claimed once per org, ever) |
| Single new `roleFrequency` structure on `PersonQuarterData` | Keep `roleTiers` and add a parallel per-role N map | Two parallel maps can drift (e.g., `tier='out'` but a stale `n` value lingers) and require two lookups everywhere (scheduler, `AvailabilityRosterTable`, `QuarterGrid`) instead of one — rejected in favor of one field, one lookup |
| Card-stack evolution for R-09 | Calendar/matrix-centric single-view redesign (e.g., integrate a calendar library) | `QuarterGrid` is already the matrix; a calendar-library pivot is a large, disproportionate lift for a UX-polish phase whose other 13 requirements are incremental (collapsible sections, slide-out editor, clearer add-quarter flow) — see full reasoning below |

**Installation:** None required — this phase uses only already-installed dependencies.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new external packages; every requirement is implementable with the existing stack listed above. No `slopcheck`/registry verification was necessary.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
                       │         Public visitor (no auth)         │
                       └───────────────┬───────────────────────────┘
                                        │
                    ┌───────────────────┼────────────────────┐
                    │                   │                    │
           /quarter-share/:token   /:slug/quarter:num-:year   │
                    │                   │                    │
                    ▼                   ▼                    │
          ┌──────────────────┐  ┌───────────────────────┐    │
          │ shareTokens/{tok} │  │ quarterShares/{slug}__ │    │
          │ (existing, freezes│  │ q{N}-{year} (NEW,      │    │
          │  per-token copy)  │  │  always overwritten =  │    │
          │                   │  │  latest finalize)      │    │
          └─────────┬─────────┘  └───────────┬────────────┘    │
                    │                        │                 │
                    └───────────┬────────────┘                 │
                                ▼                                │
                    ┌───────────────────────┐                   │
                    │   QuarterShareView.vue │◄──────────────────┘
                    │  (view=matrix|list,    │  hydrate from route.query
                    │   name filter)         │  → router.replace on change
                    └───────────────────────┘

  ── Authenticated editor side ──────────────────────────────────────

  QuarterView.vue (Schedule)
    ├─ Quarter switcher (dropdown) ── separate ── "+ Add quarter" (modal, D-13)
    ├─ CollapsibleSection: Volunteer Availability → AvailabilityRosterTable → AvailabilityDrawer (slide-out)
    ├─ CollapsibleSection: Service dates
    ├─ CollapsibleSection: Generate controls
    └─ QuarterGrid (matrix; whole-cell click → right slide-out, R-13/14)
           │
           ▼
    quartersStore.assignPerson/clearAssignment/swapAssignment
           │
           ▼
    quarters/{id}.calendar[date][roleId] = personId[]  (dot-path writes, unchanged)

  proposeQuarterSchedule (scheduler.ts, pure fn)
    reads: PersonQuarterData.roleFrequency (NEW, per-role {tier,n})
           PersonQuarterData.blackoutDates, .pairedWith
    propagatePairing(anchor):
      for partner of anchor's pairedWith:
        [existing hard-constraint checks: blackout / role match / group-compat — unchanged]
        NEW: filter eligibleRoles to where remainingBudget(partner, role) > 0
        if none remain → silent skip (D-03, no pairingConflicts entry)
        else assignToRole(...) + recurse
```

### Recommended Project Structure (new/changed files only)
```
src/
├── types/roster.ts                    # PersonQuarterData.roleFrequency (NEW); remove Person.roleFrequencies/frequencyTargetN
├── utils/scheduler.ts                 # propagatePairing gate; tierOf/cadence lookups repointed to PQD.roleFrequency
├── utils/__tests__/scheduler.test.ts  # rewrite makePerson/makePQD factories; add containment/even-spread/silent-skip tests
├── utils/slug.ts                      # NEW — deriveSlug(), claimSlug() with numeric-suffix retry
├── stores/quarters.ts                 # createQuarter() seeding (D-06); finalizeAndShare() also writes quarterShares/{docId}
├── stores/roster.ts                   # remove roleFrequencies/frequencyTargetN read/write paths
├── router/index.ts                    # new route: /:slug/quarter:num(\d+)-:year(\d+)
├── views/QuarterShareView.vue         # add matrix/list toggle, name filter, URL query sync, mobile-default detection
├── components/QuarterShareMatrix.vue  # NEW — presentational roles×dates table (read-only, snapshot-only)
├── components/CollapsibleSection.vue  # NEW — shared accordion w/ localStorage persistence (extracted pattern)
├── components/AvailabilityDrawer.vue  # remove date-range picker (R-08); replace tier buttons with unified roleFrequency control; remove frequencyTargetN write
├── components/AvailabilityRosterTable.vue  # repoint freqBadge/aggregateTier/allRolesOut to PQD.roleFrequency
├── components/QuarterGrid.vue         # right-slide-out editor replacing expand-underneath row; tierOf repointed
├── views/QuarterView.vue              # quarter switcher + separate "Add quarter" modal (D-13); wrap 3 sections in CollapsibleSection
├── views/RosterView.vue               # remove per-role frequency control + formRoleFrequencies (D-07); keep roles editing
├── views/SettingsView.vue             # add editable Slug field (D-18)
└── firestore.rules                    # orgSlugs/{slug} (create-only claim), quarterShares/{id} (read: true, create/update: isSignedIn())
```

### Pattern 1: Frequency Model — Concrete Recommendation (D-05)

**What:** Replace `Person.roleFrequencies`/`Person.frequencyTargetN` (removed, D-04) and `PersonQuarterData.roleTiers`/`frequencyTier` (superseded) with ONE new field:

```typescript
// src/types/roster.ts
export interface RoleFrequencyEntry {
  tier: FrequencyTier // 'regular' | 'fillin' | 'out'
  n: number           // 1-in-N cadence; meaningful only when tier === 'regular'; default 4
}

export interface PersonQuarterData {
  personId: string
  blackoutDates: string[]
  pairedWith: string[]
  /** Quarter-scoped, per-role, single source of truth (D-04/D-05) — replaces the old
   *  standing Person.roleFrequencies/frequencyTargetN AND the old PersonQuarterData
   *  roleTiers/frequencyTier split. One control, one lookup, one field per held role. */
  roleFrequency?: Record<string, RoleFrequencyEntry>
  note?: string
}

export interface Person {
  id: string
  name: string
  email: string
  phone: string
  active: boolean
  roles: string[]           // unchanged, standing (D-09)
  pcPersonId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  // roleFrequencies / frequencyTargetN REMOVED — no longer a live source (D-04)
}
```

**Why one structure, not two parallel maps:** `roleTiers` (tier only) and the old `roleFrequencies` (N only) can drift — e.g. `tier: 'out'` with a stale `n: 2` sitting unused — and every reader (scheduler, `AvailabilityRosterTable`, `QuarterGrid`) needs two lookups instead of one. A single `{tier, n}` struct per role matches the UX goal directly: "one frequency control" (D-05) maps to one data field.

**Default when absent:** `{ tier: 'regular', n: 4 }` — matches the existing `DEFAULT_ROLES`/D-06 "once/month" default exactly, and the existing `FREQ_PRESETS` monthly option already uses `n: 4`.

**Files requiring updates (verified read sites):**
- `scheduler.ts` — `tierOf()` reads `roleFrequency[roleId].tier` (was `roleTiers[roleId]`); the cadence-N lookup (`p.roleFrequencies?.[roleId] ?? p.frequencyTargetN`, line 214) becomes `pqdById.get(personId)?.roleFrequency?.[roleId]?.n ?? 4`.
- `scheduler.test.ts` — `makePerson`/`makePQD` factories currently model cadence on `Person` and tier on `PersonQuarterData` separately; **expect this to touch most of the ~20 existing test cases**, not just add new ones for R-12.
- `AvailabilityDrawer.vue` — `FREQ_PRESETS` selection writes `draft.roleFrequency[roleId] = {tier: preset.tier, n: preset.n}` in one write (was two: `draft.roleTiers[roleId] = preset.tier` + a separate standing `frequencyTargetN` write via `rosterStore.updatePerson` on save, lines 537-541 — **that standing write is deleted entirely**).
- `AvailabilityRosterTable.vue` — `tierOf`, `aggregateTier`, `allRolesOut`, `freqBadge`, `freqLabel` all currently read `pqd.roleTiers`/`pqd.frequencyTier` and `person.frequencyTargetN` — repoint to `pqd.roleFrequency`.
- `QuarterGrid.vue` — `tierOf()` (line 306) repoint to `roleFrequency[roleId]?.tier`.
- `RosterView.vue` — delete the entire "Serve frequency by role" form section (lines ~325-345), `formRoleFrequencies`, `formFrequencyN`, the `heldRolesSorted` watcher, and the `minRoleFrequency`/frequency sort column (D-07 — roles-only surface).
- `roster.ts` (store) — delete `roleFrequencies` migration block (lines 59-74), `addPerson`/`updatePerson`/`upsertPeople` frequency synthesis logic.
- `quarters.ts` (store) — `setPersonAvailability` writes `roleFrequency` instead of `frequencyTier`/`roleTiers`; `createQuarter` gains D-06 seeding (see Code Examples).

**Do not attempt a data migration.** D-04 explicitly authorizes losing current standing-frequency data — leave the old `roleFrequencies`/`frequencyTargetN` fields as harmless orphaned data in existing Firestore `Person` docs (don't write cleanup code to strip them; that's unscoped extra work with no functional benefit).

### Pattern 2: Scheduler Fix — `propagatePairing` (R-12)

**What:** Gate partner pull-in by the partner's own remaining per-role cadence budget, computed against the whole quarter (not just "so far"), reusing the existing deficit machinery's inputs.

```typescript
// src/utils/scheduler.ts — inside proposeQuarterSchedule, per date
const roleFrequencyOf = (personId: string, roleId: string): RoleFrequencyEntry =>
  pqdById.get(personId)?.roleFrequency?.[roleId] ?? { tier: 'regular', n: 4 }

// D-02: whole-quarter budget ceiling for a person's role, e.g. n=4 over 13 dates -> ceil(13/4) = 4
const roleBudget = (personId: string, roleId: string): number =>
  Math.ceil(serviceDates.length / roleFrequencyOf(personId, roleId).n)

const propagatePairing = (personId: string, visited: Set<string>) => {
  for (const partnerId of partnersOf(personId)) {
    // ...existing visited/alreadyToday/blackout/roleMatchesByName/notOutTier/
    //    isGroupCompatible checks — UNCHANGED, these remain hard constraints...

    // NEW (D-01/D-02): among group-compatible eligible roles, keep only those where
    // pulling the partner in would NOT exceed their own per-role cadence budget.
    const withinCadence = eligibleRoles.filter(
      (r) => getServedByRole(partnerId, r.roleId) < roleBudget(partnerId, r.roleId),
    )
    if (withinCadence.length === 0) {
      // D-03: cadence-driven skip is silent — NOT a pairingConflicts entry.
      // This is the expected outcome when the higher-cadence anchor (e.g. Tim, 2x/month)
      // has "extra" occurrences beyond what the lower-cadence partner (e.g. Nolan, 1x/month)
      // can absorb — those extras correctly proceed without the partner.
      continue
    }
    const withCapacity = withinCadence.find((r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count)
    const target = withCapacity ?? withinCadence[0]!
    assignToRole(target.roleId, partnerId)
    propagatePairing(partnerId, visited)
  }
}
```

**Why this satisfies D-02's even-spread requirement "for free":** the anchor (Tim, N=2) is already selected by the *existing, unmodified* deficit-fair-share loop, which already spreads Tim's own occurrences evenly across the quarter. Nolan's pulled-in occurrences are a subsequence of Tim's already-evenly-spread dates (capped at Nolan's own budget), so Nolan's dates inherit the even spread without any new spreading logic.

**Why this is a single, low-risk change:** it touches only `propagatePairing`'s existing filter chain — no change to the main `eligible()` candidate loop, no change to `assignToRole`, no change to the deficit-scoring formula used by the primary loop.

### Anti-Patterns to Avoid
- **Symmetric always-together pairing:** clamping the higher-cadence partner (Tim) down to the lower-cadence partner's (Nolan's) cadence is explicitly rejected by D-01 — only containment in one direction is required.
- **Logging cadence-driven skips as conflicts:** per D-03, only log genuine problems (blackout, no role, group violation) — a cadence-full partner skip is normal, expected behavior, not a warning-worthy event.
- **Two parallel per-role maps for frequency:** rejected above (Pattern 1) — causes drift and doubles lookup sites.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Name-filter typeahead on the share page | A new autocomplete component/library | The exact pattern already in `AvailabilityDrawer.vue`'s "Must serve with" control (text input + absolute-positioned filtered dropdown, `@focus`/`@blur` with `window.setTimeout` debounce) | Zero new dependencies, consistent UX, already proven in this codebase |
| Slug-collision uniqueness enforcement | A Cloud Function transaction, or a client-side "read-then-write" race-prone check | Firestore Security Rules' `create` (fires only when `resource == null`) vs `update` distinction on a dedicated `orgSlugs/{slug}` doc — attempt `setDoc`, catch permission-denied, retry with numeric suffix | First-writer-wins is enforced server-side by the rules engine itself, no transaction or Cloud Function needed, matches this app's existing client-only Firestore architecture |
| Collapsible section chrome (chevron, open/close transition) | A new accordion library | Extract the existing `ArrangementAccordion.vue` chevron-rotate + `v-if` body pattern into a shared `CollapsibleSection.vue`, adding localStorage persistence | The visual pattern already exists and is proven in this codebase; only the persistence layer is new |
| URL query-param sync for view mode + name filter | A router plugin or manual `window.history` calls | `router.replace({ query: { ...route.query, view, name } })` — the exact convention already used in `SongsView.vue` for its `?import=true` param | Matches established project convention, avoids polluting browser history on every filter keystroke |
| Mobile/desktop detection for the matrix fallback (D-14) | A CSS-only breakpoint trick | A small `window.matchMedia('(min-width: 640px)')`-backed ref (new pattern — none exists yet in this codebase) | Matrix and list are structurally different DOM trees (not a CSS show/hide toggle), so a CSS-only approach can't produce "list DOM on phones, matrix DOM on desktop" — this is the one genuinely new client-side pattern this phase introduces; keep it in a small composable (e.g. `useIsMobile()`) so it's reusable if needed elsewhere |

**Key insight:** This phase's biggest hand-roll risk is over-engineering the memorable-URL resolution (e.g., a 2-hop orgId lookup, or a Cloud Function). The single-document `quarterShares/{slug}__q{N}-{year}` design (below) avoids both.

### Pattern 3: Memorable URL Routing (R-02, D-18/D-19)

**Route definition** (append to `router/index.ts`, order doesn't matter — Vue Router ranks by specificity, confirmed via official docs):
```typescript
{
  path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
  name: 'quarter-memorable-share',
  component: () => import('../views/QuarterShareView.vue'), // same component, reads route.params instead of :token
  // Intentionally no meta.requiresAuth — public route, mirrors /quarter-share/:token
},
```

**Why the reserved-slug guard must be enforced at slug-derivation time, not routing:** Vue Router's matcher ranks a route with a static first segment (e.g. `/services/:id`) *strictly higher* than one with a dynamic first segment (`/:slug/...`) for any URL where both could match. Concretely: if an org's slug were `services`, visiting `/services/quarter1-2026` would resolve to `ServiceEditorView` with `id: 'quarter1-2026'` (the existing `/services/:id` route wins), **silently shadowing** the intended share page — the new route would simply never be reached for that org. [HIGH confidence, CITED: router.vuejs.org route-matching-syntax.html — "order of the routes array doesn't matter" because ranking is done by segment specificity, static beats dynamic]. This means the reserved-word check (`songs`, `roster`, `schedule`, `services`, `team`, `settings`, `login`, `share`, `quarter-share`, `public`) must reject/suffix a candidate slug **before** it's ever claimed — there is no router-level fix that helps once a colliding slug exists.

**Firestore document design:**
```typescript
// Public, read-only, always-overwritten-on-reshare (deliberately different from
// shareTokens/{token}'s frozen-per-token behavior — see Pitfall below):
// doc path: quarterShares/{slug}__q{quarterNum}-{year}
{
  orgSlug: string,       // for debugging/display only
  quarterSnapshot: { label, serviceDates, roles, calendar }, // IDENTICAL shape to shareTokens' snapshot
  token: string,         // the current opaque token, for cross-reference
  updatedAt: serverTimestamp(),
}

// Separate claim registry — sole purpose is uniqueness, never read at share-page runtime:
// doc path: orgSlugs/{slug} -> { orgId }
```

```typescript
// src/utils/slug.ts
export function deriveSlug(orgName: string): string {
  return orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export const RESERVED_SLUGS = new Set([
  'songs', 'roster', 'schedule', 'services', 'team',
  'settings', 'login', 'share', 'quarter-share', 'public',
])

// Attempts base, then base-2, base-3, ... until an unclaimed (or reserved-free) slug succeeds.
// Each attempt is a setDoc create-only write against orgSlugs/{candidate}; a permission-denied
// error (existing doc -> Firestore treats the write as 'update', which the rules deny) means
// "taken" -> try next suffix. Reserved words are pre-filtered client-side before ever attempting
// a write (no need to distinguish reserved-taken from claimed-taken at the rules layer).
```

**Security rules addition:**
```
match /orgSlugs/{slug} {
  allow read: if true;
  allow create: if isSignedIn(); // resource == null only when unclaimed — first-writer-wins
  allow update, delete: if false; // slug reassignment abandons the old claim, doesn't reclaim it
}
match /quarterShares/{shareId} {
  allow read: if true;
  allow create, update: if isSignedIn(); // mirrors shareTokens' existing isSignedIn()-only posture
  allow delete: if false;
}
```
This mirrors the existing `shareTokens` rule's `isSignedIn()`-only posture (not `isOrgEditor(orgId)`) — consistent with the app's current threat model where the public-share write path relies on the writer already having had to read the real quarter data client-side to construct an accurate snapshot in the first place. [ASSUMED — this preserves existing convention rather than introducing a stricter model; flagged for confirmation since it's a security-adjacent design choice, not merely a UI pattern.]

### Pattern 4: Matrix Rendering (R-01) — reuses `QuarterGrid`'s exact orientation

**Verified finding:** `QuarterGrid.vue`'s `<table>` already renders `<th v-for="role">` (columns = roles) with `<tr v-for="date">` (rows = dates) — this is **already** "roles across the top, dates down the left," the exact orientation the SPEC wants for the new public matrix (R-01). This resolves D-12 with high confidence: **no axis reorientation is needed anywhere** — the editing grid and the new share matrix already agree on orientation. The redesign work for D-12 is therefore purely cosmetic parity (read-only cells, no click targets, no group-conflict badges) — not a structural remap.

```vue
<!-- New: QuarterShareMatrix.vue — read-only, snapshot-only (D-24 preserved) -->
<table>
  <thead><tr><th>Date</th><th v-for="role in sortedRoles">{{ role.name }}</th></tr></thead>
  <tbody>
    <tr v-for="date in filteredDates" :key="date">
      <td>{{ formatDateLabel(date) }}</td>
      <td v-for="role in sortedRoles" :key="role.id">
        {{ peopleFor(date, role.id).join(', ') || '—' }}  <!-- comma-separated, matches list view -->
      </td>
    </tr>
  </tbody>
</table>
```

Multi-person cell rendering (roles with `count > 1`, e.g. per-date role overrides): **comma-separated**, matching the existing `QuarterShareView.vue` list-view rendering (`peopleFor(date, role.id).join(', ')`) exactly — no new visual pattern introduced. Note: no `DEFAULT_ROLES` entry currently has `defaultCount > 1`, but per-date `roleOverridesByDate` can set arbitrary counts, so multi-person cells are a real (if rare) case.

**Mobile fallback (D-14):** determine initial view mode with priority (1) `route.query.view` if present, else (2) `window.matchMedia('(min-width: 640px)').matches ? 'matrix' : 'list'`. The manual toggle always overrides and updates `route.query.view` via `router.replace`.

### Pattern 5: Schedule-Page UX Redesign — Concrete Recommendation (R-09/R-10/R-11, D-11)

**Recommendation: evolve the existing card-stack layout. Do not pivot to a calendar/matrix-centric redesign.**

Reasoning, grounded in direct code evidence:
1. `QuarterGrid` — the page's actual data-entry surface — is *already* a roles×dates matrix (Pattern 4 above). A "calendar/matrix-centric redesign" is, structurally, already halfway accomplished; there is no separate "calendar view" left to build.
2. R-11 (collapsible sections) only makes sense as a decluttering pass over an *existing stack of cards* — it's direct evidence the intended direction is "keep the stack, make it collapsible + reorganize," not "throw the stack away for a calendar widget."
3. R-09's own acceptance criteria is modest: a research artifact plus a "verifiable diff between before/after layout" — not a full information-architecture overhaul. A calendar-library pivot (new dependency, drag-and-drop, month/week navigation) is disproportionate engineering lift for a UX-polish phase whose other 13 requirements are targeted and incremental.
4. No existing UI library or calendar dependency is present in `package.json` — introducing one would be the first non-trivial new dependency in a phase explicitly scoped as internal feature/UX work.

**Concrete redesign:**
- **Quarter switcher vs. Add quarter (D-13):** replace the current single card containing both the `<select>` of existing quarters AND the year/quarter/"New quarter" inputs (`QuarterView.vue` lines 63-105) with: (a) a lightweight dropdown or segmented control for *selecting* an existing quarter, visually primary/lightweight; (b) a clearly secondary "+ Add quarter" button that opens a small modal/inline form (year input, quarter select, create button) — visually distinct (e.g., outlined/ghost button vs. the selector's filled control), so the two actions are never conflated.
- **Collapsible sections (R-11):** wrap "Volunteer Availability," "Service dates," and "Generate controls" (the three existing `rounded-lg border ... p-5 mb-6` cards) in a new shared `CollapsibleSection.vue` (title prop, `localStorage` key prop, chevron affordance copied from `ArrangementAccordion.vue`), default-expanded, remembering state per section id (e.g. `localStorage['schedule.section.volunteerAvailability'] = 'open'|'closed'`). `QuarterGrid` itself stays always-visible (primary work surface, not a "dense section" to collapse).
- **Roster page (D-17 applies there too):** wrap "Roles config panel" and "Inactive Volunteers" (already visually separated `mt-8` blocks in `RosterView.vue`) in the same shared `CollapsibleSection.vue`. The main active-people table stays always visible (primary content).
- **QuarterGrid slide-out (R-13/R-14):** replace the `<tr v-if="expandedCell">` expand-underneath row (lines 81-184) with the exact `Teleport to="body"` + backdrop + right-anchored `Transition` markup already used by `AvailabilityDrawer.vue` (lines 1-31) — same enter/leave classes, same z-index scheme (`z-40` backdrop, `z-50` panel).
- **R-13 whole-cell click target — verify before treating as new work:** `QuarterGrid.vue`'s current cell markup is a `<button class="w-full text-left ...">` wrapping the *entire* cell content (pills + unfilled/conflict badges), with `@click="toggleCell(...)"` on that outer button and `@click.stop` only on the individual remove-pill spans (line 51). This already looks like a whole-cell click target. **Before implementing R-13 as new work, the planner should verify whether this criterion is already met** — the acceptance criteria ("clicking any part of a group cell, including empty space, opens the editor") appears to already hold given the current markup; R-13 may reduce to a verification/regression-test task rather than new implementation.

## Common Pitfalls

### Pitfall 1: Reserved-slug shadowing is silent, not an error
**What goes wrong:** If a colliding slug were ever allowed to exist, the affected org's memorable URL wouldn't throw or 404 — it would silently resolve to an unrelated existing page (e.g., `ServiceEditorView`), because Vue Router always prefers the static route.
**Why it happens:** Route-matching specificity (static > dynamic) is invisible at write time — nothing fails until a real visitor hits the URL.
**How to avoid:** Enforce the reserved-word check client-side, before ever attempting to claim a slug (Pattern 3) — never rely on the router to catch this at request time.
**Warning signs:** None visible until a support ticket about a broken/wrong share link arrives — treat this as a hard pre-condition, not a nice-to-have validation.

### Pitfall 2: `finalizeAndShare`'s existing "always mint a new token" behavior does NOT match the memorable-URL's intended "always latest" behavior
**What goes wrong:** The existing `finalizeAndShare` (verified, `quarters.ts` lines 324-359) generates a brand-new random token and a brand-new `shareTokens/{token}` doc on *every* call — old tokens/docs are never cleaned up or updated, so re-finalizing a quarter leaves stale frozen copies at old opaque URLs while `quarter.shareToken` points at the newest one.
**Why it happens:** This is deliberate/accepted existing behavior for the opaque-token route (never revoked, matches its accepted "guessable but stable" tradeoff).
**How to avoid:** The new `quarterShares/{slug}__q{N}-{year}` doc must be **overwritten in place** (same doc ID every time, via `setDoc`) on every `finalizeAndShare` call for that quarter — NOT accumulated like `shareTokens`. This gives the memorable URL "always shows the latest finalized version" semantics, which is arguably the more correct behavior for a memorable, repeatedly-shared link, and should be a deliberate design choice documented in the plan, not an accident of copy-pasting the token logic.
**Warning signs:** A volunteer bookmarks the memorable URL, the organizer re-generates the schedule, and the volunteer sees stale data — verify the overwrite-in-place behavior with a test that calls `finalizeAndShare` twice and asserts the `quarterShares` doc reflects the second call's snapshot.

### Pitfall 3: `scheduler.test.ts`'s existing factories will break under the D-04/D-05 relocation
**What goes wrong:** `makePerson()` currently accepts `frequencyTargetN`/`roleFrequencies` and `makePQD()` currently accepts `frequencyTier`/`roleTiers` (verified, `scheduler.test.ts` lines 6-32) — nearly every one of the ~20 existing test cases constructs data this way. A naive "just add new R-12 tests" approach will leave the bulk of the suite exercising a data shape that no longer exists on `Person`.
**Why it happens:** The relocation is a breaking change to the test fixtures' shape, not just the production code's shape.
**How to avoid:** Treat the factory + existing-test rewrite as a dedicated, sized task in the plan (likely its own wave/task), separate from the "add new R-12 containment tests" task — don't scope it as a drive-by edit.
**Warning signs:** `npm run test:unit` failing broadly (not just new tests) immediately after the type change lands, if the factory rewrite isn't sequenced first.

### Pitfall 4: R-12's containment guarantee (D-01) is not airtight against the main loop's *independent* candidate selection
**What goes wrong:** The recommended `propagatePairing` gate (Pattern 2) only controls pull-ins *via propagation*. If the lower-cadence partner (e.g. Nolan) also holds a role that the higher-cadence partner (Tim) does NOT hold, the main greedy loop's `eligible()` candidate scoring could independently pick Nolan for that role on a date Tim isn't serving at all — producing a Nolan occurrence with no coinciding Tim occurrence, which would violate D-01's containment guarantee in the strictest reading.
**Why it happens:** `propagatePairing` and the main `eligible()` loop are two separate selection paths (this dual-path structure is exactly why Phase 15's group-compatibility fix needed the shared `isGroupCompatible` helper, per the code comments at `scheduler.ts` lines 42-45 and 167-169) — the new cadence gate only patches one of the two paths.
**How to avoid:** This is flagged as an Open Question below rather than resolved outright, because a fully general fix (barring the main loop from picking a person who has active pairings unless their partner search first) is a larger, riskier change than the SPEC's acceptance criteria strictly requires. Recommended mitigation: construct the required `scheduler.test.ts` canonical Nolan/Tim test with their role sets overlapping (both eligible for the same shared role, or Nolan's only role also held by Tim) — this matches the real-world shape "must-serve-with" pairing is typically used for (co-vocalists, parent-child on the same instrument) and avoids the edge case for the required acceptance test, while the residual general-case risk is documented for the planner to explicitly accept or address.
**Warning signs:** A generated schedule where the lower-cadence partner appears on a date the higher-cadence partner does not — write an explicit regression test asserting containment across the FULL calendar (not just checking that pairing worked on days Tim served) to catch this.

### Pitfall 5: `Person.frequencyTargetN` is read in more places than just the frequency UI
**What goes wrong:** `RosterView.vue`'s sort-by-frequency column (`minRoleFrequency`, line 566), `AvailabilityRosterTable.vue`'s `freqBadge`, and the scheduler all currently fall back to `person.frequencyTargetN` as a last-resort default. Deleting the field without auditing every read site will produce `undefined`/`NaN` in sort comparators and badge text.
**Why it happens:** `frequencyTargetN` was deliberately kept as a "RETAINED — do NOT delete" fallback in Phase 13/15 comments — those comments predate this phase's D-04 reversal and are now stale guidance.
**How to avoid:** Grep for `frequencyTargetN` and `roleFrequencies` across the whole `src/` tree as a checklist before removing the fields from `types/roster.ts` — don't rely on TypeScript alone to catch every site (some reads are inside template expressions/computed properties that may not immediately fail type-checking if a field is left `undefined`-typed rather than fully removed).

## Code Examples

### New-quarter seeding (D-06)
```typescript
// src/stores/quarters.ts — createQuarter, extended
function quarterKey(year: number, quarterNum: number): number {
  return year * 4 + quarterNum
}

function findPriorQuarter(quarters: Quarter[], year: number, quarterNum: number): Quarter | undefined {
  const target = quarterKey(year, quarterNum)
  return quarters
    .filter((q) => quarterKey(q.year, q.quarter) < target)
    .sort((a, b) => quarterKey(b.year, b.quarter) - quarterKey(a.year, a.quarter))[0]
}

async function createQuarter(year: number, quarter: 1 | 2 | 3 | 4, label: string): Promise<string> {
  if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
  const rosterStore = useRosterStore()
  const prior = findPriorQuarter(quarters.value, year, quarter)

  const personQuarterData: Record<string, PersonQuarterData> = {}
  for (const person of rosterStore.people) {
    const priorPQD = prior?.personQuarterData[person.id]
    const roleFrequency: Record<string, RoleFrequencyEntry> = {}
    for (const roleId of person.roles) {
      roleFrequency[roleId] = priorPQD?.roleFrequency?.[roleId] ?? { tier: 'regular', n: 4 }
    }
    personQuarterData[person.id] = {
      personId: person.id,
      blackoutDates: [], // D-06: never carried forward, always resets
      pairedWith: priorPQD?.pairedWith ?? [], // D-06: seeded from previous quarter when present
      roleFrequency,
    }
  }

  const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'quarters'), {
    label, year, quarter,
    serviceDates: generateSundaysInQuarter(year, quarter),
    roleOverridesByDate: {},
    personQuarterData,
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}
```

### URL query persistence (D-16) — reuses existing project convention
```typescript
// Verified existing pattern, src/views/SongsView.vue lines 291-296:
if (route.query.import === 'true') {
  importModalOpen.value = true
  router.replace({ query: { ...route.query, import: undefined } })
}
// Apply the same shape for QuarterShareView.vue's view+name:
watch([viewMode, nameFilter], ([view, name]) => {
  router.replace({ query: { ...route.query, view, name: name || undefined } })
})
```

## State of the Art

| Old Approach | Current/New Approach | When Changed | Impact |
|--------------|------------------------|---------------|--------|
| Serve frequency: standing `Person.roleFrequencies`/`frequencyTargetN` + quarter-scoped `PersonQuarterData.roleTiers`/`frequencyTier` (two parallel structures, Phase 13/15) | Single quarter-scoped `PersonQuarterData.roleFrequency: Record<roleId, {tier, n}>` | This phase (D-04/D-05) | Removes the "confusing dual frequency" UX problem the user explicitly flagged; touches ~7 files |
| Share page: list view only, opaque token URL only | Matrix (default) + list toggle; opaque token URL + memorable `/{slug}/quarter{N}-{YYYY}` URL | This phase (R-01/R-02) | New public Firestore collections (`orgSlugs`, `quarterShares`); no auth/roster access added (D-24 preserved) |
| `QuarterGrid` group editor: expand-underneath row | Right-side slide-out (Teleport-to-body, reusing `AvailabilityDrawer` pattern) | This phase (R-14) | Consistent editor pattern across the two right-slide-out surfaces (drawer + grid editor) |
| Schedule page: quarter `<select>` + year/quarter inputs + "New quarter" button, all conflated in one card | Quarter switcher (select existing) visually separate from "+ Add quarter" (modal/inline form) | This phase (R-10/D-13) | Direct UX fix for the conflated select-vs-create flow |
| `AvailabilityDrawer`: date-range picker + per-Sunday toggle | Per-Sunday toggle only | This phase (R-08) | Removes ~25 lines (`rangeStart`/`rangeEnd`/`applyRange`) — ≈13 Sundays/quarter makes range entry genuinely unnecessary |

**Deprecated/outdated:**
- `Person.roleFrequencies`/`Person.frequencyTargetN`: superseded by `PersonQuarterData.roleFrequency` — do not read/write these fields in any new code; leave existing Firestore data as harmless orphans (no migration).
- `PersonQuarterData.roleTiers`/`frequencyTier`: superseded by the same new field — same treatment.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `quarterShares`/`orgSlugs` security rules should mirror `shareTokens`' existing `isSignedIn()`-only posture (not `isOrgEditor`) | Pattern 3 | If the intended security posture is actually stricter (`isOrgEditor(orgId)`), the rules need an extra `orgId` field + check — low risk (rules are cheap to tighten later), but should be confirmed with the user/planner since it's security-adjacent |
| A2 | Default `{ tier: 'regular', n: 4 }` is the correct absent-entry default for `roleFrequency` | Pattern 1 | If a different default is intended (e.g., `fillin`), badges/scheduler behavior for people with no PQD entry would differ from D-06's stated "once/month (N=4)" default — low risk, directly stated in D-06 |
| A3 | Comma-separated names is the right rendering for multi-person matrix cells | Pattern 4 | Purely cosmetic — trivial to change post-implementation, explicitly marked "Claude's discretion" in CONTEXT.md |
| A4 | Card-stack evolution (not calendar-centric redesign) is the correct R-09 direction | Pattern 5 | This is the single highest-stakes recommendation in this document — if wrong, a significant chunk of R-09/R-10/R-11 work would need redoing; mitigated by the explicit code-evidence reasoning given (QuarterGrid already IS the matrix; R-11's existence implies "declutter the stack," not "replace it") |
| A5 | `ceil(serviceDates.length / n)` is the correct whole-quarter cadence budget formula for the R-12 gate | Pattern 2 | If a different budget calculation is intended (e.g., accounting for the partner's own blackout-reduced servable dates, mirroring `AvailabilityDrawer`'s `freqReadout` computed property), the exact "~once/month" count in the canonical test could differ by ±1 — low functional risk since the SPEC only requires "~once/month," not an exact number |
| A6 | R-13 (whole-cell click target) may already be satisfied by existing `QuarterGrid.vue` markup | Pattern 5 | If the planner scopes R-13 as new implementation work when it's actually already met, that's wasted effort, not a defect — recommend a verification task first |

**Vue Router 5 route-ranking claim (Pitfall 1 / Pattern 3) is CITED, not ASSUMED** — sourced from the official router.vuejs.org route-matching-syntax documentation via WebFetch, cross-referenced with a WebSearch confirming v5 introduced no matcher-ranking breaking changes from v4.

## Open Questions

1. **Does R-12's containment guarantee (D-01) need to hold against the main loop's independent candidate selection, or only against propagation?**
   - What we know: The SPEC's acceptance text says "every Nolan occurrence coincides with a Tim occurrence," which reads as an absolute guarantee; CONTEXT.md's Claude's-Discretion note explicitly defers the exact mechanism as long as `scheduler.test.ts` passes.
   - What's unclear: Whether a fully general fix (constraining the main `eligible()` loop too) is in scope, or whether the recommended propagation-only gate (Pattern 2) — which handles the realistic pairing shape (overlapping role sets) — is sufficient.
   - Recommendation: Ship the propagation-only gate (lower risk, smaller diff) and construct the required canonical test with overlapping role sets (see Pitfall 4). Flag the general-case edge case explicitly in the plan's task description so it's a conscious scope decision, not a silent gap.

2. **Should `orgSlugs`/`quarterShares` security rules be `isOrgEditor`-scoped instead of `isSignedIn()`-only?**
   - What we know: `shareTokens` (the existing, closest precedent) uses `isSignedIn()`-only.
   - What's unclear: Whether that existing posture was a deliberate choice or an oversight — the planner/user should confirm before extending the same pattern to two new collections.
   - Recommendation: Match existing convention (A1) unless the user explicitly wants tighter rules; note the mismatch risk is low since Firestore reads required to fabricate a fake snapshot are already gated elsewhere.

3. **Does `createQuarter`'s D-06 seeding include inactive people, or `activePeople` only?**
   - What we know: `rosterStore.people` includes both active and inactive; `activePeople` filters to `active === true`.
   - What's unclear: CONTEXT.md doesn't specify. Reactivating someone mid-quarter with no seeded frequency would fall back to the N=4 default anyway (harmless), so this is low-stakes either way.
   - Recommendation: Seed for `rosterStore.people` (all, including inactive) for simplicity/consistency with `applyCsvToQuarter`'s existing "absent-people-untouched" philosophy — inactive people are already excluded from scheduling by the `p.active` check in `eligible()`, so an unused seeded entry is harmless.

## Environment Availability

Not applicable — this phase requires no new external tools, services, or runtimes beyond what's already configured (Firebase project, existing npm toolchain). No probing was needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vite.config.ts` (`test` block, line 36+); excludes `src/rules.test.ts` from the default run |
| Quick run command | `npx vitest run src/utils/__tests__/scheduler.test.ts` (or any specific file) |
| Full suite command | `npm run test:unit` |
| Firestore rules tests | `npm run test:rules` (spins up `firebase emulators:exec`, runs `src/rules.test.ts` via `vitest.rules.config.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R-12 | Containment: every Nolan date coincides with a Tim date | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ✅ (rewrite required, Pitfall 3) |
| R-12 | Even-spread of paired occurrences | unit | same file | ✅ (new test case) |
| R-12 | Cadence-driven skip is silent (no pairingConflicts entry) | unit | same file | ✅ (new test case) |
| R-12 | Existing hard constraints (blackout, group-compat) still honored | unit | same file | ✅ (existing tests, rewritten factories) |
| R-05 | Per-role frequency read from `PersonQuarterData.roleFrequency` | unit | same file | ✅ (rewrite required) |
| R-13 | Whole-cell click opens editor; remove-pill doesn't | component | `npx vitest run src/components/__tests__/QuarterGrid.test.ts` | ✅ (extend) |
| R-14 | Slide-out opens/closes, replaces expand-underneath | component | same file | ✅ (extend) |
| R-08 | Date-range picker removed, per-Sunday toggle works | component | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts` | ✅ (extend) |
| R-05 | Unified frequency control writes `roleFrequency` | component | same file | ✅ (extend) |
| R-07 (descoped, D-10) | N/A — no cross-screen blackout test needed | — | — | — |
| R-01 | Matrix renders roles×dates; list toggle works | component | `npx vitest run src/views/__tests__/QuarterShareView.test.ts` | ❌ Wave 0 — file doesn't exist yet |
| R-03 | Name filter hides non-matching dates, both views | component | same file | ❌ Wave 0 |
| R-02 | Memorable route resolves; reserved-slug guard rejects | unit + router | `npx vitest run src/router/__tests__/router.test.ts` | ✅ (extend) |
| R-02 | Slug uniqueness (create-only claim semantics) | rules | `npm run test:rules` | ✅ (extend `src/rules.test.ts`) |
| R-09/R-10/R-11 | Layout redesign, collapsible sections, add-quarter flow | manual/visual | — | Manual-only — acceptance criteria is "verifiable diff between before/after layout" (human/PR-review check); collapsible open/close state IS unit-testable (component test for `CollapsibleSection.vue`) |

### Sampling Rate
- **Per task commit:** run the specific test file(s) touched (e.g. `npx vitest run src/utils/__tests__/scheduler.test.ts` after any `propagatePairing` change)
- **Per wave merge:** `npm run test:unit` (full suite)
- **Phase gate:** Full suite green + `npm run test:rules` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/views/__tests__/QuarterShareView.test.ts` — covers R-01, R-03 (matrix rendering, list toggle, name filter, URL persistence). No file exists yet; mirror `ShareView.test.ts`'s existing setup pattern (mocked `getDoc`).
- [ ] `src/components/__tests__/CollapsibleSection.test.ts` — covers R-11 (default-expanded, localStorage persistence, toggle behavior) for the new shared component.
- [ ] `src/utils/__tests__/slug.test.ts` — covers `deriveSlug()` and reserved-word filtering (pure function, no Firestore needed).
- [ ] Extend `src/rules.test.ts` — new `describe` blocks for `orgSlugs` (create-once semantics) and `quarterShares` (public read, signed-in write) collections.

## Security Domain

> `security_enforcement` not set in `.planning/config.json` — treated as enabled per default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged) | Existing Firebase Auth flow, untouched by this phase |
| V3 Session Management | No (unchanged) | N/A |
| V4 Access Control | Yes | New `orgSlugs`/`quarterShares` collections must not leak org-scoped PII beyond what `shareTokens` already exposes (names only, D-24) — verified: neither new collection stores email/phone, only names via the snapshot's existing shape |
| V5 Input Validation | Yes | Slug derivation must strip to `[a-z0-9-]+` (regex in `deriveSlug`) before use as a Firestore document ID component — Firestore doc IDs disallow `/` and some control characters; the existing sanitization regex already excludes anything but lowercase alphanumerics and hyphens, which is safe |
| V6 Cryptography | No (unchanged) | Existing `crypto.getRandomValues`-based token generation for `shareTokens` is untouched; the new memorable URL is deliberately guessable (accepted privacy tradeoff per SPEC constraints, not a crypto concern) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Slug/quarter enumeration (guessing `/{slug}/quarter1-2026` for orgs you're not a member of) | Information Disclosure | Explicitly accepted tradeoff per SPEC constraints ("the memorable URL is intentionally guessable... this privacy tradeoff is accepted") — no mitigation needed, already a locked decision |
| Firestore doc-ID injection via unsanitized org name (e.g. a name containing `/` or `..`) producing a malformed `quarterShares` doc path | Tampering | `deriveSlug`'s regex strips to `[a-z0-9-]+` before any Firestore path construction — verify this sanitization happens client-side before the string ever reaches a `doc()` call, not just for display |
| Slug-squatting a reserved word to hijack app navigation | Spoofing | Client-side reserved-word rejection at claim time (Pattern 3) — this is a UX/routing-integrity concern, not a data-security one, but included here since it was explicitly called out as a threat in D-19 |

## Sources

### Primary (HIGH confidence)
- Direct reads of `src/utils/scheduler.ts`, `src/utils/__tests__/scheduler.test.ts`, `src/types/roster.ts`, `src/stores/quarters.ts`, `src/stores/roster.ts`, `src/views/QuarterView.vue`, `src/views/QuarterShareView.vue`, `src/views/RosterView.vue`, `src/views/SettingsView.vue`, `src/router/index.ts`, `src/components/AvailabilityDrawer.vue`, `src/components/AvailabilityRosterTable.vue`, `src/components/QuarterGrid.vue`, `src/components/ArrangementAccordion.vue`, `src/stores/auth.ts`, `firestore.rules`, `firebase.json`, `functions/src/index.ts`, `src/utils/quarterDates.ts`, `src/utils/volunteerCsv.ts`, `src/rules.test.ts`, `src/router/__tests__/router.test.ts`, `src/components/__tests__/QuarterGrid.test.ts`, `package.json`, `vite.config.ts` — all read in full during this research session.
- [Vue Router route-matching syntax](https://router.vuejs.org/guide/essentials/route-matching-syntax.html) — custom regex params, multi-param segments, static-vs-dynamic ranking, order-independence.
- `npm view vue-router version` — confirmed 5.1.0 latest vs. 5.0.3 installed [VERIFIED: npm registry].

### Secondary (MEDIUM confidence)
- WebSearch "vue-router 5 release matcher route ranking" — confirmed v5 is a no-breaking-changes transition release from v4 for projects not using file-based routing, corroborating the matcher-ranking claim above with a second source.

### Tertiary (LOW confidence)
- None — all findings above were either directly verified against the codebase or cross-referenced against official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions read directly from `package.json`/npm registry
- Architecture (frequency model, matrix orientation, routing): HIGH — grounded in direct full-file reads of every affected file
- Architecture (R-09 layout direction): MEDIUM — a genuine design recommendation (not a verifiable fact), though grounded in strong code evidence (flagged A4)
- Scheduler fix (R-12): MEDIUM — the core mechanism is well-founded and low-risk, but a residual containment edge case is honestly flagged rather than papered over (Pitfall 4, Open Question 1)
- Pitfalls: HIGH — all pitfalls identified from direct code reads (existing test factory shapes, existing `finalizeAndShare` token-minting behavior, existing field fallback chains)

**Research date:** 2026-07-09
**Valid until:** 30 days (stable internal codebase, no fast-moving external dependencies)
