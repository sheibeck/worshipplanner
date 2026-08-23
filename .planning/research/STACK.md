# Stack Research

**Domain:** Vue 3 + Firebase worship-planning SPA — v2.2 Configurability, Hardening & Cleanup
**Researched:** 2026-08-23
**Confidence:** HIGH (5 of 6 items are "use what's already installed"; the Resend domain-verification item is externally-sourced from Resend's own docs, also HIGH)

## Recommended Stack

### Core Technologies

No new core technology is warranted for v2.2. Every item in this milestone is either (a) a data-model/UI extension on the existing Firestore + Vue 3 + Pinia stack, (b) a `firestore.rules` edit, (c) a Cloud Functions code change, or (d) an external DNS/dashboard configuration step. Adding a new core dependency for any of these would be over-engineering relative to the existing stack's capabilities.

| Technology | Version (already in repo) | Purpose | Why it covers this milestone |
|------------|---------|---------|-----------------|
| Firebase (`firebase` client SDK) | `^12.0.0` (installed) | Firestore reads/writes for `OrgSettings`, security rules enforcement | `OrgSettings` already exists as a per-org Firestore doc; extending it with a `teams` array is a schema addition, not a new integration |
| `firebase-admin` / `firebase-functions` | `^13.10.0` / `^7.3.2` (functions/) | Cloud Functions runtime for `deleteService`, token revocation, admin email | Same runtime already used by `deleteQuarter`'s existing cascade-delete pattern — the share-token revocation item reuses that pattern, not a new one |
| `resend` (Node SDK) | `6.19.0` installed → `6.22.0` latest | Transactional email send from Cloud Functions | Already the chosen provider (v1.7 decision, ADR in PROJECT.md); the v2.2 work is **domain verification** (a Resend dashboard + DNS operation), not an SDK/API change |
| Vue 3 + Pinia + Vue Router | `^3.5.29` / `^3.0.4` / `^5.0.3` | UI for team config, shared song-browse component, Owner Console labels/ARIA | Component extraction (item 6) and per-team filter UI (item 1) are ordinary Vue composition-API work — no new UI framework or state library needed |

### Supporting Libraries — additions actually warranted

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint-plugin-vuejs-accessibility` | `^2.6.0` | Static ESLint rules for `.vue` templates: missing `alt`, missing form `<label>`/`aria-label` association, invalid/missing ARIA roles, `role="tablist"` child-role mismatches, tabindex misuse | **Only new dependency this milestone actually needs.** Add it as a dev-time linter pass over `OwnerConsoleView.vue` and its child forms/tab-strip components before/alongside the manual a11y retrofit (item 5, backlog 999.7) — it catches the exact defect class already found by the Phase 72/74 UI reviews (placeholder-only inputs, missing tab semantics) and prevents regression once fixed |

**Peer-dependency check (verified via `npm view`):** `eslint-plugin-vuejs-accessibility@2.6.0` declares `"eslint": "^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0"` — compatible with this repo's `eslint@^10.0.2`. It ships a flat-config export (`flat/recommended`), so it drops into `eslint.config.ts` alongside `pluginVue`/`vueTsConfigs` with no config-format migration.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `eslint-plugin-vuejs-accessibility` (flat config) | Lint-time a11y audit, not runtime | Run once as a repo-wide report to scope the retrofit (`npx eslint --rule ...` or add to `eslint.config.ts` scoped to `src/views/OwnerConsoleView.vue` + related components first, then widen), then keep it enabled generally — it is a **linter**, so it never touches the shipped bundle or runtime behavior |
| Resend Dashboard (web UI, no package) | Domain verification, DNS record generation, verification status | See "Resend Domain Verification" section below — this is 100% external configuration, not code |

## Per-Item Analysis

### 1. Extend `OrgSettings` with a configurable team list + per-team song-tag filter

**No new dependency.** This is a Firestore schema extension to the existing `OrgSettings` doc (which already carries `defaultServiceTemplate`, `bibleVersion`, `vwModeEnabled`, `slideTypography`, `timezone`, `messaging`) plus ordinary Vue form/store code, modeled directly on the existing `DEFAULT_ROLES`-seed-then-edit-per-org pattern already used for roster roles. Add a `teams: { id, name, songTagFilter? }[]` field (or similar), seed it from the current hard-coded `['Choir','Orchestra','Communion','Special']` list on first read (same deep-merge-onto-default pattern `appConfig.ts`'s `coerceSender`/`coerceConfigNumber` already use for the global config doc), and collapse the two duplicated literal arrays (`ServiceEditorView.vue:1675`, `NewServiceDialog.vue:145`) to one source. `firestore.rules` for `organizations/{orgId}/settings` already gates writes to org editors — no rules change needed for this item beyond the schema addition.

### 2. Harden `firestore.rules` — gate `inviteLookup` create to the target org's editor

**No new dependency.** Pure `firestore.rules` change plus the existing rules-emulator test harness (`@firebase/rules-unit-testing@^5.0.0`, already a devDependency, exercised via `npm run test:rules`). Current rule (`firestore.rules:173`, `allow create: if isSignedIn()`) needs to check that `request.auth`'s custom claim grants editor on the `orgId` embedded in the invite payload — the same `orgs:{orgId:role}` claim-reading pattern already used elsewhere in the rules file (post-v2.1 widened claim). Write new ALLOW/DENY cases in `src/rules.test.ts` mirroring the STRIDE-style tests already used for the v2.1 cascade-delete and cross-tenant-access rules. Per standing project discipline, ship this rules change **built + tested + UNDEPLOYED** with the exact `firebase deploy --only firestore:rules` command handed to the owner (per CLAUDE.md and the v1.8/v1.9 precedent).

### 3. Revoke a service's share tokens on `deleteService`

**No new dependency.** `deleteQuarter` already implements this cascade (per PROJECT.md's carry-forward note: "as `deleteQuarter` already does"). This is a Cloud Functions code change — extend `deleteService`'s existing transaction/batch-delete logic to also delete the associated `shareTokens`/`serviceShares`/`serviceShareLinks` documents, using the same `firebase-admin` Firestore batch-delete APIs already in use. `allow delete` rules are already in place (per the backlog note), so no `firestore.rules` change is required for this item specifically.

### 4. Migrate Resend from `onboarding@resend.dev` to a verified sending domain (the main ops item)

**No new npm dependency** — the `resend` package (`6.19.0` → optionally bump to `6.22.0`, a minor/patch-level bump, not required for verification to work) already handles sending; domain verification is entirely a **Resend dashboard + DNS** operation plus two `firebase functions:config`/`defineString` value changes already wired into the code (`SERVICE_SHARE_BASE_URL`, and a new/updated `MESSAGE_FROM_ADDRESS`-equivalent value — currently `DEFAULT_APP_CONFIG.sender.fromAddress` in `functions/src/appConfig.ts:102`, editable at runtime via the existing owner-console-driven `appConfig/global` doc, no redeploy needed for the sender address itself).

**Concrete steps (from Resend's own docs, HIGH confidence):**

1. **Choose a real domain the owner controls.** `*.web.app` / `*.firebaseapp.com` (Firebase Hosting defaults) **cannot** be verified — they're Google-managed with no DNS access (already noted in `params.ts`'s comment). The owner needs a domain they hold DNS for (e.g. their church's own domain, or a domain purchased for the app).
2. **Add the domain in the Resend dashboard:** Dashboard → Domains → "Add Domain" → enter the domain (Resend recommends a dedicated sending subdomain such as `send.yourdomain.com` to isolate sending reputation from the root domain's other mail).
3. **Publish the generated DNS records** at the domain's DNS provider (exact values are generated per-domain by Resend at add-time — do not hand-type generic ones):
   - **SPF** — a TXT record on the sending subdomain authorizing Resend's sending infrastructure.
   - **DKIM** — a TXT record at `resend._domainkey.<subdomain>` containing the public key Resend generates (this is a literal value to paste, not a CNAME).
   - **MX** (Resend also issues an MX record for the sending subdomain to receive bounce/complaint feedback).
   - **DMARC** — a TXT record at `_dmarc.<yourdomain>` with value `v=DMARC1; p=none; rua=mailto:<owner-address>;` to start in monitoring mode. Recommended progression: `p=none` → `p=quarantine` → `p=reject` once the owner confirms all legitimate mail (including this app's) passes for a few weeks. DMARC isn't strictly required for Resend to send, but it's Resend's own recommendation to prevent spoofing and build mailbox-provider trust (an email needs to pass **either** SPF or DKIM, not both, to be DMARC-compliant).
4. **Click Verify** in the Resend dashboard. Propagation + verification is typically 5–10 minutes but can take longer depending on the DNS provider's TTL; Resend's dashboard shows per-record status (SPF/DKIM/MX validated vs pending) so partial failures are visible immediately rather than as an opaque "unverified" state.
5. **Update app config once verified — two values, no code deploy required for either:**
   - `appConfig/global`'s `sender.fromAddress` (read live by `getAppConfig()`; already owner-editable via the Owner Console config UI shipped in v1.9) → set to something like `noreply@send.yourdomain.com` or `worship@yourdomain.com`.
   - `SERVICE_SHARE_BASE_URL` (a `defineString` param, defaults to `https://worship-planner-bc515.web.app`) → only change this if the owner also wants share links to originate from a custom domain; it is **independent** of the email-sending domain and does not need to match it. If left as the Firebase default, this is a **redeploy-required** Functions param change (`firebase deploy --only functions` after setting the param value), unlike the Firestore-backed sender address.
6. **No `resend` SDK code change is required** for verification itself — `resend.emails.send({ from, ... })` (`adminEmail.ts:108`) already sends from whatever `config.sender.fromAddress` resolves to. The only reason to touch `functions/src/adminEmail.ts` or `index.ts`'s equivalent send path is if the owner wants the display-name/from construction logic changed, which is unrelated to verification.
7. **Verify delivery to a real (non-Resend-account) recipient** post-verification — the entire reason for this milestone item is that `onboarding@resend.dev` only delivers to the Resend account owner's own inbox; a verified domain is what unlocks sending to arbitrary volunteer emails.

This is real external ops work (owner must have DNS access, and DNS propagation is outside the app's control) — flag it as an owner-dependency item in the roadmap, not something a coding phase can complete unilaterally, similar to the standing `firebase deploy` handoff discipline already in place for rules/claims changes.

### 5. Accessibility — lightweight ARIA/label audit tooling for the Owner Console

**One new dev dependency: `eslint-plugin-vuejs-accessibility@^2.6.0`.** Rationale for recommending a static linter over a runtime tool:
- The defects already identified (Phase 72 tab-strip review 23/24, Phase 74 forms review 22/24 — placeholder-only inputs, missing `role="tablist"`/`aria-selected`) are exactly the class of **static template** defects this plugin's rule set targets (`label-has-for`, `form-control-has-label`, ARIA-role/attribute validity rules) — no runtime DOM inspection is needed to find them.
- It integrates into the **existing** ESLint flat-config pipeline (`eslint.config.ts`, `eslint@^10.0.2`, flat-config already the project's format) with zero config-format migration, unlike `vue-axe` (a runtime devtools panel requiring the app to be running in a browser and manual visual triage) or `@axe-core/playwright` (requires a Playwright test harness the project does not have — vitest + `@vue/test-utils` is the current test stack, not Playwright).
- It runs in CI/pre-commit alongside the project's existing `lint:eslint` script, giving a repeatable, versionable "before/after" count for the retrofit rather than a one-time manual pass.
- **What NOT to add:** `vue-axe` or `@axe-core/playwright` — both are legitimate a11y tools in general, but both require either a running browser session or a new E2E test runner (Playwright) this project doesn't have; that's disproportionate tooling investment for a scoped console-page retrofit. If the project later wants continuous runtime a11y regression coverage across the whole app, that's a candidate for a future milestone, not v2.2.

Installation:
```bash
npm install -D eslint-plugin-vuejs-accessibility@^2.6.0
```
Integration (flat config, add to `eslint.config.ts`):
```ts
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'
// ...
export default defineConfigWithVueTs(
  // ...existing entries...
  ...pluginVueA11y.configs['flat/recommended'],
  // ...
)
```

### 6. Extract a shared Vue song-browse component

**No new dependency.** This is a component-extraction refactor within the existing Vue 3 + Pinia + TypeScript stack — pull the shared list/filter/search UI currently duplicated between the Songs page and the service-plan song picker into one component (e.g. `SongBrowser.vue`) with props/emits for the two call sites' differing selection behavior (navigate-to-edit vs. pick-into-slot). No component library, state library, or virtualization library is needed unless the song stable is large enough to need list virtualization — nothing in the codebase or backlog note (999.1) suggests that's the case; if it later becomes one, `vue-virtual-scroller`-class libraries would be the option to evaluate then, not now.

## Installation

```bash
# The only new dependency for this milestone
npm install -D eslint-plugin-vuejs-accessibility@^2.6.0

# Optional, not required: bump the existing Resend SDK to latest patch/minor
cd functions && npm install resend@^6.22.0
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `eslint-plugin-vuejs-accessibility` (static lint) | `vue-axe` (runtime devtools panel) | If the team wants live, click-through a11y feedback during manual dev/QA sessions rather than a CI-checkable rule set — heavier setup (must mount in dev build), better for exploratory audits of dynamic/JS-driven ARIA state the static linter can't see (e.g. `aria-expanded` toggled at runtime) |
| `eslint-plugin-vuejs-accessibility` | `@axe-core/playwright` (E2E a11y assertions) | Only if the project adopts Playwright/E2E testing generally — introducing a whole new test runner solely for one console-page a11y pass is disproportionate |
| Extend `OrgSettings` doc in place | A new `teams` sub-collection per org | Sub-collection would make sense if team configs grow large/independently-queried (e.g. hundreds of teams per org with per-team audit history); at the current scale (a handful of named teams per church, edited rarely) an array field on the existing settings doc matches the `DEFAULT_ROLES` precedent and avoids an extra read |
| Resend dashboard domain verification | A different email provider (SES, Postmark, SendGrid) | Only reconsider if Resend's deliverability or pricing becomes a problem — provider choice was already researched and decided in v1.7 (see PROJECT.md Key Decisions); nothing in this milestone's scope motivates re-opening that decision |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Firebase Hosting default domain (`*.web.app`/`*.firebaseapp.com`) as the Resend sending domain | Google-managed DNS zone — the owner has no DNS access to add SPF/DKIM/DMARC/MX records, so verification is structurally impossible | A domain the owner actually controls DNS for, ideally a dedicated sending subdomain (`send.yourdomain.com`) to isolate sending reputation |
| Relaxing `inviteLookup`'s create rule to something broader instead of narrowing it to the target org's editor | Defeats the purpose of hardening item 2 — the whole point is closing the self-invite vector, not papering over it | Check the invite payload's `orgId` against `request.auth`'s `orgs:{orgId:role}` custom claim for editor-or-above |
| A new state-management or component library for the song-browse extraction | Nothing about this refactor needs new client-side infrastructure — it's a props/emits extraction of existing markup/logic | Plain Vue 3 composition-API component + existing Pinia song store |
| `vue-axe` / Playwright a11y suite as the *first* a11y tool adopted here | Disproportionate setup cost for a scoped console retrofit; the defects found so far are all static-template issues a linter catches | `eslint-plugin-vuejs-accessibility` first; revisit runtime tooling only if a future milestone needs broader, dynamic-state a11y coverage |

## Stack Patterns by Variant

**If the owner wants share links to also originate from the new custom domain (not just email):**
- Also update `SERVICE_SHARE_BASE_URL` (a Functions `defineString` param) to the new domain and redeploy Functions (`firebase deploy --only functions`)
- Because unlike the Firestore-backed `sender.fromAddress` (live, no redeploy), `defineString` params are baked in at deploy time

**If DMARC enforcement (`p=quarantine`/`p=reject`) is applied before mail volume/legitimacy is confirmed:**
- Start `p=none` and monitor `rua` reports for at least a few send cycles before tightening
- Because a too-early strict policy can silently reject legitimate transactional mail (invite/onboarding emails) if any record is subtly misconfigured, with no visible in-app error — DMARC failures happen at the receiving mail server, invisible to the sending Cloud Function

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `eslint-plugin-vuejs-accessibility@2.6.0` | `eslint@^10.0.2` (installed) | Peer range `^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0 \|\| ^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0` — verified via `npm view eslint-plugin-vuejs-accessibility peerDependencies` |
| `eslint-plugin-vuejs-accessibility` flat config | `eslint.config.ts` (this repo's format, via `defineConfigWithVueTs`) | Ships a `flat/recommended` export — no legacy `.eslintrc` bridge needed |
| `resend@6.22.0` | `resend@6.19.0` (installed, functions/) | Minor/patch bump, no verification-related API surface change — domain verification is a dashboard/DNS operation independent of SDK version |
| `@firebase/rules-unit-testing@^5.0.0` (installed) | Firestore/Storage emulator, `firebase-tools` | Already the harness for `src/rules.test.ts`; new `inviteLookup` ALLOW/DENY cases slot into the existing suite, run via `npm run test:rules` per CLAUDE.md's documented emulator-port caveat |

## Sources

- Live repo inspection: `package.json`, `functions/package.json`, `functions/src/params.ts`, `functions/src/adminEmail.ts`, `functions/src/appConfig.ts`, `eslint.config.ts` — confidence HIGH (primary source, this codebase)
- `npm view eslint-plugin-vuejs-accessibility peerDependencies` / `npm view resend version` — confidence HIGH (npm registry ground truth, verified 2026-08-23)
- Resend docs, `https://resend.com/docs/dashboard/domains/introduction` and `https://resend.com/docs/dashboard/domains/dmarc` (fetched 2026-08-23) — confidence HIGH (vendor's own current documentation)
- Web search corroboration on Resend's SPF/DKIM/MX/DMARC record pattern (dmarcdkim.com, dmarc.wiki/resend, phishfence.io) — confidence MEDIUM (third-party summaries, used only to corroborate the vendor docs' record-type shape, not as primary source)
- `eslint-plugin-vuejs-accessibility` GitHub/docs site (vue-a11y.github.io) — confidence MEDIUM-HIGH (project's own docs site, corroborated by the npm peerDependencies field directly)
- `.planning/PROJECT.md`, `.planning/seeds/SEED-002-church-specific-rules-configurability.md` — confidence HIGH (primary source, this project's own planning record)

---
*Stack research for: WorshipPlanner v2.2 (Configurability, Hardening & Cleanup)*
*Researched: 2026-08-23*
