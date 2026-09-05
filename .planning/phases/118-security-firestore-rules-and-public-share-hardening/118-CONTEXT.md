# Phase 118: Security — Firestore Rules & Public Share Hardening - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous / yolo — recommended answers auto-accepted, grounded in the v2.8
security review + the existing firestore.rules patterns). **This is the milestone's highest-risk phase**
(v2.8's rules fix shipped two regressions caught only by review) — decisions below deliberately favor the
low-risk branch each success criterion offers.

<domain>
## Phase Boundary

Close every remaining `firestore.rules`-level and public-share-page security gap from the v2.8 review
(backlog 999.5): R341, R342, R343, R346, R347, R348. Grouped here because they share the
`firestore.rules` file and its emulator test harness (`src/rules.test.ts`). Out of scope: the
Cloud-Functions gaps (Phase 117, done) and all architecture work (Phases 119-120).
</domain>

<decisions>
## Implementation Decisions

### R341 (SEC-R-03) — services draft-edit field-diff restriction  [REAL RULES FIX]
- The `services/{docId}` `allow update` branch 1 (`storedStatus() == 'draft'`, firestore.rules:204)
  currently permits ANY field change while draft — including forging `createdBy`. **Add a
  provenance-field-diff guard to that branch**, mirroring the existing `preservesCreatedBy()` /
  `.diff(resource.data).affectedKeys().hasAny([...])` pattern already used on the organization doc
  (~firestore.rules:105) and the `keys()` helper already defined at :196.
- Provenance fields to protect: at minimum `createdBy` (and `createdAt` if present). Do NOT block
  `pcExportedAt`/`pcPlanId` — those have their own legitimate export branch (branches 2/3).
- New tests: a DENY case (editor tries to change `createdBy` on a draft) + an ALLOW case (ordinary draft
  slot/notes edit still works).

### R343 (SEC-ISO-06 residual) — orgSlugs/orgNames get/list split  [REAL RULES FIX]
- Apply the **same get/list split** SEC-S-01 used: `allow get: if true` (a known slug/name still
  resolves) but `allow list: if <authenticated/scoped>` so an unauthenticated collection query fails.
  Mirror the exact fix pattern already proven for shareTokens/quarterShares/serviceShares in v2.8.
- New tests: `assertFails(getDocs(collection))` unauthenticated + `assertSucceeds(getDoc(knownId))`.

### R346 (SEC-S-04) — public share-page PII gate  [FRONTEND + share projection]
- Free-text `notes`/slot-body fields render verbatim on `ShareView.vue`/`QuarterShareView.vue`. **Filter
  or explicitly gate them in the public share projection** (the data-shaping in `src/stores/services.ts`
  ~:70-99 that builds the public "Who's Serving"/share payload), consistent with the deliberately-guarded
  `roleAssignments` names-only allowlist that already exists (SEC-S-05, confirmed-sound).
- Preferred: shape the public payload allowlist-style (only fields meant to be public reach the page),
  rather than a blocklist. Keep the structured stage-layout/roleAssignments behavior unchanged.

### R342 (ARCH-018 / SEC-ISO-04) — super-admin members-write  [DOCUMENT + PIN, low-risk branch]
- **Take the success criterion's second branch: document the accepted boundary and pin it with a rules
  test.** Rationale: super-admin's universal `isOrgEditor` grant is by design (accepted at Phase 78,
  R225/T-78-03; see the existing NOTE at firestore.rules:37 and :125-129). Constraining it at the rules
  level is complex and risks breaking the sanctioned `enterOrgAsSuperAdmin` flow. Do NOT narrow
  `isOrgEditor` (the code already warns against it at :149).
- Deliverable: a rules test that PROVES the accepted invariant (a super-admin CAN write `members/{uid}`
  by rule = ALLOW), plus a clear comment documenting that the no-write guarantee is a client-code
  contract, not a rules invariant. This makes the accepted residual explicit and regression-pinned.

