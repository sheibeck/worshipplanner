# Project Research Summary

**Project:** Worship Planner — v1.9 Owner Admin Console
**Domain:** Owner-only super-admin console for a live Vue 3 + Firebase SaaS — Firestore-backed runtime config, custom-claim admin gate, admin UI, live cleanup-toggle safety
**Researched:** 2026-08-20
**Confidence:** HIGH

## Executive Summary

This milestone moves nine-plus operational knobs (four cleanup enable flags + retention windows, AI-proxy rate limits/model allow-list, messaging fan-out caps, the no-reply sender address) off `process.env`/deploy-gated config and into a super-admin-only Firestore doc editable from a new console, gated by a `superAdmin` custom claim built on the exact `orgMembershipClaims.ts` trigger-sync pattern this codebase already proved out in v1.5. All four research tracks (Stack, Features, Architecture, Pitfalls) converge on the same shape and, critically, on the same landmines: zero new npm dependencies are needed (plain Admin SDK + a module-scope TTL cache + the app's existing no-validation-library form style covers everything); the super-admin claim must be **merged**, never blind-replaced, into the existing `{orgId, role}` claims object via a new shared `mergeAndSetCustomClaims()` helper, because `syncOrgMembershipClaim`'s existing blind `setCustomUserClaims` write will otherwise silently wipe `superAdmin` off the owner's own token the next time their org membership doc is touched by ordinary product usage; and `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` structurally cannot become "live, no redeploy" because they are Cloud Functions v2 deploy-time settings evaluated at module load, not per-invocation values — this must be scoped as a documented exception, not silently promised or silently mishandled.

The recommended approach is a five-phase, dependency-ordered build: (A) super-admin claim + client/server gate + the claims-merge fix, shipped together so the hazard never exists unpatched even briefly; (B) the `appConfig` Firestore doc + `isSuperAdmin()`-gated rules (claim-only check, no cross-document `get()`, deliberately avoiding the exact "cross-service `firestore.exists()`" rules-fragility class that already caused a production deny-everyone incident on `storage.rules`); (C) mechanical, one-line-per-call-site swaps of every Cloud Functions config read from `process.env` to a cached `getAppConfig()`, with asymmetric caching (TTL for hot paths like the `api` proxy, always-fresh reads for the daily cleanup crons) and a per-knob fail-open/fail-closed default table so a missing/malformed doc is safe by construction; (D) the admin console UI itself, reusing every existing pattern in this app (Pinia `onSnapshot` store, plain-cast-and-guard form validation, Tailwind card layout — no new libraries); and (E) the dry-run blast-radius preview + confirm-to-flip flow, which is a hard requirement co-located with the deletion-toggle UI, not a follow-on polish pass, because a one-click enable removes the deploy-time friction that today gives the owner an implicit review step for free.

The dominant risk category, repeated across all four research files, is **conflating "move config off env vars" with "make everything uniformly live and uniformly cached."** Nine sub-risks fall out of this: (1) the claims-merge hazard above; (2) `*_MAX_INSTANCES` cannot go live; (3) a naive per-request config read inside the hot `api` proxy would multiply Firestore reads 1:1 with traffic, undoing the v1.8 cost-hardening work; (4) the inverse mistake — over-caching a destructive-enable flag so an emergency disable doesn't reach a warm cron instance in time; (5) a single global fail-open-or-fail-closed policy applied uniformly to a missing config doc will get at least one knob category backwards (deletion flags must fail closed, AI rate limits must fail open with capped fallback values); (6) type/validation drift once `process.env`'s forced-string-parsing discipline disappears; (7) a client-only route guard with no `firestore.rules`/function-side enforcement, mirroring a mistake class this app has already made once (the `storage.rules` incident); (8) the song-linked-background fail-safes living in the exact function body the config swap touches, at risk from an over-eager refactor; and (9) provider secrets (`RESEND_API_KEY`) leaking onto the client-readable `appConfig` surface if sender-config scope creeps toward credentials. Every one of these has a concrete, cheap prevention documented in PITFALLS.md and is mapped to a specific phase below.

## Key Findings

### Recommended Stack

No new runtime dependency is required anywhere in this milestone — `firebase-admin@^13.10.0`, `firebase-functions@^7.2.5`, and the client `firebase@^12.0.0` SDK already cover every capability needed (Firestore doc reads/writes, `setCustomUserClaims`, `getIdTokenResult`, `onSnapshot`). Config caching is a hand-rolled `{ value, fetchedAt }` module-scope object with a TTL check — a caching library (`node-cache`/`lru-cache`) is rejected as unnecessary complexity for caching exactly one document. Firebase Remote Config was considered and explicitly rejected as a second, architecturally inconsistent config surface. Form validation reuses the app's existing zero-library, plain-cast-and-guard pattern (`SettingsView.vue`) rather than introducing `zod`/`vee-validate`/`yup`.

**Core technologies:**
- `firebase-admin` (installed `^13.10.0`) — server-side Firestore reads + `setCustomUserClaims` — already the only Firestore/Auth touchpoint in Functions; do NOT bump to v14, no capability needed is v14-only
- `firebase-functions` (installed `^7.2.5`) — `onCall`/`onSchedule`/`onDocumentWritten` wrappers — reuse `onDocumentWritten` for an audit trail, NOT for cache invalidation (cannot reach sibling warm instances)
- `firebase` client SDK (installed `^12.0.0`) — `onSnapshot`/`updateDoc` for the admin console store — identical pattern to every other Pinia store in the app

### Expected Features

**Must have (table stakes):**
- Super-admin auth gate on a real custom claim (not a hardcoded UID check), enforced client AND server side
- A minimal admin shell distinct from `AppShell.vue`/existing "Admins" TeamView (naming collision — see Architecture)
- Typed config editor with inline min/max/required validation, client-side AND rules/function-side
- Effective-value display with a last-changed-by/at stamp (not a live staleness ticker — that's deferred)
- Dry-run blast-radius preview + confirm-to-flip flow specifically gating the four `*_CLEANUP_ENABLED` toggles — the milestone's hard requirement, not optional polish
- No-reply sender address field with format validation and a "must be Resend-verified" warning (domain verification itself is an out-of-band owner action in Resend/DNS, outside this console's reach — `*.web.app` is confirmed permanently unreachable)
- `updatedBy`/`updatedAt` on the config doc (cheap, do it while the save path is being built)

**Should have (differentiators, fold cheaply into P1 work):**
- Confirm-to-flip modal echoing the real dry-run count before a destructive toggle commits
- Who-changed-what stamp per section (the `updatedBy`/`updatedAt` fields above, surfaced in the UI)

**Defer (v2+):**
- Billing/plan management UI, church/org provisioning from the console (no data model exists yet)
- Multi-admin grant/revoke UI (bootstrap-script-only for now; a UI managing a set of 1-2 people is ceremony)
- In-app `aiUsage`/dry-run-log dashboards and charts (the single dry-run count is the only "usage visibility" this pass needs)
- Per-org override of global config knobs (single/few-org app today; note the extension point, don't build it)
- Full audit-log collection + browsing UI, live staleness ticker, real-time collaborative editing (all explicitly rejected as scope creep for a 1-2-admin console)

### Architecture Approach

The system is additive plumbing layered onto proven idioms, not a restructuring: a new `superAdmins/{uid}` collection (existence = granted) mirrors `organizations/{orgId}/members/{uid}`; a new `syncSuperAdminClaim` trigger mirrors `syncOrgMembershipClaim`; a new top-level `appConfig/global` singleton doc mirrors where `aiUsage`/`aiRateLimits` already live; a new `isSuperAdmin()` rules helper mirrors `isOrgEditor()` but reads the token claim directly (no `get()`/`exists()` cross-document call, deliberately cheaper and safer than the org-membership pattern). Per-org RBAC, the messaging pipeline, and the PPTX render pipeline are untouched.

**Major components:**
1. `functions/src/claimsHelpers.ts` (new) — `mergeAndSetCustomClaims(uid, patch)`, the single load-bearing fix shared by both claim writers
2. `functions/src/superAdminClaims.ts` (new) + `orgMembershipClaims.ts` (modified) — both route through the merge helper; `superAdmins/{uid}` collection is the source of truth
3. `functions/src/appConfig.ts` (new) — `AppConfig` type, `DEFAULT_APP_CONFIG` (identical numbers to today's env fallbacks, deep-merged so an empty doc reproduces current behavior byte-for-byte), `getAppConfig(db)` with per-instance TTL cache
4. `functions/src/index.ts` (modified, mechanical) — every v1.8 knob read-site swapped to `getAppConfig()`; `previewCleanupDryRun` (new `onCall`) forces `dryRun = true` unconditionally, reusing the already-exported handler bodies
5. `src/stores/auth.ts`, `src/router/index.ts`, `src/components/AppSidebar.vue` (modified) — `isSuperAdmin` ref off the existing `getIdTokenResult` call, `requiresSuperAdmin` route guard, a distinctly-named nav entry (`/owner-console`, NOT `/admins` — that's taken by `TeamView.vue`)
6. `src/stores/admin.ts` + `src/views/AdminView.vue`/`OwnerConsoleView.vue` + `src/components/admin/*` (new) — console shell, config panels, sender form, dry-run preview modal, roster manager
7. `firestore.rules` (modified) — `isSuperAdmin()` helper + `appConfig/*` + `superAdmins/*` match blocks, claim-only, no cross-document lookup

### Critical Pitfalls

1. **Claim replacement, not merge** — `setCustomUserClaims` overwrites the whole claims object; `syncOrgMembershipClaim`'s existing blind write will silently strip `superAdmin` the next time any org membership doc is touched. Fix: a shared `mergeAndSetCustomClaims()` helper, used by BOTH the new grant path and the modified `syncOrgMembershipClaimHandler`, shipped in the same phase as the claim itself — not later hardening.
2. **`*_MAX_INSTANCES` cannot go live** — `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` are Cloud Functions v2 deploy-time settings evaluated once at module load, before any Firestore read is possible. Scope them explicitly as staying `process.env`-based, surfaced read-only in the console if shown at all, labeled "requires redeploy" — never silently promised as live.
3. **A live enable-toggle removes the deploy-time review step for free** — flipping `BACKGROUND_CLEANUP_ENABLED` today requires an env edit + redeploy, a deliberate friction point. The admin UI must never expose a bare toggle: require an on-demand dry-run preview showing the real count, a confirm step echoing that count, and never trigger an immediate delete as a toggle side effect (only the next *scheduled* run acts).
4. **Asymmetric caching by knob criticality** — TTL cache (30-60s) for hot paths (`api` proxy, `sendQueuedMessage`); NO cache, fresh read every invocation, for the four daily cleanup crons and `sendScheduledReminders`, so an emergency disable takes effect on the very next run. A single uniform caching policy gets this backwards in one direction or the other.
5. **Fail-open vs fail-closed is per-knob, not global** — a missing/malformed `appConfig` doc must default cleanup flags to OFF/dry-run (fail-closed), AI rate limits to capped fallback values (fail-open on the read, still bounded on spend), and the AI model allow-list to the existing restrictive default — never "allow all models." A single blanket try/catch returning one kind of default (all-permissive or all-restrictive) gets at least one category wrong.

## Implications for Roadmap

Based on research, suggested phase structure — all four research tracks independently converged on this same five-phase, dependency ordering:

### Phase A: Super-admin claim, client/server gate, and the claims-merge fix
**Rationale:** Foundation for every other phase — the console is meaningless as a security boundary without this, and the merge-hazard fix must exist before the `superAdmin` claim type exists even one phase without it, since ordinary org-membership writes happen constantly in production.
**Delivers:** `claimsHelpers.ts` (`mergeAndSetCustomClaims`), `superAdminClaims.ts` (decide/sync/onCall), `orgMembershipClaims.ts` modified to route through the merge helper, a one-off owner-run bootstrap script for the first super-admin (chicken-and-egg — mirrors `backfillOrgClaims.ts`), `auth.ts`/router/nav wiring (route can be a placeholder — proves the gate end-to-end early).
**Addresses:** Admin auth gate (table stakes), server-enforced route (table stakes).
**Avoids:** Pitfall 1 (claim replacement), Pitfall 8 (client-only gate), Pitfall 9 (token refresh gap on grant/revoke — force-refresh via a listened claims-changed signal, `revokeRefreshTokens` + `checkRevoked: true` on revocation), Pitfall 10 (bootstrap chicken-and-egg), Pitfall 11 (claim-only rules check, never a cross-document Firestore lookup — avoids repeating the `storage.rules` deny-everyone incident class).

### Phase B: `appConfig` config doc + Firestore rules
**Rationale:** Must land before the console (Phase D) is given direct client-SDK read/write access; independently buildable/testable once Phase A exists (claim to gate against).
**Delivers:** `appConfig.ts` (type, `DEFAULT_APP_CONFIG` matching today's exact env fallback numbers, deep-merge reader), `firestore.rules` additions (`isSuperAdmin()` + `appConfig/*` + `superAdmins/*`), genuine ALLOW-case emulator tests in `rules.test.ts` (not just DENY cases — per CLAUDE.md's own documented incident).
**Implements:** Architecture components 3 and 7 above.
**Uses:** Plain Admin SDK, no new library (Stack).

### Phase C: Cloud Functions read config (mechanical swap)
**Rationale:** Each swap is a no-behavior-change deploy while `appConfig/global` is empty (defaults-merge guarantee), so this can ship ahead of the UI; the console (Phase D) should land after this so a UI-flipped toggle has an observable effect during UAT.
**Delivers:** All nine-plus knob read-sites swapped from `process.env` to cached `getAppConfig()` reads — cleanup handlers' four enable/retention/cap reads, AI proxy limits, messaging caps, no-reply sender address. `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` explicitly EXCLUDED and documented as staying env-var-based.
**Addresses:** "Show effective value" table-stake feasibility (caching choice determines it).
**Avoids:** Pitfall 2 (song-linked-background fail-safes — one-line swap only, existing unit tests must pass UNCHANGED), Pitfall 3 (uncached hot-path reads undoing v1.8 cost work), Pitfall 4 (stale warm-instance cache on emergency disable), Pitfall 5 (per-knob fail-open/fail-closed table), Pitfall 6 (`maxInstances` exception, resolved as a scoping decision here, not discovered mid-implementation), Pitfall 7 (type/validation drift — schema validation on every read, typed the way `readNumericKnob`'s zero-vs-falsy fix already handles).

### Phase D: Admin console UI
**Rationale:** Depends on A (gated route) and B (rules permitting direct reads/writes); best sequenced after C so toggles have observable effect, though technically buildable in parallel with C.
**Delivers:** `stores/admin.ts` (Pinia, `onSnapshot`), `AdminView.vue`/`OwnerConsoleView.vue` shell + per-knob-group panels, super-admin roster management UI (`setSuperAdminClaim` onCall).
**Addresses:** Minimal admin shell, typed config editor, effective-value display, no-reply sender field (table stakes).
**Avoids:** Pitfall 12 (secret leak — sender-config fields stay address/display-name only, never credentials).

### Phase E: Deletion-toggle safety (dry-run preview + confirm-to-flip)
**Rationale:** Depends on C (handlers must already be config-driven so preview and live toggle share one source of truth) and D (console shell to host the modal). Ships in the SAME phase as the cleanup toggles reaching the UI — never a later hardening pass, since the unsafe version is a fully functional-looking MVP.
**Delivers:** `previewCleanupDryRun` onCall (dry-run forced true, independent of live config), UI confirm-then-preview flow gating any `*_CLEANUP_ENABLED` flip.
**Addresses:** Dry-run blast-radius preview, confirm-to-flip flow (differentiators treated as hard requirements here).
**Avoids:** Pitfall 1 (live toggle deleting before review) and Anti-Pattern 3 from Architecture (preview accidentally deleting for real — `dryRun` must never derive from the live config value).

**No-reply sender** is delivered inside C (functions side) + D (console form) — it does not need its own phase.

### Phase Ordering Rationale

- Dependency chain is strict and linear: claim/gate → config doc/rules → functions read config → UI → deletion safety. Every research file independently arrived at this exact order.
- The claims-merge fix (Pitfall 1) is the single highest-priority correctness item — it must not exist unpatched for even one phase, so it is bundled into Phase A rather than treated as a separate hardening phase.
- Cross-cutting process disciplines (every rules/functions/secrets deploy is owner-run, not autonomous; `.env.local`/`functions/.env` must be present in any worktree before local testing) apply to every phase, not one — call these out in each phase's plan/verification checklist rather than as a standalone phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase A:** the token-refresh-on-grant/revoke mechanics (`revokeRefreshTokens` + `checkRevoked: true`) are MEDIUM-confidence general Firebase platform behavior, not yet exercised in this codebase the way claim-sync itself has been — worth a research pass or at least explicit UAT design before planning.
- **Phase C:** the per-knob fail-open/fail-closed default table (Pitfall 5) and the differentiated-caching design (TTL vs. always-fresh, Pitfall 3/4) are both named as required PLAN.md-level design decisions, not implementation details — treat as needing explicit design documentation during `/gsd-plan-phase`, even if not full external research.

Phases with standard patterns (skip research-phase):
- **Phase B:** directly mirrors the existing `aiUsage`/`aiRateLimits` top-level-collection + claim-based-rule precedent already proven in this codebase.
- **Phase D:** directly mirrors `SettingsView.vue`'s existing form/save/validation pattern and `auth.ts`'s existing `onSnapshot`-in-a-Pinia-store pattern; no new UI library or pattern needed.
- **Phase E:** the dry-run code path already exists in all four v1.8 cleanup handlers; this phase exposes it on-demand, it doesn't invent new logic.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every recommendation verified directly against this repo's installed package manifests and source, cross-checked against live npm registry queries this session |
| Features | MEDIUM (HIGH for codebase-grounded complexity/dependency claims) | Table-stakes/differentiator framing is well-grounded in PROJECT.md/SEED-001; general admin-UX comparables (kill-switch confirmation conventions) are LOW-confidence aggregated blog consensus, used only as corroboration |
| Architecture | HIGH for codebase-derived findings; MEDIUM for general Firebase best-practice patterns | Component/rules/build-order recommendations read directly from `functions/src/index.ts`, `orgMembershipClaims.ts`, `firestore.rules`, `storage.rules`, `router/index.ts`; caching-across-instances reasoning corroborated by official Firebase docs |
| Pitfalls | HIGH | Grounded directly in this repo's existing code and its own documented incident history (the `storage.rules` deny-everyone bug in CLAUDE.md); only token-revocation semantics are MEDIUM (general platform knowledge, not yet repo-proven) |

**Overall confidence:** HIGH

### Gaps to Address

- **`*_MAX_INSTANCES` console treatment:** whether to surface these read-only in the console at all, or omit them entirely — needs an explicit requirements-stage decision, not left to phase-planning discretion.
- **Storage retention/versioning as a safety net:** whether Cloud Storage Object Versioning or bucket-level retention is enabled before live deletion toggles ship — an owner-side infrastructure check, not something this milestone's code can verify or enforce; flag for the owner explicitly before Phase E's toggles go live in production.
- **`superAdmin` claim survival on last-org-membership removal:** `syncOrgMembershipClaimHandler`'s clear-path (`setCustomUserClaims(uid, null)` today) needs an explicit decision — recommended: preserve `superAdmin` when a user's last org membership is removed, since a super-admin isn't required to belong to any org to administer the app. Resolve this as part of Phase A's design, not left implicit.
- **Bootstrap script scope:** confirmed as the right shape (mirrors `backfillOrgClaims.ts`, dry-run-by-default, `--apply`-gated, owner-run-once) — no open question, but worth restating in Phase A's plan as an explicit owner-handoff step, not an autonomously-run script.

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: `functions/package.json`, `package.json`, `functions/src/index.ts`, `functions/src/orgMembershipClaims.ts`, `functions/src/backfillOrgClaims.ts`, `src/stores/auth.ts`, `firestore.rules`, `storage.rules`, `src/router/index.ts`, `src/components/AppSidebar.vue`, `src/views/SettingsView.vue`, `.planning/PROJECT.md`, `.planning/seeds/SEED-001-admin-settings-interface.md`, `CLAUDE.md` (this repo's own incident record)
- `npm view <pkg> version` live registry queries (2026-08-20): `firebase-admin`, `firebase-functions`, `firebase`, `resend`, `zod`, `node-cache`, `lru-cache`, `firebase-functions-test`
- [Tips & tricks — Cloud Functions for Firebase](https://firebase.google.com/docs/functions/tips) — global-scope caching, `onInit()`
- [Extend Cloud Firestore with Cloud Functions (2nd gen)](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen) — gen2 trigger shape
- [Control Access with Custom Claims and Security Rules | Firebase Authentication](https://firebase.google.com/docs/auth/admin/custom-claims) — 1000-byte claims limit, refresh behavior
- `.planning/milestones/v1.5-phases/40-custom-auth-claim-for-org-membership/40-RESEARCH.md` — prior in-repo verified research on `setCustomUserClaims`

### Secondary (MEDIUM confidence)
- [Resend — Verified Domains](https://resend.com/docs/dashboard/domains/introduction) — corroborates existing codebase comment on DNS/domain verification requirements
- [Firebase Remote Config](https://firebase.google.com/docs/remote-config) — reviewed to support the explicit reject-and-explain decision against it
- General Cloud Functions v2 instance warm-reuse / cold-start / module-load timing and `revokeRefreshTokens`/`checkRevoked` semantics (community sources, corroborating official docs)

### Tertiary (LOW confidence)
- General feature-flag/kill-switch UX guidance (Harness, LaunchDarkly, Unleash, Flagsmith blogs) — used only for general "confirm destructive toggles, log who/when" pattern, which this project's own dry-run-preview requirement already exceeds

---
*Research completed: 2026-08-20*
*Ready for roadmap: yes*
