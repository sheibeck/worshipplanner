# Requirements: WorshipBuilder — v2.17 Spec-Driven Foundation & Rehearsal Defaults

**Defined:** 2026-11-06
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating
through the full song stable and respecting team configurations.
**Milestone goal:** Make specifications the project's source of truth, then prove the process on a real feature.

> **Numbering:** continues the project's global `R###` scheme from v2.16 (which ended at R453).
>
> **Scope decisions (owner, 2026-11-06):**
> - **Development philosophy:** Specification Driven Development is the core philosophy, followed by Test Driven
>   Design. The order is spec, then tests, then code.
> - **Rollout:** v2.17 sets the standard and pilots it on one real feature; v2.18 backfills specs for every
>   existing feature, using the format proven here.
> - **Specs live in `docs/specs/`**, one file per feature, beside `docs/adr/`, so they outlast milestones.
> - **Promotes backlog 999.15** (default rehearsal day and time). 999.14 stays in the backlog.
> - **One default weekday**, not several. When the service falls on that weekday, the rehearsal is the same day.
> - **Auto-add, not pre-fill only:** new services start with the rehearsal on them. This reverses parts of ADR-0245 (a) and (b).
> - **Deploy guard dropped:** the legacy redirect is already live, so a stray deploy republishes the same redirect
>   and the owner is the sole user. This closes the v2.16 audit tech-debt item as won't-fix.
> - No milestone-level research pass (per-phase research still runs). Prod deploys are per-deploy owner-confirmed.
>
> **Known facts going in (verified 2026-11-06):** `createService` in `src/stores/services.ts` is the single creation
> path and writes `rehearsals: []`; a service's date stays editable afterward via `onDateChange` in
> `src/views/ServiceEditorView.vue`; Firestore rules do not validate rehearsal fields; `workflow.tdd_mode` is
> `false`; `/gsd-spec-phase` writes a per-phase SPEC.md that is archived with the phase, so it is not a living
> feature spec.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Spec Standard

- [ ] **R454**: `docs/specs/TEMPLATE.md` defines a feature spec with these sections: purpose, behavior, numbered
  acceptance criteria, edge cases, out of scope, and links to tests and ADRs.

- [ ] **R455**: `CLAUDE.md` and `.planning/PROJECT.md` record the rule: no feature work starts until its spec exists,
  and a behavior change updates the spec before the tests and code.

- [x] **R456**: Each acceptance criterion has a stable ID, and tests cite those IDs.
- [x] **R457**: An automated check fails when a spec's acceptance criterion has no test citing its ID.
- [ ] **R458**: `workflow.tdd_mode` is on. Stores, utilities, functions and security rules need a failing test first;
  UI layout tests may land with the code but must cite spec criteria.

### Default Rehearsal Day and Time (promotes backlog 999.15)

The feature's spec lands in `docs/specs/` before any of its tests or code.

- [ ] **R459**: An admin can set one default rehearsal weekday, or none, in Settings.
- [ ] **R460**: With a default weekday and at least one default time set, a new service gets one rehearsal on the most
  recent default weekday on or before the service date (the service date itself when it falls on that weekday), at
  the first default time.

- [ ] **R461**: Unless both a default weekday and a default time are set, a new service gets no rehearsal.
- [ ] **R462**: Changing a service's date moves an auto-added rehearsal nobody has changed, keeping its weekday and
  time. A rehearsal a planner has changed stays where it is.

- [ ] **R463**: Changing the Settings default does not touch existing services, and there is no data migration.
- [ ] **R464**: The add-rehearsal form pre-fills the default date only if the service has no rehearsal on that date;
  otherwise the date stays blank.

- [ ] **R465**: A new ADR supersedes the reversed parts of ADR-0245, and the auto-added marker never appears on share
  links or other read-only views.

## v2 Requirements

Deferred to a later milestone. Tracked here, not in the current roadmap.

- **Spec backfill (v2.18):** a living spec in `docs/specs/` for every existing feature, using the format proven here.
- **Planning Center export uses real rehearsals:** the export ignores a service's rehearsals and always creates a
  hard-coded "Wednesday Rehearsal", 6:30–8:30 PM, on the Wednesday on or before the service.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Several default rehearsal days | Owner chose one weekday; a second rehearsal is picked by hand. |
| Auto-adding rehearsals to existing services | Defaults apply at creation only, matching the report time's copy-not-live-bind rule. |
| Deploy guard for the legacy site | Dropped by the owner; the redirect is already live and the owner is the sole user. |
| Custom domain and verified email | Stays in backlog 999.14 until the owner has a domain. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R454 | Phase 146 | Pending |
| R455 | Phase 146 | Pending |
| R456 | Phase 146 | Complete |
| R457 | Phase 146 | Complete |
| R458 | Phase 146 | Pending |
| R459 | Phase 147 | Pending |
| R460 | Phase 147 | Pending |
| R461 | Phase 147 | Pending |
| R462 | Phase 147 | Pending |
| R463 | Phase 147 | Pending |
| R464 | Phase 147 | Pending |
| R465 | Phase 147 | Pending |

**Coverage:**

- v1 requirements: 12 total (R454–R465)
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-11-06*
