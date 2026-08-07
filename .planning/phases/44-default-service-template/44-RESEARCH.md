# Phase 44: Default Service Template - Research

**Researched:** 2026-08-07
**Domain:** Vue 3 + Pinia + Firestore settings feature — schema extension, cross-store read, slide-out editor UI reusing an existing add-item palette and SortableJS reorder
**Confidence:** HIGH — this phase is 100% reuse of patterns already shipping in this exact codebase; every claim below is grounded in a direct read of the real source files, not external research

## Summary

Phase 44 adds exactly one new piece of church-level settings data — `defaultServiceTemplate:
ServiceTemplateEntry[]`, where each entry is `{ id, kind, section? }` — following the contract
`src/types/organization.ts` already anticipates ("Phase 44's default service template"). It is merged
through the single existing `loadOrgContext` defaults-merge point in `src/stores/auth.ts`, exactly like
`aiEnabled`/`pcEnabled`/`vwModeEnabled` before it. A new "Services" card in `SettingsView.vue` opens a
slide-out editor that is a direct structural port of `EditSlideDrawer.vue`'s panel mechanics combined
with `ServiceEditorView.vue`'s finalized (Phase 43) add-item palette, section `<select>`, remove button,
and per-section `Sortable.create()` reorder. `src/stores/services.ts::createService` changes from
unconditionally calling `buildSlots('1-2-2-3')` to reading `authStore.settings.defaultServiceTemplate`
and building `ServiceSlot[]` from it — or an **empty array** when the template is empty (owner override,
2026-08-07 — this is not the "no data yet" case, it is the actual required default).

The one genuinely new piece of logic — not a straight port of an existing pattern — is VW-type
computation at creation time for a template whose song-slot count and position no longer match the
hard-coded 9-slot shape `PROGRESSION_SLOT_TYPES` was written against. `PROGRESSION_SLOT_TYPES` is keyed
by **absolute array position** (`0, 2, 5, 6, 8`), which only means anything because `buildSlots()`
always produces exactly that 9-slot shape. A custom church template has an arbitrary number of `SONG`
entries at arbitrary positions, so the existing map cannot be indexed directly — it must be read as an
**ordered sequence of VW types** and walked by the **ordinal index of each SONG entry** among the
template's song entries, not by its array position. No existing code does this today; it is new, small,
and the single piece of this phase's logic that needs a deliberate design decision (see Common Pitfalls
#2 and Open Questions).

