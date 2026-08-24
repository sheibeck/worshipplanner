# Phase 82: Per-Org AI Enablement - Research

**Researched:** 2026-08-24
**Domain:** Firestore rules-gated per-org feature flags, super-admin-only Cloud Function writes, Vue store-driven UI gating
**Confidence:** HIGH — every claim below is grounded in a direct read of this repo's live source (file:line cited), not external docs. This phase needs no new library.

## Summary

This phase adds a second, super-admin-only AI gate ON TOP of an AI toggle that **already exists**
and is **already fully wired**: `OrgSettings.aiEnabled` (`src/types/organization.ts:57`, default
`true`), rendered as the "AI Features" card in `src/views/SettingsView.vue:254-301`, saved by an
org editor at `SettingsView.vue:1035-1059` (`updateDoc('settings.aiEnabled', ...)`), and enforced
client-side at the single choke point `isAiEnabled()` in `src/utils/claudeApi.ts:69-71`
(`useAuthStore().settings.aiEnabled`), which every one of the three AI-calling exports checks
first (`claudeApi.ts:239,363,597`). That comment block literally names itself "the natural future
home for gating AI behind a paywall" — this phase is exactly that future.

The new **master gate** must be a structurally separate field from `settings.aiEnabled`, because
`settings.*` is writable by any org editor (`firestore.rules:179`, `isOrgEditor(orgId)`) and this
phase requires super-admin-only write. The codebase's own `organizations/{orgId}` document already
has exactly this shape for org lifecycle: five fields (`active`, `deactivatedAt`, `deactivatedBy`,
`reactivatedAt`, `reactivatedBy`) are carved out into a `lifecycleFields()` allow-list
(`firestore.rules:113-126`) that the org doc's `allow update` rule explicitly excludes from EVERY
client write path — ordinary editor AND super-admin's own client SDK alike (`firestore.rules:179`,
proven by `src/rules.test.ts:682-689`, "CRITICAL — DENIES a super-admin from writing a lifecycle
field directly"). Those fields are written ONLY by the `setOrgActive` Cloud Function via the Admin
SDK (`functions/src/orgProvisioning.ts:546-618`), which bypasses rules entirely. **This is the
exact pattern to mirror**: add a new field (recommended name `aiMasterEnabled`, top-level on the
org doc, distinct from `settings.aiEnabled`) to `lifecycleFields()`'s guard list, and add a new
`setOrgAiEnabled` callable that mirrors `setOrgActiveHandler`'s shape (same `assertSuperAdminCaller`
gate, same same-state short-circuit, far simpler body — no member claim fan-out is needed, since AI
enablement carries no Storage-side enforcement or refresh-token revocation requirement).

