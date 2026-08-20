# Deploying the Firestore runtime-config swap (Phase 69)

> ★★ **NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE.** Phase 69 was built under the
> v1.9 standing autonomy grant (`.planning/STATE.md`): *"Deploy policy — HAND OVER all deploys
> this milestone (default) ... Every deployable artifact ships built + tested + UNDEPLOYED with
> the exact `firebase deploy --only …` command handed over."* Every artifact this phase produced —
> `functions/src/appConfig.ts` (Plan 01) and the `functions/src/index.ts` config-source swap
> (Plan 02) — ships **built, tested, and undeployed**. Reaching this handed-over state IS the
> phase goal; running the deploy command below is explicitly out of scope for the phase that wrote
> this file.

This file lives next to `functions/src/appConfig.ts` and `functions/src/index.ts` — it is not a
note buried in a plan SUMMARY, following the same placement precedent as
`functions/DEPLOY-SUPER-ADMIN.md` (the Phase 68 super-admin runbook) and
`functions/DEPLOY-ORG-CLAIMS.md` (the v1.5 org-claims runbook).

This file does **not** instruct writing to `.env.local` or `functions/.env` — nothing in this
phase needs a new secret or environment variable.

---

## What is being rolled out

Phase 69 moved every managed cost/cleanup/messaging knob out of `process.env` and into one
admin-only Firestore doc, `appConfig/global`, read at runtime via a new `getAppConfig()` helper
(`functions/src/appConfig.ts`). The following **7 managed functions** in
`functions/src/index.ts` have their runtime behavior swapped from a `process.env` read to a
`getAppConfig()` read:

- `api` — the AI proxy (rate limits, allowed-model list, max-token ceiling), cached read
- `cleanupExpiredMedia` — media retention window + enable flag + shared delete cap, fresh read
- `cleanupOrphanRenders` — orphan-render staleness window + enable flag + shared delete cap, fresh read
- `cleanupOrphanBackgrounds` — background retention window + enable flag + shared delete cap, fresh read (the `referencesComplete`/floor-guard fail-safes are byte-unchanged — only the enable-flag and retention/cap value sources moved)
- `cleanupPptxSources` — pptx-source retention window + enable flag + shared delete cap, fresh read
- `sendScheduledReminders` — the messaging cron gate (`messaging.scheduledCronEnabled`) + reminder dispatch, fresh read
- `sendQueuedMessage` — recipient cap, org daily email quota, and the sender From address (`sender.fromAddress`, replacing the removed `MESSAGE_FROM_ADDRESS` `defineString`), cached read

All 7 functions live in the SAME `functions/src/index.ts` build, so a single scoped deploy command
(below) redeploys all 7 together.

---

## Why it is safe to deploy now

While `appConfig/global` is absent or empty, `getAppConfig()` deep-merges onto
`DEFAULT_APP_CONFIG` — the exact current `process.env` fallback values captured in Plan 01. This
reproduces today's behavior **byte-for-byte** (R182), so this deploy is a **no-op behavior
change** until a value is actually written to `appConfig/global` — either by the owner directly in
the Firebase Console, or by the Phase 70 admin console UI once it ships.

Because it is behavior-neutral, this deploy **can and should be run alongside the Phase 68
functions** (`syncSuperAdminClaim` / `setSuperAdminClaim`, see `functions/DEPLOY-SUPER-ADMIN.md`)
in the same session — there is no ordering dependency between the two deploys themselves. There
IS a dependency worth noting: the Phase 68 `firestore.rules` change (the `isSuperAdmin()` gate on
`match /appConfig/{docId}`) should be deployed first or together, since without it no one —
including a genuine owner — can write to `appConfig/global` at all. If Phase 68's rules are
already live, nothing further is needed here.

---

## Pre-flight

Before running the deploy command below:

1. **Functions suite green:**
   ```bash
   cd functions && npm test
   ```
   Expect all suites green, including `appConfig.test.ts` and the updated `index.test.ts`.
2. **Functions build clean** (the functions-standalone `tsc` build; the root `vue-tsc --build`
   does NOT cover `functions/` — see CLAUDE.md):
   ```bash
   cd functions && npm run build
   ```
3. **Root type-check clean:**
   ```bash
   npm run type-check
   ```
