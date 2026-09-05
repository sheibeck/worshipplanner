---
phase: 118-security-firestore-rules-and-public-share-hardening
plan: 02
subsystem: security
tags: [firestore, public-share, pii, vue, pinia, typescript]

requires:
  - phase: 118-01
    provides: firestore.rules hardening (R341/R342/R343/R348) and the SEC-S-01 get/list split this plan's R347 re-acceptance depends on
provides:
  - buildServiceSnapshot's per-slot allowlist projection (drops free-text notes/body for every slot kind)
  - toPublicServiceSnapshot(), the one function every public share write routes through to strip service-level notes
  - ShareView.vue render-side gate protecting already-deployed legacy share docs
  - Written R347 re-acceptance (memorable share-id guessability) with code comments at both id sites
affects: [118-security-firestore-rules-and-public-share-hardening, any future phase touching buildServiceSnapshot/writeSharePayload/ShareView]

tech-stack:
  added: []
  patterns:
    - "Split projection: buildServiceSnapshot() keeps service-level notes for an org-internal consumer (serviceLockDiff.ts); toPublicServiceSnapshot() strips it at the one public-write choke point (writeSharePayload). Per-slot free-text has no internal consumer, so it is stripped unconditionally inside buildServiceSnapshot itself."
    - "Render-side gate as defense-in-depth for legacy data: a projection fix only affects NEW writes, so the renderer (ShareView.vue) must independently refuse to render free-text fields, protecting already-deployed docs the projection can never retroactively fix."
    - "Written re-acceptance for an accepted-not-mitigated residual: a short code comment at each id-construction site plus the full rationale in the phase SUMMARY, rather than leaving the residual silent."

key-files:
  created:
    - src/stores/__tests__/services.sharePii.test.ts
  modified:
    - src/stores/services.ts
    - src/views/ShareView.vue
    - src/views/__tests__/ShareView.test.ts
    - src/stores/__tests__/services.test.ts
    - src/stores/quarters.ts

key-decisions:
  - "Deviated from the plan's literal instruction to remove `notes` from the `ServiceSnapshot` interface/buildServiceSnapshot's return. Discovered mid-task-1 that buildServiceSnapshot is also the snapshot builder for the org-internal lockSnapshots re-lock diff (serviceLockDiff.ts's diffServiceSnapshots, R146/R147), which reads `previous.notes !== current.notes` to detect a 'Service notes changed' re-lock notice — a real, tested feature (serviceLockDiff.test.ts: 'detects a NOTES change') with zero relation to the public-share PII leak. Removing `notes` from the type/return would have silently broken this feature (and failed type-check for that file's tests). Kept `notes` on ServiceSnapshot/buildServiceSnapshot (internal-only past the public boundary) and added a new toPublicServiceSnapshot() that strips it, called at writeSharePayload — the single choke point both shareTokens and serviceShares route through. Per-slot notes/body has no such internal consumer (diffServiceSnapshots never reads it), so it IS stripped unconditionally inside buildServiceSnapshot, matching the plan exactly for slots."
  - "Kept slot.id in the per-slot allowlist (not in the plan's illustrative field list) because diffServiceSnapshots matches slots by `id` for its SONG/ORDER diff entries, and services.test.ts's R112 slot-ordering test asserts on `snapshot.slots.map(s => s.id)`. Omitting it would have broken both."
  - "R347: took the default, lower-risk branch (written re-acceptance, no id-format change) per CONTEXT.md — see the 'R347 re-acceptance' section below for the full rationale."

requirements-completed: [R346, R347]

