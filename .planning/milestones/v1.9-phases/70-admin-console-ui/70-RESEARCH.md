# Phase 70: Admin Console UI & No-Reply Sender - Research

**Researched:** 2026-08-20
**Domain:** Vue 3 + Pinia + Firebase client SDK — admin config editor UI, no new libraries
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Layout & components (R186)**
- Extend `OwnerConsoleView.vue` (the shell from 68-04) with one card/section per area — **Cleanup**,
  **AI Proxy**, **Messaging**, **Sender** — mirroring `SettingsView.vue`'s existing dark-theme card layout
  and form controls (no new design system, no new UI library).
- Each field shows its **effective value**: read `appConfig/global` via an `onSnapshot` store and deep-merge
  it against a client-side defaults mirror so an unset field displays its default value, labeled `(default)`
  when not explicitly set. The client defaults mirror must stay in sync with `DEFAULT_APP_CONFIG` (functions)
  — extract a single shared source or a small typed client constant, and note the coupling.
- **Provenance:** show a `updatedBy` (resolve uid → display name/email where cheap) + `updatedAt` stamp — a
  single "Last changed by X at Y" line per the doc (or per area) is sufficient. Not a full audit history
  (deferred).

**Editing & save (R187)**
- Controls by type: booleans → toggle; numbers → number input with **min/max/required** validation; sender →
  text inputs. Validate client-side (min/max/required, sensible per-field bounds — INCLUDING upper bounds,
  per Phase 69 review Info-2: the functions coerce layer has no upper bound, so the form is the upper-bound
  guard).