**Primary recommendation:** Extend `OrgSettings`/`DEFAULT_ORG_SETTINGS` with one field
(`defaultServiceTemplate: ServiceTemplateEntry[]`, default `[]`); add a new `buildSlotsFromTemplate(entries,
{ vwModeEnabled })` helper beside `buildSlots()` in `slotTypes.ts` that walks the template in order,
calls `createSlot(entry.kind, vwType, entry.section)` per entry (computing `vwType` only for `SONG`
entries, only when VW mode is on, from `PROGRESSION_SLOT_TYPES['1-2-2-3']`'s ordinal sequence), then
`reindexSlots(...)`; reroute `createService` to call it with `authStore.settings.defaultServiceTemplate`
(empty array falls through to zero slots, satisfying the EMPTY-by-default override); build the Settings
editor as a literal `EditSlideDrawer.vue` shell around a literal port of `ServiceEditorView.vue`'s
palette/section-select/remove/Sortable markup, minus every content field (no `songId`, no `body`, no
`hymnName` — Area 1's "types and sections only" lock).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template storage & defaults resolution | API / Backend (Pinia store + Firestore doc) | — | `OrgSettings`/`DEFAULT_ORG_SETTINGS`/`loadOrgContext` is the established single source of truth for org-level settings; no new tier introduced |
| Template editing UI (Services card + slide-out) | Browser / Client (Vue SFC) | — | Pure client-side form over already-loaded `authStore.settings`, mirrors `SettingsView.vue`'s existing four sections |
| New-service slot construction from template | API / Backend (Pinia store action, `createService`) | — | `services.ts::createService` already owns "what a brand-new service's `slots` array looks like"; this phase changes its input source, not its tier |
| VW-type computation at creation | API / Backend (pure utility, `slotTypes.ts`) | — | `PROGRESSION_SLOT_TYPES`/`buildSlots` already live here; the new ordinal-mapping helper is a sibling pure function, not a new architectural layer |
| Firestore write authorization | Database / Storage (`firestore.rules`) | — | Already covered by the existing `allow write: if isOrgEditor(orgId)` on `organizations/{orgId}` — confirmed no rule change needed (see Pitfall 6) |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R086 | A church can define, in Settings, the default set and order of items that make up a new blank service | `OrgSettings.defaultServiceTemplate` field + `SettingsView.vue` "Services" card + slide-out editor (Architecture Patterns, Code Examples) |
| R087 | A new blank service is built from the church's template; VW types computed at creation, never frozen; no-template → EMPTY (owner correction 2026-08-07) | `buildSlotsFromTemplate()` in `slotTypes.ts`, rerouted `createService` in `services.ts`, ordinal VW-type mapping (Common Pitfalls #2, Open Questions) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Template storage & shape**
- **Storage:** a new `defaultServiceTemplate` field on `OrgSettings` (`src/types/organization.ts`),
  merged through the single existing merge point in `auth.ts::loadOrgContext` under
  `DEFAULT_ORG_SETTINGS`. This is the field the `OrgSettings` JSDoc already anticipates ("Phase 44's
  default service template"). No second defaults-merge point may be introduced — same contract Phases
  39/45/46 follow.
- **Entry shape:** each template entry holds `{ kind, section }` only — the item's `SlotKind` (from
  Phase 43's finalized palette) and its `ServiceSection`. **No chosen content** (no songId, scripture
  reference, or body) is stored in the template.
- **Order:** array order **is** the creation/display order; concrete `position` values are derived at
  service-creation time (mirroring how `buildSlots` assigns positions), not stored in the template.
- **⚠ OVERRIDE (owner, 2026-08-07) — fallback when no template is set:** default to an **EMPTY
  service**, NOT `buildSlots(progression)`. This **supersedes R087's "`buildSlots()` becomes the
  fallback" clause and ROADMAP success criterion #2** — corrected, dated, in REQUIREMENTS.md/ROADMAP.md
  this phase. `buildSlots`' 1-2-3 content is repurposed as the **"Reset to 1-2-3 default"** preset the
  editor can load (see Area 2), rather than an automatic fallback.
  - **Disclosed implication:** on ship, every existing church (none has a configured template yet) gets
    an **empty** new service instead of today's automatic 1-2-3 — until it configures a template or
    clicks "Reset to 1-2-3 default." Owner accepted this knowingly.

**Area 2 — Settings editor UX**
- **Location:** a new **Services** section in `SettingsView.vue`, opening a **slide-out editor** that
  reuses existing slot primitives (consistent with the success criterion).
- **Build the list:** reuse **Phase 43's finalized add-item palette** to add items, existing
  **SortableJS drag-reorder** to order them, and a per-item remove.
- **Section per item:** yes — each template item is assigned to one of the five `ServiceSection`s.
- **Empty / reset:** an empty template is valid; provide a **"Reset to 1-2-3 default"** affordance that
  populates the template with the current `buildSlots` 1-2-3 shape (item types + sections only).

**Area 3 — New-service creation & VW typing**
- **Apply when:** only at **new blank service creation** — the create-service action builds slots from
  the template (or empty, per the Area 1 override).
- **VW typing timing (LOCKED by R087 `[ARCH]`):** VW types are computed **at creation** from the
  church's chosen progression (`PROGRESSION_SLOT_TYPES` in `slotTypes.ts`) and are **never** stored in
  the template. Toggling VW mode later never leaves stale types on an already-created service.
- **VW mode off:** template song slots become plain `SONG` (no vwType) at creation.
- **Existing services:** never retro-applied — the template affects only newly created services.

### Claude's Discretion
- Exact `defaultServiceTemplate` TypeScript shape (array element interface name, whether section is a
  required field on each entry), the slide-out component's file placement, and the reset-preset
  derivation mechanics — all at the planner/executor's discretion within the decisions above.
- (Research addition, not in original CONTEXT.md — see Open Questions) The ordinal-vs-position VW-type
  mapping algorithm for arbitrary custom templates is likewise left to planner/executor discretion; it
  was not anticipated in the discuss-phase transcript because it only becomes visible once
  `PROGRESSION_SLOT_TYPES`'s position-keyed shape is read against a variable-shape template.

### Deferred Ideas (OUT OF SCOPE)
- Retro-applying a template (or offering migration) to existing services — explicitly out of scope.
- Multiple named templates / per-service-type templates — not in this phase.
</user_constraints>

## Standard Stack

### Core

No new libraries. This phase is a pure extension of the existing stack:

| Library | Version (installed) | Purpose | Why Standard (here) |
|---------|---------|---------|--------------|
| vue | ^3.5.29 | SFC editor, slide-out panel | Already the whole app |
| pinia | ^3.0.4 | `auth.ts` settings store, `services.ts` create action | `OrgSettings` pattern already lives here |
| firebase | ^12.0.0 | Firestore doc read/write for `organizations/{orgId}.settings` | Same doc every other Settings toggle already writes |
| sortablejs | ^1.15.7 | Drag-reorder in the template editor | `@types/sortablejs` ^1.15.9 already a devDependency; `ServiceEditorView.vue` already instantiates one `Sortable` per section |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | No new supporting library is needed. `crypto.randomUUID()` (Web Crypto, no package) mints the per-entry stable `id`, exactly as `createSlot()`/`buildSlots()` already do. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `OrgSettings` in place | A separate `organizations/{orgId}/templates/default` subdocument | Rejected — every other v1.5 setting (Phases 39/45/46) lives in the single `settings` map; a subdocument would need its own rules block and its own read in `loadOrgContext`, violating the "single defaults-merge point" contract for no benefit at this document's current size |
| One flat `Sortable` instance with `*DraggableIndex` | Per-section `Sortable` instances (`sectionSortables` map) | `ServiceEditorView.vue` already made this exact tradeoff and chose per-section instances after the v1.4 drag-and-drop root-cause investigation (STATE.md's "three compounding bugs" record) — the UI-SPEC leaves the choice to the planner but per-section is the proven-correct precedent in this codebase, not merely a stylistic option |

**Installation:** None required — nothing to `npm install`.

**Version verification:** N/A — no new packages. `sortablejs@1.15.7` is already the version pinned in
`package.json` and is the exact version the v1.4 RESEARCH.md and this codebase's existing `Sortable.create`
call sites were written and hardened against; do not bump it as part of this phase.

## Package Legitimacy Audit

**Not applicable — this phase installs no new packages.** Every dependency used (`vue`, `pinia`,
`firebase`, `sortablejs`) is already installed, already used for the exact same purpose elsewhere in
this codebase, and verified in the codebase's own `package.json`/`package-lock.json`. No `npm view` /
`package-legitimacy check` run was needed or performed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SettingsView.vue — new "Services" card                                   │
│  summary line ← authStore.settings.defaultServiceTemplate.length          │
│  [Edit Default Template] ──opens──▶ ServiceTemplateEditor (slide-out)    │
└───────────────────────────────────┬───────────────────────────────────────┘
                                     │ draft: ServiceTemplateEntry[] (local, unsaved)
                                     ▼
                   ┌─────────────────────────────────────────┐
                   │ ServiceTemplateEditor.vue (new)          │
                   │  • add-item palette (Phase 43 chips,     │
                   │    minus Hymn) → pushes {id,kind,section}│
                   │  • per-section Sortable reorder          │
                   │  • per-row section <select> + remove ×   │
                   │  • "Reset to 1-2-3 default" → buildSlots │
                   │    ('1-2-2-3').map(kind+section only)    │
                   │  • "Save Template" →                     │
                   └──────────────────┬────────────────────────┘
                                      │ updateDoc(orgDoc,
                                      │  {'settings.defaultServiceTemplate':
                                      │   stripUndefined(draft)})
                                      ▼
                    organizations/{orgId}.settings.defaultServiceTemplate
                                      │
                                      │ read once per session, at sign-in
                                      ▼
                 auth.ts::loadOrgContext  (THE single defaults-merge point)
                    settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings }
                                      │
                                      │ authStore.settings.defaultServiceTemplate
                                      ▼
        ┌───────────────────────────────────────────────────────────┐
        │ services.ts :: createService(data)                        │
        │   const authStore = useAuthStore()                        │
        │   const template = authStore.settings.defaultServiceTemplate│
        │   const vwOn = authStore.settings.vwModeEnabled            │
        │   const slots = buildSlotsFromTemplate(template, vwOn)     │
        │     (slotTypes.ts, NEW — walks template in order,          │
        │      createSlot(kind, vwType?, section) per entry,         │
        │      vwType computed from ordinal SONG index only when     │
        │      vwOn, never stored back)                              │
        │   addDoc(services, { ...data, slots, status:'draft', ...}) │
        └───────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── types/
│   └── organization.ts          # + ServiceTemplateEntry, OrgSettings.defaultServiceTemplate, DEFAULT_ORG_SETTINGS entry
├── utils/
│   └── slotTypes.ts             # + buildSlotsFromTemplate(), + progressionVwTypeSequence() (or inline equivalent)
├── stores/
│   ├── auth.ts                  # NO CHANGE needed beyond the existing spread merge already handling any new OrgSettings key generically
│   └── services.ts              # createService(): reroute from buildSlots('1-2-2-3') to buildSlotsFromTemplate(...)
├── views/
│   └── SettingsView.vue         # + "Services" card (summary + "Edit Default Template" button)
└── components/
    └── settings/                # NEW directory (discretion) — or co-locate in views/ next to SettingsView.vue
        └── ServiceTemplateEditor.vue   # the slide-out editor, structural port of EditSlideDrawer.vue
```

### Pattern 1: Single defaults-merge point, extended by one field

**What:** `OrgSettings` gains exactly one new required member; `DEFAULT_ORG_SETTINGS` gains exactly one
new default value; `loadOrgContext`'s existing `settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings
}` spread picks it up automatically — **no new code is needed in `loadOrgContext` itself** for a plain
(non-dual-read) field, unlike `vwModeEnabled`'s legacy-flat-field migration.

**When to use:** Any time this phase needs to read the template; never introduce a second `?? default`
fallback anywhere else in the codebase (the `OrgSettings` JSDoc's own contract, already enforced by
Phases 39/41).

**Example (from the real, currently-shipping code, `src/stores/auth.ts:183-206`):**
```typescript
// Source: src/stores/auth.ts — the ONE defaults-merge point
const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}
settings.value = {
  ...DEFAULT_ORG_SETTINGS,
  ...orgSettings,
  vwModeEnabled: resolvedVwModeEnabled, // only vwModeEnabled needs a dual-read override; a
                                          // plain new field like defaultServiceTemplate needs
                                          // NO extra line here — the spread already covers it
}
```

### Pattern 2: Dot-path mirror-write, never a whole-map write

**What:** Every existing Settings toggle writes only its own leaf key
(`'settings.vwModeEnabled'`, `'settings.aiEnabled'`, `'settings.pcEnabled'`) via `updateDoc`, then
reassigns the local store field directly (`authStore.settings.aiEnabled = newValue`) — never a whole
`settings: {...}` object write, which would clobber a concurrent editor's write to a sibling key.

**When to use:** The "Save Template" action.

**Example (from `SettingsView.vue:610-630`, the exact pattern to copy for `onSaveTemplate`):**
```typescript
// Source: src/views/SettingsView.vue — onToggleAiEnabled, the template to copy
async function onToggleAiEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return
  const newValue = aiEnabledInput.value
  aiSaveError.value = null
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.aiEnabled': newValue })
    authStore.settings.aiEnabled = newValue
    aiSavedFeedback.value = true
    setTimeout(() => { aiSavedFeedback.value = false }, 2000)
  } catch (err) {
    console.error('[SettingsView] save aiEnabled error:', err)
    aiSaveError.value = 'Failed to save. Please try again.'
    aiEnabledInput.value = !newValue
  }
}
```
For the template, the write is `{ 'settings.defaultServiceTemplate': stripUndefined(draftEntries) }`
(array, not boolean) and the revert-on-failure step restores the drawer's local draft array rather than
flipping a boolean.

### Pattern 3: `createSlot()`'s section-omission convention — reuse it, do not reinvent it

**What:** `createSlot(kind, vwType?, section?)` in `slotTypes.ts` deliberately **omits** the `section` key
from the returned object when `section` is `undefined`, rather than setting `section: undefined` —
because Firestore's JS SDK rejects `undefined` at any depth, including inside array elements
(`"Unsupported field value: undefined"`). The codebase already has a dedicated utility for this,
`src/utils/stripUndefined.ts`, used by `PptxImportModal.vue` and `importedSlides.ts` for exactly this
class of problem.

**When to use:** Both when building a `ServiceTemplateEntry` (an add-item chip creates
`{ id, kind, section: undefined }` in the draft per the UI-SPEC's own wording) and, critically, at
**save time**, before the `updateDoc` call.

**Example:**
```typescript
// Source: src/utils/slotTypes.ts:62-66 — the existing convention
const sectionFields = section ? { section } : {}
// ...
return { kind, id, position: 0, ...sectionFields } as NonAssignableSlot

