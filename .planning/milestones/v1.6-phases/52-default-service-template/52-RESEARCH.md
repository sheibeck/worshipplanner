# Phase 52: Default Service Template - Research

**Researched:** 2026-08-11
**Domain:** Vue 3 SFC refactor — relocate/rename UI + reverse a creation-default + thread one optional field
**Confidence:** HIGH (every seam read at file:line in this session; no external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **R113 — Relocate template editor to the Services page.** Move the `<ServiceTemplateEditor :is-open @close>` mount + its trigger from `SettingsView.vue`'s "Services" card to `ServicesView.vue`, opened by a cog/settings icon in the Services page header/action area. Remove the "Services" card from `SettingsView.vue` entirely (heading, description, summary line, button, mount, import). Cog is editor-gated the same way the current button is (`authStore.isEditor`). `ServiceTemplateEditor.vue` is structurally unchanged — only its mount point moves (it teleports/slides out, works from either host).
- **R114 — "Suggested Template", decoupled from Vertical Worship.** Rename the seed control (currently "Reset to 1-2-3 default", wired to `onResetClick`/`applyReset`) to **"Suggested Template"**. Remove any `v-if`/visibility tie to `vwModeEnabled` on that button. Seed CONTENT stays `buildSlots('1-2-2-3')`-derived but is reframed as "suggested starting template," not a VW artifact. Keep the confirm-on-non-empty-draft guard.
- **R115 — Every new service starts from the Suggested Template (supersedes v1.5 Phase 44 Success Criterion #2).** Mechanism: **fallback at the `createService` call site, NOT a data migration.** When `defaultServiceTemplate` is empty/unset, seed from the Suggested Template preset instead of `[]`. Keep `buildSlotsFromTemplate` PURE (no `buildSlots()` fallback inside it). VW types still applied at creation when `vwModeEnabled`. Update the now-stale comments in `createService` and `buildSlotsFromTemplate`'s docstring.
- **R116 — Miscellaneous body input inside the template.** Add optional `body?: string` to `ServiceTemplateEntry`. Expose the same body `<textarea>` the live editor uses, shown for MISC template entries (and any body-bearing kind the live editor treats the same way). Thread `body` through `buildSlotsFromTemplate` → `createSlot` so a template MISC entry with a pre-filled body produces a service MISC slot carrying that body. Keep the `switch(kind)` exhaustive (no `default`, vue-tsc `--build` clean). No data migration.

### Claude's Discretion
- Exact cog icon/placement on the Services page.
- The precise mechanism for expressing the suggested-template fallback (resolve-effective-template helper vs. inline), subject to keeping `buildSlotsFromTemplate` pure.
- How `body` is threaded (createSlot param vs. post-create assignment), subject to exhaustiveness (`npm run type-check` clean) and no data migration.

### Deferred Ideas (OUT OF SCOPE)
- None. (Item notes-field beside selectors is Phase 54; Misc-items-default-to-no-slides behavior is Phase 54.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R113 | Relocate the default-template editor from Settings to a cog on the Services page | Exact removal block `SettingsView.vue:462-479` (card) + `:482` (mount) + `:492/495/496` (imports) + `:597` (ref) + `:599-613` (computed). Exact host seam `ServicesView.vue:39-52` (action bar) + `:165-172` (dialog mount area). Component is host-agnostic (Teleport-to-body, no scrim). |
| R114 | Rename seed button to "Suggested Template"; decouple from Vertical Worship | Button at `ServiceTemplateEditor.vue:179-185`; confirm copy `:160-176`; empty-state copy `:44-48`. **No `vwModeEnabled` reference exists anywhere in the component** — VW decoupling is rename/copy-only at code level. |
| R115 | Every new service starts from the Suggested Template — no blank path | Call site `services.ts:233-244`; purity contract `slotTypes.ts:339-380`; preset content `applyReset` at `ServiceTemplateEditor.vue:438-446`. Centralize preset in `slotTypes.ts`; resolve effective template at the caller. |
| R116 | Miscellaneous template entries expose a body input; body flows to the created slot | `ServiceTemplateEntry` at `organization.ts:12-16`; `NonAssignableSlot.body?` already exists `service.ts:73-88`; live-editor body textarea pattern `ServiceEditorView.vue:1082-1103`; `createSlot` `slotTypes.ts:78-122`; `buildSlotsFromTemplate` `slotTypes.ts:362-380`. Firestore is schemaless — persistence path handles the extra field for free. |
</phase_requirements>

## Summary

This is a pure in-repo Vue 3 + TypeScript refactor across five files, with **no new dependencies, no external services, and no data migration.** Every seam was read at file:line in this session and the wiring hypotheses in CONTEXT.md were validated against the real code — all four hold, with one notable simplification.

**R113** is a mechanical move: the "Services" card in `SettingsView.vue` (`462-479`), its `<ServiceTemplateEditor>` mount (`482`), and its supporting import/ref/computed all come out; a cog trigger + the same mount go into `ServicesView.vue`'s action bar next to the "New Service" button. The editor component itself needs zero structural change — it Teleports to `body` with no scrim, so it renders identically from either host. **R114** is smaller than the requirement text implies: `vwModeEnabled` appears **nowhere** in `ServiceTemplateEditor.vue`, so there is no VW `v-if` to remove — the change is a label rename ("Reset to 1-2-3 default" → "Suggested Template") plus rewording three copy strings. **R115** reverses Phase 44's owner-overridden empty-default by resolving an *effective* template at the `createService` call site (empty → suggested preset) while leaving `buildSlotsFromTemplate` pure (its `[]`→`[]` contract, pinned by `slotTypes.test.ts:798`, must stay). **R116** adds an optional `body?: string` to `ServiceTemplateEntry`, a MISC textarea mirroring `ServiceEditorView.vue:1092`, and a 4th optional `body` param to `createSlot` that preserves the current absent-body shape when unset (pinned by `slotTypes.test.ts:643,656`).

**Primary recommendation:** Centralize the suggested-template content in ONE new exported helper in `slotTypes.ts` (`buildSuggestedTemplateEntries()`), consumed by both `applyReset` (R114 button) and the `createService` fallback (R115), so the preset can never fork into two copies. Thread `body` as `createSlot`'s 4th optional param, set only inside the MESSAGE/ANNOUNCEMENTS/MISC arms.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cog trigger + editor mount placement (R113) | Frontend view (`ServicesView.vue`) | — | The editor is a page-scoped settings surface; it belongs on the page whose data it configures, matching the "New Service" control's home. |
| Seed-button label + copy (R114) | Frontend component (`ServiceTemplateEditor.vue`) | — | Pure presentation; no store/data change. |
| New-service slot seeding (R115) | Store action (`services.ts::createService`) | Pure util (`slotTypes.ts`) | "Which template applies to a new service" is a creation-time decision the store owns; the util stays a pure transform. |
| Template→slot field threading (R116) | Pure util (`slotTypes.ts`: `createSlot`/`buildSlotsFromTemplate`) | Type (`organization.ts`), Component (`ServiceTemplateEditor.vue`) | Field flow is data-shaping (util); the type gains a field; the component gains an input. |
| Body persistence | Firestore (schemaless) | — | `onSave` mirror-writes `settings.defaultServiceTemplate` as a whole array via `stripUndefined`; an extra `body` key needs no schema change. |

## Standard Stack

No new libraries. Everything reuses in-repo building blocks.

### Core (existing, reused)
| Module | Purpose | Role in this phase |
|--------|---------|--------------------|
| `src/utils/slotTypes.ts` | Slot factory + template→slots transform | `buildSlots('1-2-2-3')` (preset content), `buildSlotsFromTemplate` (stays pure), `createSlot` (gains `body`), NEW `buildSuggestedTemplateEntries()` |
| `src/components/settings/ServiceTemplateEditor.vue` | Slide-out template editor (Phase 44 + Phase 51 drag) | Rename seed button (R114); add MISC body textarea (R116) |
| `src/views/ServicesView.vue` | Services listing page | New host for cog trigger + editor mount (R113) |
| `src/views/SettingsView.vue` | Settings page | Remove the "Services" card + supporting code (R113) |
| `src/stores/services.ts` | Service CRUD store | `createService` resolves effective template (R115) |
| `src/types/organization.ts` | `ServiceTemplateEntry` / `OrgSettings` | Add `body?: string` to `ServiceTemplateEntry` (R116); update stale docstring (R115) |
| `src/types/service.ts` | `NonAssignableSlot.body?` | Already exists (Phase 43) — no change, just the target field |

**Installation:** None. No `npm install`.

## Package Legitimacy Audit

**N/A** — this phase installs no external packages. All work is against existing in-repo modules. No registry verification required.

## Architecture Patterns

### Data flow (R115 creation path, after change)

```
NewServiceDialog ──create──▶ ServicesView.onCreateService
                                     │
                                     ▼
                    services.ts::createService(data)
                                     │
             ┌───────────────────────┴───────────────────────┐
             │ authStore.settings.defaultServiceTemplate      │
             │   .length > 0  ? use it                        │  ← NEW: resolve effective template
             │              : buildSuggestedTemplateEntries() │     (empty/unset → suggested preset)
             └───────────────────────┬───────────────────────┘
                                     ▼
        buildSlotsFromTemplate(effectiveTemplate, vwModeEnabled)   ← STAYS PURE ([]→[])
                                     │  (applies VW ordinal to SONG entries when vwModeEnabled)
                                     ▼
                             ServiceSlot[]  ──addDoc──▶ Firestore
```

```
ServiceTemplateEditor "Suggested Template" button ──▶ applyReset()
                                     │
                                     ▼
                      buildSuggestedTemplateEntries()    ← ONE shared definition (same as createService fallback)
                                     │  (fresh crypto.randomUUID per entry for draft keys)
                                     ▼
                              draft: ServiceTemplateEntry[]
```

### Pattern 1: Centralized suggested-template preset (R114 + R115 share ONE definition)
**What:** A single exported function in `slotTypes.ts` builds the suggested template's `ServiceTemplateEntry[]` from `buildSlots('1-2-2-3')`. It mints fresh ids each call (the editor's draft needs unique per-row keys; `buildSlotsFromTemplate` ignores `entry.id` entirely, so ids are harmless for the createService path).
**When to use:** Both the R114 button (`applyReset`) and the R115 `createService` fallback call it — never two copies of the content.
**Example:**
```typescript
// src/utils/slotTypes.ts — NEW export, derived from the existing applyReset body
// (currently ServiceTemplateEditor.vue:440-444)
export function buildSuggestedTemplateEntries(): ServiceTemplateEntry[] {
  return buildSlots('1-2-2-3').map((slot) => ({
    id: crypto.randomUUID(),
    kind: slot.kind,
    ...(slot.section ? { section: slot.section } : {}),
  }))
}
```
```typescript
// src/components/settings/ServiceTemplateEditor.vue — applyReset shrinks to a one-liner
function applyReset(): void {
  if (!authStore.isEditor) return
  draft.value = buildSuggestedTemplateEntries()
  showResetConfirm.value = false
}
// import { buildSlots, ... } → import { buildSuggestedTemplateEntries, ... }  (buildSlots no longer needed here)
```
```typescript
// src/stores/services.ts::createService — resolve effective template at the call site (R115)
const authStore = useAuthStore()
const stored = authStore.settings.defaultServiceTemplate
const effective = stored.length > 0 ? stored : buildSuggestedTemplateEntries()
const slots = buildSlotsFromTemplate(effective, authStore.settings.vwModeEnabled)
```

### Pattern 2: Thread `body` as `createSlot`'s 4th optional param (R116)
**What:** Add `body?: string` after `section` in `createSlot`'s signature; set it only in the MESSAGE/ANNOUNCEMENTS/MISC arms, preserving the absent-body shape when unset.
**When to use:** `buildSlotsFromTemplate` passes `entry.body` through; non-body kinds ignore it.
**Example:**
```typescript
// src/utils/slotTypes.ts::createSlot
export function createSlot(
  kind: SlotKind,
  vwType?: VWType,
  section?: ServiceSection,
  body?: string,          // NEW — optional, backward-compatible
): ServiceSlot {
  const sectionFields = section ? { section } : {}
  const bodyFields = body ? { body } : {}   // absent when unset → keeps legacy shape (T-44/slotTypes tests 643,656)
  const id = crypto.randomUUID()
  switch (kind) {
    // ... SONG / SCRIPTURE / PRAYER unchanged ...
    case 'MESSAGE':
      return { kind: 'MESSAGE', id, position: 0, ...bodyFields, ...sectionFields } as NonAssignableSlot
    case 'ANNOUNCEMENTS':
      return { kind: 'ANNOUNCEMENTS', id, position: 0, ...bodyFields, ...sectionFields } as NonAssignableSlot
    case 'MISC':
      return { kind: 'MISC', id, position: 0, ...bodyFields, ...sectionFields } as NonAssignableSlot
    // ... HYMN / IMPORTED unchanged; switch stays exhaustive, no default ...
  }
}
```
```typescript
// src/utils/slotTypes.ts::buildSlotsFromTemplate — pass entry.body through
slots.push(createSlot(entry.kind, vwType, entry.section, entry.body))
```
```vue
<!-- src/components/settings/ServiceTemplateEditor.vue — MISC (and body-bearing) textarea,
     mirroring ServiceEditorView.vue:1092-1100. Bind to the draft entry's body. -->
<textarea
  v-if="entry.kind === 'MISC'"
  :value="entry.body ?? ''"
  @input="onBodyChange(entry.id, ($event.target as HTMLTextAreaElement).value)"
  rows="2"
  placeholder="Recurring notes for this item…"
  data-testid="template-item-body"
  class="..."
></textarea>
```

### Anti-Patterns to Avoid
- **Reinstating `buildSlots()` inside `buildSlotsFromTemplate`.** Its docstring forbids it and `slotTypes.test.ts:798` pins `buildSlotsFromTemplate([], true) === []`. The fallback is the *caller's* decision (R115), expressed at `createService`.
- **Two copies of the suggested-template content.** If `applyReset` keeps its own `buildSlots('1-2-2-3').map(...)` while `createService` grows a second copy, they will drift. Centralize (Pattern 1).
- **Setting `body: ''` (or `undefined`) unconditionally in `createSlot`.** Firestore rejects raw `undefined` (see `stripUndefined` usage), and `body: ''` breaks `slotTypes.test.ts:643,656` which assert `'body' in slot === false` for a bodyless MISC/ANNOUNCEMENTS. Use the `...bodyFields` spread so the key is absent when unset.
- **Renaming existing `data-testid`s.** Tests key off `template-reset`, `open-template-editor`, `service-template-editor`, `template-summary`. Rename button *label text*, not the testid, to avoid needless test churn (see Common Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Suggested-template content | A new hardcoded entry list | `buildSuggestedTemplateEntries()` derived from `buildSlots('1-2-2-3')` | One source of truth; VW/section defaults already encoded in `buildSlots` |
| MISC body input | A bespoke textarea/validation | Copy `ServiceEditorView.vue:1092-1100`'s textarea shape | Same field (`body`), same escaping, same UX the live editor already ships |
| Slide-out panel host | A new modal/drawer for the Services page | The existing `ServiceTemplateEditor` (Teleport-to-body) as-is | It is host-agnostic; only the trigger + `:is-open` binding move |
| Empty→suggested resolution | Logic inside the pure util | An explicit `stored.length > 0 ? stored : suggested` at `createService` | Keeps the util pure and testable; matches the locked "caller decides" contract |

**Key insight:** Every primitive already exists. This phase is wiring and copy, not new machinery.

## Runtime State Inventory

> Included because R115 changes creation-default behavior; verified there is nothing to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `organizations/{orgId}.settings.defaultServiceTemplate` (array of `{id,kind,section}`). R115 is a **fallback at read/creation time**, not a rewrite — stored empty arrays stay empty; the suggested preset is substituted only in-memory at `createService`. R116 adds `body?` which future saves may write; existing entries simply lack the key (schemaless). | **None.** No migration. Explicitly excluded by the locked decision. |
| Live service config | Existing `services/{id}.slots` already carry `NonAssignableSlot.body?` (Phase 43). No change to already-created services. | None. |
| OS-registered state | None. | None — verified (no scheduler/daemon touches this data). |
| Secrets/env vars | None referenced by these changes. | None. |
| Build artifacts | None — source-only Vue/TS changes; Vite HMR/rebuild covers it. | None. |

**The canonical question — after every file is updated, what still holds the old behavior?** Nothing persistent. The only behavioral reversal (empty template → suggested slots) lives entirely in `createService`'s in-memory resolution; no stored document encodes the old "empty → empty service" rule.

## Common Pitfalls

### Pitfall 1: Keep `buildSlotsFromTemplate` pure — the test pins it
**What goes wrong:** A tempting "fix" puts the suggested fallback inside `buildSlotsFromTemplate`.
**Why it happens:** It reads as the natural home for "what if the template is empty."
**How to avoid:** Resolve the effective template at `createService`. `slotTypes.test.ts:798` (`buildSlotsFromTemplate([], true)` → `[]`) will fail loudly if you don't.
**Warning signs:** That test turns red; the util's docstring (`slotTypes.ts:357-360`) contradicts your code.

### Pitfall 2: The `createSlot(MISC)`/`(ANNOUNCEMENTS)` "omits body entirely" tests
**What goes wrong:** Adding `body` to `createSlot` as `body: body ?? ''` (or always-present) breaks `slotTypes.test.ts:643` and `:656`, which assert `'body' in slot === false` for a bodyless call.
**How to avoid:** Use the `...(body ? { body } : {})` spread (Pattern 2). Bodyless calls keep the legacy shape; those tests stay green.
**Warning signs:** Two `ANNOUNCEMENTS and MISC (43-01)` tests fail.

### Pitfall 3: Dead imports in `SettingsView.vue` after card removal
**What goes wrong:** Removing the Services card leaves `groupBySection` (`:495`) and `SERVICE_SECTIONS` (`:496`) imported but unused — both are used ONLY by the `templateSummary` computed (`:601-609`), which is being deleted.
**How to avoid:** Remove those two imports, the `ServiceTemplateEditor` import (`:492`), the `templateEditorOpen` ref (`:597`), and the `templateSummary` computed (`:599-613`) together with the card and mount. `vue-tsc --build` / eslint flag unused imports.
**Warning signs:** `npm run type-check` or lint reports unused `groupBySection`/`SERVICE_SECTIONS`/`ServiceTemplateEditor`.

### Pitfall 4: `type-check` must be `vue-tsc --build`, not `-p tsconfig.app.json`
**What goes wrong:** The narrow form skips test files; a `TS2339` in a `.test.ts` survives the gate (this bit the repo in Phase 30).
**How to avoid:** Gate on `npm run type-check`. Since R116 touches `createSlot`'s signature and the slotTypes/editor tests, test-file typechecking is essential here.

### Pitfall 5: `data-testid` stability vs. label rename (R114)
**What goes wrong:** Renaming the seed button's `data-testid="template-reset"` to something new silently breaks every `ServiceTemplateEditor.test.ts` selector for it.
**How to avoid:** Change the visible **label** ("Reset to 1-2-3 default" → "Suggested Template") and the confirm/empty-state copy; keep the `template-reset`, `template-reset-confirm*` testids. Update only the tests that assert the literal label text.

### Pitfall 6: The "Services card" tests move, they don't just delete
**What goes wrong:** `SettingsView.test.ts` has a whole `describe('SettingsView Services card (R086)…')` block (`:439-518`) that will fail once the card is gone. `ServicesView.vue` currently has **no test file**.
**How to avoid:** Delete/relocate that describe block; add `ServicesView.test.ts` covering the cog (exists, editor-gated, opens the editor). The editor's own open/close is already covered by `ServiceTemplateEditor.test.ts`.

## Code Examples

### Live-editor MISC body textarea to mirror (the R116 source pattern)
```vue
<!-- src/views/ServiceEditorView.vue:1092-1100 — MESSAGE/ANNOUNCEMENTS/MISC shared body -->
<textarea
  v-if="canEditService"
  :value="(slot as NonAssignableSlot).body"
  @input="(slot as NonAssignableSlot).body = ($event.target as HTMLTextAreaElement).value"
  rows="3"
  :placeholder="bodyPlaceholder(slot.kind as 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC')"
  data-testid="slot-body-input"
  class="w-full rounded-md bg-gray-800 border border-gray-700 ..."
></textarea>
```
The body-bearing set is exactly **MESSAGE, ANNOUNCEMENTS, MISC** (`bodyPlaceholder` is typed to those three; `service.ts:73-74` scopes `body?` to `PRAYER|MESSAGE|ANNOUNCEMENTS|MISC`, but the live editor only exposes it for MESSAGE/ANNOUNCEMENTS/MISC — PRAYER has no textarea). **MISC is the named requirement.** Recommendation: expose the textarea for `MISC` at minimum; extending to MESSAGE/ANNOUNCEMENTS mirrors the live editor exactly and is low-risk, but is discretionary — confirm scope with the owner's intent ("canned music, more announcement slides") which points at MISC + ANNOUNCEMENTS.

### R113 host seam in ServicesView (action bar)
```vue
<!-- src/views/ServicesView.vue:39-52 — the flex-1 spacer + New Service button.
     Add the cog next to New Service, same v-if="authStore.isEditor" convention. -->
<div class="flex-1" />
<button
  v-if="authStore.isEditor"
  type="button"
  aria-label="Edit default service template"
  data-testid="open-template-editor"
  class="inline-flex items-center gap-2 rounded-md ... mb-1"
  @click="templateEditorOpen = true"
><!-- cog icon --></button>
<button v-if="authStore.isEditor" ... @click="dialogOpen = true">New Service</button>
```
```vue
<!-- near the NewServiceDialog mount, ServicesView.vue:165-172 -->
<ServiceTemplateEditor :is-open="templateEditorOpen" @close="templateEditorOpen = false" />
```

## State of the Art

| Old Approach (v1.5) | New Approach (Phase 52) | When Changed | Impact |
|--------------------|--------------------------|--------------|--------|
| Empty/unset template → EMPTY new service (owner override 2026-08-07) | Empty/unset template → **Suggested Template** slots | This phase (R115) | Every church, even one that never customizes, gets a populated starting service |
| Seed button "Reset to 1-2-3 default", framed as Vertical Worship flow | "Suggested Template", VW-neutral | This phase (R114) | Label/copy only — no functional VW gate existed to remove |
| Template editor lives on the Settings page | Template editor lives behind a cog on the Services page | This phase (R113) | Editor moves; component unchanged |
| `ServiceTemplateEntry = { id, kind, section? }` | `+ body?: string` | This phase (R116) | Template MISC items can pre-fill recurring body text |

**Deprecated/outdated (comments/tests to reverse, not delete blindly):**
- `services.ts:235-239` — "EMPTY service when the template is unset (owner override 2026-08-07)… buildSlots() is NEVER reinstated as a fallback here." Reverse to describe the Suggested Template fallback via `buildSuggestedTemplateEntries()`.
- `slotTypes.ts:357-360` — docstring parenthetical "services.ts::createService does not make it, per the owner's 2026-08-07 override." Now false: createService DOES resolve a fallback. Keep the "stays pure / caller decides" sentence; fix the parenthetical.
- `organization.ts:60-67` — `defaultServiceTemplate` JSDoc "an empty/unset template produces an EMPTY new service, NOT buildSlots()'s 1-2-3 shape." Reverse.
- `ServiceTemplateEditor.vue:425-427` — "never an automatic fallback for an unset template." Now IS the fallback source. Reverse.
- `ServiceTemplateEditor.vue:44-48` empty-state copy + `:160-161` confirm copy + `:185` button label — reword off "1-2-3 default"/"Vertical Worship flow" to "Suggested Template."
- `services.test.ts:489` — the test asserting empty template → 0 slots must be **rewritten** to assert the suggested-template slot count/shape (see Validation Architecture).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The R116 body textarea should appear for MISC (and mirror the live editor's MESSAGE/ANNOUNCEMENTS/MISC set is optional/discretionary). | Code Examples / R116 | Low — MISC is explicitly required; extra kinds are additive and low-risk. Confirm scope in planning. |
| A2 | Cog uses `v-if="authStore.isEditor"` (hidden for viewers), matching the sibling New Service button, rather than the moved button's prior `:disabled` convention. | R113 / Code Examples | Low — CONTEXT permits either ("does not see it or sees it disabled"). Planner picks one; both satisfy the requirement. |
| A3 | `buildSuggestedTemplateEntries()` minting fresh ids per call is safe for `createService` because `buildSlotsFromTemplate` never reads `entry.id`. | Pattern 1 | Very low — verified: `buildSlotsFromTemplate` (`slotTypes.ts:362-380`) uses only `entry.kind`/`entry.section`; `createSlot` mints its own slot id. |

## Open Questions

1. **Should the template body textarea cover MESSAGE and ANNOUNCEMENTS too, or MISC only?**
   - What we know: The live editor shares one body field across MESSAGE/ANNOUNCEMENTS/MISC (`ServiceEditorView.vue:1082`). The owner's examples ("canned music, more announcement slides") name Misc and Announcements.
   - What's unclear: Whether MESSAGE (sermon) should carry a default body in a template.
   - Recommendation: Implement MISC (required). Extending to ANNOUNCEMENTS mirrors the owner's example and the live editor at trivial cost; MESSAGE is optional. Let the planner scope; default to MISC + ANNOUNCEMENTS if unsure.

## Environment Availability

Skipped — no external dependencies. All work is against existing source; the standard Vite/Vitest toolchain (already present) covers build and test. `.env.local` is required to run the suite/build per CLAUDE.md, but this phase introduces no new tool or service.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @vue/test-utils (`mount` / `DOMWrapper` over `document.body` for teleported panels) |
| Config file | `vite.config.ts` (app suite; excludes `src/rules.test.ts` by relative path) |
| Quick run command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (per CLAUDE.md) or bare `npx vitest run` |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` then, if rules touched (they are not this phase), `npm run test:rules` |
| Type gate | `npm run type-check` (= `vue-tsc --build`; typechecks test files — REQUIRED gate, not `-p tsconfig.app.json`) |

> **Known-failing baseline (do NOT chase — 2 files):** `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A run that also reports `src/rules.test.ts` failing is a command-scoping artifact, not a regression. This phase touches none of these; the baseline must remain exactly 2 files after the phase.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R113 | Services card GONE from Settings (no `open-template-editor`, no `template-summary`) | component | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ (edit: delete/relocate `describe` @439-518) |
| R113 | Cog on Services page exists, editor-gated, opens `service-template-editor` | component | `npx vitest run src/views/__tests__/ServicesView.test.ts` | ❌ Wave 0 (no test file today) |
| R114 | Seed button label reads "Suggested Template"; no VW gate | component | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ✅ (edit: assert new label; `template-reset` testid unchanged) |
| R114 | "Suggested Template" seeds the 1-2-2-3-derived entries into the draft | component | same file | ✅ (extend `applyReset` assertions) |
| R115 | Empty/unset template → new service seeded from suggested preset (NOT 0 slots) | store unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ (edit: **reverse** test @489) |
| R115 | Non-empty template still used verbatim; VW types still applied when `vwModeEnabled` | store unit | same file | ✅ (@508, @536 stay valid) |
| R115 | `buildSlotsFromTemplate([], true)` still returns `[]` (purity preserved) | util unit | `npx vitest run src/utils/__tests__/slotTypes.test.ts` | ✅ (@798 must stay green) |
| R115 | `buildSuggestedTemplateEntries()` returns the 1-2-2-3 entry shape with fresh ids | util unit | same file | ❌ Wave 0 (new export → new test) |
| R116 | `createSlot('MISC', …, body)` sets `body`; bodyless call still omits `body` | util unit | same file | ✅ (extend; @643/@656 "omits body" MUST stay green) |
| R116 | `buildSlotsFromTemplate` threads `entry.body` into the MISC slot | util unit | same file | ❌ Wave 0 (new assertion) |
| R116 | `ServiceTemplateEntry` accepts `body?: string` (type) | type gate | `npm run type-check` | ✅ (compile-time) |
| R116 | MISC template row renders a `template-item-body` textarea bound to `entry.body` | component | `ServiceTemplateEditor.test.ts` | ❌ Wave 0 (new assertion) |

### Sampling Rate
- **Per task commit:** the single most-relevant file, e.g. `npx vitest run src/utils/__tests__/slotTypes.test.ts` (< 5s) plus `npm run type-check` when a signature/type changed (R116).
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'` (full app suite) + `npm run type-check`.
- **Phase gate:** full app suite green (baseline exactly 2 known-failing files) AND `npm run type-check` clean, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/views/__tests__/ServicesView.test.ts` — new file: cog exists + editor-gated + opens `service-template-editor` (covers R113 host side). No test file exists today.
- [ ] `src/utils/__tests__/slotTypes.test.ts` — add `buildSuggestedTemplateEntries()` coverage (R115) + `createSlot` body-threading + `buildSlotsFromTemplate` body-threading (R116); **reverse none of the existing purity/omits-body tests** — extend around them.
- [ ] `src/stores/__tests__/services.test.ts` — reverse the `@489` empty→0-slots test to empty→suggested-slots (R115).
- [ ] `src/views/__tests__/SettingsView.test.ts` — delete/relocate the `Services card (R086)` describe block (`@439-518`) (R113).
- [ ] `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — update the seed-button label assertion (R114) + add the MISC `template-item-body` textarea assertion (R116).
- [ ] Framework install: none — Vitest + @vue/test-utils already present.

## Security Domain

> `security_enforcement` not disabled in config → included. This phase adds no auth/session/access surface; the only new data is a user-typed template body string.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged; no new auth path. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | yes (light) | Editor-gating preserved: cog `authStore.isEditor` (client) + existing Firestore rules on `organizations/{orgId}` writes (server) unchanged. The template write path is the same `updateDoc(settings.defaultServiceTemplate)` already gated. |
| V5 Input Validation / Output Encoding | yes | New `body` free-text field. Rendered via Vue text interpolation / `whitespace-pre-wrap` (`ServiceEditorView.vue:1102`) — Vue auto-escapes, no `v-html`. Persisted through `stripUndefined` (rejects raw `undefined`). No SSR, no HTML sink. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for Vue 3 + Firestore
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via template `body` text | Tampering | Vue text-interpolation escaping + no `v-html` (matches live editor's existing body rendering). Do not introduce `v-html` for the body. |
| Non-editor writing the template via relocated control | Elevation of Privilege | Keep the `authStore.isEditor` gate on the cog AND rely on the unchanged server-side Firestore rule — client gate is defence-in-depth, not the boundary. |
| `undefined` `body` reaching Firestore | Tampering / data corruption | `...(body ? { body } : {})` spread keeps the key absent; existing `stripUndefined` on the save payload is the backstop. |

## Sources

### Primary (HIGH confidence) — read in this session at file:line
- `src/views/SettingsView.vue:462-479, 482, 492, 495-496, 597, 599-613` — Services card + mount + imports + ref + computed to remove.
- `src/views/ServicesView.vue:39-52, 165-172, 176-186, 354-358` — action-bar host seam, dialog mount, `createService` caller.
- `src/stores/services.ts:233-257` — `createService` call site + stale comment block.
- `src/utils/slotTypes.ts:78-122 (createSlot), 273-319 (buildSlots), 331-380 (progressionVwTypeSequence, buildSlotsFromTemplate)` — purity contract + factory + preset content.
- `src/components/settings/ServiceTemplateEditor.vue:44-48, 159-196, 217, 425-446` — empty-state/confirm/button copy, imports, `applyReset`; confirmed NO `vwModeEnabled` reference anywhere in file.
- `src/types/organization.ts:12-16, 60-68` — `ServiceTemplateEntry`, `defaultServiceTemplate` JSDoc.
- `src/types/service.ts:73-88` — `NonAssignableSlot.body?` already exists.
- `src/views/ServiceEditorView.vue:1082-1103, 2689-2696` — live body textarea + `bodyPlaceholder` typed set.
- Test files read: `SettingsView.test.ts:439-518`, `services.test.ts:158-167,233,465-594`, `ServiceTemplateEditor.test.ts`, `slotTypes.test.ts:562,643-662,793-804`.

### Secondary (MEDIUM confidence)
- CLAUDE.md gates (type-check form, app-suite command, 2-file baseline) — project-authoritative, applied verbatim.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all modules read at file:line.
- Architecture / wiring: HIGH — all four CONTEXT hypotheses validated against real code; R114's "no VW gate exists" is a confirmed simplification.
- Pitfalls: HIGH — each pinned to a specific existing test line that would fail.
- Validation: HIGH — every req mapped to an existing or Wave-0 test with a runnable command.

**Research date:** 2026-08-11
**Valid until:** ~2026-09-10 (stable internal code; re-verify only if Phase 51/44 files change before planning).