- **Save writes directly to `appConfig/global`** from the client (scoped dot-path leaf writes, mirroring
  `SettingsView.vue`'s org-settings write style) — this is allowed because Phase 68's `firestore.rules` gate
  `appConfig/*` to `isSuperAdmin()`. Stamp `updatedBy = current uid` and `updatedAt = serverTimestamp()` on
  each save.
- **Server-side enforcement (R187 "enforced by rules/functions"):** the authoritative backstop is Phase 69's
  per-knob `coerce*` layer (a malformed/out-of-range value can't widen authority — proven in Phase 69). The
  Phase 68 rules enforce WHO may write. Adding per-field range validation to `firestore.rules` is OPTIONAL
  and can be deferred — the coerce layer already makes a bad write safe; if trivial, add basic type guards to
  the rules, otherwise rely on client validation + coerce. State the choice; don't over-build rules.

**No-reply sender (R191, R192)**
- A Sender card with `fromName` (display name) + `fromAddress` (the app-owned no-reply address). Format-
  validate the address (basic email shape). If the address host is un-verifiable (e.g. `*.web.app`, or a bare
  non-custom domain), surface a non-blocking warning: **"must be a Resend-verified domain"** (domain
  verification is an out-of-band owner action — the console stores a validated address, it cannot verify a
  domain).
- The form has NO secret field — `RESEND_API_KEY` is never entered or shown. `fromAddress` is wired into the
  send path already (Phase 69); `fromName` is stored (Phase 69 left it dormant — the per-message display name
  stays the org name for now; storing it here is forward-looking and harmless).

**Cleanup-enable toggles (scope fence with Phase 71)**
- Render the four `cleanup.*Enabled` flags READ-ONLY in Phase 70 (show current state + a note like "Enabling
  a deletion cleanup uses the dry-run safety flow"), so this phase NEVER ships a bare one-click deletion
  toggle. Phase 71 (R188–R190) adds the dry-run blast-radius preview + confirm-to-flip that makes them
  editable. All OTHER settings (retention windows, delete cap, AI knobs, messaging caps, sender) are fully
  editable here.

**Deploy-time settings (R185 display, optional)**
- Optionally show `AI_PROXY_MAX_INSTANCES` / `GLOBAL_MAX_INSTANCES` / render caps as a small READ-ONLY
  "Deploy-time settings (requires redeploy)" note — clearly not editable. Keep minimal; acceptable to omit if
  it adds noise, but if shown it MUST be read-only and labeled.

**Deploy discipline (v1.9 grant)**
- Client-only UI — ships built + tested. No functions/rules change is required (rules + config already exist).
  If any rules tweak is added, it's owner-hand-over. No deploys, no `.env.local` writes.

### Claude's Discretion
- Exact component decomposition (one big view vs. per-area child components), the store shape (`admin.ts`
  extended, or a new `appConfig` store), field labels/help text, and whether provenance is per-area or global.
- Whether to add the read-only deploy-time note (R185 display) — include it if it's cheap and clear.

### Deferred Ideas (OUT OF SCOPE)
- Dry-run cleanup blast-radius preview + confirm-to-flip for the four `*_CLEANUP_ENABLED` toggles → Phase 71.
- Full audit-log history of config changes (vs. the single `updatedBy`/`updatedAt` stamp) → out of scope
  (REQUIREMENTS Future).
- In-app `aiUsage` ledger / dry-run cleanup-log dashboards → out of scope (Future R169).
- Per-org config overrides → out of scope (single/few-org app today).

### From 70-UI-SPEC.md (resolved design contract — treat as locked, not re-litigated)
- `allowedModels` (a `string[]`) renders as ONE comma-separated text input — no new list-editor UI.
- Provenance is **one global stamp** (not per-area) — `AppConfig` carries exactly one top-level
  `updatedBy`/`updatedAt` pair; rendering it four times would be misleading.
- `updatedBy` is written as the saving super-admin's **email** (`authStore.user?.email`), not uid.
- Writes MUST use `setDoc(doc(db,'appConfig','global'), {...dotPathFields}, {merge:true})` — **never**
  `updateDoc` — because the doc may not exist yet (R182: absent doc is a valid state; `updateDoc` throws
  `not-found` on a missing doc).
- Exact per-field min/max/required/integer bounds are specified (reproduced in Validation section below).
- `sender.fromAddress` format check reuses `OwnerConsoleView.vue`'s own `isValidEmailFormat` (contains `@`,
  contains `.`, non-empty) — deliberately not a stricter regex.
- Resend-unverifiable-host warning matches only `/\.web\.app$/i` and `/\.firebaseapp\.com$/i` — narrow,
  non-blocking, amber (`text-yellow-500`).
- Firestore rules are NOT touched this phase (field-level range validation deferred, per CONTEXT.md).
- Recommended (not mandated) file layout: `src/stores/appConfig.ts`, `src/config/appConfigDefaults.ts`,
  `src/components/admin/{CleanupConfigCard,AiProxyConfigCard,MessagingConfigCard,SenderConfigCard,
  ConfigNumberField,ConfigTextField}.vue`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R186 | Console shows effective value of every managed setting, grouped by area, with last-changed-by/at stamp | Architecture Patterns (appConfig store + deep-merge), Code Examples (onSnapshot store, `(default)` badge presence check), UI-SPEC's resolved single-global-stamp decision |
| R187 | Super-admin can edit each managed toggle/number/text setting inline with min/max/required validation; save writes to `appConfig/global` (client + rules/functions enforced) | Validation section (exact bounds table), Code Examples (`setDoc(...,{merge:true})` save action, dirty-check `isSaveDisabled`), Don't Hand-Roll (coerce layer is the backstop, not new rules) |
| R191 | Super-admin configures no-reply From address (name + address) from console; format-validated, persisted, used by Resend send path | Sender Card research (below), confirms `fromAddress` already consumed by Phase 69's `getAppConfig().sender.fromAddress` read at the send site |
| R192 | Sender config never accepts/exposes provider secrets; unverifiable-host address surfaces a warning | Sender Card research — confirms zero secret fields exist in `AppConfig.sender`, confirms `RESEND_API_KEY` lives only in `functions/.env`/Firebase secrets, never read by any client-reachable path |
</phase_requirements>

## Summary

This phase is pure client-side plumbing on top of two already-completed, already-shipped backend phases: the
`appConfig/global` Firestore doc and its rules gate (Phase 68), and the `AppConfig` type + `DEFAULT_APP_CONFIG`
+ `coerce*` reader layer + read-site swap (Phase 69, fully consumed by Cloud Functions already, including the
sender's `fromAddress`). There is genuinely nothing to look up externally: no new npm package, no new Firebase
API surface (`onSnapshot`/`setDoc`/`serverTimestamp` are all already used identically elsewhere in this exact
codebase), and no new UI pattern (the 70-UI-SPEC.md — already checker-approved — spells out every visual and
interaction detail down to Tailwind class strings). The work is: (1) write a `src/config/appConfigDefaults.ts`
constant that duplicates `functions/src/appConfig.ts`'s `DEFAULT_APP_CONFIG` values (cannot be a real import —
`src/` and `functions/` are separate build targets); (2) write a `src/stores/appConfig.ts` Pinia store that
`onSnapshot`s `appConfig/global`, exposes both the raw pre-merge doc (for the `(default)` badge) and the
resolved/deep-merged config, and a `saveField(path, value)` action that does
`setDoc(ref, {[path]: value, updatedBy: email, updatedAt: serverTimestamp()}, {merge:true})`; (3) extend
`OwnerConsoleView.vue`'s existing placeholder section with four cards (Cleanup, AI Proxy, Messaging, Sender)
built from that store, following `SettingsView.vue`'s exact triad-based save pattern (`isSaving`/
`savedFeedback`/`saveError`, dirty-check-gated Save button, revert-on-error).

The one genuinely load-bearing implementation fact — surfaced by the UI-SPEC and worth restating because it is
easy to get wrong by copy-pasting `SettingsView.vue`'s pattern verbatim — is that every other `updateDoc` call
in this codebase targets `organizations/{orgId}`, a document guaranteed to exist since signup. `appConfig/global`
has no such guarantee (R182 made "absent doc" an explicitly valid, expected state). `updateDoc` throws
`not-found` on a document that has never been written. **Every write in this phase must use
`setDoc(ref, patch, {merge:true})`,** not `updateDoc` — otherwise the very first save any super-admin ever makes
throws, on the exact code path this phase's raison d'être depends on.

**Primary recommendation:** Build one new Pinia store (`appConfig.ts`) mirroring `auth.ts`'s `onSnapshot`
pattern, one new client-only defaults constant (`appConfigDefaults.ts`, NOT an import from `functions/`), and
four Tailwind card components mirroring `SettingsView.vue` exactly — reusing every existing triad/validation/
save pattern in this codebase, adding zero new dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Display effective config value (deep-merge over defaults) | Browser / Client | — | Pure read-side computation over an `onSnapshot` payload + a static client constant; no server round-trip needed per render |
| Persist a config edit | Browser / Client | Database / Storage | Client writes directly to Firestore (`setDoc(...,{merge:true})`) — allowed because Phase 68's `firestore.rules` already gate `appConfig/*` to `isSuperAdmin()`; there is no callable/API tier in this phase's write path (unlike Phase 68's roster grant/revoke, which goes through a callable) |
| WHO may read/write `appConfig/global` | Database / Storage (Firestore rules) | — | Enforced entirely by the existing `isSuperAdmin()` rules block (Phase 68) — this phase's client code is not a security boundary, only a convenience gate (route guard) |
| WHAT shape a written value resolves to at read time | API / Backend (Cloud Functions) | — | The Phase 69 `coerce*` layer in `functions/src/appConfig.ts` is the authoritative backstop; a malformed/out-of-range value read by a Cloud Function can never widen authority regardless of what the client UI allowed through |
| Client-side min/max/required validation | Browser / Client | — | UX-only guard preventing an obviously-bad save attempt; NOT a security boundary (the coerce layer is) — per CONTEXT.md's explicit "don't over-build rules" call |
| No-reply sender address consumption (actual email send) | API / Backend (Cloud Functions, Resend) | — | Already wired in Phase 69 (`getAppConfig().sender.fromAddress` read at the `sendQueuedMessage`/`sendScheduledReminders` call sites) — this phase is display+write only, never touches the send path itself |
| Provider secret (`RESEND_API_KEY`) | API / Backend (Firebase Secrets / `functions/.env`) | — | Never touches any client-reachable code path in this phase (R192) — `AppConfig.sender` has no secret field to leak |

## Standard Stack

### Core
No new dependency. Every capability this phase needs is already installed and already used identically
elsewhere in this codebase:

| Library | Version | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------------------------|
| `firebase` (client SDK) | `^12.0.0` [VERIFIED: package.json] | `onSnapshot`, `setDoc`, `doc`, `serverTimestamp` | Already the sole Firestore touchpoint in `auth.ts`/`SettingsView.vue`/`OwnerConsoleView.vue` — modular v9+ API, `setDoc(ref, patch, {merge:true})` is the documented idiom for "create-or-patch" |
| `pinia` | `^3.0.4` [VERIFIED: package.json] | New `appConfig` store | Identical `defineStore` setup-store shape as every existing store (`auth.ts`, `roster.ts`, etc.) |
| `vue` | `^3.5.29` [VERIFIED: package.json] | Composition API, `ref`/`computed`/`watch` | No new Vue feature needed — same primitives `SettingsView.vue` already uses |

### Supporting
None — this phase deliberately adds zero new dependencies (per 70-CONTEXT.md and 70-UI-SPEC.md's Registry
Safety gate: "This phase adds zero new dependencies").

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled min/max/required validation | `zod`/`vee-validate`/`yup` | Rejected — `.planning/research/SUMMARY.md`'s Stack track already evaluated and rejected a validation library for this exact milestone ("Form validation reuses the app's existing zero-library, plain-cast-and-guard pattern"); introducing one now for a handful of number fields would be inconsistent with every other settings surface in the app |
| Duplicated client-side defaults constant | A shared `packages/shared` workspace importable by both `src/` and `functions/` | Rejected by the UI-SPEC as out of scope — `src/` (Vite) and `functions/` (Cloud Functions build) are genuinely separate build targets in this repo today; introducing a shared package is a build-tooling change disproportionate to one config phase. The UI-SPEC's resolution (duplicate + cross-reference comments) is deliberate, not an oversight |

**Installation:** none required.

**Version verification:** Confirmed directly from `C:\projects\worshipplanner\package.json` — `firebase@^12.0.0`, `pinia@^3.0.4`, `vue@^3.5.29` — all already installed; no `npm view` lookup needed since no new package is proposed.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** No `npm install` runs, no new `package.json`
dependency entries. The Package Legitimacy Gate is skipped per its own trigger condition ("whenever this phase
installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (super-admin session)                                      │
│                                                                       │
│  OwnerConsoleView.vue                                                │
│    ├─ Super-admins roster card (Phase 68 — untouched)                │
│    └─ Platform configuration section (THIS PHASE)                    │
│         ├─ CleanupConfigCard.vue    ─┐                                │
│         ├─ AiProxyConfigCard.vue     │  each reads                   │
│         ├─ MessagingConfigCard.vue   │  useAppConfigStore()          │
│         └─ SenderConfigCard.vue     ─┘                                │
│              │ read: store.resolvedConfig[.field] (deep-merged)      │
│              │ read: store.rawDoc[.field] (presence → (default) badge)│
│              │ write: store.saveField('area.field', value)           │
│              ▼                                                       │
│  src/stores/appConfig.ts (Pinia)                                     │
│    ├─ onMounted: onSnapshot(doc(db,'appConfig','global'), cb)  ──┐   │
│    │     cb → rawDoc.value = snap.exists() ? snap.data() : {}    │   │
│    │        → resolvedConfig.value = mergeConfig(rawDoc, DEFAULTS)│  │
│    └─ saveField(path, value):                                    │   │
│          setDoc(doc(db,'appConfig','global'),                    │   │
│            { [path]: value, updatedBy: email,                    │   │
│              updatedAt: serverTimestamp() },                     │   │
│            { merge: true })              ─────────────────────┐ │   │
│                                                                 │ │   │
│  src/config/appConfigDefaults.ts (static, client-side mirror   │ │   │
│  of functions/src/appConfig.ts's DEFAULT_APP_CONFIG)           │ │   │
└──────────────────────────────────────────────────────────────┼─┼───┘
                                                                 │ │
                                    Firestore (appConfig/global)│ │
                    ┌────────────────────────────────────────────┘ │
                    │  rules: allow read,write if isSuperAdmin()    │
                    │  (Phase 68 — enforces WHO)  ◄──────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Cloud Functions (already built — Phase 69, untouched by this phase)│
│                                                                       │
│  getAppConfig(db) → deep-merges raw doc onto DEFAULT_APP_CONFIG      │
│    via coerce* functions (enforces WHAT shape is trusted)            │
│      ├─ api proxy / sendQueuedMessage  → TTL-cached read (~60s)      │
│      └─ cleanup crons / sendScheduledReminders → always-fresh read   │
│                                                                       │
│  sender.fromAddress already consumed at the Resend send call site    │
└─────────────────────────────────────────────────────────────────────┘
```

A reader can trace the primary use case (super-admin edits `retention.mediaDays`) end to end: input in
`CleanupConfigCard.vue` → `store.saveField('retention.mediaDays', 45)` → `setDoc(..., {merge:true})` →
Firestore doc updated → next cleanup cron's always-fresh `getAppConfig({fresh:true})` read picks it up (no
redeploy) — this last hop is Phase 69's existing, already-tested behavior; Phase 70 only produces the write.

### Recommended Project Structure
```
src/
├── config/
│   └── appConfigDefaults.ts       # NEW — client-side mirror of functions/src/appConfig.ts's
│                                   #       DEFAULT_APP_CONFIG; comment cross-references the source
├── stores/
│   └── appConfig.ts               # NEW — onSnapshot store: rawDoc, resolvedConfig, loaded,
│                                   #       loadError, saveField(path, value)
├── components/
│   └── admin/
│       ├── CleanupConfigCard.vue      # NEW — 4 read-only toggles + 5 editable numbers
│       ├── AiProxyConfigCard.vue      # NEW — 3 numbers + 1 comma-text (allowedModels)
│       ├── MessagingConfigCard.vue    # NEW — 1 editable toggle + 2 numbers
│       ├── SenderConfigCard.vue       # NEW — 2 text fields, no secret field
│       ├── ConfigNumberField.vue      # NEW (recommended) — reusable label+input+(default)
│       │                               #  badge+Save-triad+min/max validation block
│       └── ConfigTextField.vue        # NEW (recommended) — text-field equivalent
└── views/
    └── OwnerConsoleView.vue        # MODIFIED — replace Phase 68 placeholder with the 4 cards
                                      #  + one global provenance stamp line
```

### Pattern 1: `onSnapshot` Pinia store with a raw/resolved split
**What:** The store exposes BOTH the pre-merge raw Firestore payload (`rawDoc`) and the deep-merged resolved
config (`resolvedConfig`) — two different reads of the same snapshot, kept in sync in one callback.
**When to use:** Any time a UI must distinguish "this value is explicitly set" from "this value is showing its
default" (the UI-SPEC's `(default)` badge, R186's own requirement to label unset fields).
**Example (adapted from `auth.ts`'s `memberUnsub`/`onSnapshot` pattern, lines 322-347, and
`OwnerConsoleView.vue`'s roster subscription, lines 244-261):**
```typescript
// Source: pattern generalized from src/stores/auth.ts (onSnapshot lifecycle)
// and src/views/OwnerConsoleView.vue (onMounted/onUnmounted subscription shape)
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { defineStore } from 'pinia'
import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_APP_CONFIG, type AppConfig } from '@/config/appConfigDefaults'
import { mergeAppConfig } from '@/config/appConfigDefaults' // client-side mirror of the deep-merge

export const useAppConfigStore = defineStore('appConfig', () => {
  const rawDoc = ref<Partial<AppConfig> | undefined>(undefined)
  const resolvedConfig = ref<AppConfig>(mergeAppConfig(undefined))
  const loaded = ref(false)
  const loadError = ref<string | null>(null)
  let unsub: Unsubscribe | null = null

  function subscribe() {
    unsub = onSnapshot(
      doc(db, 'appConfig', 'global'),
      (snap) => {
        rawDoc.value = snap.exists() ? (snap.data() as Partial<AppConfig>) : undefined
        resolvedConfig.value = mergeAppConfig(rawDoc.value)
        loaded.value = true
      },
      (err) => {
        console.error('[appConfig store] subscription error:', err)
        loadError.value = 'Load error'
        loaded.value = true
      },
    )
  }
  function unsubscribe() { unsub?.(); unsub = null }

  async function saveField(path: string, value: unknown): Promise<void> {
    const authStore = useAuthStore()
    await setDoc(
      doc(db, 'appConfig', 'global'),
      { [path]: value, updatedBy: authStore.user?.email ?? 'unknown', updatedAt: serverTimestamp() },
      { merge: true }, // NEVER updateDoc — doc may not exist yet (R182)
    )
  }

  return { rawDoc, resolvedConfig, loaded, loadError, subscribe, unsubscribe, saveField }
})
```
Note: `subscribe()`/`unsubscribe()` are explicit actions (not module-scope side effects), called from
`OwnerConsoleView.vue`'s `onMounted`/`onUnmounted` — same lifecycle-management discipline
`OwnerConsoleView.vue` already uses for its roster subscription, so the store itself stays testable without a
component mount.

### Pattern 2: Presence-based `(default)` badge (NOT value-equality)
**What:** A field's `(default)` badge is driven by whether the RAW leaf key is present in the pre-merge
Firestore doc — never by comparing the resolved value to the default value.
**When to use:** Every editable field in this phase (per UI-SPEC's explicit resolution — see UI-SPEC's
`(default)` badge section, which calls out that value-equality would mislabel "deliberately set back to the
default number" as still-default).
**Example:**
```typescript
// Source: src/config/appConfigDefaults.ts usage pattern, derived from UI-SPEC's
// "precise semantics (implementation-facing)" section
function isExplicitlySet(rawDoc: Partial<AppConfig> | undefined, path: string): boolean {
  if (!rawDoc) return false
  const segments = path.split('.')
  let cursor: unknown = rawDoc
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== 'object' || !(seg in cursor)) return false
    cursor = (cursor as Record<string, unknown>)[seg]
  }
  return cursor !== undefined
}
```

### Pattern 3: Dot-path leaf `setDoc(..., {merge:true})` — the load-bearing write mechanic
**What:** Every save writes ONE dot-path leaf key (e.g. `'retention.mediaDays': 45`) via `setDoc` with
`merge:true`, never a whole nested-object replacement, and never `updateDoc`.
**When to use:** Every single field save in this phase.
**Why `setDoc(...,{merge:true})` and not `updateDoc`:** `organizations/{orgId}` (what
`SettingsView.vue` writes) is guaranteed to exist (created at signup) — every existing dot-path write in this
codebase safely uses `updateDoc`. `appConfig/global` carries no such guarantee: R182 made an absent doc a
valid, expected, safe state. `updateDoc` throws `not-found` against a document that has never been created.
`setDoc(ref, patch, {merge:true})` both creates the doc on the very first save AND behaves identically to
`updateDoc`'s dot-path-leaf semantics on subsequent saves — no other part of the established mirror-write
pattern (dirty-check, revert-on-error, Saved!/error triad) changes.
```typescript
// Source: adapted from src/stores/auth.ts's ensureUserDocument (line 382, the one
// existing setDoc(...,{merge:true}) call in this codebase) + SettingsView.vue's
// dot-path updateDoc convention (e.g. line 1013, 1040, 1067)
await setDoc(
  doc(db, 'appConfig', 'global'),
  {
    'retention.mediaDays': 45,
    updatedBy: authStore.user?.email ?? 'unknown',
    updatedAt: serverTimestamp(),
  },
  { merge: true },
)
```

### Anti-Patterns to Avoid
- **Using `updateDoc` for any `appConfig/global` write:** throws `not-found` on the first-ever save (see
  Pattern 3). This is the single most important thing NOT to copy verbatim from `SettingsView.vue`.
- **Comparing resolved value to default value for the `(default)` badge:** mislabels a deliberate
  "reset to the default number" save as still-default (dishonest provenance) — check raw-doc presence instead
  (Pattern 2).
- **Adding a validation library:** rejected explicitly by both the milestone-level Stack research and the
  UI-SPEC ("no new design system, no new UI library... zero new dependencies").
- **Building a per-area provenance stamp:** `AppConfig` has exactly one top-level `updatedBy`/`updatedAt`
  pair — a schema change to add four would be out of scope (Phase 69 is closed); the UI-SPEC resolved this to
  one global stamp.
- **Fetching `DEFAULT_APP_CONFIG` from `functions/src/appConfig.ts` via a relative import:** `src/` (Vite
  build) and `functions/` (Cloud Functions build) are separate TypeScript projects/build targets in this repo
  — such an import would either fail to resolve at build time or silently bundle server-only code into the
  client. Duplicate the constant in `src/config/appConfigDefaults.ts` instead (UI-SPEC's resolved decision).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Range/required validation for config numbers | A generic validation library integration (`zod` schema, `vee-validate` form) | Plain `Number(...)` cast + inline min/max/required guard, mirroring `SettingsView.vue`'s existing `isSaveDisabled`/`isSlugSaveDisabled` computed pattern | This codebase has zero validation-library precedent anywhere; introducing one for ~11 number fields is inconsistent scope creep the milestone research already rejected |
| "Is this address on an unverifiable host" check | A DNS-lookup / MX-record check, or an integration with Resend's domain-verification API | A small deny-list regex test (`/\.web\.app$/i`, `/\.firebaseapp\.com$/i`) per the UI-SPEC's resolved, narrow scope | Real domain verification is explicitly out of scope (R192, REQUIREMENTS "Out of Scope" section) — this console cannot verify a domain, only warn about the two confirmed-unreachable Firebase-managed hosts named in `functions/src/index.ts`'s own comment |
| Deep-merge of a partial config doc onto defaults | A generic deep-merge utility/library (`lodash.merge`, `deepmerge`) | A small hand-written per-group merge function mirroring `functions/src/appConfig.ts`'s `mergeAppConfig` shape (group-by-group, not a naive recursive merge) — see Code Examples | `mergeAppConfig` in Phase 69 is already a proven, tested reference implementation for the exact same shape; a generic deep-merge library would treat arrays (`allowedModels`) differently than the coerce layer's fail-closed semantics require, risking client/server merge-behavior drift |
| Presence-vs-value distinction for the `(default)` badge | A "diff the resolved value against the default constant" comparison | Raw pre-merge doc key presence (Pattern 2 above) | Value-equality is provably wrong for the "reset back to the exact default number" case — the UI-SPEC explicitly resolved this |

**Key insight:** every non-trivial piece of logic this phase needs (deep-merge semantics, fail-closed
coercion, dot-path write mechanics) already has a working, tested reference implementation somewhere in this
exact codebase (`functions/src/appConfig.ts` for merge/coerce, `SettingsView.vue`/`auth.ts` for the write
pattern) — the job is porting the shape to the client, not inventing new logic.

## Common Pitfalls

### Pitfall 1: Using `updateDoc` because every other settings save in this codebase does
**What goes wrong:** The very first super-admin save against a never-before-written `appConfig/global` throws
a Firestore `not-found` error, surfacing as the generic "Failed to save. Please try again." error line — the
save silently never lands, and the pattern LOOKS correct because it's copy-pasted from `SettingsView.vue`'s
extensively-precedented `updateDoc` convention.
**Why it happens:** `organizations/{orgId}` is guaranteed to exist (created at signup); `appConfig/global` is
not (R182 made an absent doc valid-by-design). Every existing dot-path write example in this codebase happens
to target the guaranteed-to-exist doc, so the `updateDoc` convention has never been tested against a possibly-
absent target.
**How to avoid:** Use `setDoc(ref, patch, {merge:true})` for every `appConfig/global` write, unconditionally
(Pattern 3 above).
**Warning signs:** A save fails specifically on a fresh emulator/first-ever-deployed environment but appears
to work in a dev session where the doc already exists from a prior manual test write.

### Pitfall 2: Client defaults constant silently drifting from `DEFAULT_APP_CONFIG`
**What goes wrong:** A future change to `functions/src/appConfig.ts`'s `DEFAULT_APP_CONFIG` (e.g. raising
`aiProxy.maxTokensCeiling`'s default) is not mirrored in `src/config/appConfigDefaults.ts`, so the console
shows a stale `(default)` value that does not match what an unset field actually resolves to server-side.
**Why it happens:** There is no compile-time or test-time link between the two files — `src/` cannot import
`functions/`, so nothing forces them to agree.
**How to avoid:** Comment both files with an explicit cross-reference (per UI-SPEC's resolved decision #11);
optionally, add a lightweight unit test in `src/` that hard-codes the CURRENT known values and fails loudly if
someone edits one without the other (a values-snapshot test), so drift is caught at test time, not just by a
human noticing a stale docs comment. This is a testable seam worth adding even though it's not explicitly in
the UI-SPEC or CONTEXT.md — flag it in the plan as a nice-to-have hardening task.
**Warning signs:** A phase-69-adjacent PR changes a default value without touching `src/config/`.

### Pitfall 3: Treating `allowedModels`' comma-text field like every other text field
**What goes wrong:** Saving the raw comma-separated string (or an array containing empty-string entries from
trailing commas / extra whitespace) instead of a cleaned `string[]` either fails the coerce layer's
`filter((m) => typeof m === 'string' && m.trim().length > 0)` guard silently (dropping bad entries server-side
without the console ever showing why) or, worse, if the client accidentally saves a raw string instead of an
array, `coerceAllowedModels` falls back to the restrictive default list (fail-closed, per Phase 69 design) —
the save "succeeds" but the actual allow-list silently reverts to one model.
**Why it happens:** `allowedModels` is the one field on this whole surface that is NOT a boolean/number/plain
string — it needs its own split/trim/filter/require-non-empty logic before writing.
**How to avoid:** On save, `rawInput.split(',').map(s => s.trim()).filter(s => s.length > 0)`, and require the
resulting array to have `.length > 0` client-side (mirroring the UI-SPEC's stated required-array semantic)
before allowing Save — reject (don't silently clear) if the result would be empty.
**Warning signs:** A save "succeeds" with the Saved! toast but the effective-value display still shows the
old model list on the next `onSnapshot` update (because the coerce layer rejected the malformed write).

### Pitfall 4: Forgetting the `aiProxy.rateLimitPerDay >= rateLimitPerMin` cross-field rule
**What goes wrong:** A super-admin sets `rateLimitPerDay` lower than `rateLimitPerMin` (e.g. daily=10,
per-minute=20) — both individually pass their own min/max bounds, so a naive single-field validator lets the
save through, producing a nonsensical effective policy (the daily cap binds before the per-minute cap could
ever be reached in under a minute, at any sustained rate).
**Why it happens:** This is the one cross-field validation rule in the whole bounds table (UI-SPEC resolved
decision #6) — every other field validates independently.
**How to avoid:** When validating/saving `aiProxy.rateLimitPerDay`, also read the current effective
`rateLimitPerMin` value and block save with the UI-SPEC's specified inline message ("Daily limit must be at
least the per-minute limit.") if violated.
**Warning signs:** A component test that only asserts single-field min/max bounds and never asserts the
cross-field case would miss this — call it out explicitly in the plan's verification section.

### Pitfall 5: Mounting `OwnerConsoleView.vue`'s test with the OLD auth-store mock shape
**What goes wrong:** `OwnerConsoleView.vue` currently has NO test file at all (confirmed: `Glob` of
`src/views/__tests__/` found only `SettingsView.test.ts`, no `OwnerConsoleView.test.ts`). A plan that assumes
an existing test file to extend will find nothing; a plan that copies `SettingsView.test.ts`'s auth-store mock
verbatim will be missing `isSuperAdmin`, `user.email`, and won't cover the NEW `appConfig` store at all — the
mock needs to be built fresh (or as a stripped-down variant of `SettingsView.test.ts`'s `@/stores/auth` mock
factory PLUS a new `@/stores/appConfig` mock).
**Why it happens:** `OwnerConsoleView.vue`'s roster feature was verified by `npm run type-check` alone,
explicitly deferring UI-behavior coverage to manual UAT (per 68-04-SUMMARY.md's own D2/D3 rationale — "No
router-guard unit-test precedent exists," "grant/revoke... requires manual UAT"). This phase is the first to
need real component-test coverage of `OwnerConsoleView.vue`'s content.
**How to avoid:** Create `src/views/__tests__/OwnerConsoleView.test.ts` fresh (not editing a nonexistent one),
mocking BOTH `@/stores/auth` (a trimmed shape: `isSuperAdmin`, `user.email` at minimum — the existing roster
code in that file needs `authStore.user?.uid` too) and the new `@/stores/appConfig` (or mock
`onSnapshot`/`setDoc` directly via the same `firebase/firestore` `vi.mock` shape `SettingsView.test.ts`
already established, if the card components are tested standalone instead of through the parent view).
**Warning signs:** A plan task that says "extend OwnerConsoleView.test.ts" without first checking the file
exists.

## Code Examples

### Client-side defaults mirror (`src/config/appConfigDefaults.ts`)
```typescript
// Source: adapted directly from functions/src/appConfig.ts's AppConfig interface +
// DEFAULT_APP_CONFIG (verified 2026-08-20). This file is a DELIBERATE DUPLICATE, not
// an import — src/ (Vite) and functions/ (Cloud Functions) are separate build targets.
// If functions/src/appConfig.ts's DEFAULT_APP_CONFIG changes, this file must be
// updated by hand to match (see Pitfall 2 in 70-RESEARCH.md).
export interface AppConfig {
  cleanup: {
    mediaEnabled: boolean
    pptxRenderEnabled: boolean
    backgroundEnabled: boolean
    pptxSourceEnabled: boolean
  }
  retention: {
    mediaDays: number
    orphanRenderStaleHours: number
    backgroundDays: number
    pptxSourceDays: number
  }
  deleteCapPerRun: number
  aiProxy: {
    rateLimitPerMin: number
    rateLimitPerDay: number
    allowedModels: string[]
    maxTokensCeiling: number
  }
  messaging: {
    scheduledCronEnabled: boolean
    maxRecipients: number
    orgDailyEmailQuota: number
  }
  sender: { fromName: string; fromAddress: string }
  updatedBy?: string
  updatedAt?: unknown
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  cleanup: { mediaEnabled: false, pptxRenderEnabled: false, backgroundEnabled: false, pptxSourceEnabled: false },
  retention: { mediaDays: 30, orphanRenderStaleHours: 24, backgroundDays: 30, pptxSourceDays: 30 },
  deleteCapPerRun: 500,
  aiProxy: {
    rateLimitPerMin: 20,
    rateLimitPerDay: 500,
    allowedModels: ['claude-haiku-4-5-20251001'],
    maxTokensCeiling: 2048,
  },
  messaging: { scheduledCronEnabled: false, maxRecipients: 200, orgDailyEmailQuota: 1000 },
  sender: { fromName: '', fromAddress: 'onboarding@resend.dev' },
}

// A client-side mirror of functions/src/appConfig.ts's mergeAppConfig — deliberately
// per-group (not a naive recursive deep-merge) so a doc that sets only e.g.
// cleanup.mediaEnabled never wipes sibling cleanup defaults. Client validation
// already blocks obviously-bad saves, so this mirror does not need the full
// fail-open/fail-closed coerce* discipline the server copy has — it only needs to
// be forgiving of a partial/absent doc, matching R182's guarantee.
export function mergeAppConfig(raw: Partial<AppConfig> | undefined): AppConfig {
  const p = raw ?? {}
  return {
    cleanup: { ...DEFAULT_APP_CONFIG.cleanup, ...p.cleanup },
    retention: { ...DEFAULT_APP_CONFIG.retention, ...p.retention },
    deleteCapPerRun: p.deleteCapPerRun ?? DEFAULT_APP_CONFIG.deleteCapPerRun,
    aiProxy: { ...DEFAULT_APP_CONFIG.aiProxy, ...p.aiProxy },
    messaging: { ...DEFAULT_APP_CONFIG.messaging, ...p.messaging },
    sender: { ...DEFAULT_APP_CONFIG.sender, ...p.sender },
    ...(p.updatedBy ? { updatedBy: p.updatedBy } : {}),
    ...(p.updatedAt !== undefined ? { updatedAt: p.updatedAt } : {}),
  }
}
```

### Sender-form validation (R191/R192)
```typescript
// Source: reuses OwnerConsoleView.vue's existing isValidEmailFormat (line 161-164)
// verbatim, per UI-SPEC's resolved decision #5 — deliberately NOT a stricter regex.
function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

// The two confirmed-unreachable Firebase-managed hosts, named in
// functions/src/index.ts's own MESSAGE_FROM_ADDRESS comment and in R192.
const UNVERIFIABLE_HOST_PATTERNS = [/\.web\.app$/i, /\.firebaseapp\.com$/i]

function isUnverifiableHost(address: string): boolean {
  const at = address.lastIndexOf('@')
  if (at === -1) return false
  const host = address.slice(at + 1)
  return UNVERIFIABLE_HOST_PATTERNS.some((re) => re.test(host))
}
// Usage: format check gates Save (required); isUnverifiableHost only ever shows a
// non-blocking amber warning underneath the input (text-yellow-500) — never disables Save.
```

### Field-level min/max validation triad (retention example)
```typescript
// Source: adapted from SettingsView.vue's isSaveDisabled/isSlugSaveDisabled computed
// pattern (lines 732-747), extended with the UI-SPEC's numeric bounds table.
const mediaDaysInput = ref<number>(resolvedConfig.value.retention.mediaDays)

const mediaDaysError = computed<string | null>(() => {
  const n = mediaDaysInput.value
  if (!Number.isInteger(n)) return 'Must be a whole number.'
  if (n < 1) return 'Must be at least 1.'
  if (n > 365) return 'Must be 365 or less.'
  return null
})

const isMediaDaysSaveDisabled = computed(() =>
  mediaDaysError.value !== null ||
  mediaDaysInput.value === resolvedConfig.value.retention.mediaDays,
)
```

## Validation

Exact bounds, reproduced verbatim from 70-UI-SPEC.md's resolved decision #6 (authoritative — do not
re-derive):

| Field | AppConfig path | Min | Max | Required | Integer | Extra rule |
|-------|----------------|-----|-----|----------|---------|------------|
| Media retention (days) | `retention.mediaDays` | 1 | 365 | yes | yes | — |
| Orphan render staleness (hours) | `retention.orphanRenderStaleHours` | 1 | 720 | yes | yes | — |
| Background retention (days) | `retention.backgroundDays` | 1 | 365 | yes | yes | — |
| PPTX source retention (days) | `retention.pptxSourceDays` | 1 | 365 | yes | yes | — |
| Max deletions per run | `deleteCapPerRun` | 1 | 5000 | yes | yes | — |
| Requests per minute | `aiProxy.rateLimitPerMin` | 1 | 1000 | yes | yes | — |
| Requests per day | `aiProxy.rateLimitPerDay` | 1 | 100000 | yes | yes | must be ≥ `rateLimitPerMin` (see Pitfall 4) |
| Allowed models | `aiProxy.allowedModels` | — | — | yes (≥1 entry after split/trim/filter) | n/a | comma-split, trim each, drop empties |
| Max tokens per request | `aiProxy.maxTokensCeiling` | 1 | 200000 | yes | yes | — |
| Max recipients per message | `messaging.maxRecipients` | 1 | 5000 | yes | yes | — |
| Max emails per org per day | `messaging.orgDailyEmailQuota` | 1 | 50000 | yes | yes | — |
| Display name | `sender.fromName` | — | 100 chars | no | n/a | — |
| From address | `sender.fromAddress` | — | — | yes | n/a | email-shape check (`isValidEmailFormat`), plus non-blocking unverifiable-host warning |

`cleanup.*Enabled` (4 fields) and `messaging.scheduledCronEnabled` have no numeric bounds — booleans. The four
`cleanup.*Enabled` are read-only this phase regardless.

`[VERIFIED: functions/src/appConfig.ts]` — the fields, types, and default values above were read directly
from the shipped Phase 69 source. `[CITED: 70-UI-SPEC.md]` — the min/max bounds themselves are a UI-SPEC
design decision (not derivable from the coerce layer, which enforces no upper bound — see IN-02 below),
already checker-approved; treat as locked, not open for re-derivation during planning.

**Server-side backstop (confirmed from `functions/src/appConfig.ts`):**
- `coerceConfigNumber` / `coercePositiveInt`: reject negative/non-finite/malformed values, falling back to
  the default — but impose **no upper bound** on a well-formed value `[VERIFIED: functions/src/appConfig.ts:110-133]`.
  This is exactly why the UI-SPEC's per-field max values exist — per Phase 69's own code review finding
  (69-REVIEW.md IN-02, `functions/src/appConfig.ts:110-121`): "there is no ceiling on a *well-formed* value... very likely intentional... the client-side admin UI (Phase 70) is the natural place to add sane upper-bound guidance."
- `coerceEnableFlag`: fail-closed (only literal `true` enables) `[VERIFIED: functions/src/appConfig.ts:142-144]`.
- `coerceAllowedModels`: fail-closed to the restrictive default list on any non-array/empty/malformed value
  `[VERIFIED: functions/src/appConfig.ts:153-159]`.
- `coerceSender`: falls back to the DEFAULT sender values (`onboarding@resend.dev`) on any non-string
  `[VERIFIED: functions/src/appConfig.ts:164-173]` — not a security control, just crash-safety.

## No-Reply Sender (R191/R192) — Confirmed Findings

- **`fromAddress` is already consumed by the send path — this phase is display+write only.** Verified from
  `functions/src/appConfig.ts`'s module comment and `DEFAULT_APP_CONFIG.sender.fromAddress` (default
  `onboarding@resend.dev`, cited as replacing `MESSAGE_FROM_ADDRESS defineString default (index.ts:2488)`) —
  the read-site swap already happened in Phase 69 `[VERIFIED: functions/src/appConfig.ts]`. Phase 70 adds no
  new consumption logic; it only lets a super-admin write the value the send path already reads.
- **`fromName` is stored but intentionally dormant** — the `AppConfig.sender.fromName` field exists
  specifically "for Phase 70 forward-compatibility" but "no read-site consumes it... the per-message display
  name stays the org's own name" `[VERIFIED: functions/src/appConfig.ts:89-93]`. This matches CONTEXT.md's
  own note ("storing it here is forward-looking and harmless") — do not add functions-side wiring for
  `fromName` in this phase; that would be scope creep beyond R191/R192.
- **No secret field anywhere in the type.** `AppConfig.sender` has exactly two string fields
  (`fromName`, `fromAddress`) — no `apiKey`, no credential of any kind `[VERIFIED: functions/src/appConfig.ts:49-52]`.
  `RESEND_API_KEY` does not appear anywhere in `functions/src/appConfig.ts`; it is out of this type entirely,
  confirming R192's "never accepts or exposes provider secrets" is structurally true by construction, not
  merely a UI-layer promise.
- **The unverifiable-host warning is deliberately narrow** — two exact host-suffix patterns
  (`.web.app`, `.firebaseapp.com`), matching the two Firebase Hosting default domains the UI-SPEC cites as
  named in `functions/src/index.ts`'s own comment. This is a `[CITED: 70-UI-SPEC.md]` resolved decision, not
  independently re-derived — do not expand the deny-list to guess at other providers (Gmail, Outlook, etc.);
  that is explicitly out of R192's scope.

## Runtime State Inventory

Not applicable — this is a greenfield UI phase (new store, new components, new view section), not a
rename/refactor/migration. No existing runtime state changes name or shape.

## Common Pitfalls
See the dedicated `## Common Pitfalls` section above (placed earlier per template convention — content not
duplicated here).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Cleanup/AI/messaging/sender knobs read from `process.env`/`defineString`, requiring a Cloud Functions redeploy to change | Read from `appConfig/global` Firestore doc via `getAppConfig()`, live, no redeploy | Phase 69 (2026-08-20, same day) | This phase's console is the human-facing surface for that change — nothing in the runtime-config model itself is new to Phase 70 |
| Owner Console had a placeholder "Config-editor panels will appear here in a future release" section | This phase fills that exact placeholder | Phase 68 (2026-08-20) built the placeholder deliberately for this phase | No structural surprise — `OwnerConsoleView.vue`'s existing markup already anticipates this insertion point |

