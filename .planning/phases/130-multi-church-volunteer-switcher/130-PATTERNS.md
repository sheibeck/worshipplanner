# Phase 130: Multi-Church Volunteer Switcher - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 5 (2 modified projection files, 1 store, 2 views, 1 component)
**Analogs found:** 5 / 5 (all in-repo — this phase extends shipped v2.12 code)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/rehearseAccess.ts` (add `orgName` to `RehearseAccessDoc` + `buildRehearseAccess`) | utility (pure projection) | transform | self — existing field additions in same file | exact (self-precedent) |
| `src/stores/services.ts` (thread org name through `markAsPlanned` + `resyncRehearseAccessForSong`) | store | transform / write | `writeRehearseAccessDoc` + its two callers (same file) | exact (self-precedent) |
| `src/stores/mySchedule.ts` (distinct-church derivation + `selectedChurch` filter) | store | transform (client filter) | self — `docs`/`loadMySchedule` state shape; `MyScheduleView` computed filters | exact (self-precedent) |
| `src/views/MyScheduleView.vue` (switcher UI gated on >1 church) | view/component | request-response (UI) | `ServicesView.vue` tab bar (L5-38); this file's own computed/gated sections | exact / role-match |
| `src/components/AppSidebar.vue` (volunteer church-name in org-name slot) | component | request-response (UI) | self — org-name block (L16-30) | exact (self-precedent) |
| carry selected church into `VolunteerServiceView.vue` / `useVolunteerServiceDoc.ts` | composable/view | transform | `useVolunteerServiceDoc.ts` store-match resolution (L37-54) | exact (self-precedent) |

## Pattern Assignments

### `src/utils/rehearseAccess.ts` — add `orgName` field (utility, transform)

**Analog:** the file itself. Every existing projection field was added the same way: a documented field on `RehearseAccessDoc`, populated in the `buildRehearseAccess` return object, with a new function parameter when the value isn't derivable from `service`.

**Type-field addition pattern** (`RehearseAccessDoc`, rehearseAccess.ts:55-85) — copy how `orgId` sits at the top of the interface (line 60). Add `orgName` right after it. Follow the JSDoc-per-field convention (see `rolesByEmailLower` L63-67) noting: PII-safe (an org's public display name, already shown org-wide), why it exists (lets a zero-membership volunteer label churches without reading `organizations/{orgId}`), and the Phase tag `(Phase 130, R403/R404)`.

**Optionality decision — match the graceful-degrade requirement:** existing docs won't carry `orgName` until re-projected (CONTEXT.md existing-doc caveat). Declare it `orgName?: string` (optional), mirroring how `stageLayout?` (L84) is declared optional because older/empty docs legitimately lack it. Do NOT make it required — required + a `setDoc` of an object missing it is fine at write time, but consumers must tolerate absence.

**Builder-parameter + return pattern** (`buildRehearseAccess`, rehearseAccess.ts:109-116, 224-236):
- Signature currently takes `orgId` at position 2 (L110-111). Add `orgName` as a new parameter. Prefer threading it adjacent to `orgId` so callers pass the pair together.
- In the return object (L224-236), `orgId` is emitted as `orgId,` (L226). Emit `orgName` the same way. If optional and possibly empty, use the conditional-spread idiom this file already uses for `stageLayout` (L235): `...(orgName ? { orgName } : {})` — keeps the key ABSENT rather than `undefined` (consistent with the whole file's "never a literal undefined in a setDoc payload" rule, see L82-83, L221-222).

### `src/stores/services.ts` — thread org name through both write paths (store, write)

**Analog:** the shared `writeRehearseAccessDoc` helper and its two callers, all in this file.

**Shared helper — add the parameter once** (`writeRehearseAccessDoc`, services.ts:302-315). This is the single choke point both write paths funnel through (see its doc comment L294-301). Add an `orgName` parameter here and forward it into the `buildRehearseAccess(service, org, ...)` call at L310. Both callers already pass `org` (the orgId) — pass `orgName` right beside it.

**Caller 1 — `markAsPlanned`** (services.ts:634-645): org-scoped stores are already subscribed here. The org display name is available from the auth store — `useAuthStore().orgName` (auth.ts:112, 346, 939). Add `const authStore = useAuthStore()` beside the existing `useRosterStore()/useQuartersStore()/useSongStore()` acquisitions (L635-637) and pass `authStore.orgName ?? ''` into `writeRehearseAccessDoc`. Keep the existing best-effort try/catch (L634-651) — a projection failure must never roll back the status transition (comment L619-633).

**Caller 2 — `resyncRehearseAccessForSong`** (services.ts:669-696): runs on the Songs page where org-scoped stores AREN'T subscribed; it reads its inputs via direct `getDocs` (comment L662-667). `useAuthStore().orgName` is still valid here (auth is a global session store, not org-scoped-and-reset like roster/services). Acquire `useAuthStore()` and pass `authStore.orgName ?? ''` into each `writeRehearseAccessDoc` call in the `Promise.all` (L692). Do NOT add an extra `getDoc` of `organizations/{org}` just to fetch the name — the auth store already holds it for the active org, matching this function's "read only what you need, best-effort" shape.

**Byte-identical parity:** the helper's doc comment (L299-300) asserts both feeds produce byte-identical docs. Passing the same `orgName` source (authStore.orgName) through the one shared helper preserves that invariant.

### `src/stores/mySchedule.ts` — distinct-church derivation + `selectedChurch` filter (store, client transform)

**Analog:** the store's own `docs` ref + the derived-computed pattern already living in `MyScheduleView.vue` (`groups`, `rolesFor`).

**Store state addition** (mySchedule.ts:23-72): follow the exact `ref` + return-object shape. Add `const selectedChurch = ref<string | null>(null)` (null = "All churches") next to `docs`/`isLoading`/`error` (L24-26) and expose it in the returned object (L66-71). Do NOT add any Firestore call for the filter — the switcher is a pure client-side filter over the already-loaded `docs` (CONTEXT.md decisions: "a FILTER over already-loaded docs, NOT a data-scope switch … MUST NEVER call `selectOrg`").

**Distinct-church derivation:** each doc already carries `orgId` (resolved from the Firestore path at L49-52, `d.ref.parent.parent!.id`) and — after the rehearseAccess.ts change — `orgName`. Derive distinct churches with the Set-dedupe idiom the codebase already prefers (see rehearseAccess.ts `distinctSongSlots`, L89-99, and its cited ADR-0160 dedupe-via-Set precedent). Expose a computed `churches` = distinct `{ orgId, orgName }` pairs (first-occurrence order). Graceful label: when `orgName` is absent on an older doc, fall back to a neutral label (CONTEXT.md: e.g. "Your church") — never blank/crash.

**Filtered list:** expose a computed `filteredDocs` = `selectedChurch.value ? docs.filter(d => d.orgId === selectedChurch.value) : docs`. `MyScheduleView` should consume `filteredDocs` where it currently reads `mySchedule.docs`.

**Reset-on-load caution:** `loadMySchedule` reassigns `docs.value` (L49-52). If a stale `selectedChurch` no longer appears in the new docs, coerce it back to null (all) — mirror the defensive re-derivation the codebase applies elsewhere rather than leaving a dangling filter that yields an empty list.

### `src/views/MyScheduleView.vue` — church switcher UI, gated on >1 church (view)

**Analog A (data plumbing):** this file's existing computed-over-store pattern. `groups = computed(() => groupMySchedule(mySchedule.docs))` (MyScheduleView.vue:141) and `rolesFor` (L143-145) show exactly how to derive view state from the store. Point `groups` at the new `mySchedule.filteredDocs` (or a local computed wrapping it) so the switcher drives the rendered sections at L40-115.

**Analog B (gating idiom):** the template already renders sections conditionally with `v-if` on list length (L40 `v-if="groups.thisWeek.length"`, L60, L80). Gate the switcher the same way: `v-if="mySchedule.churches.length > 1"` — a single-church volunteer sees NO switcher, unchanged (R405, CONTEXT.md). Place it in the populated `<template v-else>` header block near the greeting (L34-38).

**Analog C (switcher visual — segmented/tab control):** `ServicesView.vue` tab bar (ServicesView.vue:5-38) is the cleanest in-app segmented control to copy. Per-button markup (L7-16):
```
<button
  type="button"
  class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
  :class="activeTab === 'services'
    ? 'text-indigo-300 border-indigo-500 bg-gray-900'
    : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
  @click="activeTab = 'services'"