// Applied at template-save time (new code this phase writes):
// Source pattern: src/utils/stripUndefined.ts
await updateDoc(doc(db, 'organizations', authStore.orgId), {
  'settings.defaultServiceTemplate': stripUndefined(draftEntries),
})
```

### Pattern 4: Generic section grouping — reuse `groupBySection`/`flattenBySection`/`orderSlotsBySection`

**What:** `slotTypes.ts` already exports section-grouping helpers as **generics** —
`groupBySection<T>(items, getSection)` takes any `{ section?: ServiceSection }`-shaped array, not just
`ServiceSlot[]`. The template editor's own section-grouped rendering and pre-save ordering can call
these directly against `ServiceTemplateEntry[]` with zero modification.

**When to use:** Rendering the drawer's five section-grouped lists, and normalizing draft order before
save (mirroring `reindexSlots(orderSlotsBySection(slots))`'s composition pattern, minus `reindexSlots`
since template entries carry no `position` field).

**Example:**
```typescript
// Source: src/utils/slotTypes.ts:146-166, 173-180, 198-204 — already generic, reuse verbatim
import { groupBySection, flattenBySection, buildSlots } from '@/utils/slotTypes'

const grouped = groupBySection(draftEntries, (entry) => entry.section)
// grouped.sections['worship'], grouped.sections['message'], etc. — render one <div> per SERVICE_SECTIONS member
```

### Pattern 5: "Reset to 1-2-3 default" preset derivation

**What:** `buildSlots(progression)` already exists and produces the canonical 9-slot shape. The reset
preset strips it down to `{ kind, section }` (discarding `id`, `position`, and every content field).
The choice of `progression` argument (`'1-2-2-3'` vs `'1-2-3-3'`) is irrelevant here — verified by
reading `buildSlots()`: both progressions produce **identical** slot kind/position/section layout; only
`requiredVwType` differs between them, and the template never stores `requiredVwType`. Use
`'1-2-2-3'` for consistency with `createService`'s own hard-coded default.

**Example:**
```typescript
// New code, composing two existing exports — no new derivation logic needed
import { buildSlots } from '@/utils/slotTypes'