**Deprecated/outdated:** none within this phase's scope — everything it builds on (Phase 68 gate, Phase 69
config) shipped the same day and is current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A lightweight client-side unit test asserting `appConfigDefaults.ts` values match a hard-coded snapshot is a worthwhile hardening addition (not explicitly required by CONTEXT.md/UI-SPEC) | Pitfall 2 | Low — purely additive test coverage; omitting it does not break any requirement, only reduces drift-detection |
| A2 | `OwnerConsoleView.test.ts` needs to be created fresh, not extended, because no such file currently exists | Pitfall 5 / Validation Architecture | Low-Medium — verified directly via `Glob` of `src/views/__tests__/`, high confidence, but flagging as assumption since a plan could still choose to test the four cards in isolation instead of through the parent view (a valid alternative decomposition) |

**All other claims in this research are `[VERIFIED: <repo file>]` or `[CITED: 70-UI-SPEC.md / 70-CONTEXT.md]`** —
read directly from the phase's own already-approved design contract or from the shipped Phase 68/69 source.
No claim in this research rests on training-data knowledge about Firebase/Vue/Pinia APIs beyond what is
already proven working elsewhere in this exact codebase.

## Open Questions

1. **Should `saveField` accept a whole-object payload for `allowedModels` in one call, or is a single
   dot-path leaf key (`'aiProxy.allowedModels': [...]`) sufficient?**
   - What we know: `setDoc(...,{merge:true})` with a dot-path key containing an array value works identically
     to `updateDoc`'s dot-path semantics (arrays are replaced wholesale at that path, not merged element-wise
     — this is standard, unambiguous Firestore behavior, not a design question).
   - What's unclear: Nothing technical — flagging only because it's the one field whose "value" is a
     computed array derived from raw text input, unlike every other field's 1:1 input-to-value mapping.
   - Recommendation: Treat identically to every other field — `saveField('aiProxy.allowedModels', parsedArray)`.

