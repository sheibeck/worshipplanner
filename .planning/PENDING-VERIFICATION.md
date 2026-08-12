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

## ★ C1 — Phase 40 auth-claim migration is HALF DONE (Deploy 2 never ran)

**Highest-value carry-forward.** The org-membership custom-auth-claim migration
shipped Deploy 1 (dual-read fallback) on 2026-08-10 but never completed Deploy 2
(claim as sole authority). Production runs today on the intermediate dual-read
state — it works, but the migration is unfinished. Archived: lines 699–750.

Outstanding before Deploy 2 can safely run:
- **40.1 OBSERVE** — confirm an existing member can still upload in the LIVE app (proves the Firestore fallback arm still works).
- **40.2 backfill** — NOT RUN (deploy host lacked gcloud ADC). Required before Deploy 2, since afterward the claim is the sole authority.
- **40.3 soak** — one full hour after backfill; skipping it is what locks people out at Deploy 2.
- **40.4 ★ MANDATORY pre-check** — confirm no user's `orgIds` has more than one entry. The claim carries `orgIds[0]` only; a multi-org user loses access the moment the fallback is removed.
- **40.5 Deploy 2** — remove the Firestore fallback.
- **40.6** — exercise the real pending invite end-to-end.

**Decision needed:** finish Deploy 2 (backfill → soak → pre-check → deploy), or
explicitly decide to remain on the dual-read fallback permanently.

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

## C6 — Confirm `NLT_API_KEY` secret is set (quick check)

Archived 1114–1116. `firebase functions:secrets:set NLT_API_KEY` is an owner-only
step a `firebase deploy --only functions` does NOT perform. NLT is the default
Bible version, so a missing secret breaks scripture fetch for any church that
didn't pick ESV. Prod fetch works, so it was very likely set — **confirm and close.**

## C7 — Confirm Phase 41/42 rules clauses are live (quick console check)

Archived 864–869. Confirm in the Firebase console that the deployed ruleset has:
`shareTokens` `allow create: if isOrgEditor(...)` (not `isSignedIn()`, CR-01), and a
`match /pptxRenders/{importId}` read block with `collection != 'pptxRenders'` on the
generic wildcard's write clause (Phase 42 write-hole fix — otherwise an org editor
could forge their own org's render doc to `ready`). Almost certainly satisfied by
the 2026-08-12 whole-file rules deploy — **2-minute confirm, then close.**

---

## Also still open (tracked in ROADMAP `## Backlog`, not here)

- **999.3** — firestore.rules are deployed, but the **production devtools bypass check** (set a service to Planned, attempt a direct Firestore write, expect permission denied) was never performed against prod.
