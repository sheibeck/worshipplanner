# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-05
**Phases:** 6 | **Plans:** 18 | **Commits:** 218

### What Was Built
- Complete song library with CSV import, VW type categorization, team tags, search & filter
- Weekly service planning with 9-slot template, progression enforcement, smart suggestion algorithm
- Print layout, Planning Center text export, and shareable read-only links
- AI-powered song suggestions and natural language scripture discovery using Claude
- Team management with email invite flow and editor/viewer RBAC
- 14 quick-task UX improvements (autosave, hymn slots, infinite scroll, settings, rotation tables)

### What Worked
- Phase-based execution with clear dependency ordering kept work focused
- Denormalized Firestore patterns (song snapshots in slots, shareTokens) eliminated N+1 reads
- Static Tailwind class lookups (not dynamic string interpolation) prevented v4 purge issues — pattern reused in every component with dynamic classes
- Teleport-to-body pattern for dropdowns/slide-overs solved AppShell overflow stacking consistently
- AI features designed as additive (never blocking) — graceful null-return on error means the app works without API key
- Quick tasks provided effective polish between major phases without disrupting phase structure

### What Was Inefficient
- Phase 3 ROADMAP shows 4/5 plans but disk shows 5/5 — roadmap wasn't updated when plan 05 completed
- Phase 5 scope was originally too broad (auth + tasks + events) — auth was extracted to Phase 7, but Phase 5 remains unstarted with just tasks/events
- Some plan checkboxes in ROADMAP.md were never checked despite plans being complete (cosmetic inconsistency)
- STATE.md progress tracking fell behind — showed 50% when actual was 100%

### Patterns Established
- Dark mode canonical palette: gray-950 body, gray-900 cards/sidebar, gray-800 inputs
- Pinia stores subscribe via onSnapshot (not VueFire composables)
- Static class lookup objects for Tailwind v4 purge safety
- Teleport to body for z-index escape from AppShell overflow
- signInWithPopup preferred over signInWithRedirect
- AI functions return null on error, never throw
- orgId/userRole centralized in auth store — no ad-hoc getDoc calls

### Key Lessons
1. Denormalize early for Firestore — read-time joins are expensive and complex
2. VW type as soft priority signal (+100 bonus) works better than hard filter — lets planners see all songs with smart ordering
3. Autosave with debounce + one-step undo is worth the complexity over explicit save buttons
4. Team filtering with AND logic (song must support ALL active teams) is the correct semantic

### Cost Observations
- Model mix: primarily opus for planning/execution, haiku for AI suggestions in-app
- Sessions: ~20+ across 2 days
- Notable: Entire v1.0 MVP built in 2 calendar days with 218 commits

---

## Milestone: v1.5 — Settings, Sharing, and Fidelity

**Shipped:** 2026-08-10 (deployed to production) · **Phases:** 13 (39–50) · **Plans:** 49 · **Tasks:** ~110

### What Was Built
Per-church settings + feature toggles (AI, Planning Center, Vertical Worship), custom-auth-claim org
membership with a dual-read migration path, sharing correctness (one stable share link per service,
auto-refreshed), client display of server-rendered PPTX images, service item types + default service
template, ESV/NLT Bible selection with immutable per-slide attribution, global slide typography,
hand-divided congregational reading UX, multi-image ordering + mobile polish, and slide
bulk-delete / render-stable provenance / render fidelity.

### What Worked
- **Deploy-then-verify closed the loop cheaply.** R109's cache header was deploy-gated; deploying and
  inspecting real production `Cache-Control` headers turned a "human-verify later" item into a
  same-session confirmation — and caught a genuine design gap (WR-01) before it shipped ineffective.
- **Code review as a real gate.** The Phase 50 review's WR-01 finding (a LOCKED `/index.html`-only
  header that Firebase never applies to `/` or deep links) was fixed before close rather than deferred.
- **Owner-attributed close, honestly recorded.** 7 phases with deferred human-verify were accepted on
  the basis of production use — recorded as `owner-attributed`, never silently marked self-verified.

