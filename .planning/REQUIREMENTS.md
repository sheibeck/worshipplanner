# Requirements: WorshipPlanner — Milestone v2.10

**Milestone:** v2.10 — Security & Architecture Hardening
**Defined:** 2026-09-04
**Goal:** Remediate the actionable Medium/Low findings deferred from v2.8's security and architectural
reviews (backlog 999.5 + 999.4), closing the gap between "reviewed" and "fixed."

> **Scope decisions (locked at milestone start):**
> - **Pure remediation, no new features, no research pass.** Every requirement traces to a specific,
>   already-documented finding in the v2.8 review reports:
>   `.planning/milestones/v2.8-phases/112-security-review/112-SECURITY-REVIEW.md` (security) and
>   `.planning/milestones/v2.8-phases/110-architectural-review/110-ARCHITECTURE-REVIEW.md` (architecture).
>   Those reports carry the full per-finding location/behavior/impact/remediation detail; this file is the
>   requirement layer over them.
> - **SEC-A-01 is the highest priority** — the `/api/planningcenter` proxy currently has zero
>   authentication (open-relay/DoS risk on a shared concurrency pool), unlike its anthropic/esv/nlt
>   siblings. Fix it first.
> - **The two god-module decompositions (ARCH-006 `ServiceEditorView.vue`, ARCH-010
>   `functions/src/index.ts`) are scoped as "begin decomposing"** — extract at least one responsibility
>   each, matching the sibling extraction pattern, not a full rewrite.
> - **Confirmed-sound / no-finding items are NOT requirements** (see Out of Scope): SEC-C-02..04,
>   SEC-A-02, SEC-S-05, ARCH-004 (informational), ARCH-005 (already resolved — functions deployed),
>   ARCH-015..019, ARCH-021..023, and SEC-S-03 (intentional design).

---

## v2.10 Requirements

### Security Hardening (backlog 999.5)

- [ ] **R339** (SEC-A-01): The `/api/planningcenter` proxy route **requires an authenticated app caller**
  — the same auth gate that guards the `anthropic`/`esv`/`nlt` routes — and rejects unauthenticated
  requests with 401 instead of relaying them upstream. *(Highest priority.)*

- [ ] **R340** (SEC-C-01): The ESV/NLT Bible-API proxy branches are covered by the **same per-uid rate
  limiter** that guards the `anthropic` proxy, so an enabled org cannot make unlimited-frequency Bible-API
  calls.

- [ ] **R341** (SEC-R-03): The `services/{docId}` draft-edit Firestore-rules branch **restricts field
  diffs** so an org editor cannot forge `createdBy` or other provenance fields while a service is in draft.

- [ ] **R342** (ARCH-018 / SEC-ISO-04): Super-admin's ability to write any org's `members/{uid}` is
  **constrained at the Firestore-rules level** rather than resting only on client-code discipline — or, if
  a rules-level constraint proves infeasible, the invariant is documented and covered by a rules test that
  proves the accepted boundary.