2. **Does the plan need a dedicated `ConfigNumberField.vue`/`ConfigTextField.vue` component, or is per-card
   inline markup (11 near-identical blocks) acceptable?**
   - What we know: UI-SPEC's resolved decision #9 RECOMMENDS the two reusable field components "to avoid
     repeating the label + `(default)` badge + input + Save-button + status-triad block eleven times" but
     explicitly marks this "recommended, not mandated."
   - What's unclear: Whether the planner should treat this as a required task or leave it to executor
     discretion.
   - Recommendation: Strongly recommend building the two reusable components — 11 near-identical blocks
     inline would make `CleanupConfigCard.vue`/`AiProxyConfigCard.vue` unusually large and repetitive compared
     to every other card-based view in this codebase (which favor per-field inline blocks only when there are
     2-3 fields, not 5-9). The plan should make this a first task, not an afterthought, since every subsequent
     card task then consumes it.

## Environment Availability

Skipped — this phase has no new external dependency. Firebase (client SDK), the emulator (for local
verification, if used), and the existing `appConfig/global` doc + rules are all already present and proven
working from Phase 68/69. `.env.local` is required for any local dev/test session per this repo's own
CLAUDE.md, but that is a pre-existing repo-wide requirement, not something new to this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root config), `@vue/test-utils` for component mounts — both already installed and used identically by `SettingsView.test.ts` |
| Config file | `vite.config.ts`'s `test` block (jsdom environment); no new config needed |
| Quick run command | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` (or the new card component test files) |
| Full suite command | `npx vitest run` (excludes `src/rules.test.ts` and `render-service/**` per this repo's `vite.config.ts` — see CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| R186 | Effective value renders from a mocked `onSnapshot` payload (both "doc missing → default" and "doc present → merged" cases) | component (unit) | `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts -t "effective value"` | ❌ Wave 0 — file does not exist (Pitfall 5) |
| R186 | `(default)` badge reflects raw-doc presence, not resolved-value equality (e.g. explicitly saving `mediaDays: 30`, the default number, still clears the badge) | component (unit) | same file, `-t "default badge"` | ❌ Wave 0 |
| R186 | Global provenance stamp renders `updatedBy`/`updatedAt` when present, renders nothing when absent | component (unit) | same file, `-t "provenance"` | ❌ Wave 0 |
| R187 | Save button disabled until value is both valid AND dirty; enabling it and clicking calls `setDoc` with the correct dot-path key and `{merge:true}` | component (unit) | same file, `-t "save"` (assert against a mocked `firebase/firestore` `setDoc` spy, same mock shape as `SettingsView.test.ts`'s `mockUpdateDoc`) | ❌ Wave 0 |
| R187 | A value outside min/max shows the inline error and blocks Save (per-field, at least one boundary case per field group) | component (unit) | same file, `-t "validation"` | ❌ Wave 0 |
| R187 | Cross-field rule: `rateLimitPerDay < rateLimitPerMin` blocks save with the specific inline message | component (unit) | same file, `-t "cross-field"` | ❌ Wave 0 |
| R187 | Save failure (rejected `setDoc` promise) shows the generic error line and reverts the toggle/input | component (unit) | same file, `-t "save error"` | ❌ Wave 0 |
| R191 | `fromAddress` format validation blocks Save on an invalid shape; a valid save calls `setDoc` with the trimmed address | component (unit) | same file, `-t "sender"` | ❌ Wave 0 |
| R192 | Sender form never renders any input/label referencing a secret/API key (a negative assertion: `wrapper.text()` does not contain "RESEND_API_KEY"/"secret"/"api key") | component (unit) | same file, `-t "no secret"` | ❌ Wave 0 |
| R192 | `.web.app`/`.firebaseapp.com` address shows the amber warning; a normal custom domain does not; the warning never disables Save | component (unit) | same file, `-t "unverifiable host"` | ❌ Wave 0 |
| R186/R187 | The four cleanup toggles render `disabled`, reflect live state, and have no click handler / no save state (negative test: clicking does not call `setDoc`) | component (unit) | same file, `-t "cleanup read-only"` | ❌ Wave 0 |

**Genuinely manual-only (not component-testable, deferred to `/gsd-verify-work 70`):**
- The full live round-trip: a real super-admin session saving a field, observing the write actually land in a
  real (or emulated) Firestore `appConfig/global` doc, and a subsequent page load showing the persisted value
  — requires either the Firestore emulator or a real deployed environment, neither of which this phase's
  component tests exercise (they mock `firebase/firestore` entirely, per `SettingsView.test.ts`'s established
  pattern).
- Confirming a saved `retention.mediaDays` value is actually picked up by the real `cleanupMedia` cron without
  a redeploy — that is Phase 69's already-shipped behavior, out of this phase's verification scope, but worth
  a spot-check during UAT since it's the whole point of the milestone.
- Confirming a saved `sender.fromAddress` on a genuinely Resend-verified custom domain results in a
  successfully delivered email — requires a live Resend account + DNS setup, entirely outside this codebase's
  test harness.
- Router-guard / nav-visibility behavior for `/owner-console` itself is Phase 68's existing manual-UAT-deferred
  item (68-04-SUMMARY.md), not re-tested here.

### Sampling Rate
- **Per task commit:** `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` (or per-card test files,
  if the plan splits card components into their own test files)
- **Per wave merge:** `npx vitest run` (full app-suite baseline — 2 known-failing files per CLAUDE.md,
  unrelated to this phase)
- **Phase gate:** `npm run type-check` (vue-tsc --build, checks `.vue` + test files — per CLAUDE.md's own
  documented gap between this and the narrower `-p tsconfig.app.json` form) + full suite green before
  `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/views/__tests__/OwnerConsoleView.test.ts` — new file (or per-card test files under
      `src/components/admin/__tests__/`) covering R186/R187/R191/R192 per the table above. No existing test
      file to extend (Pitfall 5) — this is a genuinely new test surface, not an extension.
- [ ] `firebase/firestore` mock additions: the existing `SettingsView.test.ts` mock shape already covers
      `doc`/`setDoc`/`onSnapshot`/`serverTimestamp` — a new test file should reuse the same `vi.hoisted`
      mock-factory pattern (see `SettingsView.test.ts` lines 28-60) rather than inventing a new one.
- [ ] `@/stores/auth` mock extension (or reuse): needs `isSuperAdmin`, `user.email`/`user.uid` at minimum —
      `SettingsView.test.ts`'s existing mock does not cover `user`/`isSuperAdmin` (it mocks `orgId`/`orgName`/
      `isEditor`/etc. only); build a trimmed mock matching what `OwnerConsoleView.vue` + the new cards
      actually read.
- [ ] Framework install: none — Vitest/`@vue/test-utils` already installed and configured.

## Security Domain

`security_enforcement` is not explicitly set to `false` in `.planning/config.json` (not checked directly in
this research pass, but per default-enabled convention this section is included).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Indirect | Already enforced upstream (Phase 68's `superAdmin` custom claim + Firebase Auth) — this phase reads `authStore.isSuperAdmin`/`authStore.user` but does not implement authentication itself |
| V3 Session Management | No | No new session concept introduced |
| V4 Access Control | Yes | `firestore.rules`' `isSuperAdmin()` claim check (Phase 68, unmodified) is the ACTUAL access-control boundary for `appConfig/*`; this phase's client route guard (`requiresSuperAdmin`, Phase 68) is convenience-only, never the enforcement point — per this codebase's own documented `storage.rules` incident (CLAUDE.md), client-only gating without a server-side rule is exactly the mistake class to avoid, and it is already avoided here since the rule predates this phase |
| V5 Input Validation | Yes | Plain cast-and-guard (`Number(...)`, min/max/required checks) client-side, per the Standard Stack decision above — NOT a security boundary on its own (see below), backstopped by Phase 69's `coerce*` functions server-side |
| V6 Cryptography | No | No cryptographic operation in this phase |
| V9 Communications | No | No new network call introduced — all writes go through the existing Firestore SDK's TLS channel |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A non-super-admin attempts to write `appConfig/global` directly (bypassing the UI entirely, e.g. via browser devtools console with the Firestore SDK) | Elevation of Privilege | Already mitigated — Phase 68's `firestore.rules` `isSuperAdmin()` check is claim-based (reads only the caller's own auth token, no cross-document lookup), independent of any client code this phase writes. **This phase must not weaken that boundary** — e.g. must not add a callable/API route that bypasses the rule, and must not rely on the client's `isSaveDisabled` computed property as a security control (it is UX-only) |
| A malformed/out-of-range value is written to `appConfig/global` (whether via a UI bug or a direct write) and then read by a Cloud Function, widening effective authority (e.g. `deleteCapPerRun: 999999999`) | Tampering | Already mitigated server-side by Phase 69's `coerce*` layer — a malformed value falls back to a safe default (fail-closed for booleans/allow-list) or is honored as-is only within the type's natural bounds (numbers — no server-side upper-bound ceiling, which is exactly why this phase's client-side max values (see Validation table) exist as the sensible-maximum guard, per Phase 69's own review finding IN-02). This phase's validation is a UX/sanity guard, not the security boundary |
| A secret (`RESEND_API_KEY`) is accidentally added to the `AppConfig.sender` type in a future edit, making it readable by any super-admin's `onSnapshot` listener (and, since `firestore.rules` scopes `appConfig/*` to super-admins not "no one," it would still be a broader-than-necessary exposure of a service credential to N people instead of 0) | Information Disclosure | Structurally prevented today (`AppConfig.sender` has exactly `fromName`/`fromAddress`, verified). This phase must not add any field resembling a credential to the sender form or the underlying type — R192 is explicit on this |

## Sources

### Primary (HIGH confidence — direct repo inspection, `[VERIFIED]`)
- `functions/src/appConfig.ts` — `AppConfig` type, `DEFAULT_APP_CONFIG`, `coerce*` functions, `mergeAppConfig`, `getAppConfig` TTL-cache mechanics
- `src/views/OwnerConsoleView.vue` — the Phase 68 shell, roster pattern, `isValidEmailFormat`, `formatDate`, placeholder insertion point
- `src/views/SettingsView.vue` — card layout, dot-path `updateDoc` save triad, dirty-check computed pattern, toggle-with-revert pattern
- `src/stores/auth.ts` — `onSnapshot` lifecycle pattern (`memberUnsub`), `isSuperAdmin`/`refreshSuperAdminClaim`, the one existing `setDoc(...,{merge:true})` call (`ensureUserDocument`)
- `src/views/__tests__/SettingsView.test.ts` — component-test mock shape (`vi.hoisted` firebase/firestore mock, auth-store getter/setter mock factory)
- `firestore.rules` — `isSuperAdmin()` helper (lines 38-40), `appConfig/*` match block (lines 468-475, `allow read, write: if isSuperAdmin()`)
- `.planning/phases/70-admin-console-ui/70-CONTEXT.md` — locked decisions
- `.planning/phases/70-admin-console-ui/70-UI-SPEC.md` — checker-approved design contract (bounds table, write mechanics, component inventory)
- `.planning/phases/69-firestore-runtime-config/69-REVIEW.md` — IN-02 finding (no server-side upper bound on numeric knobs)
- `.planning/phases/68-super-admin-access-gate/68-04-SUMMARY.md` — confirms `OwnerConsoleView.vue` currently has no dedicated test file, and confirms the placeholder section's intent
- `.planning/REQUIREMENTS.md` — R186, R187, R191, R192 exact wording
- `package.json` — installed `firebase@^12.0.0`, `pinia@^3.0.4`, `vue@^3.5.29` versions
- `vite.config.ts` — test suite scoping/exclude rules

### Secondary (MEDIUM confidence, `[CITED]`)
- `.planning/research/SUMMARY.md` / `FEATURES.md` — milestone-level research confirming zero new dependency,
  reused Pinia/`onSnapshot` pattern, and the no-reply-sender scope boundary; produced by an earlier
  research pass in this same milestone, cross-checked directly against the shipped Phase 68/69 code above

### Tertiary (LOW confidence)
- None — no WebSearch/external-provider lookups were needed for this phase; every technical question was
  resolvable by reading this repo's own already-shipped source and its own already-approved design contract.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every API already proven working identically elsewhere in this exact codebase
- Architecture: HIGH — every pattern (onSnapshot store, dot-path setDoc, deep-merge, presence-based badge) is either lifted directly from shipped code or the checker-approved UI-SPEC
- Pitfalls: HIGH — grounded in direct comparison of `appConfig/global`'s existence-guarantee (none) vs. `organizations/{orgId}`'s (guaranteed), a genuine structural difference this codebase has not previously had to handle, plus a confirmed absence of an existing `OwnerConsoleView.test.ts` file

**Research date:** 2026-08-20
**Valid until:** 2026-09-19 (30 days — stable, no external API surface, this phase's only dependency is on already-shipped, closed Phase 68/69 code that will not change during this phase's execution window)