>
```
Render one such button per church over `mySchedule.churches`, plus an "All" button; active state keys off `mySchedule.selectedChurch`. For >2 churches or narrow layouts, `VolunteerServiceView.vue`'s tablist (L49-100, with `role="tab"`/`aria-selected`/roving `tabindex`) is the accessibility-complete variant if keyboard nav is wanted; the ServicesView plain-button bar is the lighter option. A `<select>` dropdown (used in ServicesView.vue L129/L142) is the fallback if church count can be large.

**Do NOT** import or call anything from `authStore.selectOrg` / the AppSidebar switcher — that is the admin data-scope switch and is explicitly the precedent NOT to reuse (CONTEXT.md decisions; AppSidebar.vue:270-283 `handleSwitch`).

### `src/components/AppSidebar.vue` — volunteer church name in org-name slot (component)

**Analog:** the org-name block itself (AppSidebar.vue:16-30). For an admin it renders `authStore.orgName` (L21). A zero-membership volunteer has `authStore.orgName === null`, so the whole block's `v-if` (L17) is currently false and the slot is empty.

**Pattern to copy — additive, non-disturbing:** keep the admin path (`authStore.orgName`) exactly as-is; add a volunteer fallback that reads from mySchedule. AppSidebar can access the store the same way MyScheduleView does — `import { useMyScheduleStore } from '@/stores/mySchedule'` and `const mySchedule = useMyScheduleStore()` in `<script setup>` (mirror the existing `const authStore = useAuthStore()` at AppSidebar.vue:220). The store is a Pinia singleton, so the instance MyScheduleView loads is the same one the sidebar reads — no re-fetch needed (though a cold sidebar-first render may need a `loadMySchedule()` guard, mirroring `useVolunteerServiceDoc`'s cold-nav fallback at useVolunteerServiceDoc.ts:44-47).

**Label source (CONTEXT.md):** the SELECTED church's `orgName` (multi-church) or the ONLY church's `orgName` (single). Derive a `volunteerChurchName` computed: `mySchedule.selectedChurch`-matched church's name, else the sole `mySchedule.churches[0]?.orgName`, else neutral fallback. Widen the block's `v-if` (L17) to `authStore.orgName || volunteerChurchName || authStore.superAdminOutsideOwnChurch`, and render `volunteerChurchName` in a new `v-else-if` arm using the same markup as L21 (`<p class="text-xs text-gray-500 truncate">`). The admin `<template v-if="authStore.orgName">` arm (L20-27) stays untouched — volunteer name only shows when `authStore.orgName` is falsy.

### Carry selected church into the volunteer service view (`useVolunteerServiceDoc.ts` / `VolunteerServiceView.vue`)

**Analog:** `useVolunteerServiceDoc.ts:37-59`. It already resolves a service's `orgId`/context by matching `serviceId` against `mySchedule.docs` (L43-47) — it does NOT take orgId from a route param (comment L14-16, L48-54). The org context therefore already flows from the same store the switcher filters. For R404 ("church context is consistent"), the view reads its context from the matched doc's `orgId` + new `orgName`, so no new prop-drilling is needed: once `orgName` is on the doc (rehearseAccess.ts change) and the composable's `getDoc` returns it (L59), `VolunteerServiceView.vue` can surface the church name in its header (near `formattedDate`, VolunteerServiceView.vue:215-219) directly from `doc.value.orgName`. Keep the "orgId only ever from the store match, never a route/query param" invariant (L201-203) — do not add orgId/orgName as a route param to carry the filter.

## Shared Patterns

### Set-dedupe for distinct lists
**Source:** `src/utils/rehearseAccess.ts:89-99` (`distinctSongSlots`, cites ADR-0160).
**Apply to:** mySchedule distinct-church derivation.

### Conditional-spread to omit absent keys (never literal `undefined`)
**Source:** `src/utils/rehearseAccess.ts:235` (`...(stageLayoutElements.length > 0 ? { stageLayout: ... } : {})`); same idiom at L166, L181, L187-189.
**Apply to:** emitting optional `orgName` in `buildRehearseAccess`'s return.

### Best-effort projection write (never roll back the primary write)
**Source:** `src/stores/services.ts:619-651` (markAsPlanned try/catch), 693-695 (resync catch).
**Apply to:** both callers when threading `orgName` — no new failure mode may block the status transition or the attachment write.

### Length-gated conditional rendering
**Source:** `src/views/MyScheduleView.vue:40,60,80` and `src/components/AppSidebar.vue:17`.
**Apply to:** gate the switcher on `churches.length > 1` (R405) and the sidebar volunteer-name arm.

### Segmented / tab control markup
**Source:** `src/views/ServicesView.vue:5-38` (plain buttons); `src/views/VolunteerServiceView.vue:49-100` (full ARIA tablist with roving tabindex + `handleTabKeydown` L246+).
**Apply to:** the My Schedule church switcher.

### Pinia singleton cross-component store access
**Source:** `src/views/MyScheduleView.vue:130` and `src/composables/useVolunteerServiceDoc.ts:42` both `useMyScheduleStore()`.
**Apply to:** AppSidebar reading the volunteer's church context from the same store instance.

## No Analog Found

None. Every Phase 130 change extends code shipped in v2.12; each has a direct in-repo precedent (often the same file). No new file type, data-flow, or library is introduced. Planner does not need to fall back to RESEARCH.md patterns.

## Metadata

**Analog search scope:** `src/utils/`, `src/stores/`, `src/views/`, `src/components/`, `src/composables/`
**Files scanned:** rehearseAccess.ts, services.ts, mySchedule.ts, MyScheduleView.vue, AppSidebar.vue, VolunteerServiceView.vue, ServicesView.vue, useVolunteerServiceDoc.ts, auth.ts
**Pattern extraction date:** 2026-09-06