- [ ] **R343** (SEC-ISO-06 residual): The publicly-readable `orgSlugs`/`orgNames` registries **split
  `get` from `list`** (the same fix pattern as v2.8's SEC-S-01) so the full registry can no longer be
  enumerated by an unauthenticated collection query.

- [ ] **R344** (SEC-C-05): `queueServiceMessage` enforces its **own per-uid/per-org enqueue-rate limit**,
  independent of the downstream per-message and shared-instance ceilings.

- [ ] **R345** (SEC-C-06): `parsePptx` enforces a **per-uid/per-org daily import quota** (matching the
  R161/R171 pattern), independent of the render service's concurrency ceiling.

- [ ] **R346** (SEC-S-04): Free-text `notes`/slot-body fields are **PII-filtered or explicitly gated**
  before they render verbatim on the public share page, consistent with the deliberately-guarded
  `roleAssignments` names-only field.

- [ ] **R347** (SEC-S-02): Memorable-URL share ids are **hardened against enumeration** (e.g. an
  unguessable token component alongside the memorable slug), or — if the memorable-URL product value wins
  — the residual guessability risk is explicitly re-accepted in writing with reasoning.

- [ ] **R348** (SEC-ISO-05): The org `role: 'admin'` vs `'editor'` distinction is either **given real
  enforced meaning** or **documented** so that a future `'admin'`-specific gate cannot silently inherit the
  current self-escalation path.

### Architecture Hardening (backlog 999.4)

- [ ] **R349** (ARCH-011): `recomputeLastUsedFor`'s per-song update loop has **per-item failure
  isolation** — one song's write failing no longer leaves `lastUsedAt` silently inconsistent across the
  rest of the service's songs.

- [ ] **R350** (ARCH-014): The Planning Center song-import path (`upsertSongs`) **batches its writes**
  (like the sibling CSV `importSongs`, which chunks into `writeBatch`es) and surfaces per-song
  success/failure feedback instead of hundreds of sequential unbatched writes.

- [ ] **R351** (ARCH-009): The default lyrics subscriber **routes through
  `songLyricsStore.subscribeLyrics`** rather than a duplicated direct `onSnapshot` query, eliminating the
  existing `limit(1)` drift between the two.

- [ ] **R352** (ARCH-012): The unreachable `reopenPcWarning` date branch is fixed — the JSON deep-clone
  idiom that strips the `pcExportedAt` Firestore `Timestamp` is corrected so the guard **works**, or the
  dead code is removed.

- [ ] **R353** (ARCH-002): `ServicesView.vue`'s org-switch watcher **tears down `teamsStore` locally**
  (defense-in-depth), not relying solely on the global org reset for correctness.

- [ ] **R354** (ARCH-003): `SongLyricEditor.vue` and `ScriptureSlideEditor.vue` **reactively
  re-subscribe/teardown on an in-flight org switch** instead of subscribing once on mount via a static
  prop.

- [ ] **R355** (ARCH-007): `ServiceTemplateEditor.vue` writes org settings **through the auth store's
  mutation surface** rather than calling `updateDoc()` on the org document directly and hand-syncing
  `authStore.settings`.

- [ ] **R356** (ARCH-008): `GettingStarted.vue` and `ConfigurationTab.vue`'s direct Firestore
  `onSnapshot` subscriptions are **owned by a store** instead of each duplicating subscribe/unsubscribe
  lifecycle machinery inline.

- [ ] **R357** (ARCH-013): The autosave/reorder-save coordination window is **confirmed safe by a test**
  — a remote snapshot arriving during an in-flight reorder save no longer has an unguarded path.

- [ ] **R358** (ARCH-006): `ServiceEditorView.vue` is **decomposed** — at least one more distinct feature
  responsibility is extracted from the monolith into a composable/component (continuing the
  `useAutoSave`/`useSlideshowAssembly` pattern).

- [ ] **R359** (ARCH-010): `functions/src/index.ts` is **decomposed** — at least one of its five inline
  concerns (API proxy, PPTX pipeline, cleanup sweeps, reminder/scheduled-message cron, messaging pipeline)
  is extracted to its own module, matching the sibling `orgProvisioning.ts`/`orgMembershipClaims.ts`
  extraction pattern.

- [ ] **R360** (ARCH-020): The three `src/utils/*.ts` files that import `useAuthStore()` for read-only
  settings gating have that **dependency-direction inversion corrected** (settings passed in rather than
  the store imported), or the exception is documented as sanctioned.

---

## Future Requirements (deferred)

*(None specific to this milestone — the deferred product features remain in backlog 999.2 (rename to
WorshipBuilder), 999.6 (verified-domain email), and 999.13 (rehearsal attachments / storage cluster).)*

## Out of Scope

- **Confirmed-sound / no-finding review items** — SEC-C-02, SEC-C-03, SEC-C-04, SEC-A-02, SEC-S-05, and
  ARCH-015 through ARCH-019 / ARCH-021 through ARCH-023 were each verified correct by the v2.8 reviews and
  need no change. Recorded here so the backlog is fully accounted for, not silently dropped.

- **ARCH-004** (informational) — `pptxRenders.ts`'s per-id listener pool is internally correct today; it
  was flagged only as *fragile if a second uncoordinated driver is added*. No second driver exists, so
  there is nothing to fix now.

- **ARCH-005** — already resolved: the org-provisioning Cloud Functions the Phase 110 review believed
  UNDEPLOYED are in fact deployed to production (corrected by the Phase 112 review). No action.

- **SEC-S-03** (share links never expire / are not rotated) — an **intentional product-design decision**
  recorded for completeness in the v2.8 review. Not changed this milestone; revisit only if a product
  requirement for expiring/rotating share links emerges.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| R339 | Phase 117 | Pending |
| R340 | Phase 117 | Pending |
| R341 | Phase 118 | Pending |
| R342 | Phase 118 | Pending |
| R343 | Phase 118 | Pending |
| R344 | Phase 117 | Pending |
| R345 | Phase 117 | Pending |
| R346 | Phase 118 | Pending |
| R347 | Phase 118 | Pending |
| R348 | Phase 118 | Pending |
| R349 | Phase 119 | Pending |
| R350 | Phase 119 | Pending |
| R351 | Phase 119 | Pending |
| R352 | Phase 119 | Pending |
| R353 | Phase 119 | Pending |
| R354 | Phase 119 | Pending |
| R355 | Phase 119 | Pending |
| R356 | Phase 119 | Pending |
| R357 | Phase 119 | Pending |
| R358 | Phase 120 | Pending |
| R359 | Phase 120 | Pending |
| R360 | Phase 120 | Pending |

*Filled by the roadmapper — each requirement maps to exactly one phase.*

**Coverage: 22 v2.10 requirements (R339–R360) — 10 security (999.5) + 12 architecture (999.4).**