**Primary recommendation:** Add `organizations/{orgId}.aiMasterEnabled: boolean` (absent/false =
OFF, matching `active`'s absent=true precedent but inverted), gated Admin-SDK-only via
`lifecycleFields()` + a new `setOrgAiEnabled` callable; read it into a new `authStore.aiMasterEnabled`
ref inside `applyOrgSnapshot` (`src/stores/auth.ts:359-443`); gate the client-side choke point
`isAiEnabled()` in `claudeApi.ts` on `authStore.aiMasterEnabled && authStore.settings.aiEnabled`;
`v-if` the entire "AI Features" card in `SettingsView.vue` on `authStore.aiMasterEnabled`; and —
for the "forced off" requirement (R243) — have `setOrgAiEnabledHandler` ALSO write
`settings.aiEnabled: false` in the same merge write whenever it disables the master gate (so a
later re-enable never silently un-hides an org's previously-on state; the church must re-opt-in).
Server-side enforcement in the `api` proxy (`functions/src/index.ts:484` onward) is feasible with a
one-line addition using the ALREADY-RESOLVED `resolveOrgId(decodedCaller)` (`index.ts:183-186`) —
recommend it be added in this phase, not deferred, since the marginal cost is one extra Firestore
`get()` on a route that already does one (`getAppConfig`, `index.ts:568-575`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Super-admin master AI flag storage | Database (Firestore, `organizations/{orgId}`) | — | Mirrors `active`'s existing lifecycle-field storage shape exactly |
| Super-admin master AI flag write | API/Backend (Cloud Function, Admin SDK) | Database (`firestore.rules` deny-all-clients guard) | Write authority must be un-bypassable by any client, including a super-admin's own client SDK — same reasoning as `setOrgActive` |
| Owner Console per-row toggle UI | Browser/Client (`OrganizationsTab.vue`) | API/Backend (`setOrgAiEnabled` callable) | Pure `httpsCallable` consumer, no direct Firestore write (mirrors `onToggleActive`) |
| Settings AI panel visibility | Frontend Server/Client (`SettingsView.vue`, Vue reactivity) | — | Client-side `v-if`, no SSR in this app (Vite SPA) |
| Church's own AI on/off preference | Browser/Client (Pinia store) + Database (`settings.aiEnabled`) | — | Existing R088 mechanism, unchanged by this phase except for the new AND-gate |
| AI request cost/abuse enforcement | API/Backend (`functions/src/index.ts`'s `api` onRequest) | — | Real security boundary; UI hiding alone is bypassable by a direct fetch to the proxy URL with a valid ID token |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- A per-org **master gate** — a boolean on the org record (e.g. `organizations/{orgId}.aiEnabled`), ABSENT or
  false ⇒ AI **OFF** (default). Existing orgs have no field ⇒ AI off until a super-admin enables it
  (**migration note: Berean and any current AI user go dark until re-enabled — this is the owner's stated
  intent**).
- Written **only by a super-admin**. Reuse the established secure per-org super-admin write pattern — a
  super-admin-gated Cloud Function (mirror `setOrgActive`/`setSuperAdminClaim`: Admin-SDK write + two-check
  caller re-verification), NOT a client write — UNLESS research finds a cleaner existing seam. If a
  `firestore.rules` change is used instead, it ships built+tested+UNDEPLOYED with a `firebase deploy --only
  firestore:rules` hand-over.
- The super-admin flag is the MASTER gate. The church's own AI usage/settings live in the org **Settings AI
  panel**. When the master gate is OFF: the Settings AI panel is **not rendered**, and any org-level AI-on
  state is treated as off (forced off). When the master gate is ON: the church sees/uses AI normally.
- Research must confirm whether a distinct org-editor-controlled "AI on" setting exists today or whether the
  "AI panel" is simply where the church configures/uses AI (in which case hiding it satisfies "turned off,
  then hidden"). Implement whichever matches the real Settings structure.
- Add a per-org AI on/off control in the **Organizations tab** as a per-row action (mirroring the existing
  per-row super-admin actions like deactivate/reactivate/assign) OR the Configuration tab if research shows
  that fits better. Reflect the current state and update it via the super-admin write path above.
- For real security (not just UI hiding), the AI proxy / AI call path should ALSO refuse when the org's
  master gate is off — so disabling AI truly disables it, not merely hides the panel. Research the AI call
  path (`claudeApi`, the AI proxy function, `appConfig.aiProxy`) and decide whether server gating is in scope
  or a fast-follow; at minimum the UI gating (R242/R243) must be delivered.
- If the super-admin write is a Cloud Function and/or a rules change, those ship UNDEPLOYED with the exact
  deploy hand-over recorded in PENDING-VERIFICATION.md. Pure client-side gating (Settings panel v-if) needs
  no deploy.

### Claude's Discretion

- Exact field name for the master gate (research recommends `aiMasterEnabled` over the context's illustrative
  `aiEnabled`, to avoid confusion with the pre-existing `settings.aiEnabled` — see Pitfall 1).
- Whether the super-admin write goes through a NEW dedicated `lifecycleFields()`-style guard or a brand-new
  parallel mechanism (research recommends reusing `lifecycleFields()`).
- Whether the Owner Console control lands in the Organizations tab or Configuration tab (research recommends
  Organizations tab, per-row, mirroring Deactivate/Reactivate).
- Whether server-side proxy enforcement ships in this phase or is deferred (research recommends: ship it, low
  marginal cost).

### Deferred Ideas (OUT OF SCOPE)

- Per-org AI usage quotas/limits beyond on/off (the global `appConfig.aiProxy` rate limits already exist).
- Any AI-feature redesign — this phase only gates existing AI on/off per org.
</user_constraints>

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R242 | A super-admin can enable/disable AI functionality per organization from the Owner Console, and AI is OFF by default for every organization (including newly-onboarded ones). | New `aiMasterEnabled` field (absent/false = OFF) + `setOrgAiEnabled` callable (mirrors `setOrgActive`) + Owner Console per-row toggle in `OrganizationsTab.vue` (mirrors `onToggleActive`/Deactivate button). `listOrganizations`'s `OrgSummary` extended with `aiMasterEnabled` so the table shows current state. |
| R243 | When AI is disabled for an org, the org's Settings page does not show the AI panel at all; and if a super-admin disables AI while the org has it on, the org's own setting is forced off and the panel is hidden. | `SettingsView.vue`'s "AI Features" card `v-if`-gated on `authStore.aiMasterEnabled`. `setOrgAiEnabledHandler` writes `settings.aiEnabled: false` alongside `aiMasterEnabled: false` on disable, so the org's own preference is genuinely forced off, not merely masked. `claudeApi.ts`'s `isAiEnabled()` gate becomes `aiMasterEnabled && settings.aiEnabled` as defense-in-depth even before the client reloads. |
</phase_requirements>

## Standard Stack

No new library is required — this phase extends existing Firestore rules, an existing Cloud
Functions v2 `onCall`/`onRequest` module, and existing Vue/Pinia code, all already in the
dependency graph.

### Core (already installed, unchanged versions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-functions` | `^7.3.2` [VERIFIED: functions/package.json:16] | `onCall` callable + `onRequest` proxy (`setOrgAiEnabled`, `api`) | Already the exclusive callable framework in `functions/src/index.ts` |
| `firebase-admin` | `^13.10.0` [VERIFIED: functions/package.json:15] | Admin-SDK Firestore writes that bypass `firestore.rules` | Same SDK `setOrgActiveHandler` already uses |
| `firebase` (client) | `^12.0.0` [VERIFIED: package.json:27] | `httpsCallable`, `onSnapshot`, `getDoc` | Already the exclusive Firestore/Functions client SDK |
| `pinia` | `^3.0.4` [VERIFIED: package.json:29] | `useAuthStore()` — new `aiMasterEnabled` ref lives here | Existing single source of truth for org context |
| `vue` | `^3.5.29` [VERIFIED: package.json:31] | `v-if` gating of the Settings AI panel | Existing SPA framework, no SSR involved |

### Supporting

None needed — no new dependency, config knob, or environment variable is required. The feature
reuses `assertSuperAdminCaller` (`functions/src/orgProvisioning.ts:97-109`), `resolveOrgId`
(`functions/src/index.ts:183-186`), and the existing `superAdmins/{uid}` collection check.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Admin-SDK-only `lifecycleFields()`-guarded field | A plain `firestore.rules` `isSuperAdmin()`-gated field, writable directly by a super-admin's client SDK | Rejected: the codebase EXPLICITLY closed this exact pattern for `active` in Phase 78 (R225 composition fix, `firestore.rules:163-178`) because `isOrgEditor(orgId)` is true for every super-admin on every org, so an `isSuperAdmin()`-only exemption would let a super-admin write the field directly, skipping the callable's re-verification and any future server-side side-effects (e.g. the forced-off write to `settings.aiEnabled`). Reusing `lifecycleFields()` closes this by construction. |
| A new `setOrgAiEnabled` callable | Extending `setOrgActive` itself with an extra `aiEnabled` param | Rejected: conflates two independent lifecycle concepts (org active/inactive vs. AI on/off) in one request/response contract and one audit trail; `setOrgActiveHandler`'s member-claim fan-out (`patchNestedClaimKey`, `revokeRefreshTokens`) is irrelevant to AI enablement and would need an awkward opt-out branch. A small dedicated handler mirroring the SAME shape (not the same function) is cleaner and matches how `assignOrgAdmin`/`listOrganizations`/`setOrgActive` are already three separate handlers sharing only `assertSuperAdminCaller`. |
| Live server-side org-doc read per anthropic request | Trusting the `orgId` custom claim's OWN staleness-prone data for enablement (i.e., embed `aiEnabled` INTO the claim, like `deactivatedOrgs`) | Rejected: claims only refresh on next ID-token mint (sign-in, org switch, or an explicit `revokeRefreshTokens`); a super-admin disabling AI would not take effect server-side until the caller's token refreshes — could be hours. A live Firestore `get()` on `organizations/{orgId}` (using the claim ONLY as a pointer to which org, not as the enablement source) is fresh on every request. `getAppConfig()` in the same handler already sets this precedent (`index.ts:568-575`, "no {fresh:true}... this is no new Firestore dependency class"). |

## Package Legitimacy Audit

Not applicable — this phase introduces no new npm/PyPI/crates package. All work extends
`firebase-functions`, `firebase-admin`, `firebase`, `pinia`, and `vue`, already present and
verified in `package.json`/`functions/package.json` above.

## Architecture Patterns

### System Architecture Diagram

```
Owner Console (OrganizationsTab.vue)
   │  per-row "AI: On/Off" toggle button (mirrors Deactivate/Reactivate)
   ▼
httpsCallable('setOrgAiEnabled', { orgId, aiEnabled })
   │
   ▼
setOrgAiEnabledHandler (functions/src/orgProvisioning.ts, NEW)
   │  1. assertSuperAdminCaller(request)  — token claim + superAdmins/{uid} doc re-verify
   │  2. validate orgId/aiEnabled types
   │  3. org existence check
   │  4. same-state short-circuit (skip write if unchanged)
   ▼
Admin SDK merge write → organizations/{orgId}:
   { aiMasterEnabled: <value>,
     ...(disabling ? { 'settings.aiEnabled': false } : {}) }   ← R243 forced-off
   │  (bypasses firestore.rules entirely — Admin SDK)
   ▼
firestore.rules: organizations/{orgId} allow update
   preservesLifecycleFields() now ALSO denies client writes to `aiMasterEnabled`
   (both ordinary editors AND super-admin client SDK — same posture as `active`)
   │
   ├──────────────────────────────────────────────────────────────┐
   ▼                                                                ▼
Client re-load (loadOrgContext / enterOrgAsSuperAdmin)     Server-side enforcement
   applyOrgSnapshot(orgData) reads aiMasterEnabled           functions/src/index.ts `api` onRequest,
   → authStore.aiMasterEnabled ref                            service === 'anthropic' branch:
   │                                                            resolveOrgId(decodedCaller) → orgId
   ▼                                                            live get(organizations/{orgId})
SettingsView.vue                                                .aiMasterEnabled !== true → 403
   v-if="authStore.aiMasterEnabled"  → AI Features card
   (hidden entirely when master gate is off)
   │
   ▼
claudeApi.ts isAiEnabled()
   return authStore.aiMasterEnabled && authStore.settings.aiEnabled
   (checked first in getSongSuggestions/getScriptureSuggestions/splitCongregationalReading)
```

### Recommended Project Structure

No new files/folders — every change lands in an existing file:

```
functions/src/
├── orgProvisioning.ts     # + setOrgAiEnabledHandler, SetOrgAiEnabledRequest/Response, setOrgAiEnabled export
├── index.ts                # + export { setOrgAiEnabled }; + org-doc AI gate check inside `api`'s anthropic branch
firestore.rules             # organizations/{orgId}: lifecycleFields() += 'aiMasterEnabled'
src/
├── types/organization.ts   # Organization interface: + aiMasterEnabled?: boolean
├── stores/auth.ts           # + aiMasterEnabled ref; applyOrgSnapshot reads it; resetOrgContext clears it
├── utils/claudeApi.ts       # isAiEnabled(): authStore.aiMasterEnabled && authStore.settings.aiEnabled
├── views/SettingsView.vue   # AI Features card wrapped in v-if="authStore.aiMasterEnabled"
├── components/admin/OrganizationsTab.vue  # + per-row AI toggle button, OrgSummary += aiMasterEnabled
src/rules.test.ts             # + DENY/ALLOW tests mirroring the lifecycleFields() describe block
functions/src/orgProvisioning.test.ts  # + setOrgAiEnabledHandler describe block mirroring setOrgActiveHandler's
functions/src/index.test.ts (or wherever `api`'s anthropic branch is tested) # + org-disabled-AI 403 test
```

### Pattern 1: Admin-SDK-only field via `lifecycleFields()` allow-list extension

**What:** A single top-level boolean field on `organizations/{orgId}`, excluded from every client
write path (editor AND super-admin client SDK) by extending the SAME `hasAny([...])` guard array
`active`/`deactivatedAt`/etc. already use.
**When to use:** Any super-admin-only per-org field where "written only by the Admin SDK, never a
client, not even a trusted one" is the security posture — exactly this phase's requirement.
**Example:**
```javascript
// Source: firestore.rules:113-126 (existing, to be extended)
function lifecycleFields() {
  return ['active', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy', 'aiMasterEnabled'];
}
// preservesLifecycleFields() (unchanged) already diffs request.resource against resource and
// denies if any of these keys changed — adding 'aiMasterEnabled' to the array is the ENTIRE
// rules-file change needed. No new function, no new match block.
```

### Pattern 2: Super-admin callable mirroring `setOrgActiveHandler`'s shape

**What:** `assertSuperAdminCaller` gate → validate input → org existence check → same-state
short-circuit → Admin SDK merge write.
**When to use:** Any new super-admin-only per-org mutation.
**Example:**
```typescript
// Source: functions/src/orgProvisioning.ts:546-574 (setOrgActiveHandler, pattern to mirror)
export async function setOrgAiEnabledHandler(
  request: CallableRequest<SetOrgAiEnabledRequest>,
): Promise<SetOrgAiEnabledResponse> {
  const callerUid = await assertSuperAdminCaller(request);
  const { orgId, aiEnabled } = request.data ?? ({} as SetOrgAiEnabledRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof aiEnabled !== "boolean") {
    throw new HttpsError("invalid-argument", "aiEnabled (boolean) is required.");
  }
  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }
  const currentAiEnabled = (orgSnap.data() as { aiMasterEnabled?: boolean } | undefined)?.aiMasterEnabled ?? false;
  if (currentAiEnabled !== aiEnabled) {
    await orgRef.set(
      aiEnabled
        ? { aiMasterEnabled: true, aiEnabledAt: FieldValue.serverTimestamp(), aiEnabledBy: callerUid }
        // R243: disabling the master gate ALSO forces the church's own preference off, in the
        // SAME merge write -- a later re-enable of the master gate must never silently restore
        // a church's prior "on" state (owner intent: re-opt-in required, mirrors the "existing
        // orgs go dark" migration posture for the master gate itself).
        : { aiMasterEnabled: false, aiDisabledAt: FieldValue.serverTimestamp(), aiDisabledBy: callerUid,
            settings: { aiEnabled: false } },
      { merge: true },
    );
  }
  return { orgId, aiEnabled };
}
export const setOrgAiEnabled = onCall(setOrgAiEnabledHandler);
```
Note: `{ merge: true }` with a nested `settings: { aiEnabled: false }` object performs a
**field-path merge** in the Admin SDK (`set(..., {merge:true})` merges nested object literals
key-by-key, it does not overwrite the whole `settings` map) — confirm this with a unit test
(`functions/src/orgProvisioning.test.ts`) asserting a pre-existing `settings.bibleVersion` (or any
sibling field) survives the write untouched. If in doubt, use the explicit dot-path form
`{'settings.aiEnabled': false}` instead, which is unambiguously a single-field merge and matches
`SettingsView.vue`'s own client-side save pattern (`updateDoc(..., {'settings.aiEnabled': newValue})`,
`SettingsView.vue:1047`).

### Pattern 3: Client-side settings-merge read (`applyOrgSnapshot`)

**What:** Every org-doc field the app cares about is parsed ONCE, in one function, into a typed
Pinia ref — never re-derived ad hoc at each call site.
**When to use:** Any new field read off the org document.
**Example:**
```typescript
// Source: src/stores/auth.ts:359-368 (applyOrgSnapshot, existing function to extend)
function applyOrgSnapshot(orgData: Record<string, unknown>): void {
  orgName.value = (orgData.name as string) ?? null
  // ... existing fields ...
  // NEW: master AI gate, absent = OFF (inverted from `active`'s absent = true, matching R242's
  // "AI is OFF by default for every organization" -- deliberately NOT reusing `?? true`).
  aiMasterEnabled.value = (orgData.aiMasterEnabled as boolean | undefined) ?? false
  // ...
}
```

### Anti-Patterns to Avoid

- **Naming the new field `aiEnabled` at the org-doc top level, colliding conceptually with
  `settings.aiEnabled`:** Both fields would sit in the SAME document (`organizations/{orgId}` has
  `aiEnabled` top-level AND `settings.aiEnabled` nested) — a single stray `updateDoc(orgRef,
  {aiEnabled: true})` (missing the `settings.` prefix) would silently write the WRONG field with no
  type error (both are `boolean`). See Pitfall 1.
- **Gating only in `SettingsView.vue` and skipping the `claudeApi.ts` choke point:** The UI hide is
  cosmetic; a signed-in member with the AI Features card previously visible (stale page, no reload)
  can still trigger `getSongSuggestions` etc. if `isAiEnabled()` isn't also updated. R243 explicitly
  requires the org's OWN state to be "forced off," not just visually hidden.
- **Skipping the `lifecycleFields()` guard and using a bare `isSuperAdmin()` rules exemption:** This
  reopens the exact composition hole Phase 78 closed for `active` — see Alternatives Considered.
- **Trusting the `orgId` custom claim's payload for the enablement VALUE (not just as an org
  pointer) in server-side enforcement:** Claims are stale until next token mint; a live Firestore
  read of the org doc (using the claim only to know WHICH org) is the only way to get near-immediate
  server-side effect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Super-admin re-verification (claim + Firestore doc double-check) | A new inline `if (!request.auth?.token?.superAdmin) throw ...` | `assertSuperAdminCaller` (`functions/src/orgProvisioning.ts:97-109`), already exported and reused by 3 handlers | Single source of truth for the "claim says yes, but ALSO re-read `superAdmins/{uid}`" dual-check; a fork here risks drifting out of sync with a future hardening of that gate |
| Field-write client-side denial | A brand-new `match` block or standalone rule function | Extend `lifecycleFields()`'s array | Zero new rules surface area, reuses `preservesLifecycleFields()`'s already-tested diff logic verbatim |
| Friendly callable error mapping in the Owner Console UI | A new error-formatting helper in `OrganizationsTab.vue` | `friendlyCallableError` (already imported/used at `OrganizationsTab.vue:516,570`) | Existing shared helper for `HttpsError` → user-facing string |

**Key insight:** Every piece of this feature — the rules guard, the callable shape, the caller
re-verification, the client store merge point, the client choke-point gate, and the Owner Console
row-action UI — already has a working, tested twin in this exact codebase (`active`/`setOrgActive`
for the write side, `aiEnabled`/`isAiEnabled()` for the read side). This phase is a composition of
two existing patterns, not new design.

## Common Pitfalls

### Pitfall 1: Field-name collision between the new master gate and the existing org toggle
**What goes wrong:** A dev (or an AI agent in a future phase) writes `updateDoc(orgRef, {aiEnabled:
true})` intending to flip the church's own preference, but actually creates/overwrites a TOP-LEVEL
`aiEnabled` field that has nothing to do with `settings.aiEnabled` — or vice versa, a super-admin
tool writes `settings.aiEnabled` thinking it's the master gate.
**Why it happens:** CONTEXT.md's own illustrative example names the new field
`organizations/{orgId}.aiEnabled` — same leaf name as the pre-existing `settings.aiEnabled`, just at
a different path depth.
**How to avoid:** Name the new field `aiMasterEnabled` (or equally unambiguous, e.g.
`superAdminAiEnabled`) — never a bare `aiEnabled` at the document's top level.
**Warning signs:** Any code path reading/writing `orgData.aiEnabled` (no `settings.` prefix) should
be treated as suspicious in code review.

### Pitfall 2: `settings.value` and the new master-gate ref are NOT live-synced
**What goes wrong:** A super-admin disables AI for an org while a member of that org has the
Settings page open in another tab; the panel does not disappear until that member's next
`loadOrgContext` (login, org switch, or full reload) — same latency class as org deactivation
(`active`) already has.
**Why it happens:** `src/stores/auth.ts:109,115-118` explicitly documents that `vwModeEnabled` and
`settings` are "Mirror-written from Settings... NOT live-synced via onSnapshot" — only the caller's
OWN `members/{uid}` doc gets a live listener (`auth.ts:536`), which tracks role/claim changes, not
org-level settings fields.
**How to avoid:** This is the SAME latency the codebase already accepts for `active`/deactivation
(mitigated there by `revokeRefreshTokens` forcing a re-auth, which this feature does not need).
Accept the same non-live posture for the client UI hide (matches precedent, needs no new listener),
but make the SERVER-SIDE proxy check (Pattern in Architecture section) do a live `get()` every
request specifically so real enforcement is NOT subject to this staleness window — only the
cosmetic panel-hide is.
**Warning signs:** A UAT step expecting the Settings panel to vanish in real time in the SAME
browser tab without a reload/org-switch will fail; this is expected, not a bug (unless the plan
explicitly adds an `onSnapshot` listener for `aiMasterEnabled`, which would be new scope beyond
CONTEXT.md's grant).

### Pitfall 3: `preservesLifecycleFields()`'s create-branch also blocks the field on `allow create`
**What goes wrong:** `preservesLifecycleFields()` is ALSO consulted on the org-doc `allow create`
rule (`firestore.rules:184-185`), which asserts the incoming doc's keys don't include any
`lifecycleFields()` member. If `aiMasterEnabled` is added to that array, any CLIENT-SIDE org-creation
code path that happens to set `aiMasterEnabled` at create time would be denied.
**Why it happens:** The array is shared between the create-time "keys absent" check and the
update-time "diff empty" check.
**How to avoid:** Confirm (via `src/rules.test.ts` and a grep of `orgProvisioning.ts`'s
`onboardOrganizationHandler`) that org creation NEVER sets `aiMasterEnabled` client-side — it
shouldn't, since new orgs get the field via `DEFAULT` absence (OFF), not an explicit write. The
Admin-SDK-based `onboardOrganizationHandler` bypasses rules entirely regardless, so this is a
non-issue in practice, but note it as a REVIEW checkpoint, not an assumption.
**Warning signs:** A rules test asserting `allow create` still succeeds for a normal org-create
payload (no `aiMasterEnabled` key) — this should already pass with zero changes; add a regression
test explicitly, mirroring `rules.test.ts:581-589`'s "ALLOWS... no regression" shape.

### Pitfall 4: `set(..., {merge:true})` nested-object merge ambiguity in the disable branch
**What goes wrong:** Writing `{settings: {aiEnabled: false}}` with `merge:true` via the Admin SDK
DOES perform a field-path merge for nested object literals (this is the documented Admin SDK
behavior, distinct from a plain client-SDK `updateDoc` which would need explicit dot-path syntax)
— but getting this wrong in either direction (accidentally clobbering the whole `settings` map, or
accidentally NOT writing the nested field at all) is an easy, silent bug with no type error.
**Why it happens:** Nested-object merge semantics differ subtly between `set(...,{merge:true})`,
`set(...,{mergeFields:[...]})`, and `update(...)` with dot-path keys — all exist in this SDK and
look superficially similar.
**How to avoid:** Prefer the explicit dot-path form `{'settings.aiEnabled': false}` in the SAME
`set(..., {merge:true})` call (unambiguous single-field merge, and it's the exact syntax
`SettingsView.vue:1047` already uses client-side) OR add an explicit unit test in
`orgProvisioning.test.ts` asserting a sibling `settings` field (e.g. `bibleVersion`) is preserved
after the disable write.
**Warning signs:** A test seeding `settings: {bibleVersion: 'NLT', aiEnabled: true}` then calling
`setOrgAiEnabledHandler({aiEnabled: false})` and asserting `bibleVersion` still reads `'NLT'`
afterward.

## Code Examples

### Extending `lifecycleFields()` (firestore.rules)
```javascript
// Source: firestore.rules:113-115, extended
function lifecycleFields() {
  return ['active', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy', 'aiMasterEnabled'];
}
// preservesLifecycleFields(), preservesCreatedBy(), and every allow clause below are UNCHANGED --
// they all already consume lifecycleFields() by reference, not by literal list.
```

### `isAiEnabled()` two-gate AND (claudeApi.ts)
```typescript
// Source: src/utils/claudeApi.ts:69-71, extended
function isAiEnabled(): boolean {
  const authStore = useAuthStore()
  // R243: the super-admin master gate is checked FIRST and independently of the church's own
  // preference -- an org with the master gate off must never call the proxy even if a stale
  // `settings.aiEnabled: true` somehow survives (defense-in-depth; the callable also force-writes
  // settings.aiEnabled: false on disable, so this branch should be structurally unreachable in
  // steady state, but the check costs nothing and closes any write-ordering race).
  return authStore.aiMasterEnabled && authStore.settings.aiEnabled
}
```

### Settings AI panel v-if gate (SettingsView.vue)
```vue
<!-- Source: src/views/SettingsView.vue:254-301, wrapped -->
<div v-if="authStore.aiMasterEnabled" class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
  <h2 class="text-sm font-semibold text-gray-300 mb-3">AI Features</h2>
  <!-- ...unchanged... -->
</div>
```

### Server-side enforcement inside `api`'s anthropic branch
```typescript
// Source: functions/src/index.ts:556-582, new check inserted before enforceModelAndTokens
if (service === "anthropic") {
  // NEW (R242/R243 server-side enforcement): live-read the caller's org doc every request --
  // deliberately NOT reading enablement off the orgId claim itself (claims go stale until next
  // token mint; a live get() here is fresh on every call, matching getAppConfig's own posture
  // just below). resolveOrgId is used ONLY as a pointer to which org, never trusted for the
  // enablement value.
  const callerOrgId = resolveOrgId(decodedCaller!);
  if (callerOrgId) {
    try {
      const orgSnap = await getFirestore().collection("organizations").doc(callerOrgId).get();
      const aiMasterEnabled = (orgSnap.data() as { aiMasterEnabled?: boolean } | undefined)?.aiMasterEnabled ?? false;
      if (!aiMasterEnabled) {
        res.status(403).json({ error: "AI features are disabled for your organization." });
        return;
      }
    } catch (orgReadErr) {
      // Fail CLOSED, unlike the rate limiter below: this is a governance/security control the
      // owner explicitly asked to be "real security (not just UI hiding)", not a cost guardrail.
      // A transient Firestore hiccup here denies the request rather than risk spending money on
      // an org whose disablement we failed to verify.
      console.warn("[api] org AI-enablement read failed; failing closed:", {
        message: orgReadErr instanceof Error ? orgReadErr.message : String(orgReadErr),
      });
      res.status(503).json({ error: "Could not verify AI availability. Try again shortly." });
      return;
    }
  }
  // ... existing config/rate-limit/enforceModelAndTokens logic, unchanged ...
}
```
This fail-closed posture is a DELIBERATE departure from the existing rate limiter's fail-open
posture (`index.ts:600-607`, "the limiter is a cost guardrail, not a security control") — flag this
choice explicitly to the planner/discuss-phase as it is the one place this research makes a judgment
call not dictated by an existing precedent in this exact shape. See Assumptions Log A2.

### Owner Console per-row toggle (OrganizationsTab.vue)
```typescript
// Source: mirrors onToggleActive, OrganizationsTab.vue:526-574
async function onToggleAi(org: OrgSummary) {
  if (togglingAiOrgId.value) return
  const orgId = org.orgId
  const nextEnabled = !org.aiMasterEnabled
  togglingAiOrgId.value = orgId
  delete aiToggleError.value[orgId]
  try {
    const setOrgAiEnabled = httpsCallable<SetOrgAiEnabledRequest, SetOrgAiEnabledResponse>(
      functions,
      'setOrgAiEnabled',
    )
    await setOrgAiEnabled({ orgId, aiEnabled: nextEnabled })
    await refreshOrgs()
  } catch (err) {
    console.error('[OrganizationsTab] setOrgAiEnabled error:', err)
    aiToggleError.value = { ...aiToggleError.value, [orgId]: friendlyCallableError(err) }
  } finally {
    togglingAiOrgId.value = null
  }
}
```

## State of the Art

Not applicable — no external library or ecosystem shift is involved; every pattern mirrored here
was authored in THIS codebase within the last few phases (76-78, 2026-08).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended field name `aiMasterEnabled` (not the context's illustrative `aiEnabled`) | Summary, Pitfall 1 | Low — pure naming choice, trivially renamed before ship; flagged for planner/discuss confirmation since it deviates from CONTEXT.md's literal example (though CONTEXT.md explicitly invites research to refine this) |
| A2 | Server-side proxy enforcement should FAIL CLOSED on a Firestore read error (unlike the existing rate limiter, which fails OPEN) | Code Examples (server-side enforcement) | Medium — if the owner actually wants AI availability to degrade gracefully on a Firestore hiccup (consistent with the rate limiter's existing philosophy), this recommendation should be reversed to fail-open with a logged warning instead of a 503. This is a genuine judgment call, not verified against an explicit owner decision — surface it in discuss/plan. |
| A3 | Server-side proxy enforcement (R242/R243's "real security" ask) should ship IN this phase rather than deferred | Summary, User Constraints (Claude's Discretion) | Low-Medium — CONTEXT.md explicitly allows deferring this to a fast-follow; if the planner judges the added Firestore read + new failure mode too much scope for this phase, deferring is a legitimate, CONTEXT-sanctioned alternative. Recommendation is based on low marginal implementation cost (one Firestore `get()` on a route that already does one), not on a stated owner urgency. |
| A4 | `set(..., {merge:true})`'s nested-object-literal behavior (field-path merge, not whole-map overwrite) for the Admin SDK | Pattern 2, Pitfall 4 | Low — well-documented Firestore Admin SDK behavior, but NOT independently re-verified via a live test in this research session; the recommended mitigation (explicit dot-path syntax OR a unit test) removes the risk regardless of which way this assumption resolves. |

## Open Questions

1. **Should the "forced off" write in R243 be literal (mutate `settings.aiEnabled` in Firestore) or purely computed (leave `settings.aiEnabled` untouched, gate only at read time via the AND in `isAiEnabled()`)?**
   - What we know: CONTEXT.md's language ("the org's AI setting is forced off") and the phase objective ("forcing the church's own AI state off") both read as an actual state change, not merely a computed effective value. The codebase has no existing precedent for a "two-layer toggle where the outer layer mutates the inner layer's stored value."
   - What's unclear: Whether the owner would be surprised to see `settings.aiEnabled` flip to `false` in Firestore as a SIDE EFFECT of a super-admin action the church didn't take, versus expecting it to silently resume its prior value if the master gate is later re-enabled.
   - Recommendation: This research recommends the literal write (Pattern 2 above) — it is simpler to test (rules ALLOW/DENY + one Firestore assertion), it satisfies R243's literal wording, and it matches the safer "re-opt-in required" posture the owner already locked for the master gate's own OFF-by-default migration ("existing orgs go dark until enabled" — same "no silent resumption" philosophy). Confirm in discuss-phase if uncertain.

2. **Does `onboardOrganizationHandler` (new-org creation) need an explicit `aiMasterEnabled: false` write, or is field-absence sufficient?**
   - What we know: `DEFAULT_ORG_SETTINGS` pattern shows this codebase generally prefers explicit defaults merged at READ time (`applyOrgSnapshot`) over writing every default field at creation time — `active` itself is never explicitly written as `true` at org creation (`orgProvisioning.ts`'s `onboardOrganizationHandler`, not read in full this session but consistent with `isOrgActive`'s `get('active', true)` default-true pattern).
   - What's unclear: Full body of `onboardOrganizationHandler` (only its handler signature/exports were confirmed, not its complete write payload) was not read line-by-line in this session.
   - Recommendation: Read `functions/src/orgProvisioning.ts:240-330` (`onboardOrganizationHandler`'s body) at plan time to confirm no `aiMasterEnabled: true` (or any AI-related field) is accidentally written there — if it currently writes nothing AI-related, no change is needed (absence already reads as OFF via `applyOrgSnapshot`'s `?? false`).

## Environment Availability

Skipped — this phase has no NEW external dependency (npm package, CLI tool, third-party service).
It composes existing Firebase Functions/Firestore/Vue infrastructure already present and verified
functional in this repo (per CLAUDE.md, `.env.local` already required and present for all Firebase
operations; no new env var is introduced by this phase).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (app) | Vitest `^4.0.18` [VERIFIED: package.json:60] |
| Framework (functions) | Vitest `^4.1.10` [VERIFIED: functions/package.json:23] |
| Config file (app) | `vite.config.ts` (excludes `src/rules.test.ts` and `render-service/**` — see CLAUDE.md) |
| Config file (rules) | `vitest.rules.config.ts` — run via `firebase emulators:exec` or directly against a running emulator |
| Quick run command (app) | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts src/views/__tests__/SettingsView.test.ts src/stores/__tests__/auth.test.ts` (adjust to actual auth store test file if present) |
| Quick run command (functions) | `cd functions && npx vitest run src/orgProvisioning.test.ts` |
| Quick run command (rules) | `npx vitest run --config vitest.rules.config.ts -t "aiMasterEnabled"` (against an already-running emulator per CLAUDE.md's documented port-conflict caveat) |
| Full suite command (app) | `npx vitest run` (bare, per CLAUDE.md's 2026-08-12 correction — excludes rules + render-service by design) |
| Full suite command (functions) | `cd functions && npm test` |
| Full suite command (rules) | `npm run test:rules` (starts its own emulator; fails "port taken" if one is already running — use the direct `--config vitest.rules.config.ts` form against a running emulator instead) |
| Type-check gate | `npm run type-check` (NOT `-p tsconfig.app.json` — see CLAUDE.md, misses test-file errors) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R242 | Ordinary editor DENIED writing `aiMasterEnabled` directly on `organizations/{orgId}` | rules (emulator) | `npx vitest run --config vitest.rules.config.ts -t "aiMasterEnabled"` | ❌ Wave 0 — add to `src/rules.test.ts`'s existing "Org lifecycle field guard" describe block |
| R242 | Super-admin CLIENT SDK also DENIED writing `aiMasterEnabled` directly (must use callable) | rules (emulator) | same as above | ❌ Wave 0 — mirrors `rules.test.ts:682-689`'s "CRITICAL" test |
| R242 | `setOrgAiEnabledHandler` rejects unauthenticated/non-super-admin caller | functions unit | `cd functions && npx vitest run src/orgProvisioning.test.ts -t "setOrgAiEnabled"` | ❌ Wave 0 — mirrors `orgProvisioning.test.ts:361-395`'s `setOrgActive` reject tests |
| R242 | `setOrgAiEnabledHandler` writes `aiMasterEnabled: true/false` via Admin SDK, same-state short-circuit works | functions unit | same as above | ❌ Wave 0 — mirrors `orgProvisioning.test.ts:874`'s `setOrgActiveHandler` describe block |
| R242 | New org has AI OFF by default (no explicit write needed) | functions unit or rules | assert absent field reads as `false` via `applyOrgSnapshot`/handler default | ❌ Wave 0 |
| R242 | Owner Console per-row toggle round-trips (click → callable → refreshed row shows new state) | component | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts -t "AI"` | ❌ Wave 0 — extend existing `OrganizationsTab.test.ts` (file exists, add new `describe`) |
| R243 | Settings AI panel NOT rendered when `authStore.aiMasterEnabled` is false | component | `npx vitest run src/views/__tests__/SettingsView.test.ts -t "AI"` | ❌ Wave 0 — extend existing `SettingsView.test.ts` (file exists) |
| R243 | Settings AI panel renders normally when master gate is true | component | same as above | ❌ Wave 0 |
| R243 | `setOrgAiEnabledHandler` disable branch ALSO force-writes `settings.aiEnabled: false`, preserving sibling `settings` fields | functions unit | `cd functions && npx vitest run src/orgProvisioning.test.ts -t "forced off"` | ❌ Wave 0 |
| R243 (server-side, if in scope) | `api` anthropic branch returns 403 when caller's org has `aiMasterEnabled` false/absent | functions unit | locate/extend the existing test file covering `api`'s anthropic branch (likely `functions/src/index.test.ts` or similar — confirm exact path at plan time) | ❌ Wave 0 — confirm target test file name during planning |

### Sampling Rate

- **Per task commit:** the quick-run command scoped to the file(s) touched that task.
- **Per wave merge:** `npx vitest run` (app) + `cd functions && npm test` (functions) + rules
  suite against a running emulator + `npm run type-check`.
- **Phase gate:** full suite green (all three) before `/gsd-verify-work`, plus a manual confirmation
  that `firestore.rules` and the new callable are committed but UNDEPLOYED per the Deploy Note below.

### Wave 0 Gaps

- [ ] `src/rules.test.ts` — extend "Org lifecycle field guard" describe block with `aiMasterEnabled` DENY/ALLOW cases (R242)
- [ ] `functions/src/orgProvisioning.test.ts` — new `setOrgAiEnabledHandler` describe block (R242, R243)
- [ ] `src/components/admin/__tests__/OrganizationsTab.test.ts` — new AI-toggle describe block (R242)
- [ ] `src/views/__tests__/SettingsView.test.ts` — new AI-panel-visibility describe block (R243)
- [ ] Locate (grep at plan time) the existing test file covering `functions/src/index.ts`'s `api` onRequest anthropic branch, to extend with the org-gate 403 case — NOT confirmed to exist under a specific name in this research session; flag as a plan-time lookup, not a known gap.
- [ ] Framework install: none — Vitest is already configured in both `package.json` and `functions/package.json`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged) | Existing Firebase Auth ID token verification (`verifyAppCaller`, `verifyIdToken`) |
| V3 Session Management | No (unchanged) | N/A |
| V4 Access Control | Yes | `assertSuperAdminCaller` (claim + Firestore doc double-check) for the write path; `lifecycleFields()` allow-list guard for the deny-all-clients read-side boundary; live org-doc read (not claim-trust) for the server-side proxy gate |
| V5 Input Validation | Yes | `typeof orgId !== "string"` / `typeof aiEnabled !== "boolean"` explicit type guards in the new handler, mirroring `setOrgActiveHandler`'s existing validation exactly |
| V6 Cryptography | No | N/A — no new secret/key material |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ordinary editor forges the master gate directly via `updateDoc` (bypassing the super-admin callable) | Elevation of Privilege | `lifecycleFields()` extension denies this at the rules layer, proven by an ALLOW/DENY emulator test (mirrors `T-76-10`'s exact threat class) |
| Super-admin's OWN client SDK writes the field directly, skipping the callable's forced-off side effect on `settings.aiEnabled` | Tampering (partial/inconsistent state — master gate flips but the church's own setting doesn't) | Same `lifecycleFields()` guard denies this for a super-admin client write too — proven by `rules.test.ts`'s existing "CRITICAL" test pattern applied to the new field |
| A member with the AI panel already open (stale client) continues calling `claudeApi.ts` exports after a super-admin disables AI mid-session | Repudiation / policy bypass via UI-only gating | Client `isAiEnabled()` two-gate AND (cosmetic, latency-bound per Pitfall 2) PLUS server-side `api` proxy live org-doc check (Code Examples) — the proxy check is the actual security boundary, the UI hide is UX only |
| A caller bypasses the Vue UI entirely and calls the AI proxy URL directly with a valid ID token from a disabled org | Elevation of Privilege / cost abuse | Server-side enforcement in `functions/src/index.ts`'s `api` handler (recommended for THIS phase, see Assumption A3) — without it, R242/R243's disable is UI-cosmetic only, which the owner's phrasing ("real security, not just UI hiding") explicitly anticipates and asks to be closed |

## Sources

### Primary (HIGH confidence — direct read of this repo's live source, current commit)

- `src/types/organization.ts` (full file read) — `OrgSettings.aiEnabled`, `DEFAULT_ORG_SETTINGS`, `Organization` interface shape
- `src/views/SettingsView.vue:1-1180` (targeted reads) — AI Features card markup + save handler
- `src/utils/claudeApi.ts:1-80` — `isAiEnabled()` choke point, its own doc comment naming itself the future paywall/gating seam
- `src/stores/auth.ts` (targeted reads: 79-190, 356-680) — `applyOrgSnapshot`, `loadOrgContext`, `enterOrgAsSuperAdmin`, non-live-sync documentation for `settings`/`vwModeEnabled`
- `firestore.rules:1-235` (full read) — `isSuperAdmin`, `isOrgEditor`, `lifecycleFields()`/`preservesLifecycleFields()`/`preservesCreatedBy()`, org-doc `allow update`/`create`/`delete`
- `src/rules.test.ts:530-704` — existing lifecycle-field DENY/ALLOW test pattern to mirror
- `functions/src/orgProvisioning.ts:85-620` — `assertSuperAdminCaller`, `setOrgActiveHandler`, `OrgSummary`/`listOrganizationsHandler`
- `functions/src/index.ts:160-260, 477-660` — `verifyAppCaller`, `resolveOrgId`, `readAiProxyLimits`, `api` onRequest full anthropic branch (rate limit, `enforceModelAndTokens`, usage ledger)
- `src/components/admin/OrganizationsTab.vue:1-620` — table markup, per-row action buttons, `onToggleActive`, `SetOrgActiveRequest`/`Response` types
- `.planning/phases/82-per-org-ai-enablement/82-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 82 section), `.planning/PROJECT.md` (grep for Owner Console/super-admin background)
- `package.json:27-31`, `functions/package.json:15-23` — verified installed versions, no new dependency needed

### Secondary (MEDIUM confidence)

None — no external documentation was consulted; this phase's entire technical surface is internal
to the repo and was verified by direct read rather than citation.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions read directly from `package.json`
- Architecture: HIGH — every pattern cited by exact file:line from the current working tree
- Pitfalls: HIGH for Pitfalls 1-3 (directly observed in existing code/tests), MEDIUM for Pitfall 4 (Admin SDK merge semantics stated from training knowledge, not re-verified live this session — see Assumption A4)
- Security/server-side enforcement fail-open-vs-closed judgment: MEDIUM — a genuine design recommendation (Assumption A2), not drawn from an existing in-repo precedent for this specific field

**Research date:** 2026-08-24
**Valid until:** 30 days (stable internal codebase pattern, not an external fast-moving dependency) — note the knowledge graph (`.planning/graphs/graph.json`) is 1684 commits stale and was NOT relied upon for this research; all findings are from direct source reads at commit `6acfbfa`(-ish, current working tree).

---

## Deploy Note (for PENDING-VERIFICATION.md hand-over)

Per CONTEXT.md's Deploy Discipline decision, this phase's Firestore rules change and new Cloud
Function ship **built + tested + UNDEPLOYED**:

- **`firestore.rules`** — one-line addition to `lifecycleFields()`'s array (`+= 'aiMasterEnabled'`).
  Deploy: `firebase deploy --only firestore:rules --project worship-planner-bc515`.
- **`functions/src/orgProvisioning.ts` + `functions/src/index.ts`** — new `setOrgAiEnabled` export,
  plus (if server-side enforcement ships in this phase) a modified `api` function. Deploy:
  `firebase deploy --only functions:setOrgAiEnabled,functions:api --project worship-planner-bc515`
  (or a full `firebase deploy --only functions` if simpler for the owner's runbook — confirm at
  plan time which granularity matches existing hand-over conventions, e.g.
  `.planning/milestones/quick-archive/260823-onboard-admin-email/SUMMARY.md`'s
  `firebase deploy --only functions:onboardOrganization` precedent).
- **Client-only changes** (`SettingsView.vue`, `OrganizationsTab.vue`, `auth.ts`, `claudeApi.ts`,
  `organization.ts`) — no deploy hand-over needed beyond the normal `firebase deploy --only hosting`
  the owner already runs after every merge; these are safe to deploy even before the rules/functions
  hand-over lands, since a missing `aiMasterEnabled` field simply reads as `false` (OFF) client-side
  either way, and the Owner Console toggle button will fail its callable (friendly error surfaced)
  until `setOrgAiEnabled` is actually deployed.
