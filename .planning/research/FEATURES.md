# Feature Research

**Domain:** Owner-only super-admin console for a small live Vue 3 + Firebase SaaS (first admin surface)
**Researched:** 2026-08-20
**Confidence:** MEDIUM (codebase-grounded HIGH for complexity/dependency claims; general admin-UX claims MEDIUM/LOW per source tier — see Sources)

## Feature Landscape

### Table Stakes (Users Expect These)

A first admin console for a solo/small-team-owned SaaS is expected to have these five things. Skipping any of them makes the console feel unsafe to use, not just unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Admin auth gate on a real claim, not a hardcoded UID/email check | A hardcoded `if (uid === OWNER_UID)` is the obvious shortcut and the obvious footgun — it doesn't scale to "anyone the owner grants" and it's easy to leave stale. The project already has a proven pattern: v1.5 Phase 40 built `orgMembershipClaims.ts`, a Firestore-trigger-synced custom claim (`{orgId, role}`) read by both `storage.rules` and the client. A `superAdmin: true` (or `role: 'superadmin'`) claim is the same shape, one level up. | MEDIUM | **Dependency:** builds directly on v1.5's custom-claims machinery — same `setCustomUserClaims` mechanics, same "claims cache until ID-token refresh" gotcha (`getIdToken(true)` needed after grant, or the newly-granted admin still can't get in until their token naturally refreshes in ~1hr). **Constraint:** Firebase caps custom claims at 1000 bytes total — trivial to stay under with one boolean, but note if org claim + admin claim ever merge into one object. **Bootstrap problem:** the very first super-admin (the owner) can't be granted via an admin UI that doesn't exist yet — needs a one-time Admin-SDK script or Firebase Console manual claim set, same as any first-superuser bootstrap. |
| Admin route/nav gated client-side AND enforced server-side | The console is only "private" if both the Vue router guard *and* every Cloud Function/Firestore rule it talks to reject non-admins. Client-only gating is security theater — anyone can navigate to the URL by guessing it if the underlying reads/writes aren't locked down. | MEDIUM | **Dependency:** Firestore rules for the new admin-config doc(s) must check `request.auth.token.superAdmin == true` (or equivalent), mirroring the existing `isOrgMemberByClaim` pattern in `storage.rules`. The functions that *read* the config (cleanup crons, AI proxy, message sender) do not need the claim — they run with Admin SDK privileges — but any Cloud Function *endpoint* that lets the admin console *write* config needs the same claim check the rules do. |
| A minimal admin shell/nav, separate from `AppShell.vue` (the per-org shell) | Reusing the org shell (with its org switcher, org-scoped nav) would visually and conceptually conflate "my church's settings" with "the whole app's cost knobs" — a mistake this milestone explicitly wants to avoid (SEED-001: "distinct from the existing per-org editor/viewer RBAC"). A first-pass shell can be a single page or a small set of collapsible sections; it does not need multi-page nav yet. | LOW | No new UI kit needed — reuse existing Tailwind card/section patterns already proven in `SettingsView.vue` (bordered `bg-gray-900` cards, label+input blocks, Save button with Saving/Saved states). |
| A typed settings/config editor with inline validation (min/max, required, numeric-only) | Every knob in scope has a real invalid range (e.g. negative retention days, a rate limit of 0 that silently breaks AI features, a recipient cap above what Resend/the org plan can sustain). Client-side validation before write prevents an admin from bricking a live cron with a typo — this is the single highest-leverage thing to get right for a config panel whose values feed unattended background jobs. | MEDIUM | **Dependency:** none new — same "controlled input + validation + disabled Save until valid" shape already in `SettingsView.vue`'s slug field. **Note:** validation must exist BOTH client-side (UX) and Firestore-rules/function-side (defense — a config doc write from anywhere else, or a rules bug, shouldn't be able to set `AI_MAX_TOKENS_CEILING: -1`). |
| Showing the **currently effective value**, not just the last-saved input | If the config doc read is cached in the Cloud Functions runtime (SEED-001 explicitly flags "the read must be safe/cached"), there is a real gap between "what's in Firestore" and "what the running function is actually using right now" until the cache expires or a cold start happens. An admin who just flipped a toggle and doesn't see it take effect immediately will assume the console is broken. | MEDIUM | **This is the one non-obvious table-stake.** At minimum: label the field with a "last changed / by whom / at what time" stamp so the admin can tell their write succeeded, even if propagation to a warm function instance takes up to the cache TTL. Consider surfacing the cache TTL itself ("changes apply within ~N minutes") rather than promising instant effect, since Cloud Functions v2 instances are long-lived and a per-invocation Firestore read on every cold path is a cost regression the whole v1.8 milestone was built to avoid. |
| Basic save confirmation + error surfacing | Matches existing app-wide pattern (`isSaving` / `savedFeedback` / `saveError` triad in `SettingsView.vue`). Not optional — a config write that silently fails leaves the admin believing a dangerous toggle changed when it didn't. | LOW | Direct reuse of the existing pattern; no new design needed. |