4. **Confirm the active project.** Run `firebase use` to see the active alias/project; this
   repo's `.firebaserc` default is `worship-planner-bc515`. If in doubt, run
   `firebase use worship-planner-bc515` explicitly before the deploy command below.

Do not proceed unless all three checks are green.

---

## The deploy command

Scoped to the 7 managed functions whose runtime behavior changed this phase:

```bash
firebase deploy --only functions:api,functions:cleanupExpiredMedia,functions:cleanupOrphanRenders,functions:cleanupOrphanBackgrounds,functions:cleanupPptxSources,functions:sendScheduledReminders,functions:sendQueuedMessage --project worship-planner-bc515
```

A full `firebase deploy --only functions` deploys the same shared `index.ts` build and is
functionally equivalent (it also redeploys every other Function in the file, changed or not) — the
scoped list above documents exactly which functions' *runtime behavior* changed this phase, so a
future reader of the Functions console log knows what to expect.

### What to observe

The Firebase Console's **Functions** list shows all 7 functions above redeployed with a fresh
timestamp. Behavior is unchanged immediately after — no value has been written to
`appConfig/global` yet, so every knob keeps resolving to its `DEFAULT_APP_CONFIG` value.

### Rollback

```bash
git checkout -- functions/src/index.ts
cd functions && npm run build
firebase deploy --only functions:api,functions:cleanupExpiredMedia,functions:cleanupOrphanRenders,functions:cleanupOrphanBackgrounds,functions:cleanupPptxSources,functions:sendScheduledReminders,functions:sendQueuedMessage --project worship-planner-bc515
```

Harmless to redeploy the prior build: an empty/absent `appConfig/global` already reproduces
today's behavior on either side of this deploy, so rolling back cannot strand any in-flight state.

---

## Explicit constraints (v1.9 grant)

- This file does **not** instruct writing to `.env.local` or `functions/.env` — no new secret or
  environment variable is needed for this deploy.
- **`RESEND_API_KEY` stays a functions server secret.** It is never written to, or read from,
  `appConfig/global` — that document is client-readable by super-admins (per the Phase 68 rules)
  and only ever carries the non-secret `sender.fromName` / `sender.fromAddress` fields. The key
  itself continues to be bound only to `sendQueuedMessage` via `secrets: [RESEND_API_KEY]`,
  unchanged by this phase.
- **`AI_PROXY_MAX_INSTANCES` / `GLOBAL_MAX_INSTANCES` / the render-service `maxInstances` caps are
  UNCHANGED and still deploy-time.** These are Cloud Functions v2 settings read at module load
  (R185) — they were deliberately excluded from `appConfig/global` because they cannot be live
  config. Changing them still requires editing the env value and redeploying; this phase's swap
  does not touch them.

---

## Deferred manual verification (owner, via `/gsd-verify-work 69`)

These items require the functions above actually **deployed** plus a real `appConfig/global`
write to observe, so they cannot be proven by any unit test against a mocked module. They are
recorded in the phase's `.planning/phases/69-firestore-runtime-config/69-VALIDATION.md`
Manual-Only table and are **not** run by this file or any automated gate in this phase:

- **R181 — a live config change takes effect with no redeploy.** After deploying the 7 functions
  above, write a value to `appConfig/global` (e.g. lower `aiProxy.rateLimitPerMin`, or flip
  `cleanup.mediaEnabled`) and confirm a hot path (the `api` proxy) reflects it, and confirm a cron
  path (the next scheduled cleanup/reminder run) reflects it — both with no redeploy in between.
- **R183 — real cross-instance TTL staleness window on a hot path.** Confirm the ~60s TTL cache
  behavior against real warm Cloud Functions instances (the cached-vs-fresh routing itself is
  unit-proven; only the real-world cross-instance timing is deploy-dependent).

See `.planning/phases/69-firestore-runtime-config/69-VALIDATION.md`'s Manual-Only table for the
full detail on both items.

---

## If something goes wrong

The fastest recovery at any point is the Rollback command above — redeploying the prior
`index.ts` build is safe precisely because an empty/absent `appConfig/global` reproduces today's
exact behavior on either side of the deploy (the R182 defaults-merge guarantee). No Firestore
rule or client code changed this phase, so nothing else needs to be reverted alongside the
functions themselves.