### What Was Inefficient
- **Verification/UAT status vocabulary drift.** UAT terminal status is `complete`/`resolved` but the
  work used `passed`; verification used `human_needed` long after phases were deployed. The pre-close
  audit surfaced 18 "open" items that were nearly all already done — a status-hygiene tax, not real work.
- **Quick-task hygiene.** 11 of 14 "incomplete" quick tasks were actually done but lacked a
  `status: complete` in their SUMMARY; 3 were delivered by later work with no SUMMARY at all.

### Key Lessons
- A deploy-gated check is verifiable the moment you deploy — don't defer what a header inspection can confirm.
- "A test/claim explained away as environment-limited is an untested assertion" held again: the
  `/index.html`-only header *looked* fine and *tested* green while not achieving its own requirement.
- Set a terminal `status:` on quick-task summaries and flip UAT/verification status at completion, or
  milestone-close audits inherit a large false-positive backlog.

### Cost Observations
- Executors ran on Sonnet (sequential, worktrees auto-degraded due to HEAD ahead of origin); orchestration + reviews on Opus.
- One production deploy (`firebase deploy --only hosting,functions`), owner-authorized.

## Milestone: v1.6 — Editing Reliability & Song Slides

**Shipped:** 2026-08-12
**Phases:** 7 (51–57) | **Plans:** 19

### What Was Built
Drag-and-drop editing reliability (cross-section phantom, "No Section" save error, empty-body order)
in both editors; service-template relocation to the Services page; hand-split song slides (+ Pre-Chorus,
position-derived numbering, "Save" rename); per-item notes; a full Service Order redesign (three-rail
rows, colored badges, per-row ⋯ menu, "No Section" band) applied to both the service and template
editors; per-item Miscellaneous labels (inline-editable badge) and a Scripture ESV/NLT override;
preview/export polish (no auto-version, export spinner, Roboto). Closed a 3rd-recurrence Firestore
delete bug (`resource == null` on a never-materialized slideGroup).

### What Worked
- Autonomous run (`--from 56 --to 57`) drove discuss→plan→execute cleanly for the owner scope addition.
- A Claude Design mockup imported via DesignSync gave a concrete visual target for the Service Order
  redesign, cutting design ambiguity.
- Adversarial emulator reproduction finally root-caused the recurring delete bug that two prior
  field-shape fixes had missed — the lesson being "a test explained away as an environment quirk is an
  untested assertion" applied to the missing `resource == null` case.
- Shared helpers (`kindBadgeClass`, `miscLabel`, `MiscLabelBadge`) extracted so the two editors can't drift.

### What Was Inefficient
- Rapid-fire owner UI tweaks arrived after 56/57 as many small follow-ups; each needed its own
  build/test/commit cycle rather than being batched into the phases.
- The MISC label went through three shapes (separate input → editable badge) as the UX was refined live.

### Key Lessons
- For a security rule that "fails only in the emulator," reproduce the exact production shape before
  declaring it an environment quirk — the delete bug hid behind that assumption twice.
- Slot the version selector into the child (ScriptureInput) rather than floating a sibling, so it can
  share the child's live `effectiveVersion` for both the link and the fetch.

### Cost Observations
- Autonomous phase execution + the delete-bug debug on Sonnet subagents; orchestration + design import + UI tweaks on Opus.
- Two owner-authorized production deploys (firestore.rules, then hosting at close).

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 218 | 6 | Initial build — established all patterns |

### Cumulative Quality

| Milestone | LOC | Quick Tasks | Known Gaps |
|-----------|-----|-------------|------------|
| v1.0 | 12,747 | 14 | Phase 5 (Tasks & Events) deferred |

### Top Lessons (Verified Across Milestones)

1. Static Tailwind class lookups prevent v4 purge — confirmed across 5+ components
2. Firestore denormalization pays off at read time — confirmed across songs, services, shareTokens