### Differentiators (Value-Add for THIS Console, Not Required for v1)

These separate "a config editor that happens to be gated" from a console that actually earns trust for its most dangerous job: enabling real deletion.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dry-run blast-radius preview gating each `*_CLEANUP_ENABLED` toggle | This is not optional per PROJECT.md's hard constraint ("show the dry-run blast-radius count BEFORE a cleanup toggle is flipped") — it's the whole reason this milestone exists over just moving env vars to Firestore. Framed as a differentiator here only because it's *more* than table-stakes config-editing: it requires calling into the existing dry-run cleanup logic on demand (not waiting for the next scheduled cron run) and showing a real count before the toggle commits. | MEDIUM–HIGH | **Dependency:** the four v1.8 cleanup functions (`cleanupMedia`, `cleanupOrphanRenders`, `cleanupOrphanBackgrounds`, `cleanupPptxSources`) already compute a dry-run count as their normal code path (`dryRun = process.env.X_CLEANUP_ENABLED !== "true"`) — the "preview" feature is calling that same code on-demand from an admin action rather than only from the schedule, and returning the count to the UI before commit. **Complexity driver:** this needs a new callable Cloud Function (admin-gated) that runs the dry-run pass synchronously and returns a count — cleanup sweeps can touch thousands of Storage objects, so it must be bounded/paginated or time-box itself to avoid a slow admin-console click turning into a long-running function call. Simplest safe v1: reuse `STORAGE_CLEANUP_MAX_DELETES_PER_RUN` as the same cap on the preview call. |
| Confirm-to-flip flow (typed confirmation or a second explicit step) for switching a cleanup toggle from OFF→ON | General admin/kill-switch UX precedent (e.g., platforms that require typing "KILL" or the resource name before a destructive change lands) exists specifically because a single-click toggle is too easy to flip by accident, and the consequence here is **permanent data deletion**. | LOW–MEDIUM | Pure client-side UX addition on top of the toggle + preview count already required above — a "type CONFIRM" or "click again to confirm" modal that shows the dry-run count inline. No new backend surface beyond what the preview feature already needs. |
| Who-changed-what audit trail on the config doc | Not asked for explicitly in PROJECT.md, but it's the natural companion to "any admin the owner grants can flip these" — once it's not just the owner, "who turned off cleanup last Tuesday" becomes a real question. Cheap to add now (Firestore's own `updatedBy`/`updatedAt` fields on write), expensive to retrofit later once multiple people have write access with no history. | LOW | **Cheapest form (recommended for v1):** store `updatedBy: uid`, `updatedByEmail`, `updatedAt: serverTimestamp()` on the single config doc itself, shown as a "last changed by X at Y" line per section — NOT a separate audit-log collection/UI (that's the deferred differentiator below). This is a field, not a feature. |
| Effective-value staleness indicator (surfacing the read-cache TTL/last-refresh time server-side) | Goes one step beyond the table-stakes "show effective value" — actually querying or exposing when the Cloud Functions runtime last re-read the config doc, so the admin has ground truth instead of a promise. | MEDIUM | Only worth it if the caching mechanism chosen (in-memory TTL cache vs. Firestore `onSnapshot` listener kept warm in the function's global scope) makes this cheap to expose. If config is read via a live `onSnapshot` listener at module scope (propagates in seconds, no polling delay), this differentiator collapses to near-zero value — decide caching strategy first, this second. |

### Anti-Features (Deliberately Deferred — Do NOT Build This Pass)

PROJECT.md and SEED-001 both explicitly scope this milestone thin. These look like natural next steps from inside an admin console, which is exactly why they're worth naming and explicitly deferring rather than silently scope-creeping in.

| Feature | Why It's Tempting Here | Why Defer | What To Do Instead (this pass) |
|---------|------------------------|-----------|---------------------------------|
| Billing / plan management UI | "Owner admin console" naturally suggests billing next. | PROJECT.md states billing is explicitly out of scope this pass — no billing provider is even chosen yet (no Stripe integration exists in the codebase). Building UI for it now means designing against a data model that doesn't exist. | Note it as the console's "next tenant" in the shell (e.g., a disabled/placeholder nav item), nothing functional. |
| Church/org provisioning from the admin console (create org, assign owner, etc.) | The admin console is the obvious place a future "grant a church access" flow would live. | Also explicitly out of scope. Org creation today happens via the existing signup flow; building an admin-driven provisioning UI duplicates that path and adds another way orgs can be created inconsistently. | None — leave org creation exactly as it works today. |
| Multi-admin management UI (list/add/remove super-admins from the console itself) | "Owner + anyone the owner grants" implies a UI to grant/revoke. | Real, but the FIRST admin can't be created by a UI that requires being an admin to reach (bootstrap problem) — and a management UI for a set that's realistically 1-2 people this pass is disproportionate. A UI that manages a list of exactly one person is not a UI, it's ceremony. | Grant additional super-admins via a one-time Admin-SDK script or Firebase Console custom-claim edit (same mechanism the FIRST admin needs anyway). Document the script; skip the UI. |
| In-app `aiUsage` ledger / dry-run-log dashboards (charts, historical trends) | v1.8 already produces this data (`aiUsage` ledger via Admin SDK, dry-run cleanup logs) — a dashboard feels like "just add a chart." | Explicitly named as deferred in both PROJECT.md ("R169 in-app usage visibility" deferred) and SEED-001. Charting/aggregation is real work (query design, pagination, possibly a scheduled rollup) that has nothing to do with THIS milestone's job of moving config off env vars. | The dry-run-count-before-toggle preview (in Differentiators above) is the only "usage visibility" this pass needs — it's a single number, not a dashboard. Leave `aiUsage` queryable only via Firestore Console / a follow-up milestone. |
| Per-org override of the cleanup/AI/messaging knobs (vs. one global config doc) | SEED-001 raises this as an open design question ("Global vs per-org... relevant once there's more than one org"). | The app currently has effectively one production org in active use; building per-org override plumbing (doc-per-org + fallback-to-global resolution logic) roughly doubles the read/write surface for a capability nobody needs yet. | One global `appConfig`/`platformConfig` doc, explicitly. Note the per-org path as a documented future extension point (e.g., resolution function takes an optional `orgId` param today, even if unused), not built. |
| A generic audit-log collection + browsing UI (full change history, filters, pagination) | Natural companion to "who changed what," and looks like a small step up from the recommended `updatedBy`/`updatedAt` fields. | A queryable history collection + a UI to browse/filter it is a second feature (storage design, retention policy, its own UI) layered on top of config editing. The `updatedBy`/`updatedAt`-on-the-doc approach (Differentiators, above) answers "who changed it last" — the only question this milestone's scope actually requires an answer to. | `updatedBy`/`updatedAt` fields only. If a full history becomes necessary later, Firestore's document write history isn't natively queryable anyway — that's a real design task for its own phase. |
| Real-time collaborative editing of the config doc (multiple admins editing simultaneously with live conflict resolution) | Firestore's real-time nature makes this feel "free." | PROJECT.md already rejects real-time collaborative editing as an anti-feature for the whole app ("planners take turns, not simultaneous editing") — same logic applies here, doubly so since there's realistically one admin active at a time. | Last-write-wins is fine. If it becomes a problem with 2 admins, `updatedAt` on the doc lets the second saver see they're overwriting a change made after they loaded the page (simple staleness check), which is a one-line addition, not a feature. |

## Feature Dependencies

```
v1.5 custom-claims machinery (orgMembershipClaims.ts pattern)
    └──requires──> Super-admin custom claim + gate (admin auth)
                       └──requires──> Admin shell/nav (route guard needs a claim to check)
                                          └──requires──> Config editor UI (needs somewhere to live)

v1.8 cleanup functions' existing dry-run code path
    └──requires──> Dry-run blast-radius preview (on-demand callable)
                       └──requires──> Confirm-to-flip destructive toggle flow
                                          └──enhances──> Config editor UI (specifically the 4 CLEANUP_ENABLED fields)

Firestore-backed runtime config doc + caching strategy
    └──requires──> ALL Cloud Functions config reads refactored off process.env
    └──enhances──> "Show effective value" table-stake (caching choice determines feasibility of live staleness indicator)
    └──conflicts──> AI_PROXY_MAX_INSTANCES / GLOBAL_MAX_INSTANCES specifically (see Dependency Notes — these two do NOT
                     become live-without-redeploy under Cloud Functions v2's architecture)

Config editor UI
    └──enhances──> updatedBy/updatedAt fields (cheap addition once a save path exists)

[Deferred: multi-admin management UI] ──requires──> [Deferred: billing UI, church provisioning]
    (all three explicitly out of scope this pass — no dependency work needed now)
```

### Dependency Notes

- **Admin auth gate requires the v1.5 custom-claims pattern:** `functions/src/orgMembershipClaims.ts` is the direct template — a Firestore-trigger-synced claim, read by both server-side rules and client-side UI state. The super-admin claim should follow the same shape (small, boolean-or-enum, synced via `setCustomUserClaims`), not reinvent a second claims mechanism.
- **Config editor requires a caching-strategy decision BEFORE the "effective value" and "dry-run preview" features can be scoped precisely.** SEED-001 flags this itself ("the functions must read config from Firestore instead of `process.env`, and the read must be safe/cached"). Whether that's an in-memory TTL cache re-read every N minutes, or a live `onSnapshot` listener held at module scope, changes both propagation latency (what "effective now" means) and whether a staleness indicator is even needed.
- **Two knobs cannot become "live, no redeploy" the way the others can — this is a real constraint, not a preference.** `AI_PROXY_MAX_INSTANCES` and `GLOBAL_MAX_INSTANCES` are read from `process.env` at **module load time** in `functions/src/index.ts` and passed into `{ maxInstances: AI_PROXY_MAX_INSTANCES }` (a function-definition-time option) and `setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES })` (called once at cold start). Cloud Functions v2's `maxInstances` is a deployment/infrastructure setting, not a per-invocation runtime value — moving these two specific knobs to Firestore either (a) requires the function to read Firestore synchronously before `setGlobalOptions()` runs at module load (adds cold-start latency and a hard failure mode if that read fails), or (b) simply doesn't achieve "no redeploy" for these two and should be documented as a known exception rather than silently promised. Every other knob in scope (the four cleanup enables, retention days, AI rate limits/token ceiling/allowed models, message caps) is read per-invocation via `readNumericKnob(process.env.X, default)` or inline `process.env.X !== "true"` checks and can genuinely move to a per-request Firestore/cache read with no such constraint.
- **Dry-run preview requires the existing cleanup functions' dry-run code path, not new logic.** All four sweeps already compute "what would I delete" as their default behavior when `*_CLEANUP_ENABLED` is unset/false — the feature is exposing that computation on-demand via an admin-gated callable, capped the same way the real run is (`STORAGE_CLEANUP_MAX_DELETES_PER_RUN`), rather than writing a second counting mechanism.
- **The song-linked-background protection (hard constraint) is orthogonal to this console and must not be touched by it.** `cleanupOrphanBackgrounds`'s 3-tier reference detection + fail-safes already live in `functions/src/index.ts` (lines ~1329–1439) and does not change when its enable flag moves from env var to Firestore — the config-doc migration only changes *where the boolean is read from*, never the deletion logic gated behind it. Any refactor that touches that function's body (not just its config source) is in scope for extra scrutiny/testing, not a rewrite.
- **No-reply sender config is independent of the cleanup/AI/messaging knobs** — it's a single string (`MESSAGE_FROM_ADDRESS`, currently a `defineString` with default `onboarding@resend.dev`) with its own real-world precondition (Resend domain verification) rather than a numeric/boolean validation problem. It can ship in the same config doc and UI but has a fundamentally different "is this a valid value" check (see below).

## No-Reply Sender Config — Specific Findings

- **Format validation is table-stakes and cheap:** a plain-email-or-`Display Name <email>` shape check (the codebase's own `bareEmailAddress()` already parses both forms), reused directly rather than reimplemented.
- **Domain *verification* is a real, external precondition this console cannot fully self-serve.** Resend requires the sending domain to have DNS records (SPF/DKIM, added at the registrar) added and verified in the Resend dashboard before that domain can send — this is an out-of-band, one-time setup step the owner performs in Resend/their DNS provider, not something the admin console UI can complete on its own. The console's job is narrower: let the owner *enter* the verified address, and — as a genuine differentiator worth including even in v1 — validate-on-save by checking the domain against Resend's API (if such an endpoint is available) or at minimum warning "this domain must be verified in Resend before use" rather than silently accepting an unverified one and only failing at send time (a 403 the current codebase comment already documents as the exact failure mode).
- **A `*.web.app` (Firebase Hosting) address is confirmed OUT of reach — not a config gap, a platform limit.** The codebase's own `functions/src/index.ts` comment states this plainly: `*.web.app` is Google-managed with no DNS access, so it can never be Resend-verified. This is consistent with how Resend/most transactional-email providers require registrar-level DNS control to verify a sending domain. **Decision this research surfaces for requirements:** getting a real verified domain (buying/pointing a custom domain, adding its DNS records in Resend) is an owner action outside the app entirely — it is IN SCOPE for the admin console to *let the owner configure the address once they have one*, but OUT OF SCOPE for the console to *provision or verify the domain itself*. The milestone should not block on the owner actually completing domain verification; it should ship the config UI that's ready the moment they do (superseding the standing v1.7 backlog item 999.6, "harden the messaging From address to a Resend-verified domain").

## MVP Definition

### Launch With (v1 — this milestone)

- [ ] Super-admin custom claim + Vue router gate + Firestore-rules enforcement — the console has no value if it isn't actually private
- [ ] Minimal admin shell (single page or a few collapsible sections is enough; no multi-page nav needed)
- [ ] One global Firestore config doc holding all in-scope knobs, with Cloud Functions refactored to read it (per-invocation, cached) instead of `process.env` — except `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES`, documented as the redeploy-still-required exception
- [ ] Typed inputs with min/max/required validation per knob, both client-side and rules/function-side
- [ ] Effective-value display with a last-changed-by/at stamp (not a live staleness ticker — that's a differentiator)
- [ ] Dry-run blast-radius preview + confirm-to-flip flow specifically gating the four `*_CLEANUP_ENABLED` toggles — this is the milestone's hard requirement, not optional polish
- [ ] No-reply sender address field with format validation and a "must be Resend-verified" warning
- [ ] `updatedBy`/`updatedAt` on the config doc (cheap, do it while the save path is being built anyway)

### Add After Validation (v1.x / once this console gets real use)

- [ ] Live staleness indicator for effective values (worth it once the caching strategy is settled and if propagation lag turns out to actually confuse the owner in practice)
- [ ] Per-knob change history beyond "last changed by" (only if a real need to see older changes shows up)
- [ ] Send-domain verification status check against Resend's API from within the console (nice, not necessary — the owner can check Resend's own dashboard)

### Future Consideration (v2+ — explicitly deferred, not roadmap items for v1.9)

- [ ] Billing / plan management
- [ ] Church/org provisioning from the console
- [ ] Multi-admin grant/revoke UI (bootstrap-script-only for now)
- [ ] In-app `aiUsage` / dry-run-log dashboards and charts
- [ ] Per-org override of global config knobs

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Super-admin claim + gate (client + server) | HIGH | MEDIUM | P1 |
| Firestore config doc + functions refactor off `process.env` | HIGH | MEDIUM–HIGH | P1 |
| Typed config editor with validation | HIGH | MEDIUM | P1 |
| Dry-run preview + confirm-to-flip on cleanup toggles | HIGH | MEDIUM–HIGH | P1 |
| No-reply sender field + format validation | MEDIUM | LOW | P1 |
| Effective-value + last-changed display | MEDIUM | LOW–MEDIUM | P1 |
| Live staleness indicator | LOW | MEDIUM | P3 |
| Full audit-log collection/UI | LOW (this pass) | MEDIUM–HIGH | P3 (deferred) |
| Multi-admin management UI | LOW (this pass, 1-2 people) | MEDIUM | P3 (deferred) |
| Billing / provisioning UI | N/A this pass | HIGH | P3 (deferred, out of scope) |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when possible (none identified as strictly P2 this pass — the differentiators either fold cheaply into P1 work or are cleanly deferred)
- P3: Deferred to a future milestone

## Comparable Pattern Analysis

No direct public competitor has a documented "owner admin console" pattern worth reverse-engineering line-by-line — this is an internal/ops surface, not a customer-facing feature, so the relevant comparison is to general internal-admin-panel and feature-flag-platform conventions rather than worship-planning competitors.

| Pattern | How it typically works elsewhere | Our approach |
|---------|-----------------------------------|--------------|
| Kill-switch confirmation friction | Higher-risk toggles require typed confirmation (e.g. typing the resource name/"KILL") before applying, per feature-flag-platform convention | Confirm-to-flip + dry-run count shown inline before the toggle commits — arguably stronger than a typed-phrase pattern alone, since it shows *concrete impact* rather than just adding friction |
| Change auditability | "Every toggle should record who, when, and why" is standard guidance across feature-flag platforms | `updatedBy`/`updatedAt` on the config doc for v1; a full audit trail deferred (see Anti-Features) |
| Role separation (ops/admin claim vs. app-level RBAC) | Standard in multi-tenant SaaS: platform-admin claims are issued and checked separately from tenant-level roles | Matches directly — super-admin claim is deliberately separate from the existing per-org editor/viewer claim, reusing the same underlying claims mechanism |

## Sources

- **Codebase (HIGH confidence — direct inspection):** `functions/src/orgMembershipClaims.ts` (custom-claims pattern), `functions/src/index.ts` (all `process.env.*_CLEANUP_ENABLED`/`*_RETENTION_DAYS`/`AI_*`/`MESSAGE_*`/`GLOBAL_MAX_INSTANCES` read sites, `MESSAGE_FROM_ADDRESS` definition + its Resend/`*.web.app` comment, `cleanupOrphanBackgrounds` reference-protection region), `src/views/SettingsView.vue` (existing settings-editor UI pattern), `.planning/PROJECT.md`, `.planning/seeds/SEED-001-admin-settings-interface.md`
- [Resend — Verified Domains](https://resend.com/docs/dashboard/domains/introduction) — MEDIUM confidence (websearch); corroborates the codebase's own comment that domain verification (DNS records at the registrar) is required before sending, consistent with `*.web.app` being unreachable since it's Google-managed with no DNS access
- [Firebase — Control Access with Custom Claims and Security Rules](https://firebase.google.com/docs/auth/admin/custom-claims) and related search results — MEDIUM confidence (websearch); 1000-byte claims-payload limit and the ID-token-refresh-required-after-claim-change behavior, both directly relevant to the super-admin claim design and the "why isn't my new admin working yet" support question this will generate at least once
- General feature-flag/kill-switch UX guidance (Harness, LaunchDarkly, Unleash, Flagsmith docs/blogs surfaced via websearch) — LOW confidence (aggregated blog/vendor-doc consensus, not a single authoritative source); used only for the general "confirm destructive toggles, log who/when" pattern, which this project's own dry-run-preview requirement already exceeds

---
*Feature research for: owner-only super-admin console, v1.9 milestone*
*Researched: 2026-08-20*
