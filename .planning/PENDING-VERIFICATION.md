# Pending Human Verification — carried forward into the next milestone

**Reset:** 2026-08-12, at the close of v1.6 (deployed to prod 2026-08-12).

The full historical record for v1.4 → v1.6 (phases 31–57, all owner-accepted or
satisfied by production use) was archived to
[`milestones/v1.6-PENDING-VERIFICATION.md`](./milestones/v1.6-PENDING-VERIFICATION.md).
Only the items below were **still genuinely open** at that boundary and must not
be lost. Line references point into the archived file.

These are **not visual-polish deferrals** — they are unfinished ops/security work
and recorded open decisions. Review them during new-milestone scoping
(`/gsd-review-backlog` + requirements intake). C6/C7 are cheap confirmations that
can be closed in minutes; the rest are future-phase candidates or explicit
owner decisions.

---

## ✅ C1 — Phase 40 auth-claim migration — COMPLETE (Deploy 2 shipped 2026-08-12)

**Deploy 2 released to production 2026-08-12 ~21:39 UTC.** `storage.rules` is now
claim-only; the cross-service `firestore.exists()` fallback is gone. Post-deploy
verification: all 3 users confirmed to carry `{orgId: 6vyK2…, role: editor}`
server-side; `test:rules` green 149/149 (storage allow-cases now emulator-provable).
**Remaining owner spot-check (non-blocking):** do one real upload (PPTX import or
media) in the LIVE Berean app to confirm end-to-end — the one thing not provable
without a real user session.

Owner decided (2026-08-12) to FINISH the migration. What was done this session:
- **Accidental multi-org cleanup — DONE (prod).** The pre-check found 2 of 3 users
  were members of accidental, abandoned orgs (`1dcn4…`, `vi9Xw…`) beyond Berean
  (`6vyK2…`). Owner confirmed those orgs are unused/abandonable. A one-off admin
  script (dry-run then `--apply`) deleted the 2 orphaned `members/{uid}` docs. All
  3 users are now single-org (Berean).
- **40.4 MANDATORY pre-check — PASSES.** Backfill dry-run now shows 3 users, all
  single-org in Berean. No multi-org user remains.
- **40.2 backfill — DONE (prod).** `node lib/backfillOrgClaims.js --apply` set
  `{orgId: 6vyK2…, role: editor}` for all 3 users (processed 3, failed 0).
- **Deploy-2 rules change — PREPARED & LOCALLY VERIFIED (not yet deployed).**
  `storage.rules` `isOrgMember` is now claim-only; the `storage.rules.test.ts`
  guard was rewritten to assert the fallback stays removed. type-check clean;
  `test:rules` green **149/149** — and the storage allow-cases now pass in the
  emulator (they never could under the fallback: firestore.exists() is inert there).

**Remaining:**
- **40.3 soak** — wait ≥1 hour after the backfill (done ~20:35 UTC 2026-08-12) so
  every live token re-mints carrying the claim. **Do NOT deploy before then.**
- **40.5 Deploy 2** — `firebase deploy --only storage --project worship-planner-bc515`,
  then confirm all users can still upload/read Berean media.
- **40.6** — exercise the one real pending invite end-to-end after deploy.

**Multi-org note:** the claim still carries the primary org only. Safe now (all
single-org). Before any user ever joins a second real org, widen the claim — see
ROADMAP backlog **999.5**.

## C2 — Phase 40.1 prod exercises undone + 2 known-open rules findings

Tightened `firestore.rules` deployed 2026-08-10, but (archived 781–803):
- **Exercise the one real pending invite in production** — not done.
- **Create a genuinely new organization through a real signup** — not done; this is the failure mode most likely to silently block new-church onboarding. No new org verified since deploy.
- Recorded but **NOT fixed** (future-phase candidates): (1) `organizations/{orgId}` `allow write: if isOrgEditor` lets an editor rewrite `createdBy` (`firestore.rules:31`); (2) `inviteLookup/{email}` `allow create: if isSignedIn()` is a self-invite vector (`firestore.rules:173`).

## C3 — Phase 37 render-service: package sign-off + cleanup-job safety gate

Archived 489–514:
- **37.5** — package-legitimacy checkpoints (`express`, `@google-cloud/storage`, `@types/*` in `render-service/`; `google-auth-library` in `functions/`) were deferred, never formally owner-signed-off. Packages are live in prod.
- **37.6 (operational gate)** — `cleanupOrphanRenders` runs daily 03:00 UTC, dry-run by default. **`PPTX_RENDER_CLEANUP_ENABLED` must stay UNSET until a real dry-run log is read** and confirmed to target only stale renders (never a `source.pptx` / `images/` / `ready` render).

## C4 — Phase 42 pending-slide data-loss gap (owner decision pending)

Archived 919–952. Per-entry customization attached to a deck slide **before its
render completes is lost** when the render flips `pending → ready`. Not fixable
by index pairing (would mis-attach). `EditSlideDrawer.vue` has no `renderState`
awareness — the UI invites customizing a pending slide it will then discard. At
minimum warrants disabling/warning on customization of a pending slide. Owner's
call whether to do a follow-up phase.

## C5 — Phase 41 `deleteService` share-revocation gap (future phase)

Archived 871–886. `deleteService` does not revoke a service's
`shareTokens`/`serviceShares`/`serviceShareLinks` (unlike `deleteQuarter`), so the
public share token is now permanent. `allow delete` rules are already in place, so
a future phase can implement revocation with no rules change.

## ✅ C6 — `NLT_API_KEY` secret is set — CONFIRMED IN PRODUCTION 2026-08-12

Owner confirmed the secret is set and NLT scripture fetch works in prod. Closed.
(Archived detail: v1.6-PENDING-VERIFICATION.md 1114–1116.)

## ✅ C7 — Phase 41/42 rules clauses are live — CONFIRMED IN PRODUCTION 2026-08-12

Owner confirmed in the Firebase console that the deployed ruleset carries the
`shareTokens` `allow create: if isOrgEditor(...)` clause (CR-01) and the
`pptxRenders` write-hole fix (Phase 42 T-37-15/T-42-01). Closed.
(Archived detail: v1.6-PENDING-VERIFICATION.md 864–869.)

---

## ⏳ 58-05 — per-service Messaging defaults panel: Draft→locked read-only (R132) — DEFERRED

Automated gates pass (store action + panel unit tests, type-check, full-suite
baseline). The manual visual confirmation is deferred to owner at
`/gsd-verify-work 58` per the v1.7 grant: on a **Draft** service edit a Messaging
defaults override (e.g. Lock notification → On), then **lock** the service (Mark
as Planned) and confirm the panel switches to the static read-only summary with no
editable select. Coverage id D4 in `58-05-SUMMARY.md`.

---

## Also still open (tracked in ROADMAP `## Backlog`, not here)

- **999.3** — firestore.rules are deployed, but the **production devtools bypass check** (set a service to Planned, attempt a direct Firestore write, expect permission denied) was never performed against prod.
