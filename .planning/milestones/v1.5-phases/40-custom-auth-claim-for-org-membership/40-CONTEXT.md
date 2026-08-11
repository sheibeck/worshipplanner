# Phase 40: Custom Auth Claim for Org Membership - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

This phase makes the Storage-rules membership check **provably correct in the emulator**, not merely
working in production.

**The problem it exists to solve.** `storage.rules` gates on a cross-service
`firestore.exists(/databases/(default)/documents/organizations/$(orgId)/members/$(uid))`. That call
is **inert in the Storage emulator** — it returns false even for a document proven to exist by an
admin read ([firebase-js-sdk#6803](https://github.com/firebase/firebase-js-sdk/issues/6803)). So the
rule cannot be verified locally at all. Production was fixed on 2026-08-06 by granting the
**Firebase Rules Firestore Service Agent** role to
`service-666677495069@gcp-sa-firebasestorage.iam.gserviceaccount.com`, and uploads work — but the
blind spot that let a deny-everyone rule ship is still wide open.

Reading `request.auth.token.<claim>` is a **direct JWT read**, unaffected by #6803, and
`@firebase/rules-unit-testing` (already installed) exposes `authenticatedContext(uid, tokenOptions)`
to bake claims into a mock token. That is what makes the two currently-failing allow-cases in
`src/storage.rules.test.ts` genuinely runnable.

**Scope fence — `storage.rules` ONLY.** `firestore.rules` uses *same-service* `exists()`/`get()`,
which #6803 does not affect. Migrating it too would trade one staleness class for a worse one (role
changes lagging a token refresh). Explicitly out of scope — see REQUIREMENTS.md R074.

**Nothing is deployed by this phase.** Per the v1.5 standing autonomy grant, `firebase deploy` is the
owner's step. The phase goal is reached when the function, the dual-read rule, the tests, and the
backfill script are **built, tested, and handed over with the exact two-deploy sequence**.
</domain>

<decisions>
## Implementation Decisions

### Claim Shape and Byte Budget

- **The claim carries the PRIMARY org only** — `orgIds[0]`. This mirrors what `loadOrgContext`
  actually does today (`auth.ts:86-99` reads the `orgIds` array and picks `ids[0]`). Bounded and far
  under the 1000-byte custom-claims limit.

- **Shape is `{ orgId, role }`.** Role is included because the success criterion names it and it is
  nearly free once the claim exists.

- **Readable key names** (`orgId`, `role`), not abbreviated. With a single org there is no byte
  pressure that would justify cryptic keys.

- **A user belonging to more than one org:** the claim carries `orgIds[0]`; **the Firestore-membership
  branch of the dual-read continues to cover the others.** This is a **documented known limitation**,
  not an oversight — record it explicitly in the plan and in code comments. Do not silently produce a
  claim that is wrong for multi-org users.

### Rollout and Token Propagation

- **Dual-read is `OR`, never `AND`.** The rule passes if the claim matches **or** the existing
  Firestore membership check passes. An `AND` would lock out every member whose token predates the
  claim. This is non-negotiable.

- **Force a token refresh with `getIdToken(true)`** so a member does not wait up to a full
  max-token-lifetime (1 hour) for the claim to propagate.

- **The forced refresh fires on org-context load** — the one path every authenticated session already
  runs. Not sign-in only, which would strand a member whose claim changes mid-session.

- **The claim is also set on invite acceptance**, not by backfill alone. A brand-new member must not
  wait for a backfill that has already run.

- **Both arms of the OR are tested separately** — claim-present and claim-absent — plus the
  no-organization denial on both branches. A single combined test would pass while one arm is broken.
  This is success criterion 3 and it is the discipline CLAUDE.md demands after the deny-everyone
  incident.

### Backfill

> ### ★ POPULATION IS TWO USERS — owner, 2026-08-06
>
> Verbatim: *"I only have 2 active users in the current environment, so we don't have to worry about
> mass users for this. Just 2 and 1 outstanding invite that has never been accepted."*
>
> **This is the single most scope-reducing fact in the phase.** Plan against it:
>
> - **Do not engineer the backfill for scale.** No cursor document, no pagination, no batching, no
>   rate limiting, no resume-from-offset. A straight iteration over the members collection is
>   correct and complete at n=2. Building resumability here would be speculative complexity for a
>   set that fits on one screen.
> - **The 1000-byte claim limit is a non-issue at this population** — it stays a *design* constraint
>   on claim shape (still carry `orgIds[0]` only), but it is not a risk to mitigate or test against.
> - **The lockout blast radius is two accounts, one of them the owner's.** The dual-read `OR` and the
>   one-hour soak remain correct — they are about *correctness of the rollout mechanism*, not about
>   scale — but the consequence of a mistake is "two people re-authenticate," not an outage.
> - **The never-accepted invite is a live test case, not just trivia.** It exercises the
>   invite-acceptance claim path against real data: a member document that does not exist yet, whose
>   claim must be set at acceptance time rather than by the backfill. Use it. Also confirm the
>   backfill does not crash or mis-handle a pending invite that has no `members/{uid}` document.

- **Idempotency by skip-if-already-matching.** Re-runnable from the top. Cheap and obviously correct
  at this size; no cursor state that could itself go stale.

- **A Node script run with admin credentials, executed by the owner.** No deploy required, which
  matches the build-don't-deploy grant. Not a callable Cloud Function.

- **Reports processed / skipped / failed counts and lists every failure by uid.** At n=2 the owner
  should be able to read the entire output and know the exact state of every account.

### Claude's Discretion

- The Cloud Function's exact name and file placement within `functions/src/`.
- The backfill script's path and invocation ergonomics.
- Whether the claim-setting logic is shared between the trigger and the backfill as one module
  (preferred if it avoids two implementations that can drift) or duplicated deliberately.
- Test file organization within the existing `src/storage.rules.test.ts` versus a new file.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`requestPptxRender`** in `functions/src/` — the success criterion names it explicitly as the
  Firestore-trigger pattern to mirror. Read it before writing the claims trigger.
- **`@firebase/rules-unit-testing`** — already installed. `authenticatedContext(uid, tokenOptions)`
  is the mechanism that makes claim-based rules testable; this is the single most important API in
  the phase.
- **`src/storage.rules.test.ts`** — exists and currently fails. Its two allow-cases are the exact
  assertions this phase must turn green.
- **`src/stores/auth.ts::loadOrgContext`** — reads `orgIds`, picks `ids[0]`, and subscribes to the
  member document via `onSnapshot`. Both the claim source and the forced-refresh site.
- **Phase 39's `settings` merge** landed in this same function — read `39-02-SUMMARY.md` for what
  actually shipped before editing around it.

### Established Patterns

- Cloud Functions live in `functions/`, with their own test suite (`functions/` 70/70 at v1.4 close).
- Errors: `console.error('[moduleName] operation:', err)`; utilities return `null` rather than throw.
- `noUncheckedIndexedAccess: true` — `orgIds[0]` needs explicit narrowing.

### Integration Points

- `organizations/{orgId}/members/{uid}` — the trigger source.
- `storage.rules` — the dual-read consumer. **Modified but never deployed by this phase.**
- `firestore.rules` — **explicitly untouched.**

</code_context>

<specifics>
## Specific Ideas

- The owner's framing for why this phase is scoped as *make it testable*, not *make it work*: the
  production grant already fixed uploads, so the only thing this phase buys is closing the
  verification gap. If the phase ends without the two allow-cases actually passing against a real
  Storage emulator, it has not achieved its goal regardless of what else was built.
- CLAUDE.md's general lesson applies directly here: *"a test explained away as an environment quirk
  is an untested assertion."* This phase's entire purpose is to convert one such assertion into a
  running test.

</specifics>

<deferred>
## Deferred Ideas

- **Migrating `firestore.rules` to custom claims** — out of scope by requirement (R074) and recorded
  in REQUIREMENTS.md § Out of Scope.
- **True multi-org claim support** — the claim carries `orgIds[0]` only; multi-org users stay covered
  by the Firestore branch. Revisit if the app grows real multi-org switching.
- **Removing the Firestore-membership fallback** — that is the owner's SECOND deploy, after a
  one-hour soak. Not this phase, and not the first deploy either.

</deferred>
