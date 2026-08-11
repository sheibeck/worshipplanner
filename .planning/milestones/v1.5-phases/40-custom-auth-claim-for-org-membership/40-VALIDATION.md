---
phase: 40
slug: custom-auth-claim-for-org-membership
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 40 — Validation Strategy

> Derived from `40-RESEARCH.md` § Validation Architecture, with the **baseline measured directly
> against live emulators on 2026-08-06** rather than assumed.

---

## ★ Measured baseline — the "before" state this phase must flip

All five emulators were confirmed running (auth 9099, firestore 8080, functions 5001, **storage
9199**, ui 4000). Ran `npx vitest run --config vitest.rules.config.ts`:

```
Test Files  1 failed | 1 passed (2)
     Tests  2 failed | 96 passed (98)
```

- `src/rules.test.ts` — **fully passing** (Firestore rules, untouched by this phase)
- `src/storage.rules.test.ts` — **exactly 2 failures**, both ALLOW-cases:
  1. `storage.rules — org membership › allows an org member to write and read an object under their org path`
  2. `storage.rules — media path › allows an org member to upload a ~40MB media file (under the 50MB media cap)`

**Every deny-case passes. Both allow-cases fail.** That is the deny-everyone signature CLAUDE.md
documents, and it is caused by `firestore.exists()` being inert in the Storage emulator
(firebase-js-sdk#6803). **Turning exactly these two green is this phase's headline gate.**

> ⚠ Without the Storage emulator running, all 8 tests in that file fail instead of 2. If you see 8,
> the emulator is down — that is a tooling state, not a regression.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest — root `^4.0.18`; `functions/` has its own `^4.1.10`. **Do not cross-invoke** (CLAUDE.md version-mismatch trap) |
| **Rules suite (emulator ALREADY running)** | `npx vitest run --config vitest.rules.config.ts` ← **use this** |
| **Rules suite (self-contained)** | `npm run test:rules` — **currently fails with "port taken"**, because emulators are already up |
| **Functions suite** | `cd functions && npm run test` |
| **App suite** | `npx vitest run --dir src --exclude '**/rules.test.ts'` |
| **Type gate** | `npm run type-check` (the `vue-tsc --build` form) |

> **`src/storage.rules.test.ts` requires BOTH the Firestore and Storage emulators** — Firestore to
> seed membership docs for the fallback arm, Storage to evaluate the rules. It is **not** reliable
> evidence from a bare `npx vitest run` where emulator state was not confirmed.

---

## Per-Requirement Verification Map

| Req | Behavior | Test Type | Command | File Status |
|-----|----------|-----------|---------|-------------|
| R074 | **The two measured failures above turn green** once `storage.rules` gains the dual-read | Storage-emulator ALLOW | `npx vitest run --config vitest.rules.config.ts` | ✅ exists, currently failing — the headline gate |
| R074 | Member allowed via **claim alone**, no Firestore membership doc seeded | Storage-emulator ALLOW | same | ❌ Wave 0 — new |
| R075 | Member allowed via **Firestore fallback alone**, no claim on token (pre-rollout member) | Storage-emulator ALLOW | same | ❌ Wave 0 — new |
| R075 | Claim for a **different** org, no Firestore doc → denied | Storage-emulator DENY | same | ❌ Wave 0 — new |
| R075 | **No claim, no Firestore doc** (user in no org) → denied on **both** branches | Storage-emulator DENY | same | ❌ Wave 0 — new |
| R074/R075 | Trigger sets `{ orgId, role }` on member-doc **create** | Functions unit (mocked Admin SDK) | `cd functions && npm run test` | ❌ Wave 0 — new `orgMembershipClaims.test.ts` |
| R074/R075 | Trigger updates the claim on **role change** | Functions unit | same | ❌ Wave 0 |
| R074/R075 | Trigger **clears** the claim on member-doc delete | Functions unit | same | ❌ Wave 0 |
| R074/R075 | Trigger **skips** a write to a non-primary org's membership doc | Functions unit | same | ❌ Wave 0 |
| CONTEXT | Backfill: skip-if-already-matching is idempotent across repeat runs | Unit (mocked Admin SDK) | same | ❌ Wave 0 |
| CONTEXT | Backfill does **not** crash on the pending invite with no `members/{uid}` document | Unit | same | ❌ Wave 0 — **live case exists in production** |
| CONTEXT | Bounded retry on `getIdToken(true)` closes the invite-acceptance race | Unit (app suite) | `npx vitest run --dir src --exclude '**/rules.test.ts'` | ❌ Wave 0 |

---

## The Non-Negotiable Discipline

**Every rules test must prove an ALLOW case, not only DENY cases.**

All-denies-pass-while-all-allows-fail is the exact signature of a rule that denies everyone — it is
what this phase's measured baseline shows right now, and it is how a broken rule reached production
for an entire milestone. A phase that ends with deny-cases green and allow-cases still red has
achieved nothing, regardless of how much code was written.

**Both arms of the dual-read OR must be tested separately** — claim-present and claim-absent. A
single combined test passes while one arm is broken.

---

## Manual-Only — Owner, Post-Deploy

Nothing below runs during this phase. Both deploys are the owner's step per the v1.5 standing grant.

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| **Deploy 1** — dual-read rule + claims function | Deploy is owner-gated | Deploy, then confirm an existing member can still upload (fallback arm live) |
| **Soak** — one full max-token-lifetime | Real token expiry cannot be simulated | Hold ~1 hour so every live token carries the claim |
| **Deploy 2** — remove the Firestore fallback | Owner-gated; irreversible without a redeploy | Deploy, then confirm both users still upload |
| **Invite-acceptance path** | One real never-accepted invite exists in production | Accept it and confirm the claim is set and upload works without a manual refresh |
| **Rollback** | Only meaningful against real tokens | Re-deploy the dual-read rule; the fallback arm restores access immediately |

> **Population is 2 active users + 1 pending invite.** Blast radius of a mistake is two accounts, one
> of them the owner's — recoverable by re-authenticating. This does not lower the correctness bar on
> the dual-read; it does mean no scale, batching, or rate-limit testing is warranted.

---

## Validation Sign-Off

- [ ] The two measured baseline failures now PASS against a live Storage emulator
- [ ] Both arms of the dual-read OR tested separately
- [ ] Deny-cases still deny (no regression toward allow-everyone)
- [ ] Trigger covers create / update / delete / non-primary-org skip
- [ ] Backfill idempotent and safe against the pending-invite case
- [ ] `npm run type-check` clean
- [ ] Neither `firestore.rules` nor any deploy was touched
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
