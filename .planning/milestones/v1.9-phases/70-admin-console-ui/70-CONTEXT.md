# Phase 70: Admin Console UI & No-Reply Sender - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-resolved from research/SUMMARY.md + FEATURES.md + REQUIREMENTS.md under the v1.9 autonomy grant; recommended answers accepted, consistent with the existing SettingsView.vue design system)

<domain>
## Phase Boundary

Fill the Owner Console shell (built in Phase 68's 68-04 `OwnerConsoleView.vue`) with the human-usable surface
on top of Phase 69's runtime config: display and edit every managed setting with validation + provenance, and
let the owner configure the app's no-reply sender.

**In scope (R186, R187, R191, R192):**
- Display the current EFFECTIVE value of every managed setting, grouped by area (cleanup, AI proxy, messaging,
  sender), each with a last-changed-by / last-changed-at stamp (R186).
- Inline edit each managed toggle/number/text with min/max/required validation; save persists to
  `appConfig/global` (R187).
- A no-reply sender form (display name + address), format-validated, with the "must be a Resend-verified
  domain" warning; the address is already wired into the send path in Phase 69 (R191).
- The sender form never accepts/exposes provider secrets (`RESEND_API_KEY` stays server-side) (R192).

**Out of scope (other phases):** the super-admin claim/gate/roster (Phase 68 — done); the `appConfig/global`
doc + Cloud Functions reading it (Phase 69 — done); **the four `*_CLEANUP_ENABLED` deletion toggles' safe
flip flow — dry-run blast-radius preview + confirm-to-flip — is Phase 71 (R188–R190).** This phase renders
those four toggles READ-ONLY with a "managed via the safety flow" note; Phase 71 makes them flippable.
</domain>

<decisions>
## Implementation Decisions

### Layout & components (R186)
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

### Editing & save (R187)
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

### No-reply sender (R191, R192)
- A Sender card with `fromName` (display name) + `fromAddress` (the app-owned no-reply address). Format-
  validate the address (basic email shape). If the address host is un-verifiable (e.g. `*.web.app`, or a bare
  non-custom domain), surface a non-blocking warning: **"must be a Resend-verified domain"** (domain
  verification is an out-of-band owner action — the console stores a validated address, it cannot verify a
  domain).
- The form has NO secret field — `RESEND_API_KEY` is never entered or shown. `fromAddress` is wired into the
  send path already (Phase 69); `fromName` is stored (Phase 69 left it dormant — the per-message display name
  stays the org name for now; storing it here is forward-looking and harmless).

### Cleanup-enable toggles (scope fence with Phase 71)
- Render the four `cleanup.*Enabled` flags READ-ONLY in Phase 70 (show current state + a note like "Enabling
  a deletion cleanup uses the dry-run safety flow"), so this phase NEVER ships a bare one-click deletion
  toggle. Phase 71 (R188–R190) adds the dry-run blast-radius preview + confirm-to-flip that makes them
  editable. All OTHER settings (retention windows, delete cap, AI knobs, messaging caps, sender) are fully
  editable here.

### Deploy-time settings (R185 display, optional)
- Optionally show `AI_PROXY_MAX_INSTANCES` / `GLOBAL_MAX_INSTANCES` / render caps as a small READ-ONLY
  "Deploy-time settings (requires redeploy)" note — clearly not editable. Keep minimal; acceptable to omit if
  it adds noise, but if shown it MUST be read-only and labeled.

### Deploy discipline (v1.9 grant)
- Client-only UI — ships built + tested. No functions/rules change is required (rules + config already exist).
  If any rules tweak is added, it's owner-hand-over. No deploys, no `.env.local` writes.

### Claude's Discretion
- Exact component decomposition (one big view vs. per-area child components), the store shape (`admin.ts`
  extended, or a new `appConfig` store), field labels/help text, and whether provenance is per-area or global.
- Whether to add the read-only deploy-time note (R185 display) — include it if it's cheap and clear.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/views/OwnerConsoleView.vue` (Phase 68 68-04) — the shell + super-admin roster; extend it with the
  config panels (it left a labeled placeholder section for exactly this).
- `src/views/SettingsView.vue` — the card layout, form controls, scoped dot-path save pattern, and inline
  validation style to mirror (no validation library — plain `Number(...)`/guard).
- `src/stores/auth.ts` — `isSuperAdmin`; the org-settings `onSnapshot`+dot-path-write store pattern to mirror
  for an `appConfig/global` store.
- `functions/src/appConfig.ts` — `AppConfig` type + `DEFAULT_APP_CONFIG` (Phase 69); the client defaults
  mirror must match these values (flag the coupling; ideally share the shape/defaults).
- The Phase 68 `firestore.rules` `appConfig/*` = `isSuperAdmin()` gate — permits these client writes.

### Established Patterns
- Pinia `onSnapshot` stores; scoped Firestore dot-path leaf writes with `serverTimestamp()`; dark-theme cards;
  editor-gated UI. Type gate `npm run type-check` (vue-tsc --build) checks .vue + tests.

### Integration Points
- `OwnerConsoleView.vue` gains the config panels; a store reads/writes `appConfig/global`; the client
  defaults mirror couples to `functions/src/appConfig.ts`'s `DEFAULT_APP_CONFIG`.
</code_context>

<specifics>
## Specific Ideas
- The client must show the EFFECTIVE value (deep-merged with defaults), not blank-for-unset — the owner needs
  to see what's actually in force. Label explicitly-set vs default.
- Enforce upper bounds in the form (Phase 69 review Info-2) — the functions coerce layer only guards the lower
  end / type, so the form is the sensible-maximum guard.
- Never render an editable one-click deletion toggle here — that flow is Phase 71's dry-run-gated job.
</specifics>

<deferred>
## Deferred Ideas
- Dry-run cleanup blast-radius preview + confirm-to-flip for the four `*_CLEANUP_ENABLED` toggles → Phase 71.
- Full audit-log history of config changes (vs. the single `updatedBy`/`updatedAt` stamp) → out of scope
  (REQUIREMENTS Future).
- In-app `aiUsage` ledger / dry-run cleanup-log dashboards → out of scope (Future R169).
- Per-org config overrides → out of scope (single/few-org app today).
</deferred>
