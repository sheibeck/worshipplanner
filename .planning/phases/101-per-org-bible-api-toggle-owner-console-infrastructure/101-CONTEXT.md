# Phase 101: Per-Org Bible API Toggle — Owner Console Infrastructure - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss — grey areas resolved from milestone-level decisions (see PROJECT.md v2.6 + REQUIREMENTS.md R295/R301); mirrors the v2.2 per-org AI enablement pattern.

<domain>
## Phase Boundary

Deliver the per-organization Bible-API on/off control and its persistence, mirroring the proven v2.2 per-org AI enablement pattern. This phase builds ONLY the toggle infrastructure (master field + Cloud Function + rules deny + Owner Console UI + authStore mirror + Organizations-list state surfacing). It does NOT gate any scripture fetch (Phase 102) or build the manual fallback UX (Phase 103) — those consume the field this phase establishes.

Requirements: **R295** (super-admin per-org enable/disable, super-admin-gated Cloud Function writing an Organization master field, client-write-denied in firestore.rules, default OFF, no migration) and **R301** (Organizations list surfaces each org's on/off state).
</domain>

<decisions>
## Implementation Decisions

### Data model (mirror aiMasterEnabled)
- Add a top-level master field on the `Organization` document: **`bibleApiEnabled?: boolean`** (super-admin-owned, written only by a Cloud Function), analogous to `Organization.aiMasterEnabled`. Name it to read as a master gate; do NOT add a church-editable `OrgSettings` leaf this milestone (single super-admin master gate is sufficient per R295 / PROJECT.md decision).
- **Default OFF:** absent/`undefined` ⇒ disabled. Every existing org (no migration) and every newly onboarded org starts OFF until the super-admin turns it on. Treat missing as false everywhere (client mirror + server).
- Onboarding: when a new org is provisioned (`orgProvisioning.ts` onboard path), do not set the field (or set it false) so new orgs default OFF consistently.

### Cloud Function (mirror setOrgAiEnabled)
- Add **`setOrgBibleEnabled`** callable in `functions/src/orgProvisioning.ts`, right beside `setOrgAiEnabled`. Super-admin-gated via the existing `assertSuperAdminCaller`. Input `{ orgId, enabled }`; merge-writes `bibleApiEnabled` on the org doc. Re-export from `functions/src/index.ts` (per the known "must re-export from index.ts" deploy pitfall).
- `listOrganizations` (listOrganizationsHandler) must return `bibleApiEnabled` per org so the Owner Console can display and toggle state (mirrors how it returns `aiMasterEnabled`).

### Firestore rules
- Extend the org-doc `lifecycleFields()` (or equivalent client-write-deny list) in `firestore.rules` to include `bibleApiEnabled`, so no client can flip it directly — only the Cloud Function (Admin SDK) can. Mirror exactly how `aiMasterEnabled` is denied.
- Add ALLOW/DENY rules-test coverage mirroring the aiMasterEnabled tests if such tests exist.

### Owner Console UI (mirror the AI toggle)
- `src/components/admin/OrgConfigDrawer.vue`: add an **"Enable Bible API"** checkbox bound to `org.bibleApiEnabled`, emitting a `toggle-bible` intent — directly alongside the existing "Enable AI features" checkbox. Presentational only (emits intent, writes nothing directly).
- `src/components/admin/OrganizationsTab.vue`: add `onToggleBible(org)` computing `nextEnabled = !org.bibleApiEnabled` and calling `setOrgBibleEnabled({ orgId, enabled: nextEnabled })` (mirror `onToggleAi`). Surface each org's current Bible-API state in the list row the same way AI state is shown (R301).

### Client store mirror
- `src/stores/auth.ts`: add a `bibleApiEnabled` ref mirrored from the org doc in `applyOrgSnapshot`/`loadOrgContext` (mirror `aiMasterEnabled`), plus an `isBibleApiEnabled` computed. This computed is what Phase 102's `scriptureApi.ts` gate and Phase 103's fallback UI read. Default false when absent.

### Claude's Discretion
- Exact field placement, function signature details, and test file organization are at Claude's discretion, provided they mirror the AI-enablement analog and keep default-OFF semantics.
</decisions>

<code_context>
## Existing Code Insights (from 2026-08-31 codebase map)

### Reusable Assets / Analogs to mirror
- `src/types/organization.ts` — `Organization.aiMasterEnabled?` (~line 196, super-admin master, default false) and `OrgSettings.aiEnabled` (~line 57, church leaf). Add `bibleApiEnabled?` next to `aiMasterEnabled`.
- `functions/src/orgProvisioning.ts` — `setOrgAiEnabledHandler`/`setOrgAiEnabled` (~lines 633–736): `assertSuperAdminCaller`, merge-write pattern. `listOrganizationsHandler` returns `aiMasterEnabled` per org (~lines 439, 481). Model `setOrgBibleEnabled` on this.
- `functions/src/index.ts` — re-export site for callables (new function MUST be re-exported here or `firebase deploy` misses it).
- `src/stores/auth.ts` — `aiMasterEnabled` ref (~130, mirror-written ~442) + `isAiEnabled` computed (~167). Mirror for `bibleApiEnabled`/`isBibleApiEnabled`.
- `src/components/admin/OrganizationsTab.vue` — `onToggleAi(org)` (~642–658) → `setOrgAiEnabled`. Model `onToggleBible`.
- `src/components/admin/OrgConfigDrawer.vue` — "Enable AI features" checkbox (~53–72) emitting `toggle-ai`. Model the Bible checkbox.
- `firestore.rules` — `lifecycleFields()` deny list includes `aiMasterEnabled`. Add `bibleApiEnabled`.
- Tests: `src/components/admin/__tests__/OrganizationsTab.test.ts`, `OrgConfigDrawer.test.ts`.

### Integration Points
- Owner Console → `setOrgBibleEnabled` callable → org doc `bibleApiEnabled` → `listOrganizations` echo + `authStore` snapshot mirror → (consumed downstream by Phases 102/103).

### Deploy note (do NOT deploy in this phase)
- Building this phase changes `functions/` and `firestore.rules`. Per standing owner policy + this milestone's constraint, build/test/commit ONLY — no `firebase deploy`. Deploys are batched for explicit owner confirmation at milestone end.
</code_context>

<specifics>
## Specific Ideas

- The whole phase is "do exactly what the AI-enablement toggle does, for a `bibleApiEnabled` field." When in doubt, open the `aiMasterEnabled`/`setOrgAiEnabled`/`onToggleAi` code and mirror it 1:1, changing only names and default (OFF).
- Keep naming unambiguous: the field governs the Bible **API** (ESV/NLT paid proxy), not scripture features in general — an OFF org still does scripture manually (Phases 102/103).
</specifics>

<deferred>
## Deferred Ideas

- A church-editable leaf toggle under the master gate (`OrgSettings.bibleApiEnabled`) — deferred (Future Requirements); single super-admin master gate suffices now.
- Gating the actual fetch + server esv/nlt branches — Phase 102.
- Manual BibleGateway/paste fallback UX + hiding the Bible Translation selector — Phase 103.
</deferred>