function resetToDefaultPreset(): ServiceTemplateEntry[] {
  return buildSlots('1-2-2-3').map((slot) => ({
    id: crypto.randomUUID(),
    kind: slot.kind,
    ...(slot.section ? { section: slot.section } : {}),
  }))
}
```

### Pattern 6: Cross-store read inside a Pinia action (established precedent)

**What:** `services.ts` already calls `useSongStore()` **inside** an action body (`buildServiceSnapshot`,
`services.ts:104`), not at module scope — the correct way to compose another store from within a Pinia
store action. `createService` needs the identical pattern for `useAuthStore()`.

**Example:**
```typescript
// Source pattern: src/stores/services.ts:104 (existing useSongStore() call site)
import { useAuthStore } from '@/stores/auth'

async function createService(data: CreateServiceInput): Promise<string> {
  if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
  const authStore = useAuthStore()
  const slots = buildSlotsFromTemplate(
    authStore.settings.defaultServiceTemplate,
    authStore.settings.vwModeEnabled,
  )
  const ref = await addDoc(collection(db, 'organizations', orgId.value, 'services'), {
    ...data,
    progression: '1-2-2-3',
    slots,
    status: 'draft',
    notes: '',
    sermonPassage: null,
    sermonTopic: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}
```

### Anti-Patterns to Avoid

- **A second defaults-merge point.** Do not add a `?? []` fallback anywhere `defaultServiceTemplate` is
  read outside `loadOrgContext`'s single spread. Every consumer reads
  `authStore.settings.defaultServiceTemplate` as a plain, already-defaulted array.
- **Storing content in the template.** A template entry must never gain `songId`, `body`, `hymnName`, or
  any other field beyond `{ id, kind, section? }` — Area 1's explicit lock. Do not reuse `createSlot()`'s
  full return value unmodified; strip it (or build entries directly) to the three allowed fields.
- **Freezing VW type into the template.** `requiredVwType` must never appear on a stored
  `ServiceTemplateEntry`. It is computed only inside `buildSlotsFromTemplate()` at creation time and
  written only onto the resulting `ServiceSlot`, never persisted to `OrgSettings`.
- **Reinstating `buildSlots()` as an automatic runtime fallback.** The owner's 2026-08-07 override is
  explicit: an empty/unset template means an EMPTY new service, full stop. `buildSlots()` is called only
  by the editor's "Reset to 1-2-3 default" button, never by `createService`.
- **Writing `section: undefined` directly to Firestore.** Always go through the omit-key convention or
  `stripUndefined()` before any `updateDoc`/`addDoc` call touching the template array.
- **Indexing `PROGRESSION_SLOT_TYPES` by a custom template's array position.** See Pitfall #2 below —
  this is the one place a straight copy-paste of existing code silently produces wrong or `undefined`
  VW types.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripping `undefined` before a Firestore write | A new per-field `?? null` / conditional-spread guard scattered through the save handler | `src/utils/stripUndefined.ts`'s existing `stripUndefined()` | Already handles arbitrary depth and arrays; already the established convention (`PptxImportModal.vue`, `importedSlides.ts`) for this exact Firestore rejection class |
| Grouping template entries by section for rendering/ordering | A new bucketing function specific to `ServiceTemplateEntry` | `groupBySection<T>` / `flattenBySection<T>` from `slotTypes.ts` | Already generic over any `{ section?: ServiceSection }`-shaped array; a second bespoke grouping function would be a second source of truth for "what order are things in," the exact class of bug this codebase has already paid down once (v1.4's drag-and-drop root-cause investigation) |
| Drag-reorder engine | A hand-rolled pointer-event reorder, or a different drag library | `sortablejs` (already installed), one instance per section, `handle: '.drag-handle'`, `draggable: '.slot-item'`-equivalent selector, keyed on the entry's own stable `id` | Exact precedent already proven correct in `ServiceEditorView.vue` after the documented v1.4 bug hunt; a second, independent Sortable configuration risks reintroducing the same three-bug class (wrong index property, partial DOM revert, unstable v-for key) |
| Slide-out panel open/close/transition mechanics | A new Teleport + Transition implementation | `EditSlideDrawer.vue`'s exact class strings and `Transition` `enter-active-class`/`leave-active-class` set (already itemized in `44-UI-SPEC.md`) | This is the app's one existing slide-out precedent — the UI-SPEC explicitly prescribes copying it verbatim, including its deliberate no-scrim, no-reflow-underneath property |
| Mirror-write-then-reassign Settings save flow | A new save/loading/error/revert state machine | `onToggleAiEnabled`'s exact shape (`isSaving`/`savedFeedback`/`saveError` refs, `setTimeout(...,2000)` success flash, revert-on-catch) | Four existing sections in `SettingsView.vue` already implement this identically; a fifth divergent implementation would be visible inconsistency for no benefit |

**Key insight:** This phase's entire non-trivial surface area is roughly 40 lines of genuinely new logic
(the template type, `buildSlotsFromTemplate`, and the VW ordinal-mapping helper). Everything else —
storage, UI shell, drag-reorder, save/error flow, section grouping — is a direct structural port of code
already shipping and already hardened by prior phases' bug fixes. Treat any plan task that proposes a
materially different shape for one of these five ported patterns as a red flag requiring justification.

## Common Pitfalls

### Pitfall 1: The existing `createService` test suite hard-asserts the OLD default behavior

**What goes wrong:** `src/stores/__tests__/services.test.ts`'s `describe('createService', ...)` block
(lines 441-561) contains five tests that call `store.createService(...)` with **no** `authStore` mock in
scope at all, and assert `data.slots` **always** has length 9 with specific `requiredVwType` values at
specific indices — i.e., they assert today's unconditional `buildSlots('1-2-2-3')` behavior. Once
`createService` is rerouted to `buildSlotsFromTemplate(authStore.settings.defaultServiceTemplate, ...)`,
these tests will either throw (no `@/stores/auth` mock exists in this file today — `useAuthStore()` will
be undefined/throw) or silently pass against `undefined` behaving as an empty array (0 slots, not 9),
failing every one of the five assertions.
**Why it happens:** `services.test.ts` was written before this phase existed and encodes the pre-Phase-44
default as fact.
**How to avoid:** Wave 0 of the plan must (a) add `vi.mock('@/stores/auth', () => ({ useAuthStore: () =>
mockAuthState }))` to `services.test.ts` (no prior art in this specific file — 12 other test files already
do this, e.g. `ServiceEditorView.test.ts:375-377`, and its `mockAuthState.settings` shape is the pattern
to copy), and (b) rewrite the five `createService` tests to cover the NEW contract explicitly: empty
template → 0 slots; a template with N `SONG` entries + VW mode on → correct ordinal VW types; VW mode off
→ `SONG` entries present with no meaningful/gated `requiredVwType`; a non-empty template's `kind`/`section`
sequence is honored in order.
**Warning signs:** `npm run type-check` passing but `npx vitest run --dir src --exclude '**/rules.test.ts'`
showing new red in `services.test.ts` after the `createService` reroute — this is expected and must be
fixed by rewriting the tests to the new contract, not by reverting the reroute.

### Pitfall 2: `PROGRESSION_SLOT_TYPES` is position-keyed, not ordinal — a naive port produces `undefined` VW types

**What goes wrong:** `PROGRESSION_SLOT_TYPES['1-2-2-3']` is `{ 0: 1, 2: 2, 5: 2, 6: 3, 8: 3 }` — keys are
absolute array indices that only mean anything against `buildSlots()`'s fixed 9-slot layout (5 `SONG`
entries at exactly those five positions). A custom church template might have 3 `SONG` entries at
positions 1, 4, and 7 (interspersed with other kinds in a different arrangement), or 7 `SONG` entries, or
0. Directly evaluating `songTypeMap[entry_position]` for a custom template's song entries will return
`undefined` for the overwhelming majority of realistic templates, silently producing `SongSlot`s whose
`requiredVwType` is `undefined` — which then violates the TypeScript-required, non-optional
`requiredVwType: VWType` field on `SongSlot` at runtime (even though `createSlot()`'s own `vwType ?? 2`
default rescues a plain missing argument, an explicit `undefined` VW type computed by buggy lookup logic
and passed through is a distinct failure mode from "argument omitted").
**Why it happens:** The map was designed for, and has only ever been consumed by, one fixed-shape
producer (`buildSlots`). This phase is the first time `PROGRESSION_SLOT_TYPES` needs to serve an
arbitrary-shape input.
**How to avoid:** Derive an **ordered sequence** from the map, not a position lookup:
```typescript
// New helper, slotTypes.ts
function progressionVwTypeSequence(progression: Progression): VWType[] {
  const map = PROGRESSION_SLOT_TYPES[progression]
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)
    .map((pos) => map[pos] as VWType)
}
// '1-2-2-3' → [1, 2, 2, 3, 3]   '1-2-3-3' → [1, 2, 3, 3, 3]
```
Then in `buildSlotsFromTemplate`, maintain a running `songOrdinal` counter incremented on every `SONG`
entry, and index `sequence[songOrdinal % sequence.length]` (modulo handles a template with more song
slots than the 5-length canonical sequence by cycling; a template with fewer songs simply uses a prefix
of the sequence). This modulo-cycle choice is a reasonable default but is **not** specified anywhere in
CONTEXT.md — flag it explicitly in the plan and note the alternative (clamp to the last value instead of
cycling) as a discretionary call. See Open Questions.
**Warning signs:** A test with a template shaped differently from `buildSlots()`'s canonical 9-slot
layout (e.g., 3 songs only) is the only way this bug surfaces — a test suite that only exercises the
"Reset to 1-2-3 default" shape will never catch it, because that shape happens to line up with the
position keys by construction.

### Pitfall 3: `OrgSettings`'s shallow-spread default-copy shares the SAME array reference across every org

**What goes wrong:** `loadOrgContext`'s fallback path (`ids.length === 0`) and its own comment on
`DEFAULT_ORG_SETTINGS` both do `settings.value = { ...DEFAULT_ORG_SETTINGS }` — a **shallow** spread. For
a primitive field like `aiEnabled: boolean` this is harmless. For `defaultServiceTemplate: []`, every org
that resolves to the default (no template configured) gets `authStore.settings.defaultServiceTemplate`
pointing at the exact same array instance as `DEFAULT_ORG_SETTINGS.defaultServiceTemplate` and every
other such org in the same running client. As long as nothing ever mutates that array **in place**
(`.push()`, `.splice()`, index assignment) this is inert — the editor's own draft state must be a fresh
copy (`[...authStore.settings.defaultServiceTemplate]` or equivalent) that it mutates locally and only
ever writes back via whole-array `updateDoc` + whole-array reassignment (mirroring `onToggleAiEnabled`'s
`authStore.settings.aiEnabled = newValue`, never `authStore.settings.aiEnabled = !authStore.settings.aiEnabled`
in place).
**Why it happens:** `DEFAULT_ORG_SETTINGS` is a module-level `const` object; JS object/array spread is
shallow by definition; this specific risk did not exist before Phase 44 because no prior `OrgSettings`
field was a reference type.
**How to avoid:** The template editor's "open drawer" step must clone the array
(`structuredClone(authStore.settings.defaultServiceTemplate)` or a manual `.map()`) into its own local
`ref`, never bind directly to the store array for in-place editing. "Save Template" writes the whole new
array atomically.
**Warning signs:** Editing one org's template in the drawer and, without saving, seeing another
newly-loaded org (or the SAME org after a fresh `loadOrgContext`) show the same in-progress edits — a
sign the draft state is aliased to the shared default reference rather than cloned.

### Pitfall 4: Template entries are not `ServiceSlot`s — do not literally reuse `createSlot()`'s return value

**What goes wrong:** `createSlot('SONG', ...)` returns a full `SongSlot` with `songId: null, songTitle:
null, songKey: null` — none of which belong in a template entry per Area 1's "types and sections only"
lock. Pushing a raw `createSlot()` result into the draft array (to save a few lines by reusing the
existing factory) leaks content-shaped fields into `OrgSettings`, which is both a spec violation and a
Firestore payload-shape inconsistency the moment `createService` later reads it expecting `{id, kind,
section}`.
**Why it happens:** `createSlot()` is the obvious, already-imported factory the Phase 43 palette already
calls; grabbing it for "new template entry" is the path of least resistance.
**How to avoid:** Define a dedicated, minimal constructor for template entries (or strip a
`createSlot()` result down to exactly `{ id, kind, section? }` before pushing to the draft array) —
either is fine, but the stored/serialized shape must never carry `songId`/`body`/`hymnName`/etc.
**Warning signs:** A saved template document in the Firestore emulator inspector showing `songId: null`
or `body: undefined`-shaped keys on any array entry.

### Pitfall 5: `firestore.rules` needs NO change — verified, do not add one speculatively

**What goes wrong (if assumed otherwise):** Given how many other v1.5 phases (40, 40.1, 41, 42) required
`firestore.rules`/`storage.rules` changes and owner-deploy gating, it would be reasonable to assume this
phase does too — and to burn plan time drafting a rules change and an emulator test suite for it.
**Why it's actually fine:** `firestore.rules:27-31` already grants
`allow write: if isOrgEditor(orgId);` unconditionally on the entire `organizations/{orgId}` document —
this is the SAME rule every prior Settings write (`name`, `slug`, `pcAppId`, `settings.aiEnabled`,
`settings.pcEnabled`, `settings.vwModeEnabled`) already relies on, with no field-level restriction.
`settings.defaultServiceTemplate` is just one more key under the same document, written by the same
org-editor-gated path. **Verified by direct read of `firestore.rules`, not assumed.**
**How to avoid wasted effort:** Do not add a Wave 0 "rules probe" task or a new rules test file for this
phase — there is nothing to probe. If the planner is following the pattern of Phases 40-42 (which DID
need rules work) by reflex, explicitly call out in the plan that this phase is the one exception.
**Warning signs:** A plan task titled anything like "update firestore.rules for defaultServiceTemplate"
is itself the warning sign — it should not exist.

### Pitfall 6: `SlotKind` in a template context must exclude `HYMN` and `IMPORTED`

**What goes wrong:** `SlotKind` (the TypeScript union) still includes `'HYMN'` and `'IMPORTED'` —
`HYMN` because R084 is a **palette-only** removal (existing Hymn slots must keep rendering) and
`IMPORTED` because it's a valid slot kind for an imported PPTX deck. Neither belongs in a template a
church defines in advance: Hymn is retired from every add-item palette (R084, already enforced in
`ServiceEditorView.vue`'s palette, which is exactly what this editor copies), and `IMPORTED` has no
sensible pre-created-service meaning (there is no import to reference yet). If the template editor's
palette is built by iterating the full `SlotKind` union rather than copying the Phase 43 palette's
explicit six-button list, both would incorrectly appear.
**Why it happens:** `SlotKind`'s type-level union is broader than any single UI surface's palette; this
is by design (HYMN survives for legacy render/print/present), but a naive "map over all SlotKind values"
implementation would not know that.
**How to avoid:** Copy `ServiceEditorView.vue`'s literal six-button palette markup (`data-testid=
"palette-add-song"` through `"palette-add-misc"`, `ServiceEditorView.vue:1176-1181`) verbatim rather than
deriving the button list from the `SlotKind` type.
**Warning signs:** A "Hymn" or "Imported Slides" chip appearing in the template editor's add-item row.

## Code Examples

### Deriving the VW-type sequence and building slots from a template (new code, composing existing exports)

```typescript
// Source: composes src/utils/slotTypes.ts's existing PROGRESSION_SLOT_TYPES/createSlot/reindexSlots
import { PROGRESSION_SLOT_TYPES, createSlot, reindexSlots } from '@/utils/slotTypes'
import type { Progression, ServiceSlot, SlotKind, ServiceSection } from '@/types/service'
import type { VWType } from '@/types/song'

export interface ServiceTemplateEntry {
  id: string
  kind: SlotKind
  section?: ServiceSection
}

function progressionVwTypeSequence(progression: Progression): VWType[] {
  const map = PROGRESSION_SLOT_TYPES[progression]
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b)
    .map((pos) => map[pos] as VWType)
}