coverage:
  - id: D1
    description: "buildServiceSnapshot allowlist-shapes every slot kind, dropping free-text notes/body unconditionally"
    requirement: "R346"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.sharePii.test.ts#drops per-slot notes/body for every slot kind, for every consumer of buildServiceSnapshot"
        status: pass
    human_judgment: false
  - id: D2
    description: "toPublicServiceSnapshot() strips service-level free-text notes before either public share write (shareTokens/serviceShares)"
    requirement: "R346"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.sharePii.test.ts#toPublicServiceSnapshot drops the service-level free-text notes for the public write path"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#createShareToken calls setDoc with token as document ID"
        status: pass
    human_judgment: false
  - id: D3
    description: "ShareView.vue renders no free-text notes/slot-body even for a legacy doc that still carries them"
    requirement: "R346"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ShareView.test.ts#renders no free-text notes/body anywhere, for a legacy snapshot that still carries them at every level"
        status: pass
    human_judgment: false
  - id: D4
    description: "R347 written re-acceptance: code comments at both id-construction sites, no id-format change, existing links keep working"
    requirement: "R347"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts (existing suite, id format unchanged) + src/stores/__tests__/quarters.test.ts (existing suite, id format unchanged)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-05
status: complete
---

# Phase 118 Plan 02: Public Share PII Projection + R347 Re-acceptance Summary

**Allowlist-shaped public service snapshot (drops free-text notes/slot-body) with a ShareView render-side gate for legacy docs, plus a written re-acceptance of the guessable memorable-share-id residual — no id format change.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-05T01:32:33Z
- **Tasks:** 3
- **Files modified:** 5 (2 created)

## Accomplishments
- `buildServiceSnapshot`'s per-slot projection now allowlist-shapes every slot kind (SONG, SCRIPTURE, HYMN, MISC, PRAYER, MESSAGE, ANNOUNCEMENTS, IMPORTED), dropping free-text `notes`/`body` unconditionally — no raw spread survives.
- New `toPublicServiceSnapshot()` strips the service-level free-text `notes` at the one choke point (`writeSharePayload`) both `shareTokens/{token}` and `serviceShares/{slug}...` route through.
- `ShareView.vue` no longer renders the per-slot notes/body paragraph or the service-level Notes section — a render-side gate that also protects already-deployed legacy share docs the projection fix cannot retroactively touch.
- R347 (guessable memorable share ids) re-accepted in writing: code comments at both id-construction sites (`services.ts` serviceShares, `quarters.ts` quarterShares) plus the full rationale below. No id-format change — every existing deployed link keeps working.

## Task Commits

Each task was committed atomically:

1. **Task 1: R346 — allowlist-shape the public service snapshot** - `e396575a` (feat)
2. **Task 2: R346 — render-side gate in ShareView** - `5e0b0141` (fix)
3. **Task 3: R347 — re-accept guessable memorable share ids in writing** - `48b520c6` (docs)

_Note: Task 3's commit also carries a small type-safety fix left over from Task 1 (see Deviations) since it surfaced only after Task 1's own commit._

## Files Created/Modified
- `src/stores/services.ts` - Per-slot allowlist projection in `buildServiceSnapshot`; new `PublicServiceSnapshot` type + `toPublicServiceSnapshot()`; `writeSharePayload` routes through it; R347 comment at the `serviceShares` id site
- `src/views/ShareView.vue` - Removed the per-slot notes/body paragraph and the service-level Notes section
- `src/views/__tests__/ShareView.test.ts` - Flipped 5 existing assertions from "renders free-text" to "does not render"; added a legacy-doc PII-marker non-render test
- `src/stores/__tests__/services.test.ts` - Fixed 3 pre-existing assertions that read `snapshot.notes` off the written public payload (now correctly absent); switched their change-probe field to `name`
- `src/stores/__tests__/services.sharePii.test.ts` - New: proves per-slot notes/body absence and the public-projection notes omission, both structured-field preservation
- `src/stores/quarters.ts` - R347 comment at the `quarterShares` id site (no functional change; QuarterShareView confirmed sound, untouched)

