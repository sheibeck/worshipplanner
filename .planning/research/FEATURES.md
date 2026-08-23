# Feature Research

**Domain:** Multi-tenant SaaS admin configurability + hardening (church worship-planning vertical)
**Researched:** 2026-08-23
**Confidence:** HIGH (patterns cross-checked against this codebase's own `RolesConfigPanel.vue`/`roster.ts`
precedent, `PENDING-VERIFICATION.md` C4/C5, and `firestore.rules`; general UX/security patterns are
well-established industry practice, not speculative)

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-org editable list (Team list, generalized) | The app already has this exact pattern for roster Roles (`RolesConfigPanel.vue` + `roster.ts`) — seeded defaults, then org-admin add/edit/delete. A second org-scoped list (Teams) that *isn't* editable this way would be an inconsistent, surprising exception. | LOW–MEDIUM | Reuse the established shape: `Team { id, name, order }` doc collection or `OrgSettings.teams: Team[]` array (roster uses a subcollection; a short list like Teams fits equally well as an array field — pick whichever keeps a single source of truth, see Dependencies). Seed `DEFAULT_ROLES`-equivalent (`['Choir','Orchestra','Communion','Special']`) on org creation, exactly like roles are seeded today. |
| Per-row explicit Save, not autosave, on the list editor | This is the established in-app convention (`onSaveRole` per row with local `draft` state, "Saving…" → "Saved ✓" transient feedback) — matches how Roles already works. Autosave-per-keystroke on a shared org-wide list (visible to every editor) risks half-typed names persisting and no undo. | LOW | Mirror `roleDrafts` local-copy-until-save pattern exactly; don't invent a new autosave paradigm for one more list. |
| Add-row affordance at the bottom of the list, not a separate dialog | Established precedent (`RolesConfigPanel.vue`'s "Add Role" section: name input + optional metadata + Save). A modal-based "New Team" flow would be a second, inconsistent add pattern in the same Settings surface. | LOW | Same inline row, not a new component pattern. |
| Delete confirmation inline (not a modal) + explicit consequence text | Roles precedent shows `confirmDeleteId` toggling an inline red-bordered warning box naming the concrete consequence ("Existing assignments to this role... will be cleared"). Deleting a Team in use by past services needs the equivalent warning (e.g., "services already using this team keep their historical assignment; new services can no longer pick it" or a hard block if in-use — pick one, see Anti-Features). | LOW–MEDIUM | The consequence text must be accurate for Teams' specific referential shape (services reference teams by name/id) — don't copy-paste the Roles wording verbatim. |
| Per-team song-tag filter as a per-row setting on the same editor | Table stakes once Team lists are configurable at all: an org that renames "Orchestra" to "Strings" needs the tag-filter rule to follow the renamed team, not silently break. Users expect a filter rule to be "just another field" on the team row they're already editing, not a separate screen. | MEDIUM | Store as an optional field on the Team record itself (`songTagFilter?: string`, nullable = no filter), so add/edit/delete of the team and its filter are one atomic save, matching the "one control, one field" precedent already stated in `roster.ts` comments (D-04/D-05 style). |
| Revoked share link returns a clear "this link is no longer available" state, not a blank page or stack trace | Users who click a stale link (bulletin, group chat, printed program) after a service is deleted need to know it's *intentionally* gone, not broken. Any public-facing link surface has this expectation once resources become deletable. | LOW | `ShareView.vue`/`QuarterShareView.vue` already handle "not found" cases for malformed tokens (per `41-*` phase artifacts) — extend the same not-found path to also fire when the underlying service is gone, rather than adding a new UI state. |
| Deleting a resource cleans up its dependent public artifacts | An org admin who deletes a service reasonably assumes everything derived from it (the share link) is gone too — this is the same expectation `deleteQuarter` already satisfies (per C5), so `deleteService` not doing the same is an inconsistency inside this codebase, not just an abstract "nice to have." | LOW | Direct port of the existing `deleteQuarter` cleanup helper's shape onto `deleteService`; `allow delete` rules already permit it (per `PENDING-VERIFICATION.md` C5) — no `firestore.rules` change needed. |
| Warn before an action that will silently discard in-progress work | Standard "unsaved changes" pattern, applied here to a narrower and more dangerous case: customizing a slide that is mid-async-render. Users assume "editing something" and "having it disappear later for a reason invisible in the UI" cannot both be true. | LOW–MEDIUM | `EditSlideDrawer.vue` needs `renderState` awareness (per backlog 999.9 / C4) — a visible badge/banner ("Render in progress — your edits here will be lost when it completes") plus (optionally) disabling the customization inputs until `ready`. Disabling is the more defensible default per Anti-Features below. |
| Real form labels (`<label for>`/`aria-label`) on every admin input | WCAG 2.1 SC 1.3.1 / 4.1.2 baseline — a placeholder is not a label (it disappears on input, isn't announced consistently by screen readers, and fails automated a11y audits). This is flagged as existing debt in this exact codebase (999.7, Phase 72/74 UI reviews scored 22–24/24, docked specifically for placeholder-only inputs). | LOW | Mechanical pass: every `<input>`/`<select>` in `OwnerConsoleView.vue`'s super-admin grant form and Organizations onboard/assign forms gets a paired `<label>` or `aria-label`. `RolesConfigPanel.vue` has the *same* gap (role-name edit input has no label at all, only the Add-Team input has a placeholder) — worth fixing in the same pass since it's the precedent other lists will copy. |
| ARIA tab semantics on tab strips (`role="tablist"`, `role="tab"`, `aria-selected`, roving `tabindex`) | Screen reader users need to know a strip of buttons is a tabset, which tab is selected, and how many there are — plain `<button>`s with only visual active-state styling (confirmed in `OwnerConsoleView.vue`, which explicitly mirrors `ServiceEditorView.vue`'s pattern) announce as an unordered list of buttons, not a tabbed interface. | LOW–MEDIUM | Add `role="tablist"` to the wrapper, `role="tab"` + `aria-selected` + `aria-controls`/matching panel `id`/`role="tabpanel"` to each button/panel pair, and arrow-key navigation between tabs (left/right moves focus + optionally activates, per the ARIA APG Tabs pattern). Two tab strips share this debt (`OwnerConsoleView` Configuration/Organizations, `ServiceEditorView`) — fix once, apply to both (999.7 already frames it as "one cross-surface pass"). |
| Keyboard operability of the whole admin console | Every interactive control (list edit/delete/save, tab switch, form submit) reachable and operable via Tab/Shift+Tab/Enter/Space with a visible focus ring — this is the bar an automated a11y audit (axe/Lighthouse) checks first and the bar screen-reader/keyboard-only users need to accomplish anything. | LOW | Mostly falls out of using real `<button>`/`<input>`/`<label>` elements (already true here) plus the ARIA tab roving-tabindex fix above; verify no custom click-only `<div>` handlers exist in the affected forms. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-team song-tag filter generalized beyond one hard-coded rule | Most worship-planning tools either hard-code "team → song subset" for their original customer or don't support it at all; making it a first-class per-team setting is what actually lets a second, third, and Nth church configure their own team/song-pool rules without a code change — this is the direct payoff of SEED-002's stated goal ("fit churches other than Berean"). | MEDIUM | This is the differentiator the milestone is *for* — don't under-invest here relative to the mechanical a11y/list-editor work. |
| Optimistic-but-safe pending-render guard (disable + explain, not just warn) | Many apps that render something async (PPTX→image, video transcode) either block editing entirely during render (safe but annoying) or allow silent data loss (dangerous). A guard that clearly *shows the state* and offers "wait" or "proceed anyway, edits will not survive" is a better UX than either extreme and signals maturity in handling async state to churches evaluating the product against Planning Center/ProPresenter workflows. | MEDIUM | Requires wiring `renderState` (already present per `pptxRender.ts`/`SlideCard.vue`) through to `EditSlideDrawer.vue`'s open-drawer logic — a read, not new render-state plumbing. |
| Live "who else is affected" preview when deleting a team-in-use | Beyond a static warning, listing which upcoming/past services reference the team being deleted (count or names) gives an org admin real information to decide, rather than a generic scare message — this is a step up from the current Roles-delete pattern (`"Existing assignments... will be cleared"` with no count). | MEDIUM–HIGH | Optional stretch; requires a query across services/quarters for team references before rendering the confirm box. Only worth it if delete-of-an-in-use-team is common; if teams are rarely deleted once created, the plain warning (table stakes) is sufficient and this becomes over-engineering — evaluate against real usage, not speculatively. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Making the ordinal-Sunday auto-team-preselection rule configurable (instead of dropping it) | Feels safer to "just add a setting" than delete working code — preserves current Berean behavior for free. | This is precisely the case SEED-002 calls out as B1: the rule encodes one church's liturgical calendar (1st Sunday → Orchestra+Communion, 3rd Sunday → Choir). Making *that specific shape* configurable (which ordinal maps to which team combination, recurring monthly) is a disproportionately complex feature (a mini recurrence-rule editor) to save two clicks a month for exactly one church, and every other church gets a config screen for a rule that means nothing to them. | Drop the automation entirely (B1, "clearest cut" per the seed). Once Teams are user-selectable per service (this milestone's A1), any org — Berean included — picks teams manually in two clicks. If Berean specifically wants the convenience back later, it's a candidate for a per-org "service defaults" feature, evaluated on its own merits with real multi-church demand, not smuggled in now. |
| A fully generic "rule builder" for per-team filters (arbitrary boolean tag expressions, AND/OR/NOT) | Once one per-team filter field exists, it's tempting to make it maximally flexible so it "never needs to be extended again." | Over-configuration risk explicitly named in SEED-002: some rules are better dropped or kept simple than made maximally configurable. A single-tag filter ("this team → songs tagged X") covers the actual observed need (Orchestra→Orchestra-tagged); a boolean expression builder is speculative complexity with a steep UI cost (needs its own mini-editor, docs, and QA) for a need that hasn't been demonstrated by a second real church yet. | Ship the single-tag-per-team filter now (A2). If a second church's actual need turns out to require boolean combinations, that's new evidence for a future, narrower expansion — not a reason to build the general case speculatively today. |
| Configurable VW_TYPE_LABELS / making the "1-2-3" Vertical Worship taxonomy itself editable per org | Superficially consistent with "make everything per-org" — if teams and filters are configurable, why not the category labels too? | SEED-002 explicitly scopes this out (C1): VW mode is already gated by `vwModeEnabled` for churches that don't use it, and the default order-of-worship is already overridable via `defaultServiceTemplate`. Making the *labels* themselves org-editable invites non-VW churches to invent ad hoc taxonomies, which fragments the AI-suggestion and rotation logic that assumes exactly three categories. The only real defect here is duplication (`VW_TYPE_LABELS` copy-pasted in 6+ files), which is a de-dup task, not a configurability task. | Collapse `VW_TYPE_LABELS` to its single source in `song.ts` (mechanical cleanup). Leave the taxonomy itself fixed; it's a platform concept, not a per-org one. |
| Auto-detecting/negotiating a "grace window" for revoked share links (e.g., keep working for N minutes/hours after the service is deleted "in case someone still has it open") | Feels more forgiving than an immediate hard revoke — avoids someone mid-viewing suddenly losing access. | Adds real complexity (a TTL/soft-delete state machine, a background sweep, a race between "service gone" and "link still valid") to solve a vanishingly rare edge case, and it directly contradicts the security intent of revocation: a link to a deleted service is exactly the kind of stale-credential surface that should NOT have a grace period, since the org admin who deleted the service presumably wanted it gone (this mirrors the same deny-immediately posture already used for org deactivation/deletion in v2.1). | Revoke immediately, synchronously, in the same `deleteService` transaction/batch that deletes the service — matching how `deleteQuarter` already behaves (no grace period there either). |
| A generic "disable inputs while any async job is pending anywhere in the app" framework | Tempting to solve the pending-render guard as a reusable global primitive once you notice the pattern. | Speculative generalization for a problem observed in exactly one place (deck slide render). Building a general async-job-guard abstraction now, before a second concrete case exists, is scope creep relative to the actual backlog item (999.9), and risks under-fitting the one real case while adding surface area to review/test. | Implement the guard narrowly in `EditSlideDrawer.vue` against the concrete `renderState` field that already exists (`pptxRender.ts`). Generalize later only if a second genuinely similar case appears. |

## Feature Dependencies

```
[Per-org Team list (A1)]
    └──requires──> [OrgSettings / roster-roles precedent pattern already exists] (satisfied — reuse, don't invent)
    └──enables────> [Per-team song-tag filter (A2)]
                        └──requires──> [Song tag data model already exists] (satisfied — songs already carry tags)
    └──enables────> [Drop ordinal-Sunday auto-preselect (B1)]
                        (B1 is safe to drop only once A1 ships — users need SOME way to pick teams manually,
                        which they already have via the existing team-checkbox UI; A1 just makes the checkbox
                        list org-editable instead of hard-coded)

[Collapse duplicated team-list literals]
    └──blocks (prerequisite for)──> [A1, A2, B1 all cleanly]
    (2 copies of the team list, 2 copies of the Orchestra filter, 2 copies of the ordinal rule — per SEED-002's
    "cross-cutting issue" — must be de-duplicated to one source BEFORE any of them becomes org-driven, or the
    config will drift from the still-hard-coded copy)

[Share-link revocation on deleteService]
    └──mirrors──> [existing deleteQuarter revocation behavior] (pattern to copy, not invent)
    └──requires──> [firestore.rules `allow delete` already permits this] (satisfied, per PENDING-VERIFICATION C5 —
                    no rules change needed)

[Pending-render edit guard]
    └──requires──> [renderState field already exists on slide/render types] (satisfied — pptxRender.ts, slide.ts)
    └──enhances──> [EditSlideDrawer.vue] (adds awareness, doesn't restructure it)

[Owner Console a11y retrofit]
    └──independent of──> [all other v2.2 features] (no functional dependency; can land in any order)
    └──shares a fix with──> [ServiceEditorView.vue tab strip] (same ARIA-tablist pattern, same PR is efficient
                    but not required)
    └──should reuse pattern from──> [RolesConfigPanel.vue label gap] (same defect exists there; worth folding
                    into the same pass since Teams (A1) will copy this component's shape)
```

### Dependency Notes

- **A2 requires A1:** a per-team filter field only makes sense once teams are org-defined rows with an id/name
  to attach the field to; building A2 against the still-hard-coded team list would just move the hard-coding
  into a filter value.
- **B1 requires A1:** dropping the ordinal auto-preselect is only a safe UX change once manual team selection
  is the org's own editable list — otherwise the org loses convenience with nothing (no more flexible)
  replacing it.
- **De-dup blocks A1/A2/B1:** per SEED-002's explicit "cross-cutting issue," collapsing the 2x/2x/2x duplicated
  literals is a precondition, not a nice-to-have — implementing config against one copy while the other copy
  stays hard-coded reintroduces exactly the drift this milestone exists to fix.
- **Share-link revocation mirrors deleteQuarter:** this is a "copy an existing, already-reviewed pattern"
  task, not new design — treat it as LOW complexity specifically because the twin implementation and its rules
  already passed review once.
- **Pending-render guard enhances, not replaces:** `EditSlideDrawer.vue`'s existing customization UI stays;
  this only adds a state-aware guard rail, keeping the change small and low-risk relative to the drawer's
  existing (already-shipped, tested) behavior.
- **A11y retrofit is dependency-free:** it can be scheduled in parallel with or independently of the
  configurability/hardening work — useful for phase-ordering flexibility, and doing it once for both the Owner
  Console tab strip and the new Teams editor (built on the Roles-editor pattern, which has the same label gap)
  avoids fixing the same defect twice.

## MVP Definition

### Launch With (v1 of this milestone)

- [ ] Per-org Team list, editable like Roles (add/edit/delete, seeded defaults) — this is the owner-named
  core ask and unblocks everything else in this slice
- [ ] Single-source team list (collapse the `ServiceEditorView.vue`/`NewServiceDialog.vue` duplication) —
  required precondition, not optional polish
- [ ] Per-team song-tag filter (generalized Orchestra rule) as an optional field on the Team row — the
  second owner-named ask, and the actual differentiator of this milestone
- [ ] Drop the ordinal-Sunday auto-team-preselect rule — a deletion, essentially free once A1 ships
- [ ] `deleteService` revokes `shareTokens`/`serviceShares`/`serviceShareLinks` — closes a real, already-
  understood security/hygiene gap with a known-good pattern to copy
- [ ] `EditSlideDrawer.vue` gains `renderState` awareness (warn, and prefer disable, on a pending slide) —
  closes a known data-loss gap
- [ ] Real `<label>`/`aria-label` on all Owner Console + new Teams-editor inputs, and `role="tablist"` /
  `aria-selected` on the Configuration/Organizations and Service Editor tab strips — closes named, already-
  scored a11y debt (999.7)

### Add After Validation (v2.2.x)

- [ ] Live "N services reference this team" count in the delete-confirmation warning — upgrade once it's
  clear teams are deleted often enough to need more than a static warning
- [ ] Planning Center team-name auto-fetch (A3) and org-default PC service/rehearsal times (A4) — real,
  scoped-out-of-this-slice follow-ups per SEED-002, lower urgency than A1/A2/B1

### Future Consideration (v3+)

- [ ] Per-org configurable VW category labels — explicitly deferred by SEED-002 (C1); only revisit if a
  non-VW church specifically requests inventing its own worship taxonomy, which hasn't happened
- [ ] A general async-job "pending, don't let the user lose work" framework — only worth generalizing once
  a second concrete case (beyond deck-slide render) actually appears

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Per-org Team list (A1) | HIGH | LOW–MEDIUM | P1 |
| De-dup team-list/filter/ordinal-rule literals | HIGH (prerequisite) | LOW | P1 |
| Per-team song-tag filter (A2) | HIGH | MEDIUM | P1 |
| Drop ordinal-Sunday auto-preselect (B1) | MEDIUM (simplicity + honesty about scope) | LOW (deletion) | P1 |
| `deleteService` share-token revocation | MEDIUM (security hygiene, low daily visibility) | LOW | P1 |
| Pending-render edit guard | MEDIUM (rare but severe when hit — silent data loss) | LOW–MEDIUM | P1 |
| Owner Console + Teams-editor a11y labels/ARIA | MEDIUM (correctness + compliance, not a headline feature) | LOW | P1 |
| Live in-use-count on team delete | LOW–MEDIUM | MEDIUM–HIGH | P3 |
| PC team auto-fetch / org-default times (A3/A4) | MEDIUM (removes retyping friction for future churches) | MEDIUM | P2 (future slice) |
| Configurable VW labels | LOW (no demonstrated demand) | MEDIUM | P3 (do not build without a trigger) |
| Generic async-pending-guard framework | LOW (one instance so far) | HIGH | P3 (do not build speculatively) |

**Priority key:**
- P1: Must have for this milestone (v2.2)
- P2: Should have, next configurability slice (A3/A4, already scoped by SEED-002 as separate/lower-urgency)
- P3: Nice to have or explicitly deferred — build only if real demand emerges

## Competitor Feature Analysis

Not applicable in the usual sense — this research question is about *internal patterns* (an existing
in-app precedent to extend consistently, not a competitive landscape to react to). The relevant "competitors"
are the app's own established conventions:

| Feature | Existing precedent in this codebase | Our approach for Teams (new) |
|---------|--------------------------------------|-------------------------------|
| Editable org-scoped list | `RolesConfigPanel.vue` + `roster.ts` (seed defaults, per-row draft+Save, inline delete-confirm, Add row at bottom) | Copy this shape exactly for Teams; do not invent a second list-editing paradigm in the same Settings surface |
| Cascade-delete-on-resource-delete | `deleteQuarter` already revokes its share artifacts | Port the same cleanup call into `deleteService` |
| Async-state-aware editing guard | None yet (gap is the actual defect, C4) | New, narrow: read `renderState`, don't invent a generic system |
| Accessible tab strip | None yet (`OwnerConsoleView.vue` explicitly copies `ServiceEditorView.vue`'s unlabeled pattern — debt propagated intentionally by a code comment) | Fix once, apply to both tab strips (and note the pattern for any future tab strip) |

## Sources

- `.planning/PROJECT.md` (v2.2 milestone scope, backlog 999.1–999.11, prior decisions)
- `.planning/seeds/SEED-002-church-specific-rules-configurability.md` (full per-rule A/B/C catalog and
  verdicts — primary source for the configurable-vs-drop framing)
- `.planning/PENDING-VERIFICATION.md` C4 (pending-slide data-loss gap) and C5 (`deleteService` share-
  revocation gap) — carried-forward defect detail
- `src/components/RolesConfigPanel.vue`, `src/types/roster.ts`, `src/stores/roster.ts` — in-app precedent
  for org-admin-editable lists (read directly, not inferred)
- `src/views/OwnerConsoleView.vue` (tab-strip implementation, confirmed plain-button/no-ARIA pattern
  explicitly mirrored from `ServiceEditorView.vue`)
- W3C ARIA Authoring Practices Guide — Tabs pattern (`role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`,
  roving `tabindex`) and WCAG 2.1 Success Criteria 1.3.1 (Info and Relationships) / 4.1.2 (Name, Role, Value)
  — standard, stable web-accessibility guidance for admin-console labeling and tab semantics (general
  industry-standard practice, HIGH confidence — not a moving target)

---
*Feature research for: per-org configurability (Teams + song-tag filter) and hardening (share-link
revocation, pending-render data-loss guard, admin console a11y) — WorshipPlanner v2.2*
*Researched: 2026-08-23*