export function buildSlotsFromTemplate(
  entries: ServiceTemplateEntry[],
  vwModeEnabled: boolean,
  progression: Progression = '1-2-2-3',
): ServiceSlot[] {
  const sequence = progressionVwTypeSequence(progression)
  let songOrdinal = 0
  const slots = entries.map((entry) => {
    let vwType: VWType | undefined
    if (entry.kind === 'SONG' && vwModeEnabled) {
      vwType = sequence[songOrdinal % sequence.length]
      songOrdinal++
    }
    return createSlot(entry.kind, vwType, entry.section)
  })
  return reindexSlots(slots)
}
```

### `OrgSettings` extension (new code, following the JSDoc contract already in place)

```typescript
// Source: src/types/organization.ts — the field the existing JSDoc anticipates
export interface ServiceTemplateEntry {
  id: string
  kind: SlotKind
  section?: ServiceSection
}

export interface OrgSettings {
  aiEnabled: boolean
  pcEnabled: boolean
  vwModeEnabled: boolean
  /** Church-defined default set/order of items for a new blank service (R086/R087).
   *  Entries carry ONLY { id, kind, section } — never chosen content (songId, body,
   *  hymnName, etc.) and never a computed VW type, which is derived fresh at
   *  service-creation time. Empty array is a valid, deliberate state: R087's
   *  owner-corrected default means an empty/unset template produces an EMPTY new
   *  service, not `buildSlots()`'s 1-2-3 shape. */
  defaultServiceTemplate: ServiceTemplateEntry[]
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  aiEnabled: true,
  pcEnabled: true,
  vwModeEnabled: true,
  defaultServiceTemplate: [],
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ordinal-index VW-type mapping (walk `SONG` entries in template order, index into `PROGRESSION_SLOT_TYPES`'s position-sorted values, cycling via modulo for templates with more songs than the 5-entry canonical sequence) is the intended algorithm for R087's "song slots ... receive their required VW types from the chosen progression." CONTEXT.md and the UI-SPEC do not specify this mapping explicitly — it is a research-derived proposal, not a locked decision. | Common Pitfalls #2, Code Examples | If the owner's actual mental model is different (e.g., "clamp to the last type instead of cycling," or "only the first N songs up to the sequence length get a type, the rest get a flat default"), the planner ships a defensible-but-possibly-surprising behavior for templates that don't match the canonical 5-song shape. Low blast radius — VW type is a soft classification aid, not enforced data integrity, and is recomputed fresh on every service creation (never frozen), so a wrong algorithm is correctable without a migration. |
| A2 | `'1-2-2-3'` is the correct fixed progression argument to use both for `createService`'s `buildSlotsFromTemplate` call and for the "Reset to 1-2-3 default" preset derivation, matching `createService`'s existing hard-coded default (there is no user-facing progression picker at service-creation time today). | Pattern 5, Pattern 6/Code Examples | If a future phase adds a progression picker at creation time this assumption needs revisiting, but nothing in v1.5's scope does — verified by grep, `ServicesView.vue`'s create dialog has no progression field. |
| A3 | The template editor's `ServiceTemplateEntry` array element does NOT need its own `position` field — array order alone encodes order, matching CONTEXT.md's explicit "position values are derived at service-creation time... not stored in the template." | Recommended Project Structure, Code Examples | If a future consumer needs to look up a template entry's intended position independent of array order (unlikely — no such consumer exists in this phase), a `position` field would need retrofitting. |

**If this table is empty:** N/A — see entries above. All three are LOW risk, self-correcting, and
explicitly called out for the planner/discuss step to confirm or override rather than silently assumed
into an executed plan.

## Open Questions

1. **Exact VW-type ordinal-mapping algorithm for templates that don't match the canonical 5-song shape**
   - What we know: `PROGRESSION_SLOT_TYPES` becomes a 5-element ordered sequence
     (`[1,2,2,3,3]` for `'1-2-2-3'`, `[1,2,3,3,3]` for `'1-2-3-3'`) once read positionally-sorted rather
     than by literal position; the CONTEXT.md lock only says "computed from the chosen progression," not
     the precise mapping function.
   - What's unclear: modulo-cycle vs. clamp-to-last vs. some other rule for a template with more or
     fewer `SONG` entries than 5.
   - Recommendation: adopt the modulo-cycle rule proposed in this research (Pitfall #2 / Code Examples)
     as the plan's default, note it explicitly as a discretionary implementation choice in the plan
     itself (not silently buried), and cover both the "fewer than 5 songs" and "more than 5 songs" cases
     with an explicit unit test in `slotTypes.test.ts` so the chosen behavior is pinned and visible to
     the owner at verification time.

2. **Where the new `ServiceTemplateEditor.vue` component should live**
   - What we know: CONTEXT.md explicitly leaves "the slide-out component's file placement" to
     planner/executor discretion.
   - What's unclear: `src/components/settings/` (new directory) vs. co-located directly beside
     `SettingsView.vue` in `src/views/` vs. `src/components/` flat (matching where `EditSlideDrawer.vue`
     lives, i.e. `src/components/slides/`).
   - Recommendation: `src/components/settings/ServiceTemplateEditor.vue` — this is the first
     Settings-owned slide-out component, and a dedicated `settings/` subdirectory (mirroring the existing
     `slides/` subdirectory convention for `EditSlideDrawer.vue`) keeps the precedent consistent without
     needing to relitigate it in a future Settings-drawer phase.

## Environment Availability

Not applicable — this phase adds no new external dependency (no new package, no new external service, no
new emulator requirement). Everything it touches (Firestore, the existing `organizations/{orgId}`
document, SortableJS, Vitest) is already configured and already exercised by the existing test suite and
dev environment for this project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (`@vue/test-utils` 2.4.6 for component mounts) |
| Config file | `vite.config.ts` (app suite, excludes `src/rules.test.ts`); no phase-specific config needed |
| Quick run command | `npx vitest run src/stores/__tests__/services.test.ts src/utils/__tests__/slotTypes.test.ts` (targeted, sub-second-to-few-seconds) |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (per CLAUDE.md — the only correct way to scope the app suite; do NOT use `npx vitest run src/` or bare `--dir src` without the exclude) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R086 | Church can define default template order/set in Settings via slide-out editor | component | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ❌ Wave 0 |
| R086 | Settings "Services" card shows live summary and opens editor | component | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ (extend existing file, no new harness needed — `SettingsView.test.ts` already exists per Phase 39's Wave 0) |
| R086 | Saved template round-trips through `stripUndefined` with no `undefined` leaking into the Firestore payload | unit | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ❌ Wave 0 (same file as above) |
| R087 | Empty/unset template → new service has 0 slots | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ (rewrite existing `createService` describe block — see Pitfall #1) |
| R087 | Non-empty template → new service's slots match template kind/section/order | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ (extend) |
| R087 | VW mode ON: SONG entries in template receive correct ordinal VW types from `'1-2-2-3'` | unit | `npx vitest run src/utils/__tests__/slotTypes.test.ts` | ✅ (extend — add `buildSlotsFromTemplate` describe block) |
| R087 | VW mode OFF: SONG entries created without a VW-mode-gated type (no stale-type leakage when VW toggled later) | unit | `npx vitest run src/utils/__tests__/slotTypes.test.ts` | ✅ (extend) |
| R087 | Template with more `SONG` entries than the 5-element canonical sequence cycles correctly (Pitfall #2 pin) | unit | `npx vitest run src/utils/__tests__/slotTypes.test.ts` | ✅ (extend) |
| R087 | "Reset to 1-2-3 default" preset matches `buildSlots('1-2-2-3')`'s kind/section shape exactly, with no content fields | unit | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted file(s) via the quick run command above
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'`
- **Phase gate:** full suite green (against the documented pre-existing baseline —
  `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` are known-failing and
  unrelated to this phase, per CLAUDE.md) plus `npm run type-check` (the `vue-tsc --build` form) clean

### Wave 0 Gaps

- [ ] `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — new component test harness;
      no prior art for this specific component (nearest analog: `EditSlideDrawer.test.ts`'s mount/mock
      shape, but this component has no slide-group/song-store dependencies to mock, only `authStore`)
- [ ] `src/stores/__tests__/services.test.ts` — add `vi.mock('@/stores/auth', ...)` (currently absent
      from this file; 12 other test files already establish the pattern to copy, e.g.
      `ServiceEditorView.test.ts:375-377`)
- [ ] Framework install: none — Vitest, `@vue/test-utils`, and `@types/sortablejs` are all already
      devDependencies

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — this phase adds no new auth surface |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | Already satisfied by the existing `allow write: if isOrgEditor(orgId)` rule on `organizations/{orgId}` (verified, Pitfall #5) — no new rule needed; the Settings UI itself already gates the toggle/save controls behind `authStore.isEditor` (same pattern as every other Settings section) |
| V5 Input Validation | yes | Client-side: the template editor's palette is a closed six-button set (`SlotKind` literal values, not free text), and `section` is a closed `<select>` over `SERVICE_SECTIONS` — structurally, a malformed `kind`/`section` cannot be entered through the UI. Firestore-level: no schema validation exists on `settings.*` writes today (same as `aiEnabled`/`pcEnabled`/`vwModeEnabled`) — this is a pre-existing, accepted gap in this codebase's rules design, not something this phase should newly solve |
| V6 Cryptography | no | `crypto.randomUUID()` for entry ids is identity-generation, not cryptographic protection of data — same non-security use already made by `createSlot()`/`buildSlots()` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-editor role writing `settings.defaultServiceTemplate` directly via the client SDK, bypassing the UI's `isEditor`-gated button | Tampering | Already covered — `firestore.rules`' `isOrgEditor(orgId)` check on the whole `organizations/{orgId}` document applies to this key exactly as it does to every other Settings field; no new gap introduced, none newly closed |
| A malicious payload smuggling extra fields (`songId`, `body`) into a template entry via a hand-crafted Firestore write, bypassing the UI's closed palette | Tampering | Not newly mitigated by this phase (no Firestore-level schema validation exists for any `settings.*` field today) — `buildSlotsFromTemplate` only reads `kind`/`section`/`id` off each entry, so extraneous fields on a tampered document are simply ignored at slot-construction time, not persisted forward. Acceptable given the existing rules design's precedent (same exposure already exists for `aiEnabled`/`pcEnabled` today) |

## Sources

### Primary (HIGH confidence — direct read of this codebase's real, currently-shipping source)
- `src/types/organization.ts` — `OrgSettings`, `DEFAULT_ORG_SETTINGS`, the JSDoc contract this phase extends
- `src/stores/auth.ts:55-236` — `loadOrgContext`, the single defaults-merge point, the `vwModeEnabled` dual-read precedent
- `src/utils/slotTypes.ts` (full file) — `PROGRESSION_SLOT_TYPES`, `createSlot`, `reindexSlots`, `groupBySection`, `flattenBySection`, `orderSlotsBySection`, `buildSlots`
- `src/types/service.ts` (full file) — `SlotKind`, `ServiceSection`, `SERVICE_SECTIONS`, `ServiceSlot` union, `Service`
- `src/stores/services.ts:1-60, 195-265` — `createService`, the `useSongStore()` in-action-body precedent
- `src/views/SettingsView.vue` (full file) — every existing Settings section's markup and save/error/loading pattern to copy
- `src/views/ServiceEditorView.vue:1080-1182, 1940-1997, 2610-2635` — the Phase 43 add-item palette, section `<select>`, remove button, per-section `Sortable.create`, `addSlot`
- `src/components/slides/EditSlideDrawer.vue:1-80` — the app's one slide-out precedent, `Transition` classes
- `src/utils/stripUndefined.ts` (full file) — the existing Firestore-`undefined`-rejection utility
- `firestore.rules:27-42` — verified no rule change needed
- `package.json` — verified no new dependency needed, exact installed versions
- `src/stores/__tests__/services.test.ts:1-120, 440-561` — the five `createService` tests that need rewriting (Pitfall #1), existing mock scaffolding (no `@/stores/auth` mock present)
- `src/views/__tests__/ServiceEditorView.test.ts:352-377` — the `mockAuthState`/`vi.mock('@/stores/auth', ...)` pattern to copy into `services.test.ts`
- `.planning/phases/44-default-service-template/44-CONTEXT.md` — locked decisions
- `.planning/phases/44-default-service-template/44-UI-SPEC.md` — verified UI contract
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` — phase scope, owner decisions, workflow toggles

### Secondary (MEDIUM confidence)
- None — this phase required no external web research; every finding is grounded in a direct source read within this repository.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions confirmed from `package.json`
- Architecture: HIGH — every pattern cited is a direct read of currently-shipping code in this exact repo, not an external analog
- Pitfalls: HIGH for #1, #3, #4, #5, #6 (each directly observed in real source); MEDIUM for #2's specific
  mitigation algorithm (the bug is HIGH-confidence real, but the exact fix algorithm is a reasoned
  proposal — see Assumption A1 / Open Question 1)

**Research date:** 2026-08-07
**Valid until:** No natural expiry — this research is grounded entirely in this repository's own source,
which only changes when this repository changes. Re-verify only if Phase 43's palette, `OrgSettings`'s
shape, or `firestore.rules`' `organizations/{orgId}` block are modified before Phase 44 is planned/executed.