### R347 (SEC-S-02) — guessable memorable share ids  [RE-ACCEPT IN WRITING, low-risk branch]
- **Take the second branch: explicitly re-accept the residual guessability in writing with reasoning.**
  Rationale: (1) the memorable ids (`{slug}__service-{date}`, `{slug}__q{Q}-{Y}`) are ALREADY deployed
  and embedded in shared links — changing the id format would break every existing share link; (2)
  v2.8's SEC-S-01 fix already locked LIST on the share collections, so guessing now requires knowing both
  the exact public slug AND a plausible exact date, with zero enumeration. Combined residual risk is Low.
- Deliverable: a written re-acceptance (a short note in the phase docs / an ADR-style rationale) and a
  code comment at the id-construction sites (`services.ts:761`, `quarters.ts:416`). No id-format change.
  (If the planner finds a fully backward-compatible additive token for NEW shares only that doesn't touch
  existing links, that is acceptable too — but not at the cost of breaking deployed links.)

### R348 (SEC-ISO-05) — admin vs editor role semantics  [DOCUMENT, low-risk branch]
- **Take the second branch: document that `role: 'admin'` is intentionally synonymous with `'editor'`
  today**, with an explicit warning that a future `'admin'`-specific gate must NOT silently inherit the
  editor self-escalation path. Add the warning as a comment at the role checks (firestore.rules:40 and
  the auth-store role checks) and, optionally, a test asserting current synonymity so a future divergence
  is a deliberate, test-breaking change.

### Claude's Discretion
- Exact provenance field list for R341, the precise allowlist shape for the R346 public projection, and
  whether R347/R348 written rationale lives in an ADR (docs/adr/) vs the phase SUMMARY.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firestore.rules`: `keys()` helper (:196), `preservesCreatedBy()` / affectedKeys diff pattern (~:105),
  the SEC-S-01 get/list split already applied to shareTokens/quarterShares/serviceShares (the template
  for R343), the services update branches (:194-221), the `members/{uid}` write rule (:150-152), the
  super-admin NOTE (:37, :125-129, :149).
- `src/rules.test.ts` (121KB) — the existing ALLOW/DENY rules-test harness; new cases follow its
  `assertFails`/`assertSucceeds` conventions. It targets projectId `test-project`.
- `src/stores/services.ts` ~:70-99 — the public share payload shaping (R346); `roleAssignments`
  names-only allowlist is the pattern to mirror (SEC-S-05).
- `src/views/ShareView.vue` / `QuarterShareView.vue` — the public render sites (R346).

### Established Patterns
- The SEC-S-01 get/list split is the canonical fix shape for R343.
- Public share payload is allowlist-shaped for PII (the "Who's Serving" structure) — extend it, don't
  add a blocklist.

### Integration Points
- `firestore.rules` (R341, R343; comment-doc for R342/R347/R348), `src/rules.test.ts` (all rules tests),
  `src/stores/services.ts` + the two ShareView components (R346), id-construction sites in services.ts /
  quarters.ts (R347 comment).

</code_context>

<specifics>
## Specific Ideas

- **Test harness:** the rules suite runs via **`npm run test:rules`** (`firebase emulators:exec` —
  starts its OWN emulator, projectId `test-project`; FAILS "port taken" if an emulator is already up —
  in that case run `npx vitest run --config vitest.rules.config.ts` against the running one). The
  known-failing baseline is `src/storage.rules.test.ts` ONLY (Storage-emulator cross-service limitation,
  NOT a defect — see CLAUDE.md); do not chase it and do not let it mask a real firestore-rules failure.
- The app unit suite (`npx vitest run`) EXCLUDES `src/rules.test.ts`, so it proves nothing about rules —
  R346's frontend change should also carry a component/unit test in the app suite.
- Source detail for every finding: `.planning/milestones/v2.8-phases/112-security-review/112-SECURITY-REVIEW.md`.

</specifics>

<deferred>
## Deferred Ideas

- SEC-S-03 (share links never expire) — intentional product design, out of milestone scope entirely.
- Architecture findings (R349-R360) → Phases 119-120.
- Any broader super-admin-claim redesign (moving org membership onto a custom claim so the Storage rule
  works in-emulator) — that is the long-standing v1.5-scoped item in CLAUDE.md, NOT this phase.

</deferred>