## Decisions Made
- **buildServiceSnapshot keeps `notes`; a new `toPublicServiceSnapshot()` strips it for the public write only.** See the frontmatter `key-decisions` entry above for the full discovery/rationale — this diverges from the plan's literal "remove `notes` from the interface" instruction to avoid silently breaking the org-internal re-lock "Service notes changed" diff feature, which has zero relation to the public PII leak this plan targets.
- **`slot.id` retained in the per-slot allowlist** (not in the plan's illustrative field list) because `diffServiceSnapshots` matches slots by id and an existing test (`services.test.ts` R112 ordering) asserts on it.
- **R347: took the default, lower-risk branch** (written re-acceptance, no id change) — see below.

### R347 re-acceptance (SEC-S-02)

**Finding:** Memorable share-link ids (`{slug}__service-{date}` for services, `{slug}__q{quarter}-{year}` for quarters) are deterministic — anyone who knows an org's public slug and guesses a plausible date/quarter can construct a valid share URL without ever seeing it circulated.

**Disposition: ACCEPTED, not mitigated, this phase.**

**Rationale:**
1. The id format is **already deployed** and embedded in every share link an org has ever sent (email, text, printed bulletin). Changing the format — even additively — would either break every existing link or require a dual-read migration this phase is not scoped for, and CONTEXT.md explicitly ruled out breaking deployed links.
2. v2.8's SEC-S-01 fix (Phase 113) already applied the get/list split to `shareTokens`/`quarterShares`/`serviceShares`: `allow get: if true` (a known id still resolves) but `allow list: if false` for unauthenticated callers. This means an attacker cannot enumerate valid slugs or dates from Firestore — they must already know (or correctly guess) both the exact slug AND an exact date/quarter, with zero list-based discovery assistance.
3. Combined residual: slug-guessing + date-guessing with no enumeration is a **Low** residual risk — meaningfully different from the pre-SEC-S-01 world where an attacker could list every share doc in a collection.

**What was done:** a short code comment at each id-construction site (`src/stores/services.ts`, the `serviceShares` `setDoc` call; `src/stores/quarters.ts`, the `quarterShares` `setDoc` call) stating this rationale and explicitly marking the id shape frozen. No functional change — the id strings are byte-for-byte identical to before this plan.

**Not done (deliberately, per CONTEXT's Claude's-discretion note taking the default branch):** no additive token component for new shares. The CONTEXT permitted this as an alternative but flagged the written re-acceptance as the default, lower-risk choice, and this plan took that default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved buildServiceSnapshot's `notes` field instead of removing it per the plan's literal Task 1 instruction, to avoid breaking the org-internal re-lock diff feature**
- **Found during:** Task 1 (allowlist-shaping buildServiceSnapshot)
- **Issue:** The plan instructed removing `notes` from `ServiceSnapshot`/`buildServiceSnapshot`'s return entirely. `buildServiceSnapshot` is also called from `ServiceEditorView.vue`'s Mark-as-Planned re-lock flow to build the snapshot stored at `lockSnapshots/current` (an org-internal, non-public doc), which `diffServiceSnapshots` (`serviceLockDiff.ts`, R146/R147) compares field-by-field — including `previous.notes !== current.notes` — to detect a "Service notes changed" re-lock notice, a real feature pinned by `serviceLockDiff.test.ts`'s `'detects a NOTES change'` test. A literal removal would have (a) failed `npm run type-check` for `serviceLockDiff.ts`'s typed access to `.notes`, and (b) silently disabled the NOTES change-notice for every org, permanently, with no test catching it (the test itself would have needed rewriting to hide the regression).
- **Fix:** Kept `notes: string` on `ServiceSnapshot` and in `buildServiceSnapshot`'s return (documented as internal-only past the public boundary). Added `PublicServiceSnapshot` (`Omit<ServiceSnapshot, 'notes'>`) and `toPublicServiceSnapshot()`, called at the one public-write choke point (`writeSharePayload`, shared by both `shareTokens` and `serviceShares` writes). Per-slot `notes`/`body` — which `diffServiceSnapshots` never reads — IS stripped unconditionally inside `buildServiceSnapshot` itself, matching the plan exactly for slots.
- **Files modified:** src/stores/services.ts
- **Verification:** `serviceLockDiff.test.ts` (26 tests, including the NOTES-change test) still passes unchanged; `services.sharePii.test.ts` proves the public projection (`toPublicServiceSnapshot`) carries no `notes`; `npm run type-check` is clean.
- **Committed in:** e396575a (Task 1 commit)

**2. [Rule 1 - Bug] Fixed 3 pre-existing services.test.ts assertions that read `snapshot.notes` off the written public payload**
- **Found during:** Task 1, running the full `services.test.ts` suite after the projection change
- **Issue:** `'createShareToken calls setDoc with token as document ID'`, `'updateService refreshes the payload with the new data (ROADMAP criterion 2)'`, and `'WR-02: a TRANSIENT refresh failure...'` all asserted `snapshot.notes` equals a value on the actual `setDoc`-written public payload — encoding the pre-fix (insecure) contract as correct.
- **Fix:** Updated the first to assert `'notes' in snapshot === false`; updated the other two to use `name` as their change-probe field instead of `notes` (proving the refresh mechanism still propagates fresh data), plus an added `'notes' in snapshot === false` assertion on one of them.
- **Files modified:** src/stores/__tests__/services.test.ts
- **Verification:** `npx vitest run src/stores/__tests__/services.test.ts` — 109/109 pass.
- **Committed in:** e396575a (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed a TS2353 excess-property error on the resolved `bpm` field**
- **Found during:** Task 1, running `npm run type-check` after the initial slot-allowlist implementation
- **Issue:** `bpm` is a display-only field never declared on the `SongSlot` type (the original pre-existing code carried it only via an unchecked `as ServiceSlot[]` cast at the end of the whole map). My allowlist rewrite assigned `{ ...base, bpm }` directly to the strongly-typed switch return, and TypeScript's excess-property check on an object literal rejected it.
- **Fix:** Added a scoped `as ServiceSlot` cast on that one return, mirroring the type-unsafe convention the original code already relied on for this exact field.
- **Files modified:** src/stores/services.ts
- **Verification:** `npm run type-check` clean.
- **Committed in:** 48b520c6 (Task 3 commit — surfaced after Task 1's own commit, folded into the next available commit rather than amending)

**4. [Rule 1 - Test-update] Flipped 6 ShareView.test.ts assertions from "expects free-text to render" to "expects it does not render," and added a new legacy-doc coverage test**
- **Found during:** Task 2
- **Issue:** Pre-existing tests (43-04, 260812-izz series) asserted that ANNOUNCEMENTS/MISC/MESSAGE `body` and SONG/MESSAGE slot `notes` DID render — the exact behavior R346 removes.
- **Fix:** Updated each to assert non-render instead; the MESSAGE-body-newline test was repurposed to assert no `p.whitespace-pre-wrap` element remains at all. Added a new test proving a PII marker embedded in service-level notes, slot notes, AND slot body simultaneously never reaches `wrapper.text()`, while structured content (song title, MISC label) still renders.
- **Files modified:** src/views/__tests__/ShareView.test.ts
- **Verification:** `npx vitest run src/views/__tests__/ShareView.test.ts` — 20/20 pass.
- **Committed in:** 5e0b0141 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 bug/architectural-preservation, 1 blocking type-safety, 1 necessary test-update)
**Impact on plan:** All four were necessary consequences of implementing R346 correctly without regressing an unrelated, real, tested feature (the org-internal re-lock notes-change diff). No scope creep beyond what R346/R347 required; the plan's declared touched-file list was respected except for the one unavoidable services.test.ts fix (a file the plan didn't declare, but whose 3 assertions became factually false the moment the public payload correctly stopped carrying notes).

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R346 and R347 are both closed for this phase's scope. `buildServiceSnapshot`/`toPublicServiceSnapshot`/`ShareView.vue` are now the durable pattern for any future public-share field: add it to the per-slot or per-snapshot allowlist explicitly, never widen via raw spread.
- No blockers for the remaining phase 118 plans (R341/R343 firestore.rules work landed in 118-01; this plan closed the last two open findings from the v2.8 review's public-share/share-id cluster).
- `src/storage.rules.test.ts` remains the sole accepted baseline failure (Storage-emulator cross-service limitation, unrelated to this plan) — full app suite is otherwise green (5080 passed, 27 skipped).

---
*Phase: 118-security-firestore-rules-and-public-share-hardening*
*Completed: 2026-09-05*

## Self-Check: PASSED

All claimed created/modified files exist on disk; all three task commit hashes (`e396575a`, `5e0b0141`, `48b520c6`) verified present in `git log --oneline --all`.
